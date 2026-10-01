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
  // Kaan, 0.5e (faster simulation): a soldier sees from the centre of the map cell he stands in, and
  // casts from the same cell centre, radius and eye height are shared by everyone. Results depend only
  // on those inputs, so the cache changes speed, never the outcome. Cleared per match, when smoke
  // changes, and when it grows past CELL_CACHE_MAX entries.
  const CELL_CACHE_MAX = 4000;
  let cellCache = new Map(), cellCacheVer = -1;
  const HEIGHT_BONUS = 0.9;   // flat vision bonus at the top of the map's height range (kept, Kaan 0.5b.3)

  function init() {
    W = Terrain.W; H = Terrain.H;
    minH = Infinity; for (let k = 0; k < W * H; k++) if (Terrain.height[k] < minH) minH = Terrain.height[k];
    for (const p of [1, 2]) vis[p] = new Uint8Array(W * H);
    timer = 0; castCache = new WeakMap(); cellCache = new Map(); cellCacheVer = -1;   // per match, so a replay starts from the same state
    imageDirty = true;
  }

  // Standing high: a flat bonus by altitude, up to +90% at 300 m. Kaan, 0.5b.3: on top of it, each clear
  // line of sight reaches farther where the ground drops away below the eye (see cast).
  function visionRadius(base, x, y, extraH = 0) {
    const h = Terrain.hAt(x, y) + extraH, w = G.env && Data.WEATHER.kinds[G.env.weather];
    return base * (1 + clamp(h / 300, 0, 1) * HEIGHT_BONUS * ((w && w.heightVision) || 1));   // 0.6: fog halves the height bonus
  }
  const VIS = Data.VISION;
  const reach = drop => drop < VIS.deadZone ? 1 : 1 + Math.min(VIS.max, VIS.perSqrt * Math.sqrt(drop));

  // Cast rays from (x, y) with the eye `eyeH` metres above ground, marking visible cells within r, and
  // farther where the ground drops away below the eye along a clear line (Kaan, 0.5b.3): a point at
  // distance d is seen if d <= r x reach(eye height - ground height there).
  let smokes = [];
  function inSmoke(px, py) { for (const c of smokes) if ((px - c.x) * (px - c.x) + (py - c.y) * (py - c.y) < c.r * c.r) return true; return false; }
  // arc (optional): only rays within arc.half radians of arc.dir, for searchlight cones (0.6).
  function cast(v, x, y, r, eyeH = 2.2, out = null, arc = null) {
    const CELL = Terrain.CELL;
    const h0 = Terrain.hAt(x, y) + eyeH, rMax = r * reach(h0 - minH);
    const step = CELL * 0.5, nsteps = Math.ceil(rMax / step), rEdge = Math.ceil(r / step) * step;   // the old last step past r
    const rays = Math.ceil(2 * Math.PI * (r / CELL) * 1.5);
    const type = Terrain.type, T_FOREST = Terrain.T_FOREST;
    const maxX = W * CELL, maxY = H * CELL;
    const tol = 1.8 + Terrain.LOS_TOLERANCE;
    const k0 = Terrain.cellIdxAt(x, y); v[k0] = 1; if (out) out.push(k0);
    // Speed (Kaan asked for much faster simulations): the cell index and the bilinear height lookup are
    // inlined here with exactly the arithmetic of Terrain.cellIdxAt and Terrain.hAt, so results are identical.
    const hgt = Terrain.height, W1 = W - 1, H1 = H - 1;
    for (let a = 0; a < rays; a++) {
      const ang = a / rays * Math.PI * 2;
      if (arc) { let da = ang - arc.dir; da -= Math.round(da / (Math.PI * 2)) * Math.PI * 2; if (Math.abs(da) > arc.half) continue; }
      const dx = Math.cos(ang) * step, dy = Math.sin(ang) * step;
      let px = x, py = y, maxSlope = -Infinity, forest = 0;
      for (let s = 1; s <= nsteps; s++) {
        px += dx; py += dy;
        if (px < 0 || py < 0 || px >= maxX || py >= maxY) break;
        const d = s * step;
        const k = Math.floor(py / CELL) * W + Math.floor(px / CELL);   // in bounds here, so no clamp needed
        const fx = px / CELL - 0.5, fy = py / CELL - 0.5, fi = Math.floor(fx), fj = Math.floor(fy), tx = fx - fi, ty = fy - fj;
        const i0 = fi < 0 ? 0 : fi > W1 ? W1 : fi, i1 = fi + 1 < 0 ? 0 : fi + 1 > W1 ? W1 : fi + 1;
        const r0 = (fj < 0 ? 0 : fj > H1 ? H1 : fj) * W, r1 = (fj + 1 < 0 ? 0 : fj + 1 > H1 ? H1 : fj + 1) * W;
        const a0 = hgt[r0 + i0], b0 = hgt[r1 + i0], l0 = a0 + (hgt[r0 + i1] - a0) * tx, l1 = b0 + (hgt[r1 + i1] - b0) * tx;
        const ht = l0 + (l1 - l0) * ty;
        if ((ht + tol - h0) / d >= maxSlope && (d <= rEdge || d <= r * reach(h0 - ht))) { if (out && !v[k]) out.push(k); v[k] = 1; }
        const sg = (ht - h0) / d; if (sg > maxSlope) maxSlope = sg;
        if (type[k] === T_FOREST) { forest++; if (forest * step > 36) break; }
        if (smokes.length && inSmoke(px, py)) break;   // Smoke Shells: nothing seen in or beyond a cloud
      }
    }
  }

  function buildingVision(b) { const lv = b.levelDef, sl = b.slots; return { range: lv ? lv.vision : b.def.vision, eye: 2.2 + (sl ? sl.height : 0) }; }   // towers and the HQ see from their garrison height

  function castShared(v, x, y, r, eye) {
    if (cellCacheVer !== G.smokeVer || cellCache.size >= CELL_CACHE_MAX) { cellCache.clear(); cellCacheVer = G.smokeVer; }
    const key = x + ',' + y + ',' + r + ',' + eye; let cells = cellCache.get(key);
    if (!cells) { scratch.fill(0); const out = []; cast(scratch, x, y, r, eye, out); cells = Int32Array.from(out); cellCache.set(key, cells); }
    for (let i = 0; i < cells.length; i++) v[cells[i]] = 1;
  }
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
    for (const u of G.units) if (u.owner === owner && !u.dead && !u.inside) {
      const qx = Terrain.cx(Terrain.cellI(u.x)), qy = Terrain.cy(Terrain.cellJ(u.y));   // 0.5e: from the cell centre
      castShared(v, qx, qy, Math.round(visionRadius(u.stats.vision, qx, qy) * Game.envVision(u) - Terrain.CELL / 2), 2.2);   // 0.6: night and weather; half a cell less, since a whole cell counts as seen once a ray reaches it
    }
    const bm = Game.envVision(null);
    for (const b of G.buildings) if (b.owner === owner && !b.dead) { const bv = buildingVision(b); castCached(v, b, b.x, b.y, visionRadius(bv.range, b.x, b.y, bv.eye) * (b.built ? 1 : 0.5) * bm, bv.eye); }
    // 0.6: flares light a circle for their side; lit searchlights sweep a cone; at night a shooter gives
    // himself away for a few seconds, and a lit tower is seen by the enemy from anywhere.
    const F = Data.FLARE, SL = Data.SEARCHLIGHT;
    for (const f of G.flares || []) if (f.owner === owner) castShared(v, Terrain.cx(Terrain.cellI(f.x)), Terrain.cy(Terrain.cellJ(f.y)), F.radius, F.eye);
    for (const b of G.buildings) {
      if (!b.lit) continue;
      if (b.owner === owner) { cast(v, b.x, b.y, SL.range, buildingVision(b).eye, null, { dir: b.lightDir, half: SL.cone / 2 }); }
      else v[Terrain.cellIdxAt(b.x, b.y)] = 1;
    }
    for (const u of G.units) if (u.owner !== owner && u.owner !== 0 && !u.dead && u.revealT > G.time) v[Terrain.cellIdxAt(u.x, u.y)] = 1;
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
    if (owner === 0 || !vis[owner]) return true;   // neutrals and civilians (0.7c) see everything they need
    return vis[owner][Terrain.cellIdxAt(x, y)] === 1;
  }

  return { init, update, visible, visionRadius, buildingVision, get canvas() { if (imageDirty) buildFogImage(); return fogCanvas; } };
})();
