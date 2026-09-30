# Dot War: game design summary

A self-contained description of the game as it is built today (patch 0.5b.1), written so it can be
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
  Rubber (Rubber Tapper) pays for Trucks and Motorisation; oil (Refinery, Depot trickle) is Truck fuel.

### Movement rules

| Rule | Value |
| --- | --- |
| Max passable grade, infantry | 0.8 (cells up to 0.88 tolerated) |
| Max passable grade, vehicle | 0.4 |
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
- Targets standing at a forest's edge (open ground within 2 cells) are 25% harder to hit (cover
  factor 0.75, patch 0.5c). Deeper inside a forest gives no cover, only concealment.
- Vision radius grows with height: `base * (1 + clamp(height / 300, 0, 1) * 0.9)`, so a unit at
  270 m sees almost 1.8x as far as one at sea level.
- Fog of war shows the terrain always and hides enemy units outside vision. Recomputed four times
  a game second; a unit or building that has not moved reuses its last result.

- **Vision from height** (patch 0.5b.3): standing high adds up to +90% vision (at 300 m altitude); on top of that, each clear line of sight reaches farther where the ground drops below the eye, ×(1 + 0.04 √drop), at most +50%. Forest and ridges still stop it.

## 3. Units

Six infantry blueprints and one vehicle, the Truck (patch 0.5b). Squares count as "heavy" for tower
capacity and take two Truck seats. The Musketeer was removed in patch 0.2.1; the Medic arrived in
patch 0.4.

| Blueprint | Shape | HP | Speed | Vision | Cost | Train time | Needs research |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Worker | circle | 40 | 50 | 120 | 25 wood | 8 s | none |
| Rifleman | circle | 70 | 52 | 160 | 12 wood, 10 metal | 10 s (14 s at the HQ) | none |
| Machine Gunner | circle | 80 | 38 | 160 | 15 wood, 45 metal | 14 s | Heavy Machine Gun |
| Sniper | circle | 55 | 48 | 230 | 10 wood, 25 metal | 14 s | Marksman Rifle |
| Mortar Crew | square | 70 | 34 | 140 | 20 wood, 40 metal | 16 s | Mortar |
| Medic | circle | 50 | 50 | 140 | 20 wood, 15 metal | 10 s | Field Medicine |
| Truck | rectangle | 150 (light armour) | 110, x1.5 on roads | 150 | 40 wood, 30 metal, 5 rubber | 18 s (Workshop) | Motorisation |

Weapons:

| Blueprint | Damage | Type | Range | Min range | Accuracy | Reload | Suppress per shot | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Worker | – | – | – | – | – | – | – | unarmed; a full worker at a camp or mine |
| Rifleman | 20 | ballistic | 170 | 0 | 0.68 | 1.5 s | 0.08 | the standard unit |
| Machine Gunner | 6 | ballistic | 200 | 0 | 0.40 | 0.18 s | 0.035 | pins whole groups: its suppression reaches soldiers within 50 m of the target at half strength; cannot fire while moving |
| Sniper | 65 | ballistic | 300 | 0 | 0.85 | 3.5 s | 0.25 | half stress, never panics, keeps target orders when suppressed |
| Mortar Crew | 50 | explosive | 380 | 150 | 0.50 | 5 s | 0.35 | indirect, splash 32, costs 2 sulfur per shell, needs a spotter; steps back from enemies inside 150 m |
| Medic | – | – | – | – | – | – | – | unarmed; heals one soldier at a time, 4 HP/s within 40 m |
| Grenade (Riflemen) | 45 | explosive | 25 | 0 | – | 20 s | – | after the Grenades research; splash 18, 1 sulfur each, 1 s wind-up standing still |

Speeds are world units per game second. Times are game seconds. Every soldier has armor class
"none"; the Truck is "light", or "heavy" after Heavy Truck Armour:

| Damage type | vs none | vs light | vs heavy | vs building |
| --- | --- | --- | --- | --- |
| ballistic | 1.00 | 0.35 | 0.08 | 0.15 |
| explosive | 1.00 | 0.70 | 0.35 | 0.90 |
| ap (planned) | 0.60 | 1.00 | 0.90 | 0.50 |

Each unit stores a snapshot of its blueprint when produced, so stat research only affects new
units. Unlocks that are abilities or buildings (Grenades, Fortification, Field Hospital) and
Entrenching Tools apply at once, to units already in the field too.

