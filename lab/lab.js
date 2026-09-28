'use strict';
// Balance Lab page: runs LabTests in small slices (so the page stays responsive) and shows tables,
// a chart and the target table. All game logic is in LabTests and the simulation files.
(() => {
  const $ = id => document.getElementById(id);
  const pause = () => new Promise(r => setTimeout(r, 0));
  const fmt = (v, d = 1) => v == null ? '–' : v.toFixed(d);
  const results = {};   // target id -> measured value

  // ---- targets ----
  function inRange(id) { const t = BALANCE_TARGETS[id], v = results[id]; return v == null ? null : v >= t.min && v <= t.max; }
  function drawTargets() {
    const tb = $('targets'); tb.innerHTML = '<tr><th>Check</th><th>Target</th><th>Result</th><th>Required green for</th></tr>';
    for (const [id, t] of Object.entries(BALANCE_TARGETS)) {
      const ok = inRange(id), v = results[id];
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${t.label}</td><td>${t.min}–${t.max} ${t.unit}</td><td class="${ok == null ? 'pending' : ok ? 'ok' : 'bad'}">${v == null ? 'not run' : fmt(v) + ' ' + t.unit + (ok ? '' : ' (red)')}</td><td>${/^\d/.test(t.gate) ? 'patch ' + t.gate : t.gate}</td>`;
      tb.appendChild(tr);
    }
  }
  const setBar = (id, f) => { $(id).firstElementChild.style.width = Math.round(f * 100) + '%'; };

  // ---- duels ----
  const armed = Object.keys(Data.UNITS).filter(t => Data.UNITS[t].weapon);
  for (const sel of [$('tA'), $('tB')]) for (const t of armed) { const o = document.createElement('option'); o.value = t; o.textContent = Data.UNITS[t].name; sel.appendChild(o); }
  $('tA').value = 'rifle'; $('tB').value = 'rifle';
  async function runDuels(opts, runs, label) {
    const res = [];
    for (let i = 0; i < runs; i++) { res.push(LabTests.duel(Object.assign({}, opts, { seed: 1 + i }))); if (i % 4 === 3) { setBar('duelBar', (i + 1) / runs); await pause(); } }
    setBar('duelBar', 1);
    const n = res.length, win = w => res.filter(r => r.winner === w).length / n * 100;
    const pins = res.map(r => r.pinTime).filter(t => t != null);
    const row = { label, runs: n, winA: win(1), winB: win(2), draw: win(0), time: res.reduce((s, r) => s + r.time, 0) / n,
      sA: res.reduce((s, r) => s + r.survivorsA, 0) / n, sB: res.reduce((s, r) => s + r.survivorsB, 0) / n,
      pin: pins.length ? pins.reduce((s, t) => s + t, 0) / pins.length : null, pinned: pins.length };
    const tb = $('duelOut');
    if (!tb.rows.length) tb.innerHTML = '<tr><th>Duel</th><th>Runs</th><th>A wins</th><th>B wins</th><th>Draws</th><th>Avg time</th><th>Survivors A / B</th><th>First suppression</th></tr>';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${label}</td><td class="num">${n}</td><td class="num">${fmt(row.winA)}%</td><td class="num">${fmt(row.winB)}%</td><td class="num">${fmt(row.draw)}%</td><td class="num">${fmt(row.time)} s</td><td class="num">${fmt(row.sA)} / ${fmt(row.sB)}</td><td class="num">${row.pin == null ? '–' : fmt(row.pin) + ' s (' + row.pinned + ' runs)'}</td>`;
    tb.appendChild(tr);
    return row;
  }
  const name = t => Data.UNITS[t].name;
  $('runDuel').onclick = async () => {
    const o = { typeA: $('tA').value, nA: +$('nA').value, typeB: $('tB').value, nB: +$('nB').value, ground: $('ground').value, squadA: $('sqA').checked, squadB: $('sqB').checked };
    await runDuels(o, +$('runs').value, `${o.nA} ${name(o.typeA)}${o.squadA ? ' (squadron)' : ''} v ${o.nB} ${name(o.typeB)}${o.squadB ? ' (squadron)' : ''}, ${$('ground').selectedOptions[0].textContent}`);
  };
  $('runGates').onclick = async () => {
    // The pin test keeps the Rifleman alive: it measures stress alone (the MG would kill it first).
    const pin = await runDuels({ typeA: 'hmg', nA: 1, typeB: 'rifle', nB: 1, ground: 'flat', maxTime: 60, keepAliveB: true }, 100, '1 Machine Gunner v 1 Rifleman (kept alive), flat: time to pin');
    results.mgPin = pin.pin; drawTargets();
    const h = await runDuels({ typeA: 'rifle', nA: 5, typeB: 'rifle', nB: 5, ground: 'height' }, 100, '5 Riflemen v 5 Riflemen 30 m higher');
    results.heightDuel = h.winB; drawTargets();
  };

  // ---- economy ----
  function chart(log) {
    const c = $('ecoChart'), x = c.getContext('2d'), W = c.width, H = c.height, pad = 28;
    x.clearRect(0, 0, W, H);
    const maxT = log[log.length - 1].t, maxV = Math.max(100, ...log.map(r => Math.max(r.wood, r.metal, r.workers * 100)));
    x.strokeStyle = '#33382c'; x.fillStyle = '#8f9284'; x.font = '11px Consolas, monospace';
    for (let m = 0; m <= maxT / 60; m += Math.max(1, Math.round(maxT / 600))) { const px = pad + (m * 60 / maxT) * (W - pad * 2); x.beginPath(); x.moveTo(px, 8); x.lineTo(px, H - pad); x.stroke(); x.fillText(m + 'm', px - 6, H - 10); }
    x.fillText(Math.round(maxV), 2, 16);
    const line = (key, col, mult = 1) => { x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); log.forEach((r, i) => { const px = pad + r.t / maxT * (W - pad * 2), py = H - pad - (r[key] * mult) / maxV * (H - pad - 10); if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); };
    line('wood', '#c9a227'); line('metal', '#8fa2b5'); line('workers', '#7fb86a', 100);
  }
  $('runEco').onclick = async () => {
    $('ecoOut').innerHTML = '<tr><td class="pending">Running…</td></tr>'; await pause();
    const e = LabTests.economy({ seed: +$('ecoSeed').value, minutes: +$('ecoMin').value });
    chart(e.log);
    results.firstTier2 = e.tier2Min; drawTargets();
    let html = '<tr><th>Time</th><th>Event</th></tr>';
    for (const ev of e.events) html += `<tr><td class="num">${Util.fmtTime(ev.t)}</td><td>${ev.what}</td></tr>`;
    html += '<tr><th>Time</th><th>Wood · Metal · Workers</th></tr>';
    for (const r of e.log.filter((_, i) => i % 6 === 0)) html += `<tr><td class="num">${Util.fmtTime(r.t)}</td><td>${Math.round(r.wood)} · ${Math.round(r.metal)} · ${r.workers}</td></tr>`;
    $('ecoOut').innerHTML = html;
  };

  // ---- AI versus AI ----
  $('runAi').onclick = async () => {
    const n = +$('aiN').value, diff = $('aiDiff').value, max = +$('aiMax').value, rows = [];
    $('aiOut').innerHTML = '<tr><th>Match</th><th>Winner</th><th>Length</th><th>Kills side 1 / side 2</th></tr>';
    for (let i = 0; i < n; i++) {
      const m = LabTests.aiMatch({ seed: 1 + i, difficulty: diff, maxMinutes: max }); let r = null;
      while (!(r = m.step(300))) { setBar('aiBar', (i + m.progress) / n); await pause(); }
      rows.push(r);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>seed ${1 + i}</td><td>${r.winner ? 'side ' + r.winner + (r.winner === 1 ? ' (base)' : ' (mountain)') : 'none after ' + max + ' min'}</td><td class="num">${fmt(r.minutes)} min</td><td class="num">${r.kills[0]} / ${r.kills[1]}</td>`;
      $('aiOut').appendChild(tr);
    }
    setBar('aiBar', 1);
    const decided = rows.filter(r => r.winner);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><b>Summary</b></td><td>base ${rows.filter(r => r.winner === 1).length}, mountain ${rows.filter(r => r.winner === 2).length}, undecided ${rows.length - decided.length}</td><td class="num">${decided.length ? fmt(decided.reduce((s, r) => s + r.minutes, 0) / decided.length) + ' min avg' : '–'}</td><td></td>`;
    $('aiOut').appendChild(tr);
    results.aiMatchLength = decided.length ? decided.reduce((s, r) => s + r.minutes, 0) / decided.length : null; drawTargets();
  };

  drawTargets();
})();
