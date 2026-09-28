# Development guide

This is the map of the code for anyone continuing the project. Read `README.md` first for what the
game is and how to run it. Reminders for the next steps are also written as `TODO(...)` comments
at the top of each module; `grep -rn "TODO(" js` lists them.

## 1. Architecture in one page

Everything is plain ES2020 JavaScript loaded as classic `<script>` tags in the order listed in
`index.html`. Each file defines one global module object (an IIFE) or class. There is no bundler,
no module system and no framework, so the game runs from `file://` as well as from a static server.

| Global | File | Owns |
| --- | --- | --- |
| `Util` | util.js | clamp/lerp/dist, `makeNoise(seed)` value-noise with `fbm`, `Heap` (binary min-heap), `fmtTime`, `costStr` |
| `Data` | data.js | every tunable number: units, buildings (tower levels), research, resources, armor table, move classes, hotkeys, difficulty |
| `Icons` | icons.js | vector logos drawn in a [-1,1] box; `drawIcon(ctx, name, x, y, halfSize, color)`, `makeCanvas` for the DOM |
| `Terrain` | terrain.js | heightmap and terrain types, slopes, passability, line of sight, cover, topographic render cache, map JSON |
| `Path` | path.js | flow fields: `getField(x, y, moveClass, now)` and `steer(x, y, field, cls, maxLook)` |
| `Fog` | fog.js | visibility grid per player, fog canvas, building vision (tower levels) |
| `Unit`, `Building`, `Projectile` | entities.js | plain classes; no behaviour, just state |
| `G`, `Game` | game.js | the simulation state (`G`) and every rule: economy, production, research, orders, movement, combat, towers |
| `AI` | ai.js | the enemy commander, parameterised by `Data.DIFFICULTY` |
| `Render` | render.js | draws the world, decals and the minimap; owns the camera |
| `Input` | input.js | mouse and keyboard, command modes, selection |
| `Portraits` | portraits.js | soldier faces, faction kit per era and names from a unit id; visual only, own random stream, called by `UI`, `Menu` and `Main` only |
| `UI` | ui.js | the side panel and top bar (DOM), rebuilt when a content signature changes |
| `MapGen` | maps.js | builds terrain and entities from a spec; holds the four map specs |
| `Music` | audio.js | background music with a remembered on/off and volume |
| `Menu` | menu.js | start menu: map thumbnails, difficulty, music |
| `Main` | main.js | startup and the loop |

Data flow per frame (`Main.frame`):

1. `Input.update` scrolls the camera (skipped while the menu is open).
2. If not over and the menu is closed, `Game.update(1/30)` runs as many fixed steps as
   `elapsed * G.speed * Main.TIME_SCALE` allows (max 8 per frame). `TIME_SCALE` is 0.5, so 1x is
   half real time and 2x is the tempo of the first build.
3. `Terrain.flushDirty` re-renders any dirty part of the terrain cache (only after a map build now).
4. `Render.draw`, then `UI.update` (cheap top bar every frame, panel rebuild only on change).

`Game.update` order: research, buildings (construction, tower upgrades, production, harvesting),
units, separation, projectiles, effects and decals, AI, fog (every 0.25 s), cleanup of dead entities
(every 2 s), win check (skipped for the enemy HQ on sandbox maps).

Startup (`Main` on `load`): `Menu.prepareThumbnails()` builds every map once for its preview,
then `Main.start('highland', 'normal')` builds the real map and `Menu.show()` covers it.
`Main.start(mapId, difficulty)` is the only way to (re)start a game.

## 2. Units of measure

- World units are pixels at zoom 1 and are treated as metres for slopes and heights.
- Maps are 200 x 200 cells of `Terrain.CELL` (12) world units, so 2400 x 2400 world units.
  Heights are metres, roughly 15 to 270.
- Contours every 10 m (`CONTOUR`), index contours every 50 m (`INDEX_EVERY`).
- Speeds are world units per game second. Times in `data.js` are game seconds.

## 3. Terrain

