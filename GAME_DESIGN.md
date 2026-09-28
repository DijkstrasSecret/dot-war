# Dot War: game design summary

A self-contained description of the game as it is built today (patch 0.2), written so it can be
pasted into a chat and discussed without the code. Every number here is the live value from
`js/data.js` or the formula from `js/game.js`, `js/terrain.js` and `js/fog.js`. Section 12 lists
the questions worth fine-tuning; section 13 says how to hand decisions back so they can be coded.

## 1. Concept and pillars

Dot War is a browser real-time strategy game. Every unit is a plain geometric shape with a small
logo inside it, fought on a topographic map drawn like a hiking map. The design pillars:

1. **Elevation decides everything.** Height gives vision, range and damage; ridges block sight and
   bullets; steep slopes are slow or impassable; reverse slopes shelter from shells.
2. **Readable abstraction.** Shapes encode the class (circle infantry, square crew weapon;
   rectangle vehicle and triangle armoured car are planned). The logo says which blueprint.
3. **Small armies, real consequences.** Squads of five to thirty units, with suppression, panic,
   bleeding and corpses. Losing a unit matters.
4. **Blueprints, not upgrades.** Research changes the blueprint; units already in the field keep
   the stats they were built with.
5. **Buildless and headless.** Plain HTML/JS, no framework. The simulation never touches the
   screen, so it can be run in a loop for balance tests.

Victory: destroy the enemy Headquarters. Defeat: lose yours. The sandbox map has no enemy HQ.

## 2. The world

- A map is 200 x 200 cells of 12 world units, so 2400 x 2400 units. One world unit is treated as
  one metre for slopes and heights. Heights run roughly 15 to 270 m.
- Contour lines every 10 m, bold index contours every 50 m.
- Terrain types per cell: open, forest, water, swamp. Roads are polylines rasterised onto cells;
  a road across water is a bridge. Buildings block the cells under them.
- Four maps: Highland Pass (the tutorial layout: player base in a valley, enemy on a plateau
  mountain), Western Ridge and Southern Reach (the same spec mirrored), Open Valley (sandbox with
  neutral guards and no enemy commander).
- Resource deposits are placed by the map spec: iron ore (metal), sulfur, rubber trees, oil seeps.
  Rubber and oil exist on the map but nothing uses them yet.

### Movement rules

| Rule | Value |
| --- | --- |
| Max passable grade, infantry | 0.8 (cells up to 0.88 tolerated) |
| Max passable grade, vehicle (planned) | 0.4 |
| Uphill speed factor | `1 / (1 + 5 * grade)` (a 0.2 grade halves speed) |
| Downhill speed factor | up to 1.25x |
| Forest / swamp / road factor, infantry | 0.65 / 0.45 / 1.25 |
| Forest / swamp / road factor, vehicle | 0.30 / 0.15 / 1.50 |
| Roads | never break their own connectivity, even on steep ground |

### Sight and cover

- Line of sight samples the ground every half cell from an eye 2.2 m above the shooter (plus tower
  height) to a point 1.8 m above the target. Ground may rise 2.5 m above the sight line before it
  blocks.
- More than 36 units (three cells) of forest along the line blocks sight, so forests conceal.
- Targets standing in forest are 45% harder to hit (cover factor 0.55).
- Vision radius grows with height: `base * (1 + clamp(height / 300, 0, 1) * 0.9)`, so a unit at
  270 m sees almost 1.8x as far as one at sea level.
- Fog of war shows the terrain always and hides enemy units outside vision. Recomputed four times
  a game second.

## 3. Units

All five blueprints are infantry class. Squares count as "heavy" for tower capacity.

| Blueprint | Shape | HP | Speed | Vision | Cost | Train time | Needs research |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Musketeer | circle | 60 | 50 | 150 | 15 wood | 8 s | none |
| Rifleman | circle | 70 | 52 | 160 | 12 wood, 10 metal | 10 s | Rifling |
| Machine Gunner | circle | 80 | 38 | 160 | 10 wood, 35 metal | 14 s | Heavy Machine Gun |
| Sniper | circle | 55 | 48 | 230 | 10 wood, 25 metal | 14 s | Marksman Rifle |
| Mortar Crew | square | 70 | 34 | 140 | 20 wood, 40 metal | 16 s | Mortar |

