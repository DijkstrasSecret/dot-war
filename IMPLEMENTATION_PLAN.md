# Dot War: implementation plan

Patch order agreed on 28 September 2026: **infantry first**. Patch 0.2a (portraits) was added
in front of 0.2.1 the same day, so the UI rework (0.2b) is built with portraits already in place.
The patches build on each other, so do them in this order. All numbers and rules come from `DESIGN_DECISIONS.md`; the references in
brackets point to its sections. Work rules are in `CLAUDE.md`.

Tick each box when it's done and checked in the game.

---

## Patch 0.2a: Portraits, names and factions

Guide: `PATCH_0.2a_PORTRAITS.md` (the diff it used is applied and deleted).

- [x] Add `js/portraits.js` (visual only, own random stream; never called from the simulation) [K].
- [x] "Your army" picker in the start menu; the AI gets a different random army; neutrals stay
      mixed [K].
- [x] `faction` and `kitEra` stored on each unit when it is trained; `kitEra` stays `'ww2'` until
      the era triggers exist [K].
- [x] Selection panel shows the portrait and name; garrison icons show the short name. Nothing
      else in the UI changes.

**Done when**
- [x] Tested in the browser with no console errors; headless run still works.
- [x] `grep Portraits` finds nothing in the simulation files.
- [x] Repo docs updated (`CLAUDE.md`, `DEVELOPMENT.md`, `GAME_DESIGN.md`, `README.md`, `ROADMAP.md`).
- [x] `patches/patch-0.2a-portraits.diff` deleted once the code is in.

---

## Patch 0.2b: UI rework (to be designed)

The menu and loading screens are designed and their art is on `main`; the rest of the layout is
not designed yet. Read `assets/paintings/README.md` before starting.

- [x] Main menu over a random menu painting (`PaintingFx.pick('menu')`, three exist: *The
      calling*, *The letter*, *The wounded*): white serif buttons on the dark left 40%, hover
      underline, click flash; stop the engine when a match starts.
- [x] Loading screen: random loading painting, title plaque, gold progress bar from real loading
      progress, fade in from black.
- [ ] Regenerate `06-the-light.jpg` without the cap eagle (section K marking rules). Kaan's task
      (image generation); drop the new file in with the same name and framing.
- [x] Panel layout, and where portraits go: the open-map layout with class badges on portraits
      and a group bar with class counts (DD, "Screen layout").

**Done when**
- [x] Menu and loading screen tested in the browser with no console errors; the game loop is
      unaffected during play.
- [x] `GAME_DESIGN.md` section 10 (Presentation) updated.

---

## Patch 0.2.1: Foundations

Goal: the game plays at the new core values, and every run can be repeated exactly.

**Determinism and tools**
- [x] Replace `Math.random` in the simulation with a seeded `Util.mulberry32` stream; store the
      seed per match. Move visual-only randomness (decals, corpses) to a separate stream.
- [x] Pick the AI's army from the match seed, and seed portraits with
      `Portraits.seedFor(G.seed, u.id)` [K].
- [x] Record orders as descriptors with a tick number (`{tick, kind, ...}`). This prepares replays
      and multiplayer. (`Game.command`, `G.orders`, `Sim.replay`.)
- [x] Headless runner: advance the simulation N ticks with no renderer. (`js/sim.js`.)
- [x] `lab.html` Balance Lab [H4]:
  - [x] Unit duels: A × n vs B × m, on flat, uphill +30 m or forest ground, 100 runs.
  - [x] Economy timeline for a standard opening build order.
  - [x] AI vs AI mirror match.
  - [x] `balance-targets.js`; results outside a target range show in red. (`lab/balance-targets.js`.)
- [x] Shared stacking helper: multiply, then cap [I]. (`Util.stack`.)