`Terrain.height` is a `Float32Array` of cell-centre heights; `hAt(x, y)` bilinearly interpolates.
`type` is per cell: 0 open, 1 forest, 2 water, 3 swamp. `road` is a cell mask rasterised from
`Terrain.roads` (polylines in world units, radius 9 so diagonal roads stay 4-connected).
`blocked` marks cells under buildings. `slope` is the gradient magnitude.

Movement rules live in three functions and must agree with each other:

- `cellPassable(k, cls)`: not blocked; any road cell is passable (bridges included); otherwise
  not water and `slope <= cls.maxGrade * 1.1`.
- `edgeCost(from, to, cls, d)`: used by the flow field. Infinite if the destination is impassable
  or the grade along the edge exceeds `cls.maxGrade`, except between two road cells where the
  grade is clamped (a road never breaks its own connectivity). Otherwise
  `d / (slopeFactor(grade) * terrainFactor(to))`.
- `moveFactor(x, y, dx, dy, cls)`: used when a unit actually moves, sampled at its exact position,
  with 25% grade leniency so local wiggles do not stop a unit the field routed there.

`slopeFactor`: uphill `1 / (1 + 5 * grade)`, downhill up to 1.25x. `terrainFactor`: road 1.25x,
forest 0.65x, swamp 0.45x for infantry (see `Data.MOVE_CLASSES`). Vehicles have a class with a
lower `maxGrade`, ready for the vehicle patch.

