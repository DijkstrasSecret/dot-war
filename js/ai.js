'use strict';
// Scripted commander: produces units, defends its base, sends periodic raids at the other side's HQ.
// Normally it commands player 2 on the mountain; the Balance Lab can hand it player 1 as well
// (AI.reset([1, 2])) for AI-versus-AI matches. Strength comes from Data.DIFFICULTY[G.difficulty];
// a side without an HQ (sandbox maps) is idle.
// TODO(patch 0.8): harvest instead of passive income, build towers, research, flank through cover, retreat damaged units, use mortars with spotters.
const AI = (() => {
  const { dist } = Util;
  const R = () => G.rng();   // the AI is part of the seeded simulation
  const WEIGHTS = { rifle: 5, hmg: 2, sniper: 1, mortar: 1 };   // Workers are never trained: the AI has passive income
  let sides = {};            // per commanded player: { thinkT, raidT, lastDefend, walk }

  function params() { return Data.DIFFICULTY[G.difficulty] || Data.DIFFICULTY.hard; }
  const enemyOf = pid => (pid === 1 ? 2 : 1);
  const hqOf = pid => G.buildings.find(b => b.owner === pid && b.type === 'hq' && !b.dead);
  // DD Q2: how long a Rifleman takes to walk from this side's HQ to the enemy's, over the real terrain.
  // Flow-field cost is distance scaled by slope and ground, so dividing by speed gives game seconds.
  function walkTime(pid) {
    const mine = hqOf(pid), theirs = hqOf(enemyOf(pid));
    if (!mine || !theirs) return 0;
    const f = Path.getField(theirs.x, theirs.y + theirs.h / 2 + 12, 'infantry', 0); if (!f) return 0;
    const c = f.cost[Terrain.cellIdxAt(mine.x, mine.y + mine.h / 2 + 12)];
    return Number.isFinite(c) ? c / Data.UNITS.rifle.speed : 0;
  }
  function reset(pids = [2]) {
    sides = {};
    for (const pid of pids) { const walk = walkTime(pid); sides[pid] = { thinkT: 0, walk, raidT: walk + params().buildUp, lastDefend: -99, raids: 0, seen: new Map() }; }
  }
  // DD G7: the AI may train a unit only once its unlock time (per difficulty) has passed.
  function unlockDue(p, D) { for (const [t, at] of Object.entries(D.unlocks || {})) if (G.time >= at) p.unlocked.add(t); }

  function pick(choices) {
    let tot = 0; for (const c of choices) tot += WEIGHTS[c] || 1;
    let r = R() * tot; for (const c of choices) { r -= WEIGHTS[c] || 1; if (r <= 0) return c; }
    return choices[0];
  }

  function update(dt) { for (const pid of Object.keys(sides)) updateSide(+pid, sides[pid], dt); }
  function updateSide(pid, st, dt) {
    const p = G.players[pid]; if (!p) return;
    const D = params();
    const hq = hqOf(pid); if (!hq) return;
    p.res.wood += 1.5 * D.income * dt; p.res.metal += 0.8 * D.income * dt; p.res.sulfur += 0.35 * D.income * dt;
    st.thinkT -= dt; if (st.thinkT > 0) return; st.thinkT = 1;
    unlockDue(p, D);
    const mine = G.units.filter(u => u.owner === pid && !u.dead);
    const queued = G.buildings.reduce((n, b) => n + (b.owner === pid ? b.queue.length : 0), 0);
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
    const threats = G.units.filter(u => u.owner !== pid && !u.dead && !u.inside && Fog.visible(pid, u.x, u.y) && dist(u.x, u.y, hq.x, hq.y) < 480);
    if (threats.length) {
      if (G.time - st.lastDefend > 6) {
        st.lastDefend = G.time;
        let cx = 0, cy = 0; for (const t of threats) { cx += t.x; cy += t.y; } cx /= threats.length; cy /= threats.length;
        const defenders = mine.filter(u => !u.raiding && (!u.order || u.order.type === 'hold' || u.order.type === 'move'));
        if (defenders.length) Game.orderMove(defenders, cx, cy, 'attackmove');
      }
    } else {
      for (const u of mine) {
        if (u.raiding || u.order || dist(u.x, u.y, hq.x, hq.y) < 240 || G.time - (u.homeT || -99) < 20) continue;
        u.homeT = G.time; Game.orderMove([u], hq.x + (R() - 0.5) * 160, hq.y + 70 + (R() - 0.5) * 100, 'move');
      }
    }
    st.raidT -= 1;
    if (st.raidT <= 0 && mine.length >= Math.max(6, Math.floor(D.cap * 0.7))) {
      st.raidT = st.walk + D.raidMin + R() * D.raidVar;   // DD Q2: the interval adds the walking time too
      const targetHq = hqOf(enemyOf(pid));
      // Raids escalate, and a clear numbers advantage commits the whole army (Data.AI_RAIDS).
      const allIn = mine.length >= X.allInRatio * Math.max(X.minEnemy, st.seen.size);
      const frac = allIn ? 1 : Math.min(X.raidFracMax, D.raidFrac + st.raids * X.raidGrow);
      const raiders = mine.filter(u => !u.raiding).slice(0, Math.max(3, Math.ceil(mine.length * frac)));
      if (targetHq && raiders.length) { st.raids++; for (const u of raiders) u.raiding = true; Game.orderMove(raiders, targetHq.x, targetHq.y, 'attackmove'); }
    }
    for (const u of mine) if (u.raiding && !u.order && !u.target) { u.raiding = false; Game.orderMove([u], hq.x, hq.y + 70, 'move'); }
  }

  return { update, reset, params, get st() { return sides[2]; }, get sides() { return sides; } };
})();