**Combat values**
- [x] Elevation [Q8, I]:
  - [x] Range: `1 + 0.04·√dh`, max +50%. Uphill: `1 − 0.03·√|dh|`, floor −20%.
  - [x] Damage and hit chance from steepness `s = dh / max(d, 20)`.
  - [x] 3 m dead zone.
  - [x] Indirect fire gets half the range bonus, max +25%.
- [x] Stress decay 0.06/s [Q9].
- [x] Retreat: no suppression slowdown, 2× decay [Q10].
- [x] Moving fire 0.35; Machine Gunners can't fire while moving [Q11].
- [x] Snipers: half stress, never panic, can be suppressed, keep obeying target orders [Q12, I].

**Roster and start**
- [x] Remove the Musketeer. Rifling is done at init [Q1, Q15].
- [x] Worker unit [A], trained at the HQ at full speed. HQ trains Riflemen at 0.7× [I].
- [x] Soldiers assigned to a camp count as 0.5 of a worker [Q4].
- [x] Start with 6 Riflemen and 4 Workers.

**AI**
- [x] Musketeers → Riflemen in AI unit weights and map garrisons.
- [x] Time-gated AI unlocks, scaled by difficulty: MG about 8 game min, Sniper about 12,
      Mortar about 15 [G7].
- [x] First raid = walking time from the enemy base + 300 s; scale the raid interval the same
      way [Q2].

**Controls** [9]
- [x] WASD pans the camera.
- [x] Move the old order keys: F attack-move, R defend, G retreat, X stop, E enter, Q exit,
      T tower upgrade.
- [x] Z X C V train from a factory; Tab pages when a factory has more than 4 blueprints.
- [x] Smart right-click.
- [x] Minimap click jumps the camera.

**Done when**
- [x] Running the same seed twice gives identical results.
- [x] Balance Lab green, or reds reported to Kaan: 1 MG pins a Rifleman in 3.5–5.5 s; 5 v 5
      Riflemen, the side with +30 m height wins 65–80%. Pin about 4.9 s; height duel about 74%
      after Kaan chose to soften the steepness bonuses (DD section L).
- [x] `GAME_DESIGN.md` updated.

---

## Patch 0.3: Squadrons and veterancy

**Squadrons** [E]
- [x] Ctrl+number creates or replaces a squadron (2–12 units); Ctrl+number with nothing selected
      clears it. Number selects; double-tap jumps the camera.
- [x] One squadron per unit. Auto-disband at 1 member. Box-selected members still move the
      whole squad.
- [ ] Formation:
  - [ ] Column on roads and narrow passes, lines in the open, a line on arrival. The arrival
        line is built; on the way members follow the path in file, which gives a column on roads
        but no open-ground line during travel yet.
  - [x] Ranks by range.
  - [x] Right-drag sets width and facing.
- [x] Toggles `>` / `>>`, tight / loose, react / keep moving (defaults: `>`, loose, react).
- [x] Squad panel, squadron bar (size, health, stress, average rank), and the number drawn on
      each member.
- [x] Combat and morale:
  - [x] Shared targets; Snipers pick their own; mortars follow the squad's fight.
  - [x] Cohesion decay 0.08/s within 40 m.
  - [x] Panic runs toward the squad's centre.
  - [x] Retreat is a fighting withdrawal.
- [x] Rally point on a squad member adds new units to that squadron.

**Veterancy** [H1, I]
- [x] XP sources (suppression XP at most once per target every 30 s). Medic XP and digging XP
      came with patch 0.4.
- [x] Ranks 1–3 at 30, 80 and 160 XP, with chevrons. Set `u.rank` so portrait names show the
      title (Pvt., Cpl., Sgt., Sgt. Maj.) [K].
- [x] Leader: highest rank, star marker, aura ×1.2 decay within 60 m. Death shock +0.3 replaces
      the normal +0.2.

**Done when**
- [x] Balance Lab has a squad-vs-squad test (either side of a duel can be a squadron).
- [x] `GAME_DESIGN.md` updated.

---

