# Dot War: implementation plan

Patch order agreed on 28 September 2026: **infantry first**. Patch 0.2a (portraits) was added
in front of 0.2.1 the same day, so the coming UI rework is built with portraits already in place.
The patches build on each other, so do them in this order. All numbers and rules come from `DESIGN_DECISIONS.md`; the references in
brackets point to its sections. Work rules are in `CLAUDE.md`.

Tick each box when it's done and checked in the game.

---

## Patch 0.2a: Portraits, names and factions

Guide and ready-made diff: `PATCH_0.2a_PORTRAITS.md` and `patches/patch-0.2a-portraits.diff`.

- [ ] Add `js/portraits.js` (visual only, own random stream; never called from the simulation) [K].
- [ ] "Your army" picker in the start menu; the AI gets a different random army; neutrals stay
      mixed [K].
- [ ] `faction` and `kitEra` stored on each unit when it is trained; `kitEra` stays `'ww2'` until
      the era triggers exist [K].
- [ ] Selection panel shows the portrait and name; garrison icons show the short name. Nothing
      else in the UI changes.

**Done when**
- [ ] Tested in the browser with no console errors; headless run still works.
- [ ] `grep Portraits` finds nothing in the simulation files.
- [ ] Repo docs updated (`CLAUDE.md`, `DEVELOPMENT.md`, `GAME_DESIGN.md`, `README.md`, `ROADMAP.md`).
- [ ] `patches/patch-0.2a-portraits.diff` deleted once the code is in.

---

## Patch 0.2.1: Foundations

Goal: the game plays at the new core values, and every run can be repeated exactly.

**Determinism and tools**
- [ ] Replace `Math.random` in the simulation with a seeded `Util.mulberry32` stream; store the
      seed per match. Move visual-only randomness (decals, corpses) to a separate stream.
- [ ] Pick the AI's army from the match seed, and seed portraits with
      `Portraits.seedFor(G.seed, u.id)` [K].
- [ ] Record orders as descriptors with a tick number (`{tick, kind, ...}`). This prepares replays
      and multiplayer.
- [ ] Headless runner: advance the simulation N ticks with no renderer.
- [ ] `lab.html` Balance Lab [H4]:
  - [ ] Unit duels: A × n vs B × m, on flat, uphill +30 m or forest ground, 100 runs.
  - [ ] Economy timeline for a standard opening build order.
  - [ ] AI vs AI mirror match.
  - [ ] `balance-targets.js`; results outside a target range show in red.
- [ ] Shared stacking helper: multiply, then cap [I].

**Combat values**
- [ ] Elevation [Q8, I]:
  - [ ] Range: `1 + 0.04·√dh`, max +50%. Uphill: `1 − 0.03·√|dh|`, floor −20%.
  - [ ] Damage and hit chance from steepness `s = dh / max(d, 20)`.
  - [ ] 3 m dead zone.
  - [ ] Indirect fire gets half the range bonus, max +25%.
- [ ] Stress decay 0.06/s [Q9].
- [ ] Retreat: no suppression slowdown, 2× decay [Q10].
- [ ] Moving fire 0.35; Machine Gunners can't fire while moving [Q11].
- [ ] Snipers: half stress, never panic, can be suppressed, keep obeying target orders [Q12, I].

**Roster and start**
- [ ] Remove the Musketeer. Rifling is done at init [Q1, Q15].
- [ ] Worker unit [A], trained at the HQ at full speed. HQ trains Riflemen at 0.7× [I].
- [ ] Soldiers assigned to a camp count as 0.5 of a worker [Q4].
- [ ] Start with 6 Riflemen and 4 Workers.

**AI**
- [ ] Musketeers → Riflemen in AI unit weights and map garrisons.
- [ ] Time-gated AI unlocks, scaled by difficulty: MG about 8 game min, Sniper about 12,
      Mortar about 15 [G7].
- [ ] First raid = walking time from the enemy base + 300 s; scale the raid interval the same
      way [Q2].

**Controls** [9]
- [ ] WASD pans the camera.
- [ ] Move the old order keys: F attack-move, R defend, G retreat, X stop, E enter, Q exit,
      T tower upgrade.
