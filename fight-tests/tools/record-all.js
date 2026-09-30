// Records the typical fight of every scenario in fight-tests/<patch>/data/fights-batch.json (and the
// other outcome when the underdog wins at least 15%), then joins each group's clips into one video
// in fight-tests/<patch>/videos. Usage: node record-all.js <patch>   (preview server must be running)
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const { chromium } = require('playwright'); const { record, FF, CHROME } = require('./record.js');
const patch = process.argv[2]; const base = path.join(__dirname, '..', patch);
const batch = JSON.parse(fs.readFileSync(path.join(base, 'data', 'fights-batch.json'), 'utf8'));
const clips = path.join(base, 'clips'), vids = path.join(base, 'videos'); fs.mkdirSync(clips, { recursive: true }); fs.mkdirSync(vids, { recursive: true });
const who = w => w === 1 ? 'blue' : 'red';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME }); const groups = {};
  for (const r of batch) {
    const usual = r.winA >= r.winB ? 1 : 2, pu = usual === 1 ? r.winA : r.winB, po = usual === 1 ? r.winB : r.winA, jobs = [];
    if (r.typicalSeed) jobs.push(['typical', r.typicalSeed, 'typical fight: ' + who(usual) + ' wins ' + pu + '% of ' + r.runs]);
    if (r.upsetSeed && po >= 15) jobs.push(['upset', r.upsetSeed, 'the other outcome: ' + who(3 - usual) + ' wins ' + po + '% of ' + r.runs]);
    for (const [kind, seed, note] of jobs) {
      const out = path.join(clips, r.id + '-' + kind + '.mp4');
      if (!fs.existsSync(out)) { await record(browser, out, r.id, seed, note); console.log(r.id, kind); }
      (groups[r.group] = groups[r.group] || []).push(out);
    }
  }
  await browser.close(); let n = 0;
  for (const [g, files] of Object.entries(groups)) {
    const list = path.join(clips, 'list-' + (++n) + '.txt'); fs.writeFileSync(list, files.map(f => "file '" + f + "'").join('\n'));
    execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', path.join(vids, 'Dot-War-fights-' + n + '-' + g.replace(/[^A-Za-z]+/g, '-').replace(/-+$/, '') + '.mp4')]);
  }
  console.log('Group videos in', vids, '(the clips folder can be deleted; it is not committed)');
})();
