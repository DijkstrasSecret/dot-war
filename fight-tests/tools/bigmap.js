// Big-map tests for patch 0.7 (13 km generated maps), spread over the CPU cores:
//  - pressure: a player who orders nothing, on each difficulty and several maps;
//  - AI v AI: the commander on both sides of a big map, with buff sites, citadels and villages;
//  - checks: the Balance Lab's behaviour and map checks on many seeds, and the siege check on several maps.
// Usage: node bigmap.js <patch> [workers]   Writes fight-tests/<patch>/data/bigmap.json.
const path = require('path'), fs = require('fs'), os = require('os'), { fork } = require('child_process');
if (process.argv[2] === '--worker') {
  const api = require('./harness.js')(['lab/lab-tests.js']), { G, Sim, LabTests, Util } = api;
  const sites = () => { const o = {}; for (const b of G.buildings) if ((b.def.site || b.def.citadel) && !b.dead) o[b.owner] = (o[b.owner] || 0) + 1; return o; };
  const civLost = () => G.units.filter(u => u.def.civilian && u.dead).length + (G.stats[3] ? G.stats[3].lost : 0);
  process.on('message', job => {
    const t0 = Date.now(); let r;
    if (job.kind === 'pressure') {
      Sim.newMatch({ map: 'random', difficulty: job.difficulty, seed: job.seed });
      const hq = G.buildings.find(b => b.type === 'hq' && b.owner === 1); let first = null; const timeline = [];
      for (let s = 0; s < job.mins * 60 && !hq.dead; s++) {
        Sim.run(30);
        if (first == null && G.units.some(u => u.owner === 2 && !u.dead && Util.dist(u.x, u.y, hq.x, hq.y) < 500)) first = G.time / 60;
        if (s % 300 === 299) timeline.push({ min: Math.round(G.time / 60), army: G.units.filter(u => u.owner === 2 && !u.dead && !u.def.labour).length, sites: sites() });
      }
      r = { first, hqDead: hq.dead ? G.time / 60 : null, timeline, civiliansLost: G.stats[3].lost };
    } else if (job.kind === 'aivai') {
      const m = LabTests.aiMatch({ seed: job.seed, difficulty: job.difficulty, maxMinutes: job.mins, map: 'random' }); let res; const timeline = [];
      while (!(res = m.step(1800 * 5))) timeline.push({ min: Math.round(G.time / 60), army: [1, 2].map(p => G.units.filter(u => u.owner === p && !u.dead && !u.def.labour).length), lost: [G.stats[1].lost, G.stats[2].lost], sites: sites(), ms: Date.now() - t0 });
      r = Object.assign(res, { timeline, lost: [G.stats[1].lost, G.stats[2].lost], civiliansLost: G.stats[3].lost, neutralLost: G.stats[0].lost, sitesEnd: sites() });
    } else if (job.kind === 'checks') {
      r = { behaviour: LabTests.behaviourChecks(job.seed).map(c => ({ name: c.name, pass: c.pass, detail: c.detail })), map: LabTests.mapChecks(job.seed).map(c => ({ name: c.name, pass: c.pass, detail: c.detail })) };
    }
    process.send({ job, result: Object.assign(r, { computeS: (Date.now() - t0) / 1000 }) });
  });
  return;
}
const patch = process.argv[2], nWorkers = +(process.argv[3] || os.cpus().length);
const dir = path.join(__dirname, '..', patch, 'data'); fs.mkdirSync(dir, { recursive: true });
const jobs = [];
for (const difficulty of ['hard', 'normal']) for (const seed of [1, 2, 3]) jobs.push({ kind: 'aivai', difficulty, seed, mins: 75 });
for (const difficulty of ['easy', 'normal', 'hard']) for (const seed of [1, 2, 3, 4]) jobs.push({ kind: 'pressure', difficulty, seed, mins: 45 });
for (let seed = 1; seed <= 10; seed++) jobs.push({ kind: 'checks', seed });
const out = { aivai: [], pressure: [], checks: [] }; let next = 0, done = 0; const t0 = Date.now();
for (let w = 0; w < Math.min(nWorkers, jobs.length); w++) {
  const child = fork(__filename, ['--worker']);
  const give = () => { if (next < jobs.length) child.send(jobs[next++]); else child.kill(); };
  child.on('message', ({ job, result }) => {
    out[job.kind].push(Object.assign({ job }, result)); done++;
    fs.writeFileSync(path.join(dir, 'bigmap.json'), JSON.stringify(out, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v, 1));
    console.log(`[${done}/${jobs.length}] ${((Date.now() - t0) / 1000).toFixed(0)} s ${job.kind} ${job.difficulty || ''} ${job.seed}`, job.kind === 'checks' ? (result.behaviour.concat(result.map).filter(c => !c.pass).map(c => 'FAIL ' + c.name).join('; ') || 'all pass') : job.kind === 'aivai' ? `winner ${result.winner} at ${result.minutes.toFixed(1)} min` : `HQ ${result.hqDead ? 'lost at ' + result.hqDead.toFixed(1) : 'standing'}`);
    give();
  });
  give();
}
