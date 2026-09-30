// The Balance Lab "Meta snapshot" (LabTests.metaSnapshot), its pieces spread over the CPU cores.
// Usage: node meta.js <patch> [runs=30]   Writes fight-tests/<patch>/data/meta.json (same shape as lab/meta-baseline.js).
const path = require('path'), fs = require('fs'), { fork } = require('child_process');
if (process.argv[2] === '--worker') {
  const { LabTests } = require('./harness.js')(['lab/lab-tests.js']);
  process.on('message', ({ piece, runs }) => {
    const r = piece === 'duels' ? LabTests.metaDuels(runs) : piece === 'terrain' ? LabTests.metaTerrain(Math.max(runs, 50)) : piece === 'forts' ? LabTests.metaForts(runs)
      : piece === 'economy' ? LabTests.metaEconomy() : LabTests.aiPressure({ seed: 1, difficulty: piece, minutes: 30 });
    process.send({ piece, r }); process.exit(0);
  });
  return;
}
const patch = process.argv[2], runs = +(process.argv[3] || 30); const t0 = Date.now();
const pieces = ['duels', 'terrain', 'forts', 'economy', 'easy', 'normal', 'hard'], got = {};
const round = (k, v) => typeof v === 'number' ? +v.toFixed(2) : v;
for (const piece of pieces) {
  const c = fork(__filename, ['--worker']); c.send({ piece, runs });
  c.on('message', ({ piece, r }) => {
    got[piece] = r; console.log(piece, 'done', ((Date.now() - t0) / 1000).toFixed(0) + ' s');
    if (Object.keys(got).length === pieces.length) {
      const out = { build: patch, duels: got.duels, terrain: got.terrain, forts: got.forts, economy: got.economy, ai: [got.easy, got.normal, got.hard] };
      const dir = path.join(__dirname, '..', patch, 'data'); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(out, round, 1)); console.log('written', path.join(dir, 'meta.json'));
    }
  });
}
