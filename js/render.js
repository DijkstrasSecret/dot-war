'use strict';
// Canvas renderer: terrain cache, decals, entities, projectiles, fog, selection, minimap.
// TODO(patch 0.3): rectangle and triangle unit shapes in drawUnit and drawDecals (corpses) when vehicles arrive.
const Render = (() => {
  const { clamp, dist } = Util;
  let canvas, ctx, mini, mctx, miniTerrain = null, miniT = 0;
  const cam = { x: 0, y: 0, zoom: 1.4 };
  let w = 0, h = 0;
  let spectator = false;   // Fight Theatre: draw both sides fully, no fog

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

  function unitVisible(u) { return !u.inside && (spectator || u.owner === 1 || (Fog.visible(1, u.x, u.y) && Game.detected(u, 1))); }   // camouflaged infantry in forest stay hidden unless spotted up close
  function buildingVisible(b) { return spectator || b.owner === 1 || b.seen || Fog.visible(1, b.x, b.y); }

  function drawUnit(u, selected) {
    const col = Data.PLAYER_COLORS[u.owner]; const s = u.size;
    const kick = u.recoil > 0 ? Math.sin(Math.min(1, u.recoil / 0.12) * Math.PI) * 2.2 : 0;   // recoil nudge along the facing
    ctx.save(); ctx.translate(u.x - Math.cos(u.facing) * kick, u.y - Math.sin(u.facing) * kick);
    ctx.fillStyle = col; ctx.strokeStyle = u.suppressed ? '#ffb300' : '#141414'; ctx.lineWidth = u.suppressed ? 1.6 : 1;
    if (u.def.shape === 'rect') {   // a Truck: a long box turned to its heading, passengers counted on the back ("x2 ○")
      ctx.save(); ctx.rotate(u.facing); ctx.fillRect(-s * 1.4, -s * 0.8, s * 2.8, s * 1.6); ctx.strokeRect(-s * 1.4, -s * 0.8, s * 2.8, s * 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(s * 0.6, -s * 0.8, s * 0.8, s * 1.6); ctx.restore();
      if (u.cargo && u.cargo.length) { ctx.font = 'bold 8px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#111'; const txt = '×' + u.cargo.length + ' ○'; ctx.strokeText(txt, 0, s + 6); ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, s + 6); }
      if (u.owner === 1 && u.squad && G.squads[u.squad] && Game.squadMarchers(G.squads[u.squad])) { ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.strokeText('!', s * 1.8, -s); ctx.fillStyle = '#ffb000'; ctx.fillText('!', s * 1.8, -s); }   // Kaan, 0.5b.1: some squadmates will march
      if (u.fuel <= 0) { ctx.fillStyle = '#ff5a3a'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('NO FUEL', 0, -s - 10); }
    }
    else if (u.def.shape === 'square') { ctx.fillRect(-s, -s, 2 * s, 2 * s); ctx.strokeRect(-s, -s, 2 * s, 2 * s); }
    else if (u.def.shape === 'tri') {   // 0.8: the armoured car, a triangle pointing where it drives
      ctx.save(); ctx.rotate(u.facing); ctx.beginPath(); ctx.moveTo(s * 1.45, 0); ctx.lineTo(-s, -s * 1.05); ctx.lineTo(-s, s * 1.05); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      if (u.fuel <= 0) { ctx.fillStyle = '#ff5a3a'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('NO FUEL', 0, -s - 10); }
    }
    else { ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.moveTo(Math.cos(u.facing) * s * 0.75, Math.sin(u.facing) * s * 0.75); ctx.lineTo(Math.cos(u.facing) * (s + 2.5), Math.sin(u.facing) * (s + 2.5)); ctx.stroke();
    Icons.drawIcon(ctx, u.def.icon, 0, 0, s * 0.64, '#fff');
    if (u.muzzle > 0) { ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.arc(Math.cos(u.facing) * (s + 3.5), Math.sin(u.facing) * (s + 3.5), 2.2, 0, Math.PI * 2); ctx.fill(); }
    if (u.load) { ctx.fillStyle = Data.RES_COLORS[u.load.k] || '#ccc'; ctx.strokeStyle = '#111'; ctx.lineWidth = 0.8; ctx.fillRect(-s - 4, -2.5, 4.5, 5); ctx.strokeRect(-s - 4, -2.5, 4.5, 5); }   // a carried load
    if (u.work != null || G.time - (u.digT || -9) < 0.3) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s + 2, -s - 2, 3.2, 0, Math.PI * 2); ctx.fill(); Icons.drawIcon(ctx, 'worker', s + 2, -s - 2, 2.2, '#222'); }
    if (u.windup) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-s - 2, -s - 2, 3.2, 0, Math.PI * 2); ctx.fill(); Icons.drawIcon(ctx, 'grenade', -s - 2, -s - 2, 2.2, '#222'); }   // about to throw
    if (u.flee > 0 || u.alertT > 0) {   // "!!" while panicking, "!" when fire starts coming in
      const txt = u.flee > 0 ? '!!' : '!'; const bob = Math.sin((u.flee > 0 ? u.flee : u.alertT) * 14) * 1.2;
      ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = '#111'; ctx.strokeText(txt, 0, -s - 12 + bob);
      ctx.fillStyle = u.flee > 0 ? '#ff3b2f' : '#ffd230'; ctx.fillText(txt, 0, -s - 12 + bob);
    }
    // Rank chevrons under the shape, the squadron number and the leader's star beside it (DD E, H1).
    if (u.rank) { ctx.strokeStyle = '#e0bb45'; ctx.lineWidth = 1.2; for (let i = 0; i < u.rank; i++) { const y0 = s + 3 + i * 2.6; ctx.beginPath(); ctx.moveTo(-3, y0); ctx.lineTo(0, y0 + 1.8); ctx.lineTo(3, y0); ctx.stroke(); } }
    if (u.squad && u.owner === 1) {
      const sq = G.squads[u.squad];
      ctx.font = 'bold 8px Consolas, monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#111'; ctx.strokeText(String(u.squad), -s - 3.5, -s - 1.5); ctx.fillStyle = '#fff'; ctx.fillText(String(u.squad), -s - 3.5, -s - 1.5);
      if (sq && sq.leader === u.id) { ctx.fillStyle = '#e0bb45'; ctx.strokeStyle = '#111'; ctx.lineWidth = 0.8; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 1.4 : 3.2, a = -Math.PI / 2 + i * Math.PI / 5; ctx[i ? 'lineTo' : 'moveTo'](s + 3.5 + Math.cos(a) * r, s + 2 + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); }
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
  // 0.7c: a station's rails run straight to the nearest map edge.
  function railOf(b) {
    if (b.rail) return b.rail;
    const mw = Terrain.W * Terrain.CELL, mh = Terrain.H * Terrain.CELL, opts = [[0, b.y, b.x], [mw, b.y, mw - b.x], [b.x, 0, b.y], [b.x, mh, mh - b.y]].sort((a, c) => a[2] - c[2]);
    return (b.rail = { x: opts[0][0], y: opts[0][1] });
  }
  // 0.7c: buff sites show the capture circle and bar; the Airdrop Zone is a marked field, the station has rails.
  function drawSite(b) {
    const col = Data.PLAYER_COLORS[b.owner], r = Data.SITES.capture.r + b.size * 0.5;
    if (b.def.site === 'station') {
      const e = railOf(b), L = Math.hypot(e.x - b.x, e.y - b.y) || 1, nx = -(e.y - b.y) / L * 3, ny = (e.x - b.x) / L * 3;
      ctx.strokeStyle = '#6b5a48'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (const s of [-1, 1]) { ctx.moveTo(b.x + nx * s, b.y + ny * s); ctx.lineTo(e.x + nx * s, e.y + ny * s); }
      ctx.stroke(); ctx.strokeStyle = 'rgba(107,90,72,0.6)'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let d = 0; d < L; d += 6) { const x = b.x + (e.x - b.x) * d / L, y = b.y + (e.y - b.y) * d / L; ctx.moveTo(x - nx * 1.6, y - ny * 1.6); ctx.lineTo(x + nx * 1.6, y + ny * 1.6); }
      ctx.stroke();
    }
    ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    if (b.def.flat) {
      ctx.fillStyle = 'rgba(246,243,230,0.6)'; ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#e8c640'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x - 10, b.y - 10); ctx.lineTo(b.x + 10, b.y + 10); ctx.moveTo(b.x + 10, b.y - 10); ctx.lineTo(b.x - 10, b.y + 10); ctx.stroke();
    }
    const c = b.cap;
    if (c && c.p > 0 && c.by) {
      const w = Math.max(40, b.w), y = b.y - b.h / 2 - 14;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(b.x - w / 2, y, w, 5);
      ctx.fillStyle = Data.PLAYER_COLORS[c.by]; ctx.fillRect(b.x - w / 2, y, w * Math.min(1, c.p), 5);
    }
  }
  function drawBuilding(b, selected) {
    const col = Data.PLAYER_COLORS[b.owner];
    if (b.def.site) drawSite(b);
    if (b.def.flat) { if (cam.zoom >= 0.9) { ctx.font = '9px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(246,243,230,0.9)'; ctx.strokeText(b.def.name, b.x, b.y + b.h / 2 + 3); ctx.fillStyle = '#222'; ctx.fillText(b.def.name, b.x, b.y + b.h / 2 + 3); } return; }
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
      ctx.fillText(n + '/' + Game.maxWorkers(b), b.w / 2 - 3, y0 + 2);
      Icons.drawIcon(ctx, b.def.harvest === 'wood' ? 'wood' : (b.depositType || 'metal'), x0 + 8, y0 + 7, 4, '#ddd');
    }
    if (b.queue.length && b.built) {
      const q = b.queue[0]; const pw = b.w - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x0 + 4, b.h / 2 - 7, pw, 3);
      ctx.fillStyle = '#7fd27f'; ctx.fillRect(x0 + 4, b.h / 2 - 7, pw * q.t / q.total, 3);
    }
    if (b.slots && b.built && (b.def.tower || b.garrison.length || b.owner === 1)) {   // occupancy; tower level dots
      const n = b.garrison.filter(id => { const g = G.unitById.get(id); return g && !g.dead; }).length;
      ctx.fillStyle = '#ffd257'; if (b.def.levels) for (let i = 0; i < b.level; i++) { ctx.beginPath(); ctx.arc(x0 + 5 + i * 6, y0 + 5, 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      if (b.def.tower || n) ctx.fillText(n + '/' + Game.slotCount(b.slots), b.w / 2 - 3, y0 + (b.type === 'hq' ? 12 : 2));
      if (b.upgrading) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x0 + 4, b.h / 2 - 7, b.w - 8, 3); ctx.fillStyle = '#ffd257'; ctx.fillRect(x0 + 4, b.h / 2 - 7, (b.w - 8) * b.upgrading.t / b.upgrading.total, 3); }
    }
    const hp = b.hp / b.maxHp;
    if ((hp < 1 || selected) && !b.def.invulnerable) {
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
    } else if (e.kind === 'ping') {   // Intelligence: a raid leaving the enemy base
      for (let k = 0; k < 2; k++) { const f = (t * 3 + k * 0.5) % 1; ctx.globalAlpha = (1 - f) * 0.8; ctx.strokeStyle = '#ff5a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 20 + f * 60, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
    } else if (e.kind === 'drop') {   // 0.7c: a supply crate under a parachute
      const f = Math.min(1, t * 1.6), y = e.y - 90 * (1 - f), a = t > 0.7 ? (1 - t) / 0.3 : 1;
      ctx.globalAlpha = a;
      if (f < 1) { ctx.fillStyle = '#f2efe4'; ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(e.x, y - 16, 11, Math.PI, 0); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(e.x - 11, y - 16); ctx.lineTo(e.x - 3, y - 3); ctx.moveTo(e.x + 11, y - 16); ctx.lineTo(e.x + 3, y - 3); ctx.stroke(); }
      ctx.fillStyle = '#8a6a3a'; ctx.fillRect(e.x - 4, y - 4, 8, 7); ctx.globalAlpha = 1;
    } else if (e.kind === 'train') {   // 0.7c: a freight train rolls in along the rails
      const b = G.buildingById.get(e.id); if (!b) return; const r = railOf(b), f = Math.min(1, t / 0.7), L = Math.hypot(r.x - b.x, r.y - b.y) || 1;
      const ux = (b.x - r.x) / L, uy = (b.y - r.y) / L, hx = b.x - ux * 600 * (1 - f), hy = b.y - uy * 600 * (1 - f);
      ctx.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1;
      for (let n = 0; n < 5; n++) { const x = hx - ux * n * 13, y = hy - uy * n * 13; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(uy, ux)); ctx.fillStyle = n ? '#5a4a3a' : '#2a2a2a'; ctx.fillRect(-6, -3.5, 12, 7); ctx.restore(); }
      ctx.globalAlpha = 1;
    } else if (e.kind === 'marker') {
      ctx.globalAlpha = 1 - t; ctx.strokeStyle = e.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, 4 + 10 * t, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  // Line defences (patch 0.4): a planned segment is a dashed outline, a started one fills in as it is
  // dug. Trenches are dark earth, barricades timber with cross braces, wire a zigzag with barbs.
  function strokeSeg(sg, t) { ctx.beginPath(); ctx.moveTo(sg.x0, sg.y0); ctx.lineTo(sg.x0 + (sg.x1 - sg.x0) * t, sg.y0 + (sg.y1 - sg.y0) * t); ctx.stroke(); }
  function drawSeg(sg) {
    if (sg.done && Data.LINES[sg.type].becomesRoad) return;   // finished roads and bridges are drawn with the terrain
    const col = Data.PLAYER_COLORS[sg.owner], t = sg.done ? 1 : sg.progress;
    ctx.lineCap = 'butt';
    if (t < 1) { ctx.strokeStyle = col; ctx.globalAlpha = 0.55; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); strokeSeg(sg, 1); ctx.setLineDash([]); ctx.globalAlpha = 1; }
    if (t > 0) {
      ctx.globalAlpha = sg.done ? 1 : 0.75;
      if (sg.type === 'trench') {
        ctx.strokeStyle = col; ctx.globalAlpha *= 0.45; ctx.lineWidth = 9; strokeSeg(sg, t); ctx.globalAlpha = sg.done ? 1 : 0.75;
        ctx.strokeStyle = '#7a5f3a'; ctx.lineWidth = 7; strokeSeg(sg, t); ctx.strokeStyle = '#3b2d1b'; ctx.lineWidth = 3.5; strokeSeg(sg, t);
      } else if (sg.type === 'barricade') {
        ctx.strokeStyle = '#8a7658'; ctx.lineWidth = 4; strokeSeg(sg, t);
        const L = Math.hypot(sg.x1 - sg.x0, sg.y1 - sg.y0) || 1, ux = (sg.x1 - sg.x0) / L, uy = (sg.y1 - sg.y0) / L;
        ctx.strokeStyle = '#3a2f22'; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let d = 2; d < L * t; d += 4) { const x = sg.x0 + ux * d, y = sg.y0 + uy * d; ctx.moveTo(x - uy * 4 - ux * 1.5, y + ux * 4 - uy * 1.5); ctx.lineTo(x + uy * 4 + ux * 1.5, y - ux * 4 + uy * 1.5); }
        ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 1; strokeSeg(sg, t);
      } else if (Data.LINES[sg.type].becomesRoad) {   // road or bridge under construction
        ctx.strokeStyle = '#3a2a26'; ctx.lineWidth = 4.4; strokeSeg(sg, t); ctx.strokeStyle = sg.type === 'bridge' ? '#8a6a4a' : '#d9a39c'; ctx.lineWidth = 2.6; strokeSeg(sg, t);
      } else {
        const L = Math.hypot(sg.x1 - sg.x0, sg.y1 - sg.y0) || 1, ux = (sg.x1 - sg.x0) / L, uy = (sg.y1 - sg.y0) / L;
        ctx.strokeStyle = '#555'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(sg.x0, sg.y0);
        for (let d = 1.5, k = 0; d <= L * t; d += 1.5, k++) { const o = k % 2 ? 2.5 : -2.5; ctx.lineTo(sg.x0 + ux * d - uy * o, sg.y0 + uy * d + ux * o); }
        ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 0.8; ctx.globalAlpha *= 0.7; strokeSeg(sg, t);
      }
      ctx.globalAlpha = 1;
    }
    if (sg.done && sg.maxHp && sg.hp < sg.maxHp) { ctx.fillStyle = '#d64545'; ctx.fillRect(sg.x - 4, sg.y - 7, 8 * sg.hp / sg.maxHp, 1.5); }
    ctx.lineCap = 'round';
  }

  // Supply chains (0.5a.2): thin lines from gatherers to their drop-off, bolder Depot lines to the HQ,
  // red and dashed while cut.
  function polyline(pts) { ctx.beginPath(); pts.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.stroke(); }
  function drawSupplyLines() {
    for (const b of G.buildings) {
      if (b.dead || !b.route || !(b.owner === 1 || (b.seen && b.def.harvest))) continue;   // enemy carrier lines once their mine is seen
      const col = Data.PLAYER_COLORS[b.owner];
      if (b.def.harvest) { ctx.globalAlpha = 0.45; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); polyline(b.route); }
      else if (b.type === 'depot') {
        ctx.globalAlpha = 0.6; ctx.lineWidth = 2.2;
        if (b.connected) { ctx.strokeStyle = col; ctx.setLineDash([]); } else { ctx.strokeStyle = '#d23a2e'; ctx.setLineDash([6, 4]); }
        polyline(b.route);
      }
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
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
        else if (d.shape === 'rect') { ctx.fillRect(-d.size * 1.4, -d.size * 0.8, d.size * 2.8, d.size * 1.6); ctx.strokeRect(-d.size * 1.4, -d.size * 0.8, d.size * 2.8, d.size * 1.6); }
        else { ctx.beginPath(); ctx.arc(0, 0, d.size, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        ctx.restore();
        ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = '#2a0808'; ctx.lineWidth = 1.2; const k = d.size * 0.55;
        ctx.beginPath(); ctx.moveTo(d.x - k, d.y - k); ctx.lineTo(d.x + k, d.y + k); ctx.moveTo(d.x + k, d.y - k); ctx.lineTo(d.x - k, d.y + k); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // 0.7b: a see-through blob joining each squadron's members, clear when selected, faint otherwise.
  // Drawn on its own canvas so overlaps don't darken: a rim colour first, the fill over it, then the
  // whole layer laid on the map at one opacity. Members join to their nearest squadmate, so a wounded
  // man falling back reads as the blob's tail.
  let blobC = null;
  function drawSquadBlobs(sel) {
    const groups = { on: [], off: [] };
    for (const s of Object.values(G.squads)) {
      const ms = s.members.map(id => G.unitById.get(id)).filter(u => u && !u.dead && !u.inside && unitVisible(u));
      if (ms.length < 2 || (!spectator && ms[0].owner !== 1)) continue;
      groups[ms.some(u => sel.has(u)) ? 'on' : 'off'].push({ s, ms });
    }
    if (!groups.on.length && !groups.off.length) return;
    if (!blobC) blobC = document.createElement('canvas');
    if (blobC.width !== w || blobC.height !== h) { blobC.width = w; blobC.height = h; }
    const b = blobC.getContext('2d');
    // The shape of each blob, grown by `grow` screen pixels: a circle per member and a bar to its nearest squadmate.
    const shape = (list, grow) => {
      for (const { s, ms } of list) {
        const r = Math.max(13, (Data.SQUAD.spacing[s.spacing] || 25) * 0.62) + grow / cam.zoom;
        b.fillStyle = b.strokeStyle = Data.PLAYER_COLORS[ms[0].owner];
        for (const u of ms) {
          b.beginPath(); b.arc(u.x, u.y, r, 0, Math.PI * 2); b.fill();
          let nb = null, nd = 90; for (const v of ms) { if (v === u) continue; const d = dist(u.x, u.y, v.x, v.y); if (d < nd) { nd = d; nb = v; } }
          if (nb) { b.lineWidth = r * 1.5; b.beginPath(); b.moveTo(u.x, u.y); b.lineTo(nb.x, nb.y); b.stroke(); }
        }
      }
    };
    const layer = (fn, alpha) => {
      b.globalCompositeOperation = 'source-over'; b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, w, h);
      b.setTransform(cam.zoom, 0, 0, cam.zoom, -cam.x * cam.zoom, -cam.y * cam.zoom); b.lineCap = 'round';
      fn();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(blobC, 0, 0); ctx.restore();
    };
    for (const [key, fill, rim] of [['off', 0.07, 0.25], ['on', 0.16, 0.75]]) {
      const list = groups[key]; if (!list.length) continue;
      layer(() => shape(list, 0), fill);                                                                  // the body
      layer(() => { shape(list, 1.5); b.globalCompositeOperation = 'destination-out'; shape(list, -1); }, rim);   // the outline only
    }
    b.globalCompositeOperation = 'source-over';
  }
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#d9d4c3'; ctx.fillRect(0, 0, w, h);
    ctx.setTransform(cam.zoom, 0, 0, cam.zoom, -cam.x * cam.zoom, -cam.y * cam.zoom);
    const mw = Terrain.W * Terrain.CELL, mh = Terrain.H * Terrain.CELL;
    const vx0 = Math.max(0, Math.floor(cam.x)), vy0 = Math.max(0, Math.floor(cam.y));
    const vx1 = Math.min(mw, Math.ceil(cam.x + w / cam.zoom)), vy1 = Math.min(mh, Math.ceil(cam.y + h / cam.zoom));
    if (vx1 > vx0 && vy1 > vy0) { ctx.imageSmoothingEnabled = cam.zoom < 1; Terrain.drawView(ctx, vx0, vy0, vx1, vy1); }   // 0.7a: tiles drawn as they come into view
    const sel = new Set(G.selection);
    drawDecals();
    drawSupplyLines();
    drawSquadBlobs(sel);
    for (const sg of G.segs) if (sg.owner === 1 || sg.seen || spectator) drawSeg(sg);
    for (const b of G.buildings) if (!b.dead && buildingVisible(b)) drawBuilding(b, sel.has(b));
    for (const b of G.buildings) if (!b.dead && b.rally && sel.has(b)) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.rally.x, b.rally.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.rally.x, b.rally.y, 3, 0, Math.PI * 2); ctx.fill(); }
    for (const e of G.selection) if (!e.dead && (e instanceof Unit ? unitVisible(e) : buildingVisible(e))) drawSelectionRing(e);
    for (const u of G.units) if (!u.dead && unitVisible(u)) {
      const t = u.def.heal && u.patient;   // a Medic's line to the soldier it is treating
      if (t && !t.dead && t.hp < t.stats.hp && u.owner === 1 && dist(u.x, u.y, t.x, t.y) <= u.def.heal.range) { ctx.strokeStyle = 'rgba(90,214,90,0.7)'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.setLineDash([]); }
      drawUnit(u, sel.has(u));
    }
    for (const p of G.projectiles) if (spectator || Fog.visible(1, p.x + (p.tx - p.x) * p.t / p.dur, p.y + (p.ty - p.y) * p.t / p.dur)) drawProjectile(p);
    for (const e of G.effects) drawEffect(e);
    // Signals: fading markers where enemies were last seen (0.5a); smoke clouds on top of everything below.
    const ls = !spectator && G.lastSeen && G.lastSeen[1];
    if (ls) for (const r of ls.values()) {
      if (G.time - r.t < 0.6) continue;   // still in view
      ctx.globalAlpha = 0.55 * (1 - (G.time - r.t) / 30); ctx.strokeStyle = Data.PLAYER_COLORS[r.owner]; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]);
      if (r.shape === 'square') ctx.strokeRect(r.x - r.size, r.y - r.size, r.size * 2, r.size * 2); else { ctx.beginPath(); ctx.arc(r.x, r.y, r.size, 0, Math.PI * 2); ctx.stroke(); }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    for (const c of G.smokes) {
      const a = Math.min(1, c.t / 1.2, (c.dur - c.t) / 2);
      for (let i = 0; i < 7; i++) { const ang = i * 0.9 + c.t * 0.15, rr = c.r * (i ? 0.55 : 0); ctx.globalAlpha = 0.5 * a; ctx.fillStyle = i % 2 ? '#c9c9c4' : '#b5b5ae'; ctx.beginPath(); ctx.arc(c.x + Math.cos(ang) * rr, c.y + Math.sin(ang) * rr, c.r * (i ? 0.55 : 0.8), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (!spectator) {   // 0.7a: only the visible part of the fog picture
      const C = Terrain.CELL, fi0 = Math.max(0, Math.floor(vx0 / C) - 1), fj0 = Math.max(0, Math.floor(vy0 / C) - 1), fi1 = Math.min(Terrain.W, Math.ceil(vx1 / C) + 1), fj1 = Math.min(Terrain.H, Math.ceil(vy1 / C) + 1);
      if (fi1 > fi0 && fj1 > fj0) { ctx.globalAlpha = 0.4; ctx.imageSmoothingEnabled = true; ctx.drawImage(Fog.canvas, fi0, fj0, fi1 - fi0, fj1 - fj0, fi0 * C, fj0 * C, (fi1 - fi0) * C, (fj1 - fj0) * C); ctx.globalAlpha = 1; }
    }
    // build ghost
    const st = Input.state;
    if (st.mode === 'build' && st.buildType) {
      const def = Data.BUILDINGS[st.buildType]; const ok = Game.canPlace(st.buildType, 1, st.mouse.wx, st.mouse.wy);
      ctx.globalAlpha = 0.6; ctx.fillStyle = ok ? '#3a6' : '#c33'; ctx.fillRect(st.mouse.wx - def.w / 2, st.mouse.wy - def.h / 2, def.w, def.h);
      ctx.globalAlpha = 1; Icons.drawIcon(ctx, def.icon, st.mouse.wx, st.mouse.wy, Math.min(def.w, def.h) * 0.3, '#fff');
      if (def.needs === 'forest') { ctx.strokeStyle = 'rgba(0,80,0,0.5)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(st.mouse.wx, st.mouse.wy, 70, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    }
    if (st.mode === 'line') {   // the line being drawn, ticked every 10 m, with its total cost
      const pts = st.linePts || [[st.mouse.wx, st.mouse.wy]]; const T = Data.LINES[st.lineType];
      let len = 0; for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
      const n = Math.max(pts.length > 1 ? 1 : 0, Math.floor(len / Data.DIG.segment)), cost = {}; for (const k in T.cost) cost[k] = T.cost[k] * n;
      ctx.strokeStyle = Game.canAfford(G.players[1], cost) ? '#3a6' : '#c33'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 3]);
      ctx.beginPath(); pts.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1])); ctx.stroke(); ctx.setLineDash([]);
      if (n) { ctx.font = '10px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(246,243,230,0.9)'; const txt = n * 10 + ' m · ' + Util.costStr(cost); ctx.strokeText(txt, st.mouse.wx + 8, st.mouse.wy - 6); ctx.fillStyle = '#222'; ctx.fillText(txt, st.mouse.wx + 8, st.mouse.wy - 6); }
    }
    if (['attack', 'walk', 'work', 'fill', 'grenade', 'smoke', 'flare', 'demolish'].includes(st.mode)) { ctx.strokeStyle = st.mode === 'attack' || st.mode === 'grenade' || st.mode === 'demolish' ? '#c33' : st.mode === 'smoke' ? '#888' : st.mode === 'flare' ? '#e8c640' : '#3a3'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(st.mouse.wx, st.mouse.wy, 6, 0, Math.PI * 2); ctx.stroke(); }
    for (const u of G.selection) if (u instanceof Unit && u.queue.length) { ctx.strokeStyle = 'rgba(60,60,60,0.5)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(u.order && u.order.x != null ? u.order.x : u.x, u.order && u.order.y != null ? u.order.y : u.y); for (const o of u.queue) if (o.x != null) ctx.lineTo(o.x, o.y); ctx.stroke(); ctx.setLineDash([]); }
    // screen-space overlays
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawEnv();
    if (st.rdrag) { const [x0, y0] = toScreen(st.rdrag.wx, st.rdrag.wy), [x1, y1] = toScreen(st.rdrag.ex, st.rdrag.ey); ctx.strokeStyle = '#3c3'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.setLineDash([]); }   // arrival line being dragged
    if (st.box) { const b = st.box; ctx.strokeStyle = '#fff'; ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
    let ty = h - 30;   // toasts rise from the bottom centre, between the two bottom panels
    ctx.font = '14px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = G.toasts.length - 1; i >= 0; i--) {
      const t = G.toasts[i]; ctx.globalAlpha = Math.min(1, t.t);
      const tw = ctx.measureText(t.msg).width + 24; ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(w / 2 - tw / 2, ty - 12, tw, 24);
      ctx.fillStyle = '#fff'; ctx.fillText(t.msg, w / 2, ty); ty -= 28;
    }
    ctx.globalAlpha = 1;
    const banner = { build: st.buildType ? 'Click to place ' + Data.BUILDINGS[st.buildType].name + ' (right click cancels)' : '', walk: 'Move: click where to go (hold Shift to queue)', attack: 'Attack-move: click an enemy or a point (hold Shift to queue)', work: 'Enter: click a Lumber Camp, Mine, Scout Tower, Bunker or the HQ', link: 'Supply link: click one of your Depots, or the HQ',
      line: st.lineType ? Data.LINES[st.lineType].name + ': hold the left button and drag to draw (right click cancels)' : '', fill: 'Fill: click one of your trenches (Workers only)', grenade: 'Grenade: click an enemy or a point',
      smoke: 'Smoke: click where the mortars should put a smoke screen', demolish: 'Demolition: click a barricade, barbed wire or a bridge' }[st.mode];
    // Below the group bar, which floats at the top centre in the open-map layout.
    if (banner) { ctx.font = '12px "Segoe UI", Arial, sans-serif'; const bw = ctx.measureText(banner).width + 24; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(w / 2 - bw / 2, 66, bw, 22); ctx.fillStyle = '#fff'; ctx.fillText(banner, w / 2, 77); }
    if (G.speed === 0 && !G.over) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(w / 2 - 50, 96, 100, 26); ctx.fillStyle = '#fff'; ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif'; ctx.fillText('PAUSED', w / 2, 109); }
    // terrain readout under the cursor, top left under the resources panel
    if (st.mouse.inside && st.mouse.wx >= 0 && st.mouse.wy >= 0 && st.mouse.wx < mw && st.mouse.wy < mh) {
      const el = Terrain.hAt(st.mouse.wx, st.mouse.wy), tt = Terrain.typeAt(st.mouse.wx, st.mouse.wy);
      const tname = Terrain.roadAt(st.mouse.wx, st.mouse.wy) ? 'Road' : ['Open ground', 'Forest', 'Water', 'Swamp'][tt];
      const txt = 'Elevation ' + el.toFixed(0) + ' m  ·  ' + tname + '  ·  slope ' + Math.round(Terrain.slopeAt(st.mouse.wx, st.mouse.wy) * 100) + '%';
      ctx.font = '12px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'left'; const tw = ctx.measureText(txt).width + 16;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(8, 50, tw, 22); ctx.fillStyle = '#fff'; ctx.fillText(txt, 16, 61);
    }
    drawMinimap();
  }

  // ---- weather and night (patch 0.6), drawn in screen space over the map ----
  // Darkness is painted on its own canvas with holes cut where light falls (flares, searchlight cones,
  // the fires of explosions), then laid over the map. Rain, snow and fog are simple animated layers;
  // their positions come from the clock, so they need no random numbers.
  let darkCv = null, darkCtx = null;
  function drawEnv() {
    const E = G.env; if (!E) return;
    const t = performance.now() / 1000;
    if (E.weather === 'fog') { ctx.fillStyle = 'rgba(226, 228, 222, 0.32)'; ctx.fillRect(0, 0, w, h); }
    if (E.dark > 0) {
      if (!darkCv) { darkCv = document.createElement('canvas'); darkCtx = darkCv.getContext('2d'); }
      if (darkCv.width !== w || darkCv.height !== h) { darkCv.width = w; darkCv.height = h; }
      const d = darkCtx; d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, w, h);
      d.fillStyle = 'rgba(8, 12, 32, ' + (0.62 * E.dark).toFixed(3) + ')'; d.fillRect(0, 0, w, h);
      d.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, a) => { const [sx, sy] = toScreen(x, y), sr = r * cam.zoom; const g = d.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr); g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.beginPath(); d.arc(sx, sy, sr, 0, Math.PI * 2); d.fill(); };
      for (const f of G.flares || []) if (spectator || f.owner === 1 || Fog.visible(1, f.x, f.y)) hole(f.x, f.y, Data.FLARE.radius * (1 - Math.max(0, f.t - Data.FLARE.time + 3) / 3), 0.95);
      for (const e of G.effects) if (e.kind === 'explosion') hole(e.x, e.y, e.r * 2.2, 0.8 * (1 - e.t / e.dur));
      const SL = Data.SEARCHLIGHT;
      for (const b of G.buildings) if (b.lit && (spectator || buildingVisible(b))) {
        const [sx, sy] = toScreen(b.x, b.y), R = SL.range * cam.zoom, g = d.createRadialGradient(sx, sy, 0, sx, sy, R);
        g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g;
        d.beginPath(); d.moveTo(sx, sy); d.arc(sx, sy, R, b.lightDir - SL.cone / 2, b.lightDir + SL.cone / 2); d.closePath(); d.fill();
      }
      for (const u of G.units) if (!u.dead && !u.inside && u.owner === 1 && !spectator) hole(u.x, u.y, 22, 0.35);   // your own soldiers carry a little light
      ctx.drawImage(darkCv, 0, 0);
      for (const f of G.flares || []) if (spectator || f.owner === 1 || Fog.visible(1, f.x, f.y)) { const [sx, sy] = toScreen(f.x, f.y); ctx.fillStyle = 'rgba(255, 244, 200, 0.9)'; ctx.beginPath(); ctx.arc(sx, sy, 3 + Math.sin(t * 20) * 0.6, 0, Math.PI * 2); ctx.fill(); }
    }
    if (E.weather === 'rain') {
      ctx.strokeStyle = 'rgba(70, 90, 120, 0.35)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 220; i++) { const x = ((i * 97.3) % w + t * 60) % w, y = ((i * 57.1) % h + t * (520 + (i % 7) * 30)) % h; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12); }
      ctx.stroke();
    } else if (E.weather === 'snow') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let i = 0; i < 180; i++) { const x = ((i * 83.7) % w + Math.sin(t * 0.8 + i) * 14 + w) % w, y = ((i * 61.3) % h + t * (40 + (i % 5) * 9)) % h; ctx.fillRect(x, y, i % 3 ? 2 : 3, i % 3 ? 2 : 3); }
    }
  }

  function drawMinimap() {
    const mw = Terrain.W * Terrain.CELL, mh = Terrain.H * Terrain.CELL; const S = mini.width;
    if (!miniTerrain || performance.now() - miniT > 2000) {
      miniT = performance.now();
      if (!miniTerrain) { miniTerrain = document.createElement('canvas'); miniTerrain.width = S; miniTerrain.height = S; }
      const c = miniTerrain.getContext('2d'), ov = Terrain.overview; c.imageSmoothingEnabled = true; c.drawImage(ov, 0, 0, ov.width, ov.height, 0, 0, S, S);   // 0.7a: the overview picture
    }
    mctx.drawImage(miniTerrain, 0, 0);
    const sx = S / mw, sy = S / mh;
    for (const b of G.buildings) if (!b.dead && buildingVisible(b)) { mctx.fillStyle = Data.PLAYER_COLORS[b.owner]; mctx.fillRect(b.x * sx - 3, b.y * sy - 3, 6, 6); }
    for (const u of G.units) if (!u.dead && unitVisible(u)) { mctx.fillStyle = Data.PLAYER_COLORS[u.owner]; mctx.fillRect(u.x * sx - 1.2, u.y * sy - 1.2, 2.4, 2.4); }
    if (!spectator) { mctx.globalAlpha = 0.45; mctx.imageSmoothingEnabled = true; mctx.drawImage(Fog.canvas, 0, 0, Terrain.W, Terrain.H, 0, 0, S, S); mctx.globalAlpha = 1; }
    for (const e of G.effects) if (e.kind === 'ping') {   // raid warnings and "under attack" alerts (0.5c) pulse on the minimap too
      const f = (e.t * 1.5) % 1; mctx.globalAlpha = 1 - f; mctx.strokeStyle = '#ff5a3a'; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(e.x * sx, e.y * sy, 4 + f * 16, 0, Math.PI * 2); mctx.stroke();
    }
    mctx.globalAlpha = 1;
    mctx.strokeStyle = '#fff'; mctx.lineWidth = 1; mctx.strokeRect(cam.x * sx, cam.y * sy, w / cam.zoom * sx, h / cam.zoom * sy);
  }

  return { init, draw, cam, toWorld, toScreen, clampCam, centerOn, zoomAt, resize, get w() { return w; }, get h() { return h; }, get spectator() { return spectator; }, set spectator(v) { spectator = !!v; } };
})();
