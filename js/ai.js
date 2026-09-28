'use strict';
// Enemy commander on the mountain: produces units, defends the plateau, sends periodic raids downhill.
// Strength comes from Data.DIFFICULTY[G.difficulty]; sandbox maps have no enemy HQ and the AI stays idle.
// TODO(patch 0.8): harvest instead of passive income, build towers, research, flank through cover, retreat damaged units, use mortars with spotters.
const AI = (() => {
  const { dist } = Util;
  const R = Math.random;
  const st = { thinkT: 0, raidT: 240, lastDefend: -99 };
  const WEIGHTS = { rifle: 5, musket: 1, hmg: 2, sniper: 1, mortar: 1 };

  function params() { return Data.DIFFICULTY[G.difficulty] || Data.DIFFICULTY.hard; }
  function reset() { st.thinkT = 0; st.raidT = params().firstRaid; st.lastDefend = -99; }

  function pick(choices) {
    let tot = 0; for (const c of choices) tot += WEIGHTS[c] || 1;
    let r = R() * tot; for (const c of choices) { r -= WEIGHTS[c] || 1; if (r <= 0) return c; }
    return choices[0];
  }

  function update(dt) {
    const p = G.players[2]; if (!p) return;
    const D = params();
    const hq = G.buildings.find(b => b.owner === 2 && b.type === 'hq' && !b.dead); if (!hq) return;
    p.res.wood += 1.5 * D.income * dt; p.res.metal += 0.8 * D.income * dt; p.res.sulfur += 0.35 * D.income * dt;
    st.thinkT -= dt; if (st.thinkT > 0) return; st.thinkT = 1;
    const mine = G.units.filter(u => u.owner === 2 && !u.dead);
    const queued = G.buildings.reduce((n, b) => n + (b.owner === 2 ? b.queue.length : 0), 0);
    const cap = D.cap + Math.floor(G.time / 240) * D.capGrow;
    if (mine.length + queued < cap) {
      for (const b of G.buildings) {
        if (b.owner !== 2 || b.dead || !b.built || !b.def.produces || b.queue.length >= 1) continue;
        const choices = b.def.produces.filter(t => p.unlocked.has(t));
        if (choices.length) Game.enqueue(b, pick(choices));
      }
    }
    const threats = G.units.filter(u => u.owner !== 2 && !u.dead && !u.inside && Fog.visible(2, u.x, u.y) && dist(u.x, u.y, hq.x, hq.y) < 480);
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
      st.raidT = D.raidMin + R() * D.raidVar;
      const targetHq = G.buildings.find(b => b.owner === 1 && b.type === 'hq' && !b.dead);
      const raiders = mine.filter(u => !u.raiding).slice(0, Math.max(3, Math.floor(mine.length * D.raidFrac)));
      if (targetHq && raiders.length) { for (const u of raiders) u.raiding = true; Game.orderMove(raiders, targetHq.x, targetHq.y, 'attackmove'); }
    }
    for (const u of mine) if (u.raiding && !u.order && !u.target) { u.raiding = false; Game.orderMove([u], hq.x, hq.y + 70, 'move'); }
  }

  return { update, reset, params, st };
})();
