'use strict';
// Fog of war: per-player visibility grids computed by horizon-angle ray casting over the heightmap.
// TODO(patch 0.7): tile the fog canvas with the terrain cache for larger maps; lower the ray multiplier if vision radii grow.
const Fog = (() => {
  const { clamp } = Util;
  let W = 0, H = 0;
  const vis = {};
  let fogCanvas = null, fogCtx = null;
  let timer = 0;
  const INTERVAL = 0.25;
  const HEIGHT_BONUS = 0.9;   // vision radius multiplier at the top of the map's height range

  function init() {
    W = Terrain.W; H = Terrain.H;
    for (const p of [1, 2]) vis[p] = new Uint8Array(W * H);
    fogCanvas = document.createElement('canvas'); fogCanvas.width = W; fogCanvas.height = H; fogCtx = fogCanvas.getContext('2d');
  }

  function visionRadius(base, x, y, extraH = 0) {
    const h = Terrain.hAt(x, y) + extraH;
    return base * (1 + clamp(h / 300, 0, 1) * HEIGHT_BONUS);
  }

  // Cast rays from (x, y) with the eye `eyeH` metres above ground, marking visible cells within r.
  function cast(v, x, y, r, eyeH = 2.2) {
    const CELL = Terrain.CELL;
    const step = CELL * 0.5, nsteps = Math.ceil(r / step);
    const rays = Math.ceil(2 * Math.PI * (r / CELL) * 1.5);
    const h0 = Terrain.hAt(x, y) + eyeH;
    const type = Terrain.type, T_FOREST = Terrain.T_FOREST;
    const maxX = W * CELL, maxY = H * CELL;
    const tol = 1.8 + Terrain.LOS_TOLERANCE;
    v[Terrain.cellIdxAt(x, y)] = 1;
    for (let a = 0; a < rays; a++) {
      const ang = a / rays * Math.PI * 2;
      const dx = Math.cos(ang) * step, dy = Math.sin(ang) * step;
      let px = x, py = y, maxSlope = -Infinity, forest = 0;
      for (let s = 1; s <= nsteps; s++) {
        px += dx; py += dy;
        if (px < 0 || py < 0 || px >= maxX || py >= maxY) break;
        const d = s * step;
        const k = Terrain.cellIdxAt(px, py);
        const ht = Terrain.hAt(px, py);
        if ((ht + tol - h0) / d >= maxSlope) v[k] = 1;
        const sg = (ht - h0) / d; if (sg > maxSlope) maxSlope = sg;
        if (type[k] === T_FOREST) { forest++; if (forest * step > 36) break; }
      }
    }
  }

  function buildingVision(b) { const lv = b.levelDef; return { range: lv ? lv.vision : b.def.vision, eye: 2.2 + (lv ? lv.height : 0) }; }

  function computeFor(owner) {
    const v = vis[owner]; v.fill(0);
    for (const u of G.units) if (u.owner === owner && !u.dead && !u.inside) cast(v, u.x, u.y, visionRadius(u.stats.vision, u.x, u.y));
    for (const b of G.buildings) if (b.owner === owner && !b.dead) { const bv = buildingVision(b); cast(v, b.x, b.y, visionRadius(bv.range, b.x, b.y, bv.eye) * (b.built ? 1 : 0.5), bv.eye); }
  }

  function buildFogImage() {
    const img = fogCtx.createImageData(W, H); const d = img.data; const v = vis[1];
    for (let k = 0; k < W * H; k++) { const o = k * 4; d[o] = 70; d[o + 1] = 80; d[o + 2] = 100; d[o + 3] = v[k] ? 0 : 255; }
    fogCtx.putImageData(img, 0, 0);
  }

  function update(dt, force) {
    timer -= dt;
    if (timer > 0 && !force) return;
    timer = INTERVAL;
    computeFor(1); computeFor(2);
    buildFogImage();
  }

  function visible(owner, x, y) {
    if (owner === 0) return true;
    return vis[owner][Terrain.cellIdxAt(x, y)] === 1;
  }

  return { init, update, visible, visionRadius, buildingVision, get canvas() { return fogCanvas; } };
})();
