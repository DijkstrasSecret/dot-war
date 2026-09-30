'use strict';
// Mouse and keyboard: selection, command modes (walk / attack / work / build), camera, hotkeys.
// Hold Shift to queue orders back to back. WASD, arrow keys or middle mouse drag pan the map.
// Key layout: DESIGN_DECISIONS.md section 9 (F attack-move, R defend, G retreat, X stop, E enter,
// Q exit, T tower upgrade, Z X C V train). New features take free keys; existing ones don't move.
// Every order goes through Game.command, which logs it with its tick for replays.
// Patch 0.4: line tools (Y trench, I barricade, J wire) are drawn by holding the left button and
// dragging; K fills a trench (Workers), V throws a grenade (Riflemen, after the research).
// Patch 0.5a (Kaan): building and line keys work only while the Build tab is open (B, then the
// letter), which frees the letters for unit orders: M smoke shells (mortars), C demolition charge.
// Trucks (0.5b): right click or E on a Truck boards it, Q unloads.
// 0.5c: I next idle Worker, O army overview, J jump to the latest alert. 0.6: L mortars fire a flare.
const Input = (() => {
  const { dist } = Util;
  const state = { mode: 'normal', buildType: null, box: null, mouse: { x: 0, y: 0, wx: 0, wy: 0, inside: false, moveT: 0 }, keys: new Set(), lastGroupT: 0, lastGroupK: '', trainPage: 0, lineType: null, linePts: null };
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
      if (u.dead || u.inside) continue; if (u.owner !== 1 && (!Fog.visible(1, u.x, u.y) || !Game.detected(u, 1))) continue;
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
    if (['walk', 'attack', 'work', 'fill', 'grenade', 'smoke', 'flare', 'demolish'].includes(m) && !selectedUnits().length) m = 'normal';
    if (m === 'build' && Data.LINES[buildType]) { m = 'line'; }   // line tools share the build menu and keys
    state.mode = m; state.buildType = m === 'build' ? buildType : null; state.lineType = m === 'line' ? buildType : null; state.linePts = null; UI.refresh();
  }
  // After placing something or pressing Esc, go back to the Selection tab when something is selected,
  // so the letters are unit orders again (build keys work only while the Build tab is open).
  function leaveBuild(always) { if (UI.tab === 'build' && (always || G.selection.length)) UI.showTab('sel'); }
  // A clicked point on one of your own line segments (null if none).
  const ownSegAt = (wx, wy, doneOnly) => { const s = Game.segNear(wx, wy, doneOnly); return s && s.owner === 1 ? s : null; };
  function finishDraw(q) {
    const pts = state.linePts; state.linePts = null; if (!pts || pts.length < 2) return;
    const n = cmd({ kind: 'line', type: state.lineType, points: pts.map(p => [Math.round(p[0]), Math.round(p[1])]), units: ids(selectedUnits()), queue: q });
    if (n) { Game.toast(n + ' digging the ' + Data.LINES[state.lineType].name.toLowerCase()); if (!q) { setMode('normal'); leaveBuild(); } }
  }
  // Garrisonable: towers, Bunkers and the HQ (DD 9: right click or E on them garrisons).
  const canHold = ent => ent instanceof Building && ent.owner === 1 && ent.slots && ent.built;

  // ---- mouse ----
  function onDown(e) {
    updateMouse(e);
    if (e.button === 1) { e.preventDefault(); pan = { x: e.clientX, y: e.clientY, cx: Render.cam.x, cy: Render.cam.y }; return; }
    const { wx, wy } = state.mouse; const q = e.shiftKey;
    if (e.button === 2) {
      if (state.mode !== 'normal') { setMode('normal'); return; }
      // On open ground with soldiers selected, wait for the release: a drag sets the arrival line (DD E).
      const ent = entityAt(wx, wy);
      if (selectedUnits().length && !ent) { state.rdrag = { wx, wy, sx: state.mouse.x, sy: state.mouse.y, q, ex: wx, ey: wy }; return; }
      contextOrder(wx, wy, q); return;
    }
    if (e.button !== 0) return;
    const units = selectedUnits();
    if (state.mode === 'line') { state.linePts = [[wx, wy]]; state.lineShift = q; return; }
    if (state.mode === 'fill') {
      const sg = ownSegAt(wx, wy, true);
      if (sg && sg.type === 'trench') { const n = cmd({ kind: 'fill', units: ids(units), seg: sg.id, queue: q }); Game.toast(n ? n + ' Workers filling the trench' : 'Only Workers can fill trenches'); marker(sg.x, sg.y, '#3c3'); if (!q) setMode('normal'); }
      else Game.toast('Click one of your trenches');
      return;
    }
    if (state.mode === 'link') {   // Kaan, 0.5a.3: click one of your Depots, or the HQ to clear the link
      const b = selectedBuilding(), ent = entityAt(wx, wy);
      if (b && ent instanceof Building && ent.owner === 1 && (ent.type === 'depot' || ent.type === 'hq')) { if (cmd({ kind: 'link', building: b.id, target: ent.id })) { Game.toast('Supply link: ' + ent.def.name); marker(ent.x, ent.y, '#3c3'); } setMode('normal'); }
      else Game.toast('Click one of your Depots, or the HQ');
      return;
    }
    if (state.mode === 'smoke') {
      const n = cmd({ kind: 'smoke', units: ids(units), x: wx, y: wy, queue: q });
      if (!n) Game.toast('Smoke needs Mortar Crews and the Smoke Shells research'); marker(wx, wy, '#aaa'); if (!q) setMode('normal'); return;
    }
    if (state.mode === 'flare') {   // 0.6
      const n = cmd({ kind: 'flare', units: ids(units), x: wx, y: wy, queue: q });
      if (!n) Game.toast('Flares need Mortar Crews and the Flares research'); marker(wx, wy, '#fe8'); if (!q) setMode('normal'); return;
    }
    if (state.mode === 'demolish') {
      const sg = Game.segNear(wx, wy, false);
      if (sg && Data.LINES[sg.type].demolish) { const n = cmd({ kind: 'demolish', units: ids(units), seg: sg.id, queue: q }); Game.toast(n ? 'A sapper is going to blow the ' + Data.LINES[sg.type].name.toLowerCase() : 'Demolition needs a soldier and the Demolition Charges research'); marker(sg.x, sg.y, '#c33'); if (!q) setMode('normal'); }
      else Game.toast('Click a barricade, barbed wire or a bridge');
      return;
    }
    if (state.mode === 'grenade') {
      const ent = entityAt(wx, wy); const t = ent && ent.owner !== 1 ? ent : null;
      const n = cmd({ kind: 'grenade', units: ids(units), x: wx, y: wy, target: t ? t.id : null, queue: q });
      if (!n) Game.toast('Grenades need Riflemen and the Grenades research'); marker(wx, wy, '#c33'); if (!q) setMode('normal'); return;
    }
    if (state.mode === 'build') {
      const b = cmd({ kind: 'build', type: state.buildType, x: wx, y: wy });
      if (b && !q) { setMode('normal'); leaveBuild(); } else UI.refresh();
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
      } else if (canHold(ent)) {
        const n = cmd({ kind: 'garrison', units: ids(units), building: ent.id, queue: q }); if (n) Game.toast(n + ' heading into the ' + ent.def.name);
        marker(ent.x, ent.y, '#3c3'); if (!q) setMode('normal');
      } else if (ent instanceof Unit && ent.owner === 1 && ent.cargo) {
        const n = cmd({ kind: 'board', units: ids(units.filter(u => u !== ent)), target: ent.id, queue: q }); if (n) Game.toast(n + ' boarding the Truck');
        marker(ent.x, ent.y, '#3c3'); if (!q) setMode('normal');
      } else Game.toast('Click one of your camps, mines, tappers, refineries, towers, Bunkers, Trucks or the HQ');
      return;
    }
    dragStart = { x: state.mouse.x, y: state.mouse.y, shift: q };
  }
  function onMove(e) {
    updateMouse(e);
    if (state.rdrag) { state.rdrag.ex = state.mouse.wx; state.rdrag.ey = state.mouse.wy; }
    if (state.linePts) { const l = state.linePts[state.linePts.length - 1]; if (dist(l[0], l[1], state.mouse.wx, state.mouse.wy) >= 4 && state.linePts.length < 400) state.linePts.push([state.mouse.wx, state.mouse.wy]); }
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
    if (e.button === 2 && state.rdrag) { updateMouse(e); finishLine(); return; }
    if (e.button === 0 && state.linePts) { updateMouse(e); finishDraw(state.lineShift || e.shiftKey); return; }
    if (e.button !== 0 || !dragStart) return;
    const add = dragStart.shift;
    if (state.box) {
      const b = state.box; const [x0, y0] = Render.toWorld(b.x0, b.y0), [x1, y1] = Render.toWorld(b.x1, b.y1);
      const list = G.units.filter(u => !u.dead && !u.inside && u.owner === 1 && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1);
      if (list.length || !add) select(list, add);
    } else {
      updateMouse(e);
      const ent = entityAt(state.mouse.wx, state.mouse.wy);
      const now = performance.now();
      if (ent instanceof Unit && ent.owner === 1 && now - lastClickT < 350 && lastClickType === ent.type) {
        const [x0, y0] = Render.toWorld(0, 0), [x1, y1] = Render.toWorld(Render.w, Render.h);
        select(G.units.filter(u => !u.dead && !u.inside && u.owner === 1 && u.type === ent.type && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1), add);
      } else if (ent) {
        if (add && ent.owner === 1 && ent instanceof Unit && G.selection.includes(ent)) { G.selection = G.selection.filter(s => s !== ent); UI.refresh(); }
        else select([ent], add);
      } else if (!add) select([], false);
      lastClickT = now; lastClickType = ent ? ent.type : null;
    }
    dragStart = null; state.box = null;
  }
  // Right-drag from A to B: the squad forms its arrival line along AB, facing away from where it stands.
  function finishLine() {
    const r = state.rdrag; state.rdrag = null; const units = selectedUnits(); if (!units.length) return;
    if (Math.hypot(state.mouse.x - r.sx, state.mouse.y - r.sy) < 12) { contextOrder(r.wx, r.wy, r.q); return; }
    const mx = (r.wx + r.ex) / 2, my = (r.wy + r.ey) / 2, width = Math.hypot(r.ex - r.wx, r.ey - r.wy);
    let cx = 0, cy = 0; for (const u of units) { cx += u.x; cy += u.y; } cx /= units.length; cy /= units.length;
    let facing = Math.atan2(r.ey - r.wy, r.ex - r.wx) + Math.PI / 2;
    if (Math.cos(facing) * (mx - cx) + Math.sin(facing) * (my - cy) < 0) facing += Math.PI;   // face away from the squad's side
    cmd({ kind: 'move', units: ids(units), x: mx, y: my, queue: r.q, facing, width }); marker(mx, my, '#3c3');
  }
  function contextOrder(wx, wy, q) {
    const units = selectedUnits(); const ent = entityAt(wx, wy);
    if (units.length) {
      if (ent && ent.owner !== 1 && !ent.dead) { cmd({ kind: 'attack', units: ids(units), target: ent.id, queue: q }); marker(ent.x, ent.y, '#c33'); return; }
      if (ent instanceof Building && ent.owner === 1 && ent.def.harvest && ent.built) { const n = cmd({ kind: 'work', units: ids(units), building: ent.id, queue: q }); if (n) Game.toast(n + ' sent to work at the ' + ent.def.name); marker(ent.x, ent.y, '#3c3'); return; }
      if (ent instanceof Unit && ent.owner === 1 && ent.cargo && units.some(u => u !== ent && u.def.cls === 'infantry')) { const n = cmd({ kind: 'board', units: ids(units.filter(u => u !== ent)), target: ent.id, queue: q }); if (n) Game.toast(n + ' boarding the Truck'); marker(ent.x, ent.y, '#3c3'); return; }   // 0.5b: board
      if (canHold(ent)) { const n = cmd({ kind: 'garrison', units: ids(units), building: ent.id, queue: q }); if (n) Game.toast(n + ' heading into the ' + ent.def.name); marker(ent.x, ent.y, '#3c3'); return; }
      const sg = !ent && ownSegAt(wx, wy, false);   // right click on your unfinished line: dig on
      if (sg && !sg.done) { const n = cmd({ kind: 'dig', units: ids(units), seg: sg.id, queue: q }); if (n) Game.toast(n + ' digging'); marker(sg.x, sg.y, '#3c3'); return; }
      cmd({ kind: 'move', units: ids(units), x: wx, y: wy, queue: q }); marker(wx, wy, '#3c3'); return;
    }
    const b = selectedBuilding();
    // Kaan, 0.5a.3: with a gatherer or Depot selected, right click one of your Depots (or the HQ) to link it.
    if (b && (b.def.harvest || b.type === 'depot') && ent instanceof Building && ent.owner === 1 && (ent.type === 'depot' || ent.type === 'hq') && ent !== b) { if (cmd({ kind: 'link', building: b.id, target: ent.id })) { Game.toast('Supply link: ' + ent.def.name); marker(ent.x, ent.y, '#3c3'); } return; }
    // A rally point on one of your squad members makes new units join that squadron (DD E).
    if (b && b.def.produces) { const sq = ent instanceof Unit && ent.owner === 1 && ent.squad ? ent.squad : 0; cmd({ kind: 'rally', building: b.id, x: wx, y: wy, squad: sq }); marker(wx, wy, sq ? '#e0bb45' : '#fff'); if (sq) Game.toast('New units will join squadron ' + sq); }
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
    if (k === 'escape') { if (state.mode !== 'normal') { setMode('normal'); leaveBuild(); } else if (UI.tab === 'build') leaveBuild(true); else select([], false); return; }
    if (k.startsWith('arrow')) { state.keys.add(k); return; }
    if (PAN_KEYS[k] && !e.ctrlKey && !e.metaKey) { state.keys.add(PAN_KEYS[k]); return; }
    if (UI.tab === 'build' && BUILD_KEYS[k] && !e.ctrlKey) { setMode('build', BUILD_KEYS[k]); return; }   // Kaan, 0.5a: B first, then the letter
    const units = selectedUnits(); const b = selectedBuilding(); const p = G.players[1];
    if (b && b.built && b.def.produces && TRAIN_KEYS.includes(k)) {
      const t = trainable(b)[state.trainPage * TRAIN_KEYS.length + TRAIN_KEYS.indexOf(k)];
      if (t) { cmd({ kind: 'enqueue', building: b.id, type: t }); UI.refresh(); }
      return;
    }
    if (b && b.slots && k === 'q') { const n = cmd({ kind: 'unload', building: b.id }); if (n) Game.toast(n + ' left the ' + b.def.name); UI.refresh(); return; }
    if (b && b.def.tower && k === 't') { cmd({ kind: 'upgrade', building: b.id }); UI.refresh(); return; }
    if (units.length) {
      if (k === 'f') { setMode('attack'); return; }
      if (k === 'r') { cmd({ kind: 'hold', units: ids(units), queue: e.shiftKey }); return; }
      if (k === 'g') { cmd({ kind: 'retreat', units: ids(units), queue: e.shiftKey }); return; }
      if (k === 'x') { cmd({ kind: 'stop', units: ids(units) }); return; }
      if (k === 'e') { setMode('work'); return; }
      if (k === 'q' && units.some(u => u.cargo)) { for (const t of units.filter(u => u.cargo)) cmd({ kind: 'unload', building: t.id }); return; }   // 0.5b: unload Trucks
      if (k === 'k' && units.some(u => u.def.labour)) { setMode('fill'); return; }
      if (k === 'v' && units.some(u => Game.canThrow(u))) { setMode('grenade'); return; }
      if (k === 'm' && p.done.has('smoke') && units.some(u => u.stats.weapon && u.stats.weapon.indirect)) { setMode('smoke'); return; }
      if (k === 'c' && p.done.has('demolition') && units.some(u => u.stats.weapon)) { setMode('demolish'); return; }
      if (k === 'l' && p.done.has('flares') && units.some(u => u.stats.weapon && u.stats.weapon.indirect)) { setMode('flare'); return; }   // 0.6
    }
    // 0.5c (free keys): I next idle Worker, O army overview, J jump to the latest "under attack" alert.
    if (k === 'i') { UI.nextIdleWorker(); return; }
    if (k === 'o') { UI.showTab('army'); return; }
    if (k === 'j') { if (G.alert) Render.centerOn(G.alert.x, G.alert.y); else Game.toast('No alerts yet'); return; }
    if (k === 'b') { UI.showTab('build'); return; }
    if (k === 'n') { UI.showTab('research'); return; }
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
      select(G.units.filter(u => !u.dead && !u.inside && u.owner === 1 && u.work == null && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1), false); return;
    }
    const dg = /^Digit([1-9])$/.exec(e.code || '');   // the key's position, so Shift+2 and AZERTY keyboards work
    if (dg) {
      const n = +dg[1];
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); setSquad(n, units); }
      else selectSquad(n, e.shiftKey);
    }
  }

  // Squadrons (DD E): Ctrl+number with 2-12 soldiers selected makes squadron n, replacing it; with
  // nothing selected it clears n. Soldiers leave any squadron they were in (one squadron per soldier).
  function setSquad(n, units) {
    if (!units.length) { if (G.squads[n]) { cmd({ kind: 'squadClear', squad: n }); Game.toast('Squadron ' + n + ' cleared'); } return; }
    if (units.length < Data.SQUAD.min || units.length > Data.SQUAD.max) { Game.toast('A squadron takes ' + Data.SQUAD.min + ' to ' + Data.SQUAD.max + ' soldiers'); return; }
    if (cmd({ kind: 'squadSet', squad: n, units: ids(units) })) Game.toast('Squadron ' + n + ' formed');
  }
  // Select squadron n (key or squadron bar); a second press within 350 ms centres the view on it.
  function selectSquad(n, add = false) {
    const s = G.squads[n]; if (!s) return;
    const g = Game.membersOf(s).filter(u => !u.inside); if (!g.length) return;
    select(g, add);
    if (now() - state.lastGroupT < 350 && state.lastGroupK === n) { let cx = 0, cy = 0; for (const u of g) { cx += u.x; cy += u.y; } Render.centerOn(cx / g.length, cy / g.length); }
    state.lastGroupT = now(); state.lastGroupK = n;
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

  return { init, update, state, setMode, select, selectSquad, setSquad, selectedUnits, selectedBuilding, entityAt, trainable };
})();