## Patch 0.4: Fortifications and medical

- [x] Line tool: pick from the build menu, then drag to draw.
  - [x] Cost per 10 m segment.
  - [x] Digging: selected infantry dig it; if none are selected, idle Workers within 300 m take
        it [J].
  - [x] Dig rate 15 s per 10 m; Workers 1.5× faster.
- [x] Trench, barricade and wire effects and HP [B, G12, I].
  - [x] Your own barricades and wire slow your own units; your own trenches don't slow your own
        infantry.
  - [x] Fill trench (K), Workers only.
- [x] Paths recalculated once per finished line.
- [x] Bunker [B].
- [x] HQ garrison: 6 infantry, +6 m height, 220 vision [I].
- [x] Grenades:
  - [x] Thrown automatically at units in trenches or bunkers, or by order.
  - [x] Bunker occupants take 30% damage and full stress.
  - [x] Friendly fire on.
- [x] Medic unit [A]; Field Hospital [B]; HQ regeneration 0.5 HP/s within 150 m. Sources add up,
      infantry only.
- [x] Medic XP (1 per 20 HP healed) and Worker digging XP (1 per 10 m) [H1].
- [x] Research items for these systems (Fortification, Entrenching Tools, Grenades, Field
      Medicine, Field Hospital), temporarily on the HQ list until 0.5.

- [x] 0.4.1 (Kaan, after the lab results): trench halves blast damage, 1 s grenade wind-up,
      grenade reach 25 m.
- [x] 0.4.2 (Kaan): grenade scatter, 15% of throws go wide.

**Done when**
- [x] Balance Lab tests for a bunker assault and a trench hold.
- [x] `GAME_DESIGN.md` updated.

---

## Patch 0.5: Vehicles, logistics and the tech tree

Built in two parts (Kaan): **0.5a** tech tree, buildings and supply (done); **0.5b** vehicles (done; Trucks also haul
40 per trip on supply links, an empty tank crawls at 20%, the AI has no Trucks yet).

**Vehicles**
- [x] Vehicle move class (max grade 0.4).
- [x] Truck [A]:
  - [x] 6 seats; a square takes 2.
  - [x] "x2 ○" passenger count on its back.
  - [x] E boards, Q unloads.
- [x] Squad auto-carry on moves over 600 m: members fill the seats and the rest march [G4].
- [x] Fuel [I, J]:
  - [x] Tank 60; 1 fuel per 100 m on roads, 1.5 off-road.
  - [x] Depot refuels (1 oil per fuel) and produces a 0.1 oil/s trickle.
  - [x] Truck carries 60 spare fuel.

**Buildings**
- [x] Workshop: builds vehicles; repairs 5 HP/s for 1 metal per 10 HP; retrofits trucks. (Research building
      in 0.5a; vehicles, repair and retrofit in 0.5b.)
- [x] Depot: +10 supply; each extra Depot costs 25% more.
- [x] R&D Lab.
- [x] Rubber Tapper [G1].
- [x] Refinery [I].

**Supply and upgrades**
- [x] Supply cap 30, +10 per Depot, no maximum. Supply cost per unit [Q18].
- [x] Truck upgrade tracks (infinite): cost ×1.5 per level; truck price +10% per level; heavy
      conversion at Armour 5 removes Engine speed gained so far; retrofit costs 40% of the price
      difference [A].

**Tech tree** [F]
- [x] Five branches, three tiers.
- [x] One research slot per building type.
- [x] B / G / U effect semantics.
- [x] N opens the research overview.
- [x] Every item in F except those scheduled for 0.6 and 0.8 (Motorisation arrives with the Truck
      in 0.5b). Road Building, Bridging and Demolition Charges use Kaan's 0.5 rules.
- [x] Signals: last-seen markers [J]. Intelligence: raid warning.
- [x] Logistics boosts every harvest building; Deep Shafts applies to Mines only [J].
- [x] Mermaid tree in the docs updated if items move.
- [x] Cold War kit trigger (R&D Lab + 2 Tier III items, proposed) [K].

