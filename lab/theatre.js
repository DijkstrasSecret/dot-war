'use strict';
// Fight Theatre page (theatre.html): plays a FightScenarios run with the game's renderer in spectator
// mode (both sides drawn, no fog), a camera that frames the fight, and captions. The recorder drives
// it frame by frame through Theatre.frame(); a person uses the bar at the bottom.
const Theatre = (() => {
  const STEP = Sim.STEP;
  const q = new URLSearchParams(location.search);
  let run = null, speed = +(q.get('speed') || 1), playing = true, acc = 0, last = 0, endT = 0, note = q.get('note') || '';
  const $ = id => document.getElementById(id);

  // A whole AI-versus-AI match (LabTests.aiMatch) dressed as a run, so the same page plays it.
  function matchRun(seed, diff) {
    const map = q.get('map') || 'highland';   // 0.7: map=random follows a match on a 13 km generated map
    const m = LabTests.aiMatch({ seed, difficulty: diff, maxMinutes: +(q.get('mins') || 90), map });
    const army = pid => G.units.filter(u => u.owner === pid && !u.dead && !u.def.labour);
    const hq = pid => G.buildings.find(b => b.owner === pid && b.type === 'hq');
    const r = { scenario: { title: 'AI v AI · ' + (map === 'random' ? '13 km random map' : 'Highland Pass') + ' · ' + diff, group: 'Whole match, sped up', ground: 'map' }, match: true, result: null, A: [], B: [],
      get aliveA() { return army(1).length; }, get aliveB() { return army(2).length; },
      get labelA() { const h = hq(1); return 'army, HQ ' + (h && !h.dead ? Math.round(h.hp / h.maxHp * 100) + '%' : 'lost'); },
      get labelB() { const h = hq(2); return 'army, HQ ' + (h && !h.dead ? Math.round(h.hp / h.maxHp * 100) + '%' : 'lost'); },
      step(n) { if (r.result) return r.result; const res = m.step(n); if (res) r.result = { winner: res.winner, time: G.time, lostA: G.stats[1].lost, lostB: G.stats[2].lost, bunkerFell: false }; return r.result; },
      // Follow the busiest spot: the biggest fight, else the biggest group on the move, else a base.
      // 0.7: on a 13 km map "everyone" is spread over kilometres, so it picks one cluster, not the average.
      bounds() {
        const soldiers = G.units.filter(u => !u.dead && !u.inside && !u.def.labour && (u.owner === 1 || u.owner === 2));
        const cluster = list => { let best = null, bn = 0; for (const u of list) { let n = 0; for (const v of list) if (Math.abs(v.x - u.x) < 400 && Math.abs(v.y - u.y) < 400) n++; if (n > bn) { bn = n; best = u; } } return best ? list.filter(v => Util.dist(v.x, v.y, best.x, best.y) < 450) : []; };
        let us = cluster(soldiers.filter(u => u.target));
        if (us.length < 2) us = cluster(soldiers.filter(u => u.order && (u.order.type === 'attackmove' || u.order.type === 'move')));
        if (us.length < 2) { const h = G.buildings.find(b => b.type === 'hq' && !b.dead && b.hp < b.maxHp) || G.buildings.find(b => b.type === 'hq' && b.owner === 2 && !b.dead); if (h) return { x0: h.x - 250, y0: h.y - 250, x1: h.x + 250, y1: h.y + 250, wide: true }; }
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const u of us) { x0 = Math.min(x0, u.x); y0 = Math.min(y0, u.y); x1 = Math.max(x1, u.x); y1 = Math.max(y1, u.y); }
        return x0 === Infinity ? null : { x0, y0, x1, y1 };
      },
    };
    return r;
  }
  function load(id, seed) {
    run = q.get('match') ? matchRun(+q.get('match'), q.get('diff') || 'normal') : FightScenarios.start(id, seed); acc = 0; endT = 0;
    if (run.match) document.body.classList.add('match');
    Terrain.onTileDrawn = null; Terrain.flushDirty(); if (!run.match) drawGrid(); Render.resize();
    const s = run.scenario;
    $('cap').querySelector('.t').textContent = s.title;
    $('cap').querySelector('.n').textContent = s.group + ' · seed ' + seed + (note ? ' · ' + note : '');
    $('banner').classList.add('hidden');
    frameCamera(true); paint();
  }
  // A faint 50 m grid on the ground, labelled every 100 m, so ranges can be read off the picture.
  function drawGrid() {
    Terrain.onTileDrawn = c => gridOn(c);   // 0.7a: the ground is drawn in tiles; each one gets the grid
  }
  function gridOn(c) {
    const mw = Terrain.W * Terrain.CELL, mh = Terrain.H * Terrain.CELL;
    c.save(); c.strokeStyle = 'rgba(80, 76, 60, 0.07)'; c.lineWidth = 1; c.fillStyle = 'rgba(80, 76, 60, 0.3)'; c.font = '9px Consolas, monospace';
    for (let x = 0; x <= mw; x += 50) { c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, mh); c.stroke(); }
    for (let y = 0; y <= mh; y += 50) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(mw, y + 0.5); c.stroke(); }
    for (let x = 0; x <= mw; x += 100) for (const y of [14, mh - 4]) c.fillText(x + ' m', x + 2, y);
    // Name the ground so a still frame explains itself.
    const g = run.scenario.ground, X = FightScenarios.BX, Y = FightScenarios.MIDY;
    c.font = 'bold 11px "Segoe UI", Arial, sans-serif'; c.fillStyle = 'rgba(60, 56, 40, 0.45)'; c.textAlign = 'center';
    if (g === 'height') { c.fillText('PLATEAU, 30 m HIGHER', X + 110, Y - 110); c.fillText('SLOPE', X - 45, Y - 130); }
    if (g === 'forestEdge' || g === 'forestDeep') c.fillText('FOREST', X + 60, Y - 110);
    if (run.scenario.fort === 'trench') c.fillText('TRENCH', X, Y - 95);
    c.restore();
  }
  // Fit the box around everyone still fighting, eased so the view doesn't jump.
  function frameCamera(snap) {
    const b = run.bounds(); if (!b) return;
    const pad = 90, bw = b.x1 - b.x0 + pad * 2, bh = b.y1 - b.y0 + pad * 2 + 120;
    const z = Util.clamp(Math.min(Render.w / bw, Render.h / bh), run.match ? (b.wide ? 0.3 : 0.55) : 0.8, run.match ? 1.6 : 2.6);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2 - 20, cam = Render.cam;
    if (Util.dist(cam.x + Render.w / 2 / cam.zoom, cam.y + Render.h / 2 / cam.zoom, cx, cy) > 1500) snap = true;   // a jump across a big map: cut, don't pan over empty ground
    const k = snap ? 1 : 0.06;
    cam.zoom += (z - cam.zoom) * k;
    const tx = cx - Render.w / 2 / cam.zoom, ty = cy - Render.h / 2 / cam.zoom;
    cam.x += (tx - cam.x) * (snap ? 1 : 0.12); cam.y += (ty - cam.y) * (snap ? 1 : 0.12);
  }
  function paint() {
    G.toasts.length = 0; G.effects = G.effects.filter(e => e.kind !== 'ping');   // the player's alerts mean nothing to a spectator
    Render.draw();
    const of = n => run.match ? '' : ' / ' + n;
    $('sideA').innerHTML = 'BLUE · ' + run.labelA + '<br><span class="small">standing</span><b>' + run.aliveA + of(run.A.length) + '</b>';
    $('sideB').innerHTML = run.labelB + ' · RED<br><b>' + run.aliveB + of(run.B.length) + '</b><span class="small"> standing</span>';
    const E = G.env, k = E && Data.WEATHER.kinds[E.weather];   // 0.6: weather and time of day
    $('clockT').textContent = Util.fmtTime(G.time) + (k ? '  ' + k.icon + ' ' + k.name.toLowerCase() + (E.night ? ' · night' : E.dark > 0 ? ' · dusk' : '') : '');
    const r = run.result;
    if (r && $('banner').classList.contains('hidden')) {
      const who = r.winner === 1 ? 'Blue wins' : r.winner === 2 ? 'Red wins' : 'Draw';
      $('banner').innerHTML = run.match ? who + ' after ' + Util.fmtTime(r.time) + '<div class="d">Blue lost ' + r.lostA + ' units, red lost ' + r.lostB + '</div>'
        : who + ' in ' + Math.round(r.time) + ' s<div class="d">Blue lost ' + r.lostA + ' of ' + run.A.length + ', red lost ' + r.lostB + ' of ' + run.B.length + (r.bunkerFell ? ', the Bunker fell' : '') + '</div>';
      $('banner').classList.remove('hidden');
    }
  }
  // One video frame: advance `steps` simulation ticks (1 at 30 fps = real time) and draw.
  function frame(steps = 1) {
    if (!run.result) run.step(steps); else endT += steps * STEP;
    frameCamera(false); paint();
    return { done: !!run.result, endT, result: run.result };
  }
  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing && run) { acc += dt * speed; const n = Math.floor(acc / STEP); acc -= n * STEP; if (n) frame(n); else { frameCamera(false); paint(); } }
    requestAnimationFrame(loop);
  }
  function init() {
    Render.init(); Render.spectator = true; Input.state.mode = 'normal';
    const sel = $('scen'); let grp = null, og = null;
    for (const s of FightScenarios.LIST) { if (s.group !== grp) { grp = s.group; og = document.createElement('optgroup'); og.label = grp; sel.appendChild(og); } const o = document.createElement('option'); o.value = s.id; o.textContent = s.title; og.appendChild(o); }
    sel.value = q.get('s') || FightScenarios.LIST[0].id; $('seed').value = q.get('seed') || 1; $('speed').value = String(speed);
    const restart = () => { note = ''; load(sel.value, +$('seed').value || 1); };
    sel.onchange = restart; $('seed').onchange = restart; $('restart').onclick = restart;
    $('speed').onchange = () => { speed = +$('speed').value; };
    $('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Pause' : 'Play'; };
    window.addEventListener('resize', () => { Render.resize(); if (run) paint(); });
    if (q.get('rec')) { document.body.classList.add('rec'); playing = false; }
    load(sel.value, +$('seed').value || 1);
    last = performance.now(); requestAnimationFrame(loop);
  }
  window.addEventListener('load', init);
  return { load, frame, get run() { return run; }, set playing(v) { playing = v; } };
})();