- [ ] Z X C V train from a factory; Tab pages when a factory has more than 4 blueprints.
- [ ] Smart right-click.
- [ ] Minimap click jumps the camera.

**Done when**
- [ ] Running the same seed twice gives identical results.
- [ ] Balance Lab green, or reds reported to Kaan: 1 MG pins a Rifleman in 3.5–5.5 s; 5 v 5
      Riflemen, the side with +30 m height wins 65–80%.
- [ ] `GAME_DESIGN.md` updated.

---

## Patch 0.3: Squadrons and veterancy

**Squadrons** [E]
- [ ] Ctrl+number creates or replaces a squadron (2–12 units); Ctrl+number with nothing selected
      clears it. Number selects; double-tap jumps the camera.
- [ ] One squadron per unit. Auto-disband at 1 member. Box-selected members still move the
      whole squad.
- [ ] Formation:
  - [ ] Column on roads and narrow passes, lines in the open, a line on arrival.
  - [ ] Ranks by range.
  - [ ] Right-drag sets width and facing.
- [ ] Toggles `>` / `>>`, tight / loose, react / keep moving (defaults: `>`, loose, react).
- [ ] Squad panel, squadron bar (size, health, stress, average rank), and the number drawn on
      each member.
- [ ] Combat and morale:
  - [ ] Shared targets; Snipers pick their own; mortars follow the squad's fight.
  - [ ] Cohesion decay 0.08/s within 40 m.
  - [ ] Panic runs toward the squad's centre.
  - [ ] Retreat is a fighting withdrawal.
- [ ] Rally point on a squad member adds new units to that squadron.

**Veterancy** [H1, I]
- [ ] XP sources (suppression XP at most once per target every 30 s).
- [ ] Ranks 1–3 at 30, 80 and 160 XP, with chevrons. Set `u.rank` so portrait names show the
      title (Pvt., Cpl., Sgt., Sgt. Maj.) [K].
- [ ] Leader: highest rank, star marker, aura ×1.2 decay within 60 m. Death shock +0.3 replaces
      the normal +0.2.

**Done when**
- [ ] Balance Lab has a squad-vs-squad test.
- [ ] `GAME_DESIGN.md` updated.

---

## Patch 0.4: Fortifications and medical

- [ ] Line tool: pick from the build menu, then drag to draw.
  - [ ] Cost per 10 m segment.
  - [ ] Digging: selected infantry dig it; if none are selected, idle Workers within 300 m take
        it [J].
  - [ ] Dig rate 15 s per 10 m; Workers 1.5× faster.
- [ ] Trench, barricade and wire effects and HP [B, G12, I].
  - [ ] Your own barricades and wire slow your own units; your own trenches don't slow your own
        infantry.
  - [ ] Fill trench (K), Workers only.
- [ ] Paths recalculated once per finished line.
- [ ] Bunker [B].
- [ ] HQ garrison: 6 infantry, +6 m height, 220 vision [I].
- [ ] Grenades:
  - [ ] Thrown automatically at units in trenches or bunkers, or by order.
  - [ ] Bunker occupants take 30% damage and full stress.
  - [ ] Friendly fire on.
- [ ] Medic unit [A]; Field Hospital [B]; HQ regeneration 0.5 HP/s within 150 m. Sources add up,
      infantry only.
- [ ] Research items for these systems (Fortification, Entrenching Tools, Grenades, Field
      Medicine, Field Hospital), temporarily on the HQ list until 0.5.

**Done when**
- [ ] Balance Lab tests for a bunker assault and a trench hold.
- [ ] `GAME_DESIGN.md` updated.

---

## Patch 0.5: Vehicles, logistics and the tech tree

**Vehicles**
- [ ] Vehicle move class (max grade 0.4).
- [ ] Truck [A]:
  - [ ] 6 seats; a square takes 2.
  - [ ] "x2 ○" passenger count on its back.
  - [ ] E boards, Q unloads.
- [ ] Squad auto-carry on moves over 600 m: members fill the seats and the rest march [G4].
- [ ] Fuel [I, J]:
  - [ ] Tank 60; 1 fuel per 100 m on roads, 1.5 off-road.
  - [ ] Depot refuels (1 oil per fuel) and produces a 0.1 oil/s trickle.
  - [ ] Truck carries 60 spare fuel.

