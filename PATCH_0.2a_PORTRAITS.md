# Patch 0.2a: portraits, names and factions

A guide for Claude Code. Kaan designs the game and is not a heavy coder, so explain what you did in
plain words and give him step-by-step checks.

## Why this patch comes first

Patch 0.2a lands **before** patch 0.2.1 (Foundations). A UI rework is coming next, and it should be
built with portraits already in place rather than on top of panels that are about to change. So:

- The **portrait engine** (`js/portraits.js`) and the **unit data** (`faction`, `kitEra`) are
  permanent. Build them properly.
- The **UI hook** is deliberately small and sits in one place (three helpers in `js/ui.js`). Do not
  spread portraits into other panels, tooltips or the canvas in this patch. The UI rework decides
  where they go.

The rules come from `DESIGN_DECISIONS.md` section K. Nothing else from that document is part of
this patch.

## What the player gets

- A **Your army** row in the start menu: British, American, French, German, Italian, Polish,
  Soviet, Turkish or Spanish. It changes uniforms and names only. The enemy gets a different random
  army. Neutral guards keep a mixed look.
- Selecting one soldier shows his **portrait** (face, uniform, headgear in team colour) and his
  **name**, e.g. "Pvt. Dmitri Fedorov", above "Musketeer · Soviet army".
- Tower garrison icons show the soldier's short name on hover.

## The ready-made patch

`patches/patch-0.2a-portraits.diff` contains every **code** change, including the new
`js/portraits.js`. It does not touch any `.md` file; the doc edits are listed under step 6.

It was tested in a real browser against `main` at `d329ba3`: menu, game start, unit panel for own,
enemy and neutral units, no console errors. It also applies cleanly to the `design-decisions`
branch, which changes docs only.

## Steps

0. **Docs first.** This guide, the diff and the design docs arrive on `main` through the
   `design-decisions` pull request. If that isn't merged yet, ask Kaan to merge it, then pull
   `main`.
1. **Branch.** From the up-to-date `main`, create `patch-0.2a-portraits`.
2. **Find the diff** at `patches/patch-0.2a-portraits.diff`.
3. **Check, then apply.**
   ```
   git apply --check patches/patch-0.2a-portraits.diff
   git apply patches/patch-0.2a-portraits.diff
   ```
   If the check fails because `main` has moved on, apply what still fits with
   `git apply --reject patches/patch-0.2a-portraits.diff`, then make the rejected edits by hand
   using the table below. To get only the engine file:
   `git apply --include=js/portraits.js patches/patch-0.2a-portraits.diff`.
4. **Delete `patches/patch-0.2a-portraits.diff`** (and the empty `patches/` folder) on this
   branch. Once the code is in, the diff isn't needed.
5. **Read every changed file** before testing. You must understand the change you are committing.
6. **Update the docs by hand** so they describe the code as built:
   - `CLAUDE.md`: add `Portraits` to the list of globals (between `Input` and `UI`). The
     portraits working rule is already there.
   - `DEVELOPMENT.md`: a row for `Portraits` in the architecture table, and under "Adding content"
     a short note: faction looks live in `FACTIONS`, names in `NAME_POOLS`; `Main.start` sets
     `G.players[n].faction`, `Game.spawnUnit` copies `faction` and `kitEra` onto each unit,
     `UI.unitPanel` draws the portrait; preview with
     `Portraits.svg(id, { faction: 'german', era: 'cold' })`.
   - `GAME_DESIGN.md` (the game as built): a short "Factions and portraits" section with the nine
     armies, "looks only", the 85% own-names rule, and that kit era is WW2 for now.
   - `README.md`: under Playing, one paragraph on picking an army in the menu.
   - `ROADMAP.md`: one line in "What exists today" for patch 0.2a.
7. **Test** (next section).
8. **Commit and open a pull request.** Don't merge it; Kaan does that.
9. **Tick the boxes** for patch 0.2a in `IMPLEMENTATION_PLAN.md` and send Kaan the summary at the
   end of this guide.

### What the diff changes, file by file

