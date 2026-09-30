# Dot War: patch notes

Player-facing notes, newest first. Details and numbers live in `GAME_DESIGN.md`; the reasons behind
each change live in `DESIGN_DECISIONS.md`.

---

## 0.6: Weather and night (30 September 2026)

- **Day and night:** ten minutes of day, then five of night, all match long. At night everyone sees
  half as far, a soldier who fires is seen by the enemy for 3 seconds, and mortars fire only at what
  your side can see.
- **Weather:** after the first clear stretch it changes every 10 to 15 minutes: rain (slower off-road,
  worse aim, wider mortar scatter), fog (short sight, height helps less) or snow (short sight, slow
  infantry, slow digging). A forecast warns you a minute ahead, next to the clock.
- **You can only shoot what you can see:** Riflemen, Machine Gunners and Snipers need your side to see
  their target, day and night. Scouts and towers matter more.
- **New research:** Night Training (Riflemen and Snipers see farther at night), Snow Gear, Flares
  (mortars light up an area, key **L**), Searchlights (towers of level 2 sweep a cone at night; they
  can be switched off, since a lit tower is visible to the enemy), Mud Tyres.
- **On screen:** darkness at night with lit flares, searchlight cones and a glow around your soldiers;
  rain, snow and fog effects.
- **Balance Lab:** duels can run at night or in any weather; the Fight Theatre has a new "Night and
  weather" group.

## 0.5e: Faster simulation (30 September 2026)

- **The game simulates about 4.7× faster.** Fog of war was most of the work; soldiers now see from
  the centre of the 12 m map cell they stand in, and soldiers in the same cell share one calculation.
  Big fights and late matches should stay smooth at 4× speed.
- Side effect: the edge of vision moves by a few metres. In testing only fights with Mortar Crews
  changed; mortars are a bit less dominant at long range.
- Testing got much faster too: the full set of recorded fight tests now takes 8 minutes instead of
  about 3 hours. The Balance Lab baseline was re-measured on this build.

## 0.5d: A smarter enemy (30 September 2026)

- **Wounded enemies fall back:** enemy soldiers under 40% health, or panicking, walk home to heal at
  their HQ and come back at 80%. Chasing a beaten raid now finds fewer easy kills.
- **The enemy garrisons its HQ** when you come close, and lets its soldiers out once you're gone.
- **The enemy digs in:** a minute before its first raid it digs a trench across the road from your
  base, and it digs another when it sees your army coming if none stands. Its soldiers hold the trench.
  Bring grenades or mortars.
- **The enemy researches over time:** better aim, grenades, faster digging, boots, powder, HE shells,
  cohesion and Storm Troops, earlier on Hard. Expect grenades at your trenches from minute 8 on Normal.
- **Supply raids:** every few minutes (Normal and Hard) three enemy Riflemen go after your carriers,
  camps, mines or Depots, or come looking for your mines at the deposits nearest their base. Guard your
  outposts.
- **Fix:** a few enemy garrison soldiers used to start on cliffs they could never walk off.
- **Fix:** the controls help now says a Truck hauls 120 per trip.

## Tool: Fight Theatre and recorded fight testing (30 September 2026)

- **Fight Theatre** (`theatre.html`): watch 37 set-piece fights (every unit against every unit,
  terrain, trenches, Bunkers and more) with both sides visible, at ¼× to 8× speed. The same fight and
  seed always play out the same way. `theatre.html?match=1&diff=normal` follows a whole AI match.
- **Recorded fight testing by patch** in `fight-tests/`: a report, videos and raw numbers for each
  patch, starting with 0.5c.

## 0.5c: Balance and convenience (30 September 2026)

- **Machine Gunners pin, they don't mow down:** damage 11 → 6, but their suppression now spreads to
  everyone within 50 m of the target at half strength. They cost a bit more (15 wood, 45 metal) and
  still take 1 supply. Alone they are weak; beside Riflemen they decide fights: 1 Machine Gunner and
  4 Riflemen beat 6 Riflemen 60% of the time, where 5 Riflemen win only 7%.
