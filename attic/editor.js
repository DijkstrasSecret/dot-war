'use strict';
// In-game map editor: paint elevation and terrain types, place deposits, export and import maps.
const Editor = (() => {
  const { clamp, smoothstep } = Util;
  let active = false;
  const st = { tool: 'raise', size: 5, strength: 4, painting: false, erase: false, flatH: 0, mx: 0, my: 0, depositType: 'metal', lastCell: -1 };
  const TOOLS = [
    ['raise', 'Raise', 'Left drag raises ground, right drag lowers.'],
    ['smooth', 'Smooth', 'Blend heights with neighbours.'],
    ['flatten', 'Flatten', 'Pull ground towards the height where you started dragging.'],
    ['forest', 'Forest', 'Left paints forest, right clears.'],
    ['water', 'Water', 'Left paints water, right clears.'],
    ['swamp', 'Swamp', 'Left paints swamp, right clears.'],
    ['road', 'Road', 'Left drag draws a road line (a road over water is a bridge), right drag erases.'],
    ['deposit', 'Deposit', 'Left click places a deposit, right click removes the nearest.'],
  ];

  function init() {}
  function toggle() {
    active = !active;
    if (active) { st.prevSpeed = G.speed; Game.setSpeed(0); Game.toast('Map editor: simulation paused'); }
    else { Path.invalidate(); Fog.update(0, true); Game.setSpeed(st.prevSpeed || 1); }
    Input.setMode('normal'); UI.refresh();
  }
  function sig() { return st.tool + '|' + st.depositType; }   // size/strength change via the sliders themselves; rebuilding mid-drag would break them
  function adjustBrush(d) { st.size = clamp(st.size + d, 1, 30); UI.refresh(); }
  function key(k) { if (k === '[') adjustBrush(-1); if (k === ']') adjustBrush(1); }

  function mouseDown(wx, wy, right) {
    st.painting = true; st.erase = !!right; st.flatH = Terrain.hAt(wx, wy); st.lastCell = -1;
    if (st.tool === 'deposit') {
      if (right) { let best = null, bd = 60; for (const d of Terrain.deposits) { const dd = Math.hypot(d.x - wx, d.y - wy); if (dd < bd) { bd = dd; best = d; } } if (best) Terrain.deposits.splice(Terrain.deposits.indexOf(best), 1); }
      else Terrain.deposits.push({ type: st.depositType, x: Math.round(wx), y: Math.round(wy), r: 30 });
      const ci = Terrain.cellI(wx), cj = Terrain.cellJ(wy); Terrain.markDirty(ci - 8, cj - 8, ci + 9, cj + 9);
      st.painting = false; return;
    }
    if (st.tool === 'road') {
      const r = roadRadius();
      if (right) { Terrain.eraseRoads(wx, wy, r); dirtyAround(wx, wy, r); }
      else { st.stroke = [[wx, wy]]; Terrain.roads.push(st.stroke); }
      return;
    }
    apply(wx, wy);
  }
  function roadRadius() { return Math.max(8, st.size * Terrain.CELL * 0.5); }
  function dirtyAround(x, y, r) { Terrain.markDirty(Terrain.cellI(x - r) - 1, Terrain.cellJ(y - r) - 1, Terrain.cellI(x + r) + 2, Terrain.cellJ(y + r) + 2); }
  function mouseMove(wx, wy, buttons) {
    st.mx = wx; st.my = wy;
    if (!st.painting || !(buttons & 3)) return;
    if (st.tool === 'road') {
      const r = roadRadius();
      if (st.erase) { Terrain.eraseRoads(wx, wy, r); dirtyAround(wx, wy, r); return; }
      if (!st.stroke) return;
      const last = st.stroke[st.stroke.length - 1]; const d = Math.hypot(wx - last[0], wy - last[1]);
      if (d >= 10) { st.stroke.push([wx, wy]); Terrain.rasterizeRoads(); dirtyAround((wx + last[0]) / 2, (wy + last[1]) / 2, d / 2 + 14); }
      return;
    }
    apply(wx, wy);
  }
  function mouseUp() {
    st.painting = false;
    if (st.stroke) { if (st.stroke.length < 2) { const i = Terrain.roads.indexOf(st.stroke); if (i >= 0) Terrain.roads.splice(i, 1); } st.stroke = null; Terrain.rasterizeRoads(); Path.invalidate(); }
  }

  function apply(wx, wy) {
    const ci = Terrain.cellI(wx), cj = Terrain.cellJ(wy);
    const k0 = cj * Terrain.W + ci;
    const heavy = st.tool === 'forest' || st.tool === 'water' || st.tool === 'swamp' || st.tool === 'road';
    if (heavy && k0 === st.lastCell) return; st.lastCell = k0;
    const W = Terrain.W; const hgt = Terrain.height, type = Terrain.type;
    const r = st.size;
    const sign = st.erase ? -1 : 1;
    const src = st.tool === 'smooth' ? Float32Array.from(hgt) : null;
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      if (!Terrain.inb(i, j)) continue;
      const d = Math.hypot(i - ci, j - cj); if (d > r) continue;
      const f = r <= 1 ? 1 : smoothstep(1 - d / r); const k = j * W + i;
      switch (st.tool) {
        case 'raise': hgt[k] = clamp(hgt[k] + sign * st.strength * 0.5 * f, 0, 400); break;
        case 'smooth': {
          let s = 0, n = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (Terrain.inb(ii, jj)) { s += src[jj * W + ii]; n++; } }
          hgt[k] += (s / n - hgt[k]) * 0.6 * f; break;
        }
        case 'flatten': hgt[k] += (st.flatH - hgt[k]) * 0.5 * f; break;
        case 'forest': if (st.erase) { if (type[k] === Terrain.T_FOREST) type[k] = Terrain.T_OPEN; } else if (type[k] !== Terrain.T_WATER) type[k] = Terrain.T_FOREST; break;
        case 'water': type[k] = st.erase ? (type[k] === Terrain.T_WATER ? Terrain.T_OPEN : type[k]) : Terrain.T_WATER; break;
        case 'swamp': type[k] = st.erase ? (type[k] === Terrain.T_SWAMP ? Terrain.T_OPEN : type[k]) : Terrain.T_SWAMP; break;
      }
    }
    Terrain.markDirty(ci - r - 1, cj - r - 1, ci + r + 2, cj + r + 2);
  }

  function naturalize() {
    const W = Terrain.W, H = Terrain.H, hgt = Terrain.height; const noise = Util.makeNoise((Math.random() * 1e9) | 0);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; hgt[k] = Math.max(0, hgt[k] + (noise.fbm(i / 9, j / 9, 3) - 0.5) * 5 + (noise.fbm(i / 30, j / 30, 2) - 0.5) * 6); }
    Terrain.smoothRegion(0, 0, W, H, 1);
    Terrain.markDirty(0, 0, W, H); Game.toast('Terrain naturalized');
  }
  function exportMap() {
    const data = JSON.stringify(Terrain.toJSON());
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = 'map.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function importMap(file) {
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const o = JSON.parse(rd.result); Terrain.fromJSON(o);
        for (const b of G.buildings) if (!b.dead) Terrain.setBlocked(b.x, b.y, b.w, b.h, true);   // create() cleared the block mask
        Path.init(); Fog.init(); Terrain.markDirty(0, 0, Terrain.W, Terrain.H); Game.toast('Map loaded');
      } catch (e) { Game.toast('Could not read map file'); }
    };
    rd.readAsText(file);
  }

  function drawOverlay(ctx) {
    const r = st.tool === 'road' ? roadRadius() : st.size * Terrain.CELL;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(st.mx, st.my, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    // slope visualisation: shade cells that are impassable for infantry
    const cls = Data.MOVE_CLASSES.infantry; const cam = Render.cam;
    const i0 = Math.max(0, Terrain.cellI(cam.x)), j0 = Math.max(0, Terrain.cellJ(cam.y));
    const i1 = Math.min(Terrain.W - 1, Terrain.cellI(cam.x + Render.w / cam.zoom)), j1 = Math.min(Terrain.H - 1, Terrain.cellJ(cam.y + Render.h / cam.zoom));
    ctx.fillStyle = 'rgba(200,0,0,0.25)';
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * Terrain.W + i; if (Terrain.slope[k] > cls.maxGrade * 1.1 && Terrain.type[k] !== Terrain.T_WATER) ctx.fillRect(i * Terrain.CELL, j * Terrain.CELL, Terrain.CELL, Terrain.CELL); }
  }

  function panel() {
    const { el, btn } = UI;
    const box = el('div');
    box.appendChild(el('h3', null, 'Map editor'));
    box.appendChild(el('div', 'small', 'Paint on the map. Red cells are too steep to walk. Ctrl+wheel or [ ] changes brush size. Press F2 or Esc to return to the game.'));
    const tools = el('div', 'row'); tools.style.marginTop = '8px';
    for (const [id, label, tip] of TOOLS) { const b = btn(label, () => { st.tool = id; UI.refresh(); }, tip); if (st.tool === id) b.classList.add('on'); tools.appendChild(b); }
    box.appendChild(tools);
    const tip = TOOLS.find(t => t[0] === st.tool); box.appendChild(el('div', 'small', tip ? tip[2] : ''));
    const size = el('label', 'ed'); size.appendChild(el('span', null, 'Size ' + st.size));
    const sr = el('input'); sr.type = 'range'; sr.min = 1; sr.max = 30; sr.value = st.size; sr.oninput = () => { st.size = +sr.value; size.firstChild.textContent = 'Size ' + st.size; }; size.appendChild(sr); box.appendChild(size);
    const str = el('label', 'ed'); str.appendChild(el('span', null, 'Strength ' + st.strength));
    const rr = el('input'); rr.type = 'range'; rr.min = 1; rr.max = 20; rr.value = st.strength; rr.oninput = () => { st.strength = +rr.value; str.firstChild.textContent = 'Strength ' + st.strength; }; str.appendChild(rr); box.appendChild(str);
    const dep = el('label', 'ed'); dep.appendChild(el('span', null, 'Deposit type'));
    const sel = el('select'); for (const t of ['metal', 'sulfur', 'rubber', 'oil']) { const o = el('option', null, t); o.value = t; if (t === st.depositType) o.selected = true; sel.appendChild(o); }
    sel.onchange = () => { st.depositType = sel.value; }; dep.appendChild(sel); box.appendChild(dep);
    const row = el('div', 'row'); row.style.marginTop = '10px';
    row.appendChild(btn('Naturalize', naturalize, 'Add subtle noise and smoothing so contours look natural'));
    row.appendChild(btn('Smooth all', () => { Terrain.smoothRegion(0, 0, Terrain.W, Terrain.H, 1); Terrain.markDirty(0, 0, Terrain.W, Terrain.H); }));
    row.appendChild(btn('Export JSON', exportMap));
    const imp = el('input'); imp.type = 'file'; imp.accept = '.json'; imp.style.display = 'none'; imp.onchange = () => { if (imp.files[0]) importMap(imp.files[0]); };
    row.appendChild(btn('Import JSON', () => imp.click())); row.appendChild(imp);
    row.appendChild(btn('Regenerate map', () => { if (confirm('Rebuild the default map and restart the game?')) Main.restart(); }));
    box.appendChild(row);
    const hint = el('div', 'small'); hint.style.marginTop = '8px'; hint.textContent = 'Tip: sketch big shapes with a large Raise brush, then Smooth, then Naturalize. Contour lines every 10 m, bold every 50 m.'; box.appendChild(hint);
    return box;
  }

  return { init, toggle, get active() { return active; }, sig, mouseDown, mouseMove, mouseUp, adjustBrush, key, drawOverlay, panel, naturalize, st };
})();
