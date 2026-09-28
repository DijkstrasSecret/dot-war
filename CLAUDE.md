# Dot War: notes for Claude Code sessions

Browser RTS in plain JavaScript. No build, no dependencies, no modules: files are classic scripts
loaded in the order listed in `index.html`, each defining one global (`Util`, `Data`, `Icons`,
`Terrain`, `Path`, `Fog`, `Game`/`G`, `AI`, `Render`, `Input`, `Portraits`, `UI`, `MapGen`, `Music`,
`Menu`, `Main`). The map editor lives in `attic/editor.js`, shelved but kept for a later patch.

Read `DEVELOPMENT.md` before changing simulation code; `grep -rn "TODO(" js` lists the per-module
reminders.

## Design documents and the build plan

New session? Read `PROJECT_SUMMARY.md` first: it sums up every planned change and lists the things
that are easy to mix up.

| File | Role |
| --- | --- |
| `PROJECT_SUMMARY.md` | Overview of the design work so far, the build order and the next steps. |
| `GAME_DESIGN.md` | The game **as built**. When a balance number or rule changes, update it too, so it keeps describing the code. |
| `DESIGN_DECISIONS.md` | Everything **agreed but not yet built** (28 September 2026). When its sections disagree: **J > I > G > F > the rest**. |
| `IMPLEMENTATION_PLAN.md` | The patch order (0.2a → 0.8, infantry first) with task checklists. Tick boxes as you finish. It supersedes the patch order in `ROADMAP.md`. |
| `PATCH_0.2a_PORTRAITS.md` | Step-by-step guide for patch 0.2a, with a ready-made diff in `patches/`. |

If a decision contradicts itself in a way the precedence doesn't settle, or proves broken in play:

1. Stop and ask the user.
2. Record the answer in `DESIGN_DECISIONS.md` before coding it.

Never change a design decision silently.

The user designs the game but is not a heavy coder. Explain changes in plain words and give
step-by-step instructions for anything he has to run or check.

## Working rules

- Keep it framework-free and buildless. Do not add npm, bundlers or TypeScript.
- Balance numbers go in `js/data.js` (units, buildings, tower levels, research, difficulty);
  formulas in `js/game.js` with a short comment naming the decision (e.g. `// DD Q9`).
- Simulation code (`game.js`, `path.js`, `fog.js`, `terrain.js` logic, `ai.js`) must not touch the
  DOM or canvas, so it can run headless in a loop for testing and in the Balance Lab (`lab.html`).
- **Portraits** (from patch 0.2a): `js/portraits.js` is visual only. It builds faces, faction
  uniforms and names from a unit id, with its own random stream. Only `UI`, `Menu` and `Main` may
  call it; the simulation only stores the cosmetic `faction` and `kitEra` fields. Factions change
  looks and names, never stats (`DESIGN_DECISIONS.md` section K).
- **Randomness** (from patch 0.2.1): the simulation uses a seeded `Util.mulberry32` stream, never
  `Math.random`. Visual-only randomness (decals, corpses) uses a separate stream.
- **Time:** every "minute" in the design docs is a game minute (30 simulation steps per game
  second).
- **Stacking:** bonuses and penalties multiply, then the section I caps apply: hit chance ≤ 0.95,
  stress taken ≥ ×0.25, speed ≥ ×0.2, vision ≥ ×0.35. Use one shared helper.
- Flow-field costs stay `Float64Array` (Float32 makes Dijkstra loop for minutes).
- Player ids: 0 neutral, 1 human, 2 AI. Civilians get their own id (patch 0.7) that nothing
  auto-targets. Buildings use `b.maxHp`, never `def.hp`.
- **Hotkeys:** the key layout is `DESIGN_DECISIONS.md` section 9. WASD pans the camera, and the
  orders move to F / R / G / X / E / Q. This replaces the old "fixed, do not remap" rule. It is
  built in patch 0.2.1; until then the game keeps W A D S X E for orders. New features take free
  keys; existing ones don't move without asking.
- **Git:**
  - One branch per patch (e.g. `patch-0.2.1`), merged by pull request.
  - Ask before force-pushing, deleting branches or files, or rewriting history.
  - Before finishing a patch, the Balance Lab targets should be green. If one is red, report it;
    don't quietly retune numbers to force it green.

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
