// Runs every fight in lab/fight-scenarios.js many times (headless, full speed) plus AI-versus-AI
// matches, and saves the numbers for one patch. Usage: node batch.js <patch> [runs=40] [aiMinutes=40]
// Writes fight-tests/<patch>/data/fights-batch.json and ai-stats.json. Takes about an hour.
const path = require('path'), fs = require('fs');
const { FightScenarios: F, LabTests, G } = require('./harness.js')(['lab/lab-tests.js', 'lab/fight-scenarios.js']);
const patch = process.argv[2]; if (!patch) { console.log('Usage: node batch.js <patch> [runs] [aiMinutes]'); process.exit(1); }
const runs = +(process.argv[3] || 40), mins = +(process.argv[4] || 40);
const dir = path.join(__dirname, '..', patch, 'data'); fs.mkdirSync(dir, { recursive: true });
const out = [];
for (const s of F.LIST) { const r = F.batch(s.id, runs); out.push(r); fs.writeFileSync(path.join(dir, 'fights-batch.json'), JSON.stringify(out, null, 1)); console.log(s.id, r.winA, r.winB, r.draw); }
const ai = [];
for (const difficulty of ['easy', 'normal', 'hard']) for (const seed of [1, 2]) {
  const m = LabTests.aiMatch({ seed, difficulty, maxMinutes: mins }); let r; while (!(r = m.step(1800)));
  Object.assign(r, { difficulty, seed, lost: [G.stats[1].lost, G.stats[2].lost] }); ai.push(r);
  fs.writeFileSync(path.join(dir, 'ai-stats.json'), JSON.stringify(ai, null, 1)); console.log('AI', difficulty, seed, r.winner, r.minutes.toFixed(1));
}
