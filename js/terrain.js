'use strict';
// Heightmap terrain: sampling, slopes, passability, line of sight, and the topographic renderer.
// TODO(patch 0.6): neutral village buildings as a terrain feature (enterable, cover) drawn as small black rectangles like the reference map.
// TODO(patch 0.7): dirty-region rendering already exists; add tiling of the cache for maps beyond ~4000 world units.
const Terrain = (() => {
  const { clamp, lerp } = Util;
  const CELL = 12;                 // world units per cell (1 world unit ~ 1 metre)
  const T_OPEN = 0, T_FOREST = 1, T_WATER = 2, T_SWAMP = 3;
  const CONTOUR = 10, INDEX_EVERY = 5;
  const COL = {
    bg: '#f6f3e6', forest: '#b7d99b', forestDark: '#9cc482', water: '#a9d2ec', waterLine: '#4f93cc', swamp: '#c9dfe9',
    contour: '#c9a06c', index: '#a1703a', roadFill: '#d23a2e', roadEdge: '#3a2a26', label: '#8b5f2a', deposit: '#333',
  };

  let W = 0, H = 0;
  let height, type, road, slope, blocked, pathMult;   // pathMult: extra route cost of barricades and wire (patch 0.4)
  let deposits = [];
  let roads = [];   // polylines [[x,y],...] in world units; `road` cell mask is rasterised from them
  let cache, cctx;
  let dirty = null;
  let maskCanvas, maskCtx;

  function create(w, h) {
    W = w; H = h;
    height = new Float32Array(w * h); type = new Uint8Array(w * h); road = new Uint8Array(w * h); slope = new Float32Array(w * h); blocked = new Uint8Array(w * h); pathMult = new Float64Array(w * h).fill(1);
    deposits = []; roads = [];
    cache = document.createElement('canvas'); cache.width = w * CELL; cache.height = h * CELL; cctx = cache.getContext('2d');
    maskCanvas = document.createElement('canvas'); maskCanvas.width = w; maskCanvas.height = h; maskCtx = maskCanvas.getContext('2d');
    dirty = { x0: 0, y0: 0, x1: w, y1: h };
  }
  function toJSON() {
    return { w: W, h: H, height: Array.from(height, v => Math.round(v * 10) / 10), type: Array.from(type), road: Array.from(road), deposits: deposits.map(d => ({ ...d })), roads: roads.map(p => p.map(q => [Math.round(q[0]), Math.round(q[1])])) };
  }
  function fromJSON(o) {
    create(o.w, o.h);
    height.set(o.height); type.set(o.type); deposits = (o.deposits || []).map(d => ({ ...d }));
    if (o.roads) { roads = o.roads.map(p => p.map(q => [q[0], q[1]])); rasterizeRoads(); } else if (o.road) road.set(o.road);
    recomputeDerived();
  }
  // Fill the road cell mask from the polylines (cells within ~half a cell of a road line).
  function rasterizeRoads() {
    road.fill(0);
    for (const poly of roads) {
      for (let n = 0; n < poly.length; n++) {
        const [ax, ay] = poly[n]; const [bx, by] = poly[Math.min(n + 1, poly.length - 1)];
        const len = Math.hypot(bx - ax, by - ay); const steps = Math.max(1, Math.ceil(len / 4));
        for (let s = 0; s <= steps; s++) {
          const x = ax + (bx - ax) * s / steps, y = ay + (by - ay) * s / steps;
          const ci = cellI(x), cj = cellJ(y);
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const i = ci + di, j = cj + dj; if (!inb(i, j)) continue;
            if (Math.hypot(cx(i) - x, cy(j) - y) <= 9) road[j * W + i] = 1;   // 9 keeps diagonal roads 4-connected (no corner cutting in the field)
          }
        }
      }
    }
  }
  // Remove road points within radius of (x,y), splitting polylines where needed.
  function eraseRoads(x, y, r) {
    const out = [];
    for (const poly of roads) {
      let run = [];
      for (const p of poly) {
        if (Math.hypot(p[0] - x, p[1] - y) <= r) { if (run.length >= 2) out.push(run); run = []; }
        else run.push(p);
      }
      if (run.length >= 2) out.push(run);
    }
    roads = out; rasterizeRoads();
  }

  // Built roads and bridges (patch 0.5a): add or remove one polyline and redraw around it.
  function roadDirty(poly) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of poly) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); } markDirty(cellI(x0) - 3, cellJ(y0) - 3, cellI(x1) + 4, cellJ(y1) + 4); }
  function addRoad(poly) { roads.push(poly); rasterizeRoads(); roadDirty(poly); return poly; }
  function removeRoad(poly) { const i = roads.indexOf(poly); if (i < 0) return; roads.splice(i, 1); rasterizeRoads(); roadDirty(poly); }
  const idx = (i, j) => j * W + i;
  const inb = (i, j) => i >= 0 && j >= 0 && i < W && j < H;
  const cellI = x => clamp(Math.floor(x / CELL), 0, W - 1);
  const cellJ = y => clamp(Math.floor(y / CELL), 0, H - 1);
  const cellIdxAt = (x, y) => cellJ(y) * W + cellI(x);
  const cx = i => (i + 0.5) * CELL;
  const cy = j => (j + 0.5) * CELL;

  function hAt(x, y) {
    const fx = x / CELL - 0.5, fy = y / CELL - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = fx - i, ty = fy - j;
    const i0 = clamp(i, 0, W - 1), i1 = clamp(i + 1, 0, W - 1), j0 = clamp(j, 0, H - 1), j1 = clamp(j + 1, 0, H - 1);
    const r0 = j0 * W, r1 = j1 * W;
    return lerp(lerp(height[r0 + i0], height[r0 + i1], tx), lerp(height[r1 + i0], height[r1 + i1], tx), ty);
  }
  function gradAt(x, y) {
    const e = CELL * 0.5;
    return [(hAt(x + e, y) - hAt(x - e, y)) / (2 * e), (hAt(x, y + e) - hAt(x, y - e)) / (2 * e)];
  }
  function typeAt(x, y) { return type[cellIdxAt(x, y)]; }
  function roadAt(x, y) { return road[cellIdxAt(x, y)]; }
  function slopeAt(x, y) { return slope[cellIdxAt(x, y)]; }

  function recomputeDerived(r) {
    const x0 = r ? Math.max(0, r.x0 - 1) : 0, y0 = r ? Math.max(0, r.y0 - 1) : 0, x1 = r ? Math.min(W, r.x1 + 1) : W, y1 = r ? Math.min(H, r.y1 + 1) : H;
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
      const il = Math.max(0, i - 1), ir = Math.min(W - 1, i + 1), ju = Math.max(0, j - 1), jd = Math.min(H - 1, j + 1);
      const gx = (height[j * W + ir] - height[j * W + il]) / ((ir - il) * CELL);
      const gy = (height[jd * W + i] - height[ju * W + i]) / ((jd - ju) * CELL);
      slope[j * W + i] = Math.hypot(gx, gy);
    }
  }

  // ---- movement ----
  function setBlocked(x, y, w, h, val) {
    const i0 = cellI(x - w / 2 + 1), i1 = cellI(x + w / 2 - 1), j0 = cellJ(y - h / 2 + 1), j1 = cellJ(y + h / 2 - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * W + i] = val ? 1 : 0;
  }
  function cellPassable(k, cls) {
    if (blocked[k]) return false;
    if (road[k]) return true;               // roads are engineered: always walkable, bridges over water included
    const t = type[k];
    if (t === T_WATER) return false;
    return slope[k] <= cls.maxGrade * 1.1;
  }
  function terrainFactor(k, cls) {
    if (road[k]) return cls.road;
    const t = type[k];
    if (t === T_FOREST) return cls.forest;
    if (t === T_SWAMP) return cls.swamp;
    return 1;
  }
  function slopeFactor(grade) { return grade > 0 ? 1 / (1 + 5 * grade) : Math.min(1.25, 1 + 0.8 * -grade); }
  function moveFactor(x, y, dx, dy, cls) {
    const g = gradAt(x, y); const grade = g[0] * dx + g[1] * dy;
    if (Math.abs(grade) > cls.maxGrade * 1.25) return 0;   // the flow field already avoids steep cells; allow local wiggle
    const k = cellIdxAt(x, y);
    if (blocked[k] || (type[k] === T_WATER && !road[k])) return 0;
    return slopeFactor(grade) * terrainFactor(k, cls);
  }
  function edgeCost(from, to, cls, d) {
    if (!cellPassable(to, cls)) return Infinity;
    let grade = (height[to] - height[from]) / d;
    if (road[from] && road[to]) grade = clamp(grade, -cls.maxGrade, cls.maxGrade);   // a road never breaks its own connectivity
    else if (Math.abs(grade) > cls.maxGrade) return Infinity;
    return d * pathMult[to] / (slopeFactor(grade) * terrainFactor(to, cls));
  }
  function setPathMult(k, v) { pathMult[k] = v; }
  function passableAt(x, y, cls) { return cellPassable(cellIdxAt(x, y), cls); }
  // straight-line walkability check used for path smoothing
  function straightPassable(x0, y0, x1, y1, cls) {
    const d = Math.hypot(x1 - x0, y1 - y0); if (d < 1) return true;
    const steps = Math.ceil(d / (CELL * 0.5));
    const dx = (x1 - x0) / d, dy = (y1 - y0) / d;
    let ph = hAt(x0, y0);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const k = cellIdxAt(x, y);
      if (!cellPassable(k, cls)) return false;
      const h = hAt(x, y); const grade = (h - ph) / (d / steps);
      if (Math.abs(grade) > cls.maxGrade) return false;
      ph = h;
    }
    return true;
  }

  // ---- sight ----
  // Line of sight over the heightmap. Relief under LOS_TOLERANCE metres is ignored so micro-bumps do not block;
  // anything the size of a contour step (10 m) does.
  const LOS_TOLERANCE = 2.5;
  function los(x0, y0, x1, y1, eye0 = 2.2, eye1 = 1.8) {
    const d = Math.hypot(x1 - x0, y1 - y0); if (d < CELL) return true;
    const steps = Math.ceil(d / (CELL * 0.5));
    const h0 = hAt(x0, y0) + eye0, h1 = hAt(x1, y1) + eye1;
    let forest = 0;
    for (let s = 1; s < steps; s++) {
      const t = s / steps; const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (hAt(x, y) > h0 + (h1 - h0) * t + LOS_TOLERANCE) return false;
      if (type[cellIdxAt(x, y)] === T_FOREST) { forest++; if (forest * CELL * 0.5 > 36) return false; }
    }
    return true;
  }
  function coverAt(x, y) { const t = type[cellIdxAt(x, y)]; return t === T_FOREST ? 0.55 : 1; }
  // Is a unit at (ux,uy) sheltered from a blast at (bx,by) by a crest in between?
  function ridgeCover(bx, by, ux, uy) {
    const mx = (bx + ux) / 2, my = (by + uy) / 2;
    const hm = hAt(mx, my), hb = hAt(bx, by), hu = hAt(ux, uy);
    return hm > Math.max(hb, hu) + 1.5;
  }

  // ---- queries ----
  function forestCellsNear(x, y, r) {
    let n = 0; const rc = Math.ceil(r / CELL); const ci = cellI(x), cj = cellJ(y);
    for (let j = cj - rc; j <= cj + rc; j++) for (let i = ci - rc; i <= ci + rc; i++) if (inb(i, j) && type[idx(i, j)] === T_FOREST && Math.hypot(cx(i) - x, cy(j) - y) <= r) n++;
    return n;
  }
  function depositNear(x, y, r) { for (const d of deposits) if (Math.hypot(d.x - x, d.y - y) <= r) return d; return null; }
  function areaOk(x, y, w, h, cls, maxGrade) {
    for (let yy = y - h / 2; yy <= y + h / 2; yy += CELL / 2) for (let xx = x - w / 2; xx <= x + w / 2; xx += CELL / 2) {
      if (xx < 0 || yy < 0 || xx >= W * CELL || yy >= H * CELL) return false;
      const k = cellIdxAt(xx, yy);
      if (type[k] === T_WATER) return false;
      if (slope[k] > maxGrade) return false;
    }
    return true;
  }

  // ---- editing ----
  function markDirty(x0, y0, x1, y1) {
    x0 = clamp(x0, 0, W); y0 = clamp(y0, 0, H); x1 = clamp(x1, 0, W); y1 = clamp(y1, 0, H);
    if (!dirty) dirty = { x0, y0, x1, y1 };
    else { dirty.x0 = Math.min(dirty.x0, x0); dirty.y0 = Math.min(dirty.y0, y0); dirty.x1 = Math.max(dirty.x1, x1); dirty.y1 = Math.max(dirty.y1, y1); }
  }
  function flushDirty() {
    if (!dirty) return false;
    const r = dirty; dirty = null;
    recomputeDerived(r);
    renderRegion(r.x0, r.y0, r.x1, r.y1);
    return true;
  }
  function smoothRegion(x0, y0, x1, y1, passes = 1) {
    for (let p = 0; p < passes; p++) {
      const src = Float32Array.from(height);
      for (let j = Math.max(1, y0); j < Math.min(H - 1, y1); j++) for (let i = Math.max(1, x0); i < Math.min(W - 1, x1); i++) {
        let s = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += src[(j + dj) * W + i + di];
        height[j * W + i] = s / 9;
      }
    }
  }

  // ---- rendering ----
  const CASES = [[], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], [[3, 0], [1, 2]], [[0, 2]], [[3, 2]], [[2, 3]], [[0, 2]], [[0, 1], [2, 3]], [[1, 2]], [[1, 3]], [[0, 1]], [[3, 0]], []];
  // Marching squares over a W*H field between cell centres. cb(x0,y0,x1,y1) in world coords.
  function marchingSquares(field, level, ci0, cj0, ci1, cj1, cb) {
    const ix1 = Math.min(W - 2, ci1), jy1 = Math.min(H - 2, cj1);
    for (let j = Math.max(0, cj0); j <= jy1; j++) {
      for (let i = Math.max(0, ci0); i <= ix1; i++) {
        const a = field[j * W + i], b = field[j * W + i + 1], c = field[(j + 1) * W + i + 1], d = field[(j + 1) * W + i];
        const mn = Math.min(a, b, c, d), mx = Math.max(a, b, c, d);
        if (level < mn || level >= mx) continue;
        const code = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
        const segs = CASES[code]; if (!segs.length) continue;
        const pt = e => {
          switch (e) {
            case 0: return [i + (level - a) / (b - a), j];
            case 1: return [i + 1, j + (level - b) / (c - b)];
            case 2: return [i + (level - d) / (c - d), j + 1];
            default: return [i, j + (level - a) / (d - a)];
          }
        };
        for (const [e0, e1] of segs) { const p = pt(e0), q = pt(e1); cb((p[0] + 0.5) * CELL, (p[1] + 0.5) * CELL, (q[0] + 0.5) * CELL, (q[1] + 0.5) * CELL); }
      }
    }
  }
  // Contour lines of `height` for the region, with min/max bucketing per square.
  function drawContours(ctx, ci0, cj0, ci1, cj1) {
    const minor = [], index = new Map();
    const ix1 = Math.min(W - 2, ci1), jy1 = Math.min(H - 2, cj1);
    for (let j = Math.max(0, cj0); j <= jy1; j++) for (let i = Math.max(0, ci0); i <= ix1; i++) {
      const a = height[j * W + i], b = height[j * W + i + 1], c = height[(j + 1) * W + i + 1], d = height[(j + 1) * W + i];
      const mn = Math.min(a, b, c, d), mx = Math.max(a, b, c, d);
      const l0 = Math.floor(mn / CONTOUR) + 1, l1 = Math.floor((mx - 1e-6) / CONTOUR);
      for (let L = l0; L <= l1; L++) {
        const level = L * CONTOUR;
        if (level < mn || level >= mx) continue;
        const code = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
        const segs = CASES[code]; if (!segs.length) continue;
        const pt = e => {
          switch (e) {
            case 0: return [i + (level - a) / (b - a), j];
            case 1: return [i + 1, j + (level - b) / (c - b)];
            case 2: return [i + (level - d) / (c - d), j + 1];
            default: return [i, j + (level - a) / (d - a)];
          }
        };
        const isIndex = L % INDEX_EVERY === 0;
        for (const [e0, e1] of segs) {
          const p = pt(e0), q = pt(e1);
          const seg = [(p[0] + 0.5) * CELL, (p[1] + 0.5) * CELL, (q[0] + 0.5) * CELL, (q[1] + 0.5) * CELL];
          if (isIndex) { if (!index.has(level)) index.set(level, []); index.get(level).push(seg); }
          else minor.push(seg);
        }
      }
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = COL.contour; ctx.lineWidth = 1; ctx.globalAlpha = 0.85;
    ctx.beginPath(); for (const s of minor) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); } ctx.stroke();
    ctx.strokeStyle = COL.index; ctx.lineWidth = 1.8; ctx.globalAlpha = 1;
    ctx.beginPath(); for (const segs of index.values()) for (const s of segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); } ctx.stroke();
    // labels on index contours
    ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [level, segs] of index) {
      for (const chain of chainSegments(segs)) {
        let len = 0; const cum = [0];
        for (let k = 2; k < chain.length; k += 2) { len += Math.hypot(chain[k] - chain[k - 2], chain[k + 1] - chain[k - 1]); cum.push(len); }
        if (len < 220) continue;
        for (let at = 160; at < len - 60; at += 520) {
          let k = 1; while (cum[k] < at) k++;
          const t = (at - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1]);
          const x = lerp(chain[(k - 1) * 2], chain[k * 2], t), y = lerp(chain[(k - 1) * 2 + 1], chain[k * 2 + 1], t);
          let ang = Math.atan2(chain[k * 2 + 1] - chain[(k - 1) * 2 + 1], chain[k * 2] - chain[(k - 1) * 2]);
          if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
          ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
          ctx.lineWidth = 4; ctx.strokeStyle = COL.bg; ctx.strokeText(String(level), 0, 0);
          ctx.fillStyle = COL.label; ctx.fillText(String(level), 0, 0);
          ctx.restore();
        }
      }
    }
  }
  function chainSegments(segs) {
    const key = (x, y) => (Math.round(x * 4)) + ',' + (Math.round(y * 4));
    const ends = new Map(); const used = new Uint8Array(segs.length);
    segs.forEach((s, n) => { for (const k of [key(s[0], s[1]), key(s[2], s[3])]) { if (!ends.has(k)) ends.set(k, []); ends.get(k).push(n); } });
    const chains = [];
    for (let n = 0; n < segs.length; n++) {
      if (used[n]) continue; used[n] = 1;
      let chain = [segs[n][0], segs[n][1], segs[n][2], segs[n][3]];
      for (const dir of [1, -1]) {
        for (;;) {
          const ex = dir === 1 ? chain[chain.length - 2] : chain[0], ey = dir === 1 ? chain[chain.length - 1] : chain[1];
          const cands = ends.get(key(ex, ey)) || []; let next = -1;
          for (const m of cands) if (!used[m]) { next = m; break; }
          if (next < 0) break; used[next] = 1;
          const s = segs[next]; const atStart = key(s[0], s[1]) === key(ex, ey);
          const nx = atStart ? s[2] : s[0], ny = atStart ? s[3] : s[1];
          if (dir === 1) chain.push(nx, ny); else chain.unshift(nx, ny);
        }
      }
      chains.push(chain);
    }
    return chains;
  }
  function drawMaskLayer(ctx, pred, color, alpha = 1) {
    const img = maskCtx.createImageData(W, H); const d = img.data;
    const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
    for (let k = 0; k < W * H; k++) if (pred(k)) { d[k * 4] = r; d[k * 4 + 1] = g; d[k * 4 + 2] = b; d[k * 4 + 3] = 255; }
    maskCtx.putImageData(img, 0, 0);
    ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(maskCanvas, 0, 0, W, H, 0, 0, W * CELL, H * CELL); ctx.restore();
  }
  function drawHillshade(ctx) {
    const img = maskCtx.createImageData(W, H); const d = img.data;
    const lx = -0.55, ly = -0.6, lz = 0.58; const ex = 2.2;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const il = Math.max(0, i - 1), ir = Math.min(W - 1, i + 1), ju = Math.max(0, j - 1), jd = Math.min(H - 1, j + 1);
      const gx = (height[j * W + ir] - height[j * W + il]) / ((ir - il) * CELL) * ex, gy = (height[jd * W + i] - height[ju * W + i]) / ((jd - ju) * CELL) * ex;
      const nl = Math.hypot(gx, gy, 1); const dot = (-gx * lx - gy * ly + lz) / nl;
      const v = clamp(140 + 130 * dot, 0, 255); const k = (j * W + i) * 4;
      d[k] = v; d[k + 1] = v; d[k + 2] = v; d[k + 3] = 255;
    }
    maskCtx.putImageData(img, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.28; ctx.imageSmoothingEnabled = true;
    ctx.drawImage(maskCanvas, 0, 0, W, H, 0, 0, W * CELL, H * CELL); ctx.restore();
  }
  function smoothedMask(pred) {
    const f = new Float32Array(W * H);
    for (let k = 0; k < W * H; k++) f[k] = pred(k) ? 1 : 0;
    const out = new Float32Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (inb(ii, jj)) { s += f[jj * W + ii]; n++; } }
      out[j * W + i] = s / n;
    }
    return out;
  }
  function renderRegion(ci0, cj0, ci1, cj1) {
    const m = 3;
    ci0 = Math.max(0, ci0 - m); cj0 = Math.max(0, cj0 - m); ci1 = Math.min(W, ci1 + m); cj1 = Math.min(H, cj1 + m);
    const ctx = cctx;
    const px = ci0 * CELL, py = cj0 * CELL, pw = (ci1 - ci0) * CELL, ph = (cj1 - cj0) * CELL;
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    ctx.fillStyle = COL.bg; ctx.fillRect(px, py, pw, ph);
    drawMaskLayer(ctx, k => type[k] === T_FOREST, COL.forest);
    drawMaskLayer(ctx, k => type[k] === T_SWAMP, COL.swamp);
    drawMaskLayer(ctx, k => type[k] === T_WATER, COL.water);
    // forest stipple
    ctx.fillStyle = COL.forestDark; ctx.globalAlpha = 0.7;
    for (let j = cj0; j < cj1; j++) for (let i = ci0; i < ci1; i++) if (type[j * W + i] === T_FOREST && ((i * 7 + j * 13) % 5 === 0)) { ctx.beginPath(); ctx.arc(cx(i) + ((i * 31 + j * 17) % 7) - 3, cy(j) + ((i * 13 + j * 29) % 7) - 3, 1.6, 0, Math.PI * 2); ctx.fill(); }
    // swamp tufts
    ctx.strokeStyle = '#6f9ab0'; ctx.lineWidth = 1; ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (let j = cj0; j < cj1; j++) for (let i = ci0; i < ci1; i++) if (type[j * W + i] === T_SWAMP && ((i + j * 3) % 3 === 0)) { const x = cx(i), y = cy(j); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x - 1.5, y - 3); ctx.lineTo(x + 1.5, y - 3); }
    ctx.stroke(); ctx.globalAlpha = 1;
    drawHillshade(ctx);
    // water outline
    const wm = smoothedMask(k => type[k] === T_WATER);
    ctx.strokeStyle = COL.waterLine; ctx.lineWidth = 1.2; ctx.beginPath();
    marchingSquares(wm, 0.5, ci0 - 1, cj0 - 1, ci1, cj1, (x0, y0, x1, y1) => { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); });
    ctx.stroke();
    drawContours(ctx, ci0 - 1, cj0 - 1, ci1, cj1);
    // roads: smooth curves through the polyline points
    for (const [col, w] of [[COL.roadEdge, 4.4], [COL.roadFill, 2.6]]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      for (const p of roads) {
        if (p.length < 2) continue;
        ctx.moveTo(p[0][0], p[0][1]);
        if (p.length === 2) { ctx.lineTo(p[1][0], p[1][1]); continue; }
        for (let n = 1; n < p.length - 1; n++) ctx.quadraticCurveTo(p[n][0], p[n][1], (p[n][0] + p[n + 1][0]) / 2, (p[n][1] + p[n + 1][1]) / 2);
        ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      }
      ctx.stroke();
    }
    // deposits
    for (const d of deposits) {
      ctx.save(); ctx.translate(d.x, d.y);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.strokeStyle = COL.deposit; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, d.r, 0, Math.PI * 2); ctx.fill(); ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
      Icons.drawIcon(ctx, d.type, 0, -2, 9, d.type === 'sulfur' ? '#b8960c' : '#3d3d3d');
      ctx.font = 'bold 10px "Segoe UI", Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = '#333'; ctx.fillText(Data.DEPOSIT_NAMES[d.type] || d.type, 0, 9);
      ctx.restore();
    }
    ctx.restore();
  }

  return {
    CELL, T_OPEN, T_FOREST, T_WATER, T_SWAMP, COL, LOS_TOLERANCE,
    create, toJSON, fromJSON,
    get W() { return W; }, get H() { return H; }, get height() { return height; }, get type() { return type; }, get road() { return road; }, get slope() { return slope; },
    get deposits() { return deposits; }, get roads() { return roads; }, get cache() { return cache; }, rasterizeRoads, eraseRoads, addRoad, removeRoad,
    idx, inb, cellI, cellJ, cellIdxAt, cx, cy, hAt, gradAt, typeAt, roadAt, slopeAt,
    cellPassable, terrainFactor, slopeFactor, moveFactor, edgeCost, passableAt, straightPassable, setBlocked, setPathMult, get blocked() { return blocked; },
    los, coverAt, ridgeCover, forestCellsNear, depositNear, areaOk,
    markDirty, flushDirty, recomputeDerived, smoothRegion, renderRegion,
  };
})();