### Trucks (patch 0.5b)

- **Seats:** 6; a circle takes 1, a Mortar Crew 2. Passengers are hidden and can't fire; the Truck
  shows "×N ○" on its back. Right click a Truck (or E, then click it) with soldiers selected to board;
  Q unloads, or click one passenger on the Truck's panel. A destroyed Truck throws its passengers out
  with half their health gone.
- **Moves like a vehicle:** max grade 0.4, forest ×0.3, swamp ×0.15, roads ×1.5. Barricades block it,
  trenches slow it to ×0.4 (your own too), wire doesn't. Vehicles take no stress and aren't healed.
- **Fuel:** a 120 tank, 1 fuel per 100 m on roads and 1.5 off them. With an empty tank it crawls at
  20% speed. A Depot or the HQ refuels vehicles within 60 m for 1 oil per fuel, and refills the Truck's 60
  spare fuel, which it shares with vehicles below half a tank within 30 m. A full tank lasts about
  72 game seconds of driving (8 km off-road at 110, or 12 km on roads at 165).
- **Hauling:** assign a Truck to a camp, mine, tapper or refinery like a Worker (E or right click):
  it carries 120 per trip along the supply link (it waits up to 20 s for a full load) and adds no
  labour. While it waits at the building, Workers leave the stock to it (Trucks carry first). Worth it
  on far buildings: at a mine 1.4 km away, 3 Workers and a Truck deliver about 45% more than 4 Workers.
- **Squadrons:** a squadron with a Truck in it rides on moves over 600 m: members fill the seats
  (front ranks first), the rest march, and the riders unload at the destination and walk to their
  places in the line.
