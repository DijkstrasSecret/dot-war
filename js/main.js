'use strict';
// Entry point: menu, map build, module wiring, and the fixed-step game loop.
// TIME_SCALE halves the pace of the whole simulation; balance numbers in data.js are unchanged.
// TODO(patch 0.8): save/load (serialise G plus the map spec id) and a pause-on-blur option.
const Main = (() => {
  const STEP = 1 / 30;
  const TIME_SCALE = 0.5;   // 1x runs at half real time; 2x matches the original build's pace
  let last = 0, acc = 0, started = false, endShown = false;

  function start(mapId, difficulty) {
    const spec = MapGen.MAPS.find(m => m.id === mapId) || MapGen.MAPS[0];
    Game.init();
    G.difficulty = difficulty || 'normal'; G.mapId = spec.id; G.sandbox = !spec.ai;
    MapGen.build(spec, Data.DIFFICULTY[G.difficulty]);
    Path.init(); Fog.init(); AI.reset();
    Terrain.flushDirty(); Fog.update(0, true);
    if (!started) { Render.init(); Input.init(); UI.init(); started = true; }
    const hq = G.buildings.find(b => b.owner === 1 && b.type === 'hq');
    Render.cam.zoom = 1.4; Render.centerOn(hq.x, hq.y - 40);
    endShown = false; document.getElementById('msg').classList.add('hidden');
    Game.setSpeed(1); UI.refresh(); acc = 0;
    Game.toast(spec.hint || 'Good luck.');
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
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

  window.addEventListener('load', () => {
    Menu.prepareThumbnails();
    start('highland', 'normal');
    Menu.show();
    last = performance.now(); requestAnimationFrame(frame);
  });
  return { start, get started() { return started; }, TIME_SCALE };
})();
