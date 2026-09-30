'use strict';
// Headless runner (patch 0.2.1): builds a match and advances the simulation with no renderer, input
// or UI. Main uses the same build steps; the Balance Lab (lab.html) and console tests use the rest.
// Simulation only: no DOM, no canvas, no Portraits.
const Sim = (() => {
  const STEP = 1 / 30;   // one tick; 30 ticks make a game second

  // opts: { map, difficulty, seed }. The map id must be in MapGen.ALL; 'random' (0.7) generates a new
  // big map from the match seed.
  function survey(opts) {
    let spec = MapGen.ALL.find(m => m.id === opts.map) || MapGen.ALL[0];
    G.difficulty = opts.difficulty || 'normal';
    Game.init(opts.seed);
    if (spec.generated) spec = MapGen.generate(G.seed);
    G.mapId = spec.id; G.sandbox = !spec.ai;
    MapGen.build(spec, Data.DIFFICULTY[G.difficulty]);
    return spec;
  }
  function routes() { Path.init(); Fog.init(); AI.reset(); Fog.update(0, true); }
  function newMatch(opts) { const spec = survey(opts); routes(); return spec; }

  function run(ticks, onTick) { for (let i = 0; i < ticks; i++) { Game.update(STEP); if (onTick) onTick(); } }
  // Advance until a condition holds or the tick budget runs out; returns the ticks used.
  function runUntil(cond, maxTicks) { let n = 0; while (n < maxTicks && !cond()) { Game.update(STEP); n++; } return n; }

  // Replays a logged match: rebuild from the same options, apply each command before the tick it
  // was logged at, run to `ticks`. Commands carry ids, and ids restart at 1 per match, so they match.
  function replay(opts, orders, ticks) {
    newMatch(opts);
    const list = orders.slice().sort((a, b) => a.tick - b.tick); let i = 0;
    while (G.tick < ticks) {
      while (i < list.length && list[i].tick <= G.tick) { const { tick, ...c } = list[i++]; Game.command(c); }
      Game.update(STEP);
    }
  }

  // A short fingerprint of the match state, to check that two runs are identical.
  function fingerprint() {
    let h = 2166136261 >>> 0;
    const mix = v => { const s = typeof v === 'number' ? v.toFixed(4) : String(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
    mix(G.tick);
    for (const u of G.units) { mix(u.id); mix(u.x); mix(u.y); mix(u.hp); mix(u.stress); mix(u.dead); }
    for (const b of G.buildings) { mix(b.id); mix(b.hp); mix(b.queue.length); }
    for (const sg of G.segs) { mix(sg.id); mix(sg.progress); mix(sg.hp); }
    for (const p of Object.values(G.players)) for (const k of Data.RES) mix(p.res[k]);
    return h.toString(16);
  }

  return { STEP, survey, routes, newMatch, run, runUntil, replay, fingerprint };
})();
