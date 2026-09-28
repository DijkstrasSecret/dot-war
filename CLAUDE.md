# Dot War: notes for Claude Code sessions

Browser RTS in plain JavaScript. No build, no dependencies, no modules: files are classic scripts
loaded in the order listed in `index.html`, each defining one global (`Util`, `Data`, `Icons`,
`Terrain`, `Path`, `Fog`, `Game`/`G`, `AI`, `Render`, `Input`, `UI`, `MapGen`, `Music`, `Menu`,
`Main`). The map editor lives in `attic/editor.js`, shelved but kept for a later patch.

Read `DEVELOPMENT.md` before changing simulation code; `ROADMAP.md` lists the agreed next patches;
`grep -rn "TODO(" js` lists the per-module reminders.

## Working rules

- Keep it framework-free and buildless. Do not add npm, bundlers or TypeScript.
- Balance numbers go in `js/data.js` (units, buildings, tower levels, research, difficulty);
  formulas in `js/game.js` with a short comment.
- Simulation code (`game.js`, `path.js`, `fog.js`, `terrain.js` logic, `ai.js`) must not touch the
  DOM or canvas, so it can run headless in a loop for testing.
- Flow-field costs stay `Float64Array` (Float32 makes Dijkstra loop for minutes).
- Player ids: 0 neutral, 1 human, 2 AI. Buildings use `b.maxHp`, never `def.hp`.
- The user's hotkey scheme (W walk, A attack, D defend, S retreat, X stop, E work/garrison,
  B build, Shift queue, middle mouse pan) is fixed; add keys, do not remap these.

## Running and testing

- Preview server: `.claude/launch.json` entry `dotgame` runs `python serve.py 8765`, which sends
  no-cache headers. Never use `python -m http.server`: the browser keeps stale scripts and tests
  lie. If in doubt, check `Terrain.cellPassable.toString()` for a recent change.
- Headless check in the page console: `Menu.hide(); Main.start('highland', 'normal'); Game.setSpeed(0);`
  then `for (let i = 0; i < 1800; i++) Game.update(1/30);` and inspect `G.units`, `G.stats`,
  `G.players[1].res`. Keep single console scripts under about two seconds of work.
- Map connectivity: `Path.reachable(Path.getField(hq.x, hq.y + 60, 'infantry', 0), x, y)` for
  every deposit and the enemy HQ after touching `maps.js` or `terrain.js`.
- Force a frame when the browser pane is hidden: `Render.draw(); UI.update(0.3);`. Screenshots of a
  hidden pane are stale; rely on state checks then.
- Debug hooks: `Game._dbg.{validTarget, acquire, inRange, canSee, tryFire, applyDamage, kill}`.

## Style

Two-space indent, single quotes, semicolons, compact one-line helpers are fine, comments explain
intent not syntax. Prefer editing data over adding branches.
