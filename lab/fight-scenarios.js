'use strict';
// Fight scenarios (Fight Theatre): a catalogue of set-piece battles on a small test ground, run with
// the real game rules. Simulation only, no DOM, so the same scenario runs headless for statistics
// (node or the console) and drawn in theatre.html for watching and recording. Every run is seeded:
// the same scenario and seed give the same fight, tick for tick.
//
// A scenario: side A (blue, player 1) starts on the left, side B (red, player 2) on the right, `gap`
// metres apart. Units stand in rows by role (Riflemen in front, Machine Gunners and Snipers behind,
// Mortar Crews 70 m back). By default both sides attack-move at each other; `defend` makes side B
// hold its ground (terrain and fortification tests); `idleB` gives B no orders at all.
const FightScenarios = (() => {
  const STEP = Sim.STEP;
  const W = 80, H = 50, MIDY = 300, BX = 600;   // 960 x 600 m; side B's front row stands at x = 600
  const ROW = { rifle: 0, medic: 22, sniper: 18, hmg: 14, mortar: 70, worker: 30 };

  const S = (id, group, title, A, B, o = {}) => Object.assign({ id, group, title, A, B, gap: 220, ground: 'flat', maxTime: 180 }, o);
  const LIST = [
    // Equal supply (6 per side), open ground
    S('s-rif-rif', 'Equal supply, open ground', 'Riflemen mirror', [['rifle', 6]], [['rifle', 6]]),
    S('s-rif-mg', 'Equal supply, open ground', 'Riflemen v Machine Gunners', [['rifle', 6]], [['hmg', 6]]),
    S('s-rif-snp', 'Equal supply, open ground', 'Riflemen v Snipers', [['rifle', 6]], [['sniper', 6]]),
    S('s-rif-mor', 'Equal supply, open ground', 'Riflemen v Mortar Crews', [['rifle', 6]], [['mortar', 3]]),
    S('s-rif-mor-loose', 'Equal supply, open ground', 'Riflemen spread 30 m apart v Mortar Crews', [['rifle', 6]], [['mortar', 3]], { spreadA: 30 }),
    S('s-mg-mg', 'Equal supply, open ground', 'Machine Gunner mirror', [['hmg', 6]], [['hmg', 6]]),
    S('s-mg-snp', 'Equal supply, open ground', 'Machine Gunners v Snipers', [['hmg', 6]], [['sniper', 6]]),
    S('s-mg-mor', 'Equal supply, open ground', 'Machine Gunners v Mortar Crews', [['hmg', 6]], [['mortar', 3]]),
    S('s-snp-snp', 'Equal supply, open ground', 'Sniper mirror', [['sniper', 6]], [['sniper', 6]], { gap: 320 }),
    S('s-snp-mor', 'Equal supply, open ground', 'Snipers v Mortar Crews', [['sniper', 6]], [['mortar', 3]], { gap: 300 }),
    S('s-mor-mor', 'Equal supply, open ground', 'Mortar mirror', [['mortar', 3]], [['mortar', 3]], { gap: 300 }),
    // Equal cost (about 180 resources a side)
    S('c-rif-mg', 'Equal cost', '8 Riflemen v 3 Machine Gunners', [['rifle', 8]], [['hmg', 3]]),
    S('c-rif-snp', 'Equal cost', '8 Riflemen v 5 Snipers', [['rifle', 8]], [['sniper', 5]], { gap: 300 }),
    S('c-rif-mor', 'Equal cost', '8 Riflemen v 3 Mortar Crews', [['rifle', 8]], [['mortar', 3]], { gap: 300 }),
    S('c-mg-snp', 'Equal cost', '3 Machine Gunners v 5 Snipers', [['hmg', 3]], [['sniper', 5]], { gap: 280 }),
    // Combined arms
    S('m-mg-support', 'Combined arms', '1 MG + 4 Riflemen v 6 Riflemen', [['rifle', 4], ['hmg', 1]], [['rifle', 6]]),
    S('m-2mg', 'Combined arms', '2 MG + 4 Riflemen v 7 Riflemen', [['rifle', 4], ['hmg', 2]], [['rifle', 7]]),
    S('m-medic', 'Combined arms', '5 Riflemen + Medic v 6 Riflemen', [['rifle', 5], ['medic', 1]], [['rifle', 6]]),
    S('m-full', 'Combined arms', 'Mixed company v 8 Riflemen (equal supply)', [['rifle', 4], ['hmg', 1], ['sniper', 1], ['mortar', 1]], [['rifle', 8]], { gap: 280 }),
    S('m-squad', 'Combined arms', '6 v 6 Riflemen, blue as a squadron', [['rifle', 6]], [['rifle', 6]], { squadA: true }),
    S('m-mirror-squad', 'Combined arms', 'Mixed company mirror, blue as a squadron', [['rifle', 4], ['hmg', 1], ['sniper', 1], ['mortar', 1]], [['rifle', 4], ['hmg', 1], ['sniper', 1], ['mortar', 1]], { gap: 280, squadA: true }),
    // Terrain: red holds its ground
    S('t-flat-hold', 'Terrain (red holds)', '5 v 5 Riflemen, red holding on flat ground', [['rifle', 5]], [['rifle', 5]], { defend: true }),
    S('t-hill', 'Terrain (red holds)', '5 v 5 Riflemen, red on a hill 30 m higher', [['rifle', 5]], [['rifle', 5]], { defend: true, ground: 'height' }),
    S('t-forest-edge', 'Terrain (red holds)', '5 v 5 Riflemen, red at a forest edge', [['rifle', 5]], [['rifle', 5]], { defend: true, ground: 'forestEdge' }),
    S('t-forest-deep', 'Terrain (red holds)', '5 v 5 Riflemen, red deep inside a forest', [['rifle', 5]], [['rifle', 5]], { defend: true, ground: 'forestDeep' }),
    S('t-forest-7v5', 'Terrain (red holds)', '7 Riflemen attack 5 at a forest edge', [['rifle', 7]], [['rifle', 5]], { defend: true, ground: 'forestEdge' }),
    S('t-hill-mg', 'Terrain (red holds)', '7 Riflemen attack 3 Riflemen + MG on a hill', [['rifle', 7]], [['rifle', 3], ['hmg', 1]], { defend: true, ground: 'height' }),
    // Fortifications
    S('f-open', 'Fortifications', '8 Riflemen attack 5 in the open', [['rifle', 8]], [['rifle', 5]], { defend: true, gap: 180 }),
    S('f-trench', 'Fortifications', '8 Riflemen attack 5 in a trench', [['rifle', 8]], [['rifle', 5]], { defend: true, gap: 180, fort: 'trench' }),
    S('f-trench-nades', 'Fortifications', '8 grenadiers attack 5 in a trench', [['rifle', 8]], [['rifle', 5]], { defend: true, gap: 180, fort: 'trench', grenadesA: true }),
    S('f-trench-mg', 'Fortifications', '8 grenadiers attack 4 Riflemen + MG in a trench', [['rifle', 8]], [['rifle', 4], ['hmg', 1]], { defend: true, gap: 180, fort: 'trench', grenadesA: true }),
    S('f-trench-mortar', 'Fortifications', '6 Riflemen + 2 Mortars attack 5 in a trench', [['rifle', 6], ['mortar', 2]], [['rifle', 5]], { defend: true, gap: 260, fort: 'trench' }),
    S('f-bunker8', 'Fortifications', '8 grenadiers assault a full Bunker', [['rifle', 8]], [['rifle', 4], ['hmg', 1]], { defend: true, gap: 180, fort: 'bunker', grenadesA: true }),
    S('f-bunker10', 'Fortifications', '10 grenadiers assault a full Bunker', [['rifle', 10]], [['rifle', 4], ['hmg', 1]], { defend: true, gap: 180, fort: 'bunker', grenadesA: true }),
    // Special situations
    S('x-sniper-idle', 'Special situations', '2 Snipers pick at 6 idle Riflemen (return fire)', [['sniper', 2]], [['rifle', 6]], { gap: 280, idleB: true, holdA: true }),
    S('x-sniper-hold', 'Special situations', '2 Snipers against 6 Riflemen on Defend', [['sniper', 2]], [['rifle', 6]], { gap: 280, defend: true, holdA: true, maxTime: 120 }),
    // Night and weather (patch 0.6): the same fights with darkness or weather fixed for the whole fight.
    S('n-rif-rif', 'Night and weather', 'Riflemen mirror at night', [['rifle', 6]], [['rifle', 6]], { env: { dark: 1 } }),
    S('n-rif-snp', 'Night and weather', 'Riflemen v Snipers at night', [['rifle', 6]], [['sniper', 6]], { env: { dark: 1 } }),
    S('n-rif-mor', 'Night and weather', 'Riflemen v Mortar Crews at night', [['rifle', 6]], [['mortar', 3]], { env: { dark: 1 } }),
    S('n-mg-support', 'Night and weather', '1 MG + 4 Riflemen v 6 Riflemen at night', [['rifle', 4], ['hmg', 1]], [['rifle', 6]], { env: { dark: 1 } }),
    S('n-hill', 'Night and weather', '5 v 5 Riflemen, red on a hill, at night', [['rifle', 5]], [['rifle', 5]], { defend: true, ground: 'height', env: { dark: 1 } }),
    S('fog-rif-mor', 'Night and weather', 'Riflemen v Mortar Crews in fog', [['rifle', 6]], [['mortar', 3]], { env: { weather: 'fog' } }),
    S('fog-hill', 'Night and weather', '5 v 5 Riflemen, red on a hill, in fog', [['rifle', 5]], [['rifle', 5]], { defend: true, ground: 'height', env: { weather: 'fog' } }),
    S('rain-rif-rif', 'Night and weather', 'Riflemen mirror in rain', [['rifle', 6]], [['rifle', 6]], { env: { weather: 'rain' } }),
    S('rain-rif-mor', 'Night and weather', 'Riflemen v Mortar Crews in rain', [['rifle', 6]], [['mortar', 3]], { env: { weather: 'rain' } }),
    S('snow-flat-hold', 'Night and weather', '5 v 5 Riflemen, red holding, in snow', [['rifle', 5]], [['rifle', 5]], { defend: true, env: { weather: 'snow' } }),
    S('x-mortar-nest', 'Special situations', '3 Mortars + 3 Riflemen against an MG nest', [['rifle', 3], ['mortar', 3]], [['rifle', 2], ['hmg', 2]], { gap: 320, defend: true }),
  ];
  const byId = {}; for (const s of LIST) byId[s.id] = s;

  // The test ground. 'height': a ramp puts red 30 m higher, just past the crest. 'forestEdge': red
  // stands 15 m inside a forest (edge cover). 'forestDeep': 60 m inside (hidden, no cover).
  function buildGround(ground) {
    Terrain.create(W, H);
    const hgt = Terrain.height, type = Terrain.type;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = Terrain.cx(i), k = j * W + i;
      hgt[k] = ground === 'height' ? 20 + 30 * Util.clamp((x - (BX - 70)) / 50, 0, 1) : 20;
      if (ground === 'forestEdge' && x > BX - 15 && x < BX + 140) type[k] = Terrain.T_FOREST;
      if (ground === 'forestDeep' && x > BX - 60 && x < BX + 140) type[k] = Terrain.T_FOREST;
    }
    Terrain.recomputeDerived();
    Path.init(); Fog.init(); AI.reset([]);
  }
  const plural = (t, n) => { const nm = Data.UNITS[t].name; return n + ' ' + (n === 1 ? nm : nm.endsWith('man') ? nm.slice(0, -3) + 'men' : nm + 's'); };
  const label = comp => comp.map(([t, n]) => plural(t, n)).join(' + ');

  // Starts a scenario and returns a run: step(n) advances up to n ticks and returns the result once
  // the fight is decided (or null while it goes on).
  function start(id, seed = 1) {
    const s = byId[id]; if (!s) throw new Error('No scenario ' + id);
    Game.init(seed); G.difficulty = 'normal'; G.sandbox = true; G.envOverride = s.env || null;
    for (const pid of [1, 2]) G.players[pid].res.sulfur = 1000;   // ammunition for mortars and grenades on both sides
    if (s.grenadesA) G.players[1].done.add('grenades');
    buildGround(s.ground);
    const AX = BX - s.gap;
    let bunker = null;
    if (s.fort === 'trench') for (const sg of Game._dbg.planLine(2, 'trench', [[BX, MIDY - 80], [BX, MIDY + 80]])) Game._dbg.finishSeg(sg);
    if (s.fort === 'bunker') bunker = Game.addBuilding('bunker', 2, BX + 20, MIDY, true);
    const place = (comp, owner, x0, dir) => {
      const out = [];
      for (const [t, n] of comp) for (let i = 0; i < n; i++) {
        const spread = s.fort === 'trench' && owner === 2 ? 22 : (owner === 1 ? s.spreadA : s.spreadB) || 14;   // metres between soldiers in a row
        out.push(Game.spawnUnit(t, owner, x0 + dir * (ROW[t] || 0), MIDY + (i - (n - 1) / 2) * spread));
      }
      return out;
    };
    const A = place(s.A, 1, AX, -1);
    const B = bunker ? s.B.flatMap(([t, n]) => Array.from({ length: n }, () => { const u = Game.spawnUnit(t, 2, bunker.x, bunker.y + 30); Game._dbg.enter(u, bunker); return u; })) : place(s.B, 2, BX, 1);
    if (s.squadA) Game.setSquad(1, A.slice(0, 12));
    const hold = list => { for (const u of list) u.order = { type: 'hold', x: u.x, y: u.y }; };
    if (s.holdA) hold(A); else Game.orderMove(A, BX + 30, MIDY, 'attackmove');
    if (s.defend) hold(B.filter(u => !u.inside)); else if (!s.idleB) Game.orderMove(B, AX - 30, MIDY, 'attackmove');
    Fog.update(0, true);
    const alive = list => list.filter(u => !u.dead).length;
    const held = () => bunker ? (!bunker.dead && alive(B)) : alive(B);
    const nearest = (u, list) => { let t = null, d = Infinity; for (const e of list) if (!e.dead && !e.inside) { const k = Util.dist(u.x, u.y, e.x, e.y); if (k < d) { d = k; t = e; } } return t; };
    // A grenadier's next throw: at the Bunker, or at the nearest defender (walking on if the grenade isn't ready).
    function orderNade(u) {
      if (u.type !== 'rifle') return false;
      if (bunker && !bunker.dead) { Game.orderGrenade([u], bunker.x, bunker.y, bunker); return true; }
      const t = nearest(u, B); if (!t) return false;
      if (Game.canThrow(u)) Game.orderGrenade([u], t.x, t.y, t); else Game.orderMove([u], t.x, t.y, 'attackmove');
      return true;
    }
    // Idle attackers are sent on again, as a player would: grenadiers throw again, the rest attack-move at the nearest enemy.
    const reorder = (list, foes) => {
      for (const u of list) {
        if (u.dead || u.inside || u.order || u.flee > 0 || u.work != null) continue;
        if (list === A && s.grenadesA && orderNade(u)) continue;
        const t = nearest(u, foes) || (bunker && !bunker.dead && list === A ? bunker : null); if (!t) continue;
        Game.orderMove([u], t.x, t.y, 'attackmove');
      }
    };
    if (s.grenadesA) for (const u of A) orderNade(u);   // grenadiers are sent to throw from the start, as the Balance Lab's fort test does
    const maxTicks = Math.round(s.maxTime / STEP);
    const run = {
      scenario: s, seed, A, B, bunker, result: null,
      get aliveA() { return alive(A); }, get aliveB() { return held() ? alive(B) : 0; },
      labelA: label(s.A), labelB: label(s.B) + (s.fort === 'bunker' ? ' in a Bunker' : s.fort === 'trench' ? ' in a trench' : ''),
      step(n = 1) {
        if (run.result) return run.result;
        for (let i = 0; i < n; i++) {
          if (G.tick >= maxTicks || !alive(A) || !held()) {
            const a = alive(A), b = held() ? alive(B) : 0;
            run.result = { id: s.id, seed, winner: a && !b ? 1 : b && !a ? 2 : 0, time: G.time, survivorsA: a, survivorsB: b, lostA: A.length - a, lostB: B.length - alive(B), bunkerFell: !!(bunker && bunker.dead) };
            return run.result;
          }
          Game.update(STEP);
          if (G.tick % 30 === 0) { if (!s.holdA) reorder(A, B); if (!s.defend && !s.idleB) reorder(B, A); }
        }
        return null;
      },
      // The box around everyone still fighting, for the theatre's camera.
      bounds() {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const u of A.concat(B)) if (!u.dead) { const p = u.inside && bunker ? bunker : u; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
        if (bunker && !bunker.dead) { x0 = Math.min(x0, bunker.x); x1 = Math.max(x1, bunker.x); }
        return x0 === Infinity ? null : { x0, y0, x1, y1 };
      },
    };
    return run;
  }
  // Runs one scenario to the end, headless.
  function runOnce(id, seed) { const r = start(id, seed); let res = null; while (!(res = r.step(600))); return res; }
  // Many seeds: win rates, average time and losses, plus the seeds worth watching: a typical fight
  // (the usual winner, nearest the median time) and an upset (the other side winning), if any.
  function batch(id, runs = 40, seed0 = 1) {
    const res = []; for (let i = 0; i < runs; i++) res.push(runOnce(id, seed0 + i));
    const n = res.length, pct = w => Math.round(res.filter(r => r.winner === w).length / n * 1000) / 10, avg = k => res.reduce((a, r) => a + r[k], 0) / n;
    const wins = [1, 2, 0].map(w => res.filter(r => r.winner === w).length), usual = [1, 2, 0][wins.indexOf(Math.max(...wins))];
    const pool = res.filter(r => r.winner === usual).sort((a, b) => a.time - b.time), typical = pool[Math.floor(pool.length / 2)];
    const other = usual === 1 ? 2 : 1, upsets = res.filter(r => r.winner === other).sort((a, b) => a.time - b.time), upset = upsets[Math.floor(upsets.length / 2)] || null;
    return { id, title: byId[id].title, group: byId[id].group, runs: n, winA: pct(1), winB: pct(2), draw: pct(0), avgTime: avg('time'), lostA: avg('lostA'), lostB: avg('lostB'),
      survivorsA: avg('survivorsA'), survivorsB: avg('survivorsB'), typicalSeed: typical ? typical.seed : null, upsetSeed: upset ? upset.seed : null };
  }
  return { LIST, byId, start, runOnce, batch, BX, MIDY };
})();