Weapons:

| Blueprint | Damage | Type | Range | Min range | Accuracy | Reload | Suppress per shot | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Musketeer | 24 | ballistic | 110 | 0 | 0.50 | 3.2 s | 0.12 | cheap line infantry |
| Rifleman | 20 | ballistic | 170 | 0 | 0.68 | 1.5 s | 0.08 | the standard unit |
| Machine Gunner | 11 | ballistic | 200 | 0 | 0.40 | 0.18 s | 0.035 | pins enemies down |
| Sniper | 65 | ballistic | 300 | 0 | 0.85 | 3.5 s | 0.25 | ignores suppression, always obeys target orders |
| Mortar Crew | 50 | explosive | 380 | 90 | 0.50 | 5 s | 0.35 | indirect, splash 32, costs 2 sulfur per shell, needs a spotter |

Speeds are world units per game second. Times are game seconds. All units have armor class
"none" today; the armor table already exists for the vehicle patch:

| Damage type | vs none | vs light | vs heavy | vs building |
| --- | --- | --- | --- | --- |
| ballistic | 1.00 | 0.35 | 0.08 | 0.15 |
| explosive | 1.00 | 0.70 | 0.35 | 0.90 |
| ap (planned) | 0.60 | 1.00 | 0.90 | 0.50 |

Each unit stores a snapshot of its blueprint when produced, so research only affects new units.

## 4. Combat model

- **Target acquisition** every 0.3 s: a forced target if still valid and the unit is not
  suppressed; otherwise the nearest visible enemy not inside a building, preferring targets in
  range, then buildings.
- **Elevation bonus.** With `dh` the height difference shooter minus target (tower height counts):
  effective range `range * (1 + clamp(dh / 60, -0.15, +0.30))`, damage
  `dmg * (1 + clamp(dh / 100, -0.10, +0.20))`. So 18 m of height gives +30% range, 20 m gives
  +20% damage; shooting uphill costs up to 15% range and 10% damage.
- **Hit chance** = `acc * (1 - 0.55 * (d / range)^2) * cover * (1 - 0.5 * stress) * (moving ? 0.6 : 1)`.
  Buildings are 2.5x easier to hit. At maximum range accuracy is 45% of the base value.
- **Damage** = `dmg * ARMOR_MULT[type][armor]`.
- **Stress** (0 to 1) per unit: each shot that hits or lands near a unit adds the weapon's
  `suppress` value; neighbours within 30 units get 20% of it; a nearby death adds 0.2; a shell adds
  up to 0.4. Stress decays 0.09 per second.
  - Above 0.6 the unit is **suppressed**: 60% speed, 1.4x reload, ignores target orders and shoots
    the nearest enemy instead (yellow ring).
  - At 0.95 the unit **panics** for about 2.5 to 3.5 s: drops its target and flees ("!!").
  - Snipers skip all of this. Garrisoned units take no stress.
- **Indirect fire** (mortar): shells arc over ridges, cannot fire inside the minimum range, the
  scatter grows when the target point is not seen by a friendly unit (the spotter rule), each shot
  consumes ammo (2 sulfur), splash damage falls off linearly to the edge, reverse slopes take only
  35% of it, and friendly fire is on.
- **Moving fire.** On a plain move units shoot while walking at the 0.6 penalty; on attack-move
  they stop to shoot. Defend holds position; Retreat moves the group 180 units towards its HQ.
- **Presentation only**, no rules effect: recoil, a "!" alert when fire starts after six quiet
  seconds, bleeding decals below 50% health, blood, corpses, and a shock ring on death.

## 5. Economy

Resources: wood, metal, sulfur in use; rubber and oil placed but unused.

| Who | Starting stock |
| --- | --- |
| Player | 400 wood, 60 metal |
| Enemy commander | 3000 wood, 1500 metal, 600 sulfur, plus passive income |

Harvest buildings produce `rate + activeWorkers * perWorker` per game second, times the player's
harvest multiplier (Logistics research gives 1.25). Workers are ordinary infantry assigned with E
and count only while standing within 70 units of their camp; they do not animate or carry
anything. A Lumber Camp needs forest within 70 units; a Mine sits on a metal or sulfur deposit,
one mine per deposit.

