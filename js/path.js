'use strict';
// Flow-field pathfinding. One Dijkstra per destination cell, shared by every unit heading there.
// Costs must stay Float64Array: Float32 rounding makes the relaxation cascade for minutes.
// TODO(patch 0.7): early-exit bound (stop when every requester's cell is settled) or hierarchical fields for maps over 400x400 cells.
const Path = (() => {
  const { Heap } = Util;
  const fields = new Map();
  const MAX_FIELDS = 48;
  let W = 0, H = 0;
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

  function init() { W = Terrain.W; H = Terrain.H; fields.clear(); }
  function invalidate() { fields.clear(); }

  function nearestPassable(ci, cj, cls) {
    for (let r = 0; r < 14; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const i = ci + di, j = cj + dj;
      if (Terrain.inb(i, j) && Terrain.cellPassable(Terrain.idx(i, j), cls)) return [i, j];
    }
    return null;
  }

  function getField(tx, ty, clsName, now) {
    const cls = Data.MOVE_CLASSES[clsName];
    let ci = Terrain.cellI(tx), cj = Terrain.cellJ(ty);
    if (!Terrain.cellPassable(Terrain.idx(ci, cj), cls)) { const p = nearestPassable(ci, cj, cls); if (!p) return null; ci = p[0]; cj = p[1]; }
    const key = ci + ',' + cj + ',' + clsName;
    let f = fields.get(key);
    if (f) { f.time = now; return f; }
    f = compute(ci, cj, cls);
    f.key = key; f.time = now; f.tx = Terrain.cx(ci); f.ty = Terrain.cy(cj); f.ci = ci; f.cj = cj;
    fields.set(key, f);
    if (fields.size > MAX_FIELDS) {
      let oldK = null, oldT = Infinity;
      for (const [k, v] of fields) if (v.time < oldT) { oldT = v.time; oldK = k; }
      fields.delete(oldK);
    }
    return f;
  }

  function compute(ci, cj, cls) {
    const N = W * H;
    const cost = new Float64Array(N).fill(Infinity);
    const next = new Int32Array(N).fill(-1);
    const heap = new Heap();
    const t = Terrain.idx(ci, cj); cost[t] = 0; heap.push(0, t);
    const CELL = Terrain.CELL;
    while (heap.size) {
      const { key: c, val: k } = heap.pop();
      if (c > cost[k]) continue;
      const i = k % W, j = (k - i) / W;
      for (let q = 0; q < 8; q++) {
        const di = NB[q][0], dj = NB[q][1], dd = NB[q][2];
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
        const n = nj * W + ni;
        if (dd > 1 && (!Terrain.cellPassable(j * W + ni, cls) || !Terrain.cellPassable(nj * W + i, cls))) continue;
        const ec = Terrain.edgeCost(n, k, cls, dd * CELL);
        if (ec === Infinity) continue;
        const nc = c + ec;
        if (nc < cost[n]) { cost[n] = nc; next[n] = k; heap.push(nc, n); }
      }
    }
    return { cost, next };
  }

  // The point a unit should walk towards next, or null when it is on the destination cell.
  function steer(x, y, field, cls, maxLook = 10) {
    const k = Terrain.cellIdxAt(x, y);
    if (field.cost[k] === Infinity) return [field.tx, field.ty];
    let best = null, cur = k;
    for (let s = 0; s < maxLook; s++) {
      const n = field.next[cur]; if (n < 0) break;
      const px = Terrain.cx(n % W), py = Terrain.cy(Math.floor(n / W));
      if (s === 0 || Terrain.straightPassable(x, y, px, py, cls)) { best = [px, py]; cur = n; } else break;
    }
    return best;
  }

  function reachable(field, x, y) { return field.cost[Terrain.cellIdxAt(x, y)] !== Infinity; }

  return { init, invalidate, getField, steer, nearestPassable, reachable };
})();
