'use strict';
// Canvas renderer: terrain cache, decals, entities, projectiles, fog, selection, minimap.
// TODO(patch 0.3): rectangle and triangle unit shapes in drawUnit and drawDecals (corpses) when vehicles arrive.
// TODO(patch 0.7): tile Terrain.cache and the fog canvas for maps larger than about 4000 world units.
const Render = (() => {
  const { clamp, dist } = Util;
  let canvas, ctx, mini, mctx, miniTerrain = null, miniT = 0;
  const cam = { x: 0, y: 0, zoom: 1.4 };
  let w = 0, h = 0;

  function init() {
    canvas = document.getElementById('game'); ctx = canvas.getContext('2d');
    mini = document.getElementById('minimap'); mctx = mini.getContext('2d');
    resize(); window.addEventListener('resize', resize);
  }
  function resize() { w = canvas.clientWidth; h = canvas.clientHeight; canvas.width = w; canvas.height = h; }
  function toWorld(sx, sy) { return [cam.x + sx / cam.zoom, cam.y + sy / cam.zoom]; }
  function toScreen(x, y) { return [(x - cam.x) * cam.zoom, (y - cam.y) * cam.zoom]; }
  function clampCam() {
    const mw = Terrain.W * Terrain.CELL, mh = Terrain.H * Terrain.CELL;
    const vw = w / cam.zoom, vh = h / cam.zoom;
    cam.x = clamp(cam.x, -vw * 0.3, mw - vw * 0.7); cam.y = clamp(cam.y, -vh * 0.3, mh - vh * 0.7);
  }
  function centerOn(x, y) { cam.x = x - w / 2 / cam.zoom; cam.y = y - h / 2 / cam.zoom; clampCam(); }
  function zoomAt(sx, sy, factor) {
    const [wx, wy] = toWorld(sx, sy);
    cam.zoom = clamp(cam.zoom * factor, 0.45, 4);
    cam.x = wx - sx / cam.zoom; cam.y = wy - sy / cam.zoom; clampCam();
  }

  function unitVisible(u) { return !u.inside && (u.owner === 1 || Fog.visible(1, u.x, u.y)); }
  function buildingVisible(b) { return b.owner === 1 || b.seen || Fog.visible(1, b.x, b.y); }

  function drawUnit(u, selected) {
    const col = Data.PLAYER_COLORS[u.owner]; const s = u.size;
    const kick = u.recoil > 0 ? Math.sin(Math.min(1, u.recoil / 0.12) * Math.PI) * 2.2 : 0;   // recoil nudge along the facing
    ctx.save(); ctx.translate(u.x - Math.cos(u.facing) * kick, u.y - Math.sin(u.facing) * kick);
    ctx.fillStyle = col; ctx.strokeStyle = u.suppressed ? '#ffb300' : '#141414'; ctx.lineWidth = u.suppressed ? 1.6 : 1;
    if (u.def.shape === 'square') { ctx.fillRect(-s, -s, 2 * s, 2 * s); ctx.strokeRect(-s, -s, 2 * s, 2 * s); }
    else { ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.moveTo(Math.cos(u.facing) * s * 0.75, Math.sin(u.facing) * s * 0.75); ctx.lineTo(Math.cos(u.facing) * (s + 2.5), Math.sin(u.facing) * (s + 2.5)); ctx.stroke();
    Icons.drawIcon(ctx, u.def.icon, 0, 0, s * 0.64, '#fff');
    if (u.muzzle > 0) { ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(Math.cos(u.facing) * (s + 3.5), Math.sin(u.facing) * (s + 3.5), 2.2, 0, Math.PI * 2); ctx.fill(); }
    if (u.work != null) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s + 2, -s - 2, 3.2, 0, Math.PI * 2); ctx.fill(); Icons.drawIcon(ctx, 'worker', s + 2, -s - 2, 2.2, '#222'); }
    if (u.flee > 0 || u.alertT > 0) {   // "!!" while panicking, "!" when fire starts coming in
      const txt = u.flee > 0 ? '!!' : '!'; const bob = Math.sin((u.flee > 0 ? u.flee : u.alertT) * 14) * 1.2;
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.strokeText(txt, 0, -s - 12 + bob);
      ctx.fillStyle = u.flee > 0 ? '#ff3b2f' : '#ffd230'; ctx.fillText(txt, 0, -s - 12 + bob);
    }
    const hp = u.hp / u.stats.hp;
    if (hp < 1 || selected) {
      const bw = s * 2 + 4;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-bw / 2, -s - 6, bw, 3);
      ctx.fillStyle = hp > 0.5 ? '#5ad65a' : hp > 0.25 ? '#e6c229' : '#d64545'; ctx.fillRect(-bw / 2, -s - 6, bw * hp, 3);
      if (u.stress > 0.15) { ctx.fillStyle = '#ffb000'; ctx.fillRect(-bw / 2, -s - 8.5, bw * u.stress, 2); }
    }
    ctx.restore();
  }
  function drawBuilding(b, selected) {
    const col = Data.PLAYER_COLORS[b.owner];
    ctx.save(); ctx.translate(b.x, b.y);
    const x0 = -b.w / 2, y0 = -b.h / 2;
    ctx.fillStyle = b.built ? '#2a2a2e' : 'rgba(42,42,46,0.35)'; ctx.fillRect(x0, y0, b.w, b.h);
    if (!b.built) { ctx.fillStyle = 'rgba(42,42,46,0.75)'; ctx.fillRect(x0, y0 + b.h * (1 - b.progress), b.w, b.h * b.progress); }
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.strokeRect(x0, y0, b.w, b.h);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 1.5, y0 - 1.5, b.w + 3, b.h + 3);
    if (b.type === 'hq') { ctx.fillStyle = col; ctx.fillRect(x0 + 4, y0 + 4, b.w - 8, 6); }
    Icons.drawIcon(ctx, b.def.icon, 0, 0, Math.min(b.w, b.h) * 0.3, b.built ? '#f2f2f2' : '#aaa');
    if (b.def.harvest && b.built) {
      const n = Game.activeWorkers(b);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(n + '/' + b.def.maxWorkers, b.w / 2 - 3, y0 + 2);
      Icons.drawIcon(ctx, b.def.harvest === 'wood' ? 'wood' : (b.depositType || 'metal'), x0 + 8, y0 + 7, 4, '#ddd');
    }
    if (b.queue.length && b.built) {
      const q = b.queue[0]; const pw = b.w - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x0 + 4, b.h / 2 - 7, pw, 3);
      ctx.fillStyle = '#7fd27f'; ctx.fillRect(x0 + 4, b.h / 2 - 7, pw * q.t / q.total, 3);
    }
    if (b.def.tower && b.built) {
      const lv = b.levelDef; const n = b.garrison.length;
      ctx.fillStyle = '#ffd257'; for (let i = 0; i < b.level; i++) { ctx.beginPath(); ctx.arc(x0 + 5 + i * 6, y0 + 5, 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(n + '/' + (lv.cap + lv.heavy), b.w / 2 - 3, y0 + 2);
      if (b.upgrading) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x0 + 4, b.h / 2 - 7, b.w - 8, 3); ctx.fillStyle = '#ffd257'; ctx.fillRect(x0 + 4, b.h / 2 - 7, (b.w - 8) * b.upgrading.t / b.upgrading.total, 3); }
    }
    const hp = b.hp / b.maxHp;
    if (hp < 1 || selected) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x0, y0 - 7, b.w, 4);
      ctx.fillStyle = hp > 0.5 ? '#5ad65a' : hp > 0.25 ? '#e6c229' : '#d64545'; ctx.fillRect(x0, y0 - 7, b.w * hp, 4);
    }
    if (cam.zoom >= 0.9) {
      ctx.font = '9px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(246,243,230,0.9)'; ctx.strokeText(b.def.name, 0, b.h / 2 + 3);
      ctx.fillStyle = '#222'; ctx.fillText(b.def.name, 0, b.h / 2 + 3);
    }
    ctx.restore();
  }
  function drawSelectionRing(e) {
    ctx.strokeStyle = e.owner === 1 ? '#ffffff' : '#ffdd55'; ctx.lineWidth = 1.5;
    if (e instanceof Unit) { ctx.beginPath(); ctx.arc(e.x, e.y, e.size + 3.5, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.strokeRect(e.x - e.w / 2 - 4, e.y - e.h / 2 - 4, e.w + 8, e.h + 8); }
    if (e instanceof Unit && e.owner === 1 && e.stats.weapon) {   // Workers have no weapon, so no range ring
      const w = e.stats.weapon;
      ctx.strokeStyle = 'rgba(40,60,120,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(e.x, e.y, w.range, 0, Math.PI * 2); ctx.stroke();
      if (w.minRange) { ctx.beginPath(); ctx.arc(e.x, e.y, w.minRange, 0, Math.PI * 2); ctx.stroke(); }
      ctx.setLineDash([]);
      if (e.order && (e.order.type === 'move' || e.order.type === 'attackmove' || e.order.type === 'bombard')) {
        ctx.strokeStyle = e.order.type === 'move' ? 'rgba(40,120,60,0.5)' : 'rgba(200,50,50,0.5)'; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.order.x + (e.order.offx || 0), e.order.y + (e.order.offy || 0)); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }
  function drawProjectile(p) {
    const t = p.t / p.dur;
    if (p.kind === 'bullet') {
      const x = p.x + (p.tx - p.x) * t, y = p.y + (p.ty - p.y) * t;
      const d = Math.hypot(p.tx - p.x, p.ty - p.y) || 1; const dx = (p.tx - p.x) / d, dy = (p.ty - p.y) / d;
      ctx.strokeStyle = 'rgba(60,50,30,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - dx * 4, y - dy * 4); ctx.lineTo(x, y); ctx.stroke();
    } else {
      const x = p.x + (p.tx - p.x) * t, y = p.y + (p.ty - p.y) * t; const lift = Math.sin(Math.PI * t) * p.arc;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x, y - lift, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawEffect(e) {
    const t = e.t / e.dur;
    if (e.kind === 'explosion') {
      ctx.globalAlpha = 1 - t; ctx.fillStyle = '#ff8c2a'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.4 + 0.6 * t), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff2a0'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.35 * (1 - t), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (e.kind === 'death') {
      ctx.globalAlpha = 0.8 * (1 - t); ctx.fillStyle = e.color;
      if (e.shape === 'square') ctx.fillRect(e.x - e.size, e.y - e.size, e.size * 2, e.size * 2);
      else { ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = '#500'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(e.x - e.size, e.y - e.size); ctx.lineTo(e.x + e.size, e.y + e.size); ctx.moveTo(e.x + e.size, e.y - e.size); ctx.lineTo(e.x - e.size, e.y + e.size); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (e.kind === 'shock') {
      ctx.globalAlpha = (1 - t) * 0.7; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * t, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#c33'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * t * 0.6, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (e.kind === 'marker') {
      ctx.globalAlpha = 1 - t; ctx.strokeStyle = e.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, 4 + 10 * t, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  // Blood, splatter and corpses stay on the ground and fade out.
  function drawDecals() {
    for (const d of G.decals) {
      const a = Math.max(0, 1 - d.t / d.life);
      if (d.kind === 'blood') { ctx.globalAlpha = 0.55 * a; ctx.fillStyle = '#7a1212'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); }
      else if (d.kind === 'splat') { ctx.globalAlpha = 0.5 * a; ctx.fillStyle = '#6e0f0f'; for (const b of d.blobs) { ctx.beginPath(); ctx.arc(d.x + b[0], d.y + b[1], b[2], 0, Math.PI * 2); ctx.fill(); } }
      else if (d.kind === 'corpse') {
        ctx.globalAlpha = 0.65 * a; ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.facing); ctx.scale(1.2, 0.75);
        ctx.fillStyle = d.color; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
        if (d.shape === 'square') { ctx.fillRect(-d.size, -d.size, 2 * d.size, 2 * d.size); ctx.strokeRect(-d.size, -d.size, 2 * d.size, 2 * d.size); }
        else { ctx.beginPath(); ctx.arc(0, 0, d.size, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.restore();
        ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = '#2a0808'; ctx.lineWidth = 1.2; const k = d.size * 0.55;
        ctx.beginPath(); ctx.moveTo(d.x - k, d.y - k); ctx.lineTo(d.x + k, d.y + k); ctx.moveTo(d.x + k, d.y - k); ctx.lineTo(d.x - k, d.y + k); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#d9d4c3'; ctx.fillRect(0, 0, w, h);
    ctx.setTransform(cam.zoom, 0, 0, cam.zoom, -cam.x * cam.zoom, -cam.y * cam.zoom);
    const mw = Terrain.W * Terrain.CELL, mh = Terrain.H * Terrain.CELL;
    const vx0 = Math.max(0, Math.floor(cam.x)), vy0 = Math.max(0, Math.floor(cam.y));
    const vx1 = Math.min(mw, Math.ceil(cam.x + w / cam.zoom)), vy1 = Math.min(mh, Math.ceil(cam.y + h / cam.zoom));
    if (vx1 > vx0 && vy1 > vy0) { ctx.imageSmoothingEnabled = cam.zoom < 1; ctx.drawImage(Terrain.cache, vx0, vy0, vx1 - vx0, vy1 - vy0, vx0, vy0, vx1 - vx0, vy1 - vy0); }
    const sel = new Set(G.selection);
    drawDecals();
    for (const b of G.buildings) if (!b.dead && buildingVisible(b)) drawBuilding(b, sel.has(b));
    for (const b of G.buildings) if (!b.dead && b.rally && sel.has(b)) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.rally.x, b.rally.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.rally.x, b.rally.y, 3, 0, Math.PI * 2); ctx.fill(); }
    for (const e of G.selection) if (!e.dead && (e instanceof Unit ? unitVisible(e) : buildingVisible(e))) drawSelectionRing(e);
    for (const u of G.units) if (!u.dead && unitVisible(u)) drawUnit(u, sel.has(u));
    for (const p of G.projectiles) if (Fog.visible(1, p.x + (p.tx - p.x) * p.t / p.dur, p.y + (p.ty - p.y) * p.t / p.dur)) drawProjectile(p);
    for (const e of G.effects) drawEffect(e);
    ctx.globalAlpha = 0.4; ctx.imageSmoothingEnabled = true; ctx.drawImage(Fog.canvas, 0, 0, Terrain.W, Terrain.H, 0, 0, mw, mh); ctx.globalAlpha = 1;
    // build ghost
    const st = Input.state;
    if (st.mode === 'build' && st.buildType) {
      const def = Data.BUILDINGS[st.buildType]; const ok = Game.canPlace(st.buildType, 1, st.mouse.wx, st.mouse.wy);
      ctx.globalAlpha = 0.6; ctx.fillStyle = ok ? '#3a6' : '#c33'; ctx.fillRect(st.mouse.wx - def.w / 2, st.mouse.wy - def.h / 2, def.w, def.h);
      ctx.globalAlpha = 1; Icons.drawIcon(ctx, def.icon, st.mouse.wx, st.mouse.wy, Math.min(def.w, def.h) * 0.3, '#fff');
      if (def.needs === 'forest') { ctx.strokeStyle = 'rgba(0,80,0,0.5)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(st.mouse.wx, st.mouse.wy, 70, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    }
    if (st.mode === 'attack' || st.mode === 'walk' || st.mode === 'work') { ctx.strokeStyle = st.mode === 'attack' ? '#c33' : '#3a3'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(st.mouse.wx, st.mouse.wy, 6, 0, Math.PI * 2); ctx.stroke(); }
    for (const u of G.selection) if (u instanceof Unit && u.queue.length) { ctx.strokeStyle = 'rgba(60,60,60,0.5)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(u.order && u.order.x != null ? u.order.x : u.x, u.order && u.order.y != null ? u.order.y : u.y); for (const o of u.queue) if (o.x != null) ctx.lineTo(o.x, o.y); ctx.stroke(); ctx.setLineDash([]); }
    // screen-space overlays
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (st.box) { const b = st.box; ctx.strokeStyle = '#fff'; ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
    let ty = h - 30;
    ctx.font = '14px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = G.toasts.length - 1; i >= 0; i--) {
      const t = G.toasts[i]; ctx.globalAlpha = Math.min(1, t.t);
      const tw = ctx.measureText(t.msg).width + 24; ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(w / 2 - tw / 2, ty - 12, tw, 24);
      ctx.fillStyle = '#fff'; ctx.fillText(t.msg, w / 2, ty); ty -= 28;
    }
    ctx.globalAlpha = 1;
    const banner = { build: st.buildType ? 'Click to place ' + Data.BUILDINGS[st.buildType].name + ' (right click cancels)' : '', walk: 'Walk: click where to go (hold Shift to queue)', attack: 'Attack: click an enemy or a point (hold Shift to queue)', work: 'Work or garrison: click a Lumber Camp, Mine or Scout Tower' }[st.mode];
    if (banner) { ctx.font = '12px "Segoe UI", Arial, sans-serif'; const bw = ctx.measureText(banner).width + 24; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(w / 2 - bw / 2, 8, bw, 22); ctx.fillStyle = '#fff'; ctx.fillText(banner, w / 2, 19); }
    if (G.speed === 0 && !G.over) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(w / 2 - 50, 40, 100, 26); ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif'; ctx.fillText('PAUSED', w / 2, 53); }
    // terrain readout under the cursor
    if (st.mouse.inside && st.mouse.wx >= 0 && st.mouse.wy >= 0 && st.mouse.wx < mw && st.mouse.wy < mh) {
      const el = Terrain.hAt(st.mouse.wx, st.mouse.wy), tt = Terrain.typeAt(st.mouse.wx, st.mouse.wy);
      const tname = Terrain.roadAt(st.mouse.wx, st.mouse.wy) ? 'Road' : ['Open ground', 'Forest', 'Water', 'Swamp'][tt];
      const txt = 'Elevation ' + el.toFixed(0) + ' m  ·  ' + tname + '  ·  slope ' + Math.round(Terrain.slopeAt(st.mouse.wx, st.mouse.wy) * 100) + '%';
      ctx.font = '12px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'left'; const tw = ctx.measureText(txt).width + 16;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(8, h - 30, tw, 22); ctx.fillStyle = '#fff'; ctx.fillText(txt, 16, h - 19);
    }
    drawMinimap();
  }

  function drawMinimap() {
    const mw = Terrain.W * Terrain.CELL, mh = Terrain.H * Terrain.CELL; const S = mini.width;
    if (!miniTerrain || performance.now() - miniT > 2000) {
      miniT = performance.now();
      if (!miniTerrain) { miniTerrain = document.createElement('canvas'); miniTerrain.width = S; miniTerrain.height = S; }
      const c = miniTerrain.getContext('2d'); c.imageSmoothingEnabled = true; c.drawImage(Terrain.cache, 0, 0, mw, mh, 0, 0, S, S);
    }
    mctx.drawImage(miniTerrain, 0, 0);
    const sx = S / mw, sy = S / mh;
    for (const b of G.buildings) if (!b.dead && buildingVisible(b)) { mctx.fillStyle = Data.PLAYER_COLORS[b.owner]; mctx.fillRect(b.x * sx - 3, b.y * sy - 3, 6, 6); }
    for (const u of G.units) if (!u.dead && unitVisible(u)) { mctx.fillStyle = Data.PLAYER_COLORS[u.owner]; mctx.fillRect(u.x * sx - 1.2, u.y * sy - 1.2, 2.4, 2.4); }
    mctx.globalAlpha = 0.45; mctx.imageSmoothingEnabled = true; mctx.drawImage(Fog.canvas, 0, 0, Terrain.W, Terrain.H, 0, 0, S, S); mctx.globalAlpha = 1;
    mctx.strokeStyle = '#fff'; mctx.lineWidth = 1; mctx.strokeRect(cam.x * sx, cam.y * sy, w / cam.zoom * sx, h / cam.zoom * sy);
  }

  return { init, draw, cam, toWorld, toScreen, clampCam, centerOn, zoomAt, get w() { return w; }, get h() { return h; } };
})();
