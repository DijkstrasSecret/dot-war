# Dot War: project summary

Written 28 September 2026 and updated the same evening, to bring any chat in this project up to
speed without mixing up details from earlier chats. It sums up the three chats so far, the project
docs and the GitHub repo.
When this summary and a source doc disagree, the source doc wins.

The claude.ai project is called "Goat Wars"; the game is **Dot War**.

---

## 1. Where everything lives

### Chats in this project

| Chat | What happened |
| --- | --- |
| **Game design concepts** | Read `GAME_DESIGN.md` (patch 0.2) and the code. Answered all 25 open design questions, then designed squadrons, a full tech tree, new units and buildings, veterancy, weather, day and night, and the Balance Lab. Ran two review passes. Wrote `DESIGN_DECISIONS.md` (sections 0 to J), `IMPLEMENTATION_PLAN.md` (infantry-first patch order) and a new `CLAUDE.md`, and put them on the repo's `design-decisions` branch. |
| **Soldier portraits** (the chat that wrote this summary) | Built the portrait and name generator (`js/portraits.js`), added nine cosmetic factions and three kit eras, and wrote section K into `DESIGN_DECISIONS.md`. Made patch 0.2a, which comes before 0.2.1, with a tested diff and a step-by-step guide for Claude Code. Opened pull request #2. |
| **Oil painted renaissance soldiers** | Made seven oil-painting backgrounds (one menu, six loading screens) that restage famous paintings with WW2 soldiers, plus `painting-fx.js`, which animates candles, dust, smoke, embers, snow and glints over them. Committed them straight to `main` under `assets/paintings/`. Changed the insignia rule in section K: national insignia are now allowed, Nazi and party symbols never. |

### Project docs (claude.ai)

| Doc | Role |
| --- | --- |
| `CLAUDE.md` | Rules for Claude Code: documents and precedence, architecture, workflow, controls. |
| `DESIGN_DECISIONS.md` | Everything agreed but not yet built, sections 0 to K. |
| `IMPLEMENTATION_PLAN.md` | Patch order (0.2a to 0.8) with checklists. |
| `PATCH_0.2a_PORTRAITS.md` | Step-by-step guide for Claude Code to build patch 0.2a. |
| `patch-0.2a-portraits.diff` | The code for patch 0.2a (applied and deleted since). |
| `PROJECT_SUMMARY.md` | This file. |

All of these are also on the repo's `design-decisions` branch (the diff under `patches/`), so
Claude Code reads the same versions.

### GitHub repo `DijkstrasSecret/dot-war`

