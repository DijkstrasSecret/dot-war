# Roadmap

> **Superseded (28 September 2026).** The agreed patch order and scope are now in
> `IMPLEMENTATION_PLAN.md` (infantry first: 0.2.1 foundations, 0.3 squadrons, 0.4 fortifications,
> 0.5 vehicles and tech tree, 0.6 weather, 0.7 big maps, 0.8 designer), with the decisions in
> `DESIGN_DECISIONS.md`. The file hints below (which functions to reuse) are still useful.

What exists today (patch 0.2): four maps (Highland Pass, Western Ridge, Southern Reach and the
Open Valley sandbox) picked from a start menu with three difficulties; five infantry blueprints
(musket, rifle, machine gun, sniper, mortar); six buildings including a three-level Scout Tower
that garrisons infantry and, at level 3, a mortar; nine research items; wood, metal and sulfur
harvesting with assigned workers; elevation-driven combat with suppression, panic, indirect fire
and towers; an enemy commander scaled by difficulty; neutral creeps; fog of war; background music;
combat flavour (recoil, alerts, bleeding, blood, corpses, morale shock); the W/A/D/S/X/E command
scheme with Shift queuing and middle-mouse panning. The map editor is shelved in `attic/`.
Patch 0.2a added nine cosmetic armies with a portrait and name for every soldier (`js/portraits.js`).

The list below is in the order that seems most useful. Each item names the files it touches, and
each module carries a `TODO(...)` reminder at the top.

## Patch 0.3: vehicles and the road network

- Trucks (rectangles) and armoured cars (triangles): new shapes in `Render.drawUnit`,
  `Render.drawDecals` and `Icons.makeCanvas`; `cls: 'vehicle'` already exists in
  `Data.MOVE_CLASSES` with a lower `maxGrade`, so roads and passes become the only way up hills.
- Transport: `capacity` on the truck blueprint, `u.passengers`, load/unload orders (reuse the
  garrison code path in `game.js`: `enterBuilding`/`unloadBuilding` are the model).
- Fuel: an `oil` upkeep per second while moving; a Refinery on an oil seep. Rubber for tyres.
- Repair: vehicles do not heal; a Workshop repairs adjacent vehicles.

## Patch 0.4: logistics

- Workers physically gather and trucks haul stock from camps to the HQ; camp stock is lootable.
  Replaces the direct credit in `Game.updateBuildings`.
- Ammunition as a stock: mortars carry shells and resupply from a truck or the HQ.

## Patch 0.5: blueprint designer

- Custom blueprints: chassis (circle/square/rectangle/triangle), weapon, armour, extras; costs
  and stats derived from the parts; saved with a logo (the `Icons` drawings are already sized for
  the UI); produced from the matching factory.
- Heavier weapons: RPG (ap damage), artillery (long-range square, needs a spotter, tower level 3
  could hold it instead of a mortar), EMP.

## Patch 0.6: buildings you can enter, and the editor's return

- Neutral village buildings on the map that infantry can garrison, using the tower code with
  `height: 0` and cover instead of height. Trenches and sandbags as cover-only placeables.
- Bring `attic/editor.js` back with a friendlier workflow: undo, larger brushes with previews,
  entity placement, save to a `maps/` folder as JSON specs the menu can list. The `Terrain`
  JSON import/export it relies on is still in place.

## Patch 0.7: maps

- A parameterised generator on top of `MapGen`: random seeds, feature placement rules and a
  validation pass (every deposit and base reachable via `Path.reachable`, bridge deck sane).
- Larger maps: tile the terrain cache and the fog canvas; early-exit flow fields.

## Patch 0.8: campaign feel and polish

- Save and load (serialise `G` and the map spec id).
- Sound effects with their own volume (shots, shells, alerts, tower fall); a music playlist.
- Tutorial script for Highland Pass (the toast on start is the placeholder).
- Painted main menu and loading screens: images and the animation engine are ready in
  `assets/paintings/` (see its README); build the menu buttons, loading bar and click effects on top.
- Balance pass for one to two hour matches at 1x: production and research times, late-game
  costs, a second enemy base. Difficulty numbers live in `Data.DIFFICULTY`.
- Better AI: harvests instead of passive income, builds towers and researches, flanks through
  cover, retreats damaged units, uses mortars with spotters.

## Multiplayer readiness (any time before 1.0)

- Replace `Math.random` in the simulation with a seeded generator so two clients given the same
  orders produce the same result (combat, scatter, cooldown jitter, spawn positions, decals).
- Route every player action through `Game.issue` descriptors with a tick number for lockstep
  networking or replays. Rendering and DOM are already outside the simulation.

## Known rough edges

- Units stop to shoot only on attack-move; on a plain move they shoot while walking with a penalty.
- Workers count only while standing within 70 units of their camp; they do not animate gathering.
- The AI does not rebuild, expand or use towers.
- Corpses and blood are drawn even under fog (they persist as "memories").
- Contour labels are placed per render region.
- Unit speeds are tuned for the 2x tempo; at 1x everything is deliberately slow.
