// Records one Fight Theatre fight to mp4, frame by frame (1 simulation tick per frame at 30 fps =
// one game second per video second). Needs the preview server on port 8765, Playwright with Chromium,
// and an ffmpeg with H.264 (FFMPEG=/path/to/ffmpeg, default: `pip install imageio-ffmpeg`'s binary).
// Usage: node record.js out.mp4 <scenario> <seed> [note]
const { chromium } = require('playwright'); const { spawn } = require('child_process');
const FF = process.env.FFMPEG || (() => { try { return require('child_process').execSync('python3 -c "import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())"').toString().trim(); } catch (e) { return 'ffmpeg'; } })();
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
async function record(browser, out, id, seed, note, opts = {}) {
  const extra = opts.query || '';
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/theatre.html?rec=1&s=' + id + '&seed=' + seed + '&note=' + encodeURIComponent(note || '') + extra);
  await page.waitForFunction(() => typeof Theatre !== 'undefined' && Theatre.run, null, { timeout: 20000 });
  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(opts.fps || 30), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', String(opts.crf || 24), '-movflags', '+faststart', out]);
  const shot = async () => { const b = await page.screenshot({ type: 'jpeg', quality: 85 }); if (!ff.stdin.write(b)) await new Promise(r => ff.stdin.once('drain', r)); };
  const steps = opts.steps || 1, maxFrames = opts.maxFrames || 30 * 150; let frames = 0, st;
  for (let i = 0; i < (opts.fps || 30); i++) { await page.evaluate(() => Theatre.frame(0)); await shot(); }   // one still second to read the title
  do { st = await page.evaluate(s => Theatre.frame(s), steps); await shot(); frames++; } while ((!st.done || st.endT < 3.5 * steps) && frames < maxFrames);
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await page.close();
  return { out, frames, result: st.result, errors };
}
module.exports = { record, FF, CHROME };
if (require.main === module) (async () => {
  const [out, id, seed, note] = process.argv.slice(2);
  const browser = await chromium.launch({ executablePath: CHROME });
  const t = Date.now(); const r = await record(browser, out, id, +seed || 1, note); console.log(JSON.stringify(r), (Date.now() - t) / 1000 + 's');
  await browser.close();
})();
