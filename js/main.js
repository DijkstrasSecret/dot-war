'use strict';
// Entry point: loading screen, menu, map build, module wiring, and the fixed-step game loop.
// TIME_SCALE halves the pace of the whole simulation; balance numbers in data.js are unchanged.
// TODO(patch 0.8): save/load (serialise G plus the map spec id) and a pause-on-blur option.
const Main = (() => {
  const STEP = 1 / 30;
  const TIME_SCALE = 0.5;   // 1x runs at half real time; 2x matches the original build's pace
  let last = 0, acc = 0, started = false, endShown = false, loading = false;

  // Building a match, as named steps so the loading bar can follow real work.
  function steps(mapId, difficulty, faction) {
    const spec = MapGen.MAPS.find(m => m.id === mapId) || MapGen.MAPS[0];
    return [
      { label: 'Surveying ' + spec.name, run: () => {
        Game.init();
        G.difficulty = difficulty || 'normal'; G.mapId = spec.id; G.sandbox = !spec.ai;
        // DD K: the player's faction, and a different random one for the AI. Neutrals stay mixed (null).
        // TODO(patch 0.2.1): pick the AI faction from the match seed instead of Math.random.
        const ids = Portraits.factions.map(f => f.id);
        G.players[1].faction = ids.includes(faction) ? faction : ids[0];
        const others = ids.filter(f => f !== G.players[1].faction);
        G.players[2].faction = others[Math.floor(Math.random() * others.length)];
        MapGen.build(spec, Data.DIFFICULTY[G.difficulty]);
      } },
      { label: 'Plotting routes', run: () => { Path.init(); Fog.init(); AI.reset(); } },
      { label: 'Drawing the map', run: () => { Terrain.flushDirty(); Fog.update(0, true); } },
      { label: 'Deploying', run: () => {
        if (!started) { Render.init(); Input.init(); UI.init(); started = true; }
        const hq = G.buildings.find(b => b.owner === 1 && b.type === 'hq');
        Render.cam.zoom = 1.4; Render.centerOn(hq.x, hq.y - 40);
        endShown = false; document.getElementById('msg').classList.add('hidden');
        Game.setSpeed(1); UI.refresh(); acc = 0;
        Game.toast(spec.hint || 'Good luck.');
      } },
    ];
  }
  // Synchronous start, for the console and headless tests. The menu uses load() instead.
  function start(mapId, difficulty, faction) { for (const s of steps(mapId, difficulty, faction)) s.run(); }
  // Start behind the loading screen; the game loop idles until the screen is gone.
  async function load(mapId, difficulty, faction) {
    loading = true;
    try { await Loading.run(steps(mapId, difficulty, faction)); } finally { loading = false; }
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (loading) { requestAnimationFrame(frame); return; }
    if (!Menu.open) Input.update(dt);
    if (!G.over && !Menu.open) {
      acc += dt * G.speed * TIME_SCALE; let n = 0;
      while (acc >= STEP && n < 8) { Game.update(STEP); acc -= STEP; n++; }
      if (n === 8) acc = 0;
    }
    Terrain.flushDirty();
    Render.draw();
    UI.update(dt);
    if (G.over && !endShown) {
      endShown = true; const m = document.getElementById('msg'); const s = G.stats[1];
      m.innerHTML = (G.winner === 1 ? 'Victory!' : 'Defeat') + '<br><span style="font-size:16px;font-weight:400">' + (G.winner === 1 ? 'The mountain is yours.' : 'Your headquarters was destroyed.') + '<br>Time ' + Util.fmtTime(G.time) + ' · kills ' + s.kills + ' · losses ' + s.lost + '<br>Open the menu to play again.</span>';
      m.classList.remove('hidden');
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener('load', async () => {
    // First load: one thumbnail per map, then the default match, all behind the loading screen.
    const boot = MapGen.MAPS.map(m => ({ label: 'Charting ' + m.name, run: () => Menu.prepareThumbnail(m) }));
    loading = true;
    try { await Loading.run(boot.concat(steps('highland', 'normal'))); } finally { loading = false; }
    Menu.show();
    last = performance.now(); requestAnimationFrame(frame);
  });
  return { start, load, get started() { return started; }, get loading() { return loading; }, TIME_SCALE };
})();
