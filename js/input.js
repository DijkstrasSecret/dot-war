'use strict';
// Mouse and keyboard: selection, command modes (walk / attack / work / build), camera, hotkeys.
// Hold Shift to queue orders back to back. WASD, arrow keys or middle mouse drag pan the map.
// Key layout: DESIGN_DECISIONS.md section 9 (F attack-move, R defend, G retreat, X stop, E enter,
// Q exit, T tower upgrade, Z X C V train). New features take free keys; existing ones don't move.
// Every order goes through Game.command, which logs it with its tick for replays.
// TODO(patch 0.3): load/unload keys for transports (reuse the work/garrison click flow).
const Input = (() => {
  const { dist } = Util;
  const state = { mode: 'normal', buildType: null, box: null, mouse: { x: 0, y: 0, wx: 0, wy: 0, inside: false, moveT: 0 }, keys: new Set(), lastGroupT: 0, lastGroupK: '', trainPage: 0 };
  const PAN_KEYS = { w: 'arrowup', a: 'arrowleft', s: 'arrowdown', d: 'arrowright' };   // DD 9: WASD pans like the arrows
  const ids = list => list.map(e => e.id);
  const cmd = c => Game.command(c);
  const BUILD_KEYS = {}; for (const [t, k] of Object.entries(Data.BUILD_HOTKEYS)) BUILD_KEYS[k.toLowerCase()] = t;
  const TRAIN_KEYS = Data.TRAIN_HOTKEYS.map(k => k.toLowerCase());
  let canvas, dragStart = null, pan = null, lastClickT = 0, lastClickType = null;

  function init() {
    canvas = document.getElementById('game');
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('auxclick', e => e.preventDefault());
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mouseleave', () => { state.mouse.inside = false; });
    canvas.addEventListener('mouseenter', () => { state.mouse.inside = true; });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); state.keys.delete(PAN_KEYS[k] || k); });
    window.addEventListener('blur', () => state.keys.clear());
    const mini = document.getElementById('minimap');
    mini.addEventListener('mousedown', e => { if (e.button !== 0) return; miniNav(e); mini.onmousemove = ev => { if (ev.buttons & 1) miniNav(ev); }; });
    mini.addEventListener('mouseup', () => { mini.onmousemove = null; });
    mini.addEventListener('contextmenu', e => {
      e.preventDefault(); const [wx, wy] = miniWorld(e); const units = selectedUnits();
      if (units.length) { cmd({ kind: 'move', units: ids(units), x: wx, y: wy, queue: e.shiftKey }); marker(wx, wy, '#3c3'); }
    });
  }
  function miniWorld(e) { const r = e.currentTarget.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * Terrain.W * Terrain.CELL, (e.clientY - r.top) / r.height * Terrain.H * Terrain.CELL]; }
  function miniNav(e) { const [wx, wy] = miniWorld(e); Render.centerOn(wx, wy); }
  function updateMouse(e) {
    const r = canvas.getBoundingClientRect();
    state.mouse.x = e.clientX - r.left; state.mouse.y = e.clientY - r.top; state.mouse.moveT = performance.now();
    const [wx, wy] = Render.toWorld(state.mouse.x, state.mouse.y); state.mouse.wx = wx; state.mouse.wy = wy;
  }
  const selectedUnits = () => G.selection.filter(e => e instanceof Unit && !e.dead && e.owner === 1);
  const selectedBuilding = () => (G.selection.length === 1 && G.selection[0] instanceof Building && G.selection[0].owner === 1 && !G.selection[0].dead) ? G.selection[0] : null;
  function marker(x, y, color) { G.effects.push({ kind: 'marker', x, y, t: 0, dur: 0.6, color }); }

  function entityAt(wx, wy) {
    let best = null, bestD = Infinity;
    for (const u of G.units) {
      if (u.dead || u.inside) continue; if (u.owner !== 1 && !Fog.visible(1, u.x, u.y)) continue;
      const d = dist(u.x, u.y, wx, wy) - u.size; if (d < 5 && d < bestD) { best = u; bestD = d; }
    }
    if (best) return best;
    for (const b of G.buildings) if (!b.dead && (b.owner === 1 || b.seen) && b.contains(wx, wy)) return b;
    return null;
  }
  function select(list, add) {
    if (add) { const s = new Set(G.selection); for (const e of list) s.add(e); G.selection = [...s]; }
    else G.selection = list;
    state.trainPage = 0;
    if (G.selection.some(e => e.owner === 1 && e instanceof Unit)) G.selection = G.selection.filter(e => e.owner === 1 && e instanceof Unit);
    if (G.selection.length && state.mode !== 'build') UI.showTab('sel'); else UI.refresh();
  }
  const trainable = b => b.def.produces.filter(t => G.players[1].unlocked.has(t));
  function setMode(m, buildType) {
    if ((m === 'walk' || m === 'attack' || m === 'work') && !selectedUnits().length) m = 'normal';
    state.mode = m; state.buildType = buildType || null; UI.refresh();
  }

  // ---- mouse ----
  function onDown(e) {
    updateMouse(e);
    if (e.button === 1) { e.preventDefault(); pan = { x: e.clientX, y: e.clientY, cx: Render.cam.x, cy: Render.cam.y }; return; }
    const { wx, wy } = state.mouse; const q = e.shiftKey;
    if (e.button === 2) {
      if (state.mode !== 'normal') { setMode('normal'); return; }
      contextOrder(wx, wy, q); return;
    }
    if (e.button !== 0) return;
    const units = selectedUnits();
    if (state.mode === 'build') {
      const b = cmd({ kind: 'build', type: state.buildType, x: wx, y: wy });
      if (b && !q) setMode('normal'); else UI.refresh();
      return;
    }
    if (state.mode === 'walk') { cmd({ kind: 'move', units: ids(units), x: wx, y: wy, queue: q }); marker(wx, wy, '#3c3'); if (!q) setMode('normal'); return; }
    if (state.mode === 'attack') {
      const ent = entityAt(wx, wy);
      if (ent && ent.owner !== 1) cmd({ kind: 'attack', units: ids(units), target: ent.id, queue: q }); else cmd({ kind: 'bombard', units: ids(units), x: wx, y: wy, queue: q });
      marker(wx, wy, '#c33'); if (!q) setMode('normal'); return;
    }
    if (state.mode === 'work') {
      const ent = entityAt(wx, wy);
      if (ent instanceof Building && ent.owner === 1 && ent.def.harvest && ent.built) {
        const n = cmd({ kind: 'work', units: ids(units), building: ent.id, queue: q }); if (n) Game.toast(n + ' sent to work at the ' + ent.def.name);
        marker(ent.x, ent.y, '#3c3'); if (!q) setMode('normal');
      } else if (ent instanceof Building && ent.owner === 1 && ent.def.tower && ent.built) {
        const n = cmd({ kind: 'garrison', units: ids(units), building: ent.id, queue: q }); if (n) Game.toast(n + ' heading into the ' + ent.def.name);
        marker(ent.x, ent.y, '#3c3'); if (!q) setMode('normal');
      } else Game.toast('Click one of your Lumber Camps, Mines or Scout Towers');
      return;
    }
    dragStart = { x: state.mouse.x, y: state.mouse.y, shift: q };
  }
  function onMove(e) {
    updateMouse(e);
    if (pan) {
      if (e.buttons & 4) { Render.cam.x = pan.cx - (e.clientX - pan.x) / Render.cam.zoom; Render.cam.y = pan.cy - (e.clientY - pan.y) / Render.cam.zoom; Render.clampCam(); return; }
      pan = null;
    }
    if (dragStart && (Math.abs(state.mouse.x - dragStart.x) > 4 || Math.abs(state.mouse.y - dragStart.y) > 4)) {
      state.box = { x0: Math.min(dragStart.x, state.mouse.x), y0: Math.min(dragStart.y, state.mouse.y), x1: Math.max(dragStart.x, state.mouse.x), y1: Math.max(dragStart.y, state.mouse.y) };
    }
  }
  function onUp(e) {
    if (e.button === 1) { pan = null; return; }
    if (e.button !== 0 || !dragStart) return;
    const add = dragStart.shift;
    if (state.box) {
      const b = state.box; const [x0, y0] = Render.toWorld(b.x0, b.y0), [x1, y1] = Render.toWorld(b.x1, b.y1);
      const list = G.units.filter(u => !u.dead && u.owner === 1 && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1);
      if (list.length || !add) select(list, add);
    } else {
      updateMouse(e);
      const ent = entityAt(state.mouse.wx, state.mouse.wy);
      const now = performance.now();
      if (ent instanceof Unit && ent.owner === 1 && now - lastClickT < 350 && lastClickType === ent.type) {
        const [x0, y0] = Render.toWorld(0, 0), [x1, y1] = Render.toWorld(Render.w, Render.h);
        select(G.units.filter(u => !u.dead && u.owner === 1 && u.type === ent.type && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1), add);
      } else if (ent) {
        if (add && ent.owner === 1 && ent instanceof Unit && G.selection.includes(ent)) { G.selection = G.selection.filter(s => s !== ent); UI.refresh(); }
        else select([ent], add);
      } else if (!add) select([], false);
      lastClickT = now; lastClickType = ent ? ent.type : null;
    }
    dragStart = null; state.box = null;
  }
  function contextOrder(wx, wy, q) {
    const units = selectedUnits(); const ent = entityAt(wx, wy);
    if (units.length) {
      if (ent && ent.owner !== 1 && !ent.dead) { cmd({ kind: 'attack', units: ids(units), target: ent.id, queue: q }); marker(ent.x, ent.y, '#c33'); return; }
      if (ent instanceof Building && ent.owner === 1 && ent.def.harvest && ent.built) { const n = cmd({ kind: 'work', units: ids(units), building: ent.id, queue: q }); if (n) Game.toast(n + ' sent to work at the ' + ent.def.name); marker(ent.x, ent.y, '#3c3'); return; }
      if (ent instanceof Building && ent.owner === 1 && ent.def.tower && ent.built) { const n = cmd({ kind: 'garrison', units: ids(units), building: ent.id, queue: q }); if (n) Game.toast(n + ' heading into the ' + ent.def.name); marker(ent.x, ent.y, '#3c3'); return; }
      cmd({ kind: 'move', units: ids(units), x: wx, y: wy, queue: q }); marker(wx, wy, '#3c3'); return;
    }
    const b = selectedBuilding();
    if (b && b.def.produces) { cmd({ kind: 'rally', building: b.id, x: wx, y: wy }); marker(wx, wy, '#fff'); }
  }
  function onWheel(e) {
    e.preventDefault(); updateMouse(e);
    Render.zoomAt(state.mouse.x, state.mouse.y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }

  // ---- keyboard ----
  const now = () => performance.now();
  function onKey(e) {
    const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    const k = e.key.toLowerCase();
    if (k === 'f1') { e.preventDefault(); UI.toggleHelp(); return; }
    if (Menu.open) { if (k === 'escape') Menu.back(); return; }
    if (k === ' ') { e.preventDefault(); Game.togglePause(); UI.refreshSpeed(); return; }
    if (k === ',') { Game.setSpeed(G.speed <= 1 ? 0 : G.speed === 2 ? 1 : 2); UI.refreshSpeed(); return; }
    if (k === '.') { Game.setSpeed(G.speed === 0 ? 1 : G.speed === 1 ? 2 : 4); UI.refreshSpeed(); return; }
    if (k === 'escape') { if (state.mode !== 'normal') setMode('normal'); else select([], false); return; }
    if (k.startsWith('arrow')) { state.keys.add(k); return; }
    if (PAN_KEYS[k] && !e.ctrlKey && !e.metaKey) { state.keys.add(PAN_KEYS[k]); return; }
    const units = selectedUnits(); const b = selectedBuilding(); const p = G.players[1];
    if (b && b.built && b.def.produces && TRAIN_KEYS.includes(k)) {
      const t = trainable(b)[state.trainPage * TRAIN_KEYS.length + TRAIN_KEYS.indexOf(k)];
      if (t) { cmd({ kind: 'enqueue', building: b.id, type: t }); UI.refresh(); }
      return;
    }
    if (b && b.def.tower && k === 'q') { const n = cmd({ kind: 'unload', building: b.id }); if (n) Game.toast(n + ' left the tower'); UI.refresh(); return; }
    if (b && b.def.tower && k === 't') { cmd({ kind: 'upgrade', building: b.id }); UI.refresh(); return; }
    if (units.length) {
      if (k === 'f') { setMode('attack'); return; }
      if (k === 'r') { cmd({ kind: 'hold', units: ids(units), queue: e.shiftKey }); return; }
      if (k === 'g') { cmd({ kind: 'retreat', units: ids(units), queue: e.shiftKey }); return; }
      if (k === 'x') { cmd({ kind: 'stop', units: ids(units) }); return; }
      if (k === 'e') { setMode('work'); return; }
    }
    if (k === 'b') { UI.showTab('build'); return; }
    if (k === 'n') { UI.showTab('research'); return; }
    if (BUILD_KEYS[k] && !e.ctrlKey) { setMode('build', BUILD_KEYS[k]); UI.showTab('build'); return; }
    if (k === 'h') { const hq = G.buildings.find(x => x.owner === 1 && x.type === 'hq' && !x.dead); if (hq) { select([hq], false); Render.centerOn(hq.x, hq.y); } return; }
    if (k === 'tab') {
      e.preventDefault();
      // DD G15: with a factory of more than four blueprints selected, Tab flips Z X C V to the next page.
      const pages = b && b.def.produces ? Math.ceil(trainable(b).length / TRAIN_KEYS.length) : 1;
      if (pages > 1) { state.trainPage = (state.trainPage + 1) % pages; UI.refresh(); return; }
      const f = G.buildings.filter(x => x.owner === 1 && !x.dead && x.def.produces); if (!f.length) return;
      const i = f.indexOf(G.selection[0]); const nb = f[(i + 1) % f.length]; select([nb], false); Render.centerOn(nb.x, nb.y); return;
    }
    if ((e.ctrlKey || e.metaKey) && k === 'a') {
      e.preventDefault(); const [x0, y0] = Render.toWorld(0, 0), [x1, y1] = Render.toWorld(Render.w, Render.h);
      select(G.units.filter(u => !u.dead && u.owner === 1 && u.work == null && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1), false); return;
    }
    if (k >= '1' && k <= '9') {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (units.length) { G.groups[k] = units.slice(); for (const u of units) u.group = +k; Game.toast('Group ' + k + ' set'); } }
      else {
        const g = (G.groups[k] || []).filter(u => !u.dead);
        if (g.length) {
          select(g, e.shiftKey);
          if (now() - state.lastGroupT < 350 && state.lastGroupK === k) { let cx = 0, cy = 0; for (const u of g) { cx += u.x; cy += u.y; } Render.centerOn(cx / g.length, cy / g.length); }
          state.lastGroupT = now(); state.lastGroupK = k;
        }
      }
    }
  }

  function update(dt) {
    const sp = 700 / Render.cam.zoom * dt; const ks = state.keys; let dx = 0, dy = 0;
    if (ks.has('arrowup')) dy -= sp; if (ks.has('arrowdown')) dy += sp; if (ks.has('arrowleft')) dx -= sp; if (ks.has('arrowright')) dx += sp;
    if (state.mouse.inside && document.hasFocus() && !state.box && !pan && performance.now() - state.mouse.moveT < 3000) {
      const m = 14; const { x, y } = state.mouse;
      if (x < m) dx -= sp; if (x > Render.w - m) dx += sp; if (y < m) dy -= sp; if (y > Render.h - m) dy += sp;
    }
    if (dx || dy) { Render.cam.x += dx; Render.cam.y += dy; Render.clampCam(); const [wx, wy] = Render.toWorld(state.mouse.x, state.mouse.y); state.mouse.wx = wx; state.mouse.wy = wy; }
  }

  return { init, update, state, setMode, select, selectedUnits, selectedBuilding, entityAt, trainable };
})();