**Buildings**
- [ ] Workshop: builds vehicles; repairs 5 HP/s for 1 metal per 10 HP; retrofits trucks.
- [ ] Depot: +10 supply; each extra Depot costs 25% more.
- [ ] R&D Lab.
- [ ] Rubber Tapper [G1].
- [ ] Refinery [I].

**Supply and upgrades**
- [ ] Supply cap 30, +10 per Depot, no maximum. Supply cost per unit [Q18].
- [ ] Truck upgrade tracks (infinite): cost ×1.5 per level; truck price +10% per level; heavy
      conversion at Armour 5 removes Engine speed gained so far; retrofit costs 40% of the price
      difference [A].

**Tech tree** [F]
- [ ] Five branches, three tiers.
- [ ] One research slot per building type.
- [ ] B / G / U effect semantics.
- [ ] N opens the research overview.
- [ ] Every item in F except those scheduled for 0.6 and 0.8.
- [ ] Signals: last-seen markers [J]. Intelligence: raid warning.
- [ ] Logistics boosts every harvest building; Deep Shafts applies to Mines only [J].
- [ ] Mermaid tree in the docs updated if items move.
- [ ] Cold War kit trigger (R&D Lab + 2 Tier III items, proposed) [K].

**Done when**
- [ ] Balance Lab economy timeline: first Tier II research affordable at 6–10 game min.
- [ ] `GAME_DESIGN.md` updated.

---

## Patch 0.6: Weather and night

- [ ] Weather [H2]:
  - [ ] Clear, rain, fog, snow; changes every 10–15 game min.
  - [ ] 1-minute forecast banner.
  - [ ] Effects per weather type.
- [ ] Day and night [H3]:
  - [ ] 600 s day, 300 s night, 30 s dawn and dusk.
  - [ ] At night: vision ×0.5; firing reveals the shooter for 3 s; indirect fire needs a spotter.
- [ ] Vision floor ×0.35 [I].
- [ ] Research: Flares (a lit area counts as spotted), Searchlights, Night Training, Snow Gear,
      Mud Tyres.

**Done when**
- [ ] Balance Lab duels run at night and in each weather type.
- [ ] `GAME_DESIGN.md` updated.

---

## Patch 0.7: Big maps, villages and AI

- [ ] Map generator [Q3]:
  - [ ] 12–14 km per side, 12 m cells, with a validation pass.
  - [ ] More contested metal deposits; rubber trees and oil seeps placed.
- [ ] Chunked simulation; incremental fog and line of sight [G10].
- [ ] Villages [J]: 3–5 hamlets and 1–2 central towns. Civilians get their own owner id, are
      never auto-targeted, and flee from fighting.
- [ ] Neutral guards patrol routes that avoid bases, with a 150 m leash; they return and heal.
- [ ] AI raid logic [Q24]:
  1. [ ] Probe towers first.
  2. [ ] Move to the weakest outpost toward the HQ.
  3. [ ] Ignore unrelated outposts.
- [ ] AI vs AI match length 45–75 game min in the Balance Lab.

**Done when**
- [ ] A full match on a big map runs without frame drops on an ordinary laptop.
- [ ] `GAME_DESIGN.md` updated.

---

## Patch 0.8: Designer, artillery and armoured car

- [ ] Artillery research → Field Gun [J], Scout Tower level 4 [B], Counter-battery.
- [ ] Armoured Car research → armoured car [J]. AP Rounds → ap damage type.
- [ ] Blueprint designer [D, J]:
  - [ ] Chassis weight limits and part weights.
  - [ ] Speed penalty over half the limit.
  - [ ] Parts researched at the R&D Lab; each needs its branch unlock first [G6].
  - [ ] EMP and the extras.
- [ ] Modern kit trigger (EMP part researched, proposed) [K].
- [ ] Balance Lab tests for designed units against stock units.

---

## Later (not scheduled)

- The AI plays by the same economic rules as the player [Q23].
- Multiplayer lockstep, built on the seeded randomness and tick orders from 0.2.1.
- Replays built on the same order log.
- Save and load, sound effects, a tutorial.
- Drones as late experimental tech.
