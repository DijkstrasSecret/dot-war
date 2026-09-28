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
  function duel({ typeA, nA, typeB, nB, ground = 'flat', seed = 1, maxTime = 180, keepAliveB = false, squadA = false, squadB = false }) {
    Game.init(seed); G.difficulty = 'normal';
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
    spec.ai.garrison.slice(0, D.garrison).forEach((t, n) => { const u = Game.spawnUnit(t, 1, hq1.x - 110 + (n % 6) * 40, hq1.y + 90 + Math.floor(n / 6) * 30); u.order = { type: 'hold', x: u.x, y: u.y }; });
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

  return { buildArena, duel, duels, fort, forts, economy, aiMatch };
})();