Line of sight (`los`) samples the height along the segment every half cell from an eye 2.2 m above
the ground (plus a tower's height for garrisoned units) to a target 1.8 m above the ground. Terrain
may poke up to `LOS_TOLERANCE` (2.5 m) above the sight line before it blocks. More than 36 world
units of forest along the line also blocks, so forests conceal beyond about three cells. `coverAt`
makes targets in forest 45% harder to hit. `ridgeCover` gives reverse slopes protection from shells.

Rendering: the whole map is drawn once into `Terrain.cache` and re-drawn only inside dirty regions.
Layers: base colour, forest/swamp/water masks (small canvases scaled up for soft edges), forest
stipple, swamp tufts, hillshade, water outline, contours with labels, roads as curves, deposits.

Map JSON (`Terrain.toJSON`/`fromJSON`) still exists for the shelved editor and future saved maps.

## 4. Map generator (`maps.js`)

`MapGen.build(spec, difficulty)` = `buildTerrain(spec)` + `placeEntities(spec, difficulty)`.
A spec describes: `seed`, `tilt`, `base`, `mountain` (null for no plateau), `hills`, `rivers`
(polyline, bed heights, width), `roads` (polylines; the generator relaxes their grade to 0.27 and
cuts them into the terrain, water cells under a road become the bridge deck), forest rules
(`forestThr`, `forestRings`, `forestBlobs`, `clear`), `swamps`, `sites` (forest cleared for
buildings), `deposits`, `creeps`, `ai` (HQ, buildings, garrison list and centre, null for a
sandbox) and the player's starting units. `mirrorX`/`mirrorY` clone a spec across an axis, which is
how Western Ridge and Southern Reach come from Highland Pass.

The base is flattened to its own average height so its rim does not block sight outward. The
plateau top is flattened to `mountain.top`. Difficulty picks the first N of the garrison list.

Checks worth running after changing a spec (see section 10): every deposit and the enemy HQ must
be reachable from the base with `Path.reachable`, the thumbnail must look right, and the first
raid must arrive.

## 5. Pathfinding and fog

One Dijkstra per destination cell (`Path.compute`, costs in `Float64Array`, never Float32) gives
`cost` and `next` for every cell; fields are cached by cell and move class and evicted oldest-first
beyond 48. `Path.steer` walks the `next` chain up to ten cells and returns the farthest cell centre
reachable in a straight line. Units re-steer ten times a second.

`Fog.computeFor(owner)` casts rays from every unit that is not inside a building and from every
building, using the horizon-angle method with the same tolerance as `los`. Vision radius grows
with height: `base * (1 + clamp(h / 300) * 0.9)`, where `h` includes a tower's height for the
building itself. Towers use `levels[i].vision` and an eye raised by `levels[i].height`.

## 6. Combat

All numbers are in `Data.UNITS[type].weapon`. Each unit stores a snapshot of its blueprint at
production (`u.stats`), so research affects only new units. `u.hBonus` (tower height) is added to
the shooter's height for range, damage and sight.

- Target acquisition every 0.3 s (`acquire`): a forced target if valid and the unit is not
  suppressed, else the nearest visible enemy not inside a building, preferring those in range,
  then buildings.
- Effective range `range * (1 + clamp(dh / 60, -0.15, 0.3))`, damage `* (1 + clamp(dh / 100, -0.1, 0.2))`.
- Hit chance `acc * (1 - 0.55 * (d / range)^2) * cover * (1 - 0.5 * stress) * (moving ? 0.6 : 1)`,
  buildings 2.5x easier. Damage `dmg * Data.ARMOR_MULT[type][armor]`.
- Stress: `weapon.suppress` per shot at a unit, 20% of that to neighbours within 30, +0.2 from a
  nearby death, up to +0.4 from a shell; decays 0.09/s. Above 0.6 suppressed (60% speed, 1.4x
  reload, cannot be force-targeted). At 0.95 the unit panics for about three seconds.
  `ignoresSuppression` (sniper) skips all of it. Garrisoned units take no stress.
- Indirect fire: arc, `minRange`, scatter grows when the point is unspotted, `weapon.ammo` per
  shot, splash with linear falloff, 35% on reverse slopes, friendly fire on.
- Presentation only: `recoil` (kick along the facing), `alertT` ("!" for 1.6 s when fire starts
  after 6 quiet seconds, also on a nearby death), bleeding decals below 50% health, blood splat,
  corpse and a shock ring on death. Decals live in `G.decals` (max 400, oldest dropped).

## 7. Orders

Orders are descriptors `{ kind, ... }` handed to `Game.issue(unit, order, queue)`:
`move`, `attackmove`, `attack` (target), `bombard` (x, y), `hold`, `work` (building),
`garrison` (building). `applyOrder` turns a descriptor into the live `u.order`; `nextOrder`
finishes it and starts the next queued one. `hold` and `bombard` are standing orders, so a queued
order behind them starts immediately. `orderMove` computes formation offsets; arrival walks to the
formation spot and then seeks cover. `orderRetreat` moves the group 180 units towards its HQ.

## 8. Buildings, towers, economy, research

- Harvest: `harvest: 'wood'` needs forest within 70 units, `'deposit'` needs a metal or sulfur
  deposit within 50 (one mine per deposit). Rate = `rate + activeWorkers * perWorker`, times the
  player's `harvestMult`. Workers stand within 70 units of their camp.
- Scout Tower (`def.tower`, `def.levels`): `Game.orderGarrison` walks infantry to it and
  `enterBuilding` pins them inside (`u.inside`, hidden, untargetable, no separation, position
  follows the tower, `hBonus = level.height`). `canEnter` enforces `cap` infantry and `heavy`
  squares (mortar) per level. `upgradeTower` pays `levels[next].cost`, runs `time` seconds, then
  raises `level`, `maxHp` and everyone's `hBonus`. `unloadBuilding` places units around it.
  Killing a tower halves each occupant's health, adds stress and throws them out.
  Buildings use `b.maxHp` (not `def.hp`) everywhere since towers change it.
- Production queues live on buildings; cost paid on enqueue, refunded on cancel; new units walk
  to `b.rally`.
- Research: `Data.RESEARCH[id]` with `cost`, `time`, `req`, and `unlock` or `effects`. Effects
  multiply the player's blueprint copies (`player.blueprints`).
- Difficulty: `Data.DIFFICULTY[G.difficulty]` gives the AI its unit cap and growth, first raid
  time, raid interval and size, garrison count and income multiplier. `AI.reset()` applies it on
  start.

## 9. Adding content

**A unit**: entry in `Data.UNITS`, logo in `Icons.draw`, add to a building's `produces`.
Squares count as heavy for towers. New shapes need `Render.drawUnit`, `Render.drawDecals`
(corpse) and `Icons.makeCanvas`.

**A building**: `Data.BUILDINGS`, `BUILD_LIST`, `BUILD_HOTKEYS`, an icon; `produces`, `harvest`,
`tower` or nothing. Placement rules in `Game.canPlace`; panel sections in `UI.buildingPanel`.

**A research item**: `Data.RESEARCH` and `RESEARCH_ORDER`.

**A resource**: `Data.RES`, `RES_COLORS`, an icon, `DEPOSIT_NAMES`.

**A map**: add a spec to `maps.js` (or mirror an existing one) and push it into `MAPS`; the menu
picks it up, including the thumbnail.

**A difficulty**: `Data.DIFFICULTY` and `DIFFICULTY_ORDER`.

**A faction (looks only)**: faction looks live in `FACTIONS` and names in `NAME_POOLS`, both in
`portraits.js`; add a new army at the end of each table, never reorder them (reordering changes
every soldier's face or name). `Main.start(mapId, difficulty, faction)` sets
`G.players[n].faction`, `Game.spawnUnit` copies `faction` and `kitEra` onto each unit, and
`UI.unitPanel` draws the portrait. Preview one in the console with
`Portraits.svg(id, { faction: 'german', era: 'cold' })`.

## 10. Testing and debugging

No test runner; use the browser console or the Claude preview's JavaScript tool. Always serve with
`serve.py` (no-cache headers): with `python -m http.server` the browser silently keeps old scripts
and you will chase ghosts. Check freshness with `Terrain.cellPassable.toString()`.

```js
Menu.hide(); Main.start('valley', 'normal'); Game.setSpeed(0);   // pick a map headlessly
for (let i = 0; i < 30 * 60; i++) Game.update(1/30);              // simulate 60 s (about 1.5 s)
const f = Path.getField(hq.x, hq.y + 60, 'infantry', 0); Path.reachable(f, x, y);   // connectivity
Game._dbg.validTarget(u, e); Game._dbg.canSee(u, e); Game._dbg.kill(entity);
G.stats; AI.st; AI.params();                                        // outcomes and enemy settings
Render.draw(); UI.update(0.3);                                      // force a frame when the tab is hidden
```

Owner ids: 0 neutral, 1 human, 2 enemy AI. Keep console scripts under about two seconds of work
or the preview tool times out.

The simulation runs headless inside any browser page (the Balance Lab will rely on this), but
not yet outside one: `Terrain.create` and `Fog.init` each make an off-screen canvas and
`Terrain.flushDirty` draws icons. Running it in node needs a small `document.createElement`
stub and skipping `flushDirty`.

When something looks wrong in combat, check the terrain between the units first: forest blocks
sight after three cells, and a rifle fires only every 1.5 game seconds.

## 11. Performance notes

With about 35 units: one game second costs about 25 ms, a flow field 30 ms, a fog update 5 ms,
a full terrain render about 150 ms (once per map build; thumbnails cost four builds at startup,
about one second). Things that scale badly if you grow the map or unit count: full-map Dijkstra per
destination (add an early exit for maps over 400 x 400), `acquire` at O(units^2) every 0.3 s
(add a spatial hash past ~400 units), fog ray casts (vision radius squared), and the single terrain
cache canvas (tile it beyond about 4000 x 4000). Decals are capped at 400.

## 12. Conventions

- Two-space indent, single quotes, semicolons, one module per file, no globals besides the module
  objects above and the three entity classes.
- Numbers that affect balance belong in `data.js`; formulas belong in `game.js` with a comment.
- Anything drawn on the canvas goes through `Render`; anything in the DOM goes through `UI` or
  `Menu`. The simulation never touches either, so it can run headless.
- `Math.random` is used freely in the simulation today; see the roadmap on determinism before
  building replays or multiplayer.
