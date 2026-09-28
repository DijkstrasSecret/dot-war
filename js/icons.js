'use strict';
// Vector logos drawn inside unit shapes and reused as UI icons.
// Each icon is drawn in a [-1,1] box; s is the half-size in pixels.
// These logos are meant to become the saved blueprint icons of the designer (patch 0.5): keep them
// legible at 4 px half-size and add 'rect'/'tri' background shapes to makeCanvas when vehicles arrive.
const Icons = (() => {
  function line(ctx, x0, y0, x1, y1, w) { ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function circ(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) ctx.fill(); else ctx.stroke(); }
  function poly(ctx, pts, fill) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); if (fill) ctx.fill(); else ctx.stroke(); }
  // point along segment a->b at fraction t, offset perpendicular by o
  function along(a, b, t, o) { const dx = b[0] - a[0], dy = b[1] - a[1]; const L = Math.hypot(dx, dy); const nx = -dy / L, ny = dx / L; return [a[0] + dx * t + nx * o, a[1] + dy * t + ny * o]; }

  const draw = {
    musket(ctx) {
      const a = [-0.95, 0.5], b = [0.95, -0.45];
      line(ctx, a[0], a[1], b[0], b[1], 0.14);
      line(ctx, a[0], a[1], -0.5, 0.28, 0.36);
      const p = along(a, b, 0.42, 0.14); circ(ctx, p[0], p[1], 0.11, true);
      const q = along(a, b, 0.62, -0.16); line(ctx, q[0], q[1], q[0] + 0.28, q[1] - 0.14, 0.08);
    },
    worker(ctx) {   // a shovel: long handle, grip bar and blade
      line(ctx, -0.7, 0.7, 0.45, -0.45, 0.14);
      line(ctx, -0.95, 0.5, -0.5, 0.95, 0.14);
      poly(ctx, [0.3, -0.3, 0.62, -0.95, 0.95, -0.62, 0.3, -0.3], true);
      poly(ctx, [0.28, -0.58, 0.62, -0.95, 0.95, -0.62, 0.58, -0.28], true);
    },
    rifle(ctx) {
      const a = [-0.95, 0.45], b = [0.95, -0.4];
      line(ctx, a[0], a[1], b[0], b[1], 0.13);
      line(ctx, a[0], a[1], -0.5, 0.25, 0.34);
      const m = along(a, b, 0.48, 0); const m2 = along(a, b, 0.48, 0.32);
      line(ctx, m[0], m[1], m2[0], m2[1], 0.2);
      const t = along(a, b, 0.3, 0.16); circ(ctx, t[0], t[1], 0.08, true);
    },
    hmg(ctx) {
      line(ctx, -0.55, -0.15, 0.95, -0.15, 0.2);
      ctx.fillRect(-0.85, -0.42, 0.5, 0.5);
      line(ctx, 0.35, -0.05, 0.05, 0.55, 0.1);
      line(ctx, 0.35, -0.05, 0.65, 0.55, 0.1);
      for (let i = 0; i < 4; i++) circ(ctx, -0.9 + i * 0.03, 0.2 + i * 0.16, 0.06, true);
      line(ctx, -0.95, 0.95, -0.55, 0.95, 0.1);
    },
    sniper(ctx) {
      const a = [-0.95, 0.5], b = [0.95, -0.45];
      line(ctx, a[0], a[1], b[0], b[1], 0.12);
      line(ctx, a[0], a[1], -0.5, 0.28, 0.32);
      const s0 = along(a, b, 0.32, -0.2), s1 = along(a, b, 0.6, -0.2);
      line(ctx, s0[0], s0[1], s1[0], s1[1], 0.17);
      const c0 = along(a, b, 0.4, -0.05), c1 = along(a, b, 0.4, -0.2); line(ctx, c0[0], c0[1], c1[0], c1[1], 0.08);
      const c2 = along(a, b, 0.52, -0.05), c3 = along(a, b, 0.52, -0.2); line(ctx, c2[0], c2[1], c3[0], c3[1], 0.08);
    },
    mortar(ctx) {
      line(ctx, -0.75, 0.75, 0.55, 0.75, 0.18);
      line(ctx, -0.3, 0.75, 0.45, -0.6, 0.32);
      line(ctx, 0.12, 0.0, -0.55, 0.72, 0.1);
      ctx.beginPath(); ctx.ellipse(0.72, -0.78, 0.1, 0.18, -0.5, 0, Math.PI * 2); ctx.fill();
    },
    truck(ctx) {
      ctx.fillRect(-0.95, -0.2, 0.5, 0.55);
      ctx.fillRect(-0.4, -0.55, 1.35, 0.9);
      circ(ctx, -0.6, 0.55, 0.22, true); circ(ctx, 0.5, 0.55, 0.22, true);
    },
    armoredcar(ctx) {
      poly(ctx, [-0.95, 0.1, -0.65, -0.3, 0.7, -0.3, 0.95, 0.1, 0.95, 0.4, -0.95, 0.4], true);
      ctx.fillRect(-0.3, -0.62, 0.55, 0.34);
      line(ctx, 0.2, -0.45, 0.85, -0.45, 0.1);
      circ(ctx, -0.6, 0.55, 0.2, true); circ(ctx, 0.0, 0.55, 0.2, true); circ(ctx, 0.6, 0.55, 0.2, true);
    },
    artillery(ctx) {
      line(ctx, -0.2, 0.3, 0.95, -0.65, 0.22);
      line(ctx, -0.2, 0.3, -0.95, 0.7, 0.14);
      ctx.lineWidth = 0.14; circ(ctx, -0.2, 0.35, 0.38, false);
      circ(ctx, -0.2, 0.35, 0.1, true);
    },
    worker(ctx) {
      line(ctx, -0.75, 0.8, 0.55, -0.5, 0.14);
      ctx.lineWidth = 0.16; ctx.beginPath(); ctx.arc(0.55, -0.5, 0.42, Math.PI * 0.75, Math.PI * 1.75); ctx.stroke();
      line(ctx, 0.75, 0.8, -0.35, -0.3, 0.14);
      poly(ctx, [-0.35, -0.3, -0.85, -0.45, -0.6, -0.9, -0.15, -0.55], true);
    },
    hq(ctx) {
      const pts = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.42 : 0.95; const a = -Math.PI / 2 + i * Math.PI / 5; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
      poly(ctx, pts, true);
    },
    circle(ctx) { ctx.lineWidth = 0.2; circ(ctx, 0, 0, 0.72, false); },
    square(ctx) { ctx.lineWidth = 0.2; ctx.strokeRect(-0.68, -0.68, 1.36, 1.36); },
    lumber(ctx) {
      line(ctx, -0.7, 0.85, 0.45, -0.4, 0.14);
      poly(ctx, [0.45, -0.4, 0.05, -0.85, 0.5, -0.95, 0.95, -0.55, 0.85, -0.05], true);
    },
    mine(ctx) {
      line(ctx, -0.8, 0.8, 0.5, -0.5, 0.14);
      ctx.lineWidth = 0.18; ctx.beginPath(); ctx.arc(0.65, -0.65, 0.55, Math.PI * 0.6, Math.PI * 1.4, false); ctx.stroke();
    },
    tower(ctx) {
      line(ctx, -0.55, 0.95, -0.3, -0.35, 0.14); line(ctx, 0.55, 0.95, 0.3, -0.35, 0.14);
      line(ctx, -0.45, 0.35, 0.45, 0.35, 0.1); line(ctx, -0.4, -0.05, 0.4, -0.05, 0.1);
      ctx.fillRect(-0.55, -0.55, 1.1, 0.22);
      poly(ctx, [-0.7, -0.55, 0, -1.0, 0.7, -0.55], true);
      line(ctx, -0.45, -0.55, -0.45, -0.32, 0.08); line(ctx, 0.45, -0.55, 0.45, -0.32, 0.08);
    },
    flask(ctx) {
      poly(ctx, [-0.2, -0.9, 0.2, -0.9, 0.2, -0.3, 0.75, 0.75, 0.6, 0.9, -0.6, 0.9, -0.75, 0.75, -0.2, -0.3], true);
    },
    metal(ctx) {
      poly(ctx, [-0.9, 0.35, -0.55, 0.0, 0.05, 0.0, -0.3, 0.35], true);
      poly(ctx, [0.0, 0.35, 0.35, 0.0, 0.95, 0.0, 0.6, 0.35], true);
      poly(ctx, [-0.45, -0.05, -0.1, -0.4, 0.5, -0.4, 0.15, -0.05], true);
      ctx.fillRect(-0.9, 0.35, 0.6, 0.3); ctx.fillRect(0.0, 0.35, 0.6, 0.3); ctx.fillRect(-0.45, -0.05, 0.6, 0.3);
    },
    sulfur(ctx) {
      poly(ctx, [0, -0.95, 0.95, 0, 0, 0.95, -0.95, 0], true);
      ctx.save(); ctx.globalCompositeOperation = 'destination-out';
      ctx.font = 'bold 1.1px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('S', 0, 0.05); ctx.restore();
    },
    rubber(ctx) { ctx.lineWidth = 0.2; circ(ctx, 0, 0, 0.75, false); circ(ctx, 0, 0, 0.35, false); },
    oil(ctx) { ctx.beginPath(); ctx.moveTo(0, -0.95); ctx.bezierCurveTo(0.9, 0.2, 0.6, 0.95, 0, 0.95); ctx.bezierCurveTo(-0.6, 0.95, -0.9, 0.2, 0, -0.95); ctx.fill(); },
    wood(ctx) { ctx.fillRect(-0.95, -0.3, 1.9, 0.6); ctx.beginPath(); ctx.ellipse(0.95, 0, 0.15, 0.3, 0, 0, Math.PI * 2); ctx.fill(); },
    creep(ctx) { poly(ctx, [0, -0.9, 0.8, 0.7, -0.8, 0.7], true); },
  };

  function drawIcon(ctx, name, x, y, s, color) {
    const fn = draw[name] || draw.flask;
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    fn(ctx);
    ctx.restore();
  }

  const cache = new Map();
  function toCanvasRaw(name, size, color, bg, shape) {
    const key = name + '|' + size + '|' + color + '|' + bg + '|' + shape;
    if (cache.has(key)) return cache.get(key);
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const ctx = c.getContext('2d');
    if (bg) {
      ctx.fillStyle = bg;
      if (shape === 'square') ctx.fillRect(size * 0.08, size * 0.08, size * 0.84, size * 0.84);
      else { ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.47, 0, Math.PI * 2); ctx.fill(); }
    }
    drawIcon(ctx, name, size / 2, size / 2, size * (bg ? 0.27 : 0.4), color);
    cache.set(key, c);
    return c;
  }
  // Returns a fresh canvas element (so it can be inserted into the DOM many times).
  function makeCanvas(name, size, color, bg, shape) {
    const src = toCanvasRaw(name, size, color, bg, shape);
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  return { drawIcon, makeCanvas, has: n => !!draw[n] };
})();
