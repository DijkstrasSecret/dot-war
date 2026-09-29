# Dot War

A browser real-time strategy game where every unit is a simple shape with a logo inside it,
fought on a topographic map where elevation decides everything.

- Circles are infantry (worker, rifle, machine gun, sniper), squares are crew weapons (mortar).
  Rectangles (trucks, armoured vehicles) and triangles (bikes, armoured cars) are planned.
- The map is a heightmap drawn like a hiking map: contour lines every 10 m, bold lines every 50 m,
  forests, rivers with bridges, swamp, roads and resource deposits.
- High ground gives vision, range and damage. Ridges block sight and bullets. Steep slopes are slow
  or impassable. Forests hide units and give cover. Scout Towers add height to whoever is inside.
- You harvest wood, metal and sulfur (rubber and oil are placed on the map for later patches),
  research better blueprints, train units and destroy the enemy headquarters on the mountain.

Plain HTML, CSS and JavaScript. No build step, no dependencies.

## Run it

Open `index.html` in a browser (Chrome or Edge recommended), or serve the folder with the
included no-cache dev server:

```bash
python serve.py 8765
```

and open <http://localhost:8765>. The Claude Code preview uses the same command via
`.claude/launch.json`. Do not use `python -m http.server` for development: it lets the browser
cache the scripts and you will test stale code.

## Balance Lab

With the dev server running, open <http://localhost:8765/lab.html>. It runs the real game rules
with no map drawing: unit duels (pick the sides, the ground and the number of runs), an economy
timeline for a standard opening, and AI-versus-AI matches. "Run the target duels" fills the target
table; results outside the agreed ranges in `lab/balance-targets.js` turn red. Every run is
seeded, so the same settings give the same numbers.

## Deploy it

The game is static files, so any web server that serves this folder works. `deploy.sh` copies
`index.html`, `style.css`, `js/` and `assets/` to a web root over SSH with rsync:

```bash
DEPLOY_HOST=user@dotwarz.duckdns.org DEPLOY_PATH=/var/www/dotwar ./deploy.sh
```

`DEPLOY_PORT` and `DEPLOY_KEY` override the SSH port and key. Point the site's document root at
`DEPLOY_PATH` and the game loads at the domain; no server-side code is needed.

## Playing

The game opens on a painted start menu: New game, Continue, Music and Controls. New game offers
four maps and three difficulties. Hard is the original tuning; Easy and
Normal shrink the enemy garrison, slow its production and space out its raids. Open Valley is a
sandbox with neutral guards and no enemy commander.

Time runs at a calm pace at 1x; 2x is the tempo of the first build. All timers in the game data are
in game seconds.

The menu's "Your army" row picks one of nine armies (British, American, French, German, Italian,
Polish, Soviet, Turkish, Spanish). It changes uniforms, headgear and soldiers' names only; every
army plays the same. The enemy gets a different army at random. Click a soldier to see his
portrait and name in the selection panel.

| Action | Input |
| --- | --- |
| Select | Left click, drag a box, Shift adds, double click picks all of a type, Ctrl+A all on screen |
| Smart command | Right click: ground moves, an enemy attacks, your camp/mine/tapper/refinery puts them to work, your tower, Bunker or HQ garrisons it, your Truck is boarded, your unfinished line is dug on; with a gatherer or Depot selected, right click a Depot to set its supply link |
| Attack-move | F then click an enemy or a point; mortars bombard the point |
| Defend position | R |
| Retreat towards base | G (not slowed by suppression, sheds stress twice as fast) |
| Stop | X |
| Enter / exit | E then click a camp, mine, tapper, refinery, tower, Bunker, the HQ or a Truck; Q unloads a selected Truck |
| Special orders | K fill a trench (Workers), V grenade (Riflemen), M smoke (mortars), C demolition charge (after their research) |
| Queue orders | Hold Shift while giving commands |
| Build | B opens the Build tab; only then a letter picks: L Lumber Camp, M Mine, Z Rubber Tapper, F Refinery, C Barracks, O Ordnance Works, K Workshop, G Depot, R R&D Lab, T Scout Tower, U Bunker, P Field Hospital; lines (drag): Y trench, I barricade, J wire, E road, V bridge |
| Research | N opens the research overview (one project per building type) |
| Factory | Z X C V train the listed units (Tab shows the next four if there are more), right click sets the rally point, Tab cycles factories |
| Tower, Bunker, HQ | T upgrade (towers), Q unload everyone, click a unit icon in the panel to unload just that one |
| Squadrons | Ctrl+1..9 with 2–12 soldiers forms a squadron (one per soldier; with nothing selected it clears); 1..9 or the squadron bar selects, twice centres; right-drag sets the line's width and facing |
| Camera | W A S D, arrow keys, screen edge, middle mouse drag, mouse wheel zoom, minimap click |
| Time | Space pause, `,` slower, `.` faster |
| Other | H jump to headquarters, F1 help, Menu button for a new game, ♫ toggles music |

You start with six Riflemen and four Workers. Workers harvest at full rate; soldiers put to work
count as half a worker. Suppressed units (yellow ring) ignore target orders and shoot the nearest
enemy. Snipers take half the stress, never panic and keep their orders. A yellow "!" appears when a unit starts taking fire, "!!" when it panics. Wounded units bleed,
the dead leave a corpse and a splash of blood, and a death shocks nearby friends.

## Project layout

```
index.html        page shell, help overlay, script load order
style.css         theme: olive panels, brass accents, stencil headings
serve.py          no-cache development server
lab.html          Balance Lab: unit duels, economy timeline, AI versus AI, with target ranges
lab/              the lab's tests (lab-tests.js, no DOM), page script and balance-targets.js
assets/music/     background music (Grieg, Violin Sonata No. 3, performed by Gregor Quendel)
assets/paintings/ menu and loading paintings, their animation engine (painting-fx.js) and README
assets/fonts/     the two serif faces of the painted screens, bundled under the Open Font License
attic/editor.js   the map editor, shelved for now (see ROADMAP.md)
js/util.js        math helpers, seeded noise, binary heap
js/data.js        all game data: units, buildings (incl. tower levels), research, difficulty, hotkeys
js/icons.js       vector logos for units, buildings, resources
js/terrain.js     heightmap, passability, line of sight, topographic renderer, map JSON
js/path.js        flow-field pathfinding (one Dijkstra per destination cell)
js/fog.js         per-player visibility by horizon-angle ray casting
js/entities.js    Unit, Building, Projectile classes
js/game.js        simulation: economy, production, research, orders, movement, combat, towers
js/ai.js          enemy commander and raids, scaled by difficulty
js/render.js      canvas drawing, decals, fog overlay, minimap
js/input.js       mouse and keyboard, command modes, camera
js/portraits.js   soldier faces, faction kit and names from a unit id (visual only)
js/ui.js          side panel and top bar (DOM)
js/maps.js        map generator and the four map specs
js/sim.js         headless runner: build a match, run ticks, replay a command log, fingerprint
js/audio.js       music player
js/loading.js     loading screen over a painting, bar driven by the build steps
js/menu.js        start menu over a painting (front page and the map, difficulty, army setup)
js/main.js        startup, match build steps and the fixed-step game loop
```

See `DEVELOPMENT.md` for how everything fits together and how to add content, and
`ROADMAP.md` for the planned patches.
