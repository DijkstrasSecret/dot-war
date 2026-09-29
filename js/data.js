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
      hp: 70, armor: 'none', speed: 52, vision: 160, cost: { wood: 12, metal: 10 }, time: 10,
      weapon: { dmg: 20, dtype: 'ballistic', range: 170, minRange: 0, acc: 0.68, reload: 1.5, pspeed: 900, indirect: false, splash: 0, suppress: 0.08 },
      grenade: true,   // throws Data.GRENADE once the Grenades research is done
      desc: 'Standard infantry. Good range and accuracy. Throws grenades once researched.',
    },
    hmg: {
      name: 'Machine Gunner', shape: 'circle', icon: 'hmg', cls: 'infantry', size: 6.5, role: 2,
      hp: 80, armor: 'none', speed: 38, vision: 160, cost: { wood: 10, metal: 35 }, time: 14, requires: 'hmg', noMovingFire: true,   // DD Q11: cannot fire on the move
      weapon: { dmg: 11, dtype: 'ballistic', range: 200, minRange: 0, acc: 0.4, reload: 0.18, pspeed: 900, indirect: false, splash: 0, suppress: 0.035 },
      desc: 'Sustained fire. Pins enemies down and shreds infantry in the open.',
    },
    sniper: {
      name: 'Sniper', shape: 'circle', icon: 'sniper', cls: 'infantry', size: 6, role: 2,
      hp: 55, armor: 'none', speed: 48, vision: 230, cost: { wood: 10, metal: 25 }, time: 14, requires: 'sniper',
      stressTaken: 0.5, neverPanics: true, obeysWhenSuppressed: true,   // DD Q12, I: half stress, never panics, can be suppressed but keeps its orders
      weapon: { dmg: 65, dtype: 'ballistic', range: 300, minRange: 0, acc: 0.85, reload: 3.5, pspeed: 1300, indirect: false, splash: 0, suppress: 0.25 },
      desc: 'Long sight and reach. Takes half stress, never panics, keeps its target orders even when suppressed.',
    },
    mortar: {
      name: 'Mortar Crew', shape: 'square', icon: 'mortar', cls: 'infantry', size: 7, role: 3,
      hp: 70, armor: 'none', speed: 34, vision: 140, cost: { wood: 20, metal: 40 }, time: 16, requires: 'mortar',
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
    mine: { name: 'Mine', w: 40, h: 36, hp: 400, icon: 'mine', harvest: 'deposit', rate: 0.5, perWorker: 0.35, maxWorkers: 4, cost: { wood: 60, metal: 10 }, buildTime: 25, vision: 100, needs: 'deposit', desc: 'Place on a metal or sulfur deposit. Assign Workers (or soldiers, at half rate).' },
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
  BUILD_LIST: ['lumber', 'mine', 'barracks', 'ordnance', 'tower', 'bunker', 'hospital'],
  BUILD_HOTKEYS: { lumber: 'L', mine: 'M', barracks: 'C', ordnance: 'O', tower: 'T', bunker: 'U', hospital: 'P', trench: 'Y', barricade: 'I', wire: 'J' },

  // Line defences (DD B, G12, I, J), drawn by dragging and dug in 10 m segments. Each segment is paid
  // when digging on it starts (Kaan, for 0.4). hit: chance to be hit for units standing in it; stress:
  // stress taken there; slowEnemy / slowOwn: speed for infantry crossing it; hp: null = indestructible.
  LINES: {
    trench: { name: 'Trench', icon: 'trench', cost: { wood: 30 }, hit: 0.6, stress: 0.5, blast: 0.5,   // blast: explosion damage taken in it (Kaan, 0.4.1)
      slowEnemy: 0.4, slowOwn: 1, hp: null,
      desc: 'Soldiers in it are 40% harder to hit and take half stress and half blast damage. Enemies cross it at 0.4x speed. Cannot be destroyed; Workers fill it (K).' },
    barricade: { name: 'Barricade', icon: 'barricade', cost: { wood: 30, metal: 15 }, hit: 0.7, stress: 1, slowEnemy: 0.5, slowOwn: 0.5, hp: 200, requires: 'fortification',
      desc: 'Cover 0.7 for soldiers behind it. Every infantryman crosses at half speed. 200 HP per 10 m; explosives break it, rifles only chip it.' },
    wire: { name: 'Barbed Wire', icon: 'wire', cost: { metal: 20 }, hit: 1, stress: 1, slowEnemy: 0.25, slowOwn: 0.25, hp: 80, requires: 'fortification',
      desc: 'No cover, does not block fire. Every infantryman crosses at 0.25x speed. 80 HP per 10 m; only explosives cut it.' },
  },
  LINE_LIST: ['trench', 'barricade', 'wire'],
  // Digging: 15 s per 10 m for a soldier, Workers 1.5x (DD B); several diggers add up. A drawn line
  // with no infantry selected goes to idle Workers within 300 m (DD J). XP: 1 per 10 m dug (DD H1).
  DIG: { segment: 10, time: 15, workerMult: 1.5, idleWorkerRange: 300, maxPoints: 60, xpPerSegment: 1, smallArms: 0.1 },

  // DD C: thrown by Riflemen once researched, automatically at enemies in trenches or bunkers, or by order.
  // Bunker occupants take 30% damage and full stress (DD G13). Friendly fire is on (DD I).
  // Kaan, 0.4.1: grenades made harder to use: reach 35 -> 25 m, and the thrower stands still `windup` s first.
  GRENADE: { range: 25, dmg: 45, dtype: 'explosive', splash: 18, ammo: { sulfur: 1 }, cooldown: 20, bunkerDmg: 0.3, flight: 0.8, windup: 1 },
  // DD I: healing sources add up, infantry only. Medic XP 1 per 20 HP healed (DD H1).
  HEAL: { medicXpPer: 20, tick: 0.5 },
  TRAIN_HOTKEYS: ['Z', 'X', 'C', 'V'],   // DD 9: Tab flips to the next four when a factory has more

  RESEARCH: {
    // DD Q1: Rifling is done for every player at the start, so it is no longer an item.
    drill: { name: 'Marksmanship Drill', cost: { wood: 80 }, time: 40, req: [], effects: [{ units: 'all', stat: 'acc', mult: 1.1 }], desc: '+10% accuracy for newly trained units.' },
    logistics: { name: 'Logistics', cost: { wood: 100, metal: 20 }, time: 50, req: [], effects: [{ harvest: 1.25 }], desc: '+25% harvest rate.' },
    boots: { name: 'Field Boots', cost: { wood: 70 }, time: 35, req: [], effects: [{ units: 'all', stat: 'speed', mult: 1.1 }], desc: '+10% speed for newly trained infantry.' },
    hmg: { name: 'Heavy Machine Gun', cost: { metal: 90 }, time: 60, req: [], unlock: 'hmg', desc: 'Unlocks Machine Gunners.' },
    sniper: { name: 'Marksman Rifle', cost: { wood: 20, metal: 60 }, time: 50, req: [], unlock: 'sniper', desc: 'Unlocks Snipers.' },
    mortar: { name: 'Mortar', cost: { wood: 40, metal: 60 }, time: 50, req: [], unlock: 'mortar', desc: 'Unlocks Mortar Crews (needs sulfur for shells).' },
    powder: { name: 'Improved Powder', cost: { sulfur: 30, metal: 20 }, time: 40, req: [], effects: [{ units: 'firearms', stat: 'range', mult: 1.12 }], desc: '+12% range for newly trained firearm units.' },
    shells: { name: 'HE Shells', cost: { sulfur: 40, metal: 40 }, time: 45, req: ['mortar'], effects: [{ units: ['mortar'], stat: 'dmg', mult: 1.25 }], desc: '+25% mortar damage for new crews.' },
    // Patch 0.4, on the HQ list until the tech tree arrives in 0.5 (DD F). (p) values from DD F.
    fortification: { name: 'Fortification', icon: 'bunker', cost: { wood: 60, metal: 60 }, time: 45, req: [], desc: 'Unlocks the Bunker, barricades and barbed wire.' },
    entrenching: { name: 'Entrenching Tools', icon: 'trench', cost: { wood: 60, metal: 20 }, time: 35, req: [], effects: [{ dig: 1.3 }], desc: 'Digging 30% faster, for every digger.' },
    grenades: { name: 'Grenades', icon: 'grenade', cost: { metal: 30, sulfur: 40 }, time: 40, req: [], desc: 'Riflemen throw grenades (1 sulfur each, 25 m, 1 s wind-up) at enemies in trenches and bunkers, or on order (V).' },
    medicine: { name: 'Field Medicine', cost: { wood: 40, metal: 40 }, time: 40, req: [], unlock: 'medic', desc: 'Unlocks Medics at the Barracks.' },
    hospital: { name: 'Field Hospital', icon: 'hospital', cost: { wood: 60, metal: 50 }, time: 45, req: ['medicine'], desc: 'Unlocks the Field Hospital building.' },
  },
  RESEARCH_ORDER: ['drill', 'logistics', 'boots', 'hmg', 'sniper', 'mortar', 'powder', 'shells', 'fortification', 'entrenching', 'grenades', 'medicine', 'hospital'],

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

  START: { units: ['rifle', 'rifle', 'rifle', 'rifle', 'rifle', 'rifle', 'worker', 'worker', 'worker', 'worker'] },   // DD Q15

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
  ECONOMY: { soldierLabour: 0.5 },                      // DD Q4: a soldier at a camp counts as half a Worker
};