- **Workshop:** builds Trucks, repairs vehicles within 60 m (5 HP/s, 1 metal per 10 HP) and retrofits
  Trucks to the latest blueprint for 40% of the price difference (button on the Truck's panel).
- **Upgrades at the R&D Lab**, endless: Armour +15% HP, Engine +8% speed, Fuel Tank +20%, each level
  1.5× dearer than the last (base 20 wood, 40 metal, 40 s) and each making new Trucks 10% dearer.
  Heavy Truck Armour (needs Armour 5) gives heavy armour but removes all Engine speed gained so far.

## 4. Combat model

All numbers below are in `Data.COMBAT` and `Data.CAPS`. Every bonus and penalty multiplies, then
caps apply: hit chance at most 0.95, stress taken at least x0.25, speed at least x0.2, vision at
least x0.35 (`Util.stack`).

- **Target acquisition** every 0.3 s: a forced target if still valid and the unit is not
  suppressed (snipers keep theirs even then); otherwise the nearest visible enemy not inside a
  building, preferring targets in range, then buildings. Workers never pick targets.
- **Elevation.** `dh` is the height difference shooter minus target (tower height counts);
  differences under 3 m count as flat.
  - Range: `x(1 + 0.04 * sqrt(dh))`, at most +50% (about +20% at 25 m, +40% at 100 m). Uphill:
    `x(1 - 0.03 * sqrt(|dh|))`, at most -20%. Mortars get half the bonus, at most +25%, and the
    same uphill penalty.
  - Damage and accuracy use steepness `s = dh / max(d, 20)`, so height matters most up close:
    damage `x(1 + clamp(0.1 s, -0.03, +0.06))`, hit chance `x(1 + clamp(0.08 s, -0.03, +0.05))`.
    20 m above a target 50 m away gives +4% damage and +3% hit chance. Most of the high-ground edge
    is reach: in the Balance Lab the side 30 m higher wins about 74% of 5 v 5 rifle duels.
- **Hit chance** = `acc * (1 - 0.55 * (d / range)^2) * cover * (1 - 0.5 * stress) * moving * height * line * bunker`,
  capped at 0.95. `moving` is 0.35 if the shooter moved in the last tick. Buildings are 2.5x easier
  to hit. At maximum range accuracy is 45% of the base value. `line` is 0.6 for a target standing
  in a trench and 0.7 behind a barricade (section 5); `bunker` is 1.1 for a shooter inside a Bunker.
- **Damage** = `dmg * ARMOR_MULT[type][armor] * height`.
- **Stress** (0 to 1) per unit: every shot fired at a unit adds the weapon's `suppress` value, hit
  or miss; neighbours within 30 units get 20% of it (a Machine Gunner's: within 50 units, 50%); a nearby death adds 0.2; a shell adds up to
  0.4. Stress decays 0.06 per second, 0.12 while retreating. One Machine Gunner pins a Rifleman in
  about 4.5 s, three Riflemen pin one in about 6 s, a lone Rifleman never does.
  - Above 0.6 the unit is **suppressed**: 60% speed, 1.4x reload, ignores target orders and shoots
    the nearest enemy instead (yellow ring).
  - At 0.95 the unit **panics** for about 2.5 to 3.5 s: drops its target and flees ("!!").
  - Snipers take half stress and never panic. They can be suppressed, but keep their target
    orders. Soldiers in a trench take half stress. Garrisoned units take no stress, except from a
    grenade that lands on a Bunker.
- **Indirect fire** (mortar): shells arc over ridges, cannot fire inside the minimum range (a crew
  that sees an enemy inside it walks away until it can fire, unless on Defend or bombarding), the
  scatter grows when the target point is not seen by a friendly unit (the spotter rule), each shot
  consumes ammo (2 sulfur), splash damage falls off linearly to the edge, reverse slopes take only
  35% of it, and friendly fire is on.
- **Grenades** (Riflemen, after the Grenades research): thrown automatically at the nearest enemy
  standing in a trench, or at an occupied enemy Bunker, within 25 m; or on order (V, then click a
  point or an enemy: the Rifleman walks into reach and throws). Before each throw the Rifleman
  stands still for 1 s without firing (a grenade mark shows over him); a new order or a panic
  cancels it. Throws are never quite on target: they land up to 3 m + 0.2 m per metre thrown off
  (8 m at full reach, more when the thrower is stressed), and 15% go wide by a further 6 to 14 m.
  45 explosive damage, splash 18, 1 sulfur each (paid on the throw), 20 s cooldown,
  friendly fire on. A grenade on a Bunker hurts the Bunker and reaches
  everyone inside for 30% damage and full stress.
- **Return fire** (patch 0.5b.2): an idle soldier (no order, not on Defend, not working) shot by an
  enemy he can't reach attack-moves towards the shooter, and so do his squadron's idle members, or the
  idle loose soldiers within 60 m. So Snipers and Mortars can't pick off a standing group for free;
  soldiers on Defend keep their ground.
- **Moving fire.** On a plain move units shoot while walking at x0.35 accuracy; Machine Gunners
  cannot fire while moving. On attack-move units stop to shoot. Defend holds position.
- **Retreat** moves the group 180 units towards its HQ with no suppression slowdown, and stress
  drains twice as fast on the way. Units can still panic.
- **Presentation only**, no rules effect: recoil, a "!" alert when fire starts after six quiet
  seconds, bleeding decals below 50% health, blood, corpses, and a shock ring on death.

## 5. Economy

Resources: wood, metal and sulfur in use; rubber (Rubber Tapper) and oil (Refinery, Depot trickle)
are gathered from patch 0.5a and spent from 0.5b (trucks and fuel).

| Who | Starting stock |
| --- | --- |
| Player | 400 wood, 20 metal, and 6 Riflemen and 4 Workers |
| Enemy commander | 3000 wood, 1500 metal, 600 sulfur, plus passive income |

Harvest buildings produce `(rate + labour * perWorker) x 0.7` per game second (the 0.7 is the game's
pace, `Data.ECONOMY.pace`, set in patch 0.5a.1 to slow the game), times the player's harvest
multiplier (Logistics research gives 1.25). The table below lists the rates before the pace. Labour counts 1 for each Worker and 0.5 for each soldier
assigned with E, wherever they are on the supply line. A camp has four slots whoever fills them (Mines six with Deep Shafts); a Truck in a slot carries but adds no labour. Workers cannot garrison towers. A Lumber Camp needs forest within 70 units; a Mine sits on a metal or sulfur deposit,
one mine per deposit.

| Building | Size | HP | Cost | Build time | Role |
| --- | --- | --- | --- | --- | --- |
| Headquarters | 64x64 | 1500 | given | 0 | trains Riflemen at 0.7x speed and Workers at full speed, vision 220, holds 6 infantry (+6 m), heals infantry within 150 m at 0.5 HP/s |
| Barracks | 48x40 | 600 | 80 wood, 20 metal | 30 s | trains Riflemen, Machine Gunners, Snipers, Medics; Infantry research |
| Ordnance Works | 52x44 | 700 | 60 wood, 60 metal | 40 s | trains squares (mortar); Fire support research |
| Lumber Camp | 40x32 | 350 | 40 wood | 20 s | 1.0 wood/s + 0.6 per worker, max 4 workers |
| Mine | 40x36 | 400 | 70 wood | 25 s | 0.5/s + 0.35 per worker, max 4 workers |
| Scout Tower | 30x30 | 400 | 60 wood, 10 metal | 25 s | garrison, see below |
| Bunker | 32x32 | 1200 | 120 wood, 90 metal | 45 s | 4 infantry + 1 Machine Gunner slot, occupants shoot x1.1, no height; needs Fortification |
| Field Hospital | 48x40 | 500 | 80 wood, 40 metal | 35 s | heals your infantry within 120 m at 1.5 HP/s; needs Field Hospital research; Command & medical research |
| Rubber Tapper | 40x32 | 350 | 50 wood | 25 s | on rubber trees: 0.6 rubber/s + 0.3 per worker, max 4 |
| Refinery | 60x48 | 600 | 100 wood, 80 metal | 40 s | on an oil seep: 1.0 oil/s + 0.4 per worker, max 4; needs Refinery research |
| Workshop | 56x44 | 700 | 80 wood, 60 metal | 40 s | builds Trucks, repairs and retrofits vehicles; Engineering research |
| Depot | 48x40 | 500 | 80 wood, 40 metal, +25% per Depot you have | 30 s | +10 supply, 0.1 oil/s, Logistics research |
| R&D Lab | 52x44 | 600 | 100 wood, 80 metal | 45 s | needed for Tier III research; researches the Truck upgrades |

**Supply chains** (patch 0.5a.2). A harvest building's output goes into its own stock (up to 100).
Its assigned Workers or soldiers carry loads of 10 (soldiers 5) along the fastest walking route to
its **supply link**, shown as a thin dashed line, and walk back. The link is the HQ unless you pick
one of your Depots (the "Pick supply link" button on the building, or right click a Depot with the
building selected; patch 0.5a.3). Resources count
only once dropped off, so a far camp needs more carriers. A destroyed building loses its stock, but a
carrier already holding a load still delivers it; a killed or reassigned carrier loses his load. Each Depot has a bolder line along its own supply link:
the HQ, or another Depot you pick the same way, so webs are the ones you build (a loop is refused). Enemy soldiers within 20 m of a
Depot's line cut it and every Depot beyond it: the line turns red and dashed, and goods dropped there
wait until it is clear. The enemy commander's mines need carriers too: it keeps two Workers
on each, and their lines show once you have seen the mine.

**Supply** (patch 0.5a): every unit uses supply (1 each; a Mortar Crew and a Truck 2), counted when it is queued.
The cap is 30, plus 10 per finished Depot (15 with Supply Organisation), with no maximum; the top
bar shows used/cap. The scripted AI keeps its own unit cap instead.

With the pace, a Lumber Camp with four Workers yields 2.4 wood/s; a Mine with four Workers 1.3 metal or sulfur/s.
Production cost is paid when queued and refunded on cancel; new units walk to the building's
rally point.

### Scout Tower levels

| Level | Infantry | Heavy (mortar) | Height added | HP | Vision | Upgrade cost | Time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 0 | 8 m | 400 | 200 | build 60 wood, 10 metal | 25 s |
| 2 | 4 | 0 | 14 m | 650 | 240 | 80 wood, 30 metal | 25 s |
| 3 | 6 | 1 | 20 m | 900 | 280 | 100 wood, 60 metal | 30 s |

A harvest building with free slots has a **Train a Worker for this** button: the HQ trains a Worker
who walks straight to it (patch 0.5b.3).

Garrisoned units are hidden, untargetable, take no stress, and get the tower's height for range,
damage and sight. When a tower is destroyed the occupants lose half their health, gain stress and
are thrown out. The same garrison rules hold for the **Bunker** (4 infantry plus a slot only a
Machine Gunner can take; extra Machine Gunners use infantry slots; no height; occupants shoot x1.1;
grenades reach them) and the **HQ** (6 infantry, +6 m, sees from that height with its 220 vision).
Workers and Medics cannot garrison. Q unloads any of them.

### Line defences (patch 0.4)

Picked from the Build tab (Y trench, I barricade, J wire), then drawn by holding the left button
and dragging. The line is cut into 10 m segments. The selected soldiers dig it; with nobody
selected, idle Workers within 300 m do. A soldier digs 10 m in 15 s, a Worker 1.5x faster (plus 10%
per rank), several diggers on one segment add up, and Entrenching Tools makes everyone 30% faster.
Each segment is **paid when digging on it starts**; if the diggers are stopped or die, the segments
nobody started are dropped unpaid. Started segments stay; right click one with soldiers or Workers
to dig on. Diggers go to the nearest unfinished segment. Only finished segments have effects, and
routes are recalculated once a whole line is finished. A Worker earns 1 XP per 10 m dug.

| Type | Cost per 10 m | Research | Holders | Crossing infantry | HP per 10 m |
| --- | --- | --- | --- | --- | --- |
| Trench | 30 wood | none | hit chance x0.6, half stress, half blast damage (grenades and shells) | enemies x0.4, your own x1 | cannot be destroyed; Workers fill it (K), as slowly as digging |
| Barricade | 30 wood, 15 metal | Fortification | hit chance x0.7 | everyone x0.5 | 200; explosives full damage, a rifle or MG bullet that misses someone behind it does 10% |
| Barbed wire | 20 metal | Fortification | nothing | everyone x0.25 | 80; only explosives |

A unit within 6 m of a line stands in it. Barricades and wire also make routes through them dearer,
so units walk around them when there is a way. Barricades block vehicles; trenches slow them to x0.4,
your own too; wire doesn't slow them.

### Healing (patch 0.4)

Infantry only; the sources add up. The HQ heals 0.5 HP/s within 150 m and a Field Hospital 1.5 HP/s
within 120 m. A Medic treats one wounded soldier at a time within 40 m at 4 HP/s (+10% per rank),
its squadmates first; an idle Medic walks over to the nearest wounded soldier it can see. A Medic
earns 1 XP per 20 HP healed.

## 6. Research (tech tree, patch 0.5a)

Five branches with three tiers each (`DESIGN_DECISIONS.md` section F). **Tier I** is researched at
the HQ; **Tiers II and III** at the branch building; **Tier III** also needs an R&D Lab. There is
**one research slot per building type** (a second Barracks adds no slot), so up to seven projects run at
once: HQ, Barracks, Ordnance Works, Workshop, Depot, Field Hospital and R&D Lab (Truck upgrades). A project pauses while you own
none of its buildings. N opens the overview: the slots on top, then each branch by tier. Tags: **B**
changes stats of units trained afterwards, **G** changes a rule at once (units in the field too),
**U** unlocks.

| Branch (building) | Tier I (HQ) | Tier II | Tier III (needs R&D Lab) |
| --- | --- | --- | --- |
| Infantry doctrine (Barracks) | Marksmanship Drill (B, +10% accuracy), Field Boots (B, +10% speed), Grenades (G) | Heavy Machine Gun (U), Marksman Rifle (U), Improved Powder (B, +12% range), Assault Drill (G, moving accuracy 0.5), Squad Cohesion (G, morale radius 60 m) | Camouflage Uniforms (B), Storm Troops (B, grenade cooldown 12 s; needs Grenades) |
| Fire support (Ordnance Works) | Mortar (U) | HE Shells (B, +25% mortar damage), Smoke Shells (G), Forward Observers (G, spotted scatter −30%) | Artillery and Counter-battery come in 0.8 |
| Engineering (Workshop) | Fortification (U), Entrenching Tools (G, +30% digging) | Road Building (G), Reinforced Concrete (G, Bunker and tower HP +30%, existing too) | Bridging (G), Demolition Charges (G) |
| Logistics (Depot) | Logistics (G, +25% harvest everywhere), Deep Shafts (G, Mines take 6 workers) | Motorisation (U, the Truck), Supply Organisation (G, +15 supply per Depot), Refinery (U) | Armoured Car and AP Rounds come in 0.8 |
| R&D Lab slot | — | Truck Armour, Engine and Fuel Tank (B, endless levels), Heavy Truck Armour | — |
| Command & medical (Field Hospital) | Field Medicine (U), Field Hospital (U) | Triage (G, Medics heal under-50% soldiers twice as fast), Signals (G) | Intelligence (G) |

Costs and times are in `Data.RESEARCH`. Rifling is done for everyone from the start.

- **Camouflage Uniforms:** infantry trained afterwards who stand in forest are only spotted (drawn,
  targeted, clickable) by an enemy unit or building within 70% of its vision range.
- **Smoke Shells:** with mortars selected, M then click: one smoke round (normal ammo) makes a
  35 m cloud that blocks every sight line through it for 15 s.
- **Signals:** enemies seen in the last 30 s stay on the map as fading dashed outlines.
- **Intelligence:** a warning and a red ping when an enemy raid leaves its base.
- **Road Building / Bridging:** line tools (B then E, B then V) built by Workers only; a finished
  segment becomes road. Road 20 wood and 10 s per 10 m; bridge 40 wood, 20 metal and 20 s per 10 m,
  and it must cross water. Roads are always walkable and give infantry ×1.25 speed.
- **Demolition Charges:** with soldiers selected, C then click a barricade, wire or bridge segment:
  the nearest soldier walks up, sets a charge for 3 s (1 sulfur) and destroys it. Trenches stay.
- **Cold War kit:** once you own an R&D Lab and have two Tier III items, newly trained soldiers wear
  Cold War uniforms (looks only).

## 7. Time and pacing

The simulation runs fixed 30 steps per game second. At the 1x setting a game second takes two
real seconds; 2x is real time and was the tempo of the first build. All timers above are game
seconds. Typical matches on Normal run 15 to 30 real minutes at 2x.

Every match has a seed. All randomness that can change the outcome comes from one seeded stream,
and player actions are logged with the tick they happened on, so a match can be replayed exactly
from its seed and its log. Looks-only randomness (blood, corpse shapes) has its own stream.

## 8. Enemy commander and neutrals

The AI holds the plateau, trains from its factories with unit weights rifle 5, HMG 2, sniper 1,
mortar 1 (Workers only as mine carriers, below), keeps a garrison home, and sends raids downhill at
the player's HQ once it has enough units (at least 6 and at least 70% of its starting cap; a raid
takes at least 3). Its cap grows every 4 game minutes. It may train Machine Gunners, Snipers and Mortar
Crews only after their unlock time. Apart from its mines it has passive income: 1.5 wood, 0.8 metal
and 0.35 sulfur per second times the difficulty income factor and the game's pace (0.7). Raiders that lose their target walk
home. Raids escalate: each sends 10% more of the army than the last (up to 90%), and once the AI's
army is twice the enemy soldiers it has seen in the last two minutes (at least 3), it sends
everyone. It trains Workers only to carry from its mines (two per mine; they never fight). The AI
does not build, expand, train Medics or upgrade towers.

Since patch 0.5d it also (numbers in `Data.AI_SMART`, all proposed):

- **Falls back to heal:** a soldier under 40% health, or panicking, leaves raids and defence and walks
  to its HQ (which heals infantry within 150 m); it rejoins at 80%.
- **Garrisons:** while enemies are within 480 m of its HQ it fills the HQ (6 slots) and any towers or
  Bunkers it owns, nearest soldiers first, and lets them out 30 s after the last enemy has gone.
- **Digs in:** a minute before its first raid it digs a 120 m trench across the route from the enemy
  HQ, 80 to 190 m in front of its own (wherever most of it can be dug), with up to 6 Riflemen; it does
  the same when it sees 4 or more enemy soldiers within 900 m and no trench stands. Soldiers idle in
  the finished trench hold it. At most once every 5 minutes, never on Easy; unfinished parts are
  abandoned after 2 minutes.
- **Researches on a timetable** (free, no buildings): Marksmanship Drill at 6 min, Grenades 8,
  Entrenching Tools 9, Field Boots 10, Improved Powder 13, HE Shells 15, Squad Cohesion 18, Storm Troops
  25 on Normal; Easy takes 1.5× as long, Hard 0.75×. With Grenades its Riflemen throw at trenches and
  Bunkers like the player's.
- **Raids supply lines:** every 240 s on Normal (150 s on Hard, never on Easy), with at least 8
  soldiers and no enemy near its HQ, it sends 3 Riflemen at the enemy carrier, camp, mine or Depot it
  saw most recently (remembered 5 minutes), or else to check the next of the 5 deposits nearest its HQ.

The first raid comes at the enemy's walking time to the player's HQ plus a build-up (Easy 480 s,
Normal 300 s, Hard 210 s, patch 0.5c); each
raid interval adds the walking time too. The walking time is measured over the real terrain for a
Rifleman: about 42 s on Highland Pass, 47 s on Western Ridge, 44 s on Southern Reach.

| Difficulty | Unit cap | Cap growth | First raid | Raid interval | Raid size | Start garrison | Income | MG / Sniper / Mortar from |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Easy | 8 | +1 | walk + 480 s | walk + 320 to 440 s | 40% of army | 6 | 0.6x | 10 / 15 / 18.75 min |
| Normal | 11 | +2 | walk + 300 s | walk + 220 to 320 s | 50% | 9 | 0.8x | 8 / 12 / 15 min |
| Hard | 14 | +2 | walk + 210 s | walk + 150 to 240 s | 55% | 12 | 1.0x | 6 / 9 / 11.25 min |

Hard is the original tuning for size and income. Difficulty also picks how many of the map's listed
garrison units spawn; the garrison is placed, not trained, so it can hold Machine Gunners and
Mortars from the start. Neutral guards (creeps) hold deposits and hills in small groups of three to
five and fight anyone who comes close.

## 9. Controls (`DESIGN_DECISIONS.md` section 9, extended through 0.5c)

W A S D, arrow keys, screen edge or middle mouse pan the camera; the wheel zooms. Right click is the
smart command: ground moves, an enemy attacks, your camp or mine puts the selection to work, your
tower, Bunker or HQ garrisons it, your Truck is boarded, your unfinished line gets dug on; with a
camp, mine, tapper, refinery or Depot selected, right click one of your Depots to set its supply
link. F attack-move, R defend position, G retreat, X stop, E enter (camp, mine, tapper, refinery,
tower, Bunker, HQ or Truck), Q exit (unload a tower, Bunker, HQ or Truck), T upgrade a tower, K fill a trench (Workers), V throw a grenade (Riflemen). With a factory selected Z X C V train, right clicking a unit card trains it on repeat (patch 0.5c), and Tab
flips to the next four when a factory has more (otherwise Tab cycles factories). B opens the Build tab (placing something or Esc goes back to your selection), and only while it is open a letter picks a building (L Lumber Camp, M Mine,
Z Rubber Tapper, F Refinery, C Barracks, O Ordnance Works, K Workshop, G Depot, R R&D Lab, T Scout
Tower, U Bunker, P Field Hospital) or a line (Y trench, I barricade, J barbed wire, E road, V
bridge); M smoke and C demolition are unit orders (patch 0.5a), N research, O army overview, I next idle Worker, J jump to the latest under-attack alert (patch 0.5c), H headquarters, Shift queues
orders, Ctrl+1..9 squadrons (section 9a), right-drag sets a squadron's line, Space pauses, comma and period change
speed, F1 help. New features take free keys; existing ones don't move without asking.

## 10. Presentation

The start menu and the loading screen are oil paintings (patch 0.2b). The menu opens on one of
three menu paintings picked at random, with the title and white serif buttons on the painting's
dark left side: New game, Continue (once a game is running), Music, Controls. New game opens a
dark panel on the same painting with the map, difficulty and army choices. Small details in the
paintings move (candles, dust, smoke); the engine stops while a match runs. Every map build,
including the first page load, happens behind a loading screen: one of six loading paintings at
random, its title and "after ..." line on a plaque bottom left, and a thin gold bar bottom right
that follows the real build steps (charting the thumbnails, surveying the map, plotting routes,
drawing the map, deploying). The screen fades in from black once the painting has loaded and stays
up at least 1.4 seconds so the fade completes even when the build is quick.

In play the map fills the window and small translucent olive panels with brass edges float over
it: resources top left, clock, speed and menu top right with the minimap below, the group bar top
centre, the selection panel with its Build, Research and Army tabs bottom left, and the command card
bottom right. The top bar shows an "Idle Workers" button while any Worker has nothing to do. When
something of yours is hit, a toast and a red ping on the map and minimap say so (once per 400 m
area until it has been quiet there for 20 s). With several soldiers selected the panel shows one face each, with a class badge and
a health bar; the group bar shows each group's number, a count per class and its health and stress.
A soldier is in one group at a time. Headings use stencil lettering. Units are flat shapes with a
white logo, player blue (#2458d6), enemy red (#c8302e), neutral grey. Yellow ring for suppressed,
"!" when fire starts, "!!" while panicking, bleeding under 50% health, blood splashes and
corpses persist (capped at 400 decals). Background music is a Grieg violin sonata with a toggle
and volume.

## 9a. Squadrons and veterancy (patch 0.3)

**Squadrons** replace the old number-key groups. Ctrl+1..9 with 2 to 12 soldiers selected makes
squadron 1..9, replacing it; with nothing selected it clears it. A soldier is in one squadron at a
time, and a squadron with one soldier left disbands. Any order to one member moves the whole
squadron. On arrival it forms a line facing the direction of travel (or the right-drag's direction
and width), ranked by range: Riflemen in front, Machine Gunners and Snipers behind them, Workers in
the centre behind those, Mortar Crews 60 m back. Members travel along the path in file.

| Setting (squad panel) | Options | Default |
| --- | --- | --- |
| Movement | `>` everyone at the slowest member's pace · `>>` each at his own pace | `>` |
| Spacing | tight 15 m · loose 25 m | loose |
| Contact | react: members share the squadron's target when it is no farther than their own · keep moving: each fires at the closest enemy | react |

On react, Riflemen, Machine Gunners and Mortar Crews take the squadron's shared target when it is
no farther than their own nearest enemy; Snipers pick their own. Each soldier stops
for his own target, as a loose one would. On keep moving each member fires at the closest enemy he can hit. Within 40 m of a squadmate stress drains at 0.08/s instead of 0.06/s. A panicking
member runs towards the squadron as well as away from the fire. Retreat (G) is a fighting
withdrawal: the rear ranks fall back at once while the front rank holds 4 s, then follows. A
factory's rally point set on a squad member (right click it) sends new units into that squadron,
up to 12. Squadrons are a utility more than an advantage: in the Balance Lab 6 Riflemen in a
squadron beat 6 loose Riflemen 55–60% of the time (target).

**Veterancy.** Soldiers earn XP: 10 per kill, 1 per 10 damage, 5 when a target they are shooting
becomes suppressed (once per target every 30 s), 1 per 10 s spent with stress above 0.3, and for
Workers 1 per 60 s of work and 1 per 10 m dug, for Medics 1 per 20 HP healed. Ranks come at 30, 80 and 160 XP. Each rank gives +5% accuracy, -10%
stress taken and +5% health; rank 3 also reloads 10% faster. A Worker's rank adds 10% labour instead.
Ranks show as chevrons under the shape, and portrait titles follow them (Pvt., Cpl., Sgt., Sgt. Maj.).
Rank is never lost. The highest-ranked member leads the squadron (star): within 60 m of him stress
drains 20% faster, and his death shocks squadmates within 60 m by +0.3 instead of the usual +0.2.

## 10a. Factions and portraits (patch 0.2a)

Nine armies to pick from in the menu: British, American, French, German, Italian, Polish,
Soviet, Turkish and Spanish. A faction changes looks only: uniform, headgear, camouflage and
soldiers' names. Stats, units and research are identical for every army, so sides stay
symmetric. The enemy commander gets a different army at random; neutral guards keep a mixed look.

Every soldier has a face and a name built from his unit id, so the same soldier keeps them for
the whole match. About 85% of an army's soldiers carry names from their own nation; the rest are
volunteers with names from neighbouring nations in the army's uniform. Nicknames sometimes come
from the face ("Red", "Specs", "Smokes"). Kit comes in three eras, WW2, Cold War and Modern; the
game starts in WW2, the Cold War kit arrives with an R&D Lab and two Tier III items (patch 0.5a), and
a new kit applies to soldiers trained after that, so veterans keep their old kit. Rank titles (Pvt.,
Cpl., Sgt., Sgt. Maj.) follow veterancy. Portraits show no national insignia yet; the only marking is the team
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

> Answered on 28 September 2026: the answers are in `DESIGN_DECISIONS.md`, and patch 0.2.1 built the
> first of them. The questions below are kept as they were asked, with the values of patch 0.2
> (Musketeers, Rifling, 0.09 decay), so the answers can be read against them.

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