| Building | Size | HP | Cost | Build time | Role |
| --- | --- | --- | --- | --- | --- |
| Headquarters | 64x64 | 1500 | given | 0 | trains Musketeers at 0.7x speed, vision 220 |
| Barracks | 48x40 | 600 | 80 wood, 20 metal | 30 s | trains circles |
| Ordnance Works | 52x44 | 700 | 60 wood, 60 metal | 40 s | trains squares (mortar) |
| Lumber Camp | 40x32 | 350 | 40 wood | 20 s | 1.0 wood/s + 0.6 per worker, max 4 workers |
| Mine | 40x36 | 400 | 60 wood, 10 metal | 25 s | 0.5/s + 0.35 per worker, max 4 workers |
| Scout Tower | 30x30 | 400 | 60 wood, 10 metal | 25 s | garrison, see below |

A fully staffed Lumber Camp yields 3.4 wood/s; a fully staffed Mine 1.9 metal or sulfur/s.
Production cost is paid when queued and refunded on cancel; new units walk to the building's
rally point.

### Scout Tower levels

| Level | Infantry | Heavy (mortar) | Height added | HP | Vision | Upgrade cost | Time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 0 | 8 m | 400 | 200 | build 60 wood, 10 metal | 25 s |
| 2 | 4 | 0 | 14 m | 650 | 240 | 80 wood, 30 metal | 25 s |
| 3 | 6 | 1 | 20 m | 900 | 280 | 100 wood, 60 metal | 30 s |

Garrisoned units are hidden, untargetable, take no stress, and get the tower's height for range,
damage and sight. When a tower is destroyed the occupants lose half their health, gain stress and
are thrown out.

## 6. Research

Nine items, researched one at a time at the HQ. Effects apply to blueprints, so only to units
trained afterwards.

| Item | Cost | Time | Requires | Effect |
| --- | --- | --- | --- | --- |
| Rifling | 60 wood, 30 metal | 45 s | none | unlocks Rifleman |
| Marksmanship Drill | 80 wood | 40 s | none | +10% accuracy, all new units |
| Logistics | 100 wood, 20 metal | 50 s | none | +25% harvest rate |
| Field Boots | 70 wood | 35 s | none | +10% speed, new infantry |
| Heavy Machine Gun | 90 metal | 60 s | Rifling | unlocks Machine Gunner |
| Marksman Rifle | 20 wood, 60 metal | 50 s | Rifling | unlocks Sniper |
| Mortar | 40 wood, 60 metal | 50 s | Rifling | unlocks Mortar Crew |
| Improved Powder | 30 sulfur, 20 metal | 40 s | Rifling | +12% range, new firearm units |
| HE Shells | 40 sulfur, 40 metal | 45 s | Mortar | +25% mortar damage, new crews |

## 7. Time and pacing

The simulation runs fixed 30 steps per game second. At the 1x setting a game second takes two
real seconds; 2x is real time and was the tempo of the first build. All timers above are game
seconds. Typical matches on Normal run 15 to 30 real minutes at 2x.

## 8. Enemy commander and neutrals

The AI holds the plateau, trains from its factories with unit weights rifle 5, HMG 2, musket 1,
sniper 1, mortar 1, keeps a garrison home, and sends raids downhill at the player's HQ once it has
enough units (at least 6, or 70% of its cap). It has passive income instead of workers:
1.5 wood, 0.8 metal and 0.35 sulfur per second times the difficulty income factor. Raiders that
lose their target walk home. The AI does not build, research, expand or use towers.

| Difficulty | Unit cap | Cap growth | First raid | Raid interval | Raid size | Start garrison | Income |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Easy | 8 | +1 | 420 s | 320 to 440 s | 40% of army | 6 | 0.6x |
| Normal | 11 | +2 | 300 s | 220 to 320 s | 50% | 9 | 0.8x |
| Hard | 14 | +2 | 240 s | 150 to 240 s | 55% | 12 | 1.0x |

Hard is the original tuning. Difficulty also picks how many of the map's listed garrison units
spawn. Neutral guards (creeps) hold deposits and hills in small groups of three to five and fight
anyone who comes close. The player starts every map with six Musketeers.

## 9. Controls (fixed, do not remap)

