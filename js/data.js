'use strict';
// All static game data: resources, damage model, unit blueprints, buildings, research, difficulty, hotkeys.
// Times are game seconds (the loop runs them at half real time at 1x). Speeds are world units per game second.
// TODO(patch 0.3): truck / armoredcar blueprints (shape 'rect' / 'tri', cls 'vehicle', capacity, rubber and oil costs); refinery and rubber camp buildings.
// TODO(patch 0.5): 'rpg', 'artillery' and 'emp' weapons; ap damage type is already in ARMOR_MULT.
const Data = {
  RES: ['wood', 'metal', 'rubber', 'oil', 'sulfur'],
  RES_COLORS: { wood: '#a86b32', metal: '#8fa2b5', rubber: '#555', oil: '#3a3a3a', sulfur: '#e0c020' },

  PLAYER_COLORS: { 0: '#7a7a7a', 1: '#2458d6', 2: '#c8302e' },
  PLAYER_NAMES: { 0: 'Neutral', 1: 'You', 2: 'Highland Army' },

  // damage type -> armor class -> multiplier
  ARMOR_MULT: {
    ballistic: { none: 1.0, light: 0.35, heavy: 0.08, building: 0.15 },
    explosive: { none: 1.0, light: 0.7, heavy: 0.35, building: 0.9 },
    ap: { none: 0.6, light: 1.0, heavy: 0.9, building: 0.5 },
  },

  MOVE_CLASSES: {
    infantry: { maxGrade: 0.8, forest: 0.65, swamp: 0.45, road: 1.25 },
    vehicle: { maxGrade: 0.4, forest: 0.3, swamp: 0.15, road: 1.5 },
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
      hp: 80, armor: 'none', speed: 38, vision: 160, cost: { wood: 10, metal: 35 }, time: 14, supply: 1, requires: 'hmg', noMovingFire: true,   // DD Q11: cannot fire on the move
      weapon: { dmg: 11, dtype: 'ballistic', range: 200, minRange: 0, acc: 0.4, reload: 0.18, pspeed: 900, indirect: false, splash: 0, suppress: 0.035 },
      desc: 'Sustained fire. Pins enemies down and shreds infantry in the open.',
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
      weapon: { dmg: 50, dtype: 'explosive', range: 380, minRange: 90, acc: 0.5, reload: 5, pspeed: 200, indirect: true, splash: 32, suppress: 0.35, ammo: { sulfur: 2 } },
      desc: 'Indirect fire over ridges. Costs sulfur per shell. Needs a spotter to be accurate.',
    },
    // DD A: heals one unit at a time, squadmates first (DD E). Speed, vision, cost and time proposed.
    medic: {
      name: 'Medic', shape: 'circle', icon: 'medic', cls: 'infantry', size: 5.5, role: 0,
      hp: 50, armor: 'none', speed: 50, vision: 140, cost: { wood: 20, metal: 15 }, time: 10, supply: 1, requires: 'medicine',
      weapon: null, heal: { rate: 4, range: 40 },
      desc: 'Unarmed. Heals one wounded soldier at a time within 40 m, 4 HP/s, squadmates first.',
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
    mine: { name: 'Mine', w: 40, h: 36, hp: 400, icon: 'mine', harvest: 'deposit', rate: 0.5, perWorker: 0.35, maxWorkers: 4, cost: { wood: 60, metal: 10 }, buildTime: 25, vision: 100, needs: 'deposit', deposits: ['metal', 'sulfur'], desc: 'Place on a metal or sulfur deposit. Assign Workers (or soldiers, at half rate).' },
    // Patch 0.5a (DD B, G1, I, G14). (p) values proposed in DD B.
    rubber: { name: 'Rubber Tapper', w: 40, h: 32, hp: 350, icon: 'rubber', harvest: 'deposit', rate: 0.6, perWorker: 0.3, maxWorkers: 4, cost: { wood: 50 }, buildTime: 25, vision: 100, needs: 'deposit', deposits: ['rubber'], desc: 'Place on rubber trees. Assign Workers (or soldiers, at half rate).' },
    refinery: { name: 'Refinery', w: 60, h: 48, hp: 600, icon: 'refinery', harvest: 'deposit', rate: 1.0, perWorker: 0.4, maxWorkers: 4, cost: { wood: 100, metal: 80 }, buildTime: 40, vision: 100, needs: 'deposit', deposits: ['oil'], requires: 'refinery', desc: 'Place on an oil seep. Assign Workers (or soldiers, at half rate).' },
    workshop: { name: 'Workshop', w: 56, h: 44, hp: 700, icon: 'workshop', cost: { wood: 80, metal: 60 }, buildTime: 40, vision: 120, desc: 'Engineering research (Tiers II and III). Builds and repairs vehicles once they arrive (0.5b).' },
    depot: { name: 'Depot', w: 48, h: 40, hp: 500, icon: 'depot', cost: { wood: 80, metal: 40 }, buildTime: 30, vision: 120, costGrow: 1.25, supply: true, trickle: { oil: 0.1 }, desc: '+10 supply and 0.1 oil/s. Logistics research (Tiers II and III). Each extra Depot costs 25% more.' },
    lab: { name: 'R&D Lab', w: 52, h: 44, hp: 600, icon: 'flask', cost: { wood: 100, metal: 80 }, buildTime: 45, vision: 120, desc: 'Needed for Tier III research in every branch. Truck upgrades arrive in 0.5b.' },
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
    boots: { branch: 'inf', tier: 1, tag: 'B', name: 'Field Boots', cost: { wood: 70 }, time: 35, req: [], effects: [{ units: 'all', stat: 'speed', mult: 1.1 }], desc: '+10% speed for newly trained infantry.' },
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
    supplyOrg: { branch: 'log', tier: 2, tag: 'G', name: 'Supply Organisation', icon: 'depot', cost: { wood: 100, metal: 80 }, time: 60, req: [], effects: [{ rule: 'perDepot', set: 15 }], desc: '+15 supply per Depot instead of +10.' },
    refinery: { branch: 'log', tier: 2, tag: 'U', name: 'Refinery', icon: 'refinery', cost: { wood: 80, metal: 100 }, time: 60, req: [], desc: 'Unlocks the Refinery, built on an oil seep.' },
    // 5 Command & medical (Field Hospital)
    medicine: { branch: 'med', tier: 1, tag: 'U', name: 'Field Medicine', cost: { wood: 40, metal: 40 }, time: 40, req: [], unlock: 'medic', desc: 'Unlocks Medics at the Barracks.' },
    hospital: { branch: 'med', tier: 1, tag: 'U', name: 'Field Hospital', icon: 'hospital', cost: { wood: 60, metal: 50 }, time: 45, req: ['medicine'], desc: 'Unlocks the Field Hospital building.' },
    triage: { branch: 'med', tier: 2, tag: 'G', name: 'Triage', icon: 'medic', cost: { wood: 50, metal: 70 }, time: 50, req: [], effects: [{ rule: 'triage', set: 2 }], desc: 'Medics heal soldiers under 50% health twice as fast.' },
    signals: { branch: 'med', tier: 2, tag: 'G', name: 'Signals', icon: 'signal', cost: { wood: 60, metal: 90 }, time: 60, req: [], desc: 'Enemies spotted in the last 30 s stay on the map as fading markers where they were last seen.' },
    intelligence: { branch: 'med', tier: 3, tag: 'G', name: 'Intelligence', icon: 'signal', cost: { wood: 120, metal: 120 }, time: 80, req: ['signals'], desc: 'A warning when an enemy raid leaves its base.' },
  },
  RESEARCH_ORDER: ['drill', 'boots', 'grenades', 'hmg', 'sniper', 'powder', 'assault', 'cohesion', 'camo', 'storm',
    'mortar', 'shells', 'smoke', 'observers',
    'fortification', 'entrenching', 'roads', 'concrete', 'bridging', 'demolition',
    'logistics', 'shafts', 'supplyOrg', 'refinery',
    'medicine', 'hospital', 'triage', 'signals', 'intelligence'],
  BRANCHES: {
    inf: { name: 'Infantry doctrine', building: 'barracks' },
    fire: { name: 'Fire support', building: 'ordnance' },
    eng: { name: 'Engineering', building: 'workshop' },
    log: { name: 'Logistics', building: 'depot' },
    med: { name: 'Command & medical', building: 'hospital' },
  },
  BRANCH_ORDER: ['inf', 'fire', 'eng', 'log', 'med'],
  // DD K: Cold War kit for newly trained soldiers once you own an R&D Lab and have 2 Tier III items (proposed).
  KIT: { coldTier3: 2 },
  // DD Q18, G14: supply cap. AI sides are exempt while the AI stays scripted (DD Q23).
  SUPPLY: { start: 30, perDepot: 10 },

  DEPOSIT_NAMES: { metal: 'Iron ore', sulfur: 'Sulfur', rubber: 'Rubber trees', oil: 'Oil seep' },

  // Enemy commander settings per difficulty. 'hard' is the original tuning.
  // DD Q2: first raid = the enemy's walking time to the player's HQ + buildUp; each raid interval
  // also adds that walking time. DD G7: game seconds at which the AI may train each unit; Normal
  // uses the agreed 8 / 12 / 15 min, Easy x1.25 and Hard x0.75 (proposed, set in 0.2.1).
  DIFFICULTY: {
    easy: { name: 'Easy', desc: 'Small garrison, rare small raids, slow enemy production.', cap: 8, capGrow: 1, buildUp: 300, raidMin: 320, raidVar: 120, raidFrac: 0.4, garrison: 6, income: 0.6, unlocks: { hmg: 600, sniper: 900, mortar: 1125 } },
    normal: { name: 'Normal', desc: 'Moderate garrison and raids every few minutes.', cap: 11, capGrow: 2, buildUp: 300, raidMin: 220, raidVar: 100, raidFrac: 0.5, garrison: 9, income: 0.8, unlocks: { hmg: 480, sniper: 720, mortar: 900 } },
    hard: { name: 'Hard', desc: 'Full garrison on the mountain and frequent large raids.', cap: 14, capGrow: 2, buildUp: 300, raidMin: 150, raidVar: 90, raidFrac: 0.55, garrison: 12, income: 1, unlocks: { hmg: 360, sniper: 540, mortar: 675 } },
  },
  DIFFICULTY_ORDER: ['easy', 'normal', 'hard'],

  // Raid escalation (agreed with Kaan on 28 Sept to end AI-v-AI stalemates; the full DD Q24 raid logic
  // comes in 0.7): each raid sends raidGrow more of the army than the last, up to raidFracMax; once
  // the army is allInRatio times the enemy soldiers seen in the last `memory` seconds, everyone goes.
  AI_RAIDS: { raidGrow: 0.1, raidFracMax: 0.9, allInRatio: 2, memory: 120, minEnemy: 3 },

  // Squadrons (DD E). role: 1 front rank, 2 second rank, 3 rear at a safe distance, 0 support in the
  // centre. Spacing in metres; cohesion: stress decays faster within cohesionRadius of a squadmate.
  SQUAD: {
    min: 2, max: 12, spacing: { tight: 15, loose: 25 }, rearDepth: 60,
    cohesionRadius: 40, cohesionDecay: 0.08,
    leaderRadius: 60, leaderAura: 1.2, leaderDeathShock: 0.3,   // DD H1, I: replaces the normal +0.2 death shock
    coverTime: 4,                                               // fighting withdrawal: the front rank covers this long
    reactHalts: false,                                          // Kaan: 'react' shares the target but does not halt the squad (a halt made squads win ~77%)
    shareRange: 1.0,                                            // take the squad's target only if within this x own nearest enemy's distance
    defaults: { move: 'slow', spacing: 'loose', contact: 'react' },
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
  CAPS: { hit: { max: 0.95 }, stressTaken: { min: 0.25 }, speed: { min: 0.2 }, vision: { min: 0.35 } },
  ECONOMY: { soldierLabour: 0.5, pace: 0.7 },   // Kaan, 0.5a.1: a slower game. Every harvest rate and the AI's passive income x0.7                      // DD Q4: a soldier at a camp counts as half a Worker
};
