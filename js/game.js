'use strict';
// Core simulation: players, economy, production, research, orders, movement, combat, garrisons,
// line defences, grenades, healing, supply chains and trucks.
// TODO(patch 0.8): the armoured car (a second vehicle, cls 'vehicle', shape 'tri') reuses the Truck's fuel and repair code.
// Randomness (patch 0.2.1): everything that can change a match's outcome draws from G.rng, a seeded
// Util.mulberry32 stream; looks-only randomness (decals, facing) draws from G.vrng. Player actions
// arrive through Game.command and are logged with their tick in G.orders, ready for replays.
const G = {
  time: 0, tick: 0, speed: 1, lastSpeed: 1, over: false, winner: 0, seed: 1,
  units: [], buildings: [], projectiles: [], effects: [], segs: [],
  unitById: new Map(),
  players: {}, selection: [], squads: {}, toasts: [], orders: [],
  cleanupT: 0,
  rng: Util.mulberry32(1), vrng: Util.mulberry32(2),
};

const Game = (() => {
  const { clamp, dist } = Util;
  const C = Data.COMBAT, SQ = Data.SQUAD, VET = Data.VETERANCY, DIG = Data.DIG, LINES = Data.LINES, NADE = Data.GRENADE;
  const R = () => G.rng();    // simulation stream: anything that can change the outcome
  const V = () => G.vrng();   // visual stream: decals and other looks

  function newPlayer(id, res) {
    const r = {}; for (const k of Data.RES) r[k] = res[k] || 0;
    // DD Q1: Rifling is researched from the start, so Riflemen and Workers are open to everyone.
    return { id, res: r, blueprints: JSON.parse(JSON.stringify(Data.UNITS)), unlocked: new Set(['rifle', 'worker']), done: new Set(), research: {}, harvestMult: 1, digMult: 1,
      rules: {}, bhp: {}, noSupply: false, tracks: { armour: 0, engine: 0, tank: 0, heavy: false, engineAtHeavy: 0 },   // research slots by building type; global rules and building HP set by research (0.5a)
      faction: null, kitEra: 'ww2' };   // DD K: cosmetic only; set by Main, read by UI portraits
  }
  // A new match. The same seed and the same logged commands give the same match, tick for tick.
  function init(seed) {
    G.seed = (seed == null ? 1 : seed) >>> 0; G.rng = Util.mulberry32(G.seed); G.vrng = Util.mulberry32(G.seed ^ 0x5bd1e995);
    _nextId = 1;
    G.time = 0; G.tick = 0; G.cleanupT = 0; G.speed = 1; G.lastSpeed = 1; G.over = false; G.winner = 0;
    G.units = []; G.buildings = []; G.projectiles = []; G.effects = []; G.selection = []; G.squads = {}; G.toasts = []; G.orders = []; G.unitById = new Map();
    G.stats = { 0: { kills: 0, lost: 0 }, 1: { kills: 0, lost: 0 }, 2: { kills: 0, lost: 0 } };
    G.buildingById = new Map(); G.sandbox = false; G.difficulty = G.difficulty || 'hard';
    G.decals = [];   // blood, splats and corpses left on the ground
    G.segs = []; G.segById = new Map(); G.segGrid = new Map(); G.segNext = 1; G.lineNext = 1; G.healT = 0;   // line defences, healing (0.4)
    G.smokes = []; G.smokeVer = 0; G.lastSeen = {}; G.seenT = 0;   // smoke clouds, Signals markers (0.5a)
    G.planT = 1e9; G.cutT = 0;   // supply chains (0.5a.2): replan at once on the first tick
    G.players = { 0: newPlayer(0, {}), 1: newPlayer(1, Data.START.res), 2: newPlayer(2, { wood: 3000, metal: 1500, sulfur: 600 }) };
    for (const t of Object.keys(Data.UNITS)) G.players[0].unlocked.add(t);   // neutral guards; the AI unlocks over time (DD G7)
  }
  function toast(msg) { G.toasts.push({ msg, t: 3.5 }); if (G.toasts.length > 4) G.toasts.shift(); }
  function addDecal(d) { d.t = 0; G.decals.push(d); if (G.decals.length > 400) G.decals.shift(); }
  // First shots after a quiet spell raise the "!" mark above a unit.
  function alertUnit(e) { if (G.time - e.lastAttackedT > 6) e.alertT = 1.6; e.lastAttackedT = G.time; }
  function setSpeed(s) { if (s === 0 && G.speed !== 0) G.lastSpeed = G.speed; G.speed = s; }
  function togglePause() { setSpeed(G.speed === 0 ? (G.lastSpeed || 1) : 0); }

  // ---- blueprints, costs, research ----
  function statsFor(owner, type) { const bp = G.players[owner].blueprints[type]; return { hp: bp.hp, speed: bp.speed, vision: bp.vision, weapon: bp.weapon ? { ...bp.weapon } : null, camo: bp.camo || 0, nadeCooldown: bp.nadeCooldown || 0, armor: bp.armor, fuel: bp.fuel || 0 }; }
  // A rule a Global research changed (DD F 'G' items), or its default.
  const rule = (owner, k, def) => { const p = G.players[owner]; return p && p.rules[k] != null ? p.rules[k] : def; };
  // DD I: the HQ trains Riflemen at 0.7x and Workers at full speed; prodMult maps unit type to a multiplier.
  function prodMult(b, type) { const m = b.def.prodMult; return (m && m[type]) || 1; }
  function prodTime(b, type) { return G.players[b.owner].blueprints[type].time / prodMult(b, type); }
  function canAfford(p, cost) { for (const k in cost) if ((p.res[k] || 0) < cost[k]) return false; return true; }
  function pay(p, cost, mult = 1) { for (const k in cost) p.res[k] -= cost[k] * mult; }
  // ---- tech tree (DD F): one slot per building type; Tier I at the HQ, II and III at the branch
  // building, III only while the player owns an R&D Lab. A slot pauses while you own none of its buildings.
  const owns = (pid, type) => G.buildings.some(b => b.owner === pid && b.type === type && !b.dead && b.built);
  function slotOf(rid) { const r = Data.RESEARCH[rid]; return r.tier === 1 ? 'hq' : Data.BRANCHES[r.branch].building; }
  function researchLock(p, rid) {
    const r = Data.RESEARCH[rid], slot = slotOf(rid);
    const miss = r.req.filter(q => !p.done.has(q));
    if (miss.length) return 'Requires ' + miss.map(q => Data.RESEARCH[q].name).join(', ');
    if (!owns(p.id, slot)) return 'Needs a ' + Data.BUILDINGS[slot].name;
    if (r.tier === 3 && !owns(p.id, 'lab')) return 'Tier III: needs an R&D Lab';
    if (r.needsArmour && p.tracks.armour < r.needsArmour) return 'Needs Truck Armour level ' + r.needsArmour;
    return '';
  }
  // Truck tracks (DD A) repeat forever; each level costs costGrow times the last.
  function researchCost(p, rid) {
    const r = Data.RESEARCH[rid]; if (!r.track) return r.cost;
    const m = Math.pow(Data.TRUCK_TRACKS.costGrow, p.tracks[r.track]), c = {}; for (const k in r.cost) c[k] = Math.round(r.cost[k] * m); return c;
  }
  function researchState(p, rid) {
    const r = Data.RESEARCH[rid], slot = slotOf(rid), job = p.research[slot];
    if (p.done.has(rid) && !r.track) return 'done';
    if (job && job.id === rid) return 'active';
    if (researchLock(p, rid)) return 'locked';
    if (job) return 'busy';
    if (!canAfford(p, researchCost(p, rid))) return 'poor';
    return 'ready';
  }
  function startResearch(pid, rid) {
    const p = G.players[pid]; if (!Data.RESEARCH[rid]) return false; const s = researchState(p, rid);
    if (s !== 'ready') { if (pid === 1) { if (s === 'poor') toast('Not enough resources'); else if (s === 'busy') toast('The ' + Data.BUILDINGS[slotOf(rid)].name + ' is already researching'); else if (s === 'locked') toast(researchLock(p, rid)); } return false; }
    pay(p, researchCost(p, rid)); p.research[slotOf(rid)] = { id: rid, t: 0, total: Data.RESEARCH[rid].time }; return true;
  }
  // The Truck blueprint from its tracks (DD A): Armour +15% HP, Engine +8% speed, Tank +20% fuel per
  // level; price +10% per level of any track; Heavy Armour removes the Engine speed gained before it.
  function applyTracks(p) {
    const T = Data.TRUCK_TRACKS, base = Data.UNITS.truck, bp = p.blueprints.truck, tr = p.tracks;
    bp.hp = base.hp * Math.pow(T.armour.mult, tr.armour);
    bp.speed = base.speed * Math.pow(T.engine.mult, tr.engine - tr.engineAtHeavy);
    bp.fuel = base.fuel * Math.pow(T.tank.mult, tr.tank);
    bp.armor = tr.heavy ? 'heavy' : base.armor;
    const pm = Math.pow(T.priceGrow, tr.armour + tr.engine + tr.tank); bp.cost = {}; for (const k in base.cost) bp.cost[k] = Math.round(base.cost[k] * pm);
    bp.level = tr.armour + tr.engine + tr.tank + (tr.heavy ? 1 : 0);
  }
  function applyResearch(p, rid) {
    const r = Data.RESEARCH[rid]; p.done.add(rid);
    if (r.track) { p.tracks[r.track]++; applyTracks(p); return; }
    if (rid === 'truckHeavy') { p.tracks.heavy = true; p.tracks.engineAtHeavy = p.tracks.engine; applyTracks(p); return; }
    if (r.unlock) p.unlocked.add(r.unlock);
    for (const e of r.effects || []) {
      if (e.harvest) { p.harvestMult *= e.harvest; continue; }
      if (e.dig) { p.digMult *= e.dig; continue; }   // Entrenching Tools: every digger, existing ones too
      if (e.rule) { p.rules[e.rule] = e.set; continue; }   // DD F 'G': a rule, for units already in the field too
      if (e.buildingHp) {   // Reinforced Concrete: existing buildings included
        for (const t of e.buildingHp) p.bhp[t] = (p.bhp[t] || 1) * e.mult;
        for (const b of G.buildings) if (b.owner === p.id && !b.dead && e.buildingHp.includes(b.type)) { b.maxHp *= e.mult; b.hp *= e.mult; }
        continue;
      }
      for (const [t, bp] of Object.entries(p.blueprints)) {
        const match = e.units === 'all' || (e.units === 'infantry' && bp.cls === 'infantry') || (e.units === 'firearms' && bp.weapon && !bp.weapon.indirect) || (Array.isArray(e.units) && e.units.includes(t));
        if (!match) continue;
        if (e.set != null) { bp[e.stat] = e.set; continue; }
        if (bp.weapon && e.stat in bp.weapon) bp.weapon[e.stat] *= e.mult; else if (e.stat in bp && e.stat !== 'weapon') bp[e.stat] *= e.mult;
      }
    }
    checkKit(p);
  }
  // DD K: Cold War kit for newly trained soldiers once the player owns an R&D Lab and has 2 Tier III items.
  function checkKit(p) {
    if (p.kitEra !== 'ww2' || !owns(p.id, 'lab')) return;
    if ([...p.done].filter(id => Data.RESEARCH[id] && Data.RESEARCH[id].tier === 3).length < Data.KIT.coldTier3) return;
    p.kitEra = 'cold'; if (p.id === 1) toast('New kit: soldiers trained from now on wear Cold War uniforms');
  }
  // ---- supply (DD Q18, G14) ----
  function supplyCap(pid) { const p = G.players[pid]; let n = 0; for (const b of G.buildings) if (b.owner === pid && !b.dead && b.built && b.def.supply) n++; return Data.SUPPLY.start + n * rule(pid, 'perDepot', Data.SUPPLY.perDepot); }
  function supplyUsed(pid) {
    let n = 0; const p = G.players[pid];
    for (const u of G.units) if (u.owner === pid && !u.dead) n += u.def.supply || 1;
    for (const b of G.buildings) if (b.owner === pid && !b.dead) for (const q of b.queue) n += p.blueprints[q.type].supply || 1;
    return n;
  }
  // DD G14: each extra Depot costs 25% more than the last (buildings with costGrow).
  function costOf(pid, type) {
    const def = Data.BUILDINGS[type]; if (!def.costGrow) return def.cost;
    let n = 0; for (const b of G.buildings) if (b.owner === pid && !b.dead && b.type === type) n++;
    const c = {}; for (const k in def.cost) c[k] = Math.round(def.cost[k] * Math.pow(def.costGrow, n)); return c;
  }
  // Workers a harvest building takes: Deep Shafts lets Mines take 6.
  // Workers queued at the HQ for this building (hireFor), so its button knows how many are coming.
  const hiresFor = b => G.buildings.reduce((n, h) => n + (h.owner === b.owner ? h.queue.filter(q => q.assign === b.id).length : 0), 0);
  const maxWorkers = b => b.type === 'mine' ? rule(b.owner, 'mineWorkers', b.def.maxWorkers) : b.def.maxWorkers;

  // ---- spawning ----
  function spawnUnit(type, owner, x, y) {
    const u = new Unit(type, owner, x, y, statsFor(owner, type));
    // DD K: looks only. The kit era is fixed at training time, so veterans keep their old kit.
    const p = G.players[owner]; u.faction = p.faction; u.kitEra = p.kitEra;
    if (u.cargo) { const bp = p.blueprints[type]; u.price = { ...bp.cost }; u.bpLevel = bp.level || 0; }   // what this Truck cost, for retrofits
    G.units.push(u); G.unitById.set(u.id, u); return u;
  }
  function addBuilding(type, owner, x, y, built) {
    const b = new Building(type, owner, x, y, built);
    const hm = G.players[owner].bhp[type] || 1; if (hm !== 1) { b.maxHp *= hm; b.hp *= hm; }   // Reinforced Concrete
    if (b.def.harvest === 'deposit') { const d = Terrain.depositNear(x, y, 50); b.depositType = d ? d.type : null; }   // same reach as canPlace
    G.buildings.push(b); G.buildingById.set(b.id, b); Terrain.setBlocked(x, y, b.w, b.h, true); Path.invalidate(); G.planT = 1e9;
    return b;
  }

  // ---- garrisons (Scout Tower, Bunker, HQ): enter, unload, upgrade ----
  const isHeavy = u => u.def.shape === 'square';
  function canEnter(u, b) {
    // Unarmed units (Workers, Medics) stay out: a slot is for firing from.
    const lv = b.slots; if (!lv || b.dead || !b.built || b.owner !== u.owner || u.def.cls !== 'infantry' || !u.stats.weapon) return false;
    let inf = 0, hv = 0, mg = 0;
    for (const id of b.garrison) { const g = G.unitById.get(id); if (!g || g.dead) continue; if (isHeavy(g)) hv++; else if (g.type === 'hmg') mg++; else inf++; }
    const mgSlots = lv.mg || 0; inf += Math.max(0, mg - mgSlots);   // DD B: a Bunker's MG slot; extra machine gunners take infantry slots
    if (isHeavy(u)) return hv < (lv.heavy || 0);
    if (u.type === 'hmg' && mg < mgSlots) return true;
    return inf < lv.cap;
  }
  const slotCount = lv => lv.cap + (lv.heavy || 0) + (lv.mg || 0);
  function enterBuilding(u, b) {
    releaseWork(u); u.queue = []; u.order = null; u.field = null; u.forced = null; u.target = null; u.micro = null; u.flee = 0; u.windup = null;
    u.inside = b.id; u.hBonus = b.slots.height; u.x = b.x; u.y = b.y; u.stress = Math.min(u.stress, 0.3);
    b.garrison.push(u.id);
    G.selection = G.selection.filter(s => s !== u);
  }
  function placeOutside(u, b, n) {
    const cls = u.cls; const ang = n * 0.9 + 0.4; const r = b.size + 16;
    let x = b.x + Math.cos(ang) * r, y = b.y + Math.sin(ang) * r;
    if (!Terrain.passableAt(x, y, cls)) { const p = Path.nearestPassable(Terrain.cellI(x), Terrain.cellJ(y), cls); if (p) { x = Terrain.cx(p[0]); y = Terrain.cy(p[1]); } }
    u.x = x; u.y = y; u.inside = null; u.hBonus = 0; u.order = null; u.field = null; u.target = null;
  }
  function unloadBuilding(b) {
    let n = 0;
    for (const id of b.garrison) { const u = G.unitById.get(id); if (u && !u.dead) placeOutside(u, b, n++); }
    b.garrison = []; return n;
  }
  function upgradeTower(b) {
    if (!b.def.levels || b.dead || !b.built || b.upgrading || b.level >= b.def.levels.length) return false;
    const next = b.def.levels[b.level]; const p = G.players[b.owner];
    if (!canAfford(p, next.cost)) { if (b.owner === 1) toast('Not enough resources'); return false; }
    pay(p, next.cost); b.upgrading = { t: 0, total: next.time }; return true;
  }
  function orderGarrison(units, b, queue = false) {
    let n = 0;
    for (const u of units) { if (u.dead || u.inside || u.def.cls !== 'infantry') continue; issue(u, { kind: 'garrison', building: b }, queue); n++; }
    return n;
  }
  function canPlace(type, owner, x, y) {
    const def = Data.BUILDINGS[type];
    if (!Terrain.areaOk(x, y, def.w + 4, def.h + 4, null, 0.3)) return false;
    for (const b of G.buildings) if (!b.dead && Math.abs(b.x - x) < (b.w + def.w) / 2 + 8 && Math.abs(b.y - y) < (b.h + def.h) / 2 + 8) return false;
    for (const u of G.units) if (!u.dead && Math.abs(u.x - x) < def.w / 2 + 6 && Math.abs(u.y - y) < def.h / 2 + 6) return false;
    if (def.needs === 'forest' && Terrain.forestCellsNear(x, y, 70) < 8) return false;
    if (def.needs === 'deposit') {
      const d = Terrain.depositNear(x, y, 50);
      if (!d || !(def.deposits || ['metal', 'sulfur']).includes(d.type)) return false;
      for (const b of G.buildings) if (!b.dead && b.def.needs === 'deposit' && Terrain.depositNear(b.x, b.y, 50) === d) return false;
    } else if (Terrain.depositNear(x, y, 40)) return false;
    if (owner === 1 && !Fog.visible(1, x, y)) return false;
    return true;
  }
  // Buildings and line types with `requires` need that research first.
  const hasTech = (p, def) => !def.requires || p.done.has(def.requires);
  function placeBuilding(type, owner, x, y) {
    const p = G.players[owner], def = Data.BUILDINGS[type];
    if (!hasTech(p, def)) { if (owner === 1) toast('Research ' + Data.RESEARCH[def.requires].name + ' first'); return null; }
    if (!canPlace(type, owner, x, y)) { toast('Cannot build there'); return null; }
    const cost = costOf(owner, type);
    if (!canAfford(p, cost)) { toast('Not enough resources'); return null; }
    pay(p, cost); return addBuilding(type, owner, x, y, false);
  }

  // ---- orders ----
  function releaseWork(u) {
    u.load = null;   // a reassigned carrier drops his load
    if (u.work == null) return;
    const b = G.buildings.find(b => b.id === u.work); if (b) b.workers = b.workers.filter(id => id !== u.id);
    u.work = null;
  }
  // Orders are descriptors {kind, ...}. With queue=true they wait behind the unit's current order (Shift).
  function issue(u, o, queue) {
    if (u.dead) return;
    const standing = u.order && ['hold', 'bombard', 'haul', 'work'].includes(u.order.type);   // orders that never finish on their own (Shift replaces them)
    if (queue && !standing && (u.order || u.queue.length)) { u.queue.push(o); return; }
    u.queue = []; applyOrder(u, o);
  }
  function applyOrder(u, o) {
    releaseWork(u); u.forced = null; u.micro = null; u.stuck = 0; u.field = null; u.order = null; u.windup = null;
    switch (o.kind) {
      case 'move': case 'attackmove': {
        const f = Path.getField(o.x, o.y, u.def.cls, G.time); if (!f) break;
        u.order = { type: o.kind, x: f.tx, y: f.ty, offx: o.offx || 0, offy: o.offy || 0, arrive: o.arrive || 12, phase: 0, retreat: !!o.retreat, maxSpeed: o.maxSpeed || 0, unload: !!o.unload }; u.field = f;
        break;
      }
      case 'attack': {
        const t = o.target; if (!t || t.dead) break;
        if (u.suppressed && !u.def.obeysWhenSuppressed) { applyOrder(u, { kind: 'attackmove', x: t.x, y: t.y, arrive: 20 }); break; }
        u.forced = t; u.target = t; u.order = { type: 'attack', target: t }; u.acquireT = 0;
        break;
      }
      case 'bombard':
        if (u.stats.weapon && u.stats.weapon.indirect) u.order = { type: 'bombard', x: o.x, y: o.y, smoke: !!o.smoke };
        else applyOrder(u, { kind: 'attackmove', x: o.x, y: o.y, arrive: 20 });
        break;
      case 'hold': u.order = { type: 'hold', x: u.x, y: u.y, until: o.until || 0 }; break;
      case 'garrison': {
        const b = o.building;
        if (!canEnter(u, b)) { if (u.owner === 1 && b && !b.dead) toast(b.def.name + ' cannot take this unit'); break; }
        const f = Path.getField(b.x, b.y + b.h / 2 + 12, u.def.cls, G.time); if (!f) break;
        u.order = { type: 'garrison', building: b, x: f.tx, y: f.ty, offx: 0, offy: 0, arrive: 10, phase: 0 }; u.field = f;
        break;
      }
      case 'work': {
        const b = o.building;
        if (!b || b.dead || !b.built || !(u.def.cls === 'infantry' || u.def.load) || b.workers.length >= maxWorkers(b)) { if (u.owner === 1 && b && !b.dead) toast(b.def.name + ' is full'); break; }
        b.workers.push(u.id); u.work = b.id;
        const slot = b.workers.length - 1; const ang = slot / maxWorkers(b) * Math.PI * 2 + 0.6;
        const px = b.x + Math.cos(ang) * (b.w / 2 + 12), py = b.y + Math.sin(ang) * (b.h / 2 + 12);
        const f = Path.getField(px, py, u.def.cls, G.time); if (!f) { releaseWork(u); break; }
        u.order = { type: 'work', x: f.tx, y: f.ty, offx: 0, offy: 0, arrive: 6, phase: 0 }; u.field = f;
        break;
      }
      case 'board': {   // walk to a Truck and get in (0.5b); the rest of the queue waits until it unloads
        const t = o.truck; if (!t || t.dead || !t.cargo || t.owner !== u.owner || u.def.cls !== 'infantry') break;
        u.order = { type: 'board', truck: t, tk: -1, ferry: !!o.ferry };
        break;
      }
      case 'ferry':   // a squadron's Truck: wait for its riders, then drive and unload (DD E, G4)
        u.order = { type: 'ferry', riders: o.riders, t0: G.time, next: o.next };
        break;
      case 'dig':   // dig (or, Workers only, fill) the segments of one drawn line, nearest first
        if (u.def.cls !== 'infantry' || (o.fill && !u.def.labour)) break;
        u.order = { type: 'dig', line: o.line, fill: !!o.fill, seg: null, fseg: null };
        break;
      case 'demolish':
        if (u.def.cls !== 'infantry' || !u.stats.weapon || !G.players[u.owner].done.has('demolition') || !o.seg || !LINES[o.seg.type].demolish) break;
        u.order = { type: 'demolish', seg: o.seg, t: 0, fseg: null };
        break;
      case 'grenade':
        if (!canThrow(u)) break;
        u.order = { type: 'grenade', x: o.x, y: o.y, target: o.target || null };
        break;
    }
  }
  function nextOrder(u) { u.order = null; u.field = null; u.forced = null; if (u.queue.length) applyOrder(u, u.queue.shift()); }

  // Squad members move in their squadron's formation; everyone else in a plain grid. opts.facing and
  // opts.width come from a right-drag (DD E): the arrival line's direction and width.
  function orderMove(units, x, y, mode = 'move', queue = false, retreat = false, opts = {}) {
    const list = units.filter(u => !u.dead); if (!list.length) return;
    const loose = [];
    for (const [n, members] of bySquad(list)) {
      if (n === 0) { loose.push(...members); continue; }
      // Riders already in the squadron's Truck get their new place too, and the Truck unloads there.
      const s = G.squads[n], t = members.find(m => m.cargo), aboard = t ? membersOf(s).filter(m => m.inside === t.id) : [];
      const slots = formation(s, members.concat(aboard), x, y, opts);
      if (!queue) for (const r of aboard) { const o = slots.get(r); r.queue = [{ kind: mode, x, y, offx: o[0], offy: o[1], arrive: o[2] }]; }
      if (!queue && !retreat && ferry(s, members, x, y, mode, slots)) continue;
      const maxSpeed = s.move === 'slow' ? Math.min(...members.map(u => u.stats.speed)) : 0;
      for (const u of members) { const o = slots.get(u); issue(u, { kind: mode, x, y, offx: o[0], offy: o[1], arrive: o[2], retreat, maxSpeed, unload: u === t && aboard.length > 0 }, queue); }
    }
    const n = loose.length; if (!n) return;
    const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), spacing = 15;
    const arrive = Math.max(12, spacing * Math.sqrt(n) * 0.75);
    loose.forEach((u, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      issue(u, { kind: mode, x, y, offx: (c - (cols - 1) / 2) * spacing, offy: (r - (rows - 1) / 2) * spacing, arrive, retreat }, queue);
    });
  }
  function orderAttack(units, target, queue = false) {
    if (!queue && units.some(u => !u.dead && u.owner === 1 && u.suppressed && !u.def.obeysWhenSuppressed)) toast('Suppressed units cannot pick targets');
    for (const u of units) if (u.stats.weapon) issue(u, { kind: 'attack', target }, queue);   // Medics, Workers and Trucks keep what they were doing
  }
  const isIndirect = u => !!(u.stats.weapon && u.stats.weapon.indirect);
  function orderBombard(units, x, y, queue = false) {
    const direct = units.filter(u => !u.dead && !isIndirect(u));
    for (const u of units) if (!u.dead && isIndirect(u)) issue(u, { kind: 'bombard', x, y }, queue);
    if (direct.length) orderMove(direct, x, y, 'attackmove', queue);
  }
  function orderStop(units) { for (const u of units) { u.queue = []; releaseWork(u); u.windup = null; u.order = null; u.field = null; u.forced = null; u.micro = null; } }
  function orderHold(units, queue = false) { for (const u of units) issue(u, { kind: 'hold' }, queue); }
  function orderDig(units, line, fill, queue = false) {
    let n = 0; const sg0 = G.segs.find(o => o.line === line), wo = sg0 && LINES[sg0.type].workersOnly;
    for (const u of units) { if (u.dead || u.inside || u.def.cls !== 'infantry' || ((fill || wo) && !u.def.labour)) continue; issue(u, { kind: 'dig', line, fill }, queue); n++; }
    return n;
  }
  function orderGrenade(units, x, y, target, queue = false) {
    let n = 0;
    for (const u of units) { if (u.dead || u.inside || !canThrow(u)) continue; issue(u, { kind: 'grenade', x, y, target }, queue); n++; }
    return n;
  }
  function orderWork(units, b, queue = false) {
    let n = 0;
    for (const u of units) { if (u.dead || !(u.def.cls === 'infantry' || u.def.load) || u.work === b.id) continue; issue(u, { kind: 'work', building: b }, queue); n++; }
    return n;
  }
  // Pull back a short distance towards the owner's headquarters, as one group. DD Q10: while
  // retreating there is no suppression slowdown and stress drains twice as fast; panic still can happen.
  function orderRetreat(units, queue = false) {
    const list = units.filter(u => !u.dead); if (!list.length) return;
    const hq = G.buildings.find(b => b.owner === list[0].owner && b.type === 'hq' && !b.dead);
    if (!hq) { orderStop(list); return; }
    let cx = 0, cy = 0; for (const u of list) { cx += u.x; cy += u.y; } cx /= list.length; cy /= list.length;
    const dx = hq.x - cx, dy = hq.y + hq.h / 2 + 30 - cy; const d = Math.hypot(dx, dy);
    if (d < 1) { orderStop(list); return; }
    const step = Math.min(180, Math.max(0, d - 30)), tx = cx + dx / d * step, ty = cy + dy / d * step;
    // DD E: a squadron makes a fighting withdrawal. The rear ranks fall back at once while the front
    // rank holds for SQ.coverTime seconds, then follows to its place in the new line.
    const loose = [];
    for (const [n, members] of bySquad(list)) {
      if (n === 0 || queue) { loose.push(...members); continue; }
      const slots = formation(G.squads[n], members, tx, ty, {});
      for (const u of members) {
        const o = slots.get(u), move = { kind: 'move', x: tx, y: ty, offx: o[0], offy: o[1], arrive: o[2], retreat: true };
        if (u.def.role === 1 && members.some(m => m.def.role !== 1)) { u.queue = []; applyOrder(u, { kind: 'hold', until: G.time + SQ.coverTime }); u.queue = [move]; }
        else issue(u, move, false);
      }
    }
    if (loose.length) orderMove(loose, tx, ty, 'move', queue, true);
  }

  // ---- production ----
  function enqueue(b, type) {
    const p = G.players[b.owner]; const bp = p.blueprints[type];
    if (!p.unlocked.has(type) || b.queue.length >= 8) return false;
    if (!p.noSupply && supplyUsed(b.owner) + (bp.supply || 1) > supplyCap(b.owner)) { if (b.owner === 1) toast('Not enough supply: build a Depot'); return false; }
    if (!canAfford(p, bp.cost)) { if (b.owner === 1) toast('Not enough resources'); return false; }
    pay(p, bp.cost); b.queue.push({ type, t: 0, total: prodTime(b, type), cost: { ...bp.cost } }); return true;   // the price paid, for a fair refund
  }
  function cancelQueue(b, i) { const q = b.queue[i]; if (!q) return; pay(G.players[b.owner], q.cost || G.players[b.owner].blueprints[q.type].cost, -1); b.queue.splice(i, 1); }   // refunds what was paid, not today's price
  function spawnFrom(b, type, q) {
    const cls = Data.MOVE_CLASSES[Data.UNITS[type].cls];
    let x = b.x + (R() - 0.5) * b.w * 0.6, y = b.y + b.h / 2 + 10;
    if (!Terrain.passableAt(x, y, cls)) { const p = Path.nearestPassable(Terrain.cellI(x), Terrain.cellJ(y), cls); if (p) { x = Terrain.cx(p[0]); y = Terrain.cy(p[1]); } }
    const u = spawnUnit(type, b.owner, x, y);
    // Kaan, 0.5b.3: a Worker trained for a gatherer ("Train a Worker" on its panel) goes straight to work there.
    const job = q && q.assign != null ? G.buildingById.get(q.assign) : null;
    if (job && !job.dead && job.built && job.workers.length < maxWorkers(job)) { orderWork([u], job); return u; }
    const rs = b.rally && b.rally.squad ? G.squads[b.rally.squad] : null;
    if (rs && rs.members.length < SQ.max) {   // DD E: a rally point on a squad member reinforces that squadron
      joinSquad(rs, u); const c = squadCentre(rs, u); orderMove([u], c[0], c[1]);
    } else if (b.rally) orderMove([u], b.rally.x, b.rally.y); else u.micro = { x: x + (R() - 0.5) * 40, y: y + 14 + R() * 24 };
    return u;
  }

  // ---- per-frame systems ----
  function updateResearch(dt) {
    for (const p of Object.values(G.players)) for (const slot of Object.keys(p.research)) {
      const job = p.research[slot]; if (!owns(p.id, slot)) continue;   // paused while no building of this type stands
      job.t += dt;
      if (job.t >= job.total) { delete p.research[slot]; applyResearch(p, job.id); if (p.id === 1) toast('Research complete: ' + Data.RESEARCH[job.id].name); }
    }
  }
  // Labour at a camp: a Worker counts 1, a soldier half (DD Q4). Since 0.5a.2 everyone assigned counts,
  // wherever they are on the supply line (Kaan). A Truck (labour 0) only carries.
  function activeWorkers(b) {
    let n = 0;
    for (const id of b.workers) { const u = G.unitById.get(id); if (u && !u.dead && u.work === b.id) n += (u.def.labour != null ? u.def.labour : Data.ECONOMY.soldierLabour) * Math.pow(VET.perRank.work, u.def.labour ? u.rank : 0); }   // a Truck (labour 0) only carries
    return n;
  }
  function updateBuildings(dt) {
    for (const b of G.buildings) {
      if (b.dead) continue;
      if (!b.built) {
        b.progress = Math.min(1, b.progress + dt / b.def.buildTime); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.9 * dt / b.def.buildTime);
        if (b.built) { b.hp = b.maxHp; if (b.owner === 1) toast(b.def.name + ' complete'); if (b.type === 'lab') checkKit(G.players[b.owner]); G.planT = 1e9; }
        continue;
      }
      const p = G.players[b.owner];
      if (b.upgrading) {
        b.upgrading.t += dt;
        if (b.upgrading.t >= b.upgrading.total) {
          b.upgrading = null; b.level++; const lv = b.levelDef;
          const lvHp = lv.hp * (p.bhp[b.type] || 1); b.hp += lvHp - b.maxHp; b.maxHp = lvHp;
          for (const id of b.garrison) { const u = G.unitById.get(id); if (u) u.hBonus = lv.height; }
          if (b.owner === 1) toast(b.def.name + ' upgraded to level ' + b.level);
        }
      }
      if (b.queue.length) { const q = b.queue[0]; q.t += dt; if (q.t >= q.total) { b.queue.shift(); spawnFrom(b, q.type, q); } }
      if (b.def.harvest) {
        const rate = (b.def.rate + activeWorkers(b) * b.def.perWorker) * p.harvestMult * Data.ECONOMY.pace;
        const key = b.def.harvest === 'wood' ? 'wood' : b.depositType;
        // Kaan, 0.5a.2: output goes into the building's stock, and carriers take it to a drop-off. The
        // scripted AI keeps its direct income (DD Q23).
        if (key && p.ai && b.type !== 'mine') p.res[key] += rate * dt;   // Kaan, 0.5a.3: the AI's mines need carriers too
        else if (key) b.stock[key] = Math.min(Data.LOGISTICS.stockCap, (b.stock[key] || 0) + rate * dt);
      }
      if (b.def.trickle) for (const k in b.def.trickle) p.res[k] += b.def.trickle[k] * dt;   // DD G2: a Depot's oil trickle
      if (b.owner === 1 || Fog.visible(1, b.x, b.y)) b.seen = true;
    }
  }
  function harvestRate(b) { const p = G.players[b.owner]; return (b.def.rate + activeWorkers(b) * b.def.perWorker) * p.harvestMult * Data.ECONOMY.pace; }

  // ---- combat helpers ----
  // Height difference shooter minus target; u.hBonus is the height of a tower the unit stands in.
  // DD I: differences under the dead zone count as flat ground.
  function heightDiff(u, tx, ty) { const dh = Terrain.hAt(u.x, u.y) + u.hBonus - Terrain.hAt(tx, ty); return Math.abs(dh) < C.deadZone ? 0 : dh; }
  // DD Q8: range grows with the square root of the height, at most +50%; uphill loses up to 20%.
  // DD I: indirect fire gets half the bonus, at most +25% (the uphill penalty is the same as direct fire).
  function rangeMult(u, dh) {
    if (dh > 0) {
      let b = Math.min(C.rangeUp * Math.sqrt(dh), C.rangeUpMax);
      if (u.stats.weapon.indirect) b = Math.min(b * C.indirectRangeShare, C.indirectRangeMax);
      return 1 + b;
    }
    if (dh < 0) return 1 - Math.min(C.rangeDown * Math.sqrt(-dh), C.rangeDownMax);
    return 1;
  }
  function effRange(u, tx, ty) { const w = u.stats.weapon; return w ? w.range * rangeMult(u, heightDiff(u, tx, ty)) : 0; }
  // DD Q8: damage and accuracy follow steepness s = dh / max(d, 20), so height matters most up close.
  function steepness(u, tx, ty) { return heightDiff(u, tx, ty) / Math.max(dist(u.x, u.y, tx, ty), C.steepMinDist); }
  function dmgMult(u, tx, ty) { return 1 + clamp(C.dmgSteep * steepness(u, tx, ty), C.dmgMin, C.dmgMax); }
  function hitMult(u, tx, ty) { return 1 + clamp(C.hitSteep * steepness(u, tx, ty), C.hitMin, C.hitMax); }
  // Every source of stress goes through here. DD Q12: snipers take half; DD I: stress taken is at least x0.25.
  // Garrisoned units take none, except from a grenade in a Bunker (force, DD G13). DD B: half in a trench.
  function addStress(u, amt, force) {
    if (u.dead || (u.inside && !force) || amt <= 0 || u.cargo) return;   // vehicles take no stress
    const ls = u.inside ? null : lineAt(u.x, u.y);
    u.stress = Math.min(1, u.stress + amt * Util.stack('stressTaken', u.def.stressTaken || 1, Math.pow(VET.perRank.stressTaken, u.rank), ls ? LINES[ls.type].stress : 1));   // DD H1: -10% per rank
  }
  // Camouflage Uniforms (DD F): infantry with camo standing in forest are spotted only by an enemy unit
  // or building within camo x its vision range. Cached per tick and side.
  function detected(e, owner) {
    if (!(e instanceof Unit) || !e.stats.camo || Terrain.typeAt(e.x, e.y) !== Terrain.T_FOREST) return true;
    if (!e._det || e._det.tick !== G.tick) e._det = { tick: G.tick };
    if (e._det[owner] != null) return e._det[owner];
    let ok = false;
    for (const o of G.units) if (!o.dead && o.owner === owner && dist(o.x, o.y, e.x, e.y) <= o.stats.vision * e.stats.camo) { ok = true; break; }
    if (!ok) for (const b of G.buildings) if (!b.dead && b.owner === owner && dist(b.x, b.y, e.x, e.y) <= Fog.buildingVision(b).range * e.stats.camo) { ok = true; break; }
    return (e._det[owner] = ok);
  }
  // Smoke Shells: a cloud blocks any sight line that passes through it.
  function smokeBlocks(x0, y0, x1, y1) {
    for (const c of G.smokes) {
      const dx = x1 - x0, dy = y1 - y0, t = clamp(((c.x - x0) * dx + (c.y - y0) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      if (dist(c.x, c.y, x0 + dx * t, y0 + dy * t) < c.r) return true;
    }
    return false;
  }
  function canSee(u, e) {
    if (e instanceof Unit && !detected(e, u.owner)) return false;
    if (u.stats.weapon && u.stats.weapon.indirect && u.owner !== 0) return Fog.visible(u.owner, e.x, e.y);
    if (G.smokes.length && smokeBlocks(u.x, u.y, e.x, e.y)) return false;
    return Terrain.los(u.x, u.y, e.x, e.y, 2.2 + u.hBonus, e instanceof Building ? 6 : 1.8);
  }
  function inRange(u, e) {
    if (!u.stats.weapon) return false;
    const d = dist(u.x, u.y, e.x, e.y) - (e instanceof Building ? e.size * 0.7 : 0);
    return d <= effRange(u, e.x, e.y) && d >= u.stats.weapon.minRange;
  }
  function validTarget(u, e) { return e && !e.dead && !e.inside && e.owner !== u.owner && inRange(u, e) && canSee(u, e); }
  // Snipers keep their forced target while suppressed (DD I); everyone else fires at the nearest.
  const keepsOrders = u => !u.suppressed || u.def.obeysWhenSuppressed;
  function acquire(u) {
    const w = u.stats.weapon; if (!w) { u.target = null; return; }   // unarmed: never picks a target
    if (u.forced && !u.forced.dead && keepsOrders(u) && validTarget(u, u.forced)) { u.target = u.forced; return; }
    // DD E: riflemen, machine gunners and mortars share the squad's target; snipers pick their own.
    // On 'keep moving' each member fires at the closest enemy instead (Kaan, after play).
    const sq = u.squad && !u.def.obeysWhenSuppressed && G.squads[u.squad] && G.squads[u.squad].contact === 'react' ? G.squads[u.squad] : null;
    const maxR = w.range * 1.3;
    let best = null, bestS = Infinity;
    for (const e of G.units) {
      if (e.dead || e.inside || e.owner === u.owner) continue;
      const d = dist(u.x, u.y, e.x, e.y); if (d > maxR) continue;
      const s = d + (inRange(u, e) ? 0 : 10000); if (s >= bestS) continue;
      if (!canSee(u, e)) continue;
      best = e; bestS = s;
    }
    if (!best || bestS >= 10000) {
      for (const e of G.buildings) {
        if (e.dead || e.owner === u.owner || e.owner === 0) continue;
        const d = dist(u.x, u.y, e.x, e.y) - e.size * 0.7; if (d > maxR) continue;
        const s = d + (inRange(u, e) ? 0 : 10000) + 50; if (s >= bestS) continue;
        if (!canSee(u, e)) continue;
        best = e; bestS = s;
      }
    }
    // Shared target, softened (Kaan: squads are a utility, 55-60% against loose soldiers): a member
    // switches to the squad's target only when it is nearly as close as his own nearest enemy.
    if (sq && sq.target && sq.target !== best && validTarget(u, sq.target) && (!best || dist(u.x, u.y, sq.target.x, sq.target.y) <= dist(u.x, u.y, best.x, best.y) * SQ.shareRange)) best = sq.target;
    u.target = best;
  }
  function tryFire(u) {
    const w = u.stats.weapon;
    if (!w || u.cooldown > 0) return;
    if (w.noMovingFire && u.wasMoving) return;   // DD Q11: machine gunners must stop to fire
    let tx, ty, target = null;
    if (u.order && u.order.type === 'bombard' && w.indirect) {
      tx = u.order.x; ty = u.order.y; const d = dist(u.x, u.y, tx, ty);
      if (d > effRange(u, tx, ty) || d < w.minRange) return;
    } else {
      if (!u.target || !validTarget(u, u.target)) { u.target = null; return; }
      target = u.target; tx = target.x; ty = target.y;
    }
    if (w.ammo && u.owner !== 0) {
      const p = G.players[u.owner];
      if (!canAfford(p, w.ammo)) { if (u.owner === 1 && G.time - (u.noAmmoT || -99) > 15) { u.noAmmoT = G.time; toast('Mortar has no sulfur for shells'); } return; }
      pay(p, w.ammo);
    }
    u.cooldown = w.reload * (u.suppressed ? 1.4 : 1) * (u.rank >= 3 ? VET.rank3Reload : 1) * (0.9 + R() * 0.2);
    u.facing = Math.atan2(ty - u.y, tx - u.x); u.muzzle = 0.08; u.recoil = w.indirect ? 0.2 : 0.12;
    if (w.indirect) fireShell(u, tx, ty); else fireBullet(u, target);
  }
  function fireBullet(u, e) {
    const w = u.stats.weapon; const d = dist(u.x, u.y, e.x, e.y); const range = effRange(u, e.x, e.y);
    // All factors multiply, then the hit cap applies (DD I). u.wasMoving: the unit moved last tick (DD Q11).
    // DD B: trenches and barricades cover the target; a Bunker's occupants shoot x1.1 (DD I).
    const ls = e instanceof Unit ? lineAt(e.x, e.y) : null, gb = u.inside ? G.buildingById.get(u.inside) : null;
    const p = Util.stack('hit', w.acc, 1 - 0.55 * Math.pow(Math.min(1, d / range), 2), Terrain.coverAt(e.x, e.y), 1 - 0.5 * u.stress,
      u.wasMoving ? rule(u.owner, 'movingAcc', C.movingAcc) : 1, hitMult(u, e.x, e.y), e instanceof Building ? 2.5 : 1, Math.pow(VET.perRank.acc, u.rank),
      ls ? LINES[ls.type].hit : 1, (gb && gb.slots && gb.slots.acc) || 1);
    const hit = R() < p;
    if (!hit && ls && ls.type === 'barricade') damageSeg(ls, w.dmg * DIG.smallArms);   // DD G12: small arms chip barricades
    const dmg = hit ? w.dmg * Data.ARMOR_MULT[w.dtype][e.armor] * dmgMult(u, e.x, e.y) : 0;
    const ang = R() * Math.PI * 2, off = hit ? 0 : 8 + R() * 18;
    const tx = e.x + Math.cos(ang) * off, ty = e.y + Math.sin(ang) * off;
    G.projectiles.push(new Projectile({ kind: 'bullet', x: u.x, y: u.y, tx, ty, dur: Math.max(0.03, d / w.pspeed), dmg, target: hit ? e : null, shooter: u, owner: u.owner }));
    if (e instanceof Unit) {   // every shot at a unit stresses it, hit or miss
      const was = e.suppressed; addStress(e, w.suppress); e.lastHitBy = u; alertUnit(e); returnFire(e, u);
      if (!was && e.suppressed) suppressXp(u, e);
      // Neighbours feel part of it; a weapon with suppressArea (the MG, Kaan 0.5c) spreads more, wider.
      const sa = w.suppressArea || { r: 30, share: 0.2 };
      for (const o of G.units) if (o !== e && !o.dead && !o.inside && o.owner === e.owner && dist(o.x, o.y, e.x, e.y) < sa.r) addStress(o, w.suppress * sa.share);
    }
  }
  function fireShell(u, tx, ty) {
    const w = u.stats.weapon; const d = dist(u.x, u.y, tx, ty);
    const spotted = u.owner === 0 ? true : Fog.visible(u.owner, tx, ty);
    const scatter = (12 + (1 - w.acc) * 40 + (spotted ? 0 : 70)) * (0.6 + 0.4 * d / w.range) * (1 + u.stress * 0.5) * (spotted ? rule(u.owner, 'spotScatter', 1) : 1);   // Forward Observers
    const ang = R() * Math.PI * 2, off = R() * scatter;
    const lx = tx + Math.cos(ang) * off, ly = ty + Math.sin(ang) * off;
    const smoke = !!(u.order && u.order.smoke);
    G.projectiles.push(new Projectile({ kind: 'shell', smoke, x: u.x, y: u.y, tx: lx, ty: ly, dur: 0.9 + d / w.pspeed, arc: 25 + d * 0.12, dmg: w.dmg * dmgMult(u, lx, ly), splash: w.splash, dtype: w.dtype, shooter: u, owner: u.owner }));
    if (smoke) nextOrder(u);   // a smoke order fires one round
  }
  function explode(pr) {
    const { tx: x, ty: y, splash, dmg, dtype, shooter } = pr;
    if (pr.smoke) { G.smokes.push({ x, y, r: Data.SMOKE.radius, t: 0, dur: Data.SMOKE.time }); G.smokeVer++; return; }   // Smoke Shells: no damage
    G.effects.push({ kind: 'explosion', x, y, r: splash, t: 0, dur: 0.6 });
    for (const e of G.units) {
      if (e.dead || e.inside) continue; const d = dist(e.x, e.y, x, y); if (d > splash) continue;
      let m = (0.35 + 0.65 * (1 - d / splash)) * Data.ARMOR_MULT[dtype][e.armor];
      if (Terrain.ridgeCover(x, y, e.x, e.y)) m *= 0.35;
      if (Terrain.coverAt(e.x, e.y) < 1) m *= 0.85;
      const ls = lineAt(e.x, e.y); if (ls && LINES[ls.type].blast) m *= LINES[ls.type].blast;   // Kaan, 0.4.1: a trench halves blast damage
      const was = e.suppressed; addStress(e, 0.3 * (1 - d / splash) + 0.1); e.lastHitBy = shooter; alertUnit(e); returnFire(e, shooter);
      if (!was && e.suppressed && shooter && e.owner !== shooter.owner) suppressXp(shooter, e);
      applyDamage(e, dmg * m, shooter);
    }
    for (const b of G.buildings) {
      if (b.dead) continue; const d = Math.max(0, dist(b.x, b.y, x, y) - b.size * 0.7); if (d > splash) continue;
      // DD G13: a grenade reaches a Bunker's occupants for 30% damage and full stress.
      if (pr.grenade && b.slots && b.slots.grenadeReach) for (const id of b.garrison.slice()) {
        const u = G.unitById.get(id); if (!u || u.dead) continue;
        addStress(u, 0.3 * (1 - d / splash) + 0.1, true); u.lastHitBy = shooter;
        applyDamage(u, dmg * (0.35 + 0.65 * (1 - d / splash)) * Data.ARMOR_MULT[dtype][u.armor] * NADE.bunkerDmg, shooter);
      }
      applyDamage(b, dmg * (0.5 + 0.5 * (1 - d / splash)) * Data.ARMOR_MULT[dtype].building, shooter);
    }
    // DD I: explosives deal full damage to barricades and wire; trenches cannot be destroyed.
    for (const sg of G.segs) { if (!sg.done || !sg.maxHp) continue; const d = segDist(sg, x, y); if (d <= splash) damageSeg(sg, dmg * (0.5 + 0.5 * (1 - d / splash))); }
  }
  // Kaan, 0.5b.2: an idle soldier (no order, not on Defend) shot by an enemy he can't reach attack-moves
  // towards the shooter, so Snipers and Mortars can't pick off a standing group for free. The whole
  // squadron (or the idle loose soldiers within 60 m) goes with him.
  function returnFire(e, by) {
    if (!(by instanceof Unit) || by.dead || by.owner === e.owner || e.dead || e.inside || e.order || e.flee > 0 || !e.stats.weapon || e.work != null) return;
    if (G.time - (e.returnT || -99) < Data.RETURN_FIRE.every || inRange(e, by)) return;
    const idle = m => !m.order && !m.inside && !m.dead && m.stats.weapon && m.work == null && m.flee <= 0;
    const group = e.squad && G.squads[e.squad] ? membersOf(G.squads[e.squad]).filter(idle)
      : G.units.filter(m => m.owner === e.owner && !m.squad && idle(m) && dist(m.x, m.y, e.x, e.y) <= Data.RETURN_FIRE.join);   // loose soldiers standing together go together
    for (const m of group) m.returnT = G.time;
    orderMove(group, by.x, by.y, 'attackmove');
  }
  function applyDamage(e, dmg, by) {
    if (e.dead || dmg <= 0) return;
    if (by instanceof Unit && !by.dead && by.owner !== e.owner) addXp(by, Math.min(dmg, e.hp) / VET.xp.damagePer);   // DD H1
    e.hp -= dmg; if (e.hp <= 0) kill(e, by);
  }
  function kill(e, by) {
    e.dead = true; e.hp = 0;
    G.selection = G.selection.filter(s => s !== e);
    if (e instanceof Unit) {   // kill and loss counters track units only
      const st = G.stats[e.owner]; if (st) st.lost++;
      if (by && by.owner !== e.owner && G.stats[by.owner]) G.stats[by.owner].kills++;
      if (by instanceof Unit && !by.dead && by.owner !== e.owner) addXp(by, VET.xp.kill);
    }
    if (e instanceof Unit) {
      releaseWork(e);
      // DD H1, I: a squad leader's death shocks squadmates within 60 m by +0.3, instead of the usual +0.2.
      const sq = e.squad ? G.squads[e.squad] : null, shocked = new Set();
      if (sq && sq.leader === e.id) for (const m of membersOf(sq)) if (m !== e && dist(m.x, m.y, e.x, e.y) < SQ.leaderRadius) { addStress(m, SQ.leaderDeathShock); shocked.add(m); }
      for (const o of G.units) if (!o.dead && !shocked.has(o) && o.owner === e.owner && dist(o.x, o.y, e.x, e.y) < 45) addStress(o, 0.2);
      if (sq) leaveSquad(e);
      if (e.inside) { const c = G.buildingById.get(e.inside) || G.unitById.get(e.inside); if (c) { if (c.garrison) c.garrison = c.garrison.filter(id => id !== e.id); if (c.cargo) c.cargo = c.cargo.filter(id => id !== e.id); } }   // free the slot
      if (e.cargo) { let n = 0; const riders = e.cargo; e.cargo = []; for (const id of riders) { const p = G.unitById.get(id); if (!p || p.dead) continue; placeOutside(p, e, n++); addStress(p, 0.6); applyDamage(p, p.stats.hp * 0.5, by); if (!p.dead && p.queue.length) nextOrder(p); } }   // a wrecked Truck throws its passengers out, hurt
      // blood, a corpse, and a morale shock that alerts nearby friends
      G.effects.push({ kind: 'shock', x: e.x, y: e.y, t: 0, dur: 0.7, r: 45 });
      const blobs = []; for (let i = 0; i < 5; i++) { const a = V() * Math.PI * 2, rr = V() * e.size * 1.6; blobs.push([Math.cos(a) * rr, Math.sin(a) * rr, e.size * (0.5 + V() * 0.7)]); }
      addDecal({ kind: 'splat', x: e.x, y: e.y, blobs, life: 90 });
      if (!e.inside) addDecal({ kind: 'corpse', x: e.x, y: e.y, shape: e.def.shape, size: e.size, color: Data.PLAYER_COLORS[e.owner], facing: e.facing, life: 60 });
      for (const o of G.units) if (!o.dead && !o.inside && o.owner === e.owner && dist(o.x, o.y, e.x, e.y) < 45) o.alertT = Math.max(o.alertT, 1.2);
    } else {
      Terrain.setBlocked(e.x, e.y, e.w, e.h, false); Path.invalidate(); G.planT = 1e9;   // supply lines re-route
      for (const id of e.workers) { const u = G.unitById.get(id); if (u) u.work = null; }
      e.workers = [];
      // a collapsing tower hurts everyone inside and throws the survivors out
      let n = 0;
      for (const id of e.garrison) { const u = G.unitById.get(id); if (!u || u.dead) continue; placeOutside(u, e, n++); addStress(u, 0.6); applyDamage(u, u.stats.hp * 0.5, by); }
      e.garrison = [];
      G.effects.push({ kind: 'explosion', x: e.x, y: e.y, r: e.size * 1.4, t: 0, dur: 1.1 });
      if (e.type === 'hq') toast(e.owner === 1 ? 'Your headquarters has fallen' : 'Enemy headquarters destroyed!');
      else if (e.owner === 1) toast(e.def.name + ' destroyed');
    }
  }

  // ---- line defences (DD B, G12, I, J) ----
  // A drawn line is cut into 10 m segments { id, line, type, owner, x0, y0, x1, y1, x, y, progress,
  // paid, done, hp, maxHp }. G.segGrid maps a cell to the segments within reach of it, so "does this
  // unit stand in a trench?" is one lookup. Only finished segments have effects.
  const INF = Data.MOVE_CLASSES.infantry, LINE_HALF = 6;   // a unit within 6 m of the line stands in it
  function segDist(sg, x, y) {
    const dx = sg.x1 - sg.x0, dy = sg.y1 - sg.y0, t = clamp(((x - sg.x0) * dx + (y - sg.y0) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return dist(x, y, sg.x0 + dx * t, sg.y0 + dy * t);
  }
  function segNear(x, y, doneOnly, skipLine) {
    const a = G.segGrid.get(Terrain.cellIdxAt(x, y)); if (!a) return null;
    for (const sg of a) if (!sg.dead && sg.line !== skipLine && (!doneOnly || sg.done) && segDist(sg, x, y) <= LINE_HALF) return sg;
    return null;
  }
  function lineAt(x, y) { return G.segs.length ? segNear(x, y, true) : null; }
  // Cells under points sampled every 3 m along the segment, shifted sideways by each offset and run
  // `ext` metres past both ends.
  function segCells(sg, offs, ext) {
    const L = dist(sg.x0, sg.y0, sg.x1, sg.y1) || 1, ux = (sg.x1 - sg.x0) / L, uy = (sg.y1 - sg.y0) / L, n = Math.ceil((L + 2 * ext) / 3), out = new Set();
    for (let i = 0; i <= n; i++) { const t = -ext + (L + 2 * ext) * i / n; for (const o of offs) out.add(Terrain.cellIdxAt(sg.x0 + ux * t - uy * o, sg.y0 + uy * t + ux * o)); }
    return [...out];
  }
  // Resample the dragged path every 10 m and make one unpaid segment per step. Spots that are
  // impassable or already hold another line are skipped.
  function planLine(owner, type, pts) {
    const res = [pts[0]]; let px = pts[0][0], py = pts[0][1], need = DIG.segment;
    for (let i = 1; i < pts.length && res.length <= DIG.maxPoints; i++) {
      const bx = pts[i][0], by = pts[i][1]; let d = dist(px, py, bx, by);
      while (d >= need && res.length <= DIG.maxPoints) { px += (bx - px) * need / d; py += (by - py) * need / d; res.push([px, py]); d -= need; need = DIG.segment; }
      need -= d; px = bx; py = by;
    }
    if (res.length === 1 && DIG.segment - need >= DIG.segment / 2) res.push([px, py]);   // a short drag still makes one segment
    const line = G.lineNext++, out = [], T = LINES[type];
    for (let i = 1; i < res.length; i++) {
      const [x0, y0] = res[i - 1], [x1, y1] = res[i], x = (x0 + x1) / 2, y = (y0 + y1) / 2;
      const okAt = q => Terrain.passableAt(q[0], q[1], INF) || (T.overWater && Terrain.typeAt(q[0], q[1]) === Terrain.T_WATER);
      if (![[x0, y0], [x, y], [x1, y1]].every(okAt)) continue;
      if (T.overWater && ![[x0, y0], [x, y], [x1, y1]].some(q => Terrain.typeAt(q[0], q[1]) === Terrain.T_WATER && !Terrain.roadAt(q[0], q[1]))) continue;   // a bridge must cross water
      if (segNear(x, y, false, line)) continue;
      const sg = { id: G.segNext++, line, type, owner, x0, y0, x1, y1, x, y, progress: 0, paid: false, done: false, hp: 0, maxHp: T.hp || 0, dead: false, seen: owner === 1 };
      sg.cells = segCells(sg, [-LINE_HALF, 0, LINE_HALF], LINE_HALF); sg.route = segCells(sg, [0], 0);
      for (const k of sg.cells) { let a = G.segGrid.get(k); if (!a) G.segGrid.set(k, a = []); a.push(sg); }
      G.segs.push(sg); G.segById.set(sg.id, sg); out.push(sg);
    }
    return out;
  }
  // Barricades and wire make routes through them dearer, so units path around when they can.
  function applyRoute(sg, on) {
    const T = LINES[sg.type];
    // DD B: barricades block vehicles. Neighbouring segments share end cells, so removing one keeps a
    // cell blocked while another standing barricade still covers it.
    if (sg.type === 'barricade') for (const k of sg.route) Terrain.setBlockVeh(k, on || (G.segGrid.get(k) || []).some(o => o !== sg && o.done && !o.dead && o.type === 'barricade' && o.route.includes(k)));
    if (T.slowOwn >= 1) return false;
    for (const k of sg.route) {
      let m = 1;
      if (on) m = 1 / T.slowOwn; else for (const o of G.segGrid.get(k) || []) if (o !== sg && o.done && !o.dead && o.route.includes(k)) m = Math.max(m, 1 / LINES[o.type].slowOwn);
      Terrain.setPathMult(k, m);
    }
    return true;
  }
  function removeSeg(sg) {
    if (sg.dead) return; sg.dead = true;
    for (const k of sg.cells) { const a = G.segGrid.get(k); if (a) { const i = a.indexOf(sg); if (i >= 0) a.splice(i, 1); if (!a.length) G.segGrid.delete(k); } }
    G.segs = G.segs.filter(o => o !== sg); G.segById.delete(sg.id);
    if (sg.done && applyRoute(sg, false)) Path.invalidate();
    if (sg.road) {   // a blown bridge or road: soldiers left standing on water climb out to the nearest bank
      Terrain.removeRoad(sg.road); sg.road = null; Path.invalidate();
      for (const u of G.units) if (!u.dead && !u.inside && segDist(sg, u.x, u.y) < 20 && !Terrain.passableAt(u.x, u.y, u.cls)) { const q = Path.nearestPassable(Terrain.cellI(u.x), Terrain.cellJ(u.y), u.cls); if (q) { u.x = Terrain.cx(q[0]); u.y = Terrain.cy(q[1]); } }
    }
  }
  // DD: paths are recalculated once per finished line, not per segment.
  function lineCheck(line, type, owner) {
    if (G.segs.some(o => o.line === line && !o.done)) return;
    if (LINES[type].slowOwn < 1 || LINES[type].becomesRoad) Path.invalidate();
    if (owner === 1 && G.segs.some(o => o.line === line)) toast(LINES[type].name + ' finished');
  }
  function finishSeg(sg) {
    sg.done = true; sg.progress = 1; sg.hp = sg.maxHp; applyRoute(sg, true);
    const T = LINES[sg.type];
    if (T.becomesRoad) { sg.road = Terrain.addRoad([[sg.x0, sg.y0], [sg.x1, sg.y1]]); if (T.overWater) Path.invalidate(); }   // each bridge span opens the way to the next
    lineCheck(sg.line, sg.type, sg.owner);
  }
  function damageSeg(sg, dmg) {
    if (!sg.done || !sg.maxHp || sg.dead || dmg <= 0) return;
    sg.hp -= dmg;
    if (sg.hp <= 0) { removeSeg(sg); G.effects.push({ kind: 'shock', x: sg.x, y: sg.y, t: 0, dur: 0.5, r: 12 }); }
  }
  // One digger working on one segment. Kaan, for 0.4: the segment is paid when digging on it starts.
  function digSeg(u, sg, fill, dt) {
    const p = G.players[u.owner], T = LINES[sg.type];
    if (!fill && !sg.paid) {
      if (!canAfford(p, T.cost)) { if (u.owner === 1 && G.time - (p.digToastT || -99) > 8) { p.digToastT = G.time; toast('Not enough resources for the next ' + T.name.toLowerCase() + ' segment'); } return; }
      pay(p, T.cost); sg.paid = true;
    }
    // DD B: 15 s per 10 m for a soldier, Workers 1.5x and +10% per rank (DD H1); Entrenching Tools x1.3.
    const rate = (u.def.labour ? DIG.workerMult * Math.pow(VET.perRank.work, u.rank) : 1) * p.digMult / (T.time || DIG.time);
    u.facing = Math.atan2(sg.y - u.y, sg.x - u.x); u.digT = G.time;
    const before = sg.progress; sg.progress = clamp(sg.progress + (fill ? -rate : rate) * dt, 0, 1);
    if (u.def.labour) addXp(u, Math.abs(sg.progress - before) * DIG.xpPerSegment);   // DD H1: 1 XP per 10 m dug
    if (!fill && sg.progress >= 1) finishSeg(sg);
    else if (fill && sg.progress <= 0) { removeSeg(sg); lineCheck(sg.line, sg.type, -1); }
  }
  // A line nobody is digging any more drops its untouched segments, unpaid (Kaan, for 0.4). Started
  // segments stay and can be resumed by right clicking them with soldiers or Workers.
  function updateLines() {
    if (!G.segs.length) return;
    const dug = new Set();
    for (const u of G.units) {
      if (u.dead) continue;
      if (u.order && u.order.type === 'dig' && !u.order.fill) dug.add(u.order.line);
      for (const o of u.queue) if (o.kind === 'dig' && !o.fill) dug.add(o.line);
    }
    const lines = new Map();
    for (const sg of G.segs) if (!sg.done && !sg.paid && !dug.has(sg.line)) { removeSeg(sg); lines.set(sg.line, sg); }
    for (const sg of lines.values()) lineCheck(sg.line, sg.type, -1);
    if (G.tick % 15 === 0) for (const sg of G.segs) if (!sg.seen && Fog.visible(1, sg.x, sg.y)) sg.seen = true;
  }
  // DD J: the selected infantry dig a drawn line; with none selected, idle Workers within 300 m.
  function planDig(pid, type, pts, units, queue) {
    const p = G.players[pid], T = LINES[type]; if (!T || !Array.isArray(pts) || pts.length < 2) return 0;
    if (!hasTech(p, T)) { if (pid === 1) toast('Research ' + Data.RESEARCH[T.requires].name + ' first'); return 0; }
    let diggers = units.filter(u => u.owner === pid && u.def.cls === 'infantry' && !u.inside && (!T.workersOnly || u.def.labour));
    if (!diggers.length) {
      const [mx, my] = pts[Math.floor(pts.length / 2)];
      diggers = G.units.filter(u => !u.dead && u.owner === pid && u.def.labour && !u.inside && u.work == null && !u.order && dist(u.x, u.y, mx, my) <= DIG.idleWorkerRange);
    }
    if (!diggers.length) { if (pid === 1) toast(T.workersOnly ? T.name + 's are built by Workers: select some, or have idle ones within ' + DIG.idleWorkerRange + ' m' : 'Select soldiers to dig, or have idle Workers within ' + DIG.idleWorkerRange + ' m'); return 0; }
    const segs = planLine(pid, type, pts);
    if (!segs.length) { if (pid === 1) toast('Cannot dig there'); return 0; }
    return orderDig(diggers, segs[0].line, false, queue);
  }

  // ---- grenades (DD C, G13, I) ----
  const canThrow = u => !!(u.def.grenade && G.players[u.owner] && G.players[u.owner].done.has('grenades'));
  function throwGrenade(u, tx, ty) {
    if (u.owner !== 0) { const p = G.players[u.owner]; if (!canAfford(p, NADE.ammo)) { if (u.owner === 1 && G.time - (u.noAmmoT || -99) > 15) { u.noAmmoT = G.time; toast('No sulfur for grenades'); } return false; } pay(p, NADE.ammo); }
    u.nadeT = u.stats.nadeCooldown || NADE.cooldown; u.facing = Math.atan2(ty - u.y, tx - u.x);   // Storm Troops: 12 s cooldown for Riflemen trained after it
    // Kaan, 0.4.2: never quite on target, and now and then a throw goes wide.
    const ang = R() * Math.PI * 2, bad = R() < NADE.badChance;
    const off = R() * (NADE.scatter + NADE.scatterPerM * dist(u.x, u.y, tx, ty)) * (1 + u.stress) + (bad ? NADE.badMin + R() * (NADE.badMax - NADE.badMin) : 0);
    G.projectiles.push(new Projectile({ kind: 'shell', grenade: true, x: u.x, y: u.y, tx: tx + Math.cos(ang) * off, ty: ty + Math.sin(ang) * off, dur: NADE.flight, arc: 12, dmg: NADE.dmg, splash: NADE.splash, dtype: NADE.dtype, shooter: u, owner: u.owner }));
    return true;
  }
  // Kaan, 0.4.1: the thrower stands still NADE.windup seconds, then throws at the target's position then.
  // A new order or a panic cancels it; the sulfur is paid only on the throw.
  function startThrow(u, tx, ty, target) {
    if (u.owner !== 0 && !canAfford(G.players[u.owner], NADE.ammo)) { throwGrenade(u, tx, ty); return; }   // throwGrenade shows the no-sulfur message
    u.windup = { t: NADE.windup, x: tx, y: ty, target: target || null };
  }
  function updateWindup(u, dt) {
    const w = u.windup; w.t -= dt; if (w.t > 0) return;
    u.windup = null; const t = w.target && !w.target.dead && !w.target.inside ? w.target : null;
    throwGrenade(u, t ? t.x : w.x, t ? t.y : w.y);
    if (u.order && u.order.type === 'grenade') nextOrder(u);
  }
  // Thrown on its own at the nearest enemy in a trench, or at an occupied enemy Bunker, within reach.
  function autoGrenade(u) {
    let best = null, bd = Infinity;
    for (const e of G.units) {
      if (e.dead || e.inside || e.owner === u.owner) continue; const d = dist(u.x, u.y, e.x, e.y); if (d > NADE.range || d >= bd) continue;
      const ls = lineAt(e.x, e.y); if (ls && ls.type === 'trench') { best = e; bd = d; }
    }
    if (!best) for (const b of G.buildings) {
      if (b.dead || b.owner === u.owner || !b.slots || !b.slots.grenadeReach || !b.garrison.length) continue;
      const d = dist(u.x, u.y, b.x, b.y) - b.size * 0.7; if (d <= NADE.range && d < bd) { best = b; bd = d; }
    }
    if (best) startThrow(u, best.x, best.y, best);
  }

  // ---- healing (DD A, B, I): sources add up, infantry only ----
  // A Medic treats one soldier at a time: its squadmates first, then the nearest wounded.
  function findPatient(m, r) {
    let best = null, bs = Infinity;
    for (const u of G.units) {
      if (u === m || u.dead || u.owner !== m.owner || u.def.cls !== 'infantry' || u.hp >= u.stats.hp) continue;
      const d = dist(u.x, u.y, m.x, m.y); if (d > r) continue;
      const sc = d + (m.squad && u.squad === m.squad ? 0 : 1000); if (sc < bs) { bs = sc; best = u; }
    }
    return best;
  }
  // Smoke clouds fade; Signals keeps where enemies were last seen (drawn as fading markers, 30 s).
  function updateSmokes(dt) {
    if (!G.smokes.length) return;
    for (const c of G.smokes) c.t += dt;
    const n = G.smokes.length; G.smokes = G.smokes.filter(c => c.t < c.dur); if (G.smokes.length !== n) G.smokeVer++;
  }
  function updateSignals(dt) {
    G.seenT += dt; if (G.seenT < 0.5) return; G.seenT = 0;
    for (const p of Object.values(G.players)) {
      if (!p.done.has('signals') || p.noSupply || p.id === 0) continue;
      const m = G.lastSeen[p.id] || (G.lastSeen[p.id] = new Map());
      for (const e of G.units) if (!e.dead && !e.inside && e.owner !== p.id && e.owner !== 0 && Fog.visible(p.id, e.x, e.y) && detected(e, p.id)) m.set(e.id, { x: e.x, y: e.y, t: G.time, shape: e.def.shape, owner: e.owner, size: e.size });
      for (const [id, r] of m) { const e = G.unitById.get(id); if (!e || e.dead || G.time - r.t > 30) m.delete(id); }
    }
  }
  // Intelligence (DD F): a warning when an enemy raid leaves its base. Called by the AI.
  function raidLaunched(pid, units) {
    for (const p of Object.values(G.players)) {
      if (p.id === pid || p.id !== 1 || !p.done.has('intelligence') || !units.length) continue;
      let x = 0, y = 0; for (const u of units) { x += u.x; y += u.y; } x /= units.length; y /= units.length;
      toast('Intelligence: an enemy raid of ' + units.length + ' is leaving their base'); G.effects.push({ kind: 'ping', x, y, t: 0, dur: 6 });
    }
  }
  function updateHealing(dt) {
    G.healT += dt; if (G.healT < Data.HEAL.tick) return; const step = G.healT; G.healT = 0;
    for (const b of G.buildings) {
      const h = b.def.heal; if (!h || b.dead || !b.built) continue;
      for (const u of G.units) if (!u.dead && u.owner === b.owner && u.def.cls === 'infantry' && u.hp < u.stats.hp && dist(u.x, u.y, b.x, b.y) <= h.range) u.hp = Math.min(u.stats.hp, u.hp + h.rate * step);
    }
    for (const m of G.units) {
      const h = m.def.heal; if (!h || m.dead || m.inside || m.flee > 0) continue;
      let t = m.patient;
      if (!t || t.dead || t.hp >= t.stats.hp || dist(t.x, t.y, m.x, m.y) > h.range) t = m.patient = findPatient(m, h.range);
      if (!t) continue;
      const tri = t.hp < t.stats.hp * 0.5 ? rule(m.owner, 'triage', 1) : 1;   // Triage: twice as fast under 50%
      const amt = Math.min(t.stats.hp - t.hp, h.rate * tri * Math.pow(VET.perRank.work, m.rank) * step);   // DD H1: +10% per rank
      t.hp += amt; addXp(m, amt / Data.HEAL.medicXpPer);   // DD H1: 1 XP per 20 HP healed
    }
  }

  // ---- supply chains (Kaan, 0.5a.2, 0.5a.3) ----
  // Every gatherer and Depot has a supply link the player picks: one of their Depots, or (unset) the
  // HQ. Carriers walk the fastest route to it. Enemy soldiers on a Depot's line cut it and every Depot
  // linked through it; goods left at a cut Depot count once it is clear again. Lines follow the flow
  // fields, so they are the real fastest walking routes.
  const LOG = Data.LOGISTICS;
  const door = b => [b.x, b.y + b.h / 2 + 12];
  function walkTo(u, o, tx, ty, dt, spd) {
    const key = Terrain.cellIdxAt(tx, ty);
    if (o.tk !== key || !u.field) { o.tk = key; u.field = Path.getField(tx, ty, u.def.cls, G.time); if (!u.field) return; }
    if (followField(u, dt, spd)) moveToward(u, tx, ty, dt, spd);
  }
  // Chasing something that moves: walk straight at it when the way is clear, and otherwise re-plan the
  // route at most every 2 s and only when the target has moved 4+ cells (a full re-plan per
  // cell stalled the game).
  function chase(u, o, tx, ty, dt, spd) {
    if (dist(u.x, u.y, tx, ty) < 150 && Terrain.straightPassable(u.x, u.y, tx, ty, u.cls)) { moveToward(u, tx, ty, dt, spd); return true; }
    const f = u.field;
    if (!f || (G.time - (o.pathT || -9) > 2 && dist(f.tx, f.ty, tx, ty) > Terrain.CELL * 4)) { u.field = Path.getField(tx, ty, u.def.cls, G.time); o.pathT = G.time; if (!u.field) return false; }
    if (followField(u, dt, spd)) moveToward(u, tx, ty, dt, spd);
    return true;
  }
  const dropField = b => { const d = door(b); return Path.getField(d[0], d[1], 'infantry', G.time); };
  function routeOf(f, b) {   // the flow field's path from b's door, a point every three cells
    if (!f) return null; const W = Terrain.W; const d = door(b); let k = Terrain.cellIdxAt(d[0], d[1]); const pts = [[b.x, b.y]];
    for (let n = 0; n < 4000 && k >= 0; n++) { if (n % 3 === 0) pts.push([Terrain.cx(k % W), Terrain.cy((k - k % W) / W)]); k = f.next[k]; }
    pts.push([f.tx, f.ty]); return pts;
  }
  const chainPlayers = () => Object.values(G.players).filter(p => p.id !== 0);
  const isDepot = (b, pid) => b && !b.dead && b.built && b.owner === pid && b.type === 'depot';
  // Where b's link points now: its chosen Depot if that still stands, otherwise the HQ.
  function linkTarget(b, hq) { const t = b.link != null ? G.buildingById.get(b.link) : null; return isDepot(t, b.owner) ? t : hq; }
  // Would linking `from` to Depot `to` make a loop? Follow to's links back towards the HQ.
  function makesLoop(from, to) { for (let t = to, n = 0; t && n < 64; n++) { if (t === from) return true; t = t.link != null ? G.buildingById.get(t.link) : null; } return false; }
  function setLink(b, targetId, pid) {
    if (!b || b.dead || b.owner !== pid || !(b.def.harvest || b.type === 'depot')) return false;
    const t = targetId != null ? G.buildingById.get(targetId) : null;
    if (!t || t.type === 'hq') { b.link = null; G.planT = 1e9; return true; }
    if (!isDepot(t, pid) || t === b || (b.type === 'depot' && makesLoop(b, t))) { if (pid === 1) toast('That link would make a loop'); return false; }
    b.link = t.id; G.planT = 1e9; return true;
  }
  function planLogistics() {
    for (const p of chainPlayers()) {
      const hq = G.buildings.find(b => b.owner === p.id && b.type === 'hq' && !b.dead); if (!hq) continue;
      hq.connected = true;
      for (const b of G.buildings) {
        if (b.owner !== p.id || b.dead || !(b.def.harvest || isDepot(b, p.id))) continue;
        const t = linkTarget(b, hq), f = dropField(t);
        if (b.def.harvest) b.drop = t.id; else b.parent = t.id;
        b.route = routeOf(f, b);
      }
    }
  }
  // Depot depth along its links, so parents are checked before the Depots linked through them.
  function depth(d) { let n = 0; for (let t = d; t && t.link != null && n < 64; n++) t = G.buildingById.get(t.link); return n; }
  function lineThreat(route, pid) {
    if (!route) return false; const r2 = LOG.cutRange;
    for (const e of G.units) {
      if (e.dead || e.inside || e.owner === pid || e.owner === 0 || !e.stats.weapon) continue;   // Kaan, 0.5a.2: enemy soldiers cut lines, not Workers or Trucks
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1], b = route[i], dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((e.x - a[0]) * dx + (e.y - a[1]) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        if (dist(e.x, e.y, a[0] + dx * t, a[1] + dy * t) < r2) return true;
      }
    }
    return false;
  }
  function checkCuts() {
    for (const p of chainPlayers()) {
      const depots = G.buildings.filter(b => isDepot(b, p.id)).sort((a, b) => depth(a) - depth(b) || a.id - b.id);
      for (const d of depots) {
        const par = G.buildingById.get(d.parent), was = d.connected;
        d.connected = !!par && !par.dead && (par.type === 'hq' || par.connected) && !lineThreat(d.route, p.id);
        if (d.connected && !was) { for (const k in d.stock) p.res[k] += d.stock[k]; d.stock = {}; if (p.id === 1) toast('Supply line to the Depot is open again'); }
        else if (!d.connected && was && p.id === 1) toast('A Depot\'s supply line is cut');
      }
    }
  }
  function deliver(d, load) {
    if (!load) return; const p = G.players[d.owner];
    if (d.type === 'hq' || d.connected) p.res[load.k] += load.n; else d.stock[load.k] = (d.stock[load.k] || 0) + load.n;
  }
  function updateLogistics(dt) {
    G.planT += dt; G.cutT += dt;
    if (G.planT >= LOG.replan) { G.planT = 0; planLogistics(); }
    if (G.cutT >= LOG.cutCheck) { G.cutT = 0; checkCuts(); }
  }

  // ---- trucks (DD A, I, J; patch 0.5b) ----
  const FUEL = Data.FUEL;
  const seatCost = u => u.def.shape === 'square' ? 2 : 1;
  function seatsFree(t) { let n = 0; for (const id of t.cargo) { const p = G.unitById.get(id); if (p && !p.dead) n += seatCost(p); } return t.def.seats - n; }
  function embark(u, t) {
    releaseWork(u); u.order = null; u.field = null; u.forced = null; u.target = null; u.micro = null; u.flee = 0;   // the queue stays: it runs after unloading
    u.inside = t.id; u.x = t.x; u.y = t.y; t.cargo.push(u.id);
    G.selection = G.selection.filter(s => s !== u);
  }
  function unloadTruck(t) {
    if (!t.cargo) return 0; let n = 0;
    for (const id of t.cargo) { const u = G.unitById.get(id); if (!u || u.dead) continue; placeOutside(u, t, n++); if (u.queue.length) nextOrder(u); }
    t.cargo = []; return n;
  }
  // Fuel per 100 m driven: 1 on roads, 1.5 off them (DD I). Measured from where the Truck was last tick.
  function burnFuel(u) {
    const d = dist(u.lastX, u.lastY, u.x, u.y); u.lastX = u.x; u.lastY = u.y;
    if (d > 0 && d < 50) u.fuel = Math.max(0, u.fuel - d / 100 * (Terrain.roadAt(u.x, u.y) ? FUEL.road : FUEL.offRoad));
  }
  // Depots refuel vehicles and refill spare fuel within range (1 oil per fuel, DD J); Workshops repair
  // them (5 HP/s, 1 metal per 10 HP, DD J); a Truck shares spare fuel with vehicles running low nearby.
  function updateVehicles(dt) {
    for (const v of G.units) {
      if (v.dead || !v.cargo) continue; const p = G.players[v.owner];
      const near = type => G.buildings.find(b => b.owner === v.owner && b.type === type && b.built && !b.dead && dist(b.x, b.y, v.x, v.y) < (type === 'depot' ? FUEL.depotRange : Data.REPAIR.range) + b.size);
      const dep = FUEL.refuelAt.map(near).find(Boolean);   // Kaan, 0.5b.2: Depots and the HQ refuel
      if (dep) for (const k of ['fuel', 'spare']) {
        const cap = k === 'fuel' ? v.stats.fuel : v.def.spare, need = cap - v[k]; if (need <= 0) continue;
        const amt = Math.min(need, FUEL.refuelRate * dt, (p.res.oil || 0) / FUEL.oilPerFuel); if (amt <= 0) continue;
        v[k] += amt; p.res.oil -= amt * FUEL.oilPerFuel;
      }
      if (v.hp < v.stats.hp && near('workshop')) {
        const amt = Math.min(v.stats.hp - v.hp, Data.REPAIR.rate * dt, (p.res.metal || 0) / Data.REPAIR.metalPerHp);
        if (amt > 0) { v.hp += amt; p.res.metal -= amt * Data.REPAIR.metalPerHp; }
      }
      if (v.spare > 0) for (const w of G.units) {
        if (w === v || w.dead || !w.cargo || w.owner !== v.owner || w.fuel >= w.stats.fuel * FUEL.shareBelow || dist(w.x, w.y, v.x, v.y) > FUEL.shareRange) continue;
        const amt = Math.min(v.spare, FUEL.refuelRate * dt, w.stats.fuel - w.fuel); w.fuel += amt; v.spare -= amt;
      }
    }
  }
  // Retrofit at a Workshop (DD A): the latest blueprint for 40% of the price difference.
  function retrofit(u) {
    if (!u.cargo || u.dead) return false; const p = G.players[u.owner], bp = p.blueprints[u.type];
    if ((bp.level || 0) === u.bpLevel) return false;
    if (!G.buildings.some(b => b.owner === u.owner && b.type === 'workshop' && b.built && !b.dead && dist(b.x, b.y, u.x, u.y) < Data.REPAIR.range + b.size)) { if (u.owner === 1) toast('Retrofits are done at a Workshop: drive the Truck next to one'); return false; }
    const cost = retrofitCost(u); if (!canAfford(p, cost)) { if (u.owner === 1) toast('Not enough resources'); return false; }
    pay(p, cost); const frac = u.hp / u.stats.hp; u.stats = statsFor(u.owner, u.type); u.stats.hp *= Math.pow(VET.perRank.hp, u.rank); u.hp = u.stats.hp * frac;   // keeps its rank bonus u.fuel = Math.min(u.fuel, u.stats.fuel);
    u.price = { ...bp.cost }; u.bpLevel = bp.level || 0; if (u.owner === 1) toast('Truck retrofitted'); return true;
  }
  function retrofitCost(u) { const bp = G.players[u.owner].blueprints[u.type], c = {}; for (const k in bp.cost) c[k] = Math.max(0, Math.round((bp.cost[k] - (u.price[k] || 0)) * Data.TRUCK_TRACKS.retrofitShare)); return c; }
  // Kaan, 0.5b.1: how many members of a squadron with a Truck won't fit and will march on a long move
  // (same seat order as ferry()). 0 when there is no Truck or everyone fits.
  function squadMarchers(s) {
    const ms = membersOf(s), t = ms.find(m => m.cargo); if (!t) return 0;
    let free = t.def.seats, n = 0;
    for (const r of [1, 2, 0, 3]) for (const m of ms) if (m !== t && m.def.cls === 'infantry' && (m.def.role != null ? m.def.role : 1) === r) { if (seatCost(m) <= free) free -= seatCost(m); else n++; }
    return n;
  }
  // Squad auto-carry (DD E, G4): on a long move the squadron's Truck takes as many members as fit, the
  // rest march; the riders unload at the destination and walk to their places in the line.
  function ferry(s, members, x, y, mode, slots) {
    const t = members.find(m => m.cargo && !m.dead && !m.inside);
    if (!t || !['move', 'attackmove'].includes(mode)) return false;
    let cx = 0, cy = 0; for (const m of members) { cx += m.x; cy += m.y; } cx /= members.length; cy /= members.length;
    if (dist(cx, cy, x, y) < Data.FERRY.minDist) return false;
    let free = seatsFree(t); const riders = [];
    for (const r of [1, 2, 0, 3]) for (const m of members) if (m !== t && !m.inside && m.def.cls === 'infantry' && (m.def.role != null ? m.def.role : 1) === r && seatCost(m) <= free) { riders.push(m); free -= seatCost(m); }
    if (!riders.length) return false;
    const slot = u => { const o = slots.get(u); return { kind: mode, x, y, offx: o[0], offy: o[1], arrive: o[2] }; };
    for (const m of members) {
      if (m === t) continue;
      if (riders.includes(m)) { m.queue = []; applyOrder(m, { kind: 'board', truck: t, ferry: true }); m.queue = [slot(m)]; }
      else issue(m, Object.assign(slot(m), { maxSpeed: 0 }), false);
    }
    t.queue = []; applyOrder(t, { kind: 'ferry', riders: riders.map(m => m.id), next: Object.assign(slot(t), { kind: 'move', unload: true }) });
    return true;
  }

  // ---- squadrons (DD E) ----
  // A squadron: { id, members: [unit ids], move: 'slow'|'own', spacing: 'tight'|'loose',
  // contact: 'react'|'keep', target, leader }. One squadron per unit; fewer than two members disbands it.
  const membersOf = s => s.members.map(id => G.unitById.get(id)).filter(u => u && !u.dead);
  function bySquad(list) { const m = new Map(); for (const u of list) { const k = u.squad && G.squads[u.squad] ? u.squad : 0; if (!m.has(k)) m.set(k, []); m.get(k).push(u); } return m; }
  function squadCentre(s, except) { const ms = membersOf(s).filter(m => m !== except); if (!ms.length) return null; let x = 0, y = 0; for (const m of ms) { x += m.x; y += m.y; } return [x / ms.length, y / ms.length]; }
  function disband(n) { const s = G.squads[n]; if (!s) return; for (const u of membersOf(s)) u.squad = 0; delete G.squads[n]; }
  function leaveSquad(u) { const s = G.squads[u.squad]; u.squad = 0; if (!s) return; s.members = s.members.filter(id => id !== u.id); if (membersOf(s).length < SQ.min) disband(s.id); }
  function joinSquad(s, u) { if (u.squad && u.squad !== s.id) leaveSquad(u); u.squad = s.id; if (!s.members.includes(u.id)) s.members.push(u.id); }
  // Ctrl+number: 2-12 units become squadron n, replacing it; they leave any squadron they were in.
  function setSquad(n, units) {
    if (!units.length) return false;
    const list = units.filter(u => u instanceof Unit && !u.dead && u.owner === units[0].owner);
    if (list.length < SQ.min || list.length > SQ.max) return false;
    if (G.squads[n]) disband(n);
    for (const u of list) if (u.squad) leaveSquad(u);
    const s = G.squads[n] = Object.assign({ id: n, members: [], target: null, leader: null }, SQ.defaults);
    for (const u of list) joinSquad(s, u);
    updateSquads(0); return true;
  }
  // Orders to part of a squadron move the whole squadron (DD E).
  function expandSquads(list) {
    const out = new Set(list);
    for (const u of list) if (u.squad && G.squads[u.squad]) for (const m of membersOf(G.squads[u.squad])) if (!m.inside) out.add(m);   // garrisoned members stay put
    return [...out];
  }
  // Formation slots: ranks by role (front 1, second 2, support 0 in the centre behind them, rear 3 at a
  // safe distance), rows facing the direction of travel or the right-drag facing. Returns unit -> [offx, offy, arrive].
  function formation(s, members, x, y, opts) {
    const sp = SQ.spacing[s.spacing] || SQ.spacing.loose;
    let cx = 0, cy = 0; for (const m of members) { cx += m.x; cy += m.y; } cx /= members.length; cy /= members.length;
    const face = opts.facing != null ? opts.facing : Math.atan2(y - cy, x - cx);
    const fx = Math.cos(face), fy = Math.sin(face), rx = -fy, ry = fx;
    const perRow = opts.width ? Math.max(1, Math.floor(opts.width / sp) + 1) : Math.max(3, Math.ceil(Math.sqrt(members.length * 2)));
    const ranks = [1, 2, 0, 3, 4].map(r => members.filter(m => (m.def.role != null ? m.def.role : 1) === r).sort((a, b) => a.id - b.id));
    const slots = new Map(); let depth = 0;
    ranks.forEach((rank, ri) => {
      if (!rank.length) return;
      if (ri === 3) depth = Math.min(depth, 0) - SQ.rearDepth;   // mortars stand well behind the line
      for (let i = 0; i < rank.length; i += perRow) {
        const row = rank.slice(i, i + perRow);
        row.forEach((m, j) => { const lat = (j - (row.length - 1) / 2) * sp; slots.set(m, [rx * lat + fx * depth, ry * lat + fy * depth, Math.max(12, sp * 1.2)]); });
        depth -= sp;
      }
    });
    return slots;
  }
  // Stress decay: faster within reach of a squadmate (cohesion), faster still near the squad leader.
  function stressDecay(u) {
    const s = u.squad ? G.squads[u.squad] : null; if (!s) return C.stressDecay;
    let near = false, lead = false;
    for (const m of membersOf(s)) {
      if (m === u) continue; const d = dist(m.x, m.y, u.x, u.y);
      if (d < rule(u.owner, 'cohesionRadius', SQ.cohesionRadius)) near = true;
      if (m.id === s.leader && d < SQ.leaderRadius) lead = true;
    }
    return (near ? SQ.cohesionDecay : C.stressDecay) * (lead ? SQ.leaderAura : 1);
  }
  // Once a tick: prune the dead, pick the leader (highest rank, then most XP), keep a shared target,
  // and halt the whole squadron on contact when it is set to react.
  function updateSquads() {
    for (const k of Object.keys(G.squads)) {
      const s = G.squads[k]; const ms = membersOf(s);
      s.members = ms.map(m => m.id);
      if (ms.length < SQ.min) { disband(s.id); continue; }
      let best = null; for (const m of ms) if (!best || m.rank > best.rank || (m.rank === best.rank && (m.xp > best.xp || (m.xp === best.xp && m.id < best.id)))) best = m;
      s.leader = best.id;
      if (s.target && (s.target.dead || s.target.inside || !ms.some(m => m.target === s.target))) s.target = null;
      if (!s.target) { const counts = new Map(); for (const m of ms) if (m.target && !m.def.obeysWhenSuppressed) counts.set(m.target, (counts.get(m.target) || 0) + 1); let top = 0; for (const [t, c] of counts) if (c > top) { top = c; s.target = t; } }
      if (s.contact === 'react' && SQ.reactHalts && ms.some(m => m.order && (m.order.type === 'move' || m.order.type === 'attackmove') && !m.order.retreat && m.target && inRange(m, m.target))) {
        for (const m of ms) if (m.order && (m.order.type === 'move' || m.order.type === 'attackmove') && !m.order.retreat && !m.cargo && !m.order.unload) { m.queue = []; applyOrder(m, { kind: 'hold' }); }   // a Truck keeps driving to unload
      }
    }
  }

  // ---- veterancy (DD H1) ----
  function addXp(u, n) {
    if (u.dead || n <= 0) return; u.xp += n;
    while (u.rank < VET.ranks.length && u.xp >= VET.ranks[u.rank]) { u.rank++; u.stats.hp *= VET.perRank.hp; u.hp *= VET.perRank.hp; }
  }
  // Suppressing an enemy earns XP at most once per target every 30 s (DD I).
  function suppressXp(u, e) {
    if (!(u instanceof Unit)) return; u.suppXp = u.suppXp || {};
    if (G.time - (u.suppXp[e.id] != null ? u.suppXp[e.id] : -1e9) < VET.xp.suppressCooldown) return;
    u.suppXp[e.id] = G.time; addXp(u, VET.xp.suppress);
  }

  // ---- movement ----
  function moveToward(u, px, py, dt, speedMult = 1) {
    let dx = px - u.x, dy = py - u.y; const d = Math.hypot(dx, dy); if (d < 0.5) return true;
    dx /= d; dy /= d;
    // try the direct heading first, then slide left/right around obstacles and corners
    for (const a of [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) {
      const c = Math.cos(a), s = Math.sin(a); const ndx = dx * c - dy * s, ndy = dx * s + dy * c;
      const f = Terrain.moveFactor(u.x, u.y, ndx, ndy, u.cls); if (f === 0) continue;
      const step = Math.min(a === 0 ? d : Math.max(4, d * 0.5), u.stats.speed * speedMult * f * dt);
      const nx = u.x + ndx * step, ny = u.y + ndy * step;
      if (nx < 1 || ny < 1 || nx > Terrain.W * Terrain.CELL - 1 || ny > Terrain.H * Terrain.CELL - 1) continue;   // never off the map (a panicking unit could run out of it)
      if (!Terrain.passableAt(nx, ny, u.cls)) continue;
      u.x = nx; u.y = ny; u.moving = true; u.facing = Util.lerpAngle(u.facing, Math.atan2(ndy, ndx), 0.25);
      if (a === 0) u.stuck = Math.max(0, u.stuck - dt);
      return a === 0 && step >= d - 0.01;
    }
    u.stuck += dt; return false;
  }
  function seekCover(u) {
    const ci = Terrain.cellI(u.x), cj = Terrain.cellJ(u.y); const h0 = Terrain.hAt(u.x, u.y);
    let best = null, bestS = 0.3;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      if (!di && !dj) continue; const i = ci + di, j = cj + dj; if (!Terrain.inb(i, j)) continue;
      const k = Terrain.idx(i, j); if (!Terrain.cellPassable(k, u.cls)) continue;
      const x = Terrain.cx(i), y = Terrain.cy(j);
      const s = (Terrain.type[k] === Terrain.T_FOREST ? 1 : 0) + clamp((Terrain.height[k] - h0) / 6, -1, 1) * 0.5 - Math.hypot(di, dj) * 0.12;
      if (s > bestS && Terrain.straightPassable(u.x, u.y, x, y, u.cls)) { bestS = s; best = [x + (R() - 0.5) * 6, y + (R() - 0.5) * 6]; }
    }
    if (best) u.micro = { x: best[0], y: best[1] };
  }
  function followField(u, dt, spd) {
    // re-evaluate the steering point a few times a second, not every tick
    let p;
    if (u.steerP && u.steerField === u.field && u.steerT > 0) { u.steerT -= dt; p = u.steerP; }
    else { p = Path.steer(u.x, u.y, u.field, u.cls, u.stuck > 1 ? 1 : 10); u.steerP = p; u.steerField = u.field; u.steerT = 0.1; }
    if (!p) return true;
    if (dist(u.x, u.y, p[0], p[1]) < 3) u.steerT = 0;
    if (moveToward(u, p[0], p[1], dt, spd) && u.stuck > 0) u.stuck = Math.max(0, u.stuck - 0.5);
    if (u.stuck > 6) { u.stuck = 0; return true; }
    return false;
  }

  function updateUnit(u, dt) {
    // wasMoving: whether the unit moved last tick. Firing happens before this tick's move, so it is
    // what the moving-fire penalty reads (DD Q11).
    u.wasMoving = u.moving; u.moving = false;
    if (u.cargo) burnFuel(u);
    u.muzzle = Math.max(0, u.muzzle - dt); u.recoil = Math.max(0, u.recoil - dt); u.alertT = Math.max(0, u.alertT - dt);
    const retreating = !!(u.order && u.order.retreat);
    u.cooldown -= dt; u.nadeT -= dt; u.stress = Math.max(0, u.stress - stressDecay(u) * (retreating ? C.retreatDecayMult : 1) * dt);   // DD Q9, Q10, E, H1
    if (u.stress > VET.xp.underFireStress) { u.fireT += dt; if (u.fireT >= VET.xp.underFireEvery) { u.fireT -= VET.xp.underFireEvery; addXp(u, 1); } }
    if (u.work != null && u.def.labour && u.order && u.order.type === 'haul') { u.workT += dt; if (u.workT >= VET.xp.workEvery) { u.workT -= VET.xp.workEvery; addXp(u, 1); } }   // DD H1: work XP is for Workers
    if (u.hp < u.stats.hp * 0.5 && !u.inside && !u.cargo) {   // wounded units leave blood behind (visual only)
      u.bleedT -= dt;
      if (u.bleedT <= 0) { u.bleedT = 0.6 + V() * 1.4; addDecal({ kind: 'blood', x: u.x + (V() - 0.5) * 6, y: u.y + (V() - 0.5) * 6, r: 1.1 + V() * 1.2, life: 25 }); }
    }
    u.acquireT -= dt; if (u.acquireT <= 0) { u.acquireT = 0.3 + R() * 0.1; acquire(u); }
    if (u.inside) {   // garrisoned: pinned to the tower, only fires; a Truck's passengers can't fire (DD A)
      const b = G.buildingById.get(u.inside) || G.unitById.get(u.inside);
      if (!b || b.dead) { u.inside = null; u.hBonus = 0; return; }
      if (b instanceof Unit) { u.x = b.x; u.y = b.y; return; }
      u.x = b.x; u.y = b.y; u.stress = Math.max(0, u.stress - 0.1 * dt);
      tryFire(u); return;
    }
    if (u.flee > 0) {
      u.flee -= dt;
      if (u.flee <= 0) u.stress = Math.min(u.stress, 0.55);
      else {
        // Away from the shooter; a squad member also runs towards the squad's centre (DD E).
        const a = u.lastHitBy; let dx = u.x - (a ? a.x : u.x + 1), dy = u.y - (a ? a.y : u.y); const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const sq = u.squad ? G.squads[u.squad] : null, c = sq && squadCentre(sq, u);
        if (c) { const cx = c[0] - u.x, cy = c[1] - u.y, cl = Math.hypot(cx, cy); if (cl > 20) { dx += cx / cl; dy += cy / cl; } }
        moveToward(u, u.x + dx * 40, u.y + dy * 40, dt, 1.1); return;
      }
    } else if (u.stress >= C.panicAt && !u.def.neverPanics) { u.flee = 2.5 + R(); u.target = null; u.windup = null; return; }   // DD Q12: snipers never panic
    if (u.windup) { updateWindup(u, dt); return; }   // winding up a throw: no moving, no firing
    tryFire(u);
    // Kaan, 0.5c: a mortar with an enemy inside its minimum range steps back to where it can fire
    // (unless it is holding or bombarding a point).
    if (isIndirect(u) && !(u.order && (u.order.type === 'hold' || u.order.type === 'bombard'))) {
      let near = null, nd = u.stats.weapon.minRange;
      for (const e of G.units) { if (e.dead || e.inside || e.owner === u.owner || e.owner === 0 && u.owner !== 0) continue; const d = dist(u.x, u.y, e.x, e.y); if (d < nd && canSee(u, e)) { near = e; nd = d; } }
      if (near) { moveToward(u, u.x + (u.x - near.x), u.y + (u.y - near.y), dt, 1); return; }
    }
    if (u.def.grenade && u.nadeT <= 0 && !u.windup && G.tick % 10 === u.id % 10 && canThrow(u) && !(u.order && u.order.type === 'grenade')) autoGrenade(u);
    // An idle Medic walks over to the nearest wounded soldier it can see (squadmates first).
    if (u.def.heal && !u.order && !u.micro && G.tick % 30 === u.id % 30 && !u.patient) {
      const t = findPatient(u, u.stats.vision);
      if (t && dist(u.x, u.y, t.x, t.y) > u.def.heal.range * 0.75 && Terrain.straightPassable(u.x, u.y, t.x, t.y, u.cls)) u.micro = { x: t.x, y: t.y };
    }
    // DD Q10: no suppression slowdown in retreat. DD E '>': a squad travels at its slowest member's pace.
    // DD B, G12: barricades and wire slow everyone, trenches slow only the enemy.
    const cap = o0 => o0 && o0.maxSpeed && o0.phase === 0 ? Math.min(1, o0.maxSpeed / u.stats.speed) : 1;
    const ls = lineAt(u.x, u.y);
    // DD B: trenches slow enemies and friendly vehicles to x0.4; wire doesn't slow vehicles (barricades block them).
    const lineSlow = !ls ? 1 : u.cargo ? (ls.type === 'trench' ? LINES.trench.slowEnemy : 1) : ls.owner === u.owner ? LINES[ls.type].slowOwn : LINES[ls.type].slowEnemy;
    const spd = Util.stack('speed', u.suppressed && !retreating ? 0.6 : 1, cap(u.order), lineSlow, u.cargo && u.fuel <= 0 ? Data.FUEL.emptySpeed : 1);   // Kaan, 0.5b: an empty tank crawls
    const o = u.order;
    if (o) {
      switch (o.type) {
        case 'move': case 'attackmove': case 'work': case 'garrison': {
          if (o.type === 'attackmove' && u.target && inRange(u, u.target)) break;
          if (o.type === 'garrison') {
            const b = o.building;
            if (!b || b.dead || !b.built) { nextOrder(u); break; }
            if (dist(u.x, u.y, b.x, b.y) < b.size + 26) { if (canEnter(u, b)) enterBuilding(u, b); else nextOrder(u); break; }
          }
          if (o.phase === 0) {
            if (dist(u.x, u.y, o.x, o.y) <= o.arrive) o.phase = 1;
            else if (followField(u, dt, spd)) o.phase = 1;
          }
          if (o.phase === 1) {
            const sx = o.x + o.offx, sy = o.y + o.offy;
            const ok = Terrain.passableAt(sx, sy, u.cls) && Terrain.straightPassable(u.x, u.y, sx, sy, u.cls);
            const arrived = !ok || dist(u.x, u.y, sx, sy) < 2 || moveToward(u, sx, sy, dt, spd);
            if (arrived || u.stuck > 1.5) {
              u.stuck = 0;
              if (o.type === 'work') { u.order = { type: 'haul', stage: 'load', wait: 0, tk: -1 }; u.field = null; }
              else { if (o.unload) unloadTruck(u); const more = u.queue.length > 0; nextOrder(u); if (!more && !u.cargo) seekCover(u); }
            }
          }
          break;
        }
        case 'attack': {
          const t = o.target;
          if (!t || t.dead || t.inside || !keepsOrders(u)) { nextOrder(u); break; }   // a target that garrisons or boards is out of reach
          if (inRange(u, t) && canSee(u, t)) break;
          if (!chase(u, o, t.x, t.y, dt, spd)) nextOrder(u);
          break;
        }
        case 'bombard': {
          const d = dist(u.x, u.y, o.x, o.y); const w = u.stats.weapon;
          if (d <= effRange(u, o.x, o.y) * 0.95 && d >= w.minRange) break;
          if (d < w.minRange) { moveToward(u, u.x + (u.x - o.x), u.y + (u.y - o.y), dt, spd); break; }
          const ci = Terrain.cellI(o.x), cj = Terrain.cellJ(o.y);
          if (!u.field || u.field.ci !== ci || u.field.cj !== cj) u.field = Path.getField(o.x, o.y, u.def.cls, G.time);
          if (!u.field) { nextOrder(u); break; }
          followField(u, dt, spd);
          break;
        }
        case 'hold': if (o.until && G.time >= o.until) nextOrder(u); break;
        case 'haul': {   // Kaan, 0.5a.2: take a load from the building's stock, carry it to the drop-off, walk back
          const b = G.buildingById.get(u.work != null ? u.work : o.from);
          // Kaan, 0.5b.2: if the camp is destroyed, a carrier already holding a load still delivers it.
          if ((!b || b.dead) && !(u.load && o.stage === 'haul')) { releaseWork(u); nextOrder(u); break; }
          if (o.stage === 'load') {
            if (dist(u.x, u.y, b.x, b.y) > b.size + 22) { const d = door(b); walkTo(u, o, d[0], d[1], dt, spd); break; }
            const k = b.def.harvest === 'wood' ? 'wood' : b.depositType, have = (k && b.stock[k]) || 0, cap = u.def.load || (u.def.labour ? LOG.load : LOG.soldierLoad);
            o.wait += dt;
            // Kaan, 0.5b.2: Trucks carry first. While a Truck of this building waits here, Workers leave the stock to it.
            if (!u.def.load && b.workers.some(id => { const t = G.unitById.get(id); return t && !t.dead && t.def.load && t.order && t.order.type === 'haul' && t.order.stage === 'load' && dist(t.x, t.y, b.x, b.y) <= b.size + 30; })) break;
            if (have >= cap || (have >= 1 && o.wait > (u.def.load ? LOG.truckWait : LOG.loadWait))) { const n = Math.min(have, cap); b.stock[k] = have - n; u.load = { k, n }; o.stage = 'haul'; o.tk = -1; o.from = b.id; o.drop = b.drop; }
          } else {
            let d = G.buildingById.get(b && !b.dead ? b.drop : o.drop);
            if (!d || d.dead) d = G.buildings.find(x => x.owner === u.owner && x.type === 'hq' && !x.dead);   // its drop-off is gone: take it home
            if (!d) break;   // nowhere to go yet: wait with the load
            if (dist(u.x, u.y, d.x, d.y) > d.size + 22) { const p0 = door(d); walkTo(u, o, p0[0], p0[1], dt, spd); break; }
            deliver(d, u.load); u.load = null; o.stage = 'load'; o.wait = 0; o.tk = -1;
            if (!b || b.dead) { releaseWork(u); nextOrder(u); }   // the camp is gone: job done
          }
          break;
        }
        case 'dig': {
          let sg = o.seg;
          if (!sg || sg.dead || (o.fill ? !sg.done : sg.done)) {
            sg = null; let bd = Infinity;
            for (const c of G.segs) if (c.line === o.line && (o.fill ? c.done : !c.done)) { const d = dist(u.x, u.y, c.x, c.y); if (d < bd) { bd = d; sg = c; } }
            o.seg = sg; if (!sg) { nextOrder(u); break; }
          }
          if (segDist(sg, u.x, u.y) > 16) {
            if (o.fseg !== sg) { o.fseg = sg; u.field = Path.getField(sg.x, sg.y, u.def.cls, G.time); if (!u.field) { nextOrder(u); break; } }
            if (followField(u, dt, spd)) moveToward(u, sg.x, sg.y, dt, spd);
            break;
          }
          digSeg(u, sg, o.fill, dt);
          break;
        }
        case 'board': {
          const t = o.truck;
          if (!t || t.dead || t.inside) { nextOrder(u); break; }
          if (o.ferry && !(t.order && t.order.type === 'ferry')) { nextOrder(u); break; }   // missed the squadron's Truck: march instead
          if (dist(u.x, u.y, t.x, t.y) > t.size + u.size + 10) { if (!chase(u, o, t.x, t.y, dt, spd)) nextOrder(u); break; }
          if (seatsFree(t) >= seatCost(u)) embark(u, t); else { if (u.owner === 1) toast('The Truck is full'); nextOrder(u); }
          break;
        }
        case 'ferry': {
          const waiting = o.riders.map(id => G.unitById.get(id)).filter(r => r && !r.dead && !r.inside && r.order && r.order.type === 'board' && r.order.truck === u);
          if (!waiting.length || G.time - o.t0 > Data.FERRY.boardWait) applyOrder(u, o.next);
          break;
        }
        case 'demolish': {   // Demolition Charges: walk up, set the charge for 3 s, blow the segment
          const sg = o.seg;
          if (!sg || sg.dead) { nextOrder(u); break; }
          if (segDist(sg, u.x, u.y) > Data.DEMOLITION.reach) {
            if (!u.field || o.fseg !== sg) { o.fseg = sg; u.field = Path.getField(sg.x, sg.y, u.def.cls, G.time); if (!u.field) { nextOrder(u); break; } }
            if (followField(u, dt, spd)) moveToward(u, sg.x, sg.y, dt, spd);
            break;
          }
          u.facing = Math.atan2(sg.y - u.y, sg.x - u.x); u.digT = G.time; o.t += dt;
          if (o.t < Data.DEMOLITION.time) break;
          const p = G.players[u.owner];
          if (!canAfford(p, Data.DEMOLITION.cost)) { if (u.owner === 1) toast('No sulfur for a demolition charge'); nextOrder(u); break; }
          pay(p, Data.DEMOLITION.cost); G.effects.push({ kind: 'explosion', x: sg.x, y: sg.y, r: 14, t: 0, dur: 0.6 }); removeSeg(sg); nextOrder(u);
          break;
        }
        case 'grenade': {   // walk into reach, throw once the cooldown allows, then carry on
          const t = o.target && !o.target.dead ? o.target : null, tx = t ? t.x : o.x, ty = t ? t.y : o.y;
          const reach = NADE.range + (t instanceof Building ? t.size * 0.7 : 0);
          if (dist(u.x, u.y, tx, ty) > reach) { if (!chase(u, o, tx, ty, dt, spd)) nextOrder(u); break; }
          if (u.nadeT <= 0 && !u.windup) startThrow(u, tx, ty, t);
          break;
        }
      }
    } else if (u.micro) {
      if (moveToward(u, u.micro.x, u.micro.y, dt, spd) || u.stuck > 1) { u.micro = null; u.stuck = 0; }
    } else if (u.target && !inRange(u, u.target) && !isIndirect(u)) {
      const t = u.target;
      if (dist(u.x, u.y, t.x, t.y) < u.stats.weapon.range * 1.3 && Terrain.straightPassable(u.x, u.y, t.x, t.y, u.cls)) moveToward(u, t.x, t.y, dt, spd);
    } else if (u.owner === 0 && !u.target && dist(u.x, u.y, u.spawn.x, u.spawn.y) > 90) {
      moveToward(u, u.spawn.x, u.spawn.y, dt, spd);
    }
  }

  function separate() {
    const cs = 24; const grid = new Map();
    for (const u of G.units) { if (u.dead || u.inside) continue; const k = ((u.x / cs) | 0) + ',' + ((u.y / cs) | 0); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(u); }
    for (const u of G.units) {
      if (u.dead || u.inside) continue; const gx = (u.x / cs) | 0, gy = (u.y / cs) | 0;
      for (let j = gy - 1; j <= gy + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) {
        const a = grid.get(i + ',' + j); if (!a) continue;
        for (const v of a) {
          if (v.id <= u.id) continue;
          const minD = u.size + v.size + 2; const dx = v.x - u.x, dy = v.y - u.y; const d2 = dx * dx + dy * dy;
          if (d2 < 1e-4) { v.x += 0.7; continue; }
          if (d2 >= minD * minD) continue;
          const d = Math.sqrt(d2); const push = (minD - d) * 0.25; const nx = dx / d * push, ny = dy / d * push;
          if (Terrain.passableAt(u.x - nx, u.y - ny, u.cls)) { u.x -= nx; u.y -= ny; }
          if (Terrain.passableAt(v.x + nx, v.y + ny, v.cls)) { v.x += nx; v.y += ny; }
        }
      }
    }
  }
  function updateProjectiles(dt) {
    for (const p of G.projectiles) {
      p.t += dt; if (p.t < p.dur) continue;
      p.done = true;
      if (p.kind === 'bullet') { if (p.target && !p.target.dead && !p.target.inside && p.dmg > 0) applyDamage(p.target, p.dmg, p.shooter); }
      else explode(p);
    }
    G.projectiles = G.projectiles.filter(p => !p.done);
  }
  function updateEffects(dt) {
    for (const e of G.effects) e.t += dt; G.effects = G.effects.filter(e => e.t < e.dur);
    for (const t of G.toasts) t.t -= dt; G.toasts = G.toasts.filter(t => t.t > 0);
    for (const d of G.decals) d.t += dt;
    if (G.decals.length && G.decals[0].t > G.decals[0].life) G.decals = G.decals.filter(d => d.t < d.life);
  }
  function checkWin() {
    if (G.over) return;
    const myHq = G.buildings.some(b => b.type === 'hq' && b.owner === 1 && !b.dead);
    const enemyHq = G.buildings.some(b => b.type === 'hq' && b.owner === 2 && !b.dead);
    if (!myHq) { G.over = true; G.winner = 2; } else if (!enemyHq && !G.sandbox) { G.over = true; G.winner = 1; }
  }
  // ---- player commands ----
  // Every player action as a plain record with unit and building ids, logged in G.orders with the
  // tick it was applied before, so a match can be replayed from its seed (Sim.replay). Input and UI
  // call this; the AI orders its units directly, since it is part of the seeded simulation.
  const entById = id => G.unitById.get(id) || G.buildingById.get(id) || null;
  function unloadOne(b, u) {
    if (!b || !u || !b.garrison.includes(u.id)) return false;
    b.garrison = b.garrison.filter(x => x !== u.id); placeOutside(u, b, b.garrison.length); return true;
  }
  function command(c) {
    G.orders.push(Object.assign({ tick: G.tick }, c));
    const picked = (c.units || []).map(entById).filter(u => u instanceof Unit && !u.dead);
    const us = c.kind === 'squadSet' ? picked : expandSquads(picked);
    const pid = c.player || 1, b0 = c.building != null ? entById(c.building) : null, q = !!c.queue;
    const b = b0 && b0.owner === pid ? b0 : null;   // only your own buildings (and Trucks) take commands
    switch (c.kind) {
      case 'move': orderMove(us, c.x, c.y, c.mode || 'move', q, false, { facing: c.facing, width: c.width }); return true;
      case 'squadSet': return setSquad(c.squad, us);
      case 'squadClear': disband(c.squad); return true;
      case 'squadToggle': { const s = G.squads[c.squad]; if (s && ['move', 'spacing', 'contact'].includes(c.key)) s[c.key] = c.value; return !!s; }
      case 'attack': { const t = entById(c.target); if (t && !t.dead) orderAttack(us, t, q); return true; }
      case 'bombard': orderBombard(us, c.x, c.y, q); return true;
      case 'stop': orderStop(us); return true;
      case 'hold': orderHold(us, q); return true;
      case 'retreat': orderRetreat(us, q); return true;
      case 'work': return b ? orderWork(us, b, q) : 0;
      case 'garrison': return b ? orderGarrison(us, b, q) : 0;
      case 'hireFor': {   // Kaan, 0.5b.3: train a Worker at the HQ for this gatherer, sent there when ready
        if (!b || !b.def.harvest || !b.built) return false;
        const hq = G.buildings.find(x => x.owner === pid && x.type === 'hq' && !x.dead && x.built);
        if (!hq || !enqueue(hq, 'worker')) return false;
        hq.queue[hq.queue.length - 1].assign = b.id; return true;
      }
      case 'enqueue': return !!b && b instanceof Building && b.built && !!b.def.produces && b.def.produces.includes(c.type) && enqueue(b, c.type);
      case 'cancel': if (b) cancelQueue(b, c.index); return true;
      case 'research': return startResearch(pid, c.research);
      case 'build': return placeBuilding(c.type, pid, c.x, c.y);
      case 'rally': if (b) b.rally = { x: c.x, y: c.y, squad: c.squad || 0 }; return true;
      case 'upgrade': return !!b && upgradeTower(b);
      case 'link': return setLink(b, c.target, pid);   // Kaan, 0.5a.3: a gatherer's or Depot's supply link (null: the HQ)
      case 'unload': return b ? (b instanceof Unit ? unloadTruck(b) : unloadBuilding(b)) : 0;
      case 'unloadOne': { const u = entById(c.unit); if (!u) return false; if (b instanceof Unit) { if (!b.cargo || !b.cargo.includes(c.unit)) return false; b.cargo = b.cargo.filter(x => x !== c.unit); placeOutside(u, b, b.cargo.length); if (u.queue.length) nextOrder(u); return true; } return unloadOne(b, u); }
      case 'board': { const t = entById(c.target); if (!(t instanceof Unit) || !t.cargo || t.owner !== pid) return 0; let n = 0; for (const u of us) if (u !== t && u.def.cls === 'infantry' && !u.inside) { issue(u, { kind: 'board', truck: t }, q); n++; } return n; }
      case 'retrofit': { let n = 0; for (const u of us) if (retrofit(u)) n++; return n; }
      case 'line': return planDig(pid, c.type, c.points, us, q);
      case 'dig': case 'fill': {   // resume digging a line, or (Workers only) fill a trench, from one of its segments
        const sg = G.segById.get(c.seg); if (!sg || sg.owner !== pid) return 0;
        if (c.kind === 'fill' && sg.type !== 'trench') return 0;
        return orderDig(us, sg.line, c.kind === 'fill', q);
      }
      case 'grenade': { const t = c.target != null ? entById(c.target) : null; return orderGrenade(us, c.x, c.y, t && !t.dead ? t : null, q); }
      case 'smoke': {   // Smoke Shells: mortars fire one smoke round at the point
        if (!G.players[pid].done.has('smoke')) return 0; let n = 0;
        for (const u of us) if (isIndirect(u)) { issue(u, { kind: 'bombard', x: c.x, y: c.y, smoke: true }, q); n++; }
        return n;
      }
      case 'demolish': {
        const sg = G.segById.get(c.seg); if (!sg || !LINES[sg.type].demolish || !G.players[pid].done.has('demolition')) return 0;
        let best = null; for (const u of us) if (u.def.cls === 'infantry' && u.stats.weapon && !u.inside && (!best || dist(u.x, u.y, sg.x, sg.y) < dist(best.x, best.y, sg.x, sg.y))) best = u;
        if (best) issue(best, { kind: 'demolish', seg: sg }, q);   // one sapper, the nearest, is enough
        return best ? 1 : 0;
      }
    }
    return false;
  }

  function update(dt) {
    G.tick++;
    G.time += dt;
    updateResearch(dt); updateBuildings(dt);
    updateSquads(); updateLines(); updateHealing(dt); updateSmokes(dt); updateSignals(dt); updateLogistics(dt); updateVehicles(dt);
    for (const u of G.units) if (!u.dead) updateUnit(u, dt);
    separate();
    updateProjectiles(dt); updateEffects(dt);
    AI.update(dt);
    Fog.update(dt);
    G.cleanupT += dt;
    if (G.cleanupT > 2) { G.cleanupT = 0; G.units = G.units.filter(u => !u.dead || (G.unitById.delete(u.id), false)); G.buildings = G.buildings.filter(b => !b.dead || (G.buildingById.delete(b.id), false)); }
    checkWin();
  }

  return {
    init, update, command, toast, setSpeed, togglePause,
    canAfford, researchState, startResearch, statsFor, prodTime,
    spawnUnit, addBuilding, canPlace, placeBuilding,
    orderMove, orderAttack, orderBombard, orderStop, orderHold, orderWork, orderRetreat, orderGarrison,
    hiresFor, squadMarchers, setLink, researchLock, researchCost, slotOf, owns, seatsFree, retrofitCost, supplyCap, supplyUsed, costOf, maxWorkers, detected, raidLaunched, smokeBlocks,
    canEnter, unloadBuilding, upgradeTower, slotCount, hasTech, canThrow, lineAt, segNear, orderDig, orderGrenade,
    enqueue, cancelQueue, harvestRate, activeWorkers, effRange,
    squadCentre, membersOf, setSquad,
    _dbg: { lineThreat, checkCuts, planLogistics, enter: enterBuilding, planLine, finishSeg, removeSeg, damageSeg, throwGrenade, addXp, validTarget, acquire, inRange, canSee, tryFire, applyDamage, kill, addStress, rangeMult, dmgMult, hitMult, heightDiff },
  };
})();
