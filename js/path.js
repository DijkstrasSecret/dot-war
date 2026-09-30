'use strict';
// Pathfinding. Near a destination: a flow field, one Dijkstra per destination cell shared by every unit
// heading there. Patch 0.7a (big maps): a field covers at most FIELD_R cells around its destination (the
// whole map on small maps, so they behave as before), and a unit outside that window follows a route
// found by a directed (A*) search to the window's edge, shared by units starting from the same spot.
// Costs must stay Float64Array: Float32 rounding makes the relaxation cascade for minutes.
const Path = (() => {
  const fields = new Map();
  const MAX_FIELDS = 48;
  const FIELD_R = 96;             // window half-size in cells (about 1.15 km) on maps bigger than 2 * FIELD_R
  const ROUTE_MAX = 600000;       // node budget for one route search
  const ROUTE_W = 2.2;            // heuristic weight: slightly longer routes, far fewer nodes searched
  let W = 0, H = 0;
  const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1], DD = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
  const routes = new Map();

  function init() { W = Terrain.W; H = Terrain.H; fields.clear(); routes.clear(); tables.clear(); scratch = null; }
  function invalidate() { fields.clear(); routes.clear(); tables.clear(); }
  // Per move class: whether each cell can be walked, and its cost factor pathMult / terrain factor.
  // Rebuilt after anything that changes the ground (buildings, lines, roads call invalidate()).
  const tables = new Map();
  function table(cls) {
    let t = tables.get(cls); if (t) return t;
    const N = W * H, type = Terrain.type, road = Terrain.road, slope = Terrain.slope, blocked = Terrain.blocked, pathMult = Terrain.pathMult, blockVeh = Terrain.blockVeh;
    const T_WATER = Terrain.T_WATER, T_FOREST = Terrain.T_FOREST, T_SWAMP = Terrain.T_SWAMP, slopeCap = cls.maxGrade * 1.1, veh = !!cls.vehicle;
    const pass = new Uint8Array(N), base = new Float64Array(N);
    for (let k = 0; k < N; k++) {
      pass[k] = !(blocked[k] || (veh && blockVeh[k])) && (road[k] ? true : type[k] !== T_WATER && slope[k] <= slopeCap) ? 1 : 0;
      base[k] = pathMult[k] / (road[k] ? cls.road : type[k] === T_FOREST ? cls.forest : type[k] === T_SWAMP ? cls.swamp : 1);
    }
    t = { pass, base }; tables.set(cls, t); return t;
  }
  const small = () => W <= 400 && H <= 400;   // today's maps (200 cells) keep whole-map fields

  function nearestPassable(ci, cj, cls) {
    for (let r = 0; r < 14; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = ci + di, j = cj + dj;
      if (Terrain.inb(i, j) && Terrain.cellPassable(Terrain.idx(i, j), cls)) return [i, j];
    }
    return null;
  }

  // A binary heap on typed arrays (no object per entry), growing as needed.
  function makeHeap(cap) {
    let keys = new Float64Array(cap), vals = new Int32Array(cap), n = 0;
    return {
      get size() { return n; },
      push(key, val) {
        if (n === keys.length) { const k2 = new Float64Array(n * 2), v2 = new Int32Array(n * 2); k2.set(keys); v2.set(vals); keys = k2; vals = v2; }
        let i = n++;
        while (i > 0) { const p = (i - 1) >> 1; if (keys[p] <= key) break; keys[i] = keys[p]; vals[i] = vals[p]; i = p; }
        keys[i] = key; vals[i] = val;
      },
      pop() {   // returns the value; the key is left in lastKey
        const top = vals[0]; this.lastKey = keys[0]; n--;
        if (n > 0) {
          const k = keys[n], v = vals[n]; let i = 0;
          for (;;) { let l = 2 * i + 1, m = i, mk = k; if (l < n && keys[l] < mk) { m = l; mk = keys[l]; } if (l + 1 < n && keys[l + 1] < mk) { m = l + 1; } if (m === i) break; keys[i] = keys[m]; vals[i] = vals[m]; i = m; }
          keys[i] = k; vals[i] = v;
        }
        return top;
      },
      lastKey: 0,
    };
  }

  // The cost of stepping from cell `from` onto neighbour `to` (d metres), exactly Terrain.edgeCost's
  // formula with the lookups inlined for speed; Infinity when it can't be walked.
  function stepper(cls) {
    const height = Terrain.height, road = Terrain.road, maxG = cls.maxGrade, tb = table(cls), P = tb.pass, B = tb.base;
    const pass = k => P[k] === 1;
    const cost = (from, to, d) => {
      if (P[to] === 0) return Infinity;
      let grade = (height[to] - height[from]) / d;
      if (road[from] && road[to]) grade = grade < -maxG ? -maxG : grade > maxG ? maxG : grade;
      else if (grade > maxG || grade < -maxG) return Infinity;
      return grade > 0 ? d * B[to] * (1 + 5 * grade) : d * B[to] / Math.min(1.25, 1 - 0.8 * grade);
    };
    return { pass, cost };
  }

  function getField(tx, ty, clsName, now) {
    const cls = Data.MOVE_CLASSES[clsName];
    let ci = Terrain.cellI(tx), cj = Terrain.cellJ(ty);
    if (!Terrain.cellPassable(Terrain.idx(ci, cj), cls)) { const p = nearestPassable(ci, cj, cls); if (!p) return null; ci = p[0]; cj = p[1]; }
    const key = ci + ',' + cj + ',' + clsName;
    let f = fields.get(key);
    if (f) { f.time = now; return f; }
    f = compute(ci, cj, cls);
    f.key = key; f.time = now; f.tx = Terrain.cx(ci); f.ty = Terrain.cy(cj); f.ci = ci; f.cj = cj; f.cls = clsName;
    fields.set(key, f);
    if (fields.size > MAX_FIELDS) {
      let oldK = null, oldT = Infinity;
      for (const [k, v] of fields) if (v.time < oldT) { oldT = v.time; oldK = k; }
      fields.delete(oldK);
    }
    return f;
  }

  // Dijkstra from the destination over its window. cost/next are indexed by window cell; costAt and
  // nextAt take map cell indices (nextAt returns a map cell index, or -1).
  function compute(ci, cj, cls) {
    const R = small() ? Math.max(W, H) : FIELD_R;
    const i0 = Math.max(0, ci - R), i1 = Math.min(W - 1, ci + R), j0 = Math.max(0, cj - R), j1 = Math.min(H - 1, cj + R);
    const ww = i1 - i0 + 1, wh = j1 - j0 + 1, N = ww * wh;
    const cost = new Float64Array(N).fill(Infinity), next = new Int32Array(N).fill(-1);
    // Everything below is inlined (heap, passability, edge cost) because this loop dominates path work.
    const tb = table(cls), P = tb.pass, B = tb.base, height = Terrain.height, road = Terrain.road, maxG = cls.maxGrade, CELL = Terrain.CELL;
    let hk = new Float64Array(1024), hv = new Int32Array(1024), hn = 0;
    const t = (cj - j0) * ww + (ci - i0); cost[t] = 0; hk[0] = 0; hv[0] = t; hn = 1;
    while (hn > 0) {
      const c = hk[0], lk = hv[0]; hn--;
      if (hn > 0) { const kk = hk[hn], vv = hv[hn]; let x = 0; for (;;) { const l = 2 * x + 1; let m = x, mk = kk; if (l < hn && hk[l] < mk) { m = l; mk = hk[l]; } if (l + 1 < hn && hk[l + 1] < mk) m = l + 1; if (m === x) break; hk[x] = hk[m]; hv[x] = hv[m]; x = m; } hk[x] = kk; hv[x] = vv; }
      if (c > cost[lk]) continue;
      const li = lk % ww, lj = (lk - li) / ww, gi = li + i0, gj = lj + j0, k = gj * W + gi;
      if (P[k] === 0 && lk !== t) continue;   // Terrain.edgeCost refuses to walk onto an impassable cell
      const hkk = height[k], rk = road[k], bk = B[k];
      for (let q = 0; q < 8; q++) {
        const ni = li + DI[q], nj = lj + DJ[q];
        if (ni < 0 || nj < 0 || ni >= ww || nj >= wh) continue;
        const gni = ni + i0, gnj = nj + j0, n = gnj * W + gni;
        if (q > 3 && (P[gj * W + gni] === 0 || P[gnj * W + gi] === 0)) continue;
        // walking from n onto k, towards the destination: exactly Terrain.edgeCost(n, k)
        const d = DD[q] * CELL; let grade = (hkk - height[n]) / d;
        if (road[n] && rk) grade = grade < -maxG ? -maxG : grade > maxG ? maxG : grade;
        else if (grade > maxG || grade < -maxG) continue;
        const nc = c + (grade > 0 ? d * bk * (1 + 5 * grade) : d * bk / Math.min(1.25, 1 - 0.8 * grade)), ln = nj * ww + ni;
        if (nc < cost[ln]) {
          cost[ln] = nc; next[ln] = lk;
          if (hn === hk.length) { const k2 = new Float64Array(hn * 2), v2 = new Int32Array(hn * 2); k2.set(hk); v2.set(hv); hk = k2; hv = v2; }
          let x = hn++; while (x > 0) { const pp = (x - 1) >> 1; if (hk[pp] <= nc) break; hk[x] = hk[pp]; hv[x] = hv[pp]; x = pp; } hk[x] = nc; hv[x] = ln;
        }
      }
    }
    const inWin = (i, j) => i >= i0 && i <= i1 && j >= j0 && j <= j1;
    return {
      cost, next, i0, j0, ww, wh, full: R >= Math.max(W, H),
      costAt(k) { const i = k % W, j = (k - i) / W; return inWin(i, j) ? cost[(j - j0) * ww + (i - i0)] : Infinity; },
      nextAt(k) { const i = k % W, j = (k - i) / W; if (!inWin(i, j)) return -1; const n = next[(j - j0) * ww + (i - i0)]; if (n < 0) return -1; const ni = n % ww; return (((n - ni) / ww) + j0) * W + ni + i0; },
    };
  }

  // A directed search from cell s until `done(k)` is true, the heuristic aiming at cell (ti, tj).
  // Returns the map cells from s to the goal and the exact cost walked, or null.
  let scratch = null;   // per-map arrays for route searches, reused through a stamp so they are never cleared
  function search(s, ti, tj, cls, done) {
    const N = W * H;
    if (!scratch || scratch.N !== N) scratch = { N, g: new Float64Array(N), from: new Int32Array(N), seen: new Int32Array(N), shut: new Int32Array(N), stamp: 0 };
    const S = scratch, g = S.g, from = S.from, seenA = S.seen, shut = S.shut, stamp = ++S.stamp;
    const st = stepper(cls), P = table(cls).pass, CELL = Terrain.CELL, hk = CELL * ROUTE_W / (cls.road * 1.25);   // the cheapest metre there is, weighted
    const heap = makeHeap(8192);
    const h = k => { const i = k % W, j = (k - i) / W, dx = i > ti ? i - ti : ti - i, dy = j > tj ? j - tj : tj - j; return (dx > dy ? dx + 0.41421356 * dy : dy + 0.41421356 * dx) * hk; };
    g[s] = 0; from[s] = -1; seenA[s] = stamp; heap.push(h(s), s);
    let count = 0;
    while (heap.size && count < ROUTE_MAX) {
      const k = heap.pop();
      if (shut[k] === stamp) continue; shut[k] = stamp; count++;
      if (done(k)) { const cells = [k]; let c = k; while (from[c] >= 0) { c = from[c]; cells.push(c); } cells.reverse(); return { cells, cost: g[k] }; }
      const i = k % W, j = (k - i) / W, gk = g[k];
      for (let q = 0; q < 8; q++) {
        const ni = i + DI[q], nj = j + DJ[q];
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const n = nj * W + ni; if (shut[n] === stamp) continue;
        if (q > 3 && (P[j * W + ni] === 0 || P[nj * W + i] === 0)) continue;
        const ec = st.cost(k, n, DD[q] * CELL); if (ec === Infinity) continue;
        const nc = gk + ec;
        if (seenA[n] !== stamp || nc < g[n]) { seenA[n] = stamp; g[n] = nc; from[n] = k; heap.push(nc + h(n), n); }
      }
    }
    return null;
  }

  // The route from (x, y) into a field's window, cached per starting 8x8-cell block and field.
  function routeInto(field, x, y, cls) {
    const k0 = Terrain.cellIdxAt(x, y), bi = Terrain.cellI(x) >> 3, bj = Terrain.cellJ(y) >> 3, key = bi + ',' + bj + '>' + field.key;
    if (routes.has(key)) return routes.get(key);
    const r = search(k0, field.ci, field.cj, cls, k => field.costAt(k) < Infinity);
    if (routes.size > 200) routes.clear();
    routes.set(key, r); return r;
  }

  // The point a unit should walk towards next, or null when it is on the destination cell. `u` (optional)
  // keeps the unit's place along a long route.
  function steer(x, y, field, cls, maxLook = 10, u = null) {
    const k = Terrain.cellIdxAt(x, y);
    if (field.costAt(k) === Infinity) {
      if (field.full || !u) return [field.tx, field.ty];
      const px = n => Terrain.cx(n % W), py = n => Terrain.cy((n - n % W) / W);
      // Join the route at its point nearest to us: routes are shared by everyone starting in the same block.
      const nearest = (rt, from, span) => { let bi = from, bd = Infinity; for (let n = from; n < Math.min(rt.length, from + span); n++) { const d = Math.hypot(px(rt[n]) - x, py(rt[n]) - y); if (d < bd) { bd = d; bi = n; } } return [bi, bd]; };
      if (!u.route || u.routeField !== field.key) { const r = routeInto(field, x, y, cls); u.route = r ? r.cells : null; u.routeField = field.key; u.routeI = u.route ? nearest(u.route, 0, 80)[0] : 0; }
      const rt = u.route; if (!rt) return [field.tx, field.ty];
      let [i, di] = nearest(rt, u.routeI || 0, 24);
      while (i < rt.length - 1 && Math.hypot(px(rt[i]) - x, py(rt[i]) - y) < Terrain.CELL * 1.5) i++;
      if (di > Terrain.CELL * 12) { u.route = null; u.routeField = null; return [px(rt[i]), py(rt[i])]; }   // pushed well off it: find a new one next time
      let best = i; for (let s = i + 1; s < Math.min(rt.length, i + maxLook); s++) { if (Terrain.straightPassable(x, y, px(rt[s]), py(rt[s]), cls)) best = s; else break; }
      u.routeI = i; return [px(rt[best]), py(rt[best])];
    }
    let best = null, cur = k;
    for (let s = 0; s < maxLook; s++) {
      const n = field.nextAt(cur); if (n < 0) break;
      const px = Terrain.cx(n % W), py = Terrain.cy(Math.floor(n / W));
      if (s === 0 || Terrain.straightPassable(x, y, px, py, cls)) { best = [px, py]; cur = n; } else break;
    }
    return best;
  }

  // A whole walk from one point to another: { cells, cost } (map cells in walking order, cost in the
  // same units as the fields), or null. On small maps it reads the destination's flow field, as before.
  function route(ax, ay, bx, by, clsName) {
    const cls = Data.MOVE_CLASSES[clsName], f = getField(bx, by, clsName, 0); if (!f) return null;
    let k = Terrain.cellIdxAt(ax, ay);
    if (f.full) {
      const c = f.costAt(k); if (c === Infinity) return null;
      const cells = []; for (let n = 0; n < 100000 && k >= 0; n++) { cells.push(k); k = f.nextAt(k); }
      return { cells, cost: c };
    }
    const r = search(k, f.ci, f.cj, cls, q => f.costAt(q) < Infinity); if (!r) return null;
    let last = r.cells[r.cells.length - 1]; const tail = f.costAt(last);
    for (let n = 0; n < 100000; n++) { const q = f.nextAt(last); if (q < 0) break; r.cells.push(q); last = q; }
    return { cells: r.cells, cost: r.cost + tail };
  }

  // Every cell reachable on foot (or by vehicle) from (x, y), by the same step rules as the fields:
  // a Uint8Array over the map, 1 where reachable. Used to check generated maps (0.7a).
  function reachMap(x, y, clsName) {
    const cls = Data.MOVE_CLASSES[clsName], tb = table(cls), P = tb.pass, height = Terrain.height, road = Terrain.road, maxG = cls.maxGrade, CELL = Terrain.CELL;
    const seen = new Uint8Array(W * H), queue = new Int32Array(W * H); let qh = 0, qt = 0;
    const s = Terrain.cellIdxAt(x, y); seen[s] = 1; queue[qt++] = s;
    while (qh < qt) {
      const k = queue[qh++], i = k % W, j = (k - i) / W;
      for (let q = 0; q < 8; q++) {
        const ni = i + DI[q], nj = j + DJ[q]; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const n = nj * W + ni; if (seen[n] || P[n] === 0) continue;
        if (q > 3 && (P[j * W + ni] === 0 || P[nj * W + i] === 0)) continue;
        const grade = (height[n] - height[k]) / (DD[q] * CELL);
        if (!(road[k] && road[n]) && (grade > maxG || grade < -maxG)) continue;
        seen[n] = 1; queue[qt++] = n;
      }
    }
    return seen;
  }

  function reachable(field, x, y) {
    if (field.full) return field.costAt(Terrain.cellIdxAt(x, y)) !== Infinity;
    return !!route(x, y, field.tx, field.ty, field.cls);
  }

  return { init, invalidate, getField, steer, nearestPassable, reachable, reachMap, route, FIELD_R };
})();