**Follow-ups (Kaan)**
- [x] 0.5a.1: economy ×0.7 and 20 starting metal.
- [x] 0.5a.2: supply chains (carriers, Depot lines, cutting); Mine costs wood only.
- [x] 0.5a.3: player-chosen supply links; the AI's mines need carriers.
- [x] 0.5b.1: "!" on squadrons whose Truck can't seat everyone; meta snapshot in the Balance Lab;
      audit fixes.

**Done when**
- [x] Balance Lab economy timeline: first Tier II research affordable. Kaan (0.5a.1): economy ×0.7,
      20 starting metal, target 1–3 min; measured 1.5 min.
- [x] `GAME_DESIGN.md` updated.

---

## Patch 0.5c: Balance and convenience (Kaan, 30 Sept, from the 0.5b.1 baseline)

- [x] Machine Gunner: supply 2 tried and reverted (Kaan); instead dearer (15 wood, 45 metal), damage
      6, suppression spreads 50 m at half strength.
- [x] Forest cover only at the forest edge, cover 0.75 (Kaan's pick).
- [x] First raid by difficulty: walking time + 8 min (Easy), + 5 (Normal), + 3.5 (Hard).
- [x] Mortar minimum range 90 → 150 m; mortars step back from enemies inside it.
- [x] Idle Worker button with a count (I), selects and centres the next idle Worker.
- [x] Army overview tab (O): units by type, idle / working / in Trucks / inside / busy; click to select.
- [x] Under-attack alerts: minimap ping, toast, J jumps there.
- [x] Repeat production: right click a unit in a factory's list to train it on repeat.
- [x] Meta snapshot re-run and compared with the baseline (`BALANCE_BASELINE.md`, "Patch 0.5c").

## Patch 0.5d: A smarter enemy (Kaan, 30 Sept)

- [x] Garrisons its HQ and towers, digs trenches in front of its base when an army approaches (and
      once before its first raid).
- [x] Retreats units under 40% health or panicking to its HQ to heal.
- [x] Researches over time (Grenades, Improved Powder and more, by game minute).
- [x] Raids the player's carriers and Depot lines with small groups (scouting deposits when it has
      seen none).

---

## Patch 0.6: Weather and night

- [x] Weather [H2]:
  - [x] Clear, rain, fog, snow; changes every 10–15 game min.
  - [x] 1-minute forecast banner (a toast and the line next to the clock).
  - [x] Effects per weather type.
- [x] Day and night [H3]:
  - [x] 600 s day, 300 s night, 30 s dawn and dusk.
  - [x] At night: vision ×0.5; firing reveals the shooter for 3 s; indirect fire needs a spotter.
- [x] Vision floor ×0.35 [I].
- [x] Direct fire only at what your side can see (Kaan, 29 Sept).
- [x] Research: Flares (a lit area counts as spotted), Searchlights, Night Training, Snow Gear,
      Mud Tyres.