- **Forests give cover only at the edge:** soldiers at a forest's edge are 25% harder to hit (was
  45% anywhere in the forest). Deep in the woods you are hidden, not protected. Defenders in a forest
  now win about 88% of even fights instead of all of them.
- **Mortars need more room:** minimum range 150 m (was 90). A mortar crew that sees an enemy inside
  that range walks away until it can fire.
- **The first enemy raid depends on difficulty:** about 8 minutes on Easy, 5 on Normal, 3.5 on Hard,
  plus the walk.
- **Idle Workers button** (top bar, or press **I**): shows how many Workers have nothing to do and
  jumps to the next one.
- **Army tab** (press **O**): every unit type with how many are idle, working, in Trucks, inside a
  building or busy. Click a number to select them.
- **Under-attack alerts:** a message and a red ping on the map and minimap when something of yours
  is hit. Press **J** to look.
- **Repeat production:** right click a unit in a factory's list and it keeps training that unit
  whenever you can pay. Right click again to stop.

## 0.5b.3: Bigger truck loads, quick hiring, far sight from hills (30 September 2026)

- **Trucks carry 120** per trip instead of 40.
- **"Train a Worker for this":** a camp, mine, tapper or refinery with free slots has a button that
  trains a Worker at the HQ and sends him straight there.
- **See farther from high ground:** besides the existing bonus for standing high, a clear view down
  a slope now reaches up to 50% farther, the more the ground drops away. Forest and ridges still
  block it. From the enemy plateau's edge a soldier now sees about 320 m instead of 300.
- Bigger maps come with patch 0.7, as planned.

## 0.5b.2: Trucks that earn their keep (30 September 2026)

- **Trucks at camps and mines are worth it now:** the HQ refuels Trucks too (not only Depots), the
  fuel tank is twice as big, and while a Truck waits at a building the Workers leave the stock to it.
  On a far mine, 3 Workers and a Truck deliver about 45% more than 4 Workers.
