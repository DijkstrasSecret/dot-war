'use strict';
// Loading screen: a random loading painting (PaintingFx) with a title plaque and a gold progress
// bar driven by real work. Loading.run(steps) shows the screen, runs each step between frames so
// the bar repaints, then fades out. Visual only; the simulation never calls it.
const Loading = (() => {
  const MIN_SHOW = 1.4;      // seconds the painting stays up even when the build is quick, so the fade-in completes
  const IMAGE_WAIT = 4000;   // ms to wait for the painting before loading without it
  let root = null, fx = null, els = null;

  function ensure() {
    if (root) return;
    root = document.getElementById('loading');
    els = { title: root.querySelector('.plaque h2'), after: root.querySelector('.plaque p'), label: root.querySelector('.row span:first-child'), pct: root.querySelector('.row span:last-child'), fill: root.querySelector('.fill'), bar: root.querySelector('.load'), veil: root.querySelector('.veil') };
    fx = PaintingFx.create(root.querySelector('canvas'), { base: 'assets/paintings/' });
  }
  function setProgress(f, label) {
    const p = Math.round(f * 100);
    els.fill.style.width = p + '%'; els.pct.textContent = p + '%'; els.bar.setAttribute('aria-valuenow', p);
    if (label) els.label.textContent = label;
  }
  const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // steps: [{ label, run }] executed in order. Resolves once the screen has faded out again.
  async function run(steps) {
    ensure();
    const t0 = performance.now();
    root.classList.remove('hidden'); els.veil.classList.remove('clear');
    const id = PaintingFx.pick('loading'), info = PaintingFx.info(id);
    els.title.textContent = info.title; els.after.textContent = info.after;
    setProgress(0, steps.length ? steps[0].label : 'Loading');
    // Fade from black once the painting is in; keep going without it if it never arrives.
    await Promise.race([fx.show(id).then(() => { fx.start(); els.veil.classList.add('clear'); }), wait(IMAGE_WAIT)]).catch(() => {});
    for (let i = 0; i < steps.length; i++) {
      setProgress(i / steps.length, steps[i].label);
      await nextFrame(); await nextFrame();   // one frame to paint the bar, one so the paint is visible before the work blocks
      steps[i].run();
    }
    setProgress(1, 'Ready');
    const left = MIN_SHOW * 1000 - (performance.now() - t0);
    if (left > 0) await wait(left);
    els.veil.classList.remove('clear'); await wait(450);
    fx.stop(); root.classList.add('hidden');
  }

  return { run, get active() { return !!root && !root.classList.contains('hidden'); } };
})();
