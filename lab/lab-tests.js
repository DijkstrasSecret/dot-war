'use strict';
// Balance Lab tests (DD H4). Simulation only, no DOM: lab.html shows the results, and the same code
// runs headless from the console or node. Every run is seeded, so a result can be repeated exactly.
const LabTests = (() => {
  const STEP = Sim.STEP;

  // ---- duel arena ----
  // A small test ground, 60 x 40 cells (720 x 480 m). Side A (player 1) stands at x = 200, side B
  // (player 2) at x = 310, in a column along y. 'flat': both at 20 m. 'height': a ramp from x = 250
  // to 300 puts B on a plateau 30 m higher, just past the crest so both sides see each other.
  // 'forest': B stands inside a forest strip (x 290 to 340), close enough to its edge to be seen.
  const AX = 200, BX = 310, MIDY = 240;
  function buildArena(ground) {
    Terrain.create(60, 40);
    const hgt = Terrain.height, type = Terrain.type, W = Terrain.W;
    for (let j = 0; j < Terrain.H; j++) for (let i = 0; i < W; i++) {
      const x = Terrain.cx(i), k = j * W + i;
      hgt[k] = ground === 'height' ? 20 + 30 * Util.clamp((x - 250) / 50, 0, 1) : 20;
      if (ground === 'forest' && x > 290 && x < 340) type[k] = Terrain.T_FOREST;
    }
    Terrain.recomputeDerived();
    Path.init(); Fog.init(); AI.reset([]);
  }
  // One duel: nA units of typeA against nB of typeB until one side is gone or maxTime passes. Both
  // sides attack-move towards the other's start, so they stop and fire once in range and walk back
  // after a panic. Returns the winner (1 = A, 2 = B, 0 = draw), time, survivors and the time from the
  // first shot at B until B's first unit is suppressed. keepAliveB: B cannot die (for the pin test,
  // which measures stress alone; otherwise the MG kills the Rifleman before it is pinned).
  // squadA / squadB: that side fights as one squadron (DD E: cohesion, shared targets, halting on contact).
  // env (0.6): { weather, dark } fixed for the whole fight, e.g. { dark: 1 } for night.
  function duel({ typeA, nA, typeB, nB, ground = 'flat', seed = 1, maxTime = 180, keepAliveB = false, squadA = false, squadB = false, env = null }) {
    Game.init(seed); G.difficulty = 'normal'; G.envOverride = env;   // 0.6: weather and darkness fixed for the fight
    for (const pid of [1, 2]) G.players[pid].res.sulfur = 1000;   // same ammunition both sides (side A once had none, so its mortars never fired)
    buildArena(ground);
    const place = (type, owner, n, x) => {
      const out = [];
      for (let i = 0; i < n; i++) out.push(Game.spawnUnit(type, owner, x, MIDY + (i - (n - 1) / 2) * 14));
      return out;
    };
    const A = place(typeA, 1, nA, AX), B = place(typeB, 2, nB, BX);
    if (squadA && A.length >= 2) Game.setSquad(1, A);
    if (squadB && B.length >= 2) Game.setSquad(2, B);
    Game.orderMove(A, BX, MIDY, 'attackmove'); Game.orderMove(B, AX, MIDY, 'attackmove');
    Fog.update(0, true);
    let firstShotB = null, firstSuppB = null;
    const alive = list => list.filter(u => !u.dead).length;
    let ticks = 0; const maxTicks = Math.round(maxTime / STEP);
    while (ticks < maxTicks && alive(A) && alive(B)) {
      Game.update(STEP); ticks++;
      if (keepAliveB) for (const u of B) u.hp = u.stats.hp;
      if (firstShotB == null && B.some(u => u.stress > 0)) firstShotB = G.time;
      if (firstSuppB == null && B.some(u => !u.dead && u.suppressed)) { firstSuppB = G.time; if (keepAliveB) break; }
    }
    const a = alive(A), b = alive(B);
    return { winner: a && !b ? 1 : b && !a ? 2 : 0, time: G.time, survivorsA: a, survivorsB: b,
      pinTime: firstShotB != null && firstSuppB != null ? firstSuppB - firstShotB : null };
  }
  function duels(opts, runs = 100, seed0 = 1) {
    const res = []; for (let i = 0; i < runs; i++) res.push(duel(Object.assign({}, opts, { seed: seed0 + i })));
    const n = res.length, win = w => res.filter(r => r.winner === w).length;
    const pins = res.map(r => r.pinTime).filter(t => t != null);
    return { runs: n, winA: win(1) / n * 100, winB: win(2) / n * 100, draw: win(0) / n * 100,
      avgTime: res.reduce((s, r) => s + r.time, 0) / n,
      avgSurvivorsA: res.reduce((s, r) => s + r.survivorsA, 0) / n, avgSurvivorsB: res.reduce((s, r) => s + r.survivorsB, 0) / n,
      avgPin: pins.length ? pins.reduce((s, t) => s + t, 0) / pins.length : null, pinnedRuns: pins.length };
  }

  // ---- fortifications (patch 0.4) ----
  // Trench hold: nB Riflemen (side B) hold a 120 m trench, or the same spot in the open, against nA
  // attack-moving Riflemen (with grenades: sent again and again to throw at the nearest defender).
  // Bunker assault: a Bunker with 4 Riflemen and a Machine Gunner against nA Riflemen with grenades,
  // sent again and again to throw at it (as a player would order). The attackers
  // win when the Bunker falls or everyone inside is dead. No agreed targets yet: the lab reports them.
  function fort({ setup = 'trench', nA = 8, nB = 5, seed = 1, maxTime = 240, grenades = setup === 'bunker' }) {
    Game.init(seed); G.difficulty = 'normal';
    buildArena('flat');
    const A = []; for (let i = 0; i < nA; i++) A.push(Game.spawnUnit('rifle', 1, AX - 40, MIDY + (i - (nA - 1) / 2) * 14));
    if (grenades) { G.players[1].done.add('grenades'); G.players[1].res.sulfur = 1000; }
    let B = [], bunker = null;
    if (setup === 'bunker') {
      bunker = Game.addBuilding('bunker', 2, BX + 20, MIDY, true);
      B = ['rifle', 'rifle', 'rifle', 'rifle', 'hmg'].map(t => { const u = Game.spawnUnit(t, 2, bunker.x, bunker.y + 30); Game._dbg.enter(u, bunker); return u; });
    } else {
      if (setup === 'trench') for (const sg of Game._dbg.planLine(2, 'trench', [[BX, MIDY - 60], [BX, MIDY + 60]])) Game._dbg.finishSeg(sg);
      for (let i = 0; i < nB; i++) { const u = Game.spawnUnit('rifle', 2, BX, MIDY + (i - (nB - 1) / 2) * 20); u.order = { type: 'hold', x: u.x, y: u.y }; B.push(u); }
    }
    // Idle attackers are sent again: at the Bunker, or at the nearest defender still standing (one may have fled).
    const order = u => {
      if (bunker) { Game.orderGrenade([u], bunker.x, bunker.y, bunker); return; }
      let t = null; for (const e of B) if (!e.dead && (!t || Util.dist(u.x, u.y, e.x, e.y) < Util.dist(u.x, u.y, t.x, t.y))) t = e;
      if (t && grenades && Game.canThrow(u)) Game.orderGrenade([u], t.x, t.y, t); else if (t) Game.orderMove([u], t.x, t.y, 'attackmove');
    };
    Game.orderMove(A, BX, MIDY, 'attackmove'); if (grenades) for (const u of A) order(u);
    Fog.update(0, true);
    const alive = list => list.filter(u => !u.dead).length;
    const held = () => bunker ? !bunker.dead && alive(B) : alive(B);
    let ticks = 0; const maxTicks = Math.round(maxTime / STEP);
    while (ticks < maxTicks && alive(A) && held()) {
      Game.update(STEP); ticks++;
      if (ticks % 30 === 0) for (const u of A) if (!u.dead && !u.order && u.flee <= 0) order(u);
    }
    const a = alive(A), b = held() ? alive(B) : 0;
    return { winner: a && !b ? 1 : b && !a ? 2 : 0, time: G.time, survivorsA: a, survivorsB: b, sulfur: grenades ? 1000 - G.players[1].res.sulfur : 0 };
  }
  function forts(opts, runs = 50, seed0 = 1) {
    const res = []; for (let i = 0; i < runs; i++) res.push(fort(Object.assign({}, opts, { seed: seed0 + i })));
    const n = res.length, win = w => res.filter(r => r.winner === w).length / n * 100, avg = k => res.reduce((s, r) => s + r[k], 0) / n;
    return { runs: n, winA: win(1), winB: win(2), draw: win(0), avgTime: avg('time'), avgSurvivorsA: avg('survivorsA'), avgSurvivorsB: avg('survivorsB'), avgGrenades: avg('sulfur') };
  }

  // ---- economy timeline ----
  // A standard opening on Highland Pass with no enemy or neutrals on the map: a Lumber Camp at the
  // nearest forest and a Mine on the nearest iron, two Workers each, then the HQ trains Workers until
  // there are eight and each new one joins the camp or mine with a free slot. Records resources every
  // 10 s. "Tier II affordable": metal and wood cover a Heavy Machine Gun, which section F puts in Tier II.
  function spiralSite(type, x0, y0, maxR) {
    for (let r = 60; r < maxR; r += 24) for (let a = 0; a < Math.PI * 2; a += 12 / r) {
      const x = x0 + Math.cos(a) * r, y = y0 + Math.sin(a) * r;
      if (Game.canPlace(type, 1, x, y)) return [x, y];
    }
    return null;
  }
  function economy({ seed = 1, minutes = 15 } = {}) {
    Sim.newMatch({ map: 'highland', difficulty: 'normal', seed });
    for (const u of G.units) if (u.owner !== 1) u.dead = true;
    for (const b of G.buildings) if (b.owner !== 1) b.dead = true;
    G.units = G.units.filter(u => !u.dead); G.buildings = G.buildings.filter(b => !b.dead);
    const p = G.players[1], hq = G.buildings.find(b => b.type === 'hq');
    const log = [], events = [];
    const place = (type, x, y) => { const def = Data.BUILDINGS[type]; if (!Game.canAfford(p, def.cost)) return null; for (const k in def.cost) p.res[k] -= def.cost[k]; return Game.addBuilding(type, 1, x, y, false); };
    const ls = spiralSite('lumber', hq.x, hq.y, 500);
    const metal = Terrain.deposits.filter(d => d.type === 'metal').sort((a, b) => Util.dist(a.x, a.y, hq.x, hq.y) - Util.dist(b.x, b.y, hq.x, hq.y))[0];
    const camp = ls && place('lumber', ls[0], ls[1]); if (camp) events.push({ t: 0, what: 'Lumber Camp placed' });
    const mine = metal && place('mine', metal.x, metal.y); if (mine) events.push({ t: 0, what: 'Mine placed on iron ' + Math.round(Util.dist(metal.x, metal.y, hq.x, hq.y)) + ' m away' });
    const assign = u => { const b = [camp, mine].filter(x => x && x.built && x.workers.length < x.def.maxWorkers).sort((a, c) => a.workers.length - c.workers.length)[0]; if (b) { Game.command({ kind: 'work', units: [u.id], building: b.id }); return true; } return false; };
    const hmg = Data.RESEARCH.hmg.cost; let tier2 = null;
    const ticks = Math.round(minutes * 60 / STEP);
    for (let t = 0; t <= ticks; t++) {
      if (t % 30 === 0) {   // once a game second: keep the opening going
        const workers = G.units.filter(u => u.owner === 1 && u.type === 'worker' && !u.dead);
        for (const u of workers) if (u.work == null && !u.order) assign(u);
        if (workers.length + hq.queue.length < 8 && !hq.queue.length) Game.command({ kind: 'enqueue', building: hq.id, type: 'worker' });
        if (tier2 == null && Game.canAfford(p, hmg)) { tier2 = G.time; events.push({ t: G.time, what: 'Heavy Machine Gun (Tier II) affordable' }); }
      }
      if (t % 300 === 0) log.push({ t: G.time, wood: p.res.wood, metal: p.res.metal, sulfur: p.res.sulfur, workers: G.units.filter(u => u.owner === 1 && u.type === 'worker').length });
      if (t < ticks) Game.update(STEP);
    }
    return { log, events, tier2Min: tier2 == null ? null : tier2 / 60 };
  }

  // ---- AI versus AI ----
  // The scripted commander on both sides of Highland Pass. Player 1 gets the same start package as
  // the AI (resources, a Barracks and an Ordnance Works near its HQ, the difficulty's garrison) in
  // place of the normal start. The map is not symmetric, so the results are also a map check.
  // Runs in slices so a page can show progress; call step() until it returns a result.
  function aiMatch({ seed = 1, difficulty = 'normal', maxMinutes = 90 } = {}) {
    const spec = Sim.survey({ map: 'highland', difficulty, seed });
    for (const u of G.units) if (u.owner === 1) u.dead = true;
    G.units = G.units.filter(u => !u.dead);
    Object.assign(G.players[1].res, G.players[2].res);
    const hq1 = G.buildings.find(b => b.owner === 1 && b.type === 'hq'), hq2 = G.buildings.find(b => b.owner === 2 && b.type === 'hq');
    for (const b of spec.ai.buildings) {
      let x = hq1.x + (b.x - hq2.x), y = hq1.y + (b.y - hq2.y);
      if (!Terrain.areaOk(x, y, Data.BUILDINGS[b.type].w + 4, Data.BUILDINGS[b.type].h + 4, null, 0.3)) { const s = spiralSite(b.type, hq1.x, hq1.y, 400); if (!s) continue; [x, y] = s; }
      Game.addBuilding(b.type, 1, x, y, true);
    }
    const D = Data.DIFFICULTY[difficulty];
    spec.ai.garrison.slice(0, D.garrison).forEach((t, n) => { let x = hq1.x - 110 + (n % 6) * 40, y = hq1.y + 90 + Math.floor(n / 6) * 30; const cls = Data.MOVE_CLASSES[Data.UNITS[t].cls]; if (!Terrain.passableAt(x, y, cls)) { const q = Path.nearestPassable(Terrain.cellI(x), Terrain.cellJ(y), cls); if (q) { x = Terrain.cx(q[0]); y = Terrain.cy(q[1]); } } const u = Game.spawnUnit(t, 1, x, y); u.order = { type: 'hold', x: u.x, y: u.y }; });
    Path.init(); Fog.init(); AI.reset([1, 2]); Fog.update(0, true);
    const maxTicks = Math.round(maxMinutes * 60 / STEP);
    return {
      // Advance up to n ticks; returns null while running, or the result once the match is decided.
      step(n) {
        for (let i = 0; i < n && G.tick < maxTicks; i++) {
          Game.update(STEP);
          const a = G.buildings.some(b => b.owner === 1 && b.type === 'hq' && !b.dead), b = G.buildings.some(b => b.owner === 2 && b.type === 'hq' && !b.dead);
          if (!a || !b) return { winner: a ? 1 : 2, minutes: G.time / 60, kills: [G.stats[1].kills, G.stats[2].kills] };
        }
        return G.tick >= maxTicks ? { winner: 0, minutes: G.time / 60, kills: [G.stats[1].kills, G.stats[2].kills] } : null;
      },
      get progress() { return G.tick / maxTicks; },
    };
  }

  // ---- meta snapshot (patch 0.5b.1) ----
  // A fixed battery of seeded tests that sums up the balance of the current build, so a later patch
  // (weather and night in 0.6, for example) can be compared number by number. Pieces run separately so
  // a page can show progress; metaSnapshot() runs them all.
  const ARMED = ['rifle', 'hmg', 'sniper', 'mortar'];
  // Equal supply per side (6): six of each circle, three Mortar Crews.
  const bySupply = t => Math.round(6 / (Data.UNITS[t].supply || 1));
  function metaDuels(runs = 30) {
    const out = [];
    for (let i = 0; i < ARMED.length; i++) for (let j = i; j < ARMED.length; j++) {
      const a = ARMED[i], b = ARMED[j], r = duels({ typeA: a, nA: bySupply(a), typeB: b, nB: bySupply(b), ground: 'flat', maxTime: 180 }, runs);
      out.push({ a, nA: bySupply(a), b, nB: bySupply(b), winA: r.winA, winB: r.winB, draw: r.draw, time: r.avgTime, survA: r.avgSurvivorsA, survB: r.avgSurvivorsB });
    }
    return out;
  }
  function metaTerrain(runs = 50) {
    const f = (o, label) => Object.assign({ label }, duels(Object.assign({ typeA: 'rifle', nA: 5, typeB: 'rifle', nB: 5 }, o), runs));
    return [f({ ground: 'flat' }, '5 v 5 Riflemen, flat'), f({ ground: 'height' }, 'B 30 m higher'), f({ ground: 'forest' }, 'B in forest'),
      f({ ground: 'flat', nA: 6, nB: 6, squadA: true }, '6 v 6, A as a squadron'), f({ typeA: 'hmg', nA: 1, typeB: 'rifle', nB: 1, maxTime: 60, keepAliveB: true }, 'MG pins a Rifleman')];
  }
  function metaForts(runs = 30) {
    const f = (o, label) => Object.assign({ label }, forts(o, runs));
    return [f({ setup: 'open', nA: 8 }, '8 Riflemen v 5 in the open'), f({ setup: 'trench', nA: 8 }, '8 v 5 in a trench'),
      f({ setup: 'trench', nA: 8, grenades: true }, '8 with grenades v 5 in a trench'), f({ setup: 'bunker', nA: 8 }, '8 grenadiers v full Bunker (5 inside)'),
      f({ setup: 'bunker', nA: 10 }, '10 grenadiers v full Bunker (5 inside)')];
  }
  function metaEconomy() {
    const e = economy({ seed: 1, minutes: 20 }), at = m => e.log.reduce((best, r) => Math.abs(r.t - m * 60) < Math.abs(best.t - m * 60) ? r : best, e.log[0]);
    return { tier2Min: e.tier2Min, at5: at(5), at10: at(10), at15: at(15), at20: at(20) };
  }
  // How hard the enemy commander pushes an idle player: the player's starting army stays home and
  // fights only what comes to it. Logs every minute; stops when the player's HQ falls.
  // Runs in slices like aiMatch: call step(n) until it returns the result.
  function aiPressureRun({ seed = 1, difficulty = 'normal', minutes = 30 } = {}) {
    Sim.newMatch({ map: 'highland', difficulty, seed });
    const hq = G.buildings.find(b => b.owner === 1 && b.type === 'hq'); const log = []; let firstContact = null, t = 0;
    const ticks = Math.round(minutes * 60 / STEP);
    return {
      step(n) {
        for (let i = 0; i < n; i++, t++) {
          if (firstContact == null && G.units.some(u => u.owner === 2 && !u.dead && Util.dist(u.x, u.y, hq.x, hq.y) < 500)) firstContact = G.time / 60;
          if (t % 1800 === 0) log.push({ min: G.time / 60, aiArmy: G.units.filter(u => u.owner === 2 && !u.dead && !u.def.labour).length, playerUnits: G.units.filter(u => u.owner === 1 && !u.dead).length, hqHp: hq.dead ? 0 : Math.round(hq.hp), kills: G.stats[1].kills, lost: G.stats[1].lost });
          if (t >= ticks || G.over) return { seed, difficulty, firstContactMin: firstContact, hqFellMin: G.over && G.winner === 2 ? G.time / 60 : null, raids: AI.sides[2] ? AI.sides[2].raids : 0, log };
          Game.update(STEP);
        }
        return null;
      },
    };
  }
  function aiPressure(opts) { const r = aiPressureRun(opts); let res = null; while (!(res = r.step(3000))); return res; }
  function metaSnapshot({ runs = 30 } = {}) {
    return { build: 'see PATCH_NOTES.md', duels: metaDuels(runs), terrain: metaTerrain(Math.max(runs, 50)), forts: metaForts(runs), economy: metaEconomy(),
      ai: ['easy', 'normal', 'hard'].map(d => aiPressure({ seed: 1, difficulty: d, minutes: 30 })) };
  }

  // ---- living infantry checks (patch 0.7b) ----
  // Small staged situations, one per behaviour; each passes or fails with a measured detail.
  function behaviourChecks(seed = 1) {
    const out = [], D = Util.dist, B = Data.BEHAVIOUR;
    const stage = ground => { Game.init(seed); G.difficulty = 'normal'; G.envOverride = { weather: 'clear', dark: 0 }; buildArena(ground || 'flat'); };
    const run = (s, each) => { for (let i = 0, n = Math.round(s / STEP); i < n; i++) { if (each) each(); Game.update(STEP); } };
    const check = (name, pass, detail) => out.push({ name, pass: !!pass, detail });
    // 1. Wounded fall back behind healthier teammates.
    stage();
    const line = [0, 1, 2, 3].map(i => Game.spawnUnit('rifle', 1, AX, MIDY + (i - 1.5) * 20)), foe = Game.spawnUnit('rifle', 2, AX + 110, MIDY);
    line[1].hp = line[1].stats.hp * 0.3;
    run(8, () => { foe.hp = foe.stats.hp; foe.stress = 0; for (const u of line) if (u !== line[1]) u.hp = u.stats.hp; if (line[1].hp < 5) line[1].hp = 5; });
    const back = D(line[1].x, line[1].y, foe.x, foe.y) - [0, 2, 3].reduce((s, i) => s + D(line[i].x, line[i].y, foe.x, foe.y), 0) / 3;
    check('Wounded fall back behind the healthy ones', back > 12, Math.round(back) + ' m further from the enemy than the others (want > 12)');
    // 2. Wounded walk to a Medic 200 m away and come back healed.
    stage();
    const hurt = Game.spawnUnit('rifle', 1, AX, MIDY - 100), med = Game.spawnUnit('medic', 1, AX + 200, MIDY - 100);
    hurt.hp = hurt.stats.hp * 0.25;
    let reached = 0; run(60, () => { if (D(hurt.x, hurt.y, med.x, med.y) < 45) reached = 1; });
    check('Wounded walk to a Medic within 300 m and return healed', reached && hurt.hp >= hurt.stats.hp * B.medic.healed && D(hurt.x, hurt.y, AX, MIDY - 100) < 40,
      (reached ? 'reached the Medic' : 'never reached the Medic') + ', health ' + Math.round(hurt.hp / hurt.stats.hp * 100) + '%, ' + Math.round(D(hurt.x, hurt.y, AX, MIDY - 100)) + ' m from his post');
    // 3. A clump spreads out to the personal gap.
    stage();
    const clump = []; for (let i = 0; i < 8; i++) clump.push(Game.spawnUnit('rifle', 1, AX + (i % 3) * 3, MIDY + Math.floor(i / 3) * 3));
    run(10);
    let gmin = Infinity; for (const a of clump) for (const b of clump) if (a !== b) gmin = Math.min(gmin, D(a.x, a.y, b.x, b.y));
    check('Soldiers keep a personal gap (12 m outside a squadron)', gmin >= B.gap.alone * 0.85, 'closest pair ' + gmin.toFixed(1) + ' m');
    // 4. After a shell lands nearby they spread wider.
    for (const u of clump) u.spreadT = G.time + B.shellSpread.time;
    run(8);
    gmin = Infinity; for (const a of clump) for (const b of clump) if (a !== b) gmin = Math.min(gmin, D(a.x, a.y, b.x, b.y));
    check('After a nearby shell the gap grows x1.5', gmin >= B.gap.alone * B.shellSpread.mult * 0.85, 'closest pair ' + gmin.toFixed(1) + ' m');
    // 5. Help a buddy: the rear man moves up until the shooter is in his reach.
    stage();
    const front = Game.spawnUnit('rifle', 1, AX, MIDY), rear = Game.spawnUnit('rifle', 1, AX - 50, MIDY), shooter = Game.spawnUnit('rifle', 2, AX + 160, MIDY);
    const d0 = D(rear.x, rear.y, shooter.x, shooter.y);
    run(8, () => { shooter.hp = shooter.stats.hp; front.hp = front.stats.hp; rear.hp = rear.stats.hp; front.stress = 0; rear.stress = 0; });
    const d1 = D(rear.x, rear.y, shooter.x, shooter.y);
    check('A soldier moves up to help a teammate under fire', d1 <= rear.stats.weapon.range, Math.round(d0) + ' m → ' + Math.round(d1) + ' m from the shooter (his range ' + rear.stats.weapon.range + ' m)');
    // 6. Take cover: a soldier under fire next to a forest steps into it.
    stage('forest');
    const exposed = Game.spawnUnit('rifle', 1, 272, MIDY);
    run(5, () => { exposed.hitT = G.time; });
    check('Under fire, a soldier steps into nearby cover', Terrain.typeAt(exposed.x, exposed.y) === Terrain.T_FOREST, 'now at x = ' + Math.round(exposed.x) + ' (forest from x = 290)');
    // 7. Hold the post: drawn away, he walks back once it is quiet.
    stage();
    const guard = Game.spawnUnit('rifle', 1, AX, MIDY); guard.post = { x: AX, y: MIDY }; guard.x = AX + 80; guard.hitT = G.time - 30; guard.away = true;
    run(6);
    check('A soldier drawn away walks back to his post when it is quiet', D(guard.x, guard.y, AX, MIDY) < B.post.away, Math.round(D(guard.x, guard.y, AX, MIDY)) + ' m from his post');
    // 8. A squadron's rows are staggered and the wounded take the rear.
    stage();
    const sq = []; for (let i = 0; i < 6; i++) sq.push(Game.spawnUnit('rifle', 1, AX, MIDY + (i - 2.5) * 20));
    Game.setSquad(1, sq); sq[0].hp = sq[0].stats.hp * 0.3;
    Game.orderMove(sq, AX + 200, MIDY);
    const offs = sq.map(u => u.order ? u.order.offx : 0), rearMost = offs.indexOf(Math.min(...offs));
    check('In a squadron the wounded take the rear rank', offs[0] <= Math.min(...offs.slice(1)), 'wounded offset ' + Math.round(offs[0]) + ' m, others from ' + Math.round(Math.min(...offs.slice(1))) + ' m' + (rearMost === 0 ? '' : ''));
    G.envOverride = null;
    return out;
  }

  // ---- map detail checks (patch 0.7c) ----
  // Buff sites, citadels, civilians, cover props, neutral guards and the Modern kit, each staged small.
  function mapChecks(seed = 1) {
    const out = [], D = Util.dist, S = Data.SITES;
    const stage = () => { Game.init(seed); G.difficulty = 'normal'; G.envOverride = { weather: 'clear', dark: 0 }; buildArena('flat'); };
    const run = (s, each) => { for (let i = 0, n = Math.round(s / STEP); i < n; i++) { if (each) each(); Game.update(STEP); } };
    const check = (name, pass, detail) => out.push({ name, pass: !!pass, detail });
    // 1. Capture: four Riflemen alone at a Radio Mast take it in about 20 s; with an enemy there they can't.
    stage();
    let site = Game.addBuilding('radio', 0, 360, MIDY, true);
    for (let i = 0; i < 4; i++) Game.spawnUnit('rifle', 1, 330, MIDY - 30 + i * 20);
    let t = null; run(30, () => { if (t == null && site.owner === 1) t = G.time; });
    check('Soldiers alone at a buff site capture it in about 20 s', t != null && t >= 18 && t <= 24, t == null ? 'not captured in 30 s' : 'captured after ' + t.toFixed(1) + ' s');
    stage();
    site = Game.addBuilding('radio', 0, 360, MIDY, true);
    for (let i = 0; i < 4; i++) Game.spawnUnit('rifle', 1, 330, MIDY - 30 + i * 20);
    const foe = Game.spawnUnit('rifle', 2, 395, MIDY);
    run(30, () => { foe.hp = foe.stats.hp; foe.stress = 0; });
    check('With an enemy soldier there, nobody captures it', site.owner === 0, 'owner after 30 s: ' + Data.PLAYER_NAMES[site.owner]);
    // 2. Site effects: an Airdrop Zone pays out, a station's train fills its stock, ruins heal.
    stage();
    const air = Game.addBuilding('airdrop', 1, 300, 150, true), st = Game.addBuilding('station', 1, 300, 330, true), p = G.players[1], m0 = p.res.metal;
    run(S.station.every + 1);
    check('An Airdrop Zone drops supplies every 3 minutes', p.res.metal - m0 >= S.airdrop.drop.metal, '+' + Math.round(p.res.metal - m0) + ' metal in ' + (S.station.every + 1) + ' s');
    check('A freight train fills the station\'s stock every 4 minutes', (st.stock.metal || 0) >= S.station.metal, 'stock ' + Math.round(st.stock.metal || 0) + ' metal');
    // 3. Citadel: when empty it belongs to whoever moves in.
    stage();
    const cit = Game.addBuilding('citadel', 0, 360, MIDY, true), r1 = Game.spawnUnit('rifle', 1, 360, MIDY + 60);
    Game.orderGarrison([r1], cit); run(10);
    check('An empty Citadel belongs to whoever moves in', cit.owner === 1 && r1.inside === cit.id, 'owner ' + Data.PLAYER_NAMES[cit.owner] + (r1.inside ? ', the Rifleman is inside' : ', the Rifleman is outside'));
    // 4. Civilians: never shot at, and they run from a firefight.
    stage();
    const civ = Game.spawnUnit('civilian', Data.CIVILIANS.owner, 260, MIDY), shooter = Game.spawnUnit('rifle', 1, 200, MIDY), target = Game.spawnUnit('rifle', 2, 340, MIDY);
    civ.spawn = { x: 260, y: MIDY }; let shotAtCiv = false;
    run(8, () => { target.hp = target.stats.hp; shooter.hp = shooter.stats.hp; if (shooter.target === civ || target.target === civ) shotAtCiv = true; });
    check('Nobody targets civilians', !shotAtCiv && civ.hp === civ.stats.hp, shotAtCiv ? 'a soldier aimed at the civilian' : 'health ' + Math.round(civ.hp) + '/' + civ.stats.hp);
    check('Civilians run from a firefight', D(civ.x, civ.y, 260, MIDY) > 80, 'ran ' + Math.round(D(civ.x, civ.y, 260, MIDY)) + ' m');
    // 5. Cover from props.
    stage();
    Terrain.addProp(2, 300, MIDY, 20, 16, 0); Terrain.addProp(3, 400, MIDY, 40, 2.5, 0);
    check('Ruins and walls give cover', Terrain.coverAt(300, MIDY) === Data.PROPS[2].cover && Terrain.coverAt(400, MIDY) === Data.PROPS[3].cover, 'ruin ×' + Terrain.coverAt(300, MIDY) + ', wall ×' + Terrain.coverAt(400, MIDY));
    // 6. Neutral guards: the leash brings them home.
    stage();
    const g = Game.spawnUnit('rifle', 0, 500, MIDY); g.home = { x: 250, y: MIDY }; g.group = 0;
    run(15);
    check('A neutral guard more than 150 m from home walks back', D(g.x, g.y, 250, MIDY) < 60, Math.round(D(g.x, g.y, 250, MIDY)) + ' m from home');
    // 7. Modern kit at an R&D Lab and 5 Tier III researches.
    stage();
    Game.addBuilding('lab', 1, 150, 150, true);
    const t3 = Object.keys(Data.RESEARCH).filter(id => Data.RESEARCH[id].tier === 3).slice(0, Data.KIT.modernTier3);
    for (const id of t3) Game.applyResearch(G.players[1], id);
    check('Modern kit after an R&D Lab and 5 Tier III researches', G.players[1].kitEra === 'modern', 'kit: ' + G.players[1].kitEra + ' (' + t3.length + ' Tier III)');
    G.envOverride = null;
    return out.concat(siegeChecks(3));
  }
  // ---- siege raid (patch 0.7d, DD Q24) ----
  // On a big map: a tower and two outposts of the player's along the line between the bases, and a
  // tower 3 km off to the side. A raid of 14 should take the tower, then the weakest outpost ahead,
  // then the HQ, and leave the far tower alone.
  function siegeChecks(seed) {
    const out = [], check = (name, pass, detail) => out.push({ name, pass: !!pass, detail });
    Sim.newMatch({ map: 'random', difficulty: 'normal', seed });
    const hq1 = G.buildings.find(b => b.type === 'hq' && b.owner === 1), hq2 = G.buildings.find(b => b.type === 'hq' && b.owner === 2);
    const at = f => [hq2.x + (hq1.x - hq2.x) * f, hq2.y + (hq1.y - hq2.y) * f];
    const place = (type, p) => { for (let r = 0; r < 200; r += 12) for (let a = 0; a < 6.3; a += 0.7) { const x = p[0] + Math.cos(a) * r, y = p[1] + Math.sin(a) * r; if (Game.canPlace(type, 1, x, y)) return Game.addBuilding(type, 1, x, y, true); } return Game.addBuilding(type, 1, Math.round(p[0]), Math.round(p[1]), true); };   // unexplored ground fails canPlace: place it anyway
    const tower = place('tower', at(0.6)), depot = place('depot', at(0.8)), weak = place('barracks', at(0.88));
    const mid = at(0.75), nx = -(hq1.y - hq2.y), ny = hq1.x - hq2.x, nl = Math.hypot(nx, ny), far = place('tower', [mid[0] + nx / nl * 3000, mid[1] + ny / nl * 3000]);
    if (!tower || !depot || !weak || !far) { check('Siege raid: test ground', false, 'could not place the test buildings'); return out; }
    weak.hp = 150;
    const st = AI.st; st.known = new Set([tower.id, depot.id, weak.id, far.id, hq1.id]); st.raidT = 1e9;
    const raiders = []; for (let i = 0; i < 14; i++) { const p = at(0.5); raiders.push(Game.spawnUnit('rifle', 2, p[0] + (i % 5) * 14, p[1] + Math.floor(i / 5) * 14)); }
    for (const u of raiders) { u.raiding = true; u.sieging = true; }
    st.siege = { ids: raiders.map(u => u.id), target: null, stage: 'tower' };
    for (const u of G.units) if (u.owner === 1 && u.stats.weapon) u.dead = true;   // the player's soldiers stay out of it
    const order = [];
    for (let s = 0; s < 30 * 900 && !hq1.dead && AI.st.siege; s++) { Game.update(STEP); const t = AI.st.siege && G.buildingById.get(AI.st.siege.target); const tag = t ? t.type : null; if (tag && order[order.length - 1] !== tag) order.push(tag); }
    const want = ['tower', 'barracks', 'hq'];
    check('Siege raid: the tower first, then the weakest outpost ahead, then the HQ', want.every((w, i) => order[i] === w), 'targets: ' + order.join(' → '));
    check('Siege raid: an outpost off the line between the bases is ignored', !far.dead && far.hp === far.maxHp, 'the far tower is ' + (far.dead ? 'destroyed' : 'untouched'));
    return out;
  }

  return { buildArena, duel, duels, fort, forts, economy, aiMatch, metaDuels, metaTerrain, metaForts, metaEconomy, aiPressure, aiPressureRun, metaSnapshot, behaviourChecks, mapChecks, siegeChecks };
})();