- **Snipers can't pick off idle soldiers for free:** soldiers standing around with no orders who
  are shot from beyond their reach now go after the shooter together (your soldiers and the enemy's).
  Two Snipers used to kill six idle Riflemen from 280 m unharmed; now the Riflemen charge and win.
  Soldiers on Defend (R) still hold their ground.
- **Carriers keep their load:** if a camp or mine is destroyed while a Worker is carrying from it, he
  still delivers what he holds (to the HQ if his Depot is gone too).

## 0.5b.1: Marching warning, audit fixes, balance baseline (29 September 2026)

- **"!" when soldiers will march:** a squadron whose Truck can't seat everyone shows an orange "!"
  on its squadron tile, on its panel and beside the Truck; hover it to see how many will walk.
- **Fixes from a full audit of the game:**
  - Chasing a moving enemy (or a moving Truck) no longer stutters the game with route planning.
  - Soldiers who miss their squadron's Truck now march instead of boarding it later and getting stuck
    inside; re-ordering a squadron while some ride in its Truck sends them to the new spot.
  - Passengers thrown out of a wrecked Truck obey queued orders again; dead soldiers free their
    Bunker, tower or Truck slot (so Riflemen stop grenading an empty Bunker).
  - Medics, Workers and Trucks ignore attack orders instead of walking into the enemy; an attack on
    a soldier who garrisons ends; bullets in flight no longer hit someone who has just gone inside.
  - Shift-queued orders behind a work order now run (Shift replaces the work).
  - Cancelling a queued Truck refunds what you paid, not the upgraded price.
  - Blowing one barricade segment no longer opens its neighbours to vehicles.
  - Only Workers earn work experience; a retrofit keeps a Truck's rank bonus.
  - Only armed enemies cut a Depot's supply line, as intended.
  - Shift+number adds a squadron to the selection (and number keys work on AZERTY keyboards);
    Ctrl+A and double-click no longer pick soldiers inside buildings or Trucks.
  - After placing a building or pressing Esc, the panel goes back to your selection, so the letters
    are unit orders again.
  - The tower Upgrade button lights up as soon as you can afford it; a soldier walking to a Truck
    shows "Boarding a Truck".
  - A thrower turns to face his grenade again.
- **Balance Lab:** a new **Meta snapshot** runs a fixed set of tests (duels between every unit,
  terrain, fortifications, economy, enemy pressure) and compares them to the saved 0.5b.1 baseline
  (`BALANCE_BASELINE.md`). Only one lab test runs at a time now, and the duels give both sides the
  same sulfur (side A's mortars used to have none).

## 0.5b: Trucks (29 September 2026)

- **The Truck** (Workshop, after Motorisation research): 6 seats, where a Mortar Crew takes 2. Right
  click it with soldiers selected to climb in; Q lets everyone out. Passengers can't shoot, and if
  the Truck is destroyed they tumble out hurt.
- **Fuel:** a Truck burns fuel as it drives, less on roads. Park it next to a Depot to refuel (costs
  oil). It carries spare fuel for other trucks running low nearby. On an empty tank it crawls.
- **Hauling:** a Truck can be assigned to a camp or mine like a Worker and carries 40 per trip along
  the supply link.
- **Squadrons ride:** put a Truck in a squadron, and on long moves the soldiers climb in, ride, and
  jump out to take their places at the destination; whoever doesn't fit marches.
- **Workshop:** repairs vehicles parked beside it (costs metal) and retrofits old Trucks to the latest
  design for 40% of the price difference.
- **Endless Truck upgrades at the R&D Lab:** Armour, Engine and Fuel Tank, each level dearer than the
  last; at Armour 5 you can switch to Heavy Armour, at the cost of the engine upgrades so far.
- Barricades now stop vehicles; trenches slow them.

## 0.5a.3: You choose the supply links (29 September 2026)

- Camps, mines, tappers, refineries and Depots now send their goods where **you** choose: press
  "Pick supply link" on the building (or right click one of your Depots while it is selected). With
  nothing picked, goods go straight to the HQ. The automatic "nearest Depot" and "20% detour" rules
  are gone, so every web is one you built on purpose. Links that would go round in a circle are
  refused.
- The enemy commander's mines need carriers now too: it keeps two Workers on each mine, walking a
  line you can see and ambush.

## 0.5a.2: Supply chains (29 September 2026)

- **Carrying:** camps, mines, tappers and refineries now fill their own store (up to 100). The
  Workers or soldiers you assign carry it, 10 at a time (soldiers 5), to the nearest Depot or the
  HQ along a thin dashed line, and walk back. Only delivered goods can be spent, so distance matters
  and carriers can be ambushed.
- **Depot lines:** every Depot has a line to the HQ, or to another Depot when that is barely a
  detour (at most 20% longer), so your lines grow into a web. Enemy soldiers standing on a line cut
  it (it turns red), and goods at the cut Depots wait until you clear it.
- **Costs:** the Mine costs 70 wood instead of 60 wood and 10 metal, so you can always start
  harvesting even if your metal runs out. The Lumber Camp and Rubber Tapper were already wood only.

## 0.5a.1: A slower game (29 September 2026)

- Every camp, mine, tapper and refinery gathers 30% slower, and so does the enemy commander's income.
- You start with 20 metal instead of 60.
- The first Tier II research is now affordable after about 1.5 minutes instead of under 1. The
  Balance Lab target for it moved to 1–3 minutes.

## 0.5a: Tech tree, new buildings and supply (29 September 2026)

**Tech tree.** Research now has five branches with three tiers: Infantry doctrine, Fire support,
Engineering, Logistics, Command & medical.
- Tier I is researched at the HQ; Tiers II and III at the branch building (Barracks, Ordnance
  Works, Workshop, Depot, Field Hospital); Tier III also needs an R&D Lab.
- Each building type researches one thing at a time, so up to six projects can run at once.
- N opens the research overview: what every building is researching, then each branch by tier.
- New research: Assault Drill (better aim on the move), Squad Cohesion, Camouflage Uniforms,
  Storm Troops (faster grenades), Smoke Shells, Forward Observers, Road Building, Reinforced
  Concrete, Bridging, Demolition Charges, Deep Shafts, Supply Organisation, Refinery, Triage,
  Signals, Intelligence.
- Heavy Machine Gun, Marksman Rifle, Improved Powder and HE Shells now need their branch building.

**New buildings.** Workshop (Engineering research), Depot (+10 supply, a little oil, Logistics
research; each extra Depot costs 25% more), R&D Lab (unlocks Tier III), Rubber Tapper (on rubber
trees), Refinery (on oil seeps).

**Supply.** Every unit takes supply (a Mortar Crew 2). You start with room for 30; each Depot adds
10. The top bar shows used and total.

**New abilities from research:**
- **Roads and bridges:** Workers build them with the line tool, so bridges can cross rivers.
- **Smoke:** M with mortars selected lays a smoke screen that blocks sight for 15 s.
- **Demolition:** C with soldiers selected blows up a barricade, wire or a bridge.
- **Camouflage:** camouflaged soldiers in forest are only spotted up close.
- **Signals:** fading markers show where enemies were last seen.
- **Intelligence:** warns you when an enemy raid sets out.
- Two Tier III items plus an R&D Lab switch new soldiers to Cold War uniforms.

**Controls.** Building keys now work only while the Build tab is open: press B, then the letter
(B then L for a Lumber Camp).

## 0.4.2: Grenades a little off (29 September 2026)

- Grenades no longer land exactly on target: up to about 8 m off at full reach, more when the
  thrower is under stress, and about one throw in seven goes wide by another 6 to 14 m.
- Result in the Balance Lab: fights are less certain. 8 grenadiers now clear 5 Riflemen in a trench
  94% of the time instead of always. A full Bunker (5 men inside: 4 Riflemen and a Machine Gunner)
  holds against 8 grenadiers 88% of the time and falls to 10 almost always.
- The Balance Lab now says how many men are inside the Bunker.

## 0.4.1: Grenades made harder to use (29 September 2026)

- Soldiers in a **trench take half damage from explosions** (grenades and mortar shells).
- A Rifleman now **stands still for 1 second** before throwing, without firing. A grenade mark shows
  over him. A new order or a panic cancels the throw, and the sulfur is only spent when the grenade
  leaves his hand.
- Grenade **reach cut from 35 m to 25 m**.
- Result in the Balance Lab: 6 grenadiers used to clear 5 soldiers in a trench every time; now they
  win about half the time. Ten grenadiers still take a full Bunker (5 men inside).

## 0.4: Fortifications and medical (28 September 2026)

**Line defences.** Build tab, then Y trench, I barricade, J barbed wire. Hold the left button and
drag to draw.
- The soldiers you have selected dig it. With nobody selected, idle Workers within 300 m do.
- A soldier digs 10 m in 15 s; Workers are 1.5× faster; diggers on the same stretch add up.
- Each 10 m is paid only when digging on it starts. Stop the diggers and the untouched stretches
  vanish unpaid; right click a started stretch to carry on.
- **Trench** (30 wood / 10 m): soldiers in it are 40% harder to hit and take half stress. Enemies
  cross it at 0.4× speed; your own soldiers don't slow down. It can't be destroyed; Workers fill it
  in with K.
- **Barricade** (30 wood, 15 metal / 10 m, needs Fortification): cover for soldiers behind it,
  everyone crosses at half speed, 200 HP. Explosives break it; rifle fire only chips it.
- **Barbed wire** (20 metal / 10 m, needs Fortification): no cover, everyone crosses at 0.25× speed,
  80 HP, only explosives cut it.
- Units route around barricades and wire when they can.

**Garrisons.**
- New **Bunker** (U, 120 wood, 90 metal, needs Fortification): 1200 HP, holds 4 soldiers plus a
  Machine Gunner slot. Soldiers inside shoot 10% more accurately, but grenades still reach them.
- The **HQ** now holds 6 soldiers and adds 6 m of height as a last stand.
- Right click or E puts soldiers in; Q empties the building.

**Grenades** (Grenades research): Riflemen throw them on their own at enemies in trenches or
Bunkers, or when you press V and click. 45 explosive damage, 1 sulfur each, 20 s cooldown, friendly
fire on. A grenade on a Bunker hurts everyone inside for 30% damage.

**Healing** (soldiers only; the sources add up):
- **Medic** (Barracks, Field Medicine research): heals one wounded soldier at a time, 4 HP/s within
  40 m, squadmates first, and walks over to the wounded on its own.
- **Field Hospital** (P, Field Hospital research): heals everyone within 120 m at 1.5 HP/s.
- The **HQ** heals everyone within 150 m at 0.5 HP/s.

**Also:**
- Five new research items on the HQ: Fortification, Entrenching Tools (+30% digging), Grenades,
  Field Medicine, Field Hospital.
- Medics earn XP for healing, Workers for digging.
- Balance Lab: new trench-hold and bunker-assault tests.
- Fixed: a panicking soldier could run off the edge of the map.
- The enemy commander doesn't use any of this yet.

## 0.3.1: Squads as a utility

- In **react** mode a squadron no longer halts on contact. Members share the squad's target only
  when it's no farther than their own nearest enemy. A squadron now beats the same number of loose
  soldiers about 59% of the time instead of 80%.
- In **keep moving** mode each member fires at the closest enemy he can hit.

## 0.3: Squadrons and veterancy

- **Squadrons** replace number-key groups. Ctrl+1–9 with 2 to 12 soldiers forms one; 1–9 selects
  it, twice centres the view. A soldier is in one squadron at a time.
- Orders to one member move the whole squadron. On arrival it forms a line, ranked by range:
  Riflemen in front, Machine Gunners and Snipers behind, Workers and Medics in the centre, Mortars
  60 m back. **Right-drag** sets the line's width and facing.
- Squad panel toggles: pace (`>` slowest member, `>>` each his own), spacing (tight 15 m or loose
  25 m), contact (react or keep moving).
- Squadmates calm each other down; panicking members run back to the squad; Retreat (G) is a
  fighting withdrawal.
- A factory's rally point on a squad member sends new units into that squadron.
- Squadron bar at the top: counts per class, health, stress and average rank.
- **Veterancy:** XP for kills, damage, suppressing enemies, surviving fire and work. Ranks at 30,
  80 and 160 XP give accuracy, calm and health; rank 3 also reloads faster. The highest rank leads
  the squad (star) and steadies those near him; his death shakes them more.

## 0.2b: New look

- Painted start menu and loading screens with small moving details.
- Open-map layout: the map fills the window, with small floating panels for resources, clock and
  minimap, squadron bar, selection panel and command card.
- Class badges on portraits and on the group bar; one group per soldier.
- New background music: a Grieg violin sonata.

## 0.2.1: Foundations

- Every match has a seed and a log of orders, so the same match can be replayed exactly.
- **Balance Lab** (`lab.html`): unit duels, economy timeline, AI against AI, with target ranges.
- **Worker** unit replaces soldiers as the main harvester; the Musketeer is gone and Rifling is
  researched from the start.
- New combat values: softer height bonuses, suppression and panic, Snipers that never panic,
  Machine Gunners that must stop to fire, moving-fire penalty.
- The enemy commander unlocks units over time and its raids grow until it clearly outnumbers you.
- New key layout: WASD pans, F attack-move, R defend, G retreat, X stop, E enter, Q exit, T tower
  upgrade, Z X C V train.

## 0.2a: Faces and armies

- Every soldier has a face and a name, kept for the whole match.
- Nine armies to pick in the menu (British, American, French, German, Italian, Polish, Soviet,
  Turkish, Spanish). They change uniforms and names only, never stats.

## 0.2: First public build

- Topographic real-time strategy on four maps with difficulty levels, scout towers and music.
