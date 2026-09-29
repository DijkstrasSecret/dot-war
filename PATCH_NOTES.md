# Dot War: patch notes

Player-facing notes, newest first. Details and numbers live in `GAME_DESIGN.md`; the reasons behind
each change live in `DESIGN_DECISIONS.md`.

---

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