| File | Change | Why |
| --- | --- | --- |
| `js/portraits.js` | New file, global `Portraits` | Faces, faction kit per era, names. Visual only, own random stream. |
| `index.html` | Loads `js/portraits.js` just before `js/ui.js` | `UI`, `Menu` and `Main` use it. |
| `js/game.js` | `newPlayer` gets `faction: null, kitEra: 'ww2'`; `spawnUnit` copies both onto the unit | Stored at training time, so veterans keep their old kit (DD K). No `Portraits` call in the simulation. |
| `js/main.js` | `start(mapId, difficulty, faction)`; sets the player's faction and a different random one for the AI | Faction choice. The third argument is optional, so `Main.start('highland', 'normal')` still works. |
| `js/menu.js` | "Your army" row of buttons under Difficulty | Faction picker. |
| `js/ui.js` | `soldierName(u)`, `portraitEl(u, size)`, `armyLabel(owner)`; `card()` accepts an `img`; `unitPanel` and the garrison tooltip use them | The only UI hook. Keep it this small. |
| `style.css` | `.card img.portrait` 64 px; `.diffrow` wraps | Portrait size; nine army buttons fit on narrow screens. |

## Testing

Serve with `python serve.py 8765` (the repo's no-cache server) and open `http://127.0.0.1:8765`.
Never use `python -m http.server`; the browser keeps old scripts.

In the game:

1. The menu shows **Your army** with nine buttons. Pick Soviet and start Highland Pass.
2. Click one of your soldiers. The panel shows a portrait, a name like "Pvt. Ivan Petrov" and
   "Musketeer · Soviet army".
3. Click an enemy soldier (scout or use the console). It shows a different army.
4. Click a neutral guard. It shows a mixed-look portrait and "Neutral".
5. Put a soldier in a Scout Tower and hover his icon in the tower panel: the tooltip starts with his
   short name.
6. Open the menu, pick another army, start again. Uniforms change.

In the console:

```js
[G.players[1].faction, G.players[2].faction]            // two different armies
G.units.every(u => u.kitEra === 'ww2')                  // true: later eras need research that doesn't exist yet
G.players[1].kitEra = 'modern';                          // then train a Musketeer at the HQ:
// the new soldier wears modern kit, older ones keep WW2 kit
Menu.hide(); Main.start('highland', 'normal'); Game.setSpeed(0);
for (let i = 0; i < 1800; i++) Game.update(1/30);        // headless run still works
```

And in a terminal: `grep -n "Portraits" js/game.js js/ai.js js/path.js js/fog.js js/terrain.js`
must print nothing. The simulation never calls the portrait engine.

## Do not

- **Don't implement the era triggers.** Cold War and Modern kit need research that doesn't exist
  yet (DD K: R&D Lab plus two Tier III items; the EMP part). `kitEra` stays `'ww2'` until patches
  0.5 and 0.8.
- **Don't add portraits anywhere else** (group panel, squadron bar, hover tooltips, the map). The
  UI rework decides that.
- **Don't restyle the panel or move hotkeys.** The game still uses W A D S X E for orders. The new
  layout in `DESIGN_DECISIONS.md` section 9 is built in patch 0.2.1, even if `CLAUDE.md` already
  describes it.
- **Don't edit the face, kit or name tables without asking Kaan.** Changing the order of a table or
  the random draws changes every soldier's face or name. Adding a new faction at the end is fine.
- **Don't let factions touch stats.** They are looks only; sides stay symmetric.

## Notes for later patches

- **0.2.1 (seeded randomness):** the AI's faction is chosen with `Math.random` in `Main.start`
  (there is a `TODO(patch 0.2.1)`). Derive it from the match seed instead. Faces use `u.id`; once
  a match seed exists, switch to `Portraits.seedFor(G.seed, u.id)` so the same match replays with
  the same faces. Tell Kaan all faces change once when you do.
- **0.3 (veterancy):** `soldierName` already passes `rank: u.rank || 0`. Set `u.rank` (0–3) and
  the title follows: Pvt., Cpl., Sgt., Sgt. Maj.
- **UI rework:** reuse `soldierName`, `portraitEl` and `armyLabel`. For canvas drawing use
  `Portraits.image(seed, opts)`, which caches one image per soldier.
- **0.5 and 0.8:** set `G.players[n].kitEra` to `'cold'` and `'modern'` when the triggers in
  DD K are met.

## Summary to send Kaan

Keep it short and plain:

- What changed: army picker in the menu; a portrait and name for every soldier in the selection
  panel.
- How to try it: start `python serve.py 8765`, open `http://127.0.0.1:8765`, pick an army, click a
  soldier.
- Anything that looked off, such as a headgear that doesn't fit or a name that reads badly.
