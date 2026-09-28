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
    musket: {
      name: 'Musketeer', shape: 'circle', icon: 'musket', cls: 'infantry', size: 6,
      hp: 60, armor: 'none', speed: 50, vision: 150, cost: { wood: 15 }, time: 8,
      weapon: { dmg: 24, dtype: 'ballistic', range: 110, minRange: 0, acc: 0.5, reload: 3.2, pspeed: 700, indirect: false, splash: 0, suppress: 0.12 },
      desc: 'Wood-only line infantry. Short range, slow reload, cheap.',
    },
    rifle: {
      name: 'Rifleman', shape: 'circle', icon: 'rifle', cls: 'infantry', size: 6,
      hp: 70, armor: 'none', speed: 52, vision: 160, cost: { wood: 12, metal: 10 }, time: 10, requires: 'rifling',
      weapon: { dmg: 20, dtype: 'ballistic', range: 170, minRange: 0, acc: 0.68, reload: 1.5, pspeed: 900, indirect: false, splash: 0, suppress: 0.08 },
      desc: 'Standard infantry. Good range and accuracy.',
    },
    hmg: {
      name: 'Machine Gunner', shape: 'circle', icon: 'hmg', cls: 'infantry', size: 6.5,
      hp: 80, armor: 'none', speed: 38, vision: 160, cost: { wood: 10, metal: 35 }, time: 14, requires: 'hmg',
      weapon: { dmg: 11, dtype: 'ballistic', range: 200, minRange: 0, acc: 0.4, reload: 0.18, pspeed: 900, indirect: false, splash: 0, suppress: 0.035 },
      desc: 'Sustained fire. Pins enemies down and shreds infantry in the open.',
    },
    sniper: {
      name: 'Sniper', shape: 'circle', icon: 'sniper', cls: 'infantry', size: 6,
      hp: 55, armor: 'none', speed: 48, vision: 230, cost: { wood: 10, metal: 25 }, time: 14, requires: 'sniper', ignoresSuppression: true,
      weapon: { dmg: 65, dtype: 'ballistic', range: 300, minRange: 0, acc: 0.85, reload: 3.5, pspeed: 1300, indirect: false, splash: 0, suppress: 0.25 },
      desc: 'Long sight and reach. Always obeys target orders, even under fire.',
    },
    mortar: {
      name: 'Mortar Crew', shape: 'square', icon: 'mortar', cls: 'infantry', size: 7,
      hp: 70, armor: 'none', speed: 34, vision: 140, cost: { wood: 20, metal: 40 }, time: 16, requires: 'mortar',
      weapon: { dmg: 50, dtype: 'explosive', range: 380, minRange: 90, acc: 0.5, reload: 5, pspeed: 200, indirect: true, splash: 32, suppress: 0.35, ammo: { sulfur: 2 } },
      desc: 'Indirect fire over ridges. Costs sulfur per shell. Needs a spotter to be accurate.',
    },
  },

  BUILDINGS: {
    hq: { name: 'Headquarters', w: 64, h: 64, hp: 1500, icon: 'hq', produces: ['musket'], prodMult: 0.7, cost: {}, buildTime: 0, vision: 220, desc: 'Your command post. Lose it and the game is over.' },
    barracks: { name: 'Barracks', w: 48, h: 40, hp: 600, icon: 'circle', produces: ['musket', 'rifle', 'hmg', 'sniper'], prodMult: 1, cost: { wood: 80, metal: 20 }, buildTime: 30, vision: 120, desc: 'Trains infantry (circles).' },
    ordnance: { name: 'Ordnance Works', w: 52, h: 44, hp: 700, icon: 'square', produces: ['mortar'], prodMult: 1, cost: { wood: 60, metal: 60 }, buildTime: 40, vision: 120, desc: 'Builds mortars and other heavy weapons (squares).' },
    lumber: { name: 'Lumber Camp', w: 40, h: 32, hp: 350, icon: 'lumber', harvest: 'wood', rate: 1.0, perWorker: 0.6, maxWorkers: 4, cost: { wood: 40 }, buildTime: 20, vision: 100, needs: 'forest', desc: 'Place next to forest. Assign infantry as workers to speed it up.' },
    mine: { name: 'Mine', w: 40, h: 36, hp: 400, icon: 'mine', harvest: 'deposit', rate: 0.5, perWorker: 0.35, maxWorkers: 4, cost: { wood: 60, metal: 10 }, buildTime: 25, vision: 100, needs: 'deposit', desc: 'Place on a metal or sulfur deposit. Assign infantry as workers.' },
    tower: {
      name: 'Scout Tower', w: 30, h: 30, hp: 400, icon: 'tower', cost: { wood: 60, metal: 10 }, buildTime: 25, vision: 200, tower: true,
      levels: [
        { cap: 2, heavy: 0, height: 8, hp: 400, vision: 200 },
        { cap: 4, heavy: 0, height: 14, hp: 650, vision: 240, cost: { wood: 80, metal: 30 }, time: 25 },
        { cap: 6, heavy: 1, height: 20, hp: 900, vision: 280, cost: { wood: 100, metal: 60 }, time: 30 },
      ],
      desc: 'Garrison infantry for height, sight and cover. Upgrade twice; level 3 also holds one mortar.',
    },
  },
  BUILD_LIST: ['lumber', 'mine', 'barracks', 'ordnance', 'tower'],
  BUILD_HOTKEYS: { lumber: 'L', mine: 'M', barracks: 'C', ordnance: 'O', tower: 'T' },
  TRAIN_HOTKEYS: ['Q', 'W', 'E', 'R', 'T'],

  RESEARCH: {
    rifling: { name: 'Rifling', cost: { wood: 60, metal: 30 }, time: 45, req: [], unlock: 'rifle', desc: 'Unlocks Riflemen.' },
    drill: { name: 'Marksmanship Drill', cost: { wood: 80 }, time: 40, req: [], effects: [{ units: 'all', stat: 'acc', mult: 1.1 }], desc: '+10% accuracy for newly trained units.' },
    logistics: { name: 'Logistics', cost: { wood: 100, metal: 20 }, time: 50, req: [], effects: [{ harvest: 1.25 }], desc: '+25% harvest rate.' },
    boots: { name: 'Field Boots', cost: { wood: 70 }, time: 35, req: [], effects: [{ units: 'all', stat: 'speed', mult: 1.1 }], desc: '+10% speed for newly trained infantry.' },
    hmg: { name: 'Heavy Machine Gun', cost: { metal: 90 }, time: 60, req: ['rifling'], unlock: 'hmg', desc: 'Unlocks Machine Gunners.' },
    sniper: { name: 'Marksman Rifle', cost: { wood: 20, metal: 60 }, time: 50, req: ['rifling'], unlock: 'sniper', desc: 'Unlocks Snipers.' },
    mortar: { name: 'Mortar', cost: { wood: 40, metal: 60 }, time: 50, req: ['rifling'], unlock: 'mortar', desc: 'Unlocks Mortar Crews (needs sulfur for shells).' },
    powder: { name: 'Improved Powder', cost: { sulfur: 30, metal: 20 }, time: 40, req: ['rifling'], effects: [{ units: 'firearms', stat: 'range', mult: 1.12 }], desc: '+12% range for newly trained firearm units.' },
    shells: { name: 'HE Shells', cost: { sulfur: 40, metal: 40 }, time: 45, req: ['mortar'], effects: [{ units: ['mortar'], stat: 'dmg', mult: 1.25 }], desc: '+25% mortar damage for new crews.' },
  },
  RESEARCH_ORDER: ['rifling', 'drill', 'logistics', 'boots', 'hmg', 'sniper', 'mortar', 'powder', 'shells'],

  DEPOSIT_NAMES: { metal: 'Iron ore', sulfur: 'Sulfur', rubber: 'Rubber trees', oil: 'Oil seep' },

  // Enemy commander settings per difficulty. 'hard' is the original tuning.
  DIFFICULTY: {
    easy: { name: 'Easy', desc: 'Small garrison, rare small raids, slow enemy production.', cap: 8, capGrow: 1, firstRaid: 420, raidMin: 320, raidVar: 120, raidFrac: 0.4, garrison: 6, income: 0.6 },
    normal: { name: 'Normal', desc: 'Moderate garrison and raids every few minutes.', cap: 11, capGrow: 2, firstRaid: 300, raidMin: 220, raidVar: 100, raidFrac: 0.5, garrison: 9, income: 0.8 },
    hard: { name: 'Hard', desc: 'Full garrison on the mountain and frequent large raids.', cap: 14, capGrow: 2, firstRaid: 240, raidMin: 150, raidVar: 90, raidFrac: 0.55, garrison: 12, income: 1 },
  },
  DIFFICULTY_ORDER: ['easy', 'normal', 'hard'],
};
