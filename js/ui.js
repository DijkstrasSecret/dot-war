'use strict';
// Side panel and top bar (DOM). Rebuilds a tab only when its content signature changes.
// TODO(patch 0.5): blueprint designer tab (chassis + weapon + armour, saved logos) once custom blueprints exist.
// TODO(patch 0.8): unit tooltips on hover and an in-game tutorial overlay for Highland Pass.
const UI = (() => {
  let tab = 'sel', content, clockEl, speedBtns, sig = '', tick = null, refreshT = 0;
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
  function soldierName(u) { return Portraits.name(u.id, { faction: u.faction, era: u.kitEra, rank: u.rank || 0 }); }
  function portraitEl(u, size) {
    const img = el('img', 'portrait');
    img.width = img.height = size; img.alt = soldierName(u).full;
    img.src = Portraits.dataURL(u.id, { team: Data.PLAYER_COLORS[u.owner], faction: u.faction, era: u.kitEra, size });
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
    const resBox = document.getElementById('resources');
    for (const r of Data.RES) {
      const d = el('div', 'res'); d.title = r.charAt(0).toUpperCase() + r.slice(1);
      d.appendChild(Icons.makeCanvas(r, 32, Data.RES_COLORS[r]));
      const s = el('span'); d.appendChild(s); resBox.appendChild(d); resEls[r] = s;
    }
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
    sig = ''; refreshT = 0;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    refreshSpeed();
  }
  function showTab(t) { tab = t; refresh(); }

  function update(dt) {
    const p = G.players[1];
    for (const r of Data.RES) { const v = Math.floor(p.res[r]); resEls[r].textContent = v; resEls[r].className = v < 20 ? 'low' : ''; }
    clockEl.textContent = Util.fmtTime(G.time) + (G.speed === 0 ? '  ⏸' : '');
    refreshT -= dt;
    if (refreshT > 0) { if (tick) tick(); return; }
    refreshT = 0.2;
    const s = signature();
    if (s !== sig) { sig = s; build(); }
    if (tick) tick();
  }
  function signature() {
    const p = G.players[1];
    let s = tab + '|' + Input.state.mode + '|' + (Input.state.buildType || '') + '|' + [...p.unlocked].join(',') + '|' + [...p.done].join(',') + '|' + (p.research ? p.research.id : '') + '|';
    if (tab === 'sel') s += G.selection.map(e => e.id + ':' + (e.dead ? 'd' : '') + (e instanceof Building ? e.queue.map(q => q.type).join('.') + ':' + e.built + ':' + e.workers.length + ':' + e.level + ':' + e.garrison.join('.') + ':' + !!e.upgrading : (e.work || '') + ':' + (e.order ? e.order.type : '') + ':' + (e.flee > 0) + ':' + e.suppressed)).join(',');
    if (tab === 'build') s += Data.BUILD_LIST.map(t => Game.canAfford(p, Data.BUILDINGS[t].cost)).join(',');
    if (tab === 'research') s += Data.RESEARCH_ORDER.map(r => Game.researchState(p, r)).join(',');
    if (tab === 'sel') { const b = G.selection[0]; if (b instanceof Building && b.def.produces) s += '|' + b.def.produces.map(t => p.unlocked.has(t) && Game.canAfford(p, p.blueprints[t].cost)).join(','); }
    return s;
  }

  function build() {
    content.innerHTML = ''; tick = null;
    if (tab === 'sel') buildSel(); else if (tab === 'build') buildBuild(); else buildResearch();
  }

  function commandCard(units) {
    const grid = el('div', 'cmdgrid'); const mode = Input.state.mode;
    const items = [
      ['Walk', 'W', () => Input.setMode('walk'), mode === 'walk', 'Then click where to go. Hold Shift to queue waypoints.'],
      ['Attack', 'A', () => Input.setMode('attack'), mode === 'attack', 'Then click an enemy or a point. Mortars bombard the point.'],
      ['Defend', 'D', () => Game.orderHold(units), false, 'Hold this position and fire at anything in range.'],
      ['Retreat', 'S', () => Game.orderRetreat(units), false, 'Pull back a short way towards your headquarters.'],
      ['Stop', 'X', () => Game.orderStop(units), false, 'Cancel all orders (also releases workers).'],
      ['Work', 'E', () => Input.setMode('work'), mode === 'work', 'Then click a Lumber Camp or Mine to staff it.'],
    ];
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
      content.appendChild(el('h3', null, 'Nothing selected'));
      content.appendChild(el('div', 'small', 'Drag to select units. Then W walk, A attack, D defend, S retreat, X stop, E work. Right click also moves or attacks. Hold Shift to queue orders back to back.'));
      content.appendChild(el('div', 'small', 'B build, N research, H headquarters, Tab cycles factories. Arrow keys, screen edge or middle-mouse drag pan the map. Press F1 for all controls.'));
      content.appendChild(el('div', 'small', 'Hold high ground: units see farther, shoot farther and hit harder downhill. Ridges block sight and bullets. Forests hide and protect.'));
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
  function unitPanel(u) {
    const own = u.owner === 1;
    content.appendChild(card({ img: portraitEl(u, 72), name: soldierName(u).full, cost: u.def.name + ' · ' + armyLabel(u.owner), desc: u.def.desc }));
    const hp = bar('#5ad65a'), st = bar('#ffb000');
    content.appendChild(el('div', 'small', 'Health')); content.appendChild(hp);
    content.appendChild(el('div', 'small', 'Stress')); content.appendChild(st);
    const status = el('div', 'small'); status.style.margin = '6px 0'; content.appendChild(status);
    const w = u.stats.weapon; const box = el('div');
    box.appendChild(statRow('Damage', w.dmg.toFixed(0) + ' ' + w.dtype + (w.splash ? ', splash ' + w.splash : '')));
    box.appendChild(statRow('Range', (w.minRange ? w.minRange + '–' : '') + w.range.toFixed(0)));
    box.appendChild(statRow('Accuracy', Math.round(w.acc * 100) + '%'));
    box.appendChild(statRow('Reload', w.reload.toFixed(1) + ' s'));
    box.appendChild(statRow('Speed', u.stats.speed.toFixed(0)));
    box.appendChild(statRow('Vision', u.stats.vision.toFixed(0)));
    box.appendChild(statRow('Armor', u.def.armor));
    if (w.ammo) box.appendChild(statRow('Ammo per shot', Util.costStr(w.ammo)));
    content.appendChild(box);
    if (own) content.appendChild(commandCard([u]));
    tick = () => {
      hp.fill.style.width = (u.hp / u.stats.hp * 100) + '%'; st.fill.style.width = (u.stress * 100) + '%';
      const h = Terrain.hAt(u.x, u.y).toFixed(0);
      let s = 'Elevation ' + h + ' m. ';
      if (u.flee > 0) s += 'Panicking! '; else if (u.suppressed) s += 'Suppressed: cannot pick targets. ';
      if (u.work != null) s += 'Working. '; else if (u.order) s += ({ move: 'Moving', attackmove: 'Attack-moving', attack: 'Attacking target', bombard: 'Bombarding', hold: 'Holding position', work: 'Going to work' })[u.order.type] + '. '; else s += 'Idle. ';
      if (u.target) s += 'Firing at ' + (u.target.def.name) + '.';
      status.textContent = s;
    };
  }
  function groupPanel(units) {
    content.appendChild(el('h3', null, units.length + ' units selected'));
    const counts = {}; for (const u of units) counts[u.type] = (counts[u.type] || 0) + 1;
    const row = el('div', 'row');
    for (const [t, n] of Object.entries(counts)) {
      const d = Data.UNITS[t]; const q = el('div', 'q'); q.title = d.name + ' ×' + n + ' (click to select only these)';
      q.appendChild(Icons.makeCanvas(d.icon, 60, '#fff', Data.PLAYER_COLORS[1], d.shape));
      const lab = el('div', null, String(n)); lab.style.cssText = 'position:absolute;right:1px;bottom:0;font-size:10px;color:#fff;text-shadow:0 0 2px #000';
      q.appendChild(lab); q.onclick = () => Input.select(units.filter(u => u.type === t), false);
      const wrap = el('div', 'queue'); wrap.appendChild(q); row.appendChild(wrap);
    }
    content.appendChild(row);
    const status = el('div', 'small'); content.appendChild(status);
    content.appendChild(commandCard(units));
    tick = () => { const sup = units.filter(u => u.suppressed).length, hp = units.reduce((a, u) => a + u.hp / u.stats.hp, 0) / units.length; status.textContent = 'Average health ' + Math.round(hp * 100) + '%' + (sup ? ', ' + sup + ' suppressed' : ''); };
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
      b.def.produces.filter(t => p.unlocked.has(t)).forEach((t, i) => {
        const bp = p.blueprints[t];
        content.appendChild(card({ icon: bp.icon, iconBg: Data.PLAYER_COLORS[1], shape: bp.shape, name: '[' + Data.TRAIN_HOTKEYS[i] + '] ' + bp.name, cost: Util.costStr(bp.cost) + ' · ' + Math.round(bp.time / b.def.prodMult) + ' s', desc: bp.desc, disabled: !Game.canAfford(p, bp.cost), onclick: () => { Game.enqueue(b, t); refresh(); } }));
      });
      content.appendChild(el('div', 'small', 'Queue (click to cancel). Right click the map to set a rally point. Tab cycles factories.'));
      qrow = el('div', 'queue'); content.appendChild(qrow);
      b.queue.forEach((q, i) => {
        const d = Data.UNITS[q.type]; const qe = el('div', 'q'); qe.title = d.name;
        qe.appendChild(Icons.makeCanvas(d.icon, 60, '#fff', Data.PLAYER_COLORS[1], d.shape));
        const pr = el('div', 'prog'); qe.appendChild(pr); qe.prog = pr; qe.onclick = () => { Game.cancelQueue(b, i); refresh(); };
        qrow.appendChild(qe);
      });
    }
    let upBar = null;
    if (own && b.built && b.def.tower) {
      const lv = b.levelDef; const maxLv = b.def.levels.length;
      content.appendChild(el('h3', null, 'Scout Tower, level ' + b.level + ' of ' + maxLv));
      content.appendChild(el('div', 'small', 'Holds ' + lv.cap + ' infantry' + (lv.heavy ? ' and ' + lv.heavy + ' mortar' : '') + '. Adds ' + lv.height + ' m of height and ' + lv.vision + ' vision. Select infantry and press E or right click the tower to garrison.'));
      const g = el('div', 'queue'); g.style.margin = '6px 0';
      for (const id of b.garrison) {
        const u = G.unitById.get(id); if (!u || u.dead) continue;
        const q = el('div', 'q'); q.title = soldierName(u).short + ', ' + u.def.name + ' (click to unload)';
        q.appendChild(Icons.makeCanvas(u.def.icon, 60, '#fff', Data.PLAYER_COLORS[1], u.def.shape));
        q.onclick = () => { b.garrison = b.garrison.filter(x => x !== id); u.inside = null; u.hBonus = 0; const ang = Math.random() * Math.PI * 2; u.x = b.x + Math.cos(ang) * (b.size + 16); u.y = b.y + Math.sin(ang) * (b.size + 16); refresh(); };
        g.appendChild(q);
      }
      if (!b.garrison.length) g.appendChild(el('div', 'small', 'Empty.'));
      content.appendChild(g);
      const row = el('div', 'row');
      if (b.level < maxLv) {
        const next = b.def.levels[b.level];
        const ub = btn('[G] Upgrade: ' + Util.costStr(next.cost) + ' · ' + next.time + ' s', () => { Game.upgradeTower(b); refresh(); }, 'Level ' + (b.level + 1) + ': ' + next.cap + ' infantry' + (next.heavy ? ' + ' + next.heavy + ' mortar' : '') + ', +' + next.height + ' m');
        ub.disabled = !!b.upgrading || !Game.canAfford(p, next.cost); row.appendChild(ub);
      }
      row.appendChild(btn('[U] Unload all', () => { Game.unloadBuilding(b); refresh(); }));
      content.appendChild(row);
      if (b.upgrading) { upBar = bar('#ffd257'); content.appendChild(el('div', 'small', 'Upgrading')); content.appendChild(upBar); }
    }
    if (own && b.built && b.def.harvest) {
      content.appendChild(el('h3', null, 'Harvesting'));
      content.appendChild(el('div', 'small', 'Select infantry and right click this building to assign up to ' + b.def.maxWorkers + ' workers. Each worker adds ' + b.def.perWorker + '/s.'));
      const row = el('div', 'row'); row.appendChild(btn('Release workers', () => { const ws = b.workers.map(id => G.unitById.get(id)).filter(Boolean); Game.orderStop(ws); refresh(); })); content.appendChild(row);
    }
    tick = () => {
      hp.fill.style.width = (b.hp / b.def.hp * 100) + '%';
      if (prog) prog.fill.style.width = (b.progress * 100) + '%';
      let s = '';
      if (b.def.harvest && b.built) s += 'Rate ' + Game.harvestRate(b).toFixed(1) + ' ' + (b.def.harvest === 'wood' ? 'wood' : b.depositType || '?') + '/s, workers ' + Game.activeWorkers(b) + '/' + b.def.maxWorkers + '. ';
      if (b.queue.length) s += 'Training ' + Data.UNITS[b.queue[0].type].name + ' (' + Math.ceil(b.queue[0].total - b.queue[0].t) + ' s).';
      status.textContent = s;
      if (qrow) b.queue.forEach((q, i) => { const qe = qrow.children[i]; if (qe) qe.prog.style.width = (q.t / q.total * 100) + '%'; });
    };
  }
  function buildBuild() {
    const p = G.players[1];
    content.appendChild(el('div', 'small', 'Press B for this tab. Pick a building (or press its key), then click on visible, fairly flat ground. Shift-click places several. Right click cancels.'));
    for (const t of Data.BUILD_LIST) {
      const d = Data.BUILDINGS[t];
      content.appendChild(card({ icon: d.icon, name: '[' + Data.BUILD_HOTKEYS[t] + '] ' + d.name, cost: Util.costStr(d.cost) + ' · ' + d.buildTime + ' s', desc: d.desc, disabled: !Game.canAfford(p, d.cost), active: Input.state.mode === 'build' && Input.state.buildType === t, onclick: () => { if (Input.state.mode === 'build' && Input.state.buildType === t) Input.setMode('normal'); else Input.setMode('build', t); } }));
    }
  }
  function buildResearch() {
    const p = G.players[1];
    content.appendChild(el('div', 'small', 'Research unlocks new blueprints and improves existing ones. Upgrades apply to newly trained units only. One project at a time.'));
    let activeBar = null;
    for (const id of Data.RESEARCH_ORDER) {
      const r = Data.RESEARCH[id]; const s = Game.researchState(p, id);
      const label = { done: 'Done', active: 'In progress', locked: 'Requires ' + r.req.map(q => Data.RESEARCH[q].name).join(', '), busy: 'Lab busy', poor: 'Not enough resources', ready: 'Click to research' }[s];
      let extra = null;
      if (s === 'active') { extra = bar('#5a78c8'); activeBar = extra; }
      const icon = r.unlock ? Data.UNITS[r.unlock].icon : 'flask';
      content.appendChild(card({ icon, iconBg: s === 'done' ? '#2f6b3a' : '#2a2a2e', shape: r.unlock ? Data.UNITS[r.unlock].shape : null, name: r.name, cost: Util.costStr(r.cost) + ' · ' + r.time + ' s', desc: r.desc + ' — ' + label, disabled: s !== 'ready', extra, onclick: () => { Game.startResearch(1, id); refresh(); } }));
    }
    tick = () => { if (activeBar && p.research) activeBar.fill.style.width = (p.research.t / p.research.total * 100) + '%'; };
  }

  return { init, update, refresh, refreshSpeed, refreshMusic, toggleHelp, showTab, el, btn, card };
})();