**Done when**
- [x] Balance Lab duels run at night and in each weather type (the "Conditions" picker; the Fight
      Theatre's "Night and weather" group).
- [x] `GAME_DESIGN.md` updated.

---

## Patch 0.7: Big maps, villages and AI

Split into steps (30 Sept): **0.7a** the engine and generator for 13 km maps, **0.7b** living
infantry (added 1 Oct, Kaan: less micromanagement), **0.7c** map detail and buff sites, **0.7d** the
siege AI. Kaan's answers are in `DESIGN_DECISIONS.md`
("Patch 0.7 plan answers"): no alternative win conditions (buff sites instead of victory points),
generated maps only, Modern kit at an R&D Lab + 5 Tier III.

**0.7a (engine and generator)**
- [x] Map generator [Q3]: 13.2 km per side (1100 cells of 12 m), random per match, with a validation
      pass (every deposit and the enemy HQ reachable; a road is laid if not).
- [x] More contested metal deposits; rubber trees and oil seeps placed.
- [x] Pathfinding for big maps: windowed flow fields, routes for long marches, faster search [G10].
- [x] Terrain drawn in tiles; overview picture for the minimap; fog drawn for the visible part only.
- [x] Wider roads (14 m).
- [x] The hand-made maps leave the menu (kept for the Balance Lab).

**0.7b (living infantry; DD "Patch 0.7b: living infantry")**
- [x] Teams: squadron, or loose friendly soldiers within 60 m.
- [x] Wounded fall back behind healthier teammates; rear rank in formation.
- [x] Personal gap (10 / 18 / 12 m), staggered rows, spread out after a nearby shell.
- [x] Help a buddy under fire; take cover under fire; hold the post.
- [x] Wounded walk to a Medic or Field Hospital within 300 m.
- [x] Squad toggle: auto fall-back (off by default).
- [x] Squad blobs (selected clear, others faint).

**0.7c (map detail and buff sites)**

- [x] Villages [J]: 3–5 hamlets and 1–2 central towns. Civilians get their own owner id, are
      never auto-targeted, and flee from fighting.
- [x] Neutral guards patrol routes that avoid bases, with a 150 m leash; they return and heal.
- [x] Map detail (Kaan, 30 Sept): random **abandoned buildings, ruins, walls, wrecks and similar props**
      across the map, usable as cover (they give cover like forest or barricades) and as scenery.
- [x] **Trees drawn in forest cells**, mainly for decoration (forest rules unchanged).
- [x] **Buff sites** (Kaan, 30 Sept, replacing victory points): airdrop landing zones, train stations,
      radio masts, fuel dumps, field hospital ruins, captured by standing there uncontested; citadels
      (big neutral fortresses, taken by clearing their garrison).
- [x] Modern kit at an R&D Lab + 5 Tier III.

**0.7d (siege AI)**
- [x] AI raid logic [Q24]:
  1. [x] Probe towers first.
  2. [x] Move to the weakest outpost toward the HQ.
  3. [x] Ignore unrelated outposts.
- [ ] AI vs AI match length 45–75 game min: moved to Later, it needs the AI on the player's economy
      (two identical scripted AIs stall; DD section L).

**Done when**
- [ ] A full match on a big map runs without frame drops on an ordinary laptop. (1 Oct, `fight-tests/0.7`: a 75 min match costs 12–21 min of computing; fine at 1×, may stutter at 4× late on.)
- [x] `GAME_DESIGN.md` updated.

---

## Patch 0.8: Artillery and armoured car

- [ ] Artillery research → Field Gun [J], Scout Tower level 4 [B], Counter-battery.
- [ ] Armoured Car research → armoured car [J]. AP Rounds → ap damage type.
- [ ] Modern kit trigger: needs a new rule now that the EMP part is gone (to ask Kaan) [K].
- [ ] Balance Lab tests for the Field Gun and the armoured car.
- ~~Blueprint designer~~: **dropped** (Kaan, 30 Sept: the game is complex enough). No chassis/weight
  system, no designer parts, no EMP or extras.

---

## Patch 0.9: Command and after-action (Kaan, 30 Sept)

- [ ] Officer / radio unit: extends the leader aura; mortars may fire at anything it sees (mobile spotter).
- [ ] Unit stances per squad: aggressive (chase), hold fire (ambush until fired on), defend.
- [ ] After-match report: graphs of army size, resources and kills over time, from the replay log.

---

## Later (not scheduled)

- The AI plays by the same economic rules as the player [Q23]. Then the Balance Lab's AI vs AI
  match length (45–75 game min) becomes a real target.
- Multiplayer lockstep, built on the seeded randomness and tick orders from 0.2.1.
- Replays built on the same order log.
- Save and load, sound effects, a tutorial.
- Drones as late experimental tech.