| Branch | Contents |
| --- | --- |
| `main` | The game as built, with every patch merged by pull request (one branch per patch, e.g. `patch-0.5b`). Holds all the design docs. |
| `design-decisions` | Docs only, merged long ago (pull request #2). Merges cleanly with the current `main`. Holds `GAME_DESIGN.md`, the newest `DESIGN_DECISIONS.md` and `IMPLEMENTATION_PLAN.md`, the updated `CLAUDE.md`, `PROJECT_SUMMARY.md`, `PATCH_0.2a_PORTRAITS.md`, `patches/patch-0.2a-portraits.diff` and `deploy.sh`. Built on top of `main-f0qn7m`. |
| `main-f0qn7m` | Older branch that added `deploy.sh` (open pull request #1) and `GAME_DESIGN.md`. The first design chat read from here. Merging `design-decisions` brings these in too. |

### Other

- **Dot War Portraits** artifact: a preview page that browses faces 96 at a time, with team
  colour, faction and era pickers.

---

## 2. The game as built today (patch 0.2)

Full detail is in `GAME_DESIGN.md` on the `design-decisions` branch.

- **What it is:** a browser RTS in plain HTML and JavaScript, with no framework and no build step.
  Every unit is a shape with a small logo, on a topographic map drawn like a hiking map.
- **Pillars:**
  1. Elevation decides everything.
  2. Readable abstraction: circle infantry, square crew weapon; rectangle and triangle vehicles
     are planned.
  3. Small armies, real consequences.
  4. Blueprints, not upgrades.
  5. Buildless and headless.
- **Maps:** four maps (Highland Pass, Western Ridge, Southern Reach, and the Open Valley
  sandbox), each 200 × 200 cells of 12 m. Three difficulties.
- **Units:** five infantry types: Musketeer, Rifleman, Machine Gunner, Sniper and Mortar Crew.
- **Buildings and research:** six buildings, including a 3-level Scout Tower that garrisons
  infantry. Nine research items.
- **Economy:** wood, metal and sulfur. Rubber and oil deposits exist on the maps but nothing uses
  them yet.
- **Combat:** elevation, suppression and panic, indirect fire, fog of war, bleeding, corpses and
  morale shock.
- **Enemy and neutrals:** a scripted enemy with passive income, plus neutral guards.
- **Controls:** W walk, A attack, D defend, S retreat, X stop, E work or garrison. Q W E R T train
  from a factory; G and U upgrade and unload towers.
- **Dev server:** `python serve.py 8765`. Never `python -m http.server`, because the browser keeps
  old scripts.
- **Paintings (on `main`, not wired in):** `assets/paintings/` holds the menu painting
  (*The calling*, after Caravaggio) and six loading paintings (after Leutze, Delacroix, Rembrandt,
  Raphael, Leonardo, Michelangelo), all 1672 × 941. `painting-fx.js` defines one global,
  `PaintingFx`, that draws a painting on a canvas and animates small details. `bare.html` previews
  them; `reference/` holds the agreed menu and loading-screen look. The README has instructions
  for Claude Code.

---

## 3. Direction (agreed)

| Topic | Decision |
| --- | --- |
| Era | Starts in WW2. The game is now a **WW2-and-beyond** sim: research moves soldiers' kit into the Cold War and modern eras. Drones and EMP arrive late. |
| Mode | Single-player skirmish against the AI first; multiplayer is the long-term goal. |
| Sides | Symmetric: one shared tech tree. The blueprint designer creates differences. Factions change looks only. |
| Focus | An equal mix of tactics (squads, terrain, morale) and strategy (economy, logistics, tech). |
| Pace | About 1-hour matches. A slow, infantry-focused opening on purpose. |

---

## 4. Game design decisions, section by section

The full text is in `DESIGN_DECISIONS.md`. When its sections disagree, **J wins over I, I over G,
G over F, and F over everything else**. Section K is cosmetic and conflicts with nothing. Values
marked "(proposed)" are starting points for play-testing.

### Section 0: findings from the code

- The old stress math was wrong. One MG takes about 6 s to suppress, not 3.
- Lone Riflemen could never suppress anyone at the old 0.09/s decay.
- The height bonus hit its cap at 18–20 m, so on these maps it was almost on/off.
- The "don't remap keys" rule existed only in the doc, not in the code.

### Q1–Q25: the original open questions

- **Opening:** Rifling is done at the start. The Musketeer is removed. Start with 6 Riflemen and
  4 Workers; the HQ trains both. First raid = the enemy's walking time to your HQ + 300 s.
- **Maps:** 5–6× longer per side (about 12–14 km). Keep 12 m cells and simulate in chunks.
- **Economy:**
  - New Worker unit. Soldiers still work, but count as half a worker.
  - Harvest rates stay; big maps get more metal deposits, placed so they are contested.
  - Sulfur pays for grenades now, artillery and drones later. Small-arms ammo is free.
  - Vehicles carry their own fuel tank and refuel at a Depot.
  - Supply cap 30, +10 per Depot, no maximum.
- **Combat:**
  - **Elevation range:** `1 + 0.04·√dh`, max +50%. Uphill penalty floor −20%.
  - **Elevation damage and accuracy:** based on steepness, so height matters most up close.
  - **Stress:** decay 0.06/s. 1 MG suppresses in about 4.5 s, 3 Riflemen in about 6 s.
  - **Retreat:** no suppression slowdown, 2× stress decay.
  - **Moving fire:** accuracy 0.35; MGs can't fire while moving.
  - **Snipers:** half stress, never panic.
  - Full mortar friendly fire.
  - **Healing:** at the HQ, from Medics and at the Field Hospital.
- **Structures:**
  - The HQ holds 6 infantry as a last stand.
  - New Bunker.
  - Trenches, barricades and wire are drawn as lines, dug over time, and expensive on purpose.
- **Neutrals and AI:**
  - Neutral guards patrol routes that avoid bases, with a 150 m leash.
  - Villages with civilians.
  - The AI stays scripted for now. Raids probe towers first, then go for the weakest outpost on
    the way to your HQ.
- **Victory:** HQ destruction only.

### Section 9: new controls (built in patch 0.2.1)

| Keys | What they do |
| --- | --- |
| WASD | Pan the camera |
| F / R / G / X | Attack-move / defend / retreat / stop |
| E / Q | Enter / exit |
| T | Tower upgrade |
| Z X C V | Train from a factory; Tab flips to the next page |
| K | Fill trench |
| N | Research overview |
| Ctrl+number | Create a squadron |
| Right-click | Smart command |

### Sections A–D: new units, buildings, research and designer

- **Units:**
  - **Worker:** 40 HP, 25 wood, trained at the HQ.
  - **Medic:** heals 4 HP/s within 40 m.
  - **Truck:** 6 seats (a square takes 2), fuel tank. Infinite upgrade tracks (Armour, Engine,
    Fuel), each level 1.5× the cost of the last. Heavy-armour conversion at Armour level 5.
    Retrofit at a Workshop costs 40% of the price difference.
- **Buildings:** Workshop, Depot, R&D Lab, Bunker (4 infantry + 1 MG), Field Hospital, Scout
  Tower level 4 (artillery slot).
- **Line defences, per 10 m:**
  - Trench, 30 wood: −40% chance to be hit, half stress.
  - Barricade, 30 wood + 15 metal: cover 0.7, blocks vehicles.
  - Wire, 20 metal: infantry crossing at ×0.25 speed.
- **Grenades:** Riflemen, 25 range (35 before 0.4.1), 45 explosive damage, 1 sulfur per throw, 20 s cooldown, 1 s wind-up, some scatter.
- **Blueprint designer:**
  - Chassis: circle, square, rectangle, triangle.
  - Weapons: rifle, MG, sniper rifle, mortar, RPG, artillery, EMP.
  - Armour: none, light, heavy.
  - Extras: radio, binoculars, smoke, camouflage.
  - Balance by weight budget; each part has its own research.

### Section E: squadrons (replace control groups)

- **Forming:**
  - Ctrl+number with 2–12 units selected makes squadron N, replacing any old squadron N.
  - The number selects it; a double tap jumps the camera.
  - Ctrl+number with nothing selected clears it.
- **Membership:** one squadron per unit. There is no add key. It disbands automatically when one
  member is left.
- **Movement:**
  - A column on roads and passes, lines in the open.
  - Ranks by range: rifles front, MG and Sniper second, mortars rear, Medics and Workers centre,
    truck last.
  - Right-drag sets the width and facing of the arrival line.
- **Toggles:** `>` / `>>`, tight 15 m / loose 25 m, react / keep moving. Defaults: `>`, loose,
  react.
- **Combat:**
  - Shared targets. Snipers pick their own; mortars shell whatever the squad is fighting.
  - Cohesion stress decay 0.08/s within 40 m. Panic runs towards the squad.
  - Retreat is a fighting withdrawal.
- **Support:**
  - A truck carries the squad on moves over 600 m. Members fill the seats and the rest march.
  - A factory rally point on a squad member makes new units join that squadron.

### Section F: tech tree

- **Structure:** five branches of three tiers each, about 35 items:
  - Infantry doctrine (Barracks)
  - Fire support (Ordnance Works)
  - Engineering (Workshop)
  - Logistics (Depot)
  - Command & medical (Field Hospital)
- **Where tiers are researched:** Tier I at the HQ, Tier II at the branch building, Tier III at
  the branch building once you own an R&D Lab.
- **Parallel research:** one slot per building type, so up to 7 items at once. The R&D Lab slot
  covers truck tracks, the Blueprint Designer and designer parts.
- **Tags:** B (blueprint: new units only), G (global rule: applies to units already in the field
  too), U (unlock).
- Road Building is deliberately in Tier II for a slow start.

### Section G: logic fixes from the first review

- **Missing resources:** new Rubber Tapper building. Depots trickle 0.1 oil/s.
- **Trucks:** price +10% per upgrade level.
- **Designer parts:** the branch research unlocks the stock unit; the designer part is a separate,
  cheaper research that needs it.
- **AI unlocks are time-gated:** MG at about 8 min, Sniper at about 12, Mortar at about 15.
- **Civilians:** they get their own owner id and are never auto-targeted.
- **Depots:** each extra Depot costs 25% more.
- **Line defences:**
  - Explosives damage barricades and wire; small arms damage barricades slowly.
  - Trenches can only be removed with Fill trench (K).
- **Grenades vs bunkers:** grenades reach bunker occupants with 30% damage and full stress.
- **Paths:** recalculated once per finished defence line. Fog updates only around units that
  moved.

### Section H: veterancy, weather, night, Balance Lab

- **Veterancy:**
  - XP from kills, damage, suppression and surviving under fire; Workers and Medics earn it by
    working and healing.
  - Ranks at 30, 80 and 160 XP, each worth +5% accuracy, −10% stress taken and +5% HP.
  - The highest-ranked member leads. Leader aura: stress decays ×1.2 faster within 60 m. When the
    leader dies, members within 60 m take +0.3 stress.
- **Weather:** changes every 10–15 min with a 1-minute forecast. Rain brings mud, fog and snow cut
  vision; snow also slows infantry.
- **Day and night:** 10 min day and 5 min night. At night vision halves, firing reveals the
  shooter, and mortars need a spotter. Flares, Searchlights and Night Training help.
- **Balance Lab:** `lab.html` runs unit duels, AI-vs-AI matches and economy timelines, with target
  ranges in `balance-targets.js`.

### Section I: how systems combine

- **Time:** every minute in the docs is a game minute (a real minute at 2x speed).
- **Stacking:** bonuses multiply, then caps apply: hit chance ≤ 0.95, stress taken ≥ ×0.25,
  speed ≥ ×0.2, vision ≥ ×0.35.
- **Elevation:** no bonus under 3 m of height difference. Indirect fire gets half the range
  bonus, max +25%.
- **Healing:** sources add up.
- **HQ:** trains Riflemen at 0.7× speed.
- **Truck fuel:** 60 per tank; 1 per 100 m on roads, 1.5 off-road.
- **Refinery:** 1.0 oil/s + 0.4 per worker.
- **HQ garrison:** occupants get +6 m height.

### Section J: final review answers

- **Signals:** now means last-seen markers for enemies (the old "squadrons share vision" did
  nothing).
- **Digging:** idle Workers within 300 m dig a line when no infantry is selected.
- **Workshop repair:** 5 HP/s for 1 metal per 10 HP. Healing is for infantry only.
- **Field Gun:** square, range 900, min 200, 110 explosive damage, 4 sulfur per shell.
- **Armoured car:** triangle, 260 HP, light armour, hull MG, can fire on the move.
- **Villages:** 3–5 hamlets and 1–2 central towns per big map.
- **Designer weight limits:** circle 10, square 20, rectangle 30, triangle 40. Speed penalty over
  half the limit.

### Section K: factions, portraits and names

See section 5 below.

---

## 5. Portrait and name generator

### What it does

`js/portraits.js` gives every soldier a unique face, a uniform that fits his army and era, and a
name, all from one number (his unit id). The same number always gives the same soldier. Faces
don't change with faction or era; only the kit changes.

### Rules (DESIGN_DECISIONS section K)

- **Looks only.** Factions never change stats; the sides stay symmetric.
- **Real nations with national insignia** (Hearts of Iron approach, changed 28 Sept). National
  markings, flags, rank badges and unit patches are allowed. Never the swastika, SS runes or
  anything built around them (including the WW2 German eagle), and no party symbols of any nation.
  The team colour stays on collar tabs and cap bands.
- **Nine armies:** British, American, French, German, Italian, Polish, Soviet, Turkish, Spanish.
- **Choosing:** each player picks an army at match start. The AI gets a different random army,
  and neutral guards keep a mixed look.
- **Names:** about 85% of soldiers have names from their own nation. The rest are volunteers with
  names from neighbouring nations, wearing the army's uniform.
- **Kit eras** (WW2, Cold War, Modern) follow research. A soldier gets the era his player has
  reached **when he is trained**; veterans keep their old kit.
  - Cold War: own an R&D Lab and finish any 2 Tier III items (proposed).
  - Modern: research the EMP designer part (proposed).
  - Kaan accepted both triggers for now; they will change as the tech tree grows.
- **Ranks:** the title follows veterancy: Pvt., Cpl., Sgt., Sgt. Maj. The name never changes.

### What a face is made of

- **Face:** 8 skin tones and 10 hair colours. Face width, jaw and chin vary, as do eyes, brows,
  nose, mouth and hair style.
- **Extras:** stubble, moustaches (4 styles), beards, scars, plasters, glasses, cigarettes, dirt,
  scarves.
- **Headgear (14 kinds):** Brodie, coal-scuttle, round (M1-style), crested (Adrian-style) and
  modern helmets; side cap, peaked cap, field cap, knit cap, fur cap (ushanka), boonie hat,
  beret, head bandage, bare head.
- **Helmet extras:** nets, foliage, goggles, night-vision mount on modern helmets.
- **Fit:** every helmet and cap is sized from the head it sits on. There are no chin straps, and
  hair is hidden under helmets and full caps.

### Kit by army and era

Every army also has rare peaked caps, head bandages and bare heads.

| Army | WW2 | Cold War | Modern |
| --- | --- | --- | --- |
| British | Brodie helmet, beret, khaki | Round helmet, beret, blotch camo | Modern helmet, boonie, tan camo |
| American | Round helmet, knit cap, olive drab | Round helmet with camo cover, boonie, field cap | Modern helmet, boonie, field cap, tan camo |
| French | Crested helmet, side cap | Round helmet, beret | Modern helmet, beret, woodland camo |
| German | Coal-scuttle helmet, field cap, field grey | Round helmet, field cap, beret | Modern helmet, dotted camo |
| Italian | Round helmet, side cap, grey-green | Round helmet, beret | Modern helmet, blotch camo |
| Polish | Round helmet, side cap | Round helmet, beret, fur cap, dotted camo | Modern helmet, blotch camo |
| Soviet | Round helmet, side cap, fur cap | Same plus beret | Modern helmet, fur cap, digital camo |
| Turkish | Coal-scuttle helmet, side cap | Round helmet, field cap | Modern helmet, digital camo |
| Spanish | Round and crested helmets, side cap, beret | Round helmet, beret, side cap | Modern helmet, digital camo |

### Names

- **Pools:** one name pool per army. The Soviet pool includes some Ukrainian, Georgian and
  Kazakh names; the American pool mixes in immigrant surnames.
- **Nicknames** often come from the face: red hair gives "Red", glasses "Specs", a cigarette
  "Smokes", a scar or bandage "Lucky", grey hair "Pops", a fur cap "Bear".
- **Examples:** `Pvt. Charles Hunt`, `Sgt. Czesław "Baldy" Kowalczyk`.

### Technical rules

- **Visual only.** Only `UI`, `Menu` and `Main` may call it. The simulation just stores
  `faction` and `kitEra` on players and units.
- **Its own random stream,** separate from the game's, so it can never change a match's outcome.
- **Main calls:**
  - `Portraits.svg(id, { team, faction, era, size })`
  - `Portraits.dataURL(...)`
  - `Portraits.image(...)` (cached, for canvas)
  - `Portraits.name(id, { faction, era, rank })`
  - `Portraits.kit(...)`, `Portraits.traits(...)`, `Portraits.seedFor(matchSeed, id)`
- **Don't reorder the tables.** Reordering face, kit or name tables, or changing the random
  draws, changes every soldier. Adding a new army at the end is safe.

### Patch 0.2a (built and merged)

- **Menu:** a "Your army" row.
- **Selection panel:** the portrait, the full name, and "Musketeer · Soviet army".
- **Tower panel:** garrison icons show the short name on hover.
- **Simulation:** two lines in `Game.spawnUnit` copy `faction` and `kitEra` onto the unit.
- **UI hook:** kept deliberately small (three helpers in `ui.js`), because a UI rework comes
  next.
- **Done later:** the Cold War kit trigger (0.5a), portraits in the group panel (0.2b), ranks (0.3).

---

## 5b. Menu and loading-screen paintings

- **What exists:** nine paintings (three menu, six loading) and the `PaintingFx` engine, on `main`
  in `assets/paintings/`. Wired into the game in patch 0.2b (`js/menu.js`, `js/loading.js`). Read
  `assets/paintings/README.md` first.
- **Menu:** one of *The calling*, *The letter* and *The wounded*, picked at random each time the
  menu opens. The left 40% of every menu painting is empty near-black space for the
  buttons: white serif text (IM Fell English SC for the title, Cormorant Garamond for buttons in
  the preview). Hover shows a warm underline, click a short brightening flash. Stop the engine
  when a match starts.
- **Loading screen:** pick a random loading painting per load, show its title and "after ..."
  line as a plaque bottom left and a thin gold progress bar bottom right, driven by real loading
  progress. Fade from black once the image has loaded.
- **Decisions to keep:**
  - Never warp the painted image (no waving flags). Effects only add light and particles on top.
  - In *The light* the cigarette ember stays tiny.
  - Insignia follow section K (below).
- **Known issue:** `06-the-light.jpg` shows a WW2 German cap eagle, which holds a swastika.
  Regenerate that image before release, keeping the file name and framing.
- **Build slot:** patch 0.2b, built: the menu, loading screen and open-map panel layout. The light
  painting still needs regenerating.

---

## 6. Build order

`IMPLEMENTATION_PLAN.md` replaces the older patch list in `ROADMAP.md` and `GAME_DESIGN.md`
section 11.

| Patch | Content |
| --- | --- |
| **0.2a** | Portraits, names, factions (added 28 Sept, before the UI rework) |
| **0.2b** | UI rework: painted menu and loading screen, new panel layout. Layout not designed yet; the paintings are ready. |
| **0.2.1** | Foundations: seeded randomness, Balance Lab, new combat values, Worker, Musketeer removed, AI changes, new controls |
| **0.3** | Squadrons and veterancy |
| **0.4** | Fortifications and medical (lines, Bunker, HQ garrison, grenades, Medic, Field Hospital) |
| **0.5** | Vehicles, logistics and the tech tree (Truck, fuel, Workshop, Depot, R&D Lab, Rubber Tapper, Refinery, supply) |
| **0.6** | Weather and night |
| **0.7** | 0.7a big random maps (built) · 0.7b living infantry (built) · 0.7c villages, buff sites, props as cover, trees · 0.7d siege AI |
| **0.8** | Artillery (Field Gun), armoured car (the blueprint designer was dropped) |
| Later | AI on player economy, multiplayer, replays, save and load, sound, tutorial, drones |

---

## 7. Next steps for Kaan

Built and merged up to 0.7b (see `PATCH_NOTES.md`, the ticks in `IMPLEMENTATION_PLAN.md` and the
"Patch ..." notes in `DESIGN_DECISIONS.md`). `BALANCE_BASELINE.md` records the balance of 0.5e for
comparison; recorded fights per patch are in `fight-tests/`.

To do, in order:
1. Patch 0.7c: villages and civilians, neutral patrols, buff sites and citadels, ruins and wrecks as
   cover, trees in forests, Modern kit.
2. Patch 0.7d: the siege AI (Q24 raid logic).
3. Patch 0.8: Field Gun and armoured car.


---

## 8. Still open

- Every value marked (proposed), to be tuned in the Balance Lab.
- Designer extras' exact weights (1 or 2) and the chassis cost factors.
- Final research triggers for Cold War and Modern kit, once the tech tree grows past WW2.
- Drones: when they arrive and what research unlocks them.
- National insignia on portraits and art (helmet decals, cap badges); patch 0.2a has none yet.

---

## 9. Easy to mix up

| Topic | Old or other version | Current version |
| --- | --- | --- |
| Patch order | `ROADMAP.md` and `GAME_DESIGN.md` §11: 0.3 is vehicles, 0.5 the designer | `IMPLEMENTATION_PLAN.md`: 0.3 squadrons, 0.5 vehicles, 0.8 designer. The plan wins. `DESIGN_DECISIONS.md` still says "Truck in 0.3" (Q16) and "Blueprint designer (0.5)" (section D title); the plan's numbering is the one to follow. |
| Controls | Before 0.2.1: W A D S X E, Q W E R T to train | Built in 0.2.1 (§9): WASD camera, F R G X E Q orders, T tower upgrade, Z X C V to train |
| `CLAUDE.md` | Repo `main`: old rules ("hotkeys fixed") | `design-decisions` branch and project copy: new rules. The project copy adds the portraits rule and the `serve.py` fix. |
| Dev server | `python -m http.server` (was wrong in the project `CLAUDE.md`) | `python serve.py 8765` |
| Musketeer | In the code up to 0.2b | Removed in 0.2.1; the HQ trains Riflemen and Workers |
| Signals research | "Squadrons share vision" | Last-seen markers (section J) |
| Field Hospital research | Tier II | Tier I at the HQ, so the branch building can be built |
| Supply cap | An early proposal had max 120 and truck supply 3 | No maximum; truck supply 2 |
| Suppression speed | "3 Riflemen in about 8 s" | About 6 s (the 8 was a slip) |
| Weather and time units | Section H says "real time at 2x" | Section I: all minutes are game minutes |
| Era | "Grounded 1910–1945" | WW2 and beyond (section K) |
| Faction vs team | — | Faction = army look and names. Team = colour (blue or red). They are separate. |
| Insignia | "No flags, party or political insignia" (morning of 28 Sept) | National insignia allowed, Nazi and party symbols never (section K) |
| Paintings | — | Menu and loading screen paintings are on `main` in `assets/paintings/` (see its README). They were pushed straight to `main`, the one exception to the branch-per-patch rule. |
| Portraits vs paintings | — | Portraits = small procedural faces per soldier (`js/portraits.js`, patch 0.2a). Paintings = large hand-made menu and loading art (`assets/paintings/`, patch 0.2b). |
| Doc versions | Before 28 Sept afternoon, the repo copies lacked section K and patch 0.2a | Repo `design-decisions` branch and project copies now match |
