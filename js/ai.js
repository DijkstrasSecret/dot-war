'use strict';
// Scripted commander: produces units, defends its base, sends periodic raids at the other side's HQ.
// Kaan, 0.5a.3: its mines need carriers, so it keeps LOGISTICS.aiCarriers Workers on each (they never
// fight or count towards the army cap); everything else is passive income.
// Normally it commands player 2 on the mountain; the Balance Lab can hand it player 1 as well
// (AI.reset([1, 2])) for AI-versus-AI matches. Strength comes from Data.DIFFICULTY[G.difficulty];
// a side without an HQ (sandbox maps) is idle.
// Patch 0.5d (Data.AI_SMART): damaged or panicking soldiers fall back to the HQ to heal, soldiers
// garrison the HQ and towers when enemies come close, a trench is dug across an approaching army's
// path, research follows a timetable, and small groups raid the enemy's carriers, camps and Depots.
// TODO(patch 0.8): harvest instead of passive income, build towers, flank through cover, use mortars with spotters.
const AI = (() => {
  const { dist } = Util;
  const R = () => G.rng();   // the AI is part of the seeded simulation
  const WEIGHTS = { rifle: 5, hmg: 2, sniper: 1, mortar: 1, fieldgun: 1 };   // 0.8: Field Guns share the Ordnance Works with mortars   // factory picks; Workers are trained only as mine carriers (carriers())
  let sides = {};            // per commanded player: { thinkT, raidT, lastDefend, walk }

  function params() { return Data.DIFFICULTY[G.difficulty] || Data.DIFFICULTY.hard; }
  const enemyOf = pid => (pid === 1 ? 2 : 1);
  const hqOf = pid => G.buildings.find(b => b.owner === pid && b.type === 'hq' && !b.dead);
  // DD Q2: how long a Rifleman takes to walk from this side's HQ to the enemy's, over the real terrain.
  // Flow-field cost is distance scaled by slope and ground, so dividing by speed gives game seconds.
  function walkTime(pid) {
    const mine = hqOf(pid), theirs = hqOf(enemyOf(pid));
    if (!mine || !theirs) return 0;
    const r = Path.route(mine.x, mine.y + mine.h / 2 + 12, theirs.x, theirs.y + theirs.h / 2 + 12, 'infantry');
    return r ? r.cost / Data.UNITS.rifle.speed : 0;
  }
  // Commanded sides ignore the supply cap: the scripted AI keeps its own unit cap (DD Q23).
  function reset(pids = [2]) {
    sides = {};
    for (const pid of pids) { const walk = walkTime(pid); if (G.players[pid]) { G.players[pid].noSupply = true; G.players[pid].ai = true; } sides[pid] = { thinkT: 0, walk, raidT: walk + params().buildUp, lastDefend: -99, raids: 0, seen: new Map() }; }
  }
  // DD G7: the AI may train a unit only once its unlock time (per difficulty) has passed.
  function unlockDue(p, D) { for (const [t, at] of Object.entries(D.unlocks || {})) if (G.time >= at) p.unlocked.add(t); }

  function pick(choices) {
    let tot = 0; for (const c of choices) tot += WEIGHTS[c] || 1;
    let r = R() * tot; for (const c of choices) { r -= WEIGHTS[c] || 1; if (r <= 0) return c; }
    return choices[0];
  }

  // ---- 0.5d: a smarter enemy ----
  // Research on a timetable, free, like the unit unlocks (DD 0.5d).
  function research(p, D) { for (const [id, at] of Data.AI_SMART.research) if (!p.done.has(id) && G.time >= at * (D.researchMult || 1)) Game.applyResearch(p, id); }
  // Under 40% health or panicking: out of the fight and back to the HQ, which heals infantry nearby; back in at 80%.
  function recover(hq, army) {
    const S = Data.AI_SMART, home = () => [hq.x + (R() - 0.5) * 90, hq.y + hq.h / 2 + 30 + R() * 40];
    for (const u of army) {
      if (u.inside) continue;
      const hp = u.hp / u.stats.hp;
      if (!u.aiRecover && (hp < S.retreatHp || u.flee > 0)) { u.aiRecover = true; u.raiding = false; const [x, y] = home(); Game.orderMove([u], x, y, 'move'); }
      else if (u.aiRecover && hp >= S.rejoinHp && u.flee <= 0) u.aiRecover = false;
      else if (u.aiRecover && !u.order && dist(u.x, u.y, hq.x, hq.y) > 140) { const [x, y] = home(); Game.orderMove([u], x, y, 'move'); }
    }
  }
  // Fill the HQ and any towers or Bunkers while enemies are close; let everyone out once it has been quiet a while.
  function garrison(pid, st, fit, threatened) {
    const S = Data.AI_SMART, holds = G.buildings.filter(b => b.owner === pid && !b.dead && b.built && b.slots);
    if (threatened) st.garrisonT = G.time;
    if (!threatened) {
      if (G.time - (st.garrisonT || -1e9) > S.garrisonLinger) for (const b of holds) if (b.garrison.length) Game.unloadBuilding(b);
      return;
    }
    for (const b of holds) {
      const lv = b.slots, room = (lv.cap || 0) + (lv.mg || 0) + (lv.heavy || 0) - b.garrison.length - fit.filter(u => u.order && u.order.type === 'garrison' && u.order.building === b).length;
      if (room <= 0) continue;
      const near = fit.filter(u => !u.inside && !u.raiding && (!u.order || u.order.type === 'hold' || u.order.type === 'move') && dist(u.x, u.y, b.x, b.y) < 300 && Game.canEnter(u, b))
        .sort((a, c) => dist(a.x, a.y, b.x, b.y) - dist(c.x, c.y, b.x, b.y) || a.id - c.id);
      if (near.length) Game.orderGarrison(near.slice(0, room), b);
    }
  }
  // Where a walk from (x, y) to this HQ passes `d` metres out, and the direction it is heading there,
  // following the same flow field the soldiers use (so the spot is always reachable ground).
  function approach(hq, x, y, d) {
    const r = Path.route(x, y, hq.x, hq.y + hq.h / 2 + 12, 'infantry'); if (!r) return null;
    const W = Terrain.W, px = k => Terrain.cx(k % W), py = k => Terrain.cy((k - k % W) / W), c = r.cells;
    for (let n = 1; n < c.length; n++) {
      const nx = px(c[n]), ny = py(c[n]);
      if (dist(nx, ny, hq.x, hq.y) <= d) { const ox = px(c[n - 1]), oy = py(c[n - 1]), L = dist(ox, oy, nx, ny) || 1; return { x: nx, y: ny, ux: (nx - ox) / L, uy: (ny - oy) / L }; }
    }
    return null;
  }
  // Dig a trench across the enemy's way in: once before the first raid leaves (on the path from the
  // enemy HQ), and when an enemy group comes into view near the base, if no trench of ours stands.
  function digIn(pid, st, hq, fit, D) {
    const S = Data.AI_SMART.dig; if (!D.digIn) return;
    if (st.digLine != null && G.time - st.digT > S.giveUp) {   // unfinished after giveUp seconds: abandon the rest
      for (const sg of G.segs.filter(x => x.line === st.digLine && !x.done)) Game._dbg.removeSeg(sg);
      Game.orderStop(fit.filter(u => u.order && u.order.type === 'dig' && u.order.line === st.digLine)); st.digLine = null;
    }
    if (G.time - (st.digT || -1e9) < S.every) return;
    if (G.segs.filter(x => x.owner === pid && x.type === 'trench' && x.done && dist(x.x, x.y, hq.x, hq.y) < Math.max(...S.tryDist) * 1.5).length >= S.minCells) return;   // half a trench already stands
    let from = null;
    const near = G.units.filter(u => u.owner === enemyOf(pid) && !u.dead && !u.inside && !u.def.labour && Fog.visible(pid, u.x, u.y) && dist(u.x, u.y, hq.x, hq.y) < S.seen);
    if (near.length >= S.minGroup) { let cx = 0, cy = 0; for (const u of near) { cx += u.x; cy += u.y; } from = [cx / near.length, cy / near.length]; }
    else if (st.digT == null && G.time >= st.walk + D.buildUp - S.early) { const e = hqOf(enemyOf(pid)); if (e) from = [e.x, e.y + e.h / 2 + 12]; }
    if (!from) return;
    // Try a few distances out along the route and take the one with the most diggable ground across it.
    const h = S.len / 2, cls = Data.MOVE_CLASSES.infantry; let a = null, best = -1;
    for (const d of S.tryDist) {
      const c = approach(hq, from[0], from[1], d); if (!c) continue;
      let ok = 0; for (let t = -h; t <= h; t += Data.DIG.segment) if (Terrain.passableAt(c.x - c.uy * t, c.y + c.ux * t, cls)) ok++;
      if (ok > best) { best = ok; a = c; }
    }
    if (!a || best < S.minCells) return;
    const mx = a.x, my = a.y;
    const diggers = fit.filter(u => !u.inside && !u.raiding && u.type === 'rifle' && (!u.order || u.order.type === 'hold' || u.order.type === 'move'))
      .sort((p, q) => dist(p.x, p.y, mx, my) - dist(q.x, q.y, mx, my) || p.id - q.id).slice(0, S.diggers);
    if (!diggers.length) return;
    if (Game.planDig(pid, 'trench', [[mx - a.uy * h, my + a.ux * h], [mx + a.uy * h, my - a.ux * h]], diggers, false)) { st.digT = G.time; st.digLine = G.lineNext - 1; }
  }
  // Remember where the enemy's supply chain was last seen: carriers at work, camps, mines, Depots.
  function watchSupply(pid, st) {
    const S = Data.AI_SMART.harass; st.eco = st.eco || new Map();
    for (const u of G.units) if (u.owner === enemyOf(pid) && !u.dead && !u.inside && u.work != null && Fog.visible(pid, u.x, u.y)) st.eco.set('u' + u.id, { ent: u, x: u.x, y: u.y, t: G.time });
    for (const b of G.buildings) if (b.owner === enemyOf(pid) && !b.dead && (b.def.harvest || b.type === 'depot') && Fog.visible(pid, b.x, b.y)) st.eco.set('b' + b.id, { ent: b, x: b.x, y: b.y, t: G.time });
    for (const [k, e] of st.eco) if (e.ent.dead || G.time - e.t > S.memory) st.eco.delete(k);
  }
  // A few Riflemen go after the most recently seen part of it.
  function harass(pid, st, fit, D, threatened) {
    const S = Data.AI_SMART.harass; if (!D.harassEvery) return;
    if (st.harassT == null) st.harassT = st.walk + D.buildUp + D.harassEvery;
    if (G.time < st.harassT || threatened || fit.length < S.minArmy) return;
    let target = null; for (const e of st.eco.values()) if (!target || e.t > target.t || (e.t === target.t && e.ent.id < target.ent.id)) target = e;
    if (!target) {   // nothing seen: go and look at the next deposit in turn, nearest first (deposits are on everyone's map)
      const hq = hqOf(pid), deps = Terrain.deposits.filter(d => !G.buildings.some(b => b.owner === pid && !b.dead && dist(b.x, b.y, d.x, d.y) < 80))
        .sort((a, b) => dist(a.x, a.y, hq.x, hq.y) - dist(b.x, b.y, hq.x, hq.y)).slice(0, S.scoutDeposits);
      if (!deps.length) return;
      const d = deps[(st.scoutI = ((st.scoutI || 0) + 1)) % deps.length]; target = { x: d.x, y: d.y };
    }
    st.harassT = G.time + D.harassEvery;
    const group = fit.filter(u => u.type === 'rifle' && !u.raiding && !u.inside && (!u.order || u.order.type === 'move' || u.order.type === 'hold')).slice(0, S.size);
    if (!group.length) return;
    for (const u of group) u.raiding = true;
    Game.orderMove(group, target.x, target.y, 'attackmove'); Game.raidLaunched(pid, group);
  }

  // Keep aiCarriers Workers on each finished mine: idle Workers are sent to the emptiest one, and the HQ
  // trains more while there are too few.
  function carriers(pid, hq) {
    const want = Data.LOGISTICS.aiCarriers;
    const mines = G.buildings.filter(b => b.owner === pid && !b.dead && b.built && b.type === 'mine'); if (!mines.length) return;
    const workers = G.units.filter(u => u.owner === pid && !u.dead && u.def.labour);
    for (const w of workers) {
      if (w.work != null || w.order) continue;
      const m = mines.filter(b => b.workers.length < want).sort((a, b) => a.workers.length - b.workers.length || a.id - b.id)[0];
      if (m) Game.orderWork([w], m);
    }
    const queuedW = hq.queue.filter(q => q.type === 'worker').length;
    if (workers.length + queuedW < mines.length * want && !queuedW) Game.enqueue(hq, 'worker');
  }
  function update(dt) { for (const pid of Object.keys(sides)) updateSide(+pid, sides[pid], dt); }
  function updateSide(pid, st, dt) {
    const p = G.players[pid]; if (!p) return;
    const D = params();
    const hq = hqOf(pid); if (!hq) return;
    const inc = D.income * Data.ECONOMY.pace * dt;   // the AI's passive income follows the same pace as harvesting
    p.res.wood += 1.5 * inc; p.res.metal += 0.8 * inc; p.res.sulfur += 0.35 * inc;
    st.thinkT -= dt; if (st.thinkT > 0) return; st.thinkT = 1;
    unlockDue(p, D);
    carriers(pid, hq);
    const mine = G.units.filter(u => u.owner === pid && !u.dead && !u.def.labour);   // the army: Workers only carry
    research(p, D); recover(hq, mine);
    const fit = mine.filter(u => !u.aiRecover);   // soldiers healing at the HQ sit out raids and defence
    const queued = G.buildings.reduce((n, b) => n + (b.owner === pid ? b.queue.filter(q => q.type !== 'worker').length : 0), 0);
    const cap = D.cap + Math.floor(G.time / 240) * D.capGrow;
    if (mine.length + queued < cap) {
      for (const b of G.buildings) {
        if (b.owner !== pid || b.dead || !b.built || !b.def.produces || b.queue.length >= 1) continue;
        const choices = b.def.produces.filter(t => p.unlocked.has(t) && WEIGHTS[t]);
        if (choices.length) Game.enqueue(b, pick(choices));
      }
    }
    // Remember enemy soldiers this side has seen, to judge whether it clearly outnumbers them.
    const X = Data.AI_RAIDS;
    for (const u of G.units) if (u.owner === enemyOf(pid) && !u.dead && !u.inside && Fog.visible(pid, u.x, u.y)) st.seen.set(u.id, G.time);
    for (const [id, t] of st.seen) { const u = G.unitById.get(id); if (!u || u.dead || G.time - t > X.memory) st.seen.delete(id); }
    const threats = G.units.filter(u => u.owner !== pid && !u.dead && !u.inside && Fog.visible(pid, u.x, u.y) && dist(u.x, u.y, hq.x, hq.y) < Data.AI_SMART.garrisonRange);
    watchSupply(pid, st); digIn(pid, st, hq, fit, D); garrison(pid, st, fit, threats.length > 0);
    // Soldiers standing idle in their own finished trench hold it instead of charging out.
    const inTrench = u => { const sg = Game.lineAt(u.x, u.y); return sg && sg.owner === pid && sg.type === 'trench' && sg.done; };
    for (const u of fit) if (!u.order && !u.inside && !u.raiding && inTrench(u)) Game.orderHold([u]);
    if (threats.length) {
      if (G.time - st.lastDefend > 6) {
        st.lastDefend = G.time;
        let cx = 0, cy = 0; for (const t of threats) { cx += t.x; cy += t.y; } cx /= threats.length; cy /= threats.length;
        const defenders = fit.filter(u => !u.raiding && !u.siteJob && !u.inside && (!u.order || (u.order.type === 'hold' && !inTrench(u)) || u.order.type === 'move'));
        if (defenders.length) Game.orderMove(defenders, cx, cy, 'attackmove');
      }
    } else {
      for (const u of fit) {
        if (u.raiding || u.siteJob || u.order || u.inside || dist(u.x, u.y, hq.x, hq.y) < 240 || G.time - (u.homeT || -99) < 20) continue;
        u.homeT = G.time; Game.orderMove([u], hq.x + (R() - 0.5) * 160, hq.y + 70 + (R() - 0.5) * 100, 'move');
      }
    }
    harass(pid, st, fit, D, threats.length > 0);
    st.raidT -= 1;
    if (st.raidT <= 0 && fit.length >= Math.max(6, Math.floor(D.cap * 0.7))) {
      st.raidT = st.walk + D.raidMin + R() * D.raidVar;   // DD Q2: the interval adds the walking time too
      const targetHq = hqOf(enemyOf(pid));
      // Raids escalate, and a clear numbers advantage commits the whole army (Data.AI_RAIDS).
      const allIn = fit.length >= X.allInRatio * Math.max(X.minEnemy, st.seen.size);
      const frac = allIn ? 1 : Math.min(X.raidFracMax, D.raidFrac + st.raids * X.raidGrow);
      const raiders = fit.filter(u => !u.raiding && !u.siteJob && !u.inside && !(u.order && u.order.type === 'dig')).slice(0, Math.max(3, Math.ceil(fit.length * frac)));
      if (targetHq && raiders.length) {   // 0.7d: a siege raid (Q24); a new one joins the raid still out
        st.raids++; for (const u of raiders) { u.raiding = true; u.sieging = true; }
        st.siege = st.siege || { ids: [], target: null, stage: 'tower' }; st.siege.ids.push(...raiders.map(u => u.id));
        Game.raidLaunched(pid, raiders); siegeTarget(pid, st, hq, true);
      }
    }
    if (st.siege) siegeTarget(pid, st, hq, false);
    for (const u of mine) if (u.raiding && !u.sieging && !u.order && !u.target) { u.raiding = false; Game.orderMove([u], hq.x, hq.y + 70, 'move'); }
    takeSites(pid, st, hq, fit, mine);
  }
  // ---- 0.7d: siege raids (DD Q24, "Patch 0.7d") ----
  // Remember the enemy buildings this side has seen (and the HQ, which everyone knows).
  function rememberBuildings(pid, st) {
    st.known = st.known || new Set();
    for (const b of G.buildings) if (b.owner === enemyOf(pid) && !b.dead && (b.type === 'hq' || Fog.visible(pid, b.x, b.y))) st.known.add(b.id);
  }
  // Is an outpost related to the main base: near the enemy HQ, or near the line from our HQ to theirs?
  function related(b, hq, ehq) {
    const S = Data.AI_SIEGE; if (dist(b.x, b.y, ehq.x, ehq.y) <= S.nearHq) return true;
    const dx = ehq.x - hq.x, dy = ehq.y - hq.y, t = Math.max(0, Math.min(1, ((b.x - hq.x) * dx + (b.y - hq.y) * dy) / (dx * dx + dy * dy || 1)));
    return dist(b.x, b.y, hq.x + dx * t, hq.y + dy * t) <= S.corridor;
  }
  // Each think: drop the dead, and when the target is done (or none), pick the next one: towers, then
  // the weakest outpost towards the HQ (only with no large threat near), then the HQ.
  function siegeTarget(pid, st, hq, fresh) {
    const S = Data.AI_SIEGE, sg = st.siege, E = enemyOf(pid), ehq = hqOf(E);
    rememberBuildings(pid, st);
    const all = sg.ids.map(id => G.unitById.get(id)).filter(u => u && !u.dead);
    for (const u of all) if (u.aiRecover) u.sieging = false;   // gone home to heal: out of the raid
    const us = all.filter(u => u.sieging);
    sg.ids = us.map(u => u.id);
    if (!us.length || !ehq) { for (const u of us) u.sieging = false; st.siege = null; return; }
    let cx = 0, cy = 0; for (const u of us) { cx += u.x; cy += u.y; } cx /= us.length; cy /= us.length;
    const foes = G.units.filter(e => e.owner === E && !e.dead && !e.inside && e.stats.weapon && !e.def.labour && Fog.visible(pid, e.x, e.y) && dist(e.x, e.y, cx, cy) < S.threatR);
    const threat = foes.length >= us.length * S.threatShare;
    const t = sg.target && G.buildingById.get(sg.target);
    const done = !t || t.dead || t.owner !== E;
    if (threat && !fresh) {   // fight it where it stands, don't move on
      if (G.time - (sg.fightT || -99) > 6) { sg.fightT = G.time; let fx = 0, fy = 0; for (const e of foes) { fx += e.x; fy += e.y; } Game.orderMove(us.filter(u => !u.target), fx / foes.length, fy / foes.length, 'attackmove'); }
      return;
    }
    if (!done && !fresh) { const idle = us.filter(u => !u.order && !u.target); if (idle.length) Game.orderMove(idle, t.x, t.y + t.h / 2 + 10, 'attackmove'); return; }
    const outposts = G.buildings.filter(b => st.known.has(b.id) && b.owner === E && !b.dead && b.type !== 'hq' && !b.def.citadel && related(b, hq, ehq));
    const defenders = b => G.units.filter(e => e.owner === E && !e.dead && e.stats.weapon && !e.def.labour && dist(e.x, e.y, b.x, b.y) < S.defenderR).length;
    let next = null, stage = 'hq';
    const towers = outposts.filter(b => b.def.tower || b.type === 'bunker');
    if (towers.length) { stage = 'tower'; next = towers.sort((a, b) => dist(a.x, a.y, cx, cy) - dist(b.x, b.y, cx, cy) || a.id - b.id)[0]; }
    else {
      const ahead = outposts.filter(b => dist(b.x, b.y, ehq.x, ehq.y) < dist(cx, cy, ehq.x, ehq.y));
      if (ahead.length) { stage = 'outpost'; next = ahead.map(b => [b, (b.def.invulnerable ? 0 : b.hp) + S.defenderWeight * defenders(b)]).sort((a, b) => a[1] - b[1] || a[0].id - b[0].id)[0][0]; }
    }
    if (!next) next = ehq;
    sg.target = next.id; sg.stage = stage;
    Game.orderMove(us, next.x, next.y + next.h / 2 + 10, 'attackmove');
  }

  // 0.7c (DD "Patch 0.7c"): now and then a few soldiers go to capture the nearest buff site it doesn't hold
  // and stand there until it is theirs. The full siege AI comes in 0.7d.
  function takeSites(pid, st, hq, fit, mine) {
    const AS = Data.AI_SITES;
    st.siteT = (st.siteT == null ? AS.every : st.siteT) - 1;
    if (st.siteT <= 0) {
      st.siteT = AS.every;
      // The team grows with the guards there: 2 per guard plus 2 (at most 10), and 4 soldiers stay home.
      const free = fit.filter(u => !u.raiding && !u.siteJob && !u.inside && !(u.order && u.order.type === 'dig'));
      const need = b => Math.min(AS.maxSize, Math.max(AS.size, 2 + 2 * G.units.filter(g => g.owner !== pid && !g.dead && g.stats.weapon && !g.def.civilian && dist(g.x, g.y, b.x, b.y) < 150).length));
      const site = fit.length >= AS.minArmy && G.buildings.filter(b => b.def.site && !b.dead && b.owner !== pid && dist(b.x, b.y, hq.x, hq.y) <= AS.reach && !mine.some(u => u.siteJob === b.id) && need(b) <= free.length - AS.keepHome).sort((a, b) => dist(a.x, a.y, hq.x, hq.y) - dist(b.x, b.y, hq.x, hq.y))[0];
      if (site) {
        const team = free.slice(0, need(site));
        for (const u of team) { u.siteJob = site.id; u.siteTries = 0; }
        if (team.length) Game.orderMove(team, site.x, site.y + site.h / 2 + 30, 'attackmove');
      }
    }
    for (const u of mine) {
      if (!u.siteJob) continue; const s = G.buildingById.get(u.siteJob);
      if (!s || s.dead || s.owner === pid) { u.siteJob = null; if (!u.order) Game.orderMove([u], hq.x, hq.y + 70, 'move'); }
      else if (!u.order && !u.target && dist(u.x, u.y, s.x, s.y) > Data.SITES.capture.r * 0.7) {
        u.siteTries = (u.siteTries || 0) + 1;
        if (u.siteTries > 4) { u.siteJob = null; u.siteTries = 0; continue; }   // can't get there: give up
        Game.orderMove([u], s.x, s.y + s.h / 2 + 20, 'attackmove');
      }
    }
  }

  return { update, reset, params, related, get st() { return sides[2]; }, get sides() { return sides; } };
})();
