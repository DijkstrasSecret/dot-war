'use strict';
// Map generator driven by specs: a noise base, a mountain with a plateau, hills, carved rivers,
// cut roads, forests, swamps, deposits, creeps and the starting bases. MAPS lists the playable specs.
// TODO(patch 0.6): let the menu also list JSON maps from a maps/ folder once the editor returns (Terrain.fromJSON already exists).
const MapGen = (() => {
  const { clamp, lerp, smoothstep } = Util;
  const SIZE = 200, MAPW = SIZE * Terrain.CELL;

  function polyDist(px, py, pts) {
    let best = Infinity, bestT = 0, total = 0; const lens = [];
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); lens.push(l); total += l; }
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy;
      let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
      const d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
      if (d < best) { best = d; bestT = (acc + t * lens[i]) / total; }
      acc += lens[i];
    }
    return [best, bestT];
  }
  function samplePoly(pts, step) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1]; const l = Math.hypot(bx - ax, by - ay); const n = Math.max(1, Math.ceil(l / step));
      for (let s = 0; s < n; s++) out.push([ax + (bx - ax) * s / n, ay + (by - ay) * s / n]);
    }
    out.push(pts[pts.length - 1]); return out;
  }
  const near = (x, y, c, r) => Math.hypot(x - c[0], y - c[1]) < r;

  // ---- terrain from a spec ----
  function buildTerrain(spec) {
    const W = SIZE, H = SIZE; Terrain.create(W, H);
    const hgt = Terrain.height, type = Terrain.type; const cx = Terrain.cx, cy = Terrain.cy;
    const noise = Util.makeNoise(spec.seed);
    const M = spec.mountain, base = spec.base, tilt = spec.tilt || [0, 0];
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const x = cx(i), y = cy(j);
      let h = 14 + noise.fbm(x / 800, y / 800, 5) * 55 + (noise.fbm(x / 220, y / 220, 3) - 0.5) * 6;
      h += ((tilt[0] >= 0 ? x : MAPW - x) * Math.abs(tilt[0]) + (tilt[1] >= 0 ? y : MAPW - y) * Math.abs(tilt[1])) / (2 * MAPW) * 18;
      if (M) {
        const d = Math.hypot(x - M.c[0], y - M.c[1]);
        let s = d < M.plateau ? 1 : d > M.foot ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (d - M.plateau) / (M.foot - M.plateau));
        s = Math.pow(s, 1.25);
        const ridge = 0.8 + 0.4 * noise.fbm(x / 260 + 3, y / 260 + 7, 3);
        h += M.height * s * (d < M.plateau ? 1 : ridge);
      }
      for (const b of spec.hills) { const d = Math.hypot(x - b.c[0], y - b.c[1]); if (d < b.r) h += b.amt * Math.pow(0.5 + 0.5 * Math.cos(Math.PI * d / b.r), b.pw || 1); }
      if (M) { const d = Math.hypot(x - M.c[0], y - M.c[1]); if (d < M.plateau + 15) h = lerp(M.top + (noise.fbm(x / 90, y / 90, 2) - 0.5) * 6, h, smoothstep(clamp((d - M.plateau + 25) / 40, 0, 1))); }
      hgt[j * W + i] = h;
    }
    // flatten the player base to its own average height
    { let sum = 0, n = 0;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (near(cx(i), cy(j), base, 230)) { sum += hgt[j * W + i]; n++; }
      const baseH = sum / Math.max(1, n);
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const d = Math.hypot(cx(i) - base[0], cy(j) - base[1]); if (d < 230) hgt[j * W + i] = lerp(baseH, hgt[j * W + i], smoothstep(clamp((d - 130) / 100, 0, 1))); } }
    // rivers
    for (const rv of spec.rivers) {
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const x = cx(i), y = cy(j); const [d, t] = polyDist(x, y, rv.pts);
        if (d > 60) continue;
        const bed = rv.bed[0] + (rv.bed[1] - rv.bed[0]) * t; const k = j * W + i;
        const wobble = rv.width + noise.fbm(x / 60, y / 60, 2) * 8;
        if (d < wobble) { type[k] = Terrain.T_WATER; hgt[k] = Math.min(hgt[k], bed); }
        else if (hgt[k] > bed) hgt[k] = lerp(bed + 1, hgt[k], smoothstep((d - wobble) / (60 - wobble)));
      }
    }
    // roads: polylines, then relax the grade along them (cuttings)
    for (const poly of spec.roads) Terrain.roads.push(poly.map(p => [p[0], p[1]]));
    Terrain.rasterizeRoads();
    for (const poly of spec.roads) {
      const pts = samplePoly(poly, 5);
      const hs = pts.map(p => Terrain.hAt(p[0], p[1]));
      for (let pass = 0; pass < 6; pass++) {
        for (let n = 1; n < pts.length; n++) { const ds = Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]) || 1; const g = 0.27 * ds; if (hs[n] - hs[n - 1] > g) hs[n] = hs[n - 1] + g; if (hs[n - 1] - hs[n] > g) hs[n - 1] = hs[n] + g; }
        for (let n = pts.length - 1; n > 0; n--) { const ds = Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]) || 1; const g = 0.27 * ds; if (hs[n] - hs[n - 1] > g) hs[n] = hs[n - 1] + g; if (hs[n - 1] - hs[n] > g) hs[n - 1] = hs[n] + g; }
      }
      pts.forEach((p, n) => {
        const ci = Terrain.cellI(p[0]), cj = Terrain.cellJ(p[1]);
        for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
          const i = ci + di, j = cj + dj; if (!Terrain.inb(i, j)) continue;
          const d = Math.hypot(cx(i) - p[0], cy(j) - p[1]); const k = j * W + i;
          // water cells directly under the road form the bridge deck and take the road height
          if (d < 34 && (type[k] !== Terrain.T_WATER || d <= 9.5)) hgt[k] = lerp(hs[n], hgt[k], smoothstep(clamp((d - 9.5) / 24.5, 0, 1)));
        }
      });
    }
    // forests and swamps
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; if (type[k] === Terrain.T_WATER || Terrain.road[k]) continue;
      const x = cx(i), y = cy(j); const h = hgt[k];
      const n = noise.fbm(x / 210 + 11, y / 210 + 5, 4);
      let forest = n > spec.forestThr && h < 215;
      for (const rg of spec.forestRings || []) { const d = Math.hypot(x - rg.c[0], y - rg.c[1]); if (d > rg.inner && d < rg.outer && n > rg.thr) forest = true; if (d < rg.clearInner) forest = false; }
      for (const b of spec.forestBlobs || []) if (near(x, y, b.c, b.r) && n > b.thr) forest = true;
      for (const c of spec.clear || []) if (near(x, y, c.c, c.r)) forest = false;
      if (forest) type[k] = Terrain.T_FOREST;
      for (const sw of spec.swamps || []) {
        if (type[k] !== Terrain.T_OPEN) break;
        if (sw.river != null) { const [dr, tr] = polyDist(x, y, spec.rivers[sw.river].pts); if (tr > sw.tMin && dr < sw.d && h < sw.hMax && noise.fbm(x / 90 + 40, y / 90, 2) > 0.42) type[k] = Terrain.T_SWAMP; }
        else if (near(x, y, sw.c, sw.r) && h < sw.hMax && noise.fbm(x / 70, y / 70, 2) > 0.4) type[k] = Terrain.T_SWAMP;
      }
    }
    for (const s of spec.sites || []) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (near(cx(i), cy(j), s.c, s.r) && type[k] !== Terrain.T_WATER) type[k] = Terrain.T_OPEN; }
    for (const d of spec.deposits) Terrain.deposits.push({ type: d.type, x: d.x, y: d.y, r: 30 });
    Terrain.recomputeDerived();
    Terrain.markDirty(0, 0, W, H);
  }


  // ---- random big maps (patch 0.7a) ----
  // Every match draws a new 13.2 km map from its seed: the player in one corner, the enemy stronghold on
  // a plateau in the opposite one, hills (some with sulfur), one or two rivers, a road network laid along
  // gentle ground with bridges, forests, swamps, contested deposits with neutral guards. The layout
  // (a spec like the hand-made maps) comes from the seed; buildGenerated turns it into terrain.
  const BIG = 1100, BIGW = BIG * Terrain.CELL;
  function generate(seed) {
    const r = Util.mulberry32((seed ^ 0x6a09e667) >>> 0), rnd = (a, b) => a + (b - a) * r(), M = BIGW;
    const corners = [[0.11, 0.89], [0.89, 0.89], [0.89, 0.11], [0.11, 0.11]], q = Math.floor(r() * 4);
    const jit = c => [(c[0] + rnd(-0.025, 0.025)) * M, (c[1] + rnd(-0.025, 0.025)) * M];
    const base = jit(corners[q]), hq2 = jit(corners[(q + 2) % 4]);
    const mid = [M / 2, M / 2], far = (p, list, d) => list.every(o => Math.hypot(p[0] - o[0], p[1] - o[1]) > d);
    const toward = (a, b, d) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + (b[0] - a[0]) / L * d, a[1] + (b[1] - a[1]) / L * d]; };
    const inMap = p => p[0] > 500 && p[1] > 500 && p[0] < M - 500 && p[1] < M - 500;
    const pickSpot = (ok, tries = 400) => { for (let n = 0; n < tries; n++) { const p = [rnd(600, M - 600), rnd(600, M - 600)]; if (ok(p)) return p; } return null; };
    const spec = { id: 'random', name: 'Random map', generated: true, seed: (seed ^ 0x51ed) >>> 0, size: BIG, tilt: [rnd(-1, 1), rnd(-1, 1)], base,
      mountain: { c: hq2, plateau: 175, foot: 820, height: 235, top: 262 }, hills: [], rivers: [], roads: [], deposits: [], creeps: [], sites: [], clear: [], forestBlobs: [], swamps: [] };
    // hills, away from the bases; three carry sulfur on top
    for (let n = 0; n < 60 && spec.hills.length < 13; n++) {
      const c = pickSpot(p => far(p, [base, hq2], 1500) && far(p, spec.hills.map(h => h.c), 1100)); if (!c) break;
      spec.hills.push({ c, r: rnd(260, 480), amt: rnd(30, 95), pw: rnd(0.9, 1.3) });
    }
    // rivers: from one edge to another, winding, kept 900 m from both bases
    const nRiv = r() < 0.6 ? 2 : 1;
    for (let n = 0; n < nRiv; n++) {
      const vertical = r() < 0.5, a = vertical ? [rnd(0.25, 0.75) * M, 0] : [0, rnd(0.25, 0.75) * M], b = vertical ? [rnd(0.25, 0.75) * M, M] : [M, rnd(0.25, 0.75) * M];
      const pts = [a]; let p = a.slice(), heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let k = 0; k < 80; k++) {
        const want = Math.atan2(b[1] - p[1], b[0] - p[0]); heading += Math.max(-0.6, Math.min(0.6, (want - heading))) * 0.35 + rnd(-0.5, 0.5);
        p = [p[0] + Math.cos(heading) * 450, p[1] + Math.sin(heading) * 450];
        for (const o of [base, hq2]) { const d = Math.hypot(p[0] - o[0], p[1] - o[1]); if (d < 900) { p = [o[0] + (p[0] - o[0]) / d * 900, o[1] + (p[1] - o[1]) / d * 900]; } }
        pts.push(p.slice()); if (Math.hypot(b[0] - p[0], b[1] - p[1]) < 450 || p[0] < -200 || p[1] < -200 || p[0] > M + 200 || p[1] > M + 200) break;
      }
      pts.push(b); spec.rivers.push({ pts, bed: [rnd(45, 60), rnd(10, 16)], width: rnd(12, 17) });
    }
    // deposits: iron and a forest near each base, the enemy's sulfur mine by its HQ, then contested ones
    const dep = [], add = (type, p) => { dep.push({ type, x: Math.round(p[0]), y: Math.round(p[1]) }); spec.sites.push({ c: p, r: 45 }); };
    const nearBase = (o, d0, d1, away) => pickSpot(p => { const d = Math.hypot(p[0] - o[0], p[1] - o[1]); return d > d0 && d < d1 && far(p, dep.map(e => [e.x, e.y]), 300) && (!away || Math.hypot(p[0] - away[0], p[1] - away[1]) > d + 200); }, 800) || toward(o, mid, (d0 + d1) / 2);
    add('metal', nearBase(base, 450, 750, null));
    add('metal', nearBase(hq2, 550, 850, null));
    const aiSulfur = toward(hq2, [hq2[0] + (hq2[0] < M / 2 ? -1 : 1) * 200, hq2[1] + (hq2[1] < M / 2 ? -1 : 1) * 200], 170); add('sulfur', aiSulfur);
    spec.forestBlobs.push({ c: nearBase(base, 280, 450, null), r: 170, thr: 0.3 }, { c: nearBase(hq2, 900, 1200, null), r: 170, thr: 0.33 });
    const contested = [['metal', 5], ['sulfur', 1], ['rubber', 2], ['oil', 2]];
    for (const h of spec.hills.slice(0, 3)) { add('sulfur', h.c); spec.creeps.push({ c: [h.c[0], h.c[1] - 20], r: 45, units: ['rifle', 'rifle', 'rifle', 'rifle', r() < 0.5 ? 'hmg' : 'rifle'] }); }
    for (const [type, n] of contested) for (let k = 0; k < n; k++) {
      const p = pickSpot(pp => far(pp, [base, hq2], 1600) && far(pp, dep.map(e => [e.x, e.y]), 950)); if (!p) continue;
      add(type, p); if (type === 'metal' || r() < 0.5) spec.creeps.push({ c: [p[0] + 25, p[1] - 30], r: 25, units: ['rifle', 'rifle', 'rifle'].concat(r() < 0.3 ? ['hmg'] : []) });
    }
    spec.deposits = dep;
    spec.clear.push({ c: base, r: 120 }, { c: hq2, r: 200 });
    for (const rv of spec.rivers) spec.swamps.push({ river: spec.rivers.indexOf(rv), tMin: rnd(0.3, 0.7), d: 90, hMax: 30 });
    spec.forestThr = rnd(0.57, 0.62);
    // the enemy base, laid out like Highland Pass's and turned to face the map centre
    const ang = Math.atan2(mid[1] - hq2[1], mid[0] - hq2[0]) - Math.atan2(170, 0);
    const rot = (dx, dy) => [Math.round(hq2[0] + dx * Math.cos(ang) - dy * Math.sin(ang)), Math.round(hq2[1] + dx * Math.sin(ang) + dy * Math.cos(ang))];
    const bk = rot(90, 90), od = rot(-90, 100), gc = rot(0, 170);
    spec.ai = { hq: [Math.round(hq2[0]), Math.round(hq2[1])], buildings: [{ type: 'barracks', x: bk[0], y: bk[1] }, { type: 'ordnance', x: od[0], y: od[1] }, { type: 'mine', x: Math.round(aiSulfur[0]), y: Math.round(aiSulfur[1]) }],
      garrisonCenter: gc, garrison: HIGHLAND.ai.garrison.slice() };
    spec.sites.push({ c: hq2, r: 70 }, { c: bk, r: 40 }, { c: od, r: 40 });
    spec.desc = 'A new 13 km map every game: the enemy holds a plateau in the far corner.';
    spec.hint = 'Scout for forest and iron near your base; the enemy is about 10 km away.';
    return spec;
  }

  // Terrain for a generated spec. Same ingredients as buildTerrain, done with stamps instead of
  // whole-map distance loops so a 1100 x 1100 map builds in a few seconds.
  function buildGenerated(spec) {
    const N = BIG; Terrain.create(N, N); Terrain.roadWidth = 14;   // Kaan, 0.7: wider roads
    const hgt = Terrain.height, type = Terrain.type, cx = Terrain.cx, cy = Terrain.cy, C = Terrain.CELL;
    const noise = Util.makeNoise(spec.seed), M = spec.mountain, base = spec.base, tilt = spec.tilt;
    // Smooth, large shapes are sampled every `step` cells and blended between (much cheaper than per cell).
    const coarse = (step, fn) => {
      const G = Math.ceil(N / step) + 1, g = new Float32Array(G * G), out = new Float32Array(N * N);
      for (let gj = 0; gj < G; gj++) for (let gi = 0; gi < G; gi++) g[gj * G + gi] = fn(cx(gi * step), cy(gj * step));
      for (let j = 0; j < N; j++) { const fj = j / step, j0 = Math.floor(fj), tj = fj - j0; for (let i = 0; i < N; i++) { const fi = i / step, i0 = Math.floor(fi), ti = fi - i0, a = g[j0 * G + i0], b = g[j0 * G + i0 + 1], c = g[(j0 + 1) * G + i0], d = g[(j0 + 1) * G + i0 + 1]; out[j * N + i] = (a + (b - a) * ti) + ((c + (d - c) * ti) - (a + (b - a) * ti)) * tj; } }
      return out;
    };
    const detail = coarse(2, (x, y) => noise.fbm(x / 160, y / 160, 2));
    const big = coarse(4, (x, y) => 14 + noise.fbm(x / 1700, y / 1700, 4) * 70 + (noise.fbm(x / 420, y / 420, 3) - 0.5) * 18);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = cx(i), y = cy(j);
      let h = big[j * N + i] + (detail[j * N + i] - 0.5) * 5;
      h += ((tilt[0] >= 0 ? x : BIGW - x) * Math.abs(tilt[0]) + (tilt[1] >= 0 ? y : BIGW - y) * Math.abs(tilt[1])) / (2 * BIGW) * 18;
      hgt[j * N + i] = h;
    }
    const forestN = coarse(2, (x, y) => noise.fbm(x / 210 + 11, y / 210 + 5, 3));
    const stamp = (c, R, fn) => { const i0 = Math.max(0, Math.floor((c[0] - R) / C)), i1 = Math.min(N - 1, Math.ceil((c[0] + R) / C)), j0 = Math.max(0, Math.floor((c[1] - R) / C)), j1 = Math.min(N - 1, Math.ceil((c[1] + R) / C));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const d = Math.hypot(cx(i) - c[0], cy(j) - c[1]); if (d < R) fn(j * N + i, d, cx(i), cy(j)); } };
    for (const b of spec.hills) stamp(b.c, b.r, (k, d) => { hgt[k] += b.amt * Math.pow(0.5 + 0.5 * Math.cos(Math.PI * d / b.r), b.pw || 1); });
    stamp(M.c, M.foot, (k, d, x, y) => {
      let sm = d < M.plateau ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * (d - M.plateau) / (M.foot - M.plateau)); sm = Math.pow(sm, 1.25);
      hgt[k] += M.height * sm * (d < M.plateau ? 1 : 0.8 + 0.4 * noise.fbm(x / 260 + 3, y / 260 + 7, 3));
      if (d < M.plateau + 15) hgt[k] = lerp(M.top + (noise.fbm(x / 90, y / 90, 2) - 0.5) * 6, hgt[k], smoothstep(clamp((d - M.plateau + 25) / 40, 0, 1)));
    });
    { let sum = 0, n = 0; stamp(base, 230, k => { sum += hgt[k]; n++; }); const bh = sum / Math.max(1, n); stamp(base, 230, (k, d) => { hgt[k] = lerp(bh, hgt[k], smoothstep(clamp((d - 130) / 100, 0, 1))); }); }
    // rivers: stamp the bed along the polyline, keeping for each cell its nearest distance and position along the river
    const rdist = new Float32Array(N * N).fill(1e9), rt = new Float32Array(N * N);
    spec.rivers.forEach(rv => {
      let total = 0; const lens = []; for (let n = 0; n < rv.pts.length - 1; n++) { const l = Math.hypot(rv.pts[n + 1][0] - rv.pts[n][0], rv.pts[n + 1][1] - rv.pts[n][1]); lens.push(l); total += l; }
      let acc = 0;
      for (let n = 0; n < rv.pts.length - 1; n++) {
        const [ax, ay] = rv.pts[n], [bx, by] = rv.pts[n + 1], steps = Math.max(1, Math.ceil(lens[n] / 6));
        for (let s = 0; s <= steps; s++) { const t = s / steps, px = ax + (bx - ax) * t, py = ay + (by - ay) * t, tt = (acc + t * lens[n]) / total;
          stamp([px, py], 60, (k, d) => { if (d < rdist[k]) { rdist[k] = d; rt[k] = tt; } }); }
        acc += lens[n];
      }
      for (let k = 0; k < N * N; k++) {
        const d = rdist[k]; if (d > 60 || rdist[k] === 1e9) continue;
        const x = cx(k % N), y = cy((k - k % N) / N), bed = rv.bed[0] + (rv.bed[1] - rv.bed[0]) * rt[k], wob = rv.width + noise.fbm(x / 60, y / 60, 2) * 8;
        if (d < wob) { type[k] = Terrain.T_WATER; hgt[k] = Math.min(hgt[k], bed); continue; }
        if (hgt[k] > bed) hgt[k] = lerp(bed + 1, hgt[k], smoothstep((d - wob) / (60 - wob)));
        if (d < 58 && rt[k] > 0.45 && hgt[k] < rv.bed[1] + 18 && noise.fbm(x / 90 + 40, y / 90, 2) > 0.45) type[k] = Terrain.T_SWAMP;   // the lower reaches grow marshy banks
      }
      rdist.fill(1e9);
    });
    // forests and swamps
    for (let k = 0; k < N * N; k++) {
      if (type[k] === Terrain.T_WATER) continue;
      if (forestN[k] > spec.forestThr && hgt[k] < 215) type[k] = Terrain.T_FOREST;
    }
    for (const b of spec.forestBlobs) stamp(b.c, b.r, k => { if (type[k] !== Terrain.T_WATER && forestN[k] > b.thr) type[k] = Terrain.T_FOREST; });
    for (const c of spec.clear.concat(spec.sites)) stamp(c.c, c.r, k => { if (type[k] !== Terrain.T_WATER) type[k] = Terrain.T_OPEN; });
    for (const d of spec.deposits) Terrain.deposits.push({ type: d.type, x: d.x, y: d.y, r: 30 });
    // roads: the main road between the bases, then each deposit and hill to the nearest road
    const net = []; spec.roads = net;
    const lay = (a, b) => { const pts = roadPath(a, b); if (pts) { net.push(pts); } return pts; };
    lay(base, spec.ai.hq);
    for (const d of spec.deposits) { const tgt = nearestRoadPoint(net, [d.x, d.y]); if (tgt && Math.hypot(tgt[0] - d.x, tgt[1] - d.y) > 150) lay([d.x, d.y], tgt); }
    for (const poly of net) Terrain.roads.push(poly.map(p => [p[0], p[1]]));
    Terrain.rasterizeRoads();
    for (const poly of net) cutRoad(poly);
    for (let k = 0; k < N * N; k++) if (Terrain.road[k] && type[k] === Terrain.T_FOREST) type[k] = Terrain.T_OPEN;
    Terrain.recomputeDerived();
    Terrain.markDirty(0, 0, N, N);
  }
  const nearestRoadPoint = (net, p) => { let best = null, bd = Infinity; for (const poly of net) for (const q of poly) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < bd) { bd = d; best = q; } } return best; };
  // A road route on a coarse grid (every 4 cells): gentle grades are cheap, steep ones and water dear
  // (a crossing becomes a bridge). Smoothed into a polyline in world units.
  function roadPath(a, b) {
    const S = 4, C = Terrain.CELL, N = Terrain.W, G = Math.ceil(N / S), hgt = Terrain.height, type = Terrain.type;
    const at = (gi, gj) => Math.min(N - 1, gj * S) * N + Math.min(N - 1, gi * S);
    const si = Math.floor(a[0] / C / S), sj = Math.floor(a[1] / C / S), ti = Math.floor(b[0] / C / S), tj = Math.floor(b[1] / C / S);
    const g = new Float64Array(G * G).fill(Infinity), from = new Int32Array(G * G).fill(-1), shut = new Uint8Array(G * G);
    const heap = []; const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, rr = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const h = (gi, gj) => Math.hypot(gi - ti, gj - tj) * S * C;
    const s0 = sj * G + si; g[s0] = 0; push(h(si, sj), s0);
    while (heap.length) {
      const [, k] = pop(); if (shut[k]) continue; shut[k] = 1;
      const gi = k % G, gj = (k - gi) / G; if (gi === ti && gj === tj) break;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = gi + di, nj = gj + dj; if (ni < 0 || nj < 0 || ni >= G || nj >= G) continue;
        const n = nj * G + ni; if (shut[n]) continue;
        const d = Math.hypot(di, dj) * S * C, ka = at(gi, gj), kb = at(ni, nj), grade = Math.abs(hgt[kb] - hgt[ka]) / d;
        const c = d * (1 + 40 * grade * grade + (grade > 0.25 ? 30 : 0)) * (type[kb] === Terrain.T_WATER ? 6 : type[kb] === Terrain.T_FOREST ? 1.3 : 1);
        if (g[k] + c < g[n]) { g[n] = g[k] + c; from[n] = k; push(g[n] + h(ni, nj), n); }
      }
    }
    let k = tj * G + ti; if (from[k] < 0 && k !== s0) return null;
    const cells = []; while (k >= 0) { cells.push(k); k = from[k]; } cells.reverse();
    let pts = cells.filter((_, n) => n % 2 === 0 || n === cells.length - 1).map(k => [(k % G) * S * C + S * C / 2, Math.floor(k / G) * S * C + S * C / 2]);
    pts[0] = [a[0], a[1]]; pts[pts.length - 1] = [b[0], b[1]];
    for (let pass = 0; pass < 2; pass++) { const out = [pts[0]]; for (let n = 0; n < pts.length - 1; n++) { const p = pts[n], q = pts[n + 1]; out.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]); } out.push(pts[pts.length - 1]); pts = out; }
    return pts;
  }
  // Relax the grade along a road so it stays walkable for vehicles (cuttings and embankments).
  function cutRoad(poly) {
    const N = Terrain.W, hgt = Terrain.height, type = Terrain.type, cx = Terrain.cx, cy = Terrain.cy;
    const pts = samplePoly(poly, 5), hs = pts.map(p => Terrain.hAt(p[0], p[1]));
    for (let pass = 0; pass < 6; pass++) {
      for (let n = 1; n < pts.length; n++) { const g = 0.27 * (Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]) || 1); if (hs[n] - hs[n - 1] > g) hs[n] = hs[n - 1] + g; if (hs[n - 1] - hs[n] > g) hs[n - 1] = hs[n] + g; }
      for (let n = pts.length - 1; n > 0; n--) { const g = 0.27 * (Math.hypot(pts[n][0] - pts[n - 1][0], pts[n][1] - pts[n - 1][1]) || 1); if (hs[n] - hs[n - 1] > g) hs[n] = hs[n - 1] + g; if (hs[n - 1] - hs[n] > g) hs[n - 1] = hs[n] + g; }
    }
    pts.forEach((p, n) => {
      const ci = Terrain.cellI(p[0]), cj = Terrain.cellJ(p[1]);
      for (let dj = -4; dj <= 4; dj++) for (let di = -4; di <= 4; di++) {
        const i = ci + di, j = cj + dj; if (!Terrain.inb(i, j)) continue;
        const d = Math.hypot(cx(i) - p[0], cy(j) - p[1]), k = j * N + i;
        if (d < 40 && (type[k] !== Terrain.T_WATER || d <= 14)) hgt[k] = lerp(hs[n], hgt[k], smoothstep(clamp((d - 14) / 26, 0, 1)));
      }
    });
  }
  // Every deposit and the enemy HQ must be reachable on foot from the player's base; if one isn't,
  // a road is laid to it (roads are always walkable) and the check runs again.
  function validate(spec) {
    Path.init();
    const targets = spec.deposits.map(d => [d.x, d.y]).concat(spec.ai ? [spec.ai.hq] : []), from = [spec.base[0], spec.base[1] + 80];
    let fixed = 0, reach = Path.reachMap(from[0], from[1], 'infantry');
    for (const t of targets) {
      if (reach[Terrain.cellIdxAt(t[0], t[1])]) continue;
      const q = nearestRoadPoint(Terrain.roads, t) || spec.base, pts = roadPath(q, t); if (!pts) continue;
      Terrain.roads.push(pts); Terrain.rasterizeRoads(); cutRoad(pts); Terrain.recomputeDerived(); Path.init(); fixed++;
      reach = Path.reachMap(from[0], from[1], 'infantry');
    }
    Terrain.markDirty(0, 0, Terrain.W, Terrain.H);
    return fixed;
  }

  function placeEntities(spec, diff) {
    const base = spec.base;
    Game.addBuilding('hq', 1, base[0], base[1], true);
    // DD Q15: 6 Riflemen and 4 Workers, in rows of six below the HQ.
    Data.START.units.forEach((t, n) => Game.spawnUnit(t, 1, base[0] - 50 + (n % 6) * 20, base[1] + 60 + Math.floor(n / 6) * 20));
    if (spec.ai) {
      const A = spec.ai;
      Game.addBuilding('hq', 2, A.hq[0], A.hq[1], true);
      for (const b of A.buildings) Game.addBuilding(b.type, 2, b.x, b.y, true);
      const gc = A.garrisonCenter;
      A.garrison.slice(0, diff.garrison).forEach((t, n) => {
        let x = gc[0] - 110 + (n % 6) * 40, y = gc[1] + Math.floor(n / 6) * 30;
        const cls = Data.MOVE_CLASSES[Data.UNITS[t].cls];   // 0.5d fix: some spots were on cliffs the soldier could never walk off
        if (!Terrain.passableAt(x, y, cls)) { const q = Path.nearestPassable(Terrain.cellI(x), Terrain.cellJ(y), cls); if (q) { x = Terrain.cx(q[0]); y = Terrain.cy(q[1]); } }
        const u = Game.spawnUnit(t, 2, x, y); u.order = { type: 'hold', x: u.x, y: u.y };
      });
    }
    for (const g of spec.creeps) g.units.forEach((t, n) => { const a = n / g.units.length * Math.PI * 2; Game.spawnUnit(t, 0, g.c[0] + Math.cos(a) * g.r, g.c[1] + Math.sin(a) * g.r); });
  }

  function build(spec, diff) { if (spec.generated) { buildGenerated(spec); spec.fixedRoads = validate(spec); } else buildTerrain(spec); placeEntities(spec, diff || Data.DIFFICULTY.hard); }

  // Small preview of a map for the menu (builds the terrain, so call before the real build).
  function thumbnail(spec, size) {
    buildTerrain(spec); Terrain.flushDirty();
    const c = document.createElement('canvas'); c.width = size; c.height = size; const ctx = c.getContext('2d');
    const ov = Terrain.overview; ctx.imageSmoothingEnabled = true; ctx.drawImage(ov, 0, 0, ov.width, ov.height, 0, 0, size, size);
    const s = size / MAPW;
    ctx.fillStyle = Data.PLAYER_COLORS[1]; ctx.fillRect(spec.base[0] * s - 4, spec.base[1] * s - 4, 8, 8);
    if (spec.ai) { ctx.fillStyle = Data.PLAYER_COLORS[2]; ctx.fillRect(spec.ai.hq[0] * s - 4, spec.ai.hq[1] * s - 4, 8, 8); }
    for (const g of spec.creeps) { ctx.fillStyle = Data.PLAYER_COLORS[0]; ctx.beginPath(); ctx.arc(g.c[0] * s, g.c[1] * s, 2.5, 0, Math.PI * 2); ctx.fill(); }
    return c;
  }

  // ---- spec transforms ----
  function mapPoints(spec, fn) {
    const P = p => fn([p[0], p[1]]);
    const o = JSON.parse(JSON.stringify(spec));
    o.base = P(o.base);
    if (o.mountain) o.mountain.c = P(o.mountain.c);
    for (const h of o.hills) h.c = P(h.c);
    for (const r of o.rivers) r.pts = r.pts.map(P);
    o.roads = o.roads.map(poly => poly.map(P));
    for (const r of o.forestRings || []) r.c = P(r.c);
    for (const b of o.forestBlobs || []) b.c = P(b.c);
    for (const c of o.clear || []) c.c = P(c.c);
    for (const s of o.swamps || []) if (s.c) s.c = P(s.c);
    for (const s of o.sites || []) s.c = P(s.c);
    for (const d of o.deposits) { const q = P([d.x, d.y]); d.x = q[0]; d.y = q[1]; }
    for (const g of o.creeps) g.c = P(g.c);
    if (o.ai) { o.ai.hq = P(o.ai.hq); o.ai.garrisonCenter = P(o.ai.garrisonCenter); for (const b of o.ai.buildings) { const q = P([b.x, b.y]); b.x = q[0]; b.y = q[1]; } }
    return o;
  }
  const mirrorX = spec => Object.assign(mapPoints(spec, p => [MAPW - p[0], p[1]]), { tilt: [-(spec.tilt || [0, 0])[0], (spec.tilt || [0, 0])[1]] });
  const mirrorY = spec => Object.assign(mapPoints(spec, p => [p[0], MAPW - p[1]]), { tilt: [(spec.tilt || [0, 0])[0], -(spec.tilt || [0, 0])[1]] });

  // ---- the maps ----
  const HIGHLAND = {
    id: 'highland', name: 'Highland Pass',
    desc: 'Base in the south-west, sulfur hill in the centre, enemy stronghold on the north-east plateau.',
    seed: 20260927, tilt: [1, 1],
    base: [420, 1980],
    mountain: { c: [1880, 540], plateau: 175, foot: 760, height: 235, top: 262 },
    hills: [{ c: [1250, 1250], r: 320, amt: 88, pw: 1.1 }, { c: [560, 640], r: 280, amt: 46 }, { c: [1850, 1950], r: 380, amt: 64 }, { c: [1500, 1750], r: 260, amt: 28 }, { c: [300, 1200], r: 220, amt: 22 }],
    rivers: [{ pts: [[1470, 880], [1290, 830], [1080, 900], [960, 1080], [890, 1300], [880, 1520], [860, 1800], [790, 2100], [720, 2400]], bed: [52, 12], width: 13 }],
    roads: [
      [[420, 1980], [620, 1905], [800, 1830], [862, 1770], [935, 1700], [1100, 1560], [1250, 1500], [1450, 1380], [1600, 1200], [1700, 1000], [1500, 880], [1640, 760], [1760, 700], [1880, 620]],
      [[420, 1980], [380, 1720], [420, 1400], [480, 1100], [520, 820], [560, 660]],
      [[1250, 1500], [1180, 1380], [1250, 1270]],
    ],
    forestThr: 0.6,
    forestRings: [{ c: [560, 640], inner: 110, outer: 300, thr: 0.42, clearInner: 95 }],
    forestBlobs: [{ c: [230, 1760], r: 150, thr: 0.35 }, { c: [330, 2230], r: 130, thr: 0.35 }, { c: [1350, 1750], r: 170, thr: 0.4 }, { c: [2050, 1350], r: 220, thr: 0.4 }, { c: [900, 300], r: 200, thr: 0.38 }],
    clear: [{ c: [420, 1980], r: 110 }, { c: [1880, 540], r: 200 }, { c: [1250, 1250], r: 120 }],
    swamps: [{ river: 0, tMin: 0.72, d: 80, hMax: 24 }, { c: [1000, 1000], r: 90, hMax: 40 }],
    sites: [{ c: [680, 2120], r: 45 }, { c: [560, 600], r: 45 }, { c: [1250, 1230], r: 45 }, { c: [2020, 440], r: 50 }, { c: [1870, 620], r: 70 }, { c: [1960, 610], r: 40 }],
    deposits: [{ type: 'metal', x: 680, y: 2120 }, { type: 'metal', x: 560, y: 600 }, { type: 'sulfur', x: 1250, y: 1230 }, { type: 'sulfur', x: 2020, y: 440 }, { type: 'metal', x: 1700, y: 1620 }, { type: 'rubber', x: 300, y: 1300 }, { type: 'oil', x: 1520, y: 2050 }],
    creeps: [
      { c: [1250, 1230], r: 45, units: ['rifle', 'rifle', 'rifle', 'rifle', 'hmg'] },
      { c: [560, 610], r: 40, units: ['rifle', 'rifle', 'rifle', 'rifle'] },
      { c: [1722, 1580], r: 22, units: ['rifle', 'rifle', 'rifle'] },
    ],
    ai: {
      hq: [1880, 520], buildings: [{ type: 'barracks', x: 1970, y: 610 }, { type: 'ordnance', x: 1790, y: 620 }, { type: 'mine', x: 2020, y: 440 }],
      garrisonCenter: [1880, 690], garrison: ['rifle', 'rifle', 'hmg', 'rifle', 'sniper', 'rifle', 'mortar', 'rifle', 'hmg', 'rifle', 'mortar', 'rifle'],
    },
    hint: 'Build a Lumber Camp by the forest, then a Barracks. Scout north-west first.',
  };

  const WESTERN = Object.assign(mirrorX(HIGHLAND), {
    id: 'western', name: 'Western Ridge', seed: 7,
    desc: 'Mirror of Highland Pass: base in the south-east, the enemy plateau looms in the north-west.',
    hint: 'Your forest and iron are to the east and south. The sulfur hill is across the river.',
  });
  WESTERN.hills.push({ c: [1900, 1300], r: 220, amt: 34 });
  WESTERN.forestBlobs.push({ c: [2100, 1250], r: 160, thr: 0.36 });

  const SOUTHERN = Object.assign(mirrorY(HIGHLAND), {
    id: 'southern', name: 'Southern Reach', seed: 11,
    desc: 'Flipped north to south: you start in the north-west and the mountain holds the south-east.',
    hint: 'The river runs north from the mountain. Cross at the bridge on the main road.',
  });
  SOUTHERN.rivers[0].width = 16;
  SOUTHERN.hills.push({ c: [1300, 500], r: 200, amt: 26 });

  const VALLEY = {
    id: 'valley', name: 'Open Valley',
    desc: 'Sandbox with no enemy commander. Neutral guards hold the hills and deposits on both banks of the river.',
    seed: 4242, tilt: [0, 0],
    base: [640, 2000],
    mountain: null,
    hills: [{ c: [560, 720], r: 330, amt: 75, pw: 1.1 }, { c: [1840, 720], r: 330, amt: 75, pw: 1.1 }, { c: [1250, 1250], r: 300, amt: 60 }, { c: [1900, 1900], r: 300, amt: 48 }, { c: [250, 1350], r: 220, amt: 30 }, { c: [2150, 1300], r: 220, amt: 30 }],
    rivers: [{ pts: [[1180, 0], [1140, 300], [1230, 620], [1160, 950], [1080, 1250], [1180, 1550], [1120, 1850], [1190, 2150], [1150, 2400]], bed: [48, 14], width: 14 }],
    roads: [
      [[640, 2000], [900, 1900], [1120, 1780], [1230, 1700], [1450, 1620], [1700, 1500], [1900, 1300]],
      [[640, 2000], [520, 1700], [480, 1350], [520, 1000], [580, 800]],
      [[1900, 1300], [1850, 1050], [1840, 800]],
      [[1230, 1700], [1300, 1450], [1250, 1280]],
    ],
    forestThr: 0.58,
    forestRings: [],
    forestBlobs: [{ c: [300, 1700], r: 170, thr: 0.35 }, { c: [900, 2250], r: 160, thr: 0.35 }, { c: [1600, 2150], r: 200, thr: 0.38 }, { c: [1200, 400], r: 220, thr: 0.38 }, { c: [2100, 500], r: 200, thr: 0.4 }],
    clear: [{ c: [640, 2000], r: 120 }, { c: [1250, 1250], r: 120 }, { c: [560, 720], r: 110 }, { c: [1840, 720], r: 110 }],
    swamps: [{ river: 0, tMin: 0.75, d: 90, hMax: 30 }],
    sites: [{ c: [860, 2140], r: 45 }, { c: [560, 700], r: 45 }, { c: [1840, 700], r: 45 }, { c: [1250, 1230], r: 45 }, { c: [1900, 1880], r: 45 }, { c: [250, 1330], r: 40 }, { c: [2150, 1280], r: 40 }],
    deposits: [{ type: 'metal', x: 860, y: 2140 }, { type: 'metal', x: 560, y: 700 }, { type: 'metal', x: 1840, y: 700 }, { type: 'sulfur', x: 1250, y: 1230 }, { type: 'sulfur', x: 1900, y: 1880 }, { type: 'rubber', x: 250, y: 1330 }, { type: 'oil', x: 2150, y: 1280 }],
    creeps: [
      { c: [560, 700], r: 40, units: ['rifle', 'rifle', 'rifle', 'rifle'] },
      { c: [1840, 700], r: 45, units: ['rifle', 'rifle', 'rifle', 'hmg', 'sniper'] },
      { c: [1250, 1230], r: 45, units: ['rifle', 'rifle', 'rifle', 'hmg'] },
      { c: [1900, 1880], r: 40, units: ['rifle', 'rifle', 'rifle', 'mortar'] },
    ],
    ai: null,
    hint: 'Sandbox: no enemy commander. Take the deposits from the neutral guards at your own pace.',
  };

  // Kaan, 0.7: the menu offers only generated maps; the hand-made ones stay for the Balance Lab.
  const RANDOM = { id: 'random', name: 'Random map', generated: true, ai: true, desc: 'A new 13 km map every game: the enemy holds a plateau in the far corner.' };
  const MAPS = [RANDOM], LAB_MAPS = [HIGHLAND, WESTERN, SOUTHERN, VALLEY], ALL = MAPS.concat(LAB_MAPS);
  return { build, buildTerrain, thumbnail, generate, MAPS, LAB_MAPS, ALL, mirrorX, mirrorY, BIG };
})();
