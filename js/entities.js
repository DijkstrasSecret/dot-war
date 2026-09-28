'use strict';
// Entity classes: units (dots), buildings, projectiles.
let _nextId = 1;   // reset by Game.init so a match's ids, and so its replays, start from 1

class Unit {
  constructor(type, owner, x, y, stats) {
    this.id = _nextId++;
    this.type = type; this.def = Data.UNITS[type]; this.owner = owner;
    this.x = x; this.y = y;
    this.stats = stats;                 // blueprint snapshot at production time
    this.hp = stats.hp;
    this.stress = 0; this.flee = 0; this.lastHitBy = null;
    this.cooldown = G.rng() * 0.5; this.acquireT = G.rng() * 0.3;   // seeded simulation stream
    this.order = null; this.field = null; this.forced = null; this.target = null;
    this.micro = null;                  // short direct move (cover seeking)
    this.facing = G.vrng() * Math.PI * 2; this.moving = false; this.wasMoving = false;   // facing is looks only
    this.work = null; this.squad = 0; this.dead = false; this.queue = [];
    this.xp = 0; this.rank = 0; this.fireT = 0; this.workT = 0; this.suppXp = null;   // veterancy (DD H1)
    this.inside = null; this.hBonus = 0;   // garrisoned building id and the extra height it gives
    this.recoil = 0; this.alertT = 0; this.bleedT = 0; this.lastAttackedT = -99;   // presentation timers
    this.cls = Data.MOVE_CLASSES[this.def.cls];
    this.spawn = { x, y };
    this.stuck = 0;
    this.muzzle = 0;
  }
  get alive() { return !this.dead; }
  get suppressed() { return this.stress > Data.COMBAT.suppressedAt; }   // DD Q12: snipers can be suppressed too
  get size() { return this.def.size; }
  get armor() { return this.def.armor; }
}

class Building {
  constructor(type, owner, x, y, built) {
    this.id = _nextId++;
    this.type = type; this.def = Data.BUILDINGS[type]; this.owner = owner;
    this.x = x; this.y = y; this.w = this.def.w; this.h = this.def.h;
    this.hp = built ? this.def.hp : this.def.hp * 0.1;
    this.progress = built ? 1 : 0;
    this.queue = []; this.workers = []; this.dead = false;
    this.depositType = null;
    this.muzzle = 0;
    this.maxHp = this.def.hp;
    this.level = 1; this.garrison = []; this.upgrading = null;   // scout towers
  }
  get levelDef() { return this.def.levels ? this.def.levels[this.level - 1] : null; }
  get alive() { return !this.dead; }
  get built() { return this.progress >= 1; }
  get armor() { return 'building'; }
  get size() { return Math.max(this.w, this.h) / 2; }
  contains(px, py) { return px >= this.x - this.w / 2 && px <= this.x + this.w / 2 && py >= this.y - this.h / 2 && py <= this.y + this.h / 2; }
}

class Projectile {
  constructor(o) { Object.assign(this, o); this.t = 0; }
}
