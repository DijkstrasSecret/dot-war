'use strict';
// Shared helpers: math, seeded random, value noise, binary heap.
const Util = (() => {
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const dist2 = (ax, ay, bx, by) => (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  const smoothstep = t => t * t * (3 - 2 * t);
  const lerpAngle = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; };

  function makeNoise(seed) {
    const rnd = mulberry32(seed);
    const P = 256;
    const perm = new Uint8Array(P * 2);
    const vals = new Float32Array(P);
    for (let i = 0; i < P; i++) { perm[i] = i; vals[i] = rnd(); }
    for (let i = P - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < P; i++) perm[i + P] = perm[i];
    const v = (ix, iy) => vals[perm[(perm[ix & 255] + iy) & 255]];
    function noise2(x, y) {
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const sx = smoothstep(x - x0), sy = smoothstep(y - y0);
      return lerp(lerp(v(x0, y0), v(x0 + 1, y0), sx), lerp(v(x0, y0 + 1), v(x0 + 1, y0 + 1), sx), sy);
    }
    function fbm(x, y, oct = 5, lac = 2, gain = 0.5) {
      let s = 0, a = 1, f = 1, n = 0;
      for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); n += a; a *= gain; f *= lac; }
      return s / n;
    }
    return { noise2, fbm, rnd };
  }

  // Min-heap keyed by number, storing integer payloads.
  class Heap {
    constructor() { this.k = []; this.v = []; }
    get size() { return this.k.length; }
    push(key, val) {
      const k = this.k, v = this.v; k.push(key); v.push(val);
      let i = k.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= k[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; }
    }
    pop() {
      const k = this.k, v = this.v; const topV = v[0], topK = k[0];
      const lk = k.pop(), lv = v.pop();
      if (k.length) {
        k[0] = lk; v[0] = lv; let i = 0; const n = k.length;
        for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < n && k[l] < k[m]) m = l; if (r < n && k[r] < k[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; }
      }
      return { key: topK, val: topV };
    }
  }

  function fmtTime(t) { t = Math.floor(t); const m = Math.floor(t / 60), s = t % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function costStr(cost) { return Object.entries(cost || {}).filter(([, v]) => v > 0).map(([k, v]) => v + ' ' + k).join(', ') || 'free'; }

  return { mulberry32, clamp, lerp, dist, dist2, smoothstep, lerpAngle, makeNoise, Heap, fmtTime, costStr };
})();
