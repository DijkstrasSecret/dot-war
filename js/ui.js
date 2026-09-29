'use strict';
// The HUD panels of the open-map layout (DOM): selection/build/research panel bottom left, command
// card bottom right, group bar top centre, resources and clock on top. Each rebuilds only when its
// content signature changes.
// TODO(patch 0.5): blueprint designer tab (chassis + weapon + armour, saved logos) once custom blueprints exist.
// TODO(patch 0.8): unit tooltips on hover and an in-game tutorial overlay for Highland Pass.
const UI = (() => {
  let tab = 'sel', content, clockEl, speedBtns, sig = '', tick = null, refreshT = 0;
  let cmdBox, cmdSig = '', groupBar, groupSig = '', groupTick = null;
  const resEls = {};

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function card(o) {
    const c = el('div', 'card' + (o.disabled ? ' disabled' : '') + (o.active ? ' active' : ''));
    c.appendChild(o.img || Icons.makeCanvas(o.icon, 72, o.iconColor || '#fff', o.iconBg || '#2a2a2e', o.shape));
    const info = el('div', 'info'); info.appendChild(el('div', 'name', o.name));
    if (o.cost != null) info.appendChild(el('div', 'cost', o.cost));
    if (o.desc) info.appendChild(el('div', 'desc', o.desc));
    if (o.extra) info.appendChild(o.extra);
    c.appendChild(info);
    if (o.onclick && !o.disabled) c.onclick = o.onclick;
    return c;
  }
  // ---- portraits and names (DD K) ----
  // Kept in one place on purpose: the panel layout will change, these helpers should not.
  // Faces and names come from the match seed plus the unit id, so a replayed match shows the same soldiers.
  const faceSeed = u => Portraits.seedFor(G.seed, u.id);
  function soldierName(u) { return Portraits.name(faceSeed(u), { faction: u.faction, era: u.kitEra, rank: u.rank || 0 }); }
  function portraitEl(u, size) {
    const img = el('img', 'portrait');
    img.width = img.height = size; img.alt = soldierName(u).full;
    img.src = Portraits.dataURL(faceSeed(u), { team: Data.PLAYER_COLORS[u.owner], faction: u.faction, era: u.kitEra, size });
    return img;
  }
  function armyLabel(owner) {
    const f = Portraits.factions.find(x => x.id === G.players[owner].faction);
    if (!f) return Data.PLAYER_NAMES[owner];
    return f.label + ' army';
  }
  function bar(color) { const b = el('div', 'bar'); const f = el('div'); f.style.background = color; b.appendChild(f); b.fill = f; return b; }
  function btn(label, onclick, title) { const b = el('button', 'btn', label); b.onclick = onclick; if (title) b.title = title; return b; }

  function init() {
    content = document.getElementById('tabcontent'); clockEl = document.getElementById('clock');
    cmdBox = document.getElementById('cmdBox'); groupBar = document.getElementById('groupBar');
    const resBox = document.getElementById('resources');
    for (const r of Data.RES) {
      const d = el('div', 'res'); d.title = r.charAt(0).toUpperCase() + r.slice(1);
      d.appendChild(Icons.makeCanvas(r, 32, Data.RES_COLORS[r]));
      const s = el('span'); d.appendChild(s); resBox.appendChild(d); resEls[r] = s;
    }
    const sup = el('div', 'res'); sup.title = 'Supply: units and queued units against your cap (30, +10 per Depot)';
    sup.appendChild(Icons.makeCanvas('depot', 32, '#d8d2b8')); const ss = el('span'); sup.appendChild(ss); resBox.appendChild(sup); resEls.supply = ss;
    document.querySelectorAll('#tabs button').forEach(b => { b.onclick = () => { tab = b.dataset.tab; refresh(); }; });
    speedBtns = [...document.querySelectorAll('#speedbox button')];
    speedBtns.forEach(b => { b.onclick = () => { Game.setSpeed(+b.dataset.speed); refreshSpeed(); }; });
    document.getElementById('menuBtn').onclick = () => Menu.show();
    document.getElementById('musicBtn').onclick = () => Music.toggle();
    refreshMusic();
    document.getElementById('helpBtn').onclick = () => toggleHelp();
    document.getElementById('help').onclick = () => toggleHelp(false);
    refresh();
  }
  function toggleHelp(force) { const h = document.getElementById('help'); const show = force === undefined ? h.classList.contains('hidden') : force; h.classList.toggle('hidden', !show); }
  function refreshSpeed() { for (const b of speedBtns) b.classList.toggle('on', +b.dataset.speed === G.speed); }
  function refreshMusic() { const b = document.getElementById('musicBtn'); if (b) b.classList.toggle('on', Music.enabled); }
  function refresh() {
    sig = ''; cmdSig = ''; groupSig = ''; refreshT = 0;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    refreshSpeed();
  }
  function showTab(t) { tab = t; refresh(); }

  function update(dt) {
    const p = G.players[1];
    for (const r of Data.RES) { const v = Math.floor(p.res[r]); resEls[r].textContent = v; resEls[r].className = v < 20 ? 'low' : ''; }
    const su = Game.supplyUsed(1), sc = Game.supplyCap(1); resEls.supply.textContent = su + '/' + sc; resEls.supply.className = su >= sc ? 'low' : '';
    clockEl.textContent = Util.fmtTime(G.time) + (G.speed === 0 ? '  ⏸' : '');
    refreshT -= dt;
    if (refreshT > 0) { if (tick) tick(); return; }
    refreshT = 0.2;
    const s = signature();
    if (s !== sig) { sig = s; build(); }
    if (tick) tick();
    updateCommands(); updateGroups();
  }
  // Command card, bottom right: shown whenever you have soldiers selected, whatever the tab.
  function updateCommands() {
    const units = G.selection.filter(e => e instanceof Unit && !e.dead && e.owner === 1);
    const s = units.map(u => u.id).join(',') + '|' + Input.state.mode + '|' + [...G.players[1].done].join(',');
    if (s === cmdSig) return; cmdSig = s;
    cmdBox.innerHTML = ''; cmdBox.classList.toggle('hidden', !units.length);
    if (units.length) cmdBox.appendChild(commandCard(units));
  }
  // Class badge: the unit's logo on its shape in team colour, as drawn on the map.
  function badge(u, px) { const c = Icons.makeCanvas(u.def.icon, px, '#fff', Data.PLAYER_COLORS[u.owner], u.def.shape); c.className = 'badge'; return c; }
  // Squadron bar, top centre (DD E): one tile per squadron with a count per unit class, health,
  // stress and the average rank. Click to select; click twice to centre the view.
  const chevrons = r => r > 0 ? '˄'.repeat(Math.round(r)) : '';
  function updateGroups() {
    const keys = Object.keys(G.squads).map(Number).sort((a, b) => a - b);
    const sel = new Set(G.selection);
    const alive = n => Game.membersOf(G.squads[n]).filter(u => u.owner === 1);
    const isSelected = n => { const us = alive(n).filter(u => !u.inside); return us.length && us.length === sel.size && us.every(u => sel.has(u)); };
    const s = keys.map(n => n + ':' + alive(n).map(u => u.id + '.' + u.rank).join(',') + (isSelected(n) ? '*' : '') + Game.squadMarchers(G.squads[n])).join('|');
    if (s !== groupSig) {
      groupSig = s; groupBar.innerHTML = ''; const bars = [];
      for (const n of keys) {
        const us = alive(n); if (!us.length) continue;
        const t = el('div', 'gtile' + (isSelected(n) ? ' on' : ''));
        t.title = 'Squadron ' + n + ': press ' + n + ' to select, twice to centre the view';
        t.appendChild(el('span', 'gnum', String(n)));
        const counts = el('div', 'gcount'); const by = {};
        for (const u of us) by[u.type] = (by[u.type] || 0) + 1;
        for (const type of Object.keys(Data.UNITS)) if (by[type]) {
          const d = Data.UNITS[type], sp = el('span'); sp.title = by[type] + ' ' + d.name + (by[type] > 1 ? 's' : '');
          sp.appendChild(Icons.makeCanvas(d.icon, 28, '#fff', Data.PLAYER_COLORS[1], d.shape)); sp.appendChild(document.createTextNode('×' + by[type])); counts.appendChild(sp);
        }
        const march = Game.squadMarchers(G.squads[n]);   // Kaan, 0.5b.1: soldiers who won't fit in the squadron's Truck
        if (march) { const w = el('span', 'gwarn', '!'); w.title = march + ' soldier' + (march > 1 ? 's' : '') + ' won\'t fit in the Truck and will march on long moves'; counts.appendChild(w); }
        const avg = us.reduce((a, u) => a + u.rank, 0) / us.length;
        if (avg >= 0.5) { const r = el('span', 'grank', chevrons(avg)); r.title = 'Average rank ' + avg.toFixed(1); counts.appendChild(r); }
        t.appendChild(counts);
        const hp = el('div', 'gbar'), hf = el('div'); hf.style.background = 'var(--good)'; hp.appendChild(hf);
        const st = el('div', 'gbar'), sf = el('div'); sf.style.background = '#ffb000'; st.appendChild(sf);
        t.appendChild(hp); t.appendChild(st); bars.push([n, hf, sf]);
        t.onclick = () => Input.selectSquad(n);
        groupBar.appendChild(t);
      }
      groupTick = () => { for (const [n, hf, sf] of bars) { if (!G.squads[n]) continue; const a = alive(n); if (!a.length) continue; hf.style.width = (a.reduce((x, u) => x + u.hp / u.stats.hp, 0) / a.length * 100) + '%'; sf.style.width = (a.reduce((x, u) => x + u.stress, 0) / a.length * 100) + '%'; } };
    }
    if (groupTick) groupTick();
  }
  // Squad panel (DD E): the three toggles, shown when exactly one whole squadron is selected.
  function squadToggles(sq) {
    const box = el('div', 'sqtoggles');
    const row = (label, key, opts) => {
      const r = el('div', 'sqrow'); r.appendChild(el('span', null, label));
      for (const [v, text, tip] of opts) { const b = btn(text, () => { Game.command({ kind: 'squadToggle', squad: sq.id, key, value: v }); refresh(); }, tip); if (sq[key] === v) b.classList.add('on'); r.appendChild(b); }
      box.appendChild(r);
    };
    row('Movement', 'move', [['slow', '>', 'Everyone moves at the slowest member\'s pace'], ['own', '>>', 'Each at his own pace; they regroup at the destination']]);
    row('Spacing', 'spacing', [['tight', 'Tight 15 m'], ['loose', 'Loose 25 m']]);
    row('Contact', 'contact', [['react', 'React', 'Members share the squad\'s target when it is no farther than their own'], ['keep', 'Keep moving', 'Members keep walking and each fires at the closest enemy, at lower accuracy']]);
    return box;
  }
  function signature() {
    const p = G.players[1];
    let s = tab + '|' + Input.state.mode + '|' + (Input.state.buildType || Input.state.lineType || '') + '|' + [...p.unlocked].join(',') + '|' + [...p.done].join(',') + '|' + Object.entries(p.research).map(([k, j]) => k + j.id).join(',') + '|' + G.buildings.filter(b => b.owner === 1 && b.built).length + '|';
    if (tab === 'sel') s += Object.values(G.squads).map(q => q.id + q.move + q.spacing + q.contact + q.members.length).join('') + '|' + G.selection.map(e => e.id + ':' + (e.dead ? 'd' : '') + (e instanceof Building ? e.queue.map(q => q.type).join('.') + ':' + e.built + ':' + e.workers.length + ':' + e.level + ':' + e.garrison.join('.') + ':' + !!e.upgrading + ':' + e.link + ':' + (e.def.harvest ? Game.hiresFor(e) + '.' + Game.canAfford(p, p.blueprints.worker.cost) : '') + ':' + (e.def.levels && e.level < e.def.levels.length ? Game.canAfford(p, e.def.levels[e.level].cost) : '') : (e.work || '') + ':' + (e.order ? e.order.type : '') + ':' + (e.flee > 0) + ':' + e.suppressed + ':' + e.rank + ':' + e.squad + ':' + (e.cargo ? e.cargo.length + '.' + e.bpLevel : ''))).join(',');
    if (tab === 'build') s += Data.BUILD_LIST.map(t => Game.canAfford(p, Game.costOf(1, t)) + Util.costStr(Game.costOf(1, t))).join(',');
    if (tab === 'research') s += Data.RESEARCH_ORDER.map(r => Game.researchState(p, r)).join(',');
    if (tab === 'sel') { const b = G.selection[0]; if (b instanceof Building && b.def.produces) s += '|' + b.def.produces.map(t => p.unlocked.has(t) && Game.canAfford(p, p.blueprints[t].cost)).join(','); }
    return s;
  }

  function build() {
    content.innerHTML = ''; tick = null;
    if (tab === 'sel') buildSel(); else if (tab === 'build') buildBuild(); else buildResearch();
  }

  // DD 9 key layout. Moving is the right click (or this button, then a left click).
  function commandCard(units) {
    const grid = el('div', 'cmdgrid'); const mode = Input.state.mode; const ids = units.map(u => u.id);
    const items = [
      ['Move', 'RMB', () => Input.setMode('walk'), mode === 'walk', 'Right click the ground, or press this and left click. Hold Shift to queue waypoints.'],
      ['Attack', 'F', () => Input.setMode('attack'), mode === 'attack', 'Then click an enemy or a point (attack-move). Mortars bombard the point.'],
      ['Defend', 'R', () => Game.command({ kind: 'hold', units: ids }), false, 'Hold this position and fire at anything in range.'],
      ['Retreat', 'G', () => Game.command({ kind: 'retreat', units: ids }), false, 'Pull back a short way towards your headquarters. No suppression slowdown, stress drains twice as fast.'],
      ['Stop', 'X', () => Game.command({ kind: 'stop', units: ids }), false, 'Cancel all orders (also releases workers).'],
      ['Enter', 'E', () => Input.setMode('work'), mode === 'work', 'Then click a camp, mine, tapper or refinery to work there, a Scout Tower, Bunker or the HQ to garrison it, or a Truck to board it.'],
      ['Trench', 'B Y', () => Input.setMode('build', 'trench'), mode === 'line', 'Hold the left button and drag to draw a line; the selected soldiers dig it. Each 10 m is paid when digging on it starts.'],
    ];
    const pl = G.players[1];
    if (pl.done.has('smoke') && units.some(u => u.stats.weapon && u.stats.weapon.indirect)) items.push(['Smoke', 'M', () => Input.setMode('smoke'), mode === 'smoke', 'Mortars fire one smoke round: a cloud that blocks sight for 15 s.']);
    if (pl.done.has('demolition') && units.some(u => u.stats.weapon)) items.push(['Demolish', 'C', () => Input.setMode('demolish'), mode === 'demolish', 'The nearest soldier blows up a barricade, wire or bridge segment: 3 s to set, 1 sulfur.']);
    if (units.some(u => u.cargo)) items.push(['Unload', 'Q', () => { for (const t of units.filter(v => v.cargo)) Game.command({ kind: 'unload', building: t.id }); }, false, 'Let everyone out of the selected Trucks.']);
    if (units.some(u => u.def.labour)) items.push(['Fill', 'K', () => Input.setMode('fill'), mode === 'fill', 'Workers fill in one of your trenches, as slowly as it was dug.']);
    if (units.some(u => Game.canThrow(u))) items.push(['Grenade', 'V', () => Input.setMode('grenade'), mode === 'grenade', 'Riflemen walk within 25 m, stand still 1 s and throw a grenade (1 sulfur, 20 s cooldown). Friendly fire is on.']);
    for (const [label, key, fn, on, tip] of items) {
      const b = el('button', 'cmd' + (on ? ' on' : '')); b.title = tip;
      b.appendChild(el('span', 'key', key)); b.appendChild(el('span', 'lbl', label)); b.onclick = fn; grid.appendChild(b);
    }
    return grid;
  }
  function statRow(label, value) { const r = el('div', 'stat'); r.appendChild(el('span', null, label)); const b = el('b', null, value); r.appendChild(b); return r; }

  function buildSel() {
    const sel = G.selection.filter(e => !e.dead);
    if (!sel.length) {
      // Kept short: with nothing selected the panel stays small so the map shows.
      content.appendChild(el('div', 'small', 'Drag to select. Right click moves, attacks, works or garrisons. B build, N research, H headquarters, WASD pans, F1 all controls.'));
      const sum = el('div'); sum.style.marginTop = '10px';
      const mine = G.units.filter(u => u.owner === 1 && !u.dead);
      sum.appendChild(statRow('Your units', String(mine.length)));
      sum.appendChild(statRow('Your buildings', String(G.buildings.filter(b => b.owner === 1 && !b.dead).length)));
      content.appendChild(sum);
      return;
    }
    const units = sel.filter(e => e instanceof Unit);
    if (units.length === 1 && sel.length === 1) unitPanel(units[0]);
    else if (units.length > 1) groupPanel(units);
    else buildingPanel(sel[0]);
  }
  // A Truck's panel (0.5b): fuel, spare fuel, seats and passengers, Unload and Retrofit.
  function truckPanel(u) {
    const own = u.owner === 1, p = G.players[u.owner];
    content.appendChild(card({ icon: u.def.icon, iconBg: Data.PLAYER_COLORS[u.owner], shape: 'rect', name: u.def.name + (u.bpLevel ? ' (level ' + u.bpLevel + ')' : ''), cost: armyLabel(u.owner) + ' · ' + u.armor + ' armour', desc: u.def.desc }));
    const hp = bar('#5ad65a'), fu = bar('#c9a227'), sp = bar('#8a6a2a');
    content.appendChild(el('div', 'small', 'Health')); content.appendChild(hp);
    content.appendChild(el('div', 'small', 'Fuel (a Depot refills it for oil; empty = 20% speed)')); content.appendChild(fu);
    content.appendChild(el('div', 'small', 'Spare fuel (shared with vehicles running low nearby)')); content.appendChild(sp);
    const status = el('div', 'small'); status.style.margin = '6px 0'; content.appendChild(status);
    if (own) {
      content.appendChild(el('h3', null, 'Passengers'));
      const g = el('div', 'queue');
      for (const id of u.cargo) {
        const r = G.unitById.get(id); if (!r || r.dead) continue;
        const q = el('div', 'q'); q.title = soldierName(r).short + ', ' + r.def.name + ' (click to let out)';
        q.appendChild(Icons.makeCanvas(r.def.icon, 60, '#fff', Data.PLAYER_COLORS[1], r.def.shape)); q.onclick = () => { Game.command({ kind: 'unloadOne', building: u.id, unit: id }); refresh(); };
        g.appendChild(q);
      }
      if (!u.cargo.length) g.appendChild(el('div', 'small', 'Empty. Select soldiers and right click the Truck, or press E and click it.'));
      content.appendChild(g);
      const row = el('div', 'row');
      row.appendChild(btn('[Q] Unload all', () => { Game.command({ kind: 'unload', building: u.id }); refresh(); }));
      const bp = p.blueprints[u.type];
      if ((bp.level || 0) !== u.bpLevel) { const c = Game.retrofitCost(u); row.appendChild(btn('Retrofit: ' + Util.costStr(c), () => { Game.command({ kind: 'retrofit', units: [u.id] }); refresh(); }, 'At a Workshop: upgrade this Truck to the latest blueprint (level ' + (bp.level || 0) + ') for 40% of the price difference')); }
      content.appendChild(row);
    }
    tick = () => {
      hp.fill.style.width = (u.hp / u.stats.hp * 100) + '%'; fu.fill.style.width = (u.fuel / u.stats.fuel * 100) + '%'; sp.fill.style.width = (u.spare / u.def.spare * 100) + '%';
      const o = u.order; status.textContent = 'Seats free ' + Game.seatsFree(u) + ' of ' + u.def.seats + '. Fuel ' + Math.floor(u.fuel) + '/' + Math.round(u.stats.fuel) + '. ' + (u.work != null ? (u.load ? 'Hauling ' + Math.floor(u.load.n) + ' ' + u.load.k + '.' : 'Collecting a load.') : o ? ({ move: 'Driving.', attackmove: 'Driving.', ferry: 'Waiting for riders.' })[o.type] || '' : 'Parked.');
    };
  }
  function unitPanel(u) {
    if (u.cargo) { truckPanel(u); return; }
    const own = u.owner === 1;
    const pw = el('div', 'pwrap'); pw.appendChild(portraitEl(u, 72)); pw.appendChild(badge(u, 40));
    content.appendChild(card({ img: pw, name: soldierName(u).full, cost: u.def.name + ' · ' + armyLabel(u.owner), desc: u.def.desc }));
    const hp = bar('#5ad65a'), st = bar('#ffb000');
    content.appendChild(el('div', 'small', 'Health')); content.appendChild(hp);
    content.appendChild(el('div', 'small', 'Stress')); content.appendChild(st);
    const status = el('div', 'small'); status.style.margin = '6px 0'; content.appendChild(status);
    const w = u.stats.weapon; const box = el('div');
    const R = Data.VETERANCY.ranks, next = R[u.rank];
    const sq = u.squad ? G.squads[u.squad] : null;
    box.appendChild(statRow('Rank', (u.rank ? chevrons(u.rank) + ' ' : '') + Math.floor(u.xp) + ' XP' + (next ? ' / ' + next : '') + (sq && sq.leader === u.id ? ' · ★ leader' : '')));
    if (sq) box.appendChild(statRow('Squadron', String(sq.id)));
    if (w) {
      box.appendChild(statRow('Damage', w.dmg.toFixed(0) + ' ' + w.dtype + (w.splash ? ', splash ' + w.splash : '')));
      box.appendChild(statRow('Range', (w.minRange ? w.minRange + '–' : '') + w.range.toFixed(0)));
      box.appendChild(statRow('Accuracy', Math.round(w.acc * 100) + '%'));
      box.appendChild(statRow('Reload', w.reload.toFixed(1) + ' s'));
    } else box.appendChild(statRow('Weapon', 'none'));
    if (u.def.heal) box.appendChild(statRow('Heals', u.def.heal.rate + ' HP/s within ' + u.def.heal.range + ' m'));
    box.appendChild(statRow('Speed', u.stats.speed.toFixed(0)));
    box.appendChild(statRow('Vision', u.stats.vision.toFixed(0)));
    box.appendChild(statRow('Armor', u.def.armor));
    if (w && w.ammo) box.appendChild(statRow('Ammo per shot', Util.costStr(w.ammo)));
    content.appendChild(box);
    tick = () => {
      hp.fill.style.width = (u.hp / u.stats.hp * 100) + '%'; st.fill.style.width = (u.stress * 100) + '%';
      const h = Terrain.hAt(u.x, u.y).toFixed(0);
      let s = 'Elevation ' + h + ' m. ';
      if (u.flee > 0) s += 'Panicking! '; else if (u.suppressed) s += u.def.obeysWhenSuppressed ? 'Suppressed: slowed, keeps its orders. ' : 'Suppressed: cannot pick targets. ';
      if (u.work != null && !(u.order && u.order.type === 'haul')) s += 'Working. '; else if (u.order) s += (u.order.retreat ? 'Retreating' : ({ move: 'Moving', attackmove: 'Attack-moving', attack: 'Attacking target', bombard: u.order.smoke ? 'Firing smoke' : 'Bombarding', demolish: 'Setting a demolition charge', hold: 'Holding position', board: 'Boarding a Truck', ferry: 'Waiting for riders', work: 'Going to work', haul: u.load ? 'Carrying ' + Math.floor(u.load.n) + ' ' + u.load.k : 'Collecting a load', garrison: 'Going to garrison', dig: u.order.fill ? 'Filling a trench' : 'Digging', grenade: 'Going to throw a grenade' })[u.order.type] || '') + '. '; else s += 'Idle. ';
      if (u.def.heal && u.patient && !u.patient.dead && u.patient.hp < u.patient.stats.hp) s += 'Treating a wounded ' + u.patient.def.name + '. ';
      if (Game.canThrow(u)) s += u.nadeT > 0 ? 'Grenade in ' + Math.ceil(u.nadeT) + ' s. ' : 'Grenade ready. ';
      if (u.target) s += 'Firing at ' + (u.target.def.name) + '.';
      status.textContent = s;
    };
  }
  function groupPanel(units) {
    const sqIds = new Set(units.map(u => u.squad)); const sq = sqIds.size === 1 && units[0].squad ? G.squads[units[0].squad] : null;
    const whole = sq && Game.membersOf(sq).filter(u => !u.inside).length === units.length;
    content.appendChild(el('h3', null, whole ? 'Squadron ' + sq.id + ' · ' + units.length + ' soldiers' : units.length + ' units selected'));
    if (whole) content.appendChild(squadToggles(sq));
    const march = sq ? Game.squadMarchers(sq) : 0;
    if (whole && march) { const w = el('div', 'small warnline', '! ' + march + ' soldier' + (march > 1 ? 's' : '') + ' won\'t fit in the Truck and will march on moves over ' + Data.FERRY.minDist + ' m.'); content.appendChild(w); }
    // One face per soldier with a class badge and a health bar; click a face to select only them.
    const faces = el('div', 'faces'), fills = [];
    for (const u of units.slice(0, 24)) {
      const f = el('div', 'face'); f.title = (u.cargo ? 'Truck' : soldierName(u).short + ', ' + u.def.name) + ' (click to select only this one)';
      if (u.cargo) f.appendChild(Icons.makeCanvas(u.def.icon, 64, '#fff', Data.PLAYER_COLORS[u.owner], 'rect')); else { f.appendChild(portraitEl(u, 64)); f.appendChild(badge(u, 34)); }
      const hb = el('div', 'hpbar'), hf = el('div'); hb.appendChild(hf); f.appendChild(hb); fills.push([u, hf]);
      f.onclick = () => Input.select([u], false);
      faces.appendChild(f);
    }
    content.appendChild(faces);
    if (units.length > 24) content.appendChild(el('div', 'small', '+' + (units.length - 24) + ' more'));
    const status = el('div', 'small'); content.appendChild(status);
    tick = () => {
      for (const [u, hf] of fills) hf.style.width = (Math.max(0, u.hp) / u.stats.hp * 100) + '%';
      const sup = units.filter(u => u.suppressed).length, hp = units.reduce((a, u) => a + u.hp / u.stats.hp, 0) / units.length; status.textContent = 'Average health ' + Math.round(hp * 100) + '%' + (sup ? ', ' + sup + ' suppressed' : '');
    };
  }
  function buildingPanel(b) {
    const own = b.owner === 1; const p = G.players[1];
    content.appendChild(card({ icon: b.def.icon, iconBg: '#2a2a2e', name: b.def.name, cost: Data.PLAYER_NAMES[b.owner], desc: b.def.desc }));
    const hp = bar('#5ad65a'); content.appendChild(el('div', 'small', 'Health')); content.appendChild(hp);
    let prog = null;
    if (!b.built) { prog = bar('#5a78c8'); content.appendChild(el('div', 'small', 'Construction')); content.appendChild(prog); }
    const status = el('div', 'small'); status.style.margin = '6px 0'; content.appendChild(status);
    let qrow = null;
    if (own && b.built && b.def.produces) {
      content.appendChild(el('h3', null, 'Train'));
      // Z X C V train the current page of four; Tab flips pages when there are more (DD G15).
      const keys = Data.TRAIN_HOTKEYS, list = Input.trainable(b), page = Input.state.trainPage, pages = Math.ceil(list.length / keys.length);
      list.forEach((t, i) => {
        const bp = p.blueprints[t]; const onPage = Math.floor(i / keys.length) === page;
        content.appendChild(card({ icon: bp.icon, iconBg: Data.PLAYER_COLORS[1], shape: bp.shape, name: (onPage ? '[' + keys[i % keys.length] + '] ' : '') + bp.name, cost: Util.costStr(bp.cost) + ' · ' + Math.round(Game.prodTime(b, t)) + ' s', desc: bp.desc, disabled: !Game.canAfford(p, bp.cost), onclick: () => { Game.command({ kind: 'enqueue', building: b.id, type: t }); refresh(); } }));
      });
      content.appendChild(el('div', 'small', 'Queue (click to cancel). Right click the map to set a rally point. ' + (pages > 1 ? 'Tab shows the next four.' : 'Tab cycles factories.')));
      qrow = el('div', 'queue'); content.appendChild(qrow);
      b.queue.forEach((q, i) => {
        const d = Data.UNITS[q.type]; const qe = el('div', 'q'); qe.title = d.name;
        qe.appendChild(Icons.makeCanvas(d.icon, 60, '#fff', Data.PLAYER_COLORS[1], d.shape));
        const pr = el('div', 'prog'); qe.appendChild(pr); qe.prog = pr; qe.onclick = () => { Game.command({ kind: 'cancel', building: b.id, index: i }); refresh(); };
        qrow.appendChild(qe);
      });
    }
    let upBar = null;
    if (own && b.built && b.slots) {
      const lv = b.slots; const maxLv = b.def.levels ? b.def.levels.length : 0;
      content.appendChild(el('h3', null, maxLv ? b.def.name + ', level ' + b.level + ' of ' + maxLv : 'Garrison'));
      const holds = 'Holds ' + lv.cap + ' infantry' + (lv.mg ? ' and ' + lv.mg + ' Machine Gunner' : '') + (lv.heavy ? ' and ' + lv.heavy + ' mortar' : '') + '. ';
      const adds = (lv.height ? 'Adds ' + lv.height + ' m of height' + (lv.vision ? ' and ' + lv.vision + ' vision' : '') + '. ' : '') + (lv.acc ? 'Occupants shoot ' + Math.round((lv.acc - 1) * 100) + '% more accurately. ' : '') + (lv.grenadeReach ? 'Grenades still reach them. ' : '');
      content.appendChild(el('div', 'small', holds + adds + 'Select soldiers and press E or right click the building to garrison. Workers and Medics stay outside.'));
      const g = el('div', 'queue'); g.style.margin = '6px 0';
      for (const id of b.garrison) {
        const u = G.unitById.get(id); if (!u || u.dead) continue;
        const q = el('div', 'q'); q.title = soldierName(u).short + ', ' + u.def.name + ' (click to unload)';
        q.appendChild(Icons.makeCanvas(u.def.icon, 60, '#fff', Data.PLAYER_COLORS[1], u.def.shape));
        q.onclick = () => { Game.command({ kind: 'unloadOne', building: b.id, unit: id }); refresh(); };
        g.appendChild(q);
      }
      if (!b.garrison.length) g.appendChild(el('div', 'small', 'Empty.'));
      content.appendChild(g);
      const row = el('div', 'row');
      if (maxLv && b.level < maxLv) {
        const next = b.def.levels[b.level];
        const ub = btn('[T] Upgrade: ' + Util.costStr(next.cost) + ' · ' + next.time + ' s', () => { Game.command({ kind: 'upgrade', building: b.id }); refresh(); }, 'Level ' + (b.level + 1) + ': ' + next.cap + ' infantry' + (next.heavy ? ' + ' + next.heavy + ' mortar' : '') + ', +' + next.height + ' m');
        ub.disabled = !!b.upgrading || !Game.canAfford(p, next.cost); row.appendChild(ub);
      }
      row.appendChild(btn('[Q] Unload all', () => { Game.command({ kind: 'unload', building: b.id }); refresh(); }));
      content.appendChild(row);
      if (b.upgrading) { upBar = bar('#ffd257'); content.appendChild(el('div', 'small', 'Upgrading')); content.appendChild(upBar); }
    }
    if (own && b.built && (b.def.harvest || b.type === 'depot')) {   // Kaan, 0.5a.3: the supply link
      const t = b.link != null ? G.buildingById.get(b.link) : null;
      content.appendChild(el('h3', null, 'Supply link'));
      content.appendChild(el('div', 'small', (b.def.harvest ? 'Carriers take the goods to ' : 'This Depot\'s goods go to ') + (t && !t.dead ? 'the Depot you linked' : 'the HQ') + '. Pick a Depot to shorten the walk; a cut line holds goods until it is clear. Or right click one of your Depots with this selected.'));
      const row = el('div', 'row');
      row.appendChild(btn('Pick supply link', () => Input.setMode('link'), 'Then click one of your Depots'));
      if (t) row.appendChild(btn('Send to HQ', () => { Game.command({ kind: 'link', building: b.id, target: null }); refresh(); }));
      content.appendChild(row);
    }
    if (own && b.built && b.def.harvest) {
      content.appendChild(el('h3', null, 'Harvesting'));
      content.appendChild(el('div', 'small', 'Select Workers and right click this building to assign up to ' + Game.maxWorkers(b) + '. Each Worker adds ' + b.def.perWorker + '/s; a soldier adds half that. Output goes into the building\'s stock (up to ' + Data.LOGISTICS.stockCap + '); the assigned people carry it along the dashed line to its supply link, ' + Data.LOGISTICS.load + ' per trip (soldiers ' + Data.LOGISTICS.soldierLoad + '). Only delivered goods can be spent.'));
      const row = el('div', 'row');
      // Kaan, 0.5b.3: while slots are free, train a Worker at the HQ who walks straight here.
      const free = Game.maxWorkers(b) - b.workers.length - Game.hiresFor(b);
      if (free > 0) { const hb = btn('Train a Worker for this (' + Util.costStr(G.players[1].blueprints.worker.cost) + ')', () => { Game.command({ kind: 'hireFor', building: b.id }); refresh(); }, free + ' free slot' + (free > 1 ? 's' : '') + '. The HQ trains a Worker who goes straight to work here.'); hb.disabled = !Game.canAfford(G.players[1], G.players[1].blueprints.worker.cost); row.appendChild(hb); }
      row.appendChild(btn('Release workers', () => { Game.command({ kind: 'stop', units: b.workers.slice() }); refresh(); })); content.appendChild(row);
    }
    tick = () => {
      hp.fill.style.width = (b.hp / b.maxHp * 100) + '%';
      if (prog) prog.fill.style.width = (b.progress * 100) + '%';
      let s = '';
      if (b.def.harvest && b.built && b.owner === 1) { const k = b.def.harvest === 'wood' ? 'wood' : b.depositType, d = G.buildingById.get(b.drop); s += 'Stock ' + Math.floor((k && b.stock[k]) || 0) + '/' + Data.LOGISTICS.stockCap + '. Drop-off: ' + (d ? d.def.name + (d.type === 'depot' && !d.connected ? ' (line cut)' : '') : 'none') + '. '; }
      if (b.type === 'depot' && b.built && b.owner === 1) { const par = G.buildingById.get(b.parent), wait = Object.entries(b.stock).filter(([, v]) => v >= 1); s += 'Supply line ' + (par ? 'to the ' + (par.type === 'hq' ? 'HQ' : 'Depot at ' + Math.round(par.x) + ',' + Math.round(par.y)) : '…') + ': ' + (b.connected ? 'open' : 'CUT, enemies on the line') + '. ' + (wait.length ? 'Waiting here: ' + wait.map(([k, v]) => Math.floor(v) + ' ' + k).join(', ') + '. ' : ''); }
      if (b.def.harvest && b.built) s += 'Rate ' + Game.harvestRate(b).toFixed(1) + ' ' + (b.def.harvest === 'wood' ? 'wood' : b.depositType || '?') + '/s, labour ' + Game.activeWorkers(b) + ', slots ' + b.workers.length + '/' + Game.maxWorkers(b) + '. ';
      if (b.queue.length) s += 'Training ' + Data.UNITS[b.queue[0].type].name + ' (' + Math.ceil(b.queue[0].total - b.queue[0].t) + ' s).';
      status.textContent = s;
      if (qrow) b.queue.forEach((q, i) => { const qe = qrow.children[i]; if (qe) qe.prog.style.width = (q.t / q.total * 100) + '%'; });
    };
  }
  function buildBuild() {
    const p = G.players[1];
    content.appendChild(el('div', 'small', 'While this tab is open the letters below pick a building (B, then the letter). Click on visible, fairly flat ground. Shift-click places several. Right click cancels.'));
    const locked = d => Game.hasTech(p, d) ? '' : ' — needs ' + Data.RESEARCH[d.requires].name + ' research';
    for (const t of Data.BUILD_LIST) {
      const d = Data.BUILDINGS[t];
      const cost = Game.costOf(1, t);
      content.appendChild(card({ icon: d.icon, name: '[' + Data.BUILD_HOTKEYS[t] + '] ' + d.name, cost: Util.costStr(cost) + ' · ' + d.buildTime + ' s', desc: d.desc + locked(d), disabled: !Game.canAfford(p, cost) || !Game.hasTech(p, d), active: Input.state.mode === 'build' && Input.state.buildType === t, onclick: () => { if (Input.state.mode === 'build' && Input.state.buildType === t) Input.setMode('normal'); else Input.setMode('build', t); } }));
    }
    // DD B, J: line defences, drawn by dragging; the selected soldiers dig, or idle Workers within 300 m.
    content.appendChild(el('h3', null, 'Line defences'));
    content.appendChild(el('div', 'small', 'Pick one, then hold the left button and drag. The selected soldiers dig it; with none selected, idle Workers within ' + Data.DIG.idleWorkerRange + ' m do. Defences: ' + Data.DIG.time + ' s per 10 m for a soldier, Workers ' + Data.DIG.workerMult + '× faster. Roads and bridges are built by Workers only. Each 10 m is paid when work on it starts.'));
    for (const t of Data.LINE_LIST) {
      const d = Data.LINES[t];
      content.appendChild(card({ icon: d.icon, name: '[' + Data.BUILD_HOTKEYS[t] + '] ' + d.name, cost: Util.costStr(d.cost) + ' per 10 m', desc: d.desc + locked(d), disabled: !Game.hasTech(p, d), active: Input.state.mode === 'line' && Input.state.lineType === t, onclick: () => { if (Input.state.mode === 'line' && Input.state.lineType === t) Input.setMode('normal'); else Input.setMode('build', t); } }));
    }
  }
  // N: the research overview (DD F, G16). Slots at the top, then the five branches by tier. Tier I
  // runs at the HQ, Tiers II and III at the branch building; Tier III also needs an R&D Lab.
  function buildResearch() {
    const p = G.players[1], bars = [];
    const where = id => Data.BUILDINGS[Game.slotOf(id)].name;
    const slots = el('div', 'rslots');
    for (const slot of ['hq', ...Data.BRANCH_ORDER.map(b => Data.BRANCHES[b].building)]) {   // the R&D Lab slot holds the Truck tracks
      const job = p.research[slot], d = el('div', 'rslot' + (job ? ' on' : '') + (Game.owns(1, slot) ? '' : ' off'));
      d.title = Data.BUILDINGS[slot].name + (Game.owns(1, slot) ? '' : ' (not built)');
      d.appendChild(el('span', 'rsname', Data.BUILDINGS[slot].name)); d.appendChild(el('span', 'rsjob', job ? Data.RESEARCH[job.id].name : Game.owns(1, slot) ? 'idle' : '—'));
      if (job) { const bb = bar('#5a78c8'); d.appendChild(bb); bars.push([bb, job]); }
      slots.appendChild(d);
    }
    content.appendChild(slots);
    content.appendChild(el('div', 'small', 'One project per building type at a time. B = stats for newly trained units, G = a rule that applies at once, U = unlock. Tier III needs an R&D Lab.'));
    for (const br of Data.BRANCH_ORDER) {
      const B = Data.BRANCHES[br];
      content.appendChild(el('h3', null, B.name + ' · ' + Data.BUILDINGS[B.building].name));
      for (const id of Data.RESEARCH_ORDER) {
        const r = Data.RESEARCH[id]; if (r.branch !== br) continue;
        const s = Game.researchState(p, id);
        const label = { done: 'Done', active: 'In progress', locked: Game.researchLock(p, id), busy: 'The ' + where(id) + ' is busy', poor: 'Not enough resources', ready: 'Click to research' }[s];
        let extra = null;
        if (s === 'active') { extra = bar('#5a78c8'); bars.push([extra, p.research[Game.slotOf(id)]]); }
        const icon = r.unlock ? Data.UNITS[r.unlock].icon : r.icon || 'flask';
        content.appendChild(card({ icon, iconBg: s === 'done' ? '#2f6b3a' : '#2a2a2e', shape: r.unlock ? Data.UNITS[r.unlock].shape : null, name: (r.branch === 'lab' ? (r.track ? 'Lv ' + p.tracks[r.track] + ' → ' + (p.tracks[r.track] + 1) : '★') : ['I', 'II', 'III'][r.tier - 1]) + ' · ' + r.name + ' (' + r.tag + ')', cost: Util.costStr(Game.researchCost(p, id)) + ' · ' + r.time + ' s · ' + where(id), desc: r.desc + ' — ' + label, disabled: s !== 'ready', extra, onclick: () => { Game.command({ kind: 'research', research: id }); refresh(); } }));
      }
    }
    tick = () => { for (const [bb, job] of bars) bb.fill.style.width = (job.t / job.total * 100) + '%'; };
  }

  return { get tab() { return tab; }, init, update, refresh, refreshSpeed, refreshMusic, toggleHelp, showTab, el, btn, card };
})();