W walk, A attack or attack-move, D defend position, S retreat, X stop, E work or garrison,
B build (L Lumber Camp, M Mine, C Barracks, O Ordnance Works, T Scout Tower), N research,
Q W E R T train from a selected factory, G upgrade tower, U unload, H headquarters, Shift queues
orders, Ctrl+1..9 groups, middle mouse pans, wheel zooms, Space pauses, comma and period change
speed, F1 help. New features add keys; they never move these.

## 10. Presentation

Olive field-map panels with brass accents and stencil headings. Units are flat shapes with a
white logo, player blue (#2458d6), enemy red (#c8302e), neutral grey. Yellow ring for suppressed,
"!" when fire starts, "!!" while panicking, bleeding under 50% health, blood splashes and
corpses persist (capped at 400 decals). Background music is a Grieg violin sonata with a toggle
and volume.

## 10a. Factions and portraits (patch 0.2a)

Nine armies to pick from in the menu: British, American, French, German, Italian, Polish,
Soviet, Turkish and Spanish. A faction changes looks only: uniform, headgear, camouflage and
soldiers' names. Stats, units and research are identical for every army, so sides stay
symmetric. The enemy commander gets a different army at random; neutral guards keep a mixed look.

Every soldier has a face and a name built from his unit id, so the same soldier keeps them for
the whole match. About 85% of an army's soldiers carry names from their own nation; the rest are
volunteers with names from neighbouring nations in the army's uniform. Nicknames sometimes come
from the face ("Red", "Specs", "Smokes"). Kit comes in three eras, WW2, Cold War and Modern; the
game is on WW2 for now, and later eras will unlock through research and apply to soldiers trained
after that, so veterans keep their old kit. Rank titles (Pvt., Cpl., Sgt., Sgt. Maj.) will follow
veterancy once it exists. Portraits show no national insignia yet; the only marking is the team
colour on collar tabs and cap bands.

## 11. Planned patches

> Superseded: the agreed order is now in `IMPLEMENTATION_PLAN.md` (0.2a portraits, 0.2b UI
> rework, 0.2.1 foundations, 0.3 squadrons, 0.4 fortifications, 0.5 vehicles and tech tree,
> 0.6 weather, 0.7 big maps, 0.8 designer), with the decisions in `DESIGN_DECISIONS.md`. The
> list below is the earlier plan, kept for its notes on what each feature touches.

- **0.3 Vehicles and roads.** Trucks (rectangles, transport with capacity) and armoured cars
  (triangles). Vehicle move class: max grade 0.4, so roads and passes are the only way up hills.
  Fuel as oil upkeep while moving; Refinery on an oil seep; rubber for tyres. Vehicles do not
  heal; a Workshop repairs them.
- **0.4 Logistics.** Workers physically gather and trucks haul stock from camps to the HQ; camp
  stock is lootable. Ammunition as a stock: mortars carry shells and resupply from a truck or HQ.
- **0.5 Blueprint designer.** Custom blueprints from chassis, weapon, armour and extras, with
  derived cost and stats and a drawn logo. Heavier weapons: RPG (ap), artillery (square, needs a
  spotter, tower level 3 could hold it), EMP.
- **0.6 Enterable buildings and the editor.** Neutral village buildings as cover; trenches and
  sandbags; the shelved map editor returns.
- **0.7 Maps.** Parameterised random generator with a validation pass; larger maps.
- **0.8 Campaign feel.** Save and load, sound effects, a tutorial script, a balance pass for one
  to two hour matches, a smarter AI that harvests, builds towers, researches, flanks, retreats and
  spots for mortars.
- **Multiplayer readiness.** Seeded random and order descriptors with tick numbers for lockstep.

## 12. Design questions to fine-tune

These are the places where a design decision changes the game most. Current values are given so
a discussion can propose concrete replacements.

**Opening and tempo**

1. The player opens with 400 wood, 60 metal and six Musketeers, and must research Rifling
   (45 s, 60 wood, 30 metal) before anything else is trainable. Is the musket-only opening
   interesting or just a wait? Options: start with Rifling done, give a Barracks, or make Rifling
   cheaper.
2. First raid on Normal at 300 game seconds. Too early for a player still building an economy,
   or the right pressure?
3. Target match length. The current tuning gives 15 to 30 minutes at 2x. Is the goal a
   20 minute skirmish or a one hour campaign map?

**Economy**

4. Workers are infantry standing near a camp. Should a dedicated Worker unit exist (cheaper,
   unarmed, carries visibly), or does using soldiers as labour create good tension?
5. Harvest rates: 3.4 wood/s and 1.9 metal/s fully staffed against unit costs of 10 to 40 metal.
   Metal feels like the bottleneck by design; is it too tight?
6. Sulfur is only spent on mortar shells (2 each) and two research items. Should more things
   burn sulfur (grenades, HE research tiers), or should shells cost more?
7. Rubber and oil: fuel upkeep per second while moving is the planned rule. Alternative: fuel as
   a stock loaded at a depot, which makes range a decision.

**Combat feel**

8. Elevation bonuses: +30% range at 18 m and +20% damage at 20 m. Strong enough that the
   mountain matters, or so strong that the plateau is unassailable without mortars?
9. Suppression thresholds: 0.6 suppressed, 0.95 panic, decay 0.09/s. Every shot fired at a unit
   adds the weapon's suppress value, hit or miss, so a Machine Gunner adds about 0.19 per second
   and pins a target in about six seconds against the decay; a lone Rifleman (0.053/s) can never
   suppress anyone. Is panic too frequent, too rare, or fine?
10. Suppressed units still obey move and Retreat orders, at 60% speed, but cannot pick targets
    and a forced attack turns into an attack-move. A panicking unit drops everything and flees
    for about three seconds. Should Retreat be special: full speed, faster stress decay, or
    immune to panic?
11. Moving fire at 0.6 accuracy on plain moves: keep, or force units to halt to shoot?
12. Snipers ignore suppression completely. Is a partial resistance (half stress) better?
13. Friendly fire from mortars is on. Keep for realism or soften (50% to friends)?
14. Healing: nothing heals today. Options: slow regeneration near the HQ, a Medic unit, a Field
    Hospital building, or no healing at all so losses stay permanent.

**Units and roster**

15. Musketeer 24 damage at 110 range every 3.2 s versus Rifleman 20 at 170 every 1.5 s. The
    Rifleman is strictly better per cost after research. Should the Musketeer keep a niche
    (cheaper, tougher, better in forest) or stay as a starter that is phased out?
16. Which vehicles come first in 0.3: a truck (transport, hauling) or an armoured car (combat)?
    A truck needs the load and unload orders; an armoured car needs ap damage and light armour.
17. Blueprint designer parts (0.5): which chassis, weapons, armour tiers and extras? How are cost,
    HP, speed and shape derived so nothing dominates? Should custom blueprints need their own
    research, or a factory level?
18. Unit cap or upkeep? None exists; only cost limits the army.

**Structures and map**

19. Tower level 3 holds one mortar. Should artillery replace the mortar at level 3 later, or sit
    beside it?
20. Should buildings other than towers be garrisonable (Barracks as a bunker)?
21. Trenches and sandbags (0.6): placed by infantry over time with no cost, or built like
    buildings with wood?
22. Neutral guards: static defenders today. Should they wander, or have a leash and return?

**AI**

23. The AI has passive income and fixed factories. Should it play by the same rules (harvest,
    build, research), which makes it beatable by raiding its economy, or stay scripted for
    predictability?
24. Raids always target the player's HQ. Alternatives: target mines and camps first, or probe the
    weakest tower.

**Victory**

25. Only HQ destruction ends the game. Worth adding: surrender when an army is wiped and no
    factory remains, a time-limited "hold the pass" mode, or capture points on a sandbox.

## 13. How to hand decisions back

Bring answers as a numbered list keyed to the questions above, each in one of these forms:

- A number change: "Q9: suppressed at 0.7, panic at 0.95, decay 0.12/s."
- A rule change: "Q10: Retreat always overrides suppression."
- A new thing with the fields the engine needs. For a unit: name, shape, HP, armor, speed,
  vision, cost, train time, research required, weapon (damage, type, range, min range, accuracy,
  reload, suppress, splash, ammo), and one line on what it is for. For a building: size, HP,
  cost, build time, and its role (produces, harvests, tower, or new). For a research item: cost,
  time, prerequisite, and what it unlocks or multiplies.
- "Keep as is."

Numbers go straight into `js/data.js`; rules become a short formula in `js/game.js`. Anything
that needs a new shape, order or building type is a bigger change and will be scheduled into the
matching patch.
