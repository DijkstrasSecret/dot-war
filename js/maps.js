'use strict';
// Map generator driven by specs: a noise base, a mountain with a plateau, hills, carved rivers,
// cut roads, forests, swamps, deposits, creeps and the starting bases. MAPS lists the playable specs.
// TODO(patch 0.7): random generator on top of these specs plus a validation pass (Path.reachable from the base to every deposit and enemy HQ).
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
      A.garrison.slice(0, diff.garrison).forEach((t, n) => { const u = Game.spawnUnit(t, 2, gc[0] - 110 + (n % 6) * 40, gc[1] + Math.floor(n / 6) * 30); u.order = { type: 'hold', x: u.x, y: u.y }; });
    }
    for (const g of spec.creeps) g.units.forEach((t, n) => { const a = n / g.units.length * Math.PI * 2; Game.spawnUnit(t, 0, g.c[0] + Math.cos(a) * g.r, g.c[1] + Math.sin(a) * g.r); });
  }

  function build(spec, diff) { buildTerrain(spec); placeEntities(spec, diff || Data.DIFFICULTY.hard); }

  // Small preview of a map for the menu (builds the terrain, so call before the real build).
  function thumbnail(spec, size) {
    buildTerrain(spec); Terrain.flushDirty();
    const c = document.createElement('canvas'); c.width = size; c.height = size; const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.drawImage(Terrain.cache, 0, 0, MAPW, MAPW, 0, 0, size, size);
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

  const MAPS = [HIGHLAND, WESTERN, SOUTHERN, VALLEY];
  return { build, buildTerrain, thumbnail, MAPS, mirrorX, mirrorY };
})();
