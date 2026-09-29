'use strict';
// Fight Theatre page (theatre.html): plays a FightScenarios run with the game's renderer in spectator
// mode (both sides drawn, no fog), a camera that frames the fight, and captions. The recorder drives
// it frame by frame through Theatre.frame(); a person uses the bar at the bottom.
const Theatre = (() => {
  const STEP = Sim.STEP;
  const q = new URLSearchParams(location.search);
  let run = null, speed = +(q.get('speed') || 1), playing = true, acc = 0, last = 0, endT = 0, note = q.get('note') || '';
  const $ = id => document.getElementById(id);

  function load(id, seed) {
    run = FightScenarios.start(id, seed); acc = 0; endT = 0;
    Terrain.flushDirty(); drawGrid(); Render.resize();
    const s = run.scenario;
    $('cap').querySelector('.t').textContent = s.title;
    $('cap').querySelector('.n').textContent = s.group + ' · seed ' + seed + (note ? ' · ' + note : '');
    $('banner').classList.add('hidden');
    frameCamera(true); paint();
  }
  // A faint 50 m grid on the ground, labelled every 100 m, so ranges can be read off the picture.
  function drawGrid() {
    const c = Terrain.cache.getContext('2d'), mw = Terrain.W * Terrain.CELL, mh = Terrain.H * Terrain.CELL;
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
    const z = Util.clamp(Math.min(Render.w / bw, Render.h / bh), 0.8, 2.6);
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2 - 20, cam = Render.cam;
    const k = snap ? 1 : 0.06;
    cam.zoom += (z - cam.zoom) * k;
    const tx = cx - Render.w / 2 / cam.zoom, ty = cy - Render.h / 2 / cam.zoom;
    cam.x += (tx - cam.x) * (snap ? 1 : 0.12); cam.y += (ty - cam.y) * (snap ? 1 : 0.12);
  }
  function paint() {
    G.toasts.length = 0; G.effects = G.effects.filter(e => e.kind !== 'ping');   // the player's alerts mean nothing to a spectator
    Render.draw();
    $('sideA').innerHTML = 'BLUE · ' + run.labelA + '<br><span class="small">standing</span><b>' + run.aliveA + ' / ' + run.A.length + '</b>';
    $('sideB').innerHTML = run.labelB + ' · RED<br><b>' + run.aliveB + ' / ' + run.B.length + '</b><span class="small"> standing</span>';
    $('clockT').textContent = Util.fmtTime(G.time);
    const r = run.result;
    if (r && $('banner').classList.contains('hidden')) {
      const who = r.winner === 1 ? 'Blue wins' : r.winner === 2 ? 'Red wins' : 'Draw';
      $('banner').innerHTML = who + ' in ' + Math.round(r.time) + ' s<div class="d">Blue lost ' + r.lostA + ' of ' + run.A.length + ', red lost ' + r.lostB + ' of ' + run.B.length + (r.bunkerFell ? ', the Bunker fell' : '') + '</div>';
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
