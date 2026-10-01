'use strict';
// All static game data: resources, damage model, unit blueprints, buildings, research, difficulty, hotkeys.
// Times are game seconds (the loop runs them at half real time at 1x). Speeds are world units per game second.
// TODO(patch 0.8): armoured car blueprint (shape 'tri'); 'rpg', 'artillery' and 'emp' weapons; ap damage type is already in ARMOR_MULT.
const Data = {
  RES: ['wood', 'metal', 'rubber', 'oil', 'sulfur'],
  RES_COLORS: { wood: '#a86b32', metal: '#8fa2b5', rubber: '#555', oil: '#3a3a3a', sulfur: '#e0c020' },

  PLAYER_COLORS: { 0: '#7a7a7a', 1: '#2458d6', 2: '#c8302e', 3: '#b39a6e' },   // 3: civilians (0.7c)
  PLAYER_NAMES: { 0: 'Neutral', 1: 'You', 2: 'Highland Army', 3: 'Civilians' },

  // damage type -> armor class -> multiplier
  ARMOR_MULT: {
    ballistic: { none: 1.0, light: 0.35, heavy: 0.08, building: 0.15 },
    explosive: { none: 1.0, light: 0.7, heavy: 0.35, building: 0.9 },
    ap: { none: 0.6, light: 1.0, heavy: 0.9, building: 0.5 },
  },

  MOVE_CLASSES: {
    infantry: { maxGrade: 0.8, forest: 0.65, swamp: 0.45, road: 1.25 },
    vehicle: { maxGrade: 0.4, forest: 0.3, swamp: 0.15, road: 1.5, vehicle: true },   // barricades block it (DD B)
  },

  UNITS: {
    // DD A: harvests and (from 0.4) digs; unarmed. Counts as a full worker at a camp, soldiers as half (DD Q4).
    worker: {
      name: 'Worker', shape: 'circle', icon: 'worker', cls: 'infantry', size: 5.5, labour: 1, role: 0,
      hp: 40, armor: 'none', speed: 50, vision: 120, cost: { wood: 25 }, time: 8, supply: 1,
      weapon: null,
      desc: 'Unarmed labourer. A full worker at a camp or mine, where soldiers count as half.',
    },
    rifle: {
      name: 'Rifleman', shape: 'circle', icon: 'rifle', cls: 'infantry', size: 6, role: 1,
      hp: 70, armor: 'none', speed: 52, vision: 160, cost: { wood: 12, metal: 10 }, time: 10, supply: 1,
      weapon: { dmg: 20, dtype: 'ballistic', range: 170, minRange: 0, acc: 0.68, reload: 1.5, pspeed: 900, indirect: false, splash: 0, suppress: 0.08 },
      grenade: true,   // throws Data.GRENADE once the Grenades research is done
      desc: 'Standard infantry. Good range and accuracy. Throws grenades once researched.',
    },
    hmg: {
      name: 'Machine Gunner', shape: 'circle', icon: 'hmg', cls: 'infantry', size: 6.5, role: 2,
      hp: 80, armor: 'none', speed: 38, vision: 160, cost: { wood: 15, metal: 45 }, time: 14, supply: 1, requires: 'hmg', noMovingFire: true,   // DD Q11: cannot fire on the move. Kaan, 0.5c: dearer (was 10 / 35), supply stays 1
      // Kaan, 0.5c: an MG's strength is suppression, not killing: damage 11 -> 6, and its suppression spreads
      // to soldiers within 50 m of the target at half strength (others' shots: 30 m, 20%).
      weapon: { dmg: 6, dtype: 'ballistic', range: 200, minRange: 0, acc: 0.4, reload: 0.18, pspeed: 900, indirect: false, splash: 0, suppress: 0.035, suppressArea: { r: 50, share: 0.5 } },
      desc: 'Sustained fire that pins whole groups down. Weak on its own, decisive beside Riflemen.',
    },
    sniper: {
      name: 'Sniper', shape: 'circle', icon: 'sniper', cls: 'infantry', size: 6, role: 2,
      hp: 55, armor: 'none', speed: 48, vision: 230, cost: { wood: 10, metal: 25 }, time: 14, supply: 1, requires: 'sniper',
      stressTaken: 0.5, neverPanics: true, obeysWhenSuppressed: true,   // DD Q12, I: half stress, never panics, can be suppressed but keeps its orders
      weapon: { dmg: 65, dtype: 'ballistic', range: 300, minRange: 0, acc: 0.85, reload: 3.5, pspeed: 1300, indirect: false, splash: 0, suppress: 0.25 },
      desc: 'Long sight and reach. Takes half stress, never panics, keeps its target orders even when suppressed.',
    },
    mortar: {
      name: 'Mortar Crew', shape: 'square', icon: 'mortar', cls: 'infantry', size: 7, role: 3,
      hp: 70, armor: 'none', speed: 34, vision: 140, cost: { wood: 20, metal: 40 }, time: 16, supply: 2, requires: 'mortar',
      weapon: { dmg: 50, dtype: 'explosive', range: 380, minRange: 150,   // Kaan, 0.5c: minimum range 90 -> 150
         acc: 0.5, reload: 5, pspeed: 200, indirect: true, splash: 32, suppress: 0.35, ammo: { sulfur: 2 },
         falloff: { centre: 1.3, edge: 0.15, power: 1.5 } },   // Kaan, 0.7b.1: share 0.15 + 1.15 (1 - f)^1.5 of the radius out: the centre kills, the edge stings
      desc: 'Indirect fire over ridges. Costs sulfur per shell. Needs a spotter to be accurate.',
    },
    // DD A, patch 0.5b. Seats: a circle takes 1, a square 2. Hauls `load` on a supply link (Kaan).
    // labour 0: a Truck on a camp adds no labour, it only carries.
    truck: {
      name: 'Truck', shape: 'rect', icon: 'truck', cls: 'vehicle', size: 8, role: 4, labour: 0,
      hp: 150, armor: 'light', speed: 110, vision: 150, cost: { wood: 40, metal: 30, rubber: 5 }, time: 18, supply: 2, requires: 'motorisation',
      weapon: null, seats: 6, fuel: 120, spare: 60, load: 120,   // Kaan: tank 60 -> 120 (0.5b.2), load 40 -> 120 (0.5b.3)
      desc: 'Carries 6 seats of infantry (a Mortar Crew takes 2) or 120 goods per trip on a supply link. Burns fuel; refuel at a Depot.',
    },
    // DD A: heals one unit at a time, squadmates first (DD E). Speed, vision, cost and time proposed.
    medic: {
      name: 'Medic', shape: 'circle', icon: 'medic', cls: 'infantry', size: 5.5, role: 0,
      hp: 50, armor: 'none', speed: 50, vision: 140, cost: { wood: 20, metal: 15 }, time: 10, supply: 1, requires: 'medicine',
      weapon: null, heal: { rate: 4, range: 40 },
      desc: 'Unarmed. Heals one wounded soldier at a time within 40 m, 4 HP/s, squadmates first.',
    },
    // 0.7c (DD J, "Patch 0.7c"): villagers, owner 3. Never trained, never auto-targeted.
    civilian: {
      name: 'Civilian', shape: 'circle', icon: 'civilian', cls: 'infantry', size: 4.5, role: 0, civilian: true,
      hp: 25, armor: 'none', speed: 38, vision: 80, cost: {}, time: 0, supply: 0,
      weapon: null,
      desc: 'A villager. Runs from fighting; nobody shoots at civilians on purpose.',
    },
  },

  BUILDINGS: {
    // garrison: slots for infantry (cap), squares (heavy) and machine gunners (mg), the height it adds,
    // and the occupants' accuracy multiplier. Scout Towers keep theirs per level.
    hq: { name: 'Headquarters', w: 64, h: 64, hp: 1500, icon: 'hq', produces: ['rifle', 'worker'], prodMult: { rifle: 0.7 },   // DD I: Riflemen at 0.7x, Workers at full speed
      garrison: { cap: 6, heavy: 0, height: 6 }, heal: { rate: 0.5, range: 150 },   // DD B, I: a last stand; heals infantry nearby
      cost: {}, buildTime: 0, vision: 220, desc: 'Your command post. Holds 6 infantry and heals infantry within 150 m. Lose it and the game is over.' },
    barracks: { name: 'Barracks', w: 48, h: 40, hp: 600, icon: 'circle', produces: ['rifle', 'hmg', 'sniper', 'medic'], cost: { wood: 80, metal: 20 }, buildTime: 30, vision: 120, desc: 'Trains infantry (circles).' },
    ordnance: { name: 'Ordnance Works', w: 52, h: 44, hp: 700, icon: 'square', produces: ['mortar'], cost: { wood: 60, metal: 60 }, buildTime: 40, vision: 120, desc: 'Builds mortars and other heavy weapons (squares).' },
    lumber: { name: 'Lumber Camp', w: 40, h: 32, hp: 350, icon: 'lumber', harvest: 'wood', rate: 1.0, perWorker: 0.6, maxWorkers: 4, cost: { wood: 40 }, buildTime: 20, vision: 100, needs: 'forest', desc: 'Place next to forest. Assign Workers (or soldiers, at half rate) to speed it up.' },
    mine: { name: 'Mine', w: 40, h: 36, hp: 400, icon: 'mine', harvest: 'deposit', rate: 0.5, perWorker: 0.35, maxWorkers: 4, cost: { wood: 70 }, buildTime: 25, vision: 100, needs: 'deposit', deposits: ['metal', 'sulfur'], desc: 'Place on a metal or sulfur deposit. Assign Workers (or soldiers, at half rate).' },
    // Patch 0.5a (DD B, G1, I, G14). (p) values proposed in DD B.
    rubber: { name: 'Rubber Tapper', w: 40, h: 32, hp: 350, icon: 'rubber', harvest: 'deposit', rate: 0.6, perWorker: 0.3, maxWorkers: 4, cost: { wood: 50 }, buildTime: 25, vision: 100, needs: 'deposit', deposits: ['rubber'], desc: 'Place on rubber trees. Assign Workers (or soldiers, at half rate).' },
    refinery: { name: 'Refinery', w: 60, h: 48, hp: 600, icon: 'refinery', harvest: 'deposit', rate: 1.0, perWorker: 0.4, maxWorkers: 4, cost: { wood: 100, metal: 80 }, buildTime: 40, vision: 100, needs: 'deposit', deposits: ['oil'], requires: 'refinery', desc: 'Place on an oil seep. Assign Workers (or soldiers, at half rate).' },
    workshop: { name: 'Workshop', w: 56, h: 44, hp: 700, icon: 'workshop', produces: ['truck'], cost: { wood: 80, metal: 60 }, buildTime: 40, vision: 120, desc: 'Builds Trucks, repairs vehicles within 60 m (5 HP/s, 1 metal per 10 HP) and retrofits Trucks. Engineering research (Tiers II and III).' },
    depot: { name: 'Depot', w: 48, h: 40, hp: 500, icon: 'depot', cost: { wood: 80, metal: 40 }, buildTime: 30, vision: 120, costGrow: 1.25, supply: true, trickle: { oil: 0.1 }, desc: '+10 supply and 0.1 oil/s. Logistics research (Tiers II and III). Each extra Depot costs 25% more.' },
    lab: { name: 'R&D Lab', w: 52, h: 44, hp: 600, icon: 'flask', cost: { wood: 100, metal: 80 }, buildTime: 45, vision: 120, desc: 'Needed for Tier III research in every branch. Researches the endless Truck upgrades.' },
    tower: {
      name: 'Scout Tower', w: 30, h: 30, hp: 400, icon: 'tower', cost: { wood: 60, metal: 10 }, buildTime: 25, vision: 200, tower: true,
      levels: [
        { cap: 2, heavy: 0, height: 8, hp: 400, vision: 200 },
        { cap: 4, heavy: 0, height: 14, hp: 650, vision: 240, cost: { wood: 80, metal: 30 }, time: 25 },
        { cap: 6, heavy: 1, height: 20, hp: 900, vision: 280, cost: { wood: 100, metal: 60 }, time: 30 },
      ],
      desc: 'Garrison infantry for height, sight and cover. Upgrade twice; level 3 also holds one mortar.',
    },
    // DD B. "+10 accuracy" is hit chance x1.1 (DD I). Vision proposed.
    bunker: { name: 'Bunker', w: 32, h: 32, hp: 1200, icon: 'bunker', cost: { wood: 120, metal: 90 }, buildTime: 45, vision: 160, requires: 'fortification',
      garrison: { cap: 4, heavy: 0, mg: 1, height: 0, acc: 1.1, grenadeReach: true },
      desc: 'Holds 4 infantry and a Machine Gunner in its own slot. Occupants shoot 10% more accurately. Grenades still reach them.' },
    // 0.7c buff sites (DD "Patch 0.7c"): neutral at the start, captured by standing there uncontested,
    // never damaged or targeted. flat: no footprint to walk around.
    airdrop: { name: 'Airdrop Zone', w: 36, h: 36, hp: 1000, icon: 'airdrop', site: 'airdrop', invulnerable: true, flat: true, cost: {}, buildTime: 0, vision: 120,
      desc: 'Hold it for a supply drop every 3 minutes: 40 wood, 60 metal, 15 sulfur.' },
    station: { name: 'Train Station', w: 56, h: 24, hp: 1000, icon: 'train', site: 'station', invulnerable: true, harvest: 'deposit', rate: 0, perWorker: 0, maxWorkers: 4, cost: {}, buildTime: 0, vision: 140,
      desc: 'Hold it and a freight train brings 150 metal every 4 minutes. Workers or Trucks carry it home, like a mine\'s output.' },
    radio: { name: 'Radio Mast', w: 14, h: 14, hp: 1000, icon: 'radio', site: 'radio', invulnerable: true, cost: {}, buildTime: 0, vision: 600,
      desc: 'Hold it for 600 m of sight and warnings when enemy troops come within 1.5 km of your HQ.' },
    fueldump: { name: 'Fuel Dump', w: 30, h: 22, hp: 1000, icon: 'oil', site: 'fueldump', invulnerable: true, trickle: { oil: 0.15 }, cost: {}, buildTime: 0, vision: 120,
      desc: 'Hold it for 0.15 oil/s; it refuels your vehicles within 60 m like a Depot.' },
    ruinhosp: { name: 'Field Hospital Ruins', w: 40, h: 32, hp: 1000, icon: 'hospital', site: 'ruinhosp', invulnerable: true, heal: { rate: 1, range: 120 }, cost: {}, buildTime: 0, vision: 120,
      desc: 'Hold it and your infantry within 120 m heal 1 HP/s.' },
    citadel: { name: 'Citadel', w: 64, h: 64, hp: 1000, icon: 'citadel', citadel: true, invulnerable: true, cost: {}, buildTime: 0, vision: 300,
      garrison: { cap: 10, heavy: 2, mg: 2, height: 10, acc: 1.15, grenadeReach: true },
      desc: 'A neutral fortress. Clear out its garrison and move in: it belongs to whoever is inside. Shells and grenades reach the occupants.' },
    hospital: { name: 'Field Hospital', w: 48, h: 40, hp: 500, icon: 'hospital', cost: { wood: 80, metal: 40 }, buildTime: 35, vision: 120, requires: 'hospital',
      heal: { rate: 1.5, range: 120 }, desc: 'Heals all your infantry within 120 m at 1.5 HP/s.' },
  },
  BUILD_LIST: ['lumber', 'mine', 'rubber', 'refinery', 'barracks', 'ordnance', 'workshop', 'depot', 'lab', 'tower', 'bunker', 'hospital'],
  // Kaan, 0.5a: these work only while the Build tab is open (press B first).
  BUILD_HOTKEYS: { lumber: 'L', mine: 'M', barracks: 'C', ordnance: 'O', tower: 'T', bunker: 'U', hospital: 'P', trench: 'Y', barricade: 'I', wire: 'J',
    workshop: 'K', depot: 'G', lab: 'R', rubber: 'Z', refinery: 'F', road: 'E', bridge: 'V' },

  // Line defences (DD B, G12, I, J), drawn by dragging and dug in 10 m segments. Each segment is paid
  // when digging on it starts (Kaan, for 0.4). hit: chance to be hit for units standing in it; stress:
  // stress taken there; slowEnemy / slowOwn: speed for infantry crossing it; hp: null = indestructible.
  LINES: {
    trench: { name: 'Trench', icon: 'trench', cost: { wood: 30 }, hit: 0.6, stress: 0.5, blast: 0.5,   // blast: explosion damage taken in it (Kaan, 0.4.1)
      slowEnemy: 0.4, slowOwn: 1, hp: null,
      desc: 'Soldiers in it are 40% harder to hit and take half stress and half blast damage. Enemies cross it at 0.4x speed. Cannot be destroyed; Workers fill it (K).' },
    barricade: { demolish: true, name: 'Barricade', icon: 'barricade', cost: { wood: 30, metal: 15 }, hit: 0.7, stress: 1, slowEnemy: 0.5, slowOwn: 0.5, hp: 200, requires: 'fortification',
      desc: 'Cover 0.7 for soldiers behind it. Every infantryman crosses at half speed. 200 HP per 10 m; explosives break it, rifles only chip it.' },
    wire: { demolish: true, name: 'Barbed Wire', icon: 'wire', cost: { metal: 20 }, hit: 1, stress: 1, slowEnemy: 0.25, slowOwn: 0.25, hp: 80, requires: 'fortification',
      desc: 'No cover, does not block fire. Every infantryman crosses at 0.25x speed. 80 HP per 10 m; only explosives cut it.' },
    // Kaan, 0.5a (proposed): Workers only; a finished segment becomes road (a bridge is road over water).
    road: { name: 'Road', icon: 'road', cost: { wood: 20 }, hit: 1, stress: 1, slowEnemy: 1, slowOwn: 1, hp: null, requires: 'roads', workersOnly: true, time: 10, becomesRoad: true,
      desc: 'Workers only. Roads are always walkable and faster (infantry x1.25). 10 s per 10 m.' },
    bridge: { name: 'Bridge', icon: 'bridge', cost: { wood: 40, metal: 20 }, hit: 1, stress: 1, slowEnemy: 1, slowOwn: 1, hp: null, requires: 'bridging', workersOnly: true, time: 20, becomesRoad: true, overWater: true, demolish: true,
      desc: 'Workers only, over water. A road across a river. 20 s per 10 m. Demolition Charges destroy it.' },
  },
  LINE_LIST: ['trench', 'barricade', 'wire', 'road', 'bridge'],
  // Kaan, 0.5a (proposed): Demolition Charges. Barricades, wire and bridges only.
  DEMOLITION: { time: 3, cost: { sulfur: 1 }, reach: 16 },   // targets: line types with demolish: true
  // Smoke Shells (DD F): a mortar round that blocks sight through a circle for 15 s (radius proposed).
  SMOKE: { radius: 35, time: 15 },
  // Patch 0.6 (DD H2, H3 and "Patch 0.6 details"). Times in game seconds.
  WEATHER: {
    first: 'clear', every: [600, 900], forecast: 60,
    mix: [['clear', 0.40], ['rain', 0.25], ['fog', 0.20], ['snow', 0.15]],
    kinds: {
      clear: { name: 'Clear', icon: '☀' },
      rain: { name: 'Rain', icon: '☂', infSpeed: 0.8, vehOffroad: 0.6, acc: 0.9, mortarScatter: 1.2 },
      fog: { name: 'Fog', icon: '≋', vision: 0.6, heightVision: 0.5 },
      snow: { name: 'Snow', icon: '❄', vision: 0.8, infSpeed: 0.8, vehOffroad: 0.7, dig: 0.7 },
    },
  },
  DAYNIGHT: { day: 600, night: 300, blend: 30, vision: 0.5, nightAt: 0.5, reveal: 3 },   // nightAt: darkness above which night rules apply
  FLARE: { radius: 150, time: 20, eye: 40, ammo: { sulfur: 1 } },
  SEARCHLIGHT: { range: 250, cone: 0.7, sweep: 120, period: 20, minLevel: 2 },   // cone width in radians, sweep in degrees
  // Digging: 15 s per 10 m for a soldier, Workers 1.5x (DD B); several diggers add up. A drawn line
  // with no infantry selected goes to idle Workers within 300 m (DD J). XP: 1 per 10 m dug (DD H1).
  DIG: { segment: 10, time: 15, workerMult: 1.5, idleWorkerRange: 300, maxPoints: 60, xpPerSegment: 1, smallArms: 0.1 },

  // DD C: thrown by Riflemen once researched, automatically at enemies in trenches or bunkers, or by order.
  // Bunker occupants take 30% damage and full stress (DD G13). Friendly fire is on (DD I).
  // Kaan, 0.4.1: grenades made harder to use: reach 35 -> 25 m, and the thrower stands still `windup` s first.
  GRENADE: { range: 25, dmg: 45, dtype: 'explosive', splash: 18, ammo: { sulfur: 1 }, cooldown: 20, bunkerDmg: 0.3, flight: 0.8, windup: 1,
    // Kaan, 0.4.2: throws are a little off. Scatter up to scatter + scatterPerM x distance metres (more
    // when stressed); badChance of throws go wide by a further badMin..badMax metres.
    scatter: 3, scatterPerM: 0.2, badChance: 0.15, badMin: 6, badMax: 14 },
  // DD I: healing sources add up, infantry only. Medic XP 1 per 20 HP healed (DD H1).
  HEAL: { medicXpPer: 20, tick: 0.5 },
  TRAIN_HOTKEYS: ['Z', 'X', 'C', 'V'],   // DD 9: Tab flips to the next four when a factory has more

  // Tech tree (DD F, patch 0.5a). branch: inf, fire, eng, log, med. Tier I is researched at the HQ,
  // Tiers II and III at the branch building (Data.BRANCHES), Tier III only while you own an R&D Lab.
  // One research slot per building type. tag: B blueprint (new units only), G global rule (applies
  // at once), U unlock. (p) costs and times are proposed.
  RESEARCH: {
    // 1 Infantry doctrine (Barracks)
    drill: { branch: 'inf', tier: 1, tag: 'B', name: 'Marksmanship Drill', cost: { wood: 80 }, time: 40, req: [], effects: [{ units: 'all', stat: 'acc', mult: 1.1 }], desc: '+10% accuracy for newly trained units.' },
    boots: { branch: 'inf', tier: 1, tag: 'B', name: 'Field Boots', cost: { wood: 70 }, time: 35, req: [], effects: [{ units: 'infantry', stat: 'speed', mult: 1.1 }], desc: '+10% speed for newly trained infantry.' },
    grenades: { branch: 'inf', tier: 1, tag: 'G', name: 'Grenades', icon: 'grenade', cost: { metal: 30, sulfur: 40 }, time: 40, req: [], desc: 'Riflemen throw grenades (1 sulfur each, 25 m, 1 s wind-up) at enemies in trenches and bunkers, or on order (V).' },
    hmg: { branch: 'inf', tier: 2, tag: 'U', name: 'Heavy Machine Gun', cost: { metal: 90 }, time: 60, req: [], unlock: 'hmg', desc: 'Unlocks Machine Gunners.' },
    sniper: { branch: 'inf', tier: 2, tag: 'U', name: 'Marksman Rifle', cost: { wood: 20, metal: 60 }, time: 50, req: [], unlock: 'sniper', desc: 'Unlocks Snipers.' },
    powder: { branch: 'inf', tier: 2, tag: 'B', name: 'Improved Powder', cost: { sulfur: 30, metal: 20 }, time: 40, req: [], effects: [{ units: 'firearms', stat: 'range', mult: 1.12 }], desc: '+12% range for newly trained firearm units.' },
    assault: { branch: 'inf', tier: 2, tag: 'G', name: 'Assault Drill', icon: 'rifle', cost: { wood: 60, metal: 80 }, time: 55, req: [], effects: [{ rule: 'movingAcc', set: 0.5 }], desc: 'Accuracy on the move 0.35 → 0.5 (Machine Gunners still cannot fire on the move).' },
    cohesion: { branch: 'inf', tier: 2, tag: 'G', name: 'Squad Cohesion', icon: 'circle', cost: { wood: 80, metal: 60 }, time: 55, req: [], effects: [{ rule: 'cohesionRadius', set: 60 }], desc: 'Squadmates steady each other within 60 m instead of 40 m.' },
    camo: { branch: 'inf', tier: 3, tag: 'B', name: 'Camouflage Uniforms', icon: 'sniper', cost: { wood: 100, metal: 120 }, time: 70, req: [], effects: [{ units: 'infantry', stat: 'camo', set: 0.7 }], desc: 'New infantry standing in forest are only spotted within 70% of the enemy\'s vision range.' },
    storm: { branch: 'inf', tier: 3, tag: 'B', name: 'Storm Troops', icon: 'grenade', cost: { metal: 60, sulfur: 80 }, time: 70, req: ['grenades'], effects: [{ units: ['rifle'], stat: 'nadeCooldown', set: 12 }], desc: 'Grenade cooldown 20 → 12 s for newly trained Riflemen.' },
    // 2 Fire support (Ordnance Works). Artillery and Counter-battery come in 0.8.
    mortar: { branch: 'fire', tier: 1, tag: 'U', name: 'Mortar', cost: { wood: 40, metal: 60 }, time: 50, req: [], unlock: 'mortar', desc: 'Unlocks Mortar Crews (needs sulfur for shells).' },
    shells: { branch: 'fire', tier: 2, tag: 'B', name: 'HE Shells', cost: { sulfur: 40, metal: 40 }, time: 45, req: ['mortar'], effects: [{ units: ['mortar'], stat: 'dmg', mult: 1.25 }], desc: '+25% mortar damage for new crews.' },
    smoke: { branch: 'fire', tier: 2, tag: 'G', name: 'Smoke Shells', icon: 'smoke', cost: { metal: 30, sulfur: 50 }, time: 50, req: ['mortar'], desc: 'Mortars can fire smoke (M) that blocks sight for 15 s.' },
    observers: { branch: 'fire', tier: 2, tag: 'G', name: 'Forward Observers', icon: 'mortar', cost: { wood: 60, metal: 80 }, time: 55, req: ['mortar'], effects: [{ rule: 'spotScatter', set: 0.7 }], desc: 'Shells aimed at a spotted point scatter 30% less.' },
    // 3 Engineering (Workshop)
    fortification: { branch: 'eng', tier: 1, tag: 'U', name: 'Fortification', icon: 'bunker', cost: { wood: 60, metal: 60 }, time: 45, req: [], desc: 'Unlocks the Bunker, barricades and barbed wire.' },
    entrenching: { branch: 'eng', tier: 1, tag: 'G', name: 'Entrenching Tools', icon: 'trench', cost: { wood: 60, metal: 20 }, time: 35, req: [], effects: [{ dig: 1.3 }], desc: 'Digging and building lines 30% faster, for every digger.' },
    roads: { branch: 'eng', tier: 2, tag: 'G', name: 'Road Building', icon: 'road', cost: { wood: 120, metal: 60 }, time: 60, req: [], desc: 'Workers lay roads (B then E): 20 wood per 10 m.' },
    concrete: { branch: 'eng', tier: 2, tag: 'G', name: 'Reinforced Concrete', icon: 'bunker', cost: { wood: 80, metal: 120 }, time: 60, req: ['fortification'], effects: [{ buildingHp: ['bunker', 'tower'], mult: 1.3 }], desc: 'Bunker and Scout Tower HP +30%, existing ones included.' },
    bridging: { branch: 'eng', tier: 3, tag: 'G', name: 'Bridging', icon: 'bridge', cost: { wood: 160, metal: 120 }, time: 80, req: ['roads'], desc: 'Workers build bridges over water (B then V): 40 wood, 20 metal per 10 m.' },
    demolition: { branch: 'eng', tier: 3, tag: 'G', name: 'Demolition Charges', icon: 'charge', cost: { metal: 80, sulfur: 80 }, time: 70, req: ['fortification'], desc: 'Infantry blow up barricades, wire and bridges (C): 3 s to set, 1 sulfur each. Trenches stay.' },
    // 4 Logistics (Depot). Motorisation comes with the Truck in 0.5b; Armoured Car and AP Rounds in 0.8.
    logistics: { branch: 'log', tier: 1, tag: 'G', name: 'Logistics', cost: { wood: 100, metal: 20 }, time: 50, req: [], effects: [{ harvest: 1.25 }], desc: '+25% harvest at every camp, mine, tapper and refinery.' },
    shafts: { branch: 'log', tier: 1, tag: 'G', name: 'Deep Shafts', icon: 'mine', cost: { wood: 80, metal: 40 }, time: 45, req: [], effects: [{ rule: 'mineWorkers', set: 6 }], desc: 'Mines take 6 workers instead of 4 (Mines only).' },
    motorisation: { branch: 'log', tier: 2, tag: 'U', name: 'Motorisation', icon: 'truck', cost: { wood: 60, metal: 80, rubber: 10 }, time: 50, req: [], unlock: 'truck', desc: 'Unlocks the Truck at the Workshop.' },
    supplyOrg: { branch: 'log', tier: 2, tag: 'G', name: 'Supply Organisation', icon: 'depot', cost: { wood: 100, metal: 80 }, time: 60, req: [], effects: [{ rule: 'perDepot', set: 15 }], desc: '+15 supply per Depot instead of +10.' },
    refinery: { branch: 'log', tier: 2, tag: 'U', name: 'Refinery', icon: 'refinery', cost: { wood: 80, metal: 100 }, time: 60, req: [], desc: 'Unlocks the Refinery, built on an oil seep.' },
    // 5 Command & medical (Field Hospital)
    medicine: { branch: 'med', tier: 1, tag: 'U', name: 'Field Medicine', cost: { wood: 40, metal: 40 }, time: 40, req: [], unlock: 'medic', desc: 'Unlocks Medics at the Barracks.' },
    hospital: { branch: 'med', tier: 1, tag: 'U', name: 'Field Hospital', icon: 'hospital', cost: { wood: 60, metal: 50 }, time: 45, req: ['medicine'], desc: 'Unlocks the Field Hospital building.' },
    triage: { branch: 'med', tier: 2, tag: 'G', name: 'Triage', icon: 'medic', cost: { wood: 50, metal: 70 }, time: 50, req: [], effects: [{ rule: 'triage', set: 2 }], desc: 'Medics heal soldiers under 50% health twice as fast.' },
    signals: { branch: 'med', tier: 2, tag: 'G', name: 'Signals', icon: 'signal', cost: { wood: 60, metal: 90 }, time: 60, req: [], desc: 'Enemies spotted in the last 30 s stay on the map as fading markers where they were last seen.' },
    // R&D Lab slot (DD A, F): endless Truck tracks. Each level costs 1.5x the last and makes new Trucks
    // 10% dearer; Heavy Armour (at Armour 5) removes the Engine speed gained so far.
    truckArmour: { branch: 'lab', tier: 2, tag: 'B', track: 'armour', name: 'Truck Armour', icon: 'truck', cost: { wood: 20, metal: 40 }, time: 40, req: ['motorisation'], desc: '+15% Truck HP per level.' },
    truckEngine: { branch: 'lab', tier: 2, tag: 'B', track: 'engine', name: 'Truck Engine', icon: 'truck', cost: { wood: 20, metal: 40 }, time: 40, req: ['motorisation'], desc: '+8% Truck speed per level.' },
    truckTank: { branch: 'lab', tier: 2, tag: 'B', track: 'tank', name: 'Truck Fuel Tank', icon: 'truck', cost: { wood: 20, metal: 40 }, time: 40, req: ['motorisation'], desc: '+20% fuel tank per level.' },
    truckHeavy: { branch: 'lab', tier: 2, tag: 'B', name: 'Heavy Truck Armour', icon: 'truck', cost: { wood: 20, metal: 40 }, time: 40, req: ['motorisation'], needsArmour: 5, desc: 'Needs Armour level 5. New Trucks get heavy armour, but lose all Engine speed gained so far; later Engine levels add speed again.' },
    // Patch 0.6 (DD H2, H3): night and weather research.
    nightTraining: { branch: 'inf', tier: 2, tag: 'B', name: 'Night Training', icon: 'sniper', cost: { wood: 60, metal: 60 }, time: 50, req: [], effects: [{ units: ['rifle', 'sniper'], stat: 'nightVision', set: 0.75 }], desc: 'Riflemen and Snipers trained afterwards keep 75% of their vision at night instead of 50%.' },
    snowGear: { branch: 'inf', tier: 2, tag: 'B', name: 'Snow Gear', icon: 'rifle', cost: { wood: 60, metal: 30 }, time: 40, req: [], effects: [{ units: 'infantry', stat: 'snowGear', set: true }], desc: 'Infantry trained afterwards are not slowed by snow.' },
    flares: { branch: 'fire', tier: 2, tag: 'G', name: 'Flares', icon: 'mortar', cost: { metal: 30, sulfur: 30 }, time: 45, req: [], desc: 'Mortar Crews can fire a flare (L): 1 sulfur, lights a 150 m circle for 20 s that your side can see.' },
    searchlights: { branch: 'eng', tier: 2, tag: 'G', name: 'Searchlights', icon: 'tower', cost: { wood: 60, metal: 60 }, time: 50, req: [], desc: 'Scout Towers of level 2 or more light a 250 m cone at night, sweeping towards the enemy. A lit tower is visible to the enemy; switch it off on its panel.' },
    mudTyres: { branch: 'log', tier: 2, tag: 'G', name: 'Mud Tyres', icon: 'truck', cost: { metal: 40, rubber: 10 }, time: 40, req: [], effects: [{ rule: 'mudTyres', set: true }], desc: 'Vehicles are not slowed off-road by rain.' },
    intelligence: { branch: 'med', tier: 3, tag: 'G', name: 'Intelligence', icon: 'signal', cost: { wood: 120, metal: 120 }, time: 80, req: ['signals'], desc: 'A warning when an enemy raid leaves its base.' },
  },
  RESEARCH_ORDER: ['drill', 'boots', 'grenades', 'hmg', 'sniper', 'powder', 'assault', 'cohesion', 'nightTraining', 'snowGear', 'camo', 'storm',
    'mortar', 'shells', 'smoke', 'observers', 'flares',
    'fortification', 'entrenching', 'roads', 'concrete', 'searchlights', 'bridging', 'demolition',
    'logistics', 'shafts', 'motorisation', 'supplyOrg', 'refinery', 'mudTyres',
    'medicine', 'hospital', 'triage', 'signals', 'intelligence',
    'truckArmour', 'truckEngine', 'truckTank', 'truckHeavy'],
  BRANCHES: {
    inf: { name: 'Infantry doctrine', building: 'barracks' },
    fire: { name: 'Fire support', building: 'ordnance' },
    eng: { name: 'Engineering', building: 'workshop' },
    log: { name: 'Logistics', building: 'depot' },
    med: { name: 'Command & medical', building: 'hospital' },
    lab: { name: 'Truck upgrades', building: 'lab' },   // the R&D Lab's own slot
  },
  BRANCH_ORDER: ['inf', 'fire', 'eng', 'log', 'med', 'lab'],
  TRUCK_TRACKS: { armour: { stat: 'hp', mult: 1.15 }, engine: { stat: 'speed', mult: 1.08 }, tank: { stat: 'fuel', mult: 1.2 }, costGrow: 1.5, priceGrow: 1.1, retrofitShare: 0.4 },
  // Fuel (DD Q7, I, J): per 100 m driven; Depots refuel within range for 1 oil per fuel; Trucks share
  // their spare fuel with vehicles nearby. Kaan, 0.5b: an empty tank crawls at emptySpeed.
  // Kaan, 0.5b.2: the HQ refuels too (refuelAt).
  FUEL: { refuelAt: ['depot', 'hq', 'fueldump'], road: 1, offRoad: 1.5, emptySpeed: 0.2, refuelRate: 10, depotRange: 60, oilPerFuel: 1, shareRange: 30, shareBelow: 0.5 },
  // Workshop repair (DD J): vehicles within range, 5 HP/s, 1 metal per 10 HP.
  REPAIR: { rate: 5, metalPerHp: 0.1, range: 60 },
  // Squad auto-carry (DD E, G4): moves longer than this ride in the squadron's Truck; the rest march.
  FERRY: { minDist: 600, boardWait: 10 },
  // DD K: Cold War kit for newly trained soldiers once you own an R&D Lab and have 2 Tier III items (proposed).
  KIT: { coldTier3: 2, modernTier3: 5 },   // 0.7c: Modern kit at an R&D Lab + 5 Tier III
  // 0.7c (DD "Patch 0.7c"; values proposed). Buff sites, citadels, villages, props, neutral patrols.
  SITES: {
    capture: { r: 60, time: 20, drain: 40 },
    airdrop: { every: 180, drop: { wood: 40, metal: 60, sulfur: 15 } },
    station: { every: 240, metal: 150, cap: 450 },
    radio: { warnR: 1500, min: 3, every: 60 },
    counts: { airdrop: 1, station: 1, radio: 2, fueldump: 2, ruinhosp: 2 }, citadels: [1, 2],
    fromBase: 1500, apart: 700,
  },
  VILLAGES: { hamlets: [3, 5], hamletHouses: [4, 6], hamletPeople: [6, 10], towns: [1, 2], townHouses: [8, 12], townPeople: [15, 25] },
  CIVILIANS: { owner: 3, stroll: 50, danger: 150, run: 250, wait: 30 },
  // Prop codes in Terrain.prop: 1 house, 2 ruin, 3 wall, 4 wreck. cover: hit chance; slow: infantry speed.
  PROPS: { 1: { name: 'house', cover: 0.6, slow: 0.7 }, 2: { name: 'ruin', cover: 0.6, slow: 0.7 }, 3: { name: 'wall', cover: 0.7, slow: 0.8 }, 4: { name: 'wreck', cover: 0.7, slow: 0.8 },
    counts: { ruins: 25, walls: 30, wrecks: 20 } },
  NEUTRAL: { leash: 150, patrol: { r: 120, every: [60, 120] }, heal: { rate: 1, quiet: 20 } },
  AI_SITES: { every: 300, minArmy: 10, size: 4, maxSize: 10, keepHome: 4, reach: 4000 },   // team: 2 per guard there plus 2, at least 4, at most 10
  // DD Q18, G14: supply cap. AI sides are exempt while the AI stays scripted (DD Q23).
  SUPPLY: { start: 30, perDepot: 10 },

  DEPOSIT_NAMES: { metal: 'Iron ore', sulfur: 'Sulfur', rubber: 'Rubber trees', oil: 'Oil seep' },

  // Enemy commander settings per difficulty. 'hard' is the original tuning.
  // DD Q2: first raid = the enemy's walking time to the player's HQ + buildUp (Kaan, 0.5c: 8 / 5 / 3.5 min by difficulty); each raid interval
  // also adds that walking time. DD G7: game seconds at which the AI may train each unit; Normal
  // uses the agreed 8 / 12 / 15 min, Easy x1.25 and Hard x0.75 (proposed, set in 0.2.1).
  DIFFICULTY: {
    easy: { name: 'Easy', desc: 'Small garrison, rare small raids, slow enemy production.', cap: 8, capGrow: 1, buildUp: 480, raidMin: 320, raidVar: 120, raidFrac: 0.4, garrison: 6, income: 0.6, unlocks: { hmg: 600, sniper: 900, mortar: 1125 }, researchMult: 1.5, harassEvery: 0, digIn: false },
    normal: { name: 'Normal', desc: 'Moderate garrison and raids every few minutes.', cap: 11, capGrow: 2, buildUp: 300, raidMin: 220, raidVar: 100, raidFrac: 0.5, garrison: 9, income: 0.8, unlocks: { hmg: 480, sniper: 720, mortar: 900 }, researchMult: 1, harassEvery: 240, digIn: true },
    hard: { name: 'Hard', desc: 'Full garrison on the mountain and frequent large raids.', cap: 14, capGrow: 2, buildUp: 210, raidMin: 150, raidVar: 90, raidFrac: 0.55, garrison: 12, income: 1, unlocks: { hmg: 360, sniper: 540, mortar: 675 }, researchMult: 0.75, harassEvery: 150, digIn: true },
  },
  DIFFICULTY_ORDER: ['easy', 'normal', 'hard'],

  // Raid escalation (agreed with Kaan on 28 Sept to end AI-v-AI stalemates; the full DD Q24 raid logic
  // comes in 0.7): each raid sends raidGrow more of the army than the last, up to raidFracMax; once
  // the army is allInRatio times the enemy soldiers seen in the last `memory` seconds, everyone goes.
  AI_RAIDS: { raidGrow: 0.1, raidFracMax: 0.9, allInRatio: 2, memory: 120, minEnemy: 3 },
  // Patch 0.7d, siege raids (DD Q24, "Patch 0.7d"; values proposed): towers first, then the weakest
  // outpost towards the HQ, then the HQ. Outposts count only near the HQ or the line between the bases.
  AI_SIEGE: { nearHq: 2000, corridor: 1200, threatR: 500, threatShare: 0.8, defenderWeight: 150, defenderR: 200 },

  // Patch 0.5d, a smarter enemy (DESIGN_DECISIONS "Patch 0.5d", all proposed). Research times are game
  // seconds on Normal, scaled by DIFFICULTY.researchMult; harassment by DIFFICULTY.harassEvery.
  AI_SMART: {
    retreatHp: 0.4, rejoinHp: 0.8,
    garrisonRange: 480, garrisonLinger: 30,
    dig: { seen: 900, minGroup: 4, len: 120, tryDist: [110, 150, 190, 80], minCells: 5, diggers: 6, every: 300, early: 60, giveUp: 120 },   // early: dig this long before the first raid leaves; the distance with the most diggable ground wins
    research: [['drill', 360], ['grenades', 480], ['entrenching', 540], ['boots', 600], ['powder', 780], ['shells', 900], ['cohesion', 1080], ['nightTraining', 1200], ['snowGear', 1320], ['storm', 1500]],
    harass: { size: 3, minArmy: 8, memory: 300, scoutDeposits: 5 },   // with nothing seen, check the 5 nearest deposits in turn
  },

  // Squadrons (DD E). role: 1 front rank, 2 second rank, 3 rear at a safe distance, 0 support in the
  // centre. Spacing in metres; cohesion: stress decays faster within cohesionRadius of a squadmate.
  SQUAD: {
    min: 2, max: 12, spacing: { tight: 15, loose: 25 }, rearDepth: 60,
    cohesionRadius: 40, cohesionDecay: 0.08,
    leaderRadius: 60, leaderAura: 1.2, leaderDeathShock: 0.3,   // DD H1, I: replaces the normal +0.2 death shock
    coverTime: 4,                                               // fighting withdrawal: the front rank covers this long
    reactHalts: false,                                          // Kaan: 'react' shares the target but does not halt the squad (a halt made squads win ~77%)
    shareRange: 1.0,                                            // take the squad's target only if within this x own nearest enemy's distance
    defaults: { move: 'slow', spacing: 'loose', contact: 'react', autoFall: false },
    autoFall: { lost: 0.5, pinned: 0.6, recent: 5, cooldown: 60 },   // 0.7b: fall back at half strength or 60% pinned, at most once a minute
  },
  // Patch 0.7b, living infantry (DD "Patch 0.7b"; values proposed). Soldiers look after themselves when
  // they have no player order to carry out.
  BEHAVIOUR: {
    every: 0.5,                                        // seconds between a soldier's checks
    team: 60,                                          // loose soldiers within this distance are a team
    gap: { tight: 10, loose: 18, alone: 12 }, gapMarching: 0.8,   // personal space; x0.8 while marching on a move order
    shellSpread: { r: 40, mult: 1.5, time: 20 },       // a shell within 40 m: gap x1.5 for 20 s
    wounded: { below: 0.4, healthy: 0.6, need: 2, back: 25, speed: 0.6 },
    support: { recent: 3, range: 0.85, maxWalk: 150 },
    cover: { cells: 3, every: 8, recent: 5 },
    post: { quiet: 15, away: 20 },
    medic: { below: 0.4, reach: 300, healed: 0.8 },
  },
  // Veterancy (DD H1, I; XP values proposed). Each rank stacks on the previous one.
  VETERANCY: {
    ranks: [30, 80, 160],
    perRank: { acc: 1.05, stressTaken: 0.9, hp: 1.05, work: 1.1 }, rank3Reload: 0.9,
    xp: { kill: 10, damagePer: 10, suppress: 5, suppressCooldown: 30, underFireEvery: 10, underFireStress: 0.3, workEvery: 60 },
  },

  START: { units: ['rifle', 'rifle', 'rifle', 'rifle', 'rifle', 'rifle', 'worker', 'worker', 'worker', 'worker'], res: { wood: 400, metal: 20 } },   // DD Q15; metal 60 -> 20 (Kaan, 0.5a.1)

  // Combat constants (formulas in game.js). DD Q8, Q9, Q10, Q11, I.
  COMBAT: {
    deadZone: 3,                                        // height differences under this give no bonus or penalty
    rangeUp: 0.04, rangeUpMax: 0.5,                     // range x(1 + 0.04 sqrt(dh)), at most +50%
    rangeDown: 0.03, rangeDownMax: 0.2,                 // uphill x(1 - 0.03 sqrt(|dh|)), at most -20%
    indirectRangeShare: 0.5, indirectRangeMax: 0.25,    // mortars get half the height range bonus, at most +25%
    // Damage and hit chance x(1 + clamp(k s)), s = dh / max(d, 20). Softened with Kaan on 28 Sept (DD L)
    // from 0.5 / -0.1..+0.25 and 0.4 / -0.1..+0.2, which made high ground win 91% of 5 v 5 duels.
    dmgSteep: 0.1, dmgMin: -0.03, dmgMax: 0.06,
    hitSteep: 0.08, hitMin: -0.03, hitMax: 0.05,
    steepMinDist: 20,
    stressDecay: 0.06, retreatDecayMult: 2,             // per second; retreating units shed stress twice as fast
    suppressedAt: 0.6, panicAt: 0.95,
    movingAcc: 0.35,                                    // accuracy multiplier when firing on the move
  },
  // DD I: every bonus and penalty multiplies, then these caps apply (Util.stack).
  // Kaan, 0.5b.3: vision along a clear line reaches farther the further the ground drops below the eye,
  // like weapon range (DD Q8): x(1 + perSqrt * sqrt(drop)), at most +max; drops under deadZone count as flat.
  // It comes on top of the flat bonus for standing high (Fog.visionRadius).
  VISION: { perSqrt: 0.04, max: 0.5, deadZone: 3 },
  // Kaan, 0.5b.2: idle soldiers shot from beyond their reach attack-move at the shooter (at most every `every` s).
  RETURN_FIRE: { every: 5, join: 60 },
  ALERT: { every: 20, area: 400 },   // 0.5c: one "under attack" alert per 400 m area per 20 s of quiet
  CAPS: { hit: { max: 0.95 }, stressTaken: { min: 0.25 }, speed: { min: 0.2 }, vision: { min: 0.35 } },
  // Supply chains (Kaan, 0.5a.2, 0.5a.3): gatherers fill their own stock; assigned people carry loads
  // along the building's supply link (a Depot the player picked, or the HQ). Depots link to the HQ or
  // to a chosen Depot; enemies within cutRange of a Depot line cut it. aiCarriers: Workers the enemy
  // commander keeps on each of its mines. Times in game seconds.
  LOGISTICS: { load: 10, soldierLoad: 5, stockCap: 100, cutRange: 20, replan: 5, cutCheck: 1, loadWait: 4, truckWait: 20, aiCarriers: 2 },   // truckWait: a Truck waits longer for a full load
  ECONOMY: { soldierLabour: 0.5, pace: 0.7 },   // Kaan, 0.5a.1: a slower game. Every harvest rate and the AI's passive income x0.7                      // DD Q4: a soldier at a camp counts as half a Worker
};
