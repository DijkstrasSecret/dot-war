// Runs every fight in lab/fight-scenarios.js many times (headless, full speed) plus AI-versus-AI
// matches, spread over all CPU cores, and saves the numbers for one patch.
// Usage: node batch.js <patch> [runs=40] [aiMinutes=40] [workers=all cores]
// Writes fight-tests/<patch>/data/fights-batch.json and ai-stats.json.
const path = require('path'), fs = require('fs'), os = require('os'), { fork } = require('child_process');

if (process.argv[2] === '--worker') {
  // One simulation context per worker process; jobs arrive as messages.
  const { FightScenarios: F, LabTests, G } = require('./harness.js')(['lab/lab-tests.js', 'lab/fight-scenarios.js']);
  process.on('message', job => {
    if (job.kind === 'fight') process.send({ job, result: F.batch(job.id, job.runs) });
    else {
      const m = LabTests.aiMatch({ seed: job.seed, difficulty: job.difficulty, maxMinutes: job.mins }); let r; while (!(r = m.step(1800)));
      process.send({ job, result: Object.assign(r, { difficulty: job.difficulty, seed: job.seed, lost: [G.stats[1].lost, G.stats[2].lost] }) });
    }
  });
  return;
}

const patch = process.argv[2]; if (!patch) { console.log('Usage: node batch.js <patch> [runs] [aiMinutes] [workers]'); process.exit(1); }
const runs = +(process.argv[3] || 40), mins = +(process.argv[4] || 40), nWorkers = +(process.argv[5] || os.cpus().length);
const dir = path.join(__dirname, '..', patch, 'data'); fs.mkdirSync(dir, { recursive: true });
const { FightScenarios } = require('./harness.js')(['lab/fight-scenarios.js']);
// AI matches first: they are the longest jobs, so they start while the fights fill the other cores.
const jobs = [];
for (const difficulty of ['hard', 'normal', 'easy']) for (const seed of [1, 2]) if (mins > 0) jobs.push({ kind: 'ai', difficulty, seed, mins });
for (const s of FightScenarios.LIST) jobs.push({ kind: 'fight', id: s.id, runs });
const fights = {}, ai = {}; let next = 0, done = 0; const t0 = Date.now();
const save = () => {
  fs.writeFileSync(path.join(dir, 'fights-batch.json'), JSON.stringify(FightScenarios.LIST.map(s => fights[s.id]).filter(Boolean), null, 1));
  const order = ['easy', 'normal', 'hard'].flatMap(d => [1, 2].map(seed => ai[d + seed])).filter(Boolean);
  if (order.length) fs.writeFileSync(path.join(dir, 'ai-stats.json'), JSON.stringify(order, null, 1));
};
for (let w = 0; w < Math.min(nWorkers, jobs.length); w++) {
  const child = fork(__filename, ['--worker']);
  const give = () => { if (next < jobs.length) child.send(jobs[next++]); else child.kill(); };
  child.on('message', ({ job, result }) => {
    if (job.kind === 'fight') fights[job.id] = result; else ai[job.difficulty + job.seed] = result;
    done++; save();
    console.log(`[${done}/${jobs.length}] ${((Date.now() - t0) / 1000).toFixed(0)} s`, job.kind === 'fight' ? `${job.id} ${result.winA}/${result.winB}/${result.draw}` : `AI ${job.difficulty} ${job.seed} winner ${result.winner} at ${result.minutes.toFixed(1)} min`);
    give();
  });
  give();
}
