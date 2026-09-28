// PaintingFx: draws one of the oil paintings in assets/paintings/ on a canvas and animates small
// details over it (candle flicker, dust in light beams, smoke, embers, snow, glints). No UI here:
// menu buttons, loading bars and click effects belong to the caller. See assets/paintings/README.md.
// Classic script, defines one global. index.html loads it before js/loading.js and js/menu.js.
const PaintingFx = (() => {
  // All paintings are 1672 x 941 and every coordinate below is in those image pixels.
  const W = 1672, H = 941;

  // fx types: glow (pulsing additive light), motes (dust in a rect or along a light beam),
  // smoke (puffs from sources, optional clip rects), embers, snow, sparkle (twinkles on water),
  // birds (tiny silhouettes crossing a rect), glints (one star flash at a time on metal).
  const PAINTINGS = {
    'the-calling': { file: 'menu/the-calling.jpg', title: 'The calling', after: 'after Caravaggio, 1600', use: 'menu', anchorX: 0.75, fx: [
      { t: 'glow', x: 1131, y: 640, r: 420, rgb: '255,168,78', base: 0.05, amp: 0.04, sp: 1.3 },
      { t: 'glow', x: 1131, y: 636, r: 170, rgb: '255,168,78', base: 0.10, amp: 0.09, sp: 1.3 },
      { t: 'glow', x: 1131, y: 628, r: 14, rgb: '255,236,190', base: 0.35, amp: 0.30, sp: 1.3, jit: 1.2 },
      { t: 'glow', x: 1565, y: 60, r: 150, rgb: '255,236,205', base: 0.05, amp: 0.05, sp: 0.35 },
      { t: 'motes', beam: [[1565, 55], [1165, 565], 40, 120], n: 90, rgb: '255,238,200' },
      { t: 'smoke', src: [[1330, 512], [1552, 492]], every: 0.22, rgb: '205,196,178', a: 0.085, rise: -0.45, drift: 0.07, grow: 5, life: [4, 6.5], mode: 'screen' },
      { t: 'glints', pts: [[752, 512], [1372, 447], [1452, 498], [1588, 423], [1076, 698], [1233, 250]] }] },
    'the-letter': { file: 'menu/the-letter.jpg', title: 'The letter', after: 'in the manner of Caravaggio', use: 'menu', anchorX: 0.75, fx: [
      { t: 'glow', x: 1250, y: 160, r: 190, rgb: '255,226,180', base: 0.05, amp: 0.04, sp: 0.35 },
      { t: 'glow', x: 1288, y: 585, r: 150, rgb: '255,150,60', base: 0.09, amp: 0.08, sp: 1.6 },
      { t: 'glow', x: 1288, y: 590, r: 18, rgb: '255,220,160', base: 0.30, amp: 0.25, sp: 2.2, jit: 1.2 },
      { t: 'motes', beam: [[1640, 30], [1360, 520], 60, 170], n: 80, rgb: '255,236,196' },
      { t: 'motes', rect: [900, 120, 480, 480], n: 30, rgb: '255,230,190' },
      { t: 'smoke', src: [[1292, 570]], every: 0.4, rgb: '190,180,165', a: 0.07, rise: -0.4, drift: 0.04, grow: 6, life: [5, 7], mode: 'screen' },
      { t: 'glints', pts: [[1005, 440], [1340, 520], [1440, 475], [1612, 425], [1310, 705], [1195, 640], [1110, 453]] }] },
    'the-wounded': { file: 'menu/the-wounded.jpg', title: 'The wounded', after: 'in the manner of Caravaggio', use: 'menu', anchorX: 0.75, fx: [
      { t: 'glow', x: 1500, y: 200, r: 220, rgb: '255,230,190', base: 0.05, amp: 0.04, sp: 0.3 },
      { t: 'motes', beam: [[870, 50], [1360, 520], 40, 150], n: 70, rgb: '255,236,196' },
      { t: 'motes', beam: [[1540, 60], [1672, 400], 30, 100], n: 35, rgb: '255,236,196' },
      { t: 'smoke', src: [[1460, 470], [1330, 430]], every: 0.6, rgb: '200,190,172', a: 0.05, rise: -0.25, drift: 0.1, grow: 8, life: [7, 10], mode: 'screen' },
      { t: 'glints', pts: [[930, 240], [1215, 265], [995, 420], [1190, 460], [1520, 390], [1440, 410], [1090, 820]] }] },
    'the-crossing': { file: 'loading/01-the-crossing.jpg', title: 'The crossing', after: 'after Leutze, 1851', use: 'loading', fx: [
      { t: 'glow', x: 190, y: 235, r: 300, rgb: '255,196,110', base: 0.07, amp: 0.05, sp: 0.35 },
      { t: 'glow', x: 190, y: 235, r: 90, rgb: '255,236,190', base: 0.10, amp: 0.06, sp: 0.5 },
      { t: 'sparkle', r: [0, 470, 1672, 470], n: 30, rgb: '255,244,220' },
      { t: 'snow', n: 80 },
      { t: 'glints', pts: [[390, 478], [1152, 515], [957, 345], [798, 350], [1043, 118]] }] },
    'over-the-barricade': { file: 'loading/02-over-the-barricade.jpg', title: 'Over the barricade', after: 'after Delacroix, 1830', use: 'loading', fx: [
      { t: 'glow', x: 1470, y: 470, r: 300, rgb: '255,120,40', base: 0.10, amp: 0.08, sp: 1.4 },
      { t: 'glow', x: 1250, y: 500, r: 170, rgb: '255,140,50', base: 0.08, amp: 0.07, sp: 1.9 },
      { t: 'glow', x: 170, y: 440, r: 150, rgb: '255,120,40', base: 0.07, amp: 0.06, sp: 1.6 },
      { t: 'smoke', src: [[1420, 330], [1560, 300], [260, 300]], every: 0.35, rgb: '38,30,24', a: 0.16, rise: -0.35, drift: -0.12, grow: 9, life: [6, 9], mode: 'source-over' },
      { t: 'embers', r: [1100, 380, 572, 220], n: 40 },
      { t: 'embers', r: [60, 390, 300, 120], n: 12 },
      { t: 'glints', pts: [[497, 345], [1143, 282], [1300, 470], [1238, 428], [590, 578]] }] },
    'the-company-moves-out': { file: 'loading/03-the-company-moves-out.jpg', title: 'The company moves out', after: 'after Rembrandt, 1642', use: 'loading', fx: [
      { t: 'glow', x: 1600, y: 220, r: 260, rgb: '255,214,140', base: 0.06, amp: 0.04, sp: 0.4 },
      { t: 'glow', x: 880, y: 850, r: 220, rgb: '255,210,140', base: 0.05, amp: 0.03, sp: 0.5 },
      { t: 'motes', beam: [[1620, 60], [880, 840], 70, 260], n: 110, rgb: '255,236,196' },
      { t: 'glints', pts: [[1560, 706], [1245, 493], [872, 628], [1541, 392], [762, 442], [1383, 272]] }] },
    'the-war-council': { file: 'loading/04-the-war-council.jpg', title: 'The war council', after: 'after Raphael, 1511', use: 'loading', fx: [
      { t: 'glow', x: 835, y: 250, r: 170, rgb: '255,232,190', base: 0.05, amp: 0.04, sp: 0.3 },
      { t: 'birds', r: [718, 150, 236, 150], n: 3 },
      { t: 'motes', rect: [450, 260, 780, 520], n: 70, rgb: '255,240,210' },
      { t: 'glints', pts: [[390, 570], [1422, 505], [1570, 820], [778, 330], [885, 340], [1414, 548]] }] },
    'the-last-mess': { file: 'loading/05-the-last-mess.jpg', title: 'The last mess', after: 'after Leonardo, 1498', use: 'loading', fx: [
      { t: 'glow', x: 651, y: 560, r: 230, rgb: '255,168,78', base: 0.10, amp: 0.08, sp: 1.3 },
      { t: 'glow', x: 651, y: 552, r: 14, rgb: '255,236,190', base: 0.35, amp: 0.30, sp: 2.2, jit: 1.2 },
      { t: 'glow', x: 830, y: 390, r: 130, rgb: '255,130,60', base: 0.05, amp: 0.04, sp: 0.4 },
      { t: 'smoke', src: [[530, 300], [790, 250], [1125, 270]], every: 0.45, rgb: '70,62,64', a: 0.18, rise: -0.22, drift: 0.06, grow: 5, life: [7, 10], mode: 'source-over', clip: [[448, 198, 140, 232], [725, 194, 205, 212], [1050, 198, 140, 232]] },
      { t: 'motes', rect: [380, 380, 920, 260], n: 35, rgb: '255,220,170' },
      { t: 'glints', pts: [[1132, 568], [1342, 574], [266, 560], [1270, 582], [455, 556]] }] },
    'the-light': { file: 'loading/06-the-light.jpg', title: 'The light', after: 'after Michelangelo, 1512', use: 'loading', fx: [
      // Only a tiny ember at the cigarette tip: a bigger glow read as the cigarette on fire.
      { t: 'glow', x: 670, y: 441, r: 12, rgb: '255,120,50', base: 0.18, amp: 0.14, sp: 1.1 },
      { t: 'glow', x: 670, y: 441, r: 3.5, rgb: '255,210,150', base: 0.35, amp: 0.25, sp: 1.6 },
      { t: 'smoke', src: [[668, 443]], every: 0.2, rgb: '215,205,188', a: 0.10, rise: -0.45, drift: 0.05, grow: 4, life: [4, 6], mode: 'screen' },
      { t: 'motes', rect: [150, 0, 850, 680], n: 60, rgb: '255,226,160' },
      { t: 'glints', pts: [[148, 372], [1100, 470], [1062, 492], [1058, 176], [1545, 300]] }] }
  };

  const rnd = (a, b) => a + Math.random() * (b - a);
  const wob = (t, s) => Math.sin(t * 1.7 + s) * 0.5 + Math.sin(t * 4.3 + s * 2.1) * 0.3 + Math.sin(t * 9.1 + s * 3.7) * 0.2;
  const sprites = {};
  function sprite(rgb) {
    if (sprites[rgb]) return sprites[rgb];
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return (sprites[rgb] = c);
  }

  // Beam strength at a point: 0 outside, 1 on the axis near the source.
  function inBeam(fx, x, y) {
    const [[ax, ay], [bx, by], w0, w1] = fx.beam, dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const t = ((x - ax) * dx + (y - ay) * dy) / L2; if (t < 0 || t > 1) return 0;
    const d = Math.abs((x - ax) * dy - (y - ay) * dx) / Math.sqrt(L2), w = w0 + (w1 - w0) * t;
    if (d > w) return 0; const e = 1 - d / w; return e * e * (1 - t * 0.35);
  }
  function spawnMote(fx, p, any) {
    if (fx.beam) {
      const [[ax, ay], [bx, by]] = fx.beam; let x, y;
      do { x = rnd(Math.min(ax, bx) - 260, Math.max(ax, bx) + 60); y = rnd(Math.min(ay, by) - 40, Math.max(ay, by)); } while (inBeam(fx, x, y) < 0.08);
      p.x = x; p.y = y;
    } else { const [x, y, w, h] = fx.rect; p.x = rnd(x, x + w); p.y = rnd(y, y + h); }
    p.vx = rnd(-0.12, 0.12); p.vy = rnd(-0.06, 0.1); p.r = rnd(1, 2.6); p.a = any ? rnd(0, 1) : 0; p.tw = rnd(0, 6.3); p.life = 0; p.max = rnd(5, 11);
    return p;
  }
  function spawnEmber(fx, p, any) {
    const [x, y, w, h] = fx.r;
    p.x = rnd(x, x + w); p.y = y + h - rnd(0, any ? h : 20); p.vy = rnd(-0.9, -0.4); p.vx = rnd(-0.2, 0.2);
    p.r = rnd(1.4, 3); p.life = any ? rnd(0, 3) : 0; p.max = rnd(2.5, 4.5); p.s = rnd(0, 6);
    return p;
  }
  // Fresh particle state per effect, so two canvases showing the same painting stay independent.
  function initFx(def) {
    const fx = Object.assign({ seed: rnd(0, 50) }, def);
    if (fx.t === 'motes') fx.p = Array.from({ length: fx.n }, () => spawnMote(fx, {}, true));
    if (fx.t === 'snow') fx.p = Array.from({ length: fx.n }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(1.2, 3), v: rnd(0.6, 1.4), s: rnd(0, 6) }));
    if (fx.t === 'sparkle') fx.p = Array.from({ length: fx.n }, () => ({ x: 0, y: 0, t: rnd(0, 3), d: rnd(0.6, 1.4) }));
    if (fx.t === 'embers') fx.p = Array.from({ length: fx.n }, () => spawnEmber(fx, {}, true));
    if (fx.t === 'birds') fx.p = Array.from({ length: fx.n }, (_, i) => ({ x: fx.r[0] - rnd(0, 200) - i * 60, y: fx.r[1] + rnd(20, fx.r[3] - 30), v: rnd(0.35, 0.6), s: rnd(0, 6) }));
    if (fx.t === 'smoke') { fx.p = []; fx.acc = 0; }
    if (fx.t === 'glints') { fx.g = null; fx.next = rnd(0.8, 2); }
    return fx;
  }

  function create(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    const base = opts.base != null ? opts.base : 'assets/paintings/';
    const reduce = opts.reducedMotion != null ? opts.reducedMotion : matchMedia('(prefers-reduced-motion: reduce)').matches;
    let id = null, img = null, fxs = [], time = 0, last = 0, raf = 0, running = false, anchorX = 0.5;

    function dot(rgb, x, y, r, a) {
      if (a <= 0.002) return;
      ctx.globalAlpha = Math.min(a, 1); ctx.drawImage(sprite(rgb), x - r, y - r, r * 2, r * 2);
    }

    function step(fx, dt) {
      switch (fx.t) {
        case 'glow': {
          const n = wob(time * fx.sp, fx.seed), f = 0.5 + 0.5 * n, j = fx.jit ? n * fx.jit : 0;
          ctx.globalCompositeOperation = 'lighter'; dot(fx.rgb, fx.x + j, fx.y, fx.r * (0.94 + 0.08 * n), fx.base + fx.amp * f); break;
        }
        case 'motes': {
          ctx.globalCompositeOperation = 'lighter';
          for (const p of fx.p) {
            p.life += dt; p.tw += dt * 2.2; p.vx += rnd(-0.02, 0.02); p.vy += rnd(-0.015, 0.017); p.vx *= 0.98; p.vy *= 0.98;
            p.x += p.vx * dt * 60; p.y += p.vy * dt * 60; p.a = Math.min(1, p.a + dt * 0.5);
            const b = fx.beam ? inBeam(fx, p.x, p.y) : 1, fade = fx.beam ? 1 : Math.sin(Math.min(p.life / p.max, 1) * Math.PI);
            if ((fx.beam && b < 0.03) || (!fx.beam && p.life > p.max)) { spawnMote(fx, p, false); continue; }
            dot(fx.rgb, p.x, p.y, p.r * 2.2, p.a * b * fade * (0.4 + 0.3 * Math.sin(p.tw)) * (fx.beam ? 1 : 0.55));
          }
          break;
        }
        case 'snow': {
          ctx.globalCompositeOperation = 'screen';
          for (const p of fx.p) {
            p.s += dt; p.y += p.v * dt * 60; p.x += (-0.35 + Math.sin(p.s * 1.3) * 0.3) * dt * 60;
            if (p.y > H + 5) { p.y = -5; p.x = rnd(0, W + 200); } if (p.x < -5) p.x = W + 5;
            dot('245,240,232', p.x, p.y, p.r * 1.6, 0.55);
          }
          break;
        }
        case 'sparkle': {
          ctx.globalCompositeOperation = 'lighter'; const [x, y, w, h] = fx.r;
          for (const p of fx.p) {
            p.t += dt; if (p.t > p.d) { p.t = -rnd(0, 2.5); p.d = rnd(0.5, 1.2); p.x = rnd(x, x + w); p.y = rnd(y, y + h); }
            if (p.t < 0) continue; const a = Math.sin(p.t / p.d * Math.PI);
            dot(fx.rgb, p.x, p.y, 3 + 4 * a, 0.55 * a);
            ctx.globalAlpha = 0.4 * a; ctx.strokeStyle = `rgb(${fx.rgb})`; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(p.x - 7 * a, p.y); ctx.lineTo(p.x + 7 * a, p.y); ctx.stroke();
          }
          break;
        }
        case 'embers': {
          ctx.globalCompositeOperation = 'lighter';
          for (const p of fx.p) {
            p.life += dt; p.s += dt * 2; if (p.life > p.max) { spawnEmber(fx, p, false); continue; }
            p.x += (p.vx + Math.sin(p.s) * 0.35) * dt * 60; p.y += p.vy * dt * 60;
            const u = p.life / p.max, a = (1 - u) * Math.min(1, p.life * 4);
            dot('255,150,60', p.x, p.y, p.r * 3, 0.35 * a); dot('255,225,160', p.x, p.y, p.r * 0.9, 0.8 * a);
          }
          break;
        }
        case 'smoke': {
          fx.acc += dt;
          if (fx.acc > fx.every) {
            fx.acc = 0;
            for (const [sx, sy] of fx.src) fx.p.push({ x: sx + rnd(-3, 3), y: sy, vx: fx.drift + rnd(-0.08, 0.08), vy: fx.rise * rnd(0.8, 1.2), r: rnd(4, 7), life: 0, max: rnd(fx.life[0], fx.life[1]), s: rnd(0, 6) });
          }
          ctx.save();
          if (fx.clip) { ctx.beginPath(); for (const [a, b, c, d] of fx.clip) ctx.rect(a, b, c, d); ctx.clip(); }
          ctx.globalCompositeOperation = fx.mode;
          for (let i = fx.p.length - 1; i >= 0; i--) {
            const s = fx.p[i]; s.life += dt; if (s.life > s.max) { fx.p.splice(i, 1); continue; }
            const u = s.life / s.max; s.x += (s.vx + Math.sin(s.s + s.life * 1.2) * 0.18) * dt * 60; s.y += s.vy * dt * 60; s.r += dt * fx.grow;
            dot(fx.rgb, s.x, s.y, s.r, fx.a * Math.sin(u * Math.PI));
          }
          ctx.restore(); break;
        }
        case 'birds': {
          const [x, y, w, h] = fx.r;
          ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
          ctx.strokeStyle = 'rgba(40,34,30,.75)'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
          for (const b of fx.p) {
            b.s += dt * 9; b.x += b.v * dt * 60; b.y += Math.sin(b.s * 0.15) * 0.15;
            if (b.x > x + w + 20) { b.x = x - rnd(40, 260); b.y = y + rnd(20, h - 30); }
            const fl = Math.sin(b.s) * 3;
            ctx.beginPath(); ctx.moveTo(b.x - 5, b.y - fl); ctx.quadraticCurveTo(b.x - 2, b.y - 1, b.x, b.y); ctx.quadraticCurveTo(b.x + 2, b.y - 1, b.x + 5, b.y - fl); ctx.stroke();
          }
          ctx.restore(); break;
        }
        case 'glints': {
          ctx.globalCompositeOperation = 'lighter'; fx.next -= dt;
          if (!fx.g && fx.next <= 0) { const [gx, gy] = fx.pts[Math.floor(Math.random() * fx.pts.length)]; fx.g = { x: gx, y: gy, t: 0, d: rnd(0.7, 1.1) }; fx.next = rnd(1.6, 3.4); }
          if (fx.g) {
            const g = fx.g; g.t += dt; const u = g.t / g.d;
            if (u >= 1) fx.g = null;
            else {
              const a = Math.sin(u * Math.PI), len = 9 + 14 * a;
              dot('255,244,220', g.x, g.y, 9 * a, 0.6 * a);
              ctx.globalAlpha = 0.55 * a; ctx.strokeStyle = 'rgb(255,238,205)'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
              ctx.beginPath(); ctx.moveTo(g.x - len, g.y); ctx.lineTo(g.x + len, g.y); ctx.moveTo(g.x, g.y - len * 0.7); ctx.lineTo(g.x, g.y + len * 0.7); ctx.stroke();
            }
          }
          break;
        }
      }
    }

    // Cover-fit the painting into the canvas; anchorX picks which side survives the crop on
    // screens narrower than 16:9 (the menu keeps its figures, the dark left may shrink).
    function draw(dt) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(canvas.clientWidth * dpr), ch = Math.round(canvas.clientHeight * dpr);
      if (!cw || !ch) return;
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      const s = Math.max(cw / W, ch / H), ox = (cw - W * s) * anchorX, oy = (ch - H * s) / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cw, ch);
      if (!img || !img.complete || !img.naturalWidth) return;
      ctx.setTransform(s, 0, 0, s, ox, oy); ctx.drawImage(img, 0, 0, W, H);
      if (!reduce) { time += dt; for (const fx of fxs) step(fx, dt); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }

    function frame(now) {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0; last = now;
      draw(dt);
      if (running) raf = requestAnimationFrame(frame);
    }

    const api = {
      // Switch painting; resolves once the image is loaded (use it to time a crossfade).
      show(next) {
        const def = PAINTINGS[next]; if (!def) return Promise.reject(new Error('Unknown painting ' + next));
        id = next; anchorX = def.anchorX != null ? def.anchorX : 0.5; fxs = def.fx.map(initFx); time = 0;
        const im = new Image(); im.src = base + def.file; img = im;
        return (im.decode ? im.decode() : new Promise(r => { im.onload = r; })).then(() => { if (!running) draw(0); return def; });
      },
      start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
      get id() { return id; }
    };
    return api;
  }

  const ids = use => Object.keys(PAINTINGS).filter(k => !use || PAINTINGS[k].use === use);
  // Equal chance for every painting of a kind, so adding a menu painting changes the odds by itself.
  const pick = use => { const a = ids(use); return a[Math.floor(Math.random() * a.length)]; };
  return { W, H, PAINTINGS, create, ids, pick, info: k => PAINTINGS[k] };
})();
