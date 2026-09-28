'use strict';
// Core simulation: players, economy, production, research, orders, movement, combat, towers.
// TODO(patch 0.3): vehicles use cls 'vehicle' (Data.MOVE_CLASSES); transport = reuse enterBuilding/unloadBuilding with a unit as the container.
// TODO(patch 0.4): replace the direct harvest credit in updateBuildings with workers carrying loads and trucks hauling to the HQ.
// TODO(multiplayer): swap Math.random (R) for a seeded Util.mulberry32 stream so runs are reproducible.
const G = {
  time: 0, speed: 1, lastSpeed: 1, over: false, winner: 0,
  units: [], buildings: [], projectiles: [], effects: [],
  unitById: new Map(),
  players: {}, selection: [], groups: {}, toasts: [],
  cleanupT: 0,
};

const Game = (() => {
  const { clamp, dist } = Util;
  const R = Math.random;

  function newPlayer(id, res) {
    const r = {}; for (const k of Data.RES) r[k] = res[k] || 0;
    return { id, res: r, blueprints: JSON.parse(JSON.stringify(Data.UNITS)), unlocked: new Set(['musket']), done: new Set(), research: null, harvestMult: 1 };
  }
  function init() {
    G.time = 0; G.speed = 1; G.lastSpeed = 1; G.over = false; G.winner = 0;
    G.units = []; G.buildings = []; G.projectiles = []; G.effects = []; G.selection = []; G.groups = {}; G.toasts = []; G.unitById = new Map();
    G.stats = { 0: { kills: 0, lost: 0 }, 1: { kills: 0, lost: 0 }, 2: { kills: 0, lost: 0 } };
    G.buildingById = new Map(); G.sandbox = false; G.difficulty = G.difficulty || 'hard';
    G.decals = [];   // blood, splats and corpses left on the ground
    G.players = { 0: newPlayer(0, {}), 1: newPlayer(1, { wood: 400, metal: 60 }), 2: newPlayer(2, { wood: 3000, metal: 1500, sulfur: 600 }) };
    for (const id of [0, 2]) for (const t of Object.keys(Data.UNITS)) G.players[id].unlocked.add(t);
  }
  function toast(msg) { G.toasts.push({ msg, t: 3.5 }); if (G.toasts.length > 4) G.toasts.shift(); }
  function addDecal(d) { d.t = 0; G.decals.push(d); if (G.decals.length > 400) G.decals.shift(); }
  // First shots after a quiet spell raise the "!" mark above a unit.
  function alertUnit(e) { if (G.time - e.lastAttackedT > 6) e.alertT = 1.6; e.lastAttackedT = G.time; }
  function setSpeed(s) { if (s === 0 && G.speed !== 0) G.lastSpeed = G.speed; G.speed = s; }
  function togglePause() { setSpeed(G.speed === 0 ? (G.lastSpeed || 1) : 0); }

  // ---- blueprints, costs, research ----
  function statsFor(owner, type) { const bp = G.players[owner].blueprints[type]; return { hp: bp.hp, speed: bp.speed, vision: bp.vision, weapon: { ...bp.weapon } }; }
  function canAfford(p, cost) { for (const k in cost) if ((p.res[k] || 0) < cost[k]) return false; return true; }
  function pay(p, cost, mult = 1) { for (const k in cost) p.res[k] -= cost[k] * mult; }
  function researchState(p, rid) {
    const r = Data.RESEARCH[rid];
    if (p.done.has(rid)) return 'done';
    if (p.research && p.research.id === rid) return 'active';
    if (!r.req.every(q => p.done.has(q))) return 'locked';
    if (p.research) return 'busy';
    if (!canAfford(p, r.cost)) return 'poor';
    return 'ready';
  }
  function startResearch(pid, rid) {
    const p = G.players[pid]; const s = researchState(p, rid);
    if (s !== 'ready') { if (s === 'poor') toast('Not enough resources'); else if (s === 'busy') toast('Research already in progress'); return false; }
    pay(p, Data.RESEARCH[rid].cost); p.research = { id: rid, t: 0, total: Data.RESEARCH[rid].time }; return true;
  }
  function applyResearch(p, rid) {
    const r = Data.RESEARCH[rid]; p.done.add(rid);
    if (r.unlock) p.unlocked.add(r.unlock);
    for (const e of r.effects || []) {
      if (e.harvest) { p.harvestMult *= e.harvest; continue; }
      for (const [t, bp] of Object.entries(p.blueprints)) {
        const match = e.units === 'all' || (e.units === 'firearms' && !bp.weapon.indirect) || (Array.isArray(e.units) && e.units.includes(t));
        if (!match) continue;
        if (e.stat in bp.weapon) bp.weapon[e.stat] *= e.mult; else if (e.stat in bp) bp[e.stat] *= e.mult;
      }
    }
  }

  // ---- spawning ----
  function spawnUnit(type, owner, x, y) { const u = new Unit(type, owner, x, y, statsFor(owner, type)); G.units.push(u); G.unitById.set(u.id, u); return u; }
  function addBuilding(type, owner, x, y, built) {
    const b = new Building(type, owner, x, y, built);
    if (b.def.harvest === 'deposit') { const d = Terrain.depositNear(x, y, 60); b.depositType = d ? d.type : null; }
    G.buildings.push(b); G.buildingById.set(b.id, b); Terrain.setBlocked(x, y, b.w, b.h, true); Path.invalidate();
    return b;
  }

  // ---- scout towers: garrison, unload, upgrade ----
  const isHeavy = u => u.def.shape === 'square';
  function canEnter(u, b) {
    const lv = b.levelDef; if (!lv || b.dead || !b.built || b.owner !== u.owner || u.def.cls !== 'infantry') return false;
    let inf = 0, hv = 0; for (const id of b.garrison) { const g = G.unitById.get(id); if (g && !g.dead) { if (isHeavy(g)) hv++; else inf++; } }
    return isHeavy(u) ? hv < lv.heavy : inf < lv.cap;
  }
  function enterBuilding(u, b) {
    releaseWork(u); u.queue = []; u.order = null; u.field = null; u.forced = null; u.target = null; u.micro = null; u.flee = 0;
    u.inside = b.id; u.hBonus = b.levelDef.height; u.x = b.x; u.y = b.y; u.stress = Math.min(u.stress, 0.3);
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
      if (!d || !['metal', 'sulfur'].includes(d.type)) return false;
      for (const b of G.buildings) if (!b.dead && b.def.needs === 'deposit' && Terrain.depositNear(b.x, b.y, 50) === d) return false;
    } else if (Terrain.depositNear(x, y, 40)) return false;
    if (owner === 1 && !Fog.visible(1, x, y)) return false;
    return true;
  }
  function placeBuilding(type, owner, x, y) {
    const p = G.players[owner], def = Data.BUILDINGS[type];
    if (!canPlace(type, owner, x, y)) { toast('Cannot build there'); return null; }
    if (!canAfford(p, def.cost)) { toast('Not enough resources'); return null; }
    pay(p, def.cost); return addBuilding(type, owner, x, y, false);
  }

  // ---- orders ----
  function releaseWork(u) {
    if (u.work == null) return;
    const b = G.buildings.find(b => b.id === u.work); if (b) b.workers = b.workers.filter(id => id !== u.id);
    u.work = null;
  }
  // Orders are descriptors {kind, ...}. With queue=true they wait behind the unit's current order (Shift).
  function issue(u, o, queue) {
    if (u.dead) return;
    const standing = u.order && (u.order.type === 'hold' || u.order.type === 'bombard');   // orders that never finish on their own
    if (queue && !standing && (u.order || u.queue.length)) { u.queue.push(o); return; }
    u.queue = []; applyOrder(u, o);
  }
  function applyOrder(u, o) {
    releaseWork(u); u.forced = null; u.micro = null; u.stuck = 0; u.field = null; u.order = null;
    switch (o.kind) {
      case 'move': case 'attackmove': {
        const f = Path.getField(o.x, o.y, u.def.cls, G.time); if (!f) break;
        u.order = { type: o.kind, x: f.tx, y: f.ty, offx: o.offx || 0, offy: o.offy || 0, arrive: o.arrive || 12, phase: 0 }; u.field = f;
        break;
      }
      case 'attack': {
        const t = o.target; if (!t || t.dead) break;
        if (u.suppressed) { applyOrder(u, { kind: 'attackmove', x: t.x, y: t.y, arrive: 20 }); break; }
        u.forced = t; u.target = t; u.order = { type: 'attack', target: t }; u.acquireT = 0;
        break;
      }
      case 'bombard':
        if (u.stats.weapon.indirect) u.order = { type: 'bombard', x: o.x, y: o.y };
        else applyOrder(u, { kind: 'attackmove', x: o.x, y: o.y, arrive: 20 });
        break;
      case 'hold': u.order = { type: 'hold', x: u.x, y: u.y }; break;
      case 'garrison': {
        const b = o.building;
        if (!canEnter(u, b)) { if (u.owner === 1 && b && !b.dead) toast(b.def.name + ' cannot take this unit'); break; }
        const f = Path.getField(b.x, b.y + b.h / 2 + 12, u.def.cls, G.time); if (!f) break;
        u.order = { type: 'garrison', building: b, x: f.tx, y: f.ty, offx: 0, offy: 0, arrive: 10, phase: 0 }; u.field = f;
        break;
      }
      case 'work': {
        const b = o.building;
        if (!b || b.dead || !b.built || u.def.cls !== 'infantry' || b.workers.length >= b.def.maxWorkers) { if (u.owner === 1 && b && !b.dead) toast(b.def.name + ' is full'); break; }
        b.workers.push(u.id); u.work = b.id;
        const slot = b.workers.length - 1; const ang = slot / b.def.maxWorkers * Math.PI * 2 + 0.6;
        const px = b.x + Math.cos(ang) * (b.w / 2 + 12), py = b.y + Math.sin(ang) * (b.h / 2 + 12);
        const f = Path.getField(px, py, u.def.cls, G.time); if (!f) { releaseWork(u); break; }
        u.order = { type: 'work', x: f.tx, y: f.ty, offx: 0, offy: 0, arrive: 6, phase: 0 }; u.field = f;
        break;
      }
    }
  }
  function nextOrder(u) { u.order = null; u.field = null; u.forced = null; if (u.queue.length) applyOrder(u, u.queue.shift()); }

  function orderMove(units, x, y, mode = 'move', queue = false) {
    const list = units.filter(u => !u.dead); const n = list.length; if (!n) return;
    const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), spacing = 15;
    const arrive = Math.max(12, spacing * Math.sqrt(n) * 0.75);
    list.forEach((u, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      issue(u, { kind: mode, x, y, offx: (c - (cols - 1) / 2) * spacing, offy: (r - (rows - 1) / 2) * spacing, arrive }, queue);
    });
  }
  function orderAttack(units, target, queue = false) {
    if (!queue && units.some(u => !u.dead && u.owner === 1 && u.suppressed)) toast('Suppressed units cannot pick targets');
    for (const u of units) issue(u, { kind: 'attack', target }, queue);
  }
  function orderBombard(units, x, y, queue = false) {
    const direct = units.filter(u => !u.dead && !u.stats.weapon.indirect);
    for (const u of units) if (!u.dead && u.stats.weapon.indirect) issue(u, { kind: 'bombard', x, y }, queue);
    if (direct.length) orderMove(direct, x, y, 'attackmove', queue);
  }
  function orderStop(units) { for (const u of units) { u.queue = []; releaseWork(u); u.order = null; u.field = null; u.forced = null; u.micro = null; } }
  function orderHold(units, queue = false) { for (const u of units) issue(u, { kind: 'hold' }, queue); }
  function orderWork(units, b, queue = false) {
    let n = 0;
    for (const u of units) { if (u.dead || u.def.cls !== 'infantry' || u.work === b.id) continue; issue(u, { kind: 'work', building: b }, queue); n++; }
    return n;
  }
  // Pull back a short distance towards the owner's headquarters, as one group.
  function orderRetreat(units, queue = false) {
    const list = units.filter(u => !u.dead); if (!list.length) return;
    const hq = G.buildings.find(b => b.owner === list[0].owner && b.type === 'hq' && !b.dead);
    if (!hq) { orderStop(list); return; }
    let cx = 0, cy = 0; for (const u of list) { cx += u.x; cy += u.y; } cx /= list.length; cy /= list.length;
    const dx = hq.x - cx, dy = hq.y + hq.h / 2 + 30 - cy; const d = Math.hypot(dx, dy);
    if (d < 1) { orderStop(list); return; }
    const step = Math.min(180, Math.max(0, d - 30));
    orderMove(list, cx + dx / d * step, cy + dy / d * step, 'move', queue);
  }

  // ---- production ----
  function enqueue(b, type) {
    const p = G.players[b.owner]; const bp = p.blueprints[type];
    if (!p.unlocked.has(type) || b.queue.length >= 8) return false;
    if (!canAfford(p, bp.cost)) { if (b.owner === 1) toast('Not enough resources'); return false; }
    pay(p, bp.cost); b.queue.push({ type, t: 0, total: bp.time / b.def.prodMult }); return true;
  }
  function cancelQueue(b, i) { const q = b.queue[i]; if (!q) return; pay(G.players[b.owner], G.players[b.owner].blueprints[q.type].cost, -1); b.queue.splice(i, 1); }
  function spawnFrom(b, type) {
    const cls = Data.MOVE_CLASSES[Data.UNITS[type].cls];
    let x = b.x + (R() - 0.5) * b.w * 0.6, y = b.y + b.h / 2 + 10;
    if (!Terrain.passableAt(x, y, cls)) { const p = Path.nearestPassable(Terrain.cellI(x), Terrain.cellJ(y), cls); if (p) { x = Terrain.cx(p[0]); y = Terrain.cy(p[1]); } }
    const u = spawnUnit(type, b.owner, x, y);
    if (b.rally) orderMove([u], b.rally.x, b.rally.y); else u.micro = { x: x + (R() - 0.5) * 40, y: y + 14 + R() * 24 };
    return u;
  }

  // ---- per-frame systems ----
  function updateResearch(dt) {
    for (const p of Object.values(G.players)) {
      if (!p.research) continue; p.research.t += dt;
      if (p.research.t >= p.research.total) { applyResearch(p, p.research.id); if (p.id === 1) toast('Research complete: ' + Data.RESEARCH[p.research.id].name); p.research = null; }
    }
  }
  function activeWorkers(b) { let n = 0; for (const id of b.workers) { const u = G.unitById.get(id); if (u && !u.dead && dist(u.x, u.y, b.x, b.y) < 70) n++; } return n; }
  function updateBuildings(dt) {
    for (const b of G.buildings) {
      if (b.dead) continue;
      if (!b.built) {
        b.progress = Math.min(1, b.progress + dt / b.def.buildTime); b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.9 * dt / b.def.buildTime);
        if (b.built) { b.hp = b.maxHp; if (b.owner === 1) toast(b.def.name + ' complete'); }
        continue;
      }
      const p = G.players[b.owner];
      if (b.upgrading) {
        b.upgrading.t += dt;
        if (b.upgrading.t >= b.upgrading.total) {
          b.upgrading = null; b.level++; const lv = b.levelDef;
          b.hp += lv.hp - b.maxHp; b.maxHp = lv.hp;
          for (const id of b.garrison) { const u = G.unitById.get(id); if (u) u.hBonus = lv.height; }
          if (b.owner === 1) toast(b.def.name + ' upgraded to level ' + b.level);
        }
      }
      if (b.queue.length) { const q = b.queue[0]; q.t += dt; if (q.t >= q.total) { b.queue.shift(); spawnFrom(b, q.type); } }
      if (b.def.harvest) {
        const rate = (b.def.rate + activeWorkers(b) * b.def.perWorker) * p.harvestMult;
        const key = b.def.harvest === 'wood' ? 'wood' : b.depositType;
        if (key) p.res[key] += rate * dt;
      }
      if (b.owner === 1 || Fog.visible(1, b.x, b.y)) b.seen = true;
    }
  }
  function harvestRate(b) { const p = G.players[b.owner]; return (b.def.rate + activeWorkers(b) * b.def.perWorker) * p.harvestMult; }

  // ---- combat helpers ----
  // u.hBonus is the extra height of a tower the unit stands in; it counts for range, damage and sight.
  function effRange(u, tx, ty) { const dh = Terrain.hAt(u.x, u.y) + u.hBonus - Terrain.hAt(tx, ty); return u.stats.weapon.range * (1 + clamp(dh / 60, -0.15, 0.3)); }
  function dmgMult(u, tx, ty) { const dh = Terrain.hAt(u.x, u.y) + u.hBonus - Terrain.hAt(tx, ty); return 1 + clamp(dh / 100, -0.1, 0.2); }
  function canSee(u, e) {
    if (u.stats.weapon.indirect && u.owner !== 0) return Fog.visible(u.owner, e.x, e.y);
    return Terrain.los(u.x, u.y, e.x, e.y, 2.2 + u.hBonus, e instanceof Building ? 6 : 1.8);
  }
  function inRange(u, e) {
    const d = dist(u.x, u.y, e.x, e.y) - (e instanceof Building ? e.size * 0.7 : 0);
    return d <= effRange(u, e.x, e.y) && d >= u.stats.weapon.minRange;
  }
  function validTarget(u, e) { return e && !e.dead && !e.inside && e.owner !== u.owner && inRange(u, e) && canSee(u, e); }
  function acquire(u) {
    if (u.forced && !u.forced.dead && !u.suppressed && validTarget(u, u.forced)) { u.target = u.forced; return; }
    const w = u.stats.weapon; const maxR = w.range * 1.3;
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
    u.target = best;
  }
  function tryFire(u) {
    if (u.cooldown > 0) return;
    const w = u.stats.weapon; let tx, ty, target = null;
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
    u.cooldown = w.reload * (u.suppressed ? 1.4 : 1) * (0.9 + R() * 0.2);
    u.facing = Math.atan2(ty - u.y, tx - u.x); u.muzzle = 0.08; u.recoil = w.indirect ? 0.2 : 0.12;
    if (w.indirect) fireShell(u, tx, ty); else fireBullet(u, target);
  }
  function fireBullet(u, e) {
    const w = u.stats.weapon; const d = dist(u.x, u.y, e.x, e.y); const range = effRange(u, e.x, e.y);
    let p = w.acc * (1 - 0.55 * Math.pow(Math.min(1, d / range), 2)) * Terrain.coverAt(e.x, e.y) * (1 - 0.5 * u.stress) * (u.moving ? 0.6 : 1);
    if (e instanceof Building) p = Math.min(1, p * 2.5);
    const hit = R() < p;
    const dmg = hit ? w.dmg * Data.ARMOR_MULT[w.dtype][e.armor] * dmgMult(u, e.x, e.y) : 0;
    const ang = R() * Math.PI * 2, off = hit ? 0 : 8 + R() * 18;
    const tx = e.x + Math.cos(ang) * off, ty = e.y + Math.sin(ang) * off;
    G.projectiles.push(new Projectile({ kind: 'bullet', x: u.x, y: u.y, tx, ty, dur: Math.max(0.03, d / w.pspeed), dmg, target: hit ? e : null, shooter: u, owner: u.owner }));
    if (e instanceof Unit) {
      e.stress = Math.min(1, e.stress + w.suppress); e.lastHitBy = u; alertUnit(e);
      for (const o of G.units) if (o !== e && !o.dead && !o.inside && o.owner === e.owner && dist(o.x, o.y, e.x, e.y) < 30) o.stress = Math.min(1, o.stress + w.suppress * 0.2);
    }
  }
  function fireShell(u, tx, ty) {
    const w = u.stats.weapon; const d = dist(u.x, u.y, tx, ty);
    const spotted = u.owner === 0 ? true : Fog.visible(u.owner, tx, ty);
    const scatter = (12 + (1 - w.acc) * 40 + (spotted ? 0 : 70)) * (0.6 + 0.4 * d / w.range) * (1 + u.stress * 0.5);
    const ang = R() * Math.PI * 2, off = R() * scatter;
    const lx = tx + Math.cos(ang) * off, ly = ty + Math.sin(ang) * off;
    G.projectiles.push(new Projectile({ kind: 'shell', x: u.x, y: u.y, tx: lx, ty: ly, dur: 0.9 + d / w.pspeed, arc: 25 + d * 0.12, dmg: w.dmg * dmgMult(u, lx, ly), splash: w.splash, dtype: w.dtype, shooter: u, owner: u.owner }));
  }
  function explode(pr) {
    const { tx: x, ty: y, splash, dmg, dtype, shooter } = pr;
    G.effects.push({ kind: 'explosion', x, y, r: splash, t: 0, dur: 0.6 });
    for (const e of G.units) {
      if (e.dead || e.inside) continue; const d = dist(e.x, e.y, x, y); if (d > splash) continue;
      let m = (0.35 + 0.65 * (1 - d / splash)) * Data.ARMOR_MULT[dtype][e.armor];
      if (Terrain.ridgeCover(x, y, e.x, e.y)) m *= 0.35;
      if (Terrain.coverAt(e.x, e.y) < 1) m *= 0.85;
      e.stress = Math.min(1, e.stress + 0.3 * (1 - d / splash) + 0.1); e.lastHitBy = shooter; alertUnit(e);
      applyDamage(e, dmg * m, shooter);
    }
    for (const b of G.buildings) {
      if (b.dead) continue; const d = Math.max(0, dist(b.x, b.y, x, y) - b.size * 0.7); if (d > splash) continue;
      applyDamage(b, dmg * (0.5 + 0.5 * (1 - d / splash)) * Data.ARMOR_MULT[dtype].building, shooter);
    }
  }
  function applyDamage(e, dmg, by) { if (e.dead || dmg <= 0) return; e.hp -= dmg; if (e.hp <= 0) kill(e, by); }
  function kill(e, by) {
    e.dead = true; e.hp = 0;
    G.selection = G.selection.filter(s => s !== e);
    if (e instanceof Unit) {   // kill and loss counters track units only
      const st = G.stats[e.owner]; if (st) st.lost++;
      if (by && by.owner !== e.owner && G.stats[by.owner]) G.stats[by.owner].kills++;
    }
    if (e instanceof Unit) {
      releaseWork(e);
      for (const o of G.units) if (!o.dead && o.owner === e.owner && dist(o.x, o.y, e.x, e.y) < 45) o.stress = Math.min(1, o.stress + 0.2);
      // blood, a corpse, and a morale shock that alerts nearby friends
      G.effects.push({ kind: 'shock', x: e.x, y: e.y, t: 0, dur: 0.7, r: 45 });
      const blobs = []; for (let i = 0; i < 5; i++) { const a = R() * Math.PI * 2, rr = R() * e.size * 1.6; blobs.push([Math.cos(a) * rr, Math.sin(a) * rr, e.size * (0.5 + R() * 0.7)]); }
      addDecal({ kind: 'splat', x: e.x, y: e.y, blobs, life: 90 });
      if (!e.inside) addDecal({ kind: 'corpse', x: e.x, y: e.y, shape: e.def.shape, size: e.size, color: Data.PLAYER_COLORS[e.owner], facing: e.facing, life: 60 });
      for (const o of G.units) if (!o.dead && !o.inside && o.owner === e.owner && dist(o.x, o.y, e.x, e.y) < 45) o.alertT = Math.max(o.alertT, 1.2);
    } else {
      Terrain.setBlocked(e.x, e.y, e.w, e.h, false); Path.invalidate();
      for (const id of e.workers) { const u = G.unitById.get(id); if (u) u.work = null; }
      e.workers = [];
      // a collapsing tower hurts everyone inside and throws the survivors out
      let n = 0;
      for (const id of e.garrison) { const u = G.unitById.get(id); if (!u || u.dead) continue; placeOutside(u, e, n++); u.stress = Math.min(1, u.stress + 0.6); applyDamage(u, u.stats.hp * 0.5, by); }
      e.garrison = [];
      G.effects.push({ kind: 'explosion', x: e.x, y: e.y, r: e.size * 1.4, t: 0, dur: 1.1 });
      if (e.type === 'hq') toast(e.owner === 1 ? 'Your headquarters has fallen' : 'Enemy headquarters destroyed!');
      else if (e.owner === 1) toast(e.def.name + ' destroyed');
    }
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
    u.moving = false; u.muzzle = Math.max(0, u.muzzle - dt); u.recoil = Math.max(0, u.recoil - dt); u.alertT = Math.max(0, u.alertT - dt);
    u.cooldown -= dt; u.stress = Math.max(0, u.stress - 0.09 * dt);
    if (u.hp < u.stats.hp * 0.5 && !u.inside) {   // wounded units leave blood behind (visual only)
      u.bleedT -= dt;
      if (u.bleedT <= 0) { u.bleedT = 0.6 + R() * 1.4; addDecal({ kind: 'blood', x: u.x + (R() - 0.5) * 6, y: u.y + (R() - 0.5) * 6, r: 1.1 + R() * 1.2, life: 25 }); }
    }
    u.acquireT -= dt; if (u.acquireT <= 0) { u.acquireT = 0.3 + R() * 0.1; acquire(u); }
    if (u.inside) {   // garrisoned: pinned to the tower, only fires
      const b = G.buildingById.get(u.inside);
      if (!b || b.dead) { u.inside = null; u.hBonus = 0; return; }
      u.x = b.x; u.y = b.y; u.stress = Math.max(0, u.stress - 0.1 * dt);
      tryFire(u); return;
    }
    if (u.flee > 0) {
      u.flee -= dt;
      if (u.flee <= 0) u.stress = Math.min(u.stress, 0.55);
      else { const a = u.lastHitBy; const ax = a ? a.x : u.x + 1, ay = a ? a.y : u.y; moveToward(u, u.x + (u.x - ax), u.y + (u.y - ay), dt, 1.1); return; }
    } else if (u.stress >= 0.95 && !u.def.ignoresSuppression) { u.flee = 2.5 + R(); u.target = null; return; }
    tryFire(u);
    const spd = u.suppressed ? 0.6 : 1;
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
              if (o.type === 'work') { u.order = { type: 'hold', x: u.x, y: u.y }; u.field = null; }
              else { const more = u.queue.length > 0; nextOrder(u); if (!more) seekCover(u); }
            }
          }
          break;
        }
        case 'attack': {
          const t = o.target;
          if (!t || t.dead || u.suppressed) { nextOrder(u); break; }
          if (inRange(u, t) && canSee(u, t)) break;
          const ci = Terrain.cellI(t.x), cj = Terrain.cellJ(t.y);
          if (!u.field || u.field.ci !== ci || u.field.cj !== cj) u.field = Path.getField(t.x, t.y, u.def.cls, G.time);
          if (!u.field) { nextOrder(u); break; }
          followField(u, dt, spd);
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
        case 'hold': break;
      }
    } else if (u.micro) {
      if (moveToward(u, u.micro.x, u.micro.y, dt, spd) || u.stuck > 1) { u.micro = null; u.stuck = 0; }
    } else if (u.target && !inRange(u, u.target) && !u.stats.weapon.indirect) {
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
      if (p.kind === 'bullet') { if (p.target && !p.target.dead && p.dmg > 0) applyDamage(p.target, p.dmg, p.shooter); }
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
  function update(dt) {
    G.time += dt;
    updateResearch(dt); updateBuildings(dt);
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
    init, update, toast, setSpeed, togglePause,
    canAfford, researchState, startResearch, statsFor,
    spawnUnit, addBuilding, canPlace, placeBuilding,
    orderMove, orderAttack, orderBombard, orderStop, orderHold, orderWork, orderRetreat, orderGarrison,
    canEnter, unloadBuilding, upgradeTower,
    enqueue, cancelQueue, harvestRate, activeWorkers, effRange,
    _dbg: { validTarget, acquire, inRange, canSee, tryFire, applyDamage, kill },
  };
})();
