'use strict';
// Start menu over a random menu painting (PaintingFx): a front page with serif buttons on the
// painting's dark left side, and a "New game" page with the map, difficulty and army choices.
// Also reachable from the top bar. The painting engine runs only while the menu is open.
// TODO(patch 0.8): save/load slots and a settings section (scroll speed, edge scrolling on/off, sound volume).
const Menu = (() => {
  let open = false, view = 'front', mapId = 'random', diff = 'normal', faction = 'british', played = false;
  let root = null, fx = null, canvas = null, col = null, paintingId = null;
  const thumbs = {};

  // Builds one map for its preview. Call before the real map is built (it reuses Terrain).
  function prepareThumbnail(m) { thumbs[m.id] = m.generated ? randomThumb() : MapGen.thumbnail(m, 160); }
  // 0.7: a generated map has no picture before it exists; show a drawn stand-in (the minimap shows the real one).
  function randomThumb() {
    const c = document.createElement('canvas'); c.width = 160; c.height = 160; const x = c.getContext('2d');
    x.fillStyle = '#e9e4d2'; x.fillRect(0, 0, 160, 160); x.strokeStyle = '#b08a5a'; x.lineWidth = 1;
    for (let r = 10; r < 90; r += 12) { x.beginPath(); x.ellipse(112, 44, r, r * 0.8, 0.4, 0, Math.PI * 2); x.stroke(); }
    x.strokeStyle = '#5b9bd5'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 70); x.bezierCurveTo(50, 60, 70, 120, 160, 110); x.stroke();
    x.strokeStyle = '#c0392b'; x.lineWidth = 2; x.beginPath(); x.moveTo(22, 140); x.quadraticCurveTo(80, 100, 112, 44); x.stroke();
    x.fillStyle = Data.PLAYER_COLORS[1]; x.fillRect(16, 134, 12, 12); x.fillStyle = Data.PLAYER_COLORS[2]; x.fillRect(106, 38, 12, 12);
    x.fillStyle = '#5a4a32'; x.font = 'bold 40px Georgia, serif'; x.textAlign = 'center'; x.fillText('?', 80, 95);
    return c;
  }
  function prepareThumbnails() { for (const m of MapGen.MAPS) prepareThumbnail(m); }

  function ensure() {
    if (root) return;
    root = document.getElementById('menu');
    canvas = root.querySelector('canvas');
    fx = PaintingFx.create(canvas, { base: 'assets/paintings/' });
    col = UI.el('div'); root.appendChild(col);
  }
  function show() {
    ensure(); open = true; view = 'front';
    root.classList.remove('hidden'); root.classList.remove('in');
    paintingId = PaintingFx.pick('menu');
    fx.show(paintingId).catch(() => {}); fx.start();
    requestAnimationFrame(() => root.classList.add('in'));
    build();
  }
  function hide() { open = false; root.classList.add('hidden'); root.classList.remove('in'); if (fx) fx.stop(); }
  // Escape: the setup page goes back to the front; the front returns to a running game.
  function back() { if (view === 'setup') { view = 'front'; build(); } else if (played) hide(); }

  // White serif button with the hover underline and a short flash on click.
  function mbtn(label, onclick, title) {
    const b = UI.el('button', 'mbtn', label); if (title) b.title = title;
    b.onclick = () => { b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); setTimeout(onclick, 120); };
    return b;
  }
  function pill(label, on, onclick, title) {
    const b = UI.el('button', 'pill' + (on ? ' on' : ''), label); b.onclick = onclick; if (title) b.title = title; return b;
  }

  function build() { col.innerHTML = ''; col.className = view === 'front' ? 'mcol' : 'msetup'; if (view === 'front') buildFront(); else buildSetup(); }

  function buildFront() {
    const { el } = UI;
    col.appendChild(el('h1', null, 'Dot War'));
    const info = paintingId && PaintingFx.info(paintingId);
    col.appendChild(el('div', 'sub', info ? info.title + ' · ' + info.after : ''));
    const nav = el('nav');
    nav.appendChild(mbtn('New game', () => { view = 'setup'; build(); }));
    if (played) nav.appendChild(mbtn('Continue', () => { hide(); Music.start(); }, 'Back to the current game (Esc)'));
    nav.appendChild(mbtn(Music.enabled ? 'Music on' : 'Music off', () => { Music.toggle(); build(); }, Music.CREDIT));
    nav.appendChild(mbtn('Controls', () => UI.toggleHelp(true), 'The key list (F1)'));
    col.appendChild(nav);
  }

  function buildSetup() {
    const { el } = UI;
    col.appendChild(el('h2', null, 'New game'));
    col.appendChild(el('div', 'small', 'Pick a map, a difficulty and an army. Every unit is a dot; the terrain decides the fight.'));
    const grid = el('div', 'mapgrid');
    for (const m of MapGen.MAPS) {
      const c = el('div', 'mapcard' + (m.id === mapId ? ' on' : ''));
      if (thumbs[m.id]) { const cv = document.createElement('canvas'); cv.width = 160; cv.height = 160; cv.getContext('2d').drawImage(thumbs[m.id], 0, 0); c.appendChild(cv); }
      c.appendChild(el('div', 'name', m.name));
      c.appendChild(el('div', 'small', m.desc));
      c.onclick = () => { mapId = m.id; build(); };
      grid.appendChild(c);
    }
    col.appendChild(grid);
    const spec = MapGen.MAPS.find(m => m.id === mapId);
    const dr = el('div', 'mrow'); dr.appendChild(el('span', null, 'Difficulty'));
    for (const d of Data.DIFFICULTY_ORDER) { const b = pill(Data.DIFFICULTY[d].name, d === diff, () => { diff = d; build(); }, Data.DIFFICULTY[d].desc); if (!spec.ai) b.disabled = true; dr.appendChild(b); }
    col.appendChild(dr);
    col.appendChild(el('div', 'small', spec.ai ? Data.DIFFICULTY[diff].desc : 'Sandbox map: there is no enemy commander, only neutral guards.'));
    // DD K: faction changes looks and names only; every army plays the same.
    const fr = el('div', 'mrow'); fr.appendChild(el('span', null, 'Your army'));
    for (const f of Portraits.factions) fr.appendChild(pill(f.label, f.id === faction, () => { faction = f.id; build(); }, 'Uniforms and names only; every army plays the same.'));
    col.appendChild(fr);
    const vr = el('div', 'mrow'); vr.appendChild(el('span', null, 'Music'));
    vr.appendChild(pill(Music.enabled ? 'On' : 'Off', Music.enabled, () => { Music.toggle(); build(); }, Music.CREDIT));
    const vol = el('input'); vol.type = 'range'; vol.min = 0; vol.max = 100; vol.value = Math.round(Music.volume * 100); vol.title = 'Volume'; vol.oninput = () => Music.setVolume(vol.value / 100); vr.appendChild(vol);
    vr.appendChild(el('span', 'small', Music.CREDIT));
    col.appendChild(vr);
    const actions = el('div', 'mactions');
    actions.appendChild(mbtn('Start', () => { played = true; Main.load(mapId, diff, faction); hide(); Music.start(); }));
    actions.appendChild(mbtn('Back', () => { view = 'front'; build(); }, 'Esc'));
    col.appendChild(actions);
    col.appendChild(el('div', 'small', 'F1 shows the controls at any time.'));
  }

  return { show, hide, back, prepareThumbnail, prepareThumbnails, get open() { return open; } };
})();
