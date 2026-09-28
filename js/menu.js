'use strict';
// Start menu: pick a map and a difficulty. Also reachable from the top bar to start a new game.
// TODO(patch 0.8): save/load slots and a settings section (scroll speed, edge scrolling on/off, sound volume).
const Menu = (() => {
  let open = false, mapId = 'highland', diff = 'normal', root = null;
  const thumbs = {};

  // Builds every map once for its preview. Call before the real map is built (it reuses Terrain).
  function prepareThumbnails() { for (const m of MapGen.MAPS) thumbs[m.id] = MapGen.thumbnail(m, 160); }

  function show() { open = true; root = document.getElementById('menu'); root.classList.remove('hidden'); build(); }
  function hide() { open = false; root.classList.add('hidden'); }

  function build() {
    const { el, btn } = UI;
    root.innerHTML = '';
    const box = el('div', 'menubox');
    box.appendChild(el('h1', null, 'Dot War'));
    box.appendChild(el('div', 'small', 'Pick a map and a difficulty. Every unit is a dot; the terrain decides the fight.'));
    const grid = el('div', 'mapgrid');
    for (const m of MapGen.MAPS) {
      const c = el('div', 'mapcard' + (m.id === mapId ? ' on' : ''));
      if (thumbs[m.id]) { const cv = document.createElement('canvas'); cv.width = 160; cv.height = 160; cv.getContext('2d').drawImage(thumbs[m.id], 0, 0); c.appendChild(cv); }
      c.appendChild(el('div', 'name', m.name));
      c.appendChild(el('div', 'small', m.desc));
      c.onclick = () => { mapId = m.id; build(); };
      grid.appendChild(c);
    }
    box.appendChild(grid);
    const spec = MapGen.MAPS.find(m => m.id === mapId);
    const dr = el('div', 'diffrow');
    dr.appendChild(el('span', null, 'Difficulty'));
    for (const d of Data.DIFFICULTY_ORDER) { const b = btn(Data.DIFFICULTY[d].name, () => { diff = d; build(); }, Data.DIFFICULTY[d].desc); if (d === diff) b.classList.add('on'); if (!spec.ai) b.disabled = true; dr.appendChild(b); }
    box.appendChild(dr);
    box.appendChild(el('div', 'small', spec.ai ? Data.DIFFICULTY[diff].desc : 'Sandbox map: there is no enemy commander, only neutral guards.'));
    const row = el('div', 'row'); row.style.marginTop = '14px';
    const start = btn('Start game', () => { hide(); Music.start(); Main.start(mapId, diff); }); start.classList.add('startbtn'); row.appendChild(start);
    if (Main.started) row.appendChild(btn('Back to current game', () => { hide(); Music.start(); }));
    box.appendChild(row);
    const mus = el('label', 'ed'); mus.style.marginTop = '12px';
    const mt = btn(Music.enabled ? '♫ Music on' : '♫ Music off', () => { Music.toggle(); build(); }); if (Music.enabled) mt.classList.add('on'); mus.appendChild(mt);
    const vol = el('input'); vol.type = 'range'; vol.min = 0; vol.max = 100; vol.value = Math.round(Music.volume * 100); vol.title = 'Volume'; vol.oninput = () => Music.setVolume(vol.value / 100); mus.appendChild(vol);
    mus.appendChild(el('span', 'small', Music.CREDIT));
    box.appendChild(mus);
    box.appendChild(el('div', 'small', 'F1 shows the controls at any time.'));
    root.appendChild(box);
  }

  return { show, hide, prepareThumbnails, get open() { return open; } };
})();
