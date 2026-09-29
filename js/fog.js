'use strict';
// Fog of war: per-player visibility grids computed by horizon-angle ray casting over the heightmap.
// TODO(patch 0.7): tile the fog canvas with the terrain cache for larger maps; lower the ray multiplier if vision radii grow.
const Fog = (() => {
  const { clamp } = Util;
  let W = 0, H = 0;
  const vis = {};
  let fogCanvas = null, fogCtx = null;
  let timer = 0;
  // Cast results of units and buildings that have not moved since their last cast. The result
  // depends only on position, radius and eye height over static terrain, so reusing it changes
  // nothing; it saves most of the work, since buildings and holding units rarely move.
  let castCache = new WeakMap();
  const INTERVAL = 0.25;
  let minH = 0;   // the map's lowest ground, to bound how far any ray can reach
  const HEIGHT_BONUS = 0.9;   // flat vision bonus at the top of the map's height range (kept, Kaan 0.5b.3)

  function init() {
    W = Terrain.W; H = Terrain.H;
    minH = Infinity; for (let k = 0; k < W * H; k++) if (Terrain.height[k] < minH) minH = Terrain.height[k];
    for (const p of [1, 2]) vis[p] = new Uint8Array(W * H);
    timer = 0; castCache = new WeakMap();   // per match, so a replay starts from the same state
    imageDirty = true;
  }

  // Standing high: a flat bonus by altitude, up to +90% at 300 m. Kaan, 0.5b.3: on top of it, each clear
  // line of sight reaches farther where the ground drops away below the eye (see cast).
  function visionRadius(base, x, y, extraH = 0) {
    const h = Terrain.hAt(x, y) + extraH;
    return base * (1 + clamp(h / 300, 0, 1) * HEIGHT_BONUS);
  }
  const VIS = Data.VISION;
  const reach = drop => drop < VIS.deadZone ? 1 : 1 + Math.min(VIS.max, VIS.perSqrt * Math.sqrt(drop));

  // Cast rays from (x, y) with the eye `eyeH` metres above ground, marking visible cells within r, and
  // farther where the ground drops away below the eye along a clear line (Kaan, 0.5b.3): a point at
  // distance d is seen if d <= r x reach(eye height - ground height there).
  let smokes = [];
  function inSmoke(px, py) { for (const c of smokes) if ((px - c.x) * (px - c.x) + (py - c.y) * (py - c.y) < c.r * c.r) return true; return false; }
  function cast(v, x, y, r, eyeH = 2.2, out = null) {
    const CELL = Terrain.CELL;
    const h0 = Terrain.hAt(x, y) + eyeH, rMax = r * reach(h0 - minH);
    const step = CELL * 0.5, nsteps = Math.ceil(rMax / step), rEdge = Math.ceil(r / step) * step;   // the old last step past r
    const rays = Math.ceil(2 * Math.PI * (r / CELL) * 1.5);
    const type = Terrain.type, T_FOREST = Terrain.T_FOREST;
    const maxX = W * CELL, maxY = H * CELL;
    const tol = 1.8 + Terrain.LOS_TOLERANCE;
    const k0 = Terrain.cellIdxAt(x, y); v[k0] = 1; if (out) out.push(k0);
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
        if ((ht + tol - h0) / d >= maxSlope && (d <= rEdge || d <= r * reach(h0 - ht))) { if (out && !v[k]) out.push(k); v[k] = 1; }
        const sg = (ht - h0) / d; if (sg > maxSlope) maxSlope = sg;
        if (type[k] === T_FOREST) { forest++; if (forest * step > 36) break; }
        if (smokes.length && inSmoke(px, py)) break;   // Smoke Shells: nothing seen in or beyond a cloud
      }
    }
  }

  function buildingVision(b) { const lv = b.levelDef, sl = b.slots; return { range: lv ? lv.vision : b.def.vision, eye: 2.2 + (sl ? sl.height : 0) }; }   // towers and the HQ see from their garrison height

  function castCached(v, e, x, y, r, eye) {
    const c = castCache.get(e);
    if (c && c.x === x && c.y === y && c.r === r && c.eye === eye && c.sv === G.smokeVer) { const cells = c.cells; for (let i = 0; i < cells.length; i++) v[cells[i]] = 1; return; }
    // Record into a fresh grid so the list holds every cell this caster sees, not only new ones.
    scratch.fill(0); const out = []; cast(scratch, x, y, r, eye, out);
    for (let i = 0; i < out.length; i++) v[out[i]] = 1;
    castCache.set(e, { x, y, r, eye, sv: G.smokeVer, cells: Int32Array.from(out) });
  }
  let scratch = null;
  function computeFor(owner) {
    const v = vis[owner]; v.fill(0); smokes = G.smokes || [];
    if (!scratch || scratch.length !== W * H) scratch = new Uint8Array(W * H);
    for (const u of G.units) if (u.owner === owner && !u.dead && !u.inside) castCached(v, u, u.x, u.y, visionRadius(u.stats.vision, u.x, u.y), 2.2);
    for (const b of G.buildings) if (b.owner === owner && !b.dead) { const bv = buildingVision(b); castCached(v, b, b.x, b.y, visionRadius(bv.range, b.x, b.y, bv.eye) * (b.built ? 1 : 0.5), bv.eye); }
  }

  // The fog picture is made only when the renderer asks for it, so the simulation never touches a canvas.
  let imageDirty = true;
  function buildFogImage() {
    if (!fogCanvas || fogCanvas.width !== W || fogCanvas.height !== H) { fogCanvas = document.createElement('canvas'); fogCanvas.width = W; fogCanvas.height = H; fogCtx = fogCanvas.getContext('2d'); }
    imageDirty = false;
    const img = fogCtx.createImageData(W, H); const d = img.data; const v = vis[1];
    for (let k = 0; k < W * H; k++) { const o = k * 4; d[o] = 70; d[o + 1] = 80; d[o + 2] = 100; d[o + 3] = v[k] ? 0 : 255; }
    fogCtx.putImageData(img, 0, 0);
  }

  function update(dt, force) {
    timer -= dt;
    if (timer > 0 && !force) return;
    timer = INTERVAL;
    computeFor(1); computeFor(2);
    imageDirty = true;
  }

  function visible(owner, x, y) {
    if (owner === 0) return true;
    return vis[owner][Terrain.cellIdxAt(x, y)] === 1;
  }

  return { init, update, visible, visionRadius, buildingVision, get canvas() { if (imageDirty) buildFogImage(); return fogCanvas; } };
})();
