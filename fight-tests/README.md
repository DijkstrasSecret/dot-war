# Recorded fight testing, by patch

Every patch that changes combat gets a folder here: `fight-tests/<patch>/` with

- `README.md`: the report (findings in plain words first, then every number),
- `videos/`: the recorded fights, grouped, at one game second per video second (AI matches sped up),
- `data/`: the raw results as JSON.

Compare a new patch's folder with the previous one to see what a change did.

| Patch | Date | Fights | Headline |
| --- | --- | --- | --- |
| [0.8](0.8/README.md) | 1 Oct 2026 | 8 new fights × 100 runs, vehicle checks, 1 video | The armoured car rules open ground; AT Rifle teams answer it; the Field Gun cracks trenches |
| [0.7](0.7/README.md) | 1 Oct 2026 | 61 fights × 100 runs (14 new), snapshot at 100 runs, 6 big-map AI matches, 12 big-map pressure runs, siege on 7 maps, checks on 10 seeds, videos | Mortars no longer a hard counter; cover works; citadels fall to one mortar but resist 16 grenadiers; AI v AI on big maps still mostly stalls |
| [0.7b](0.7b/README.md) | 1 Oct 2026 | 8 behaviour checks, 16 fights × 40 runs against 0.7a, 3 videos | Soldiers look after themselves; head-on fights barely change, the mixed squadron gains |
| [0.6](0.6/README.md) | 30 Sept 2026 | 47 fights × 40 runs (10 new at night and in weather), 6 AI matches, snapshot, 2 videos | Seeing becomes everything: MGs and Snipers need spotters; night stops mortars |
| [0.5e](0.5e/README.md) | 30 Sept 2026 | 37 fights × 40 runs, 6 AI matches, Balance Lab snapshot (8 minutes in all) | Faster fog: 31 of 37 fights identical; mortars less dominant at range |
| [0.5d](0.5d/README.md) | 30 Sept 2026 | enemy behaviour checks, 5 AI matches, 1 video | The enemy falls back to heal, garrisons, digs in, researches and raids supply lines |
| [0.5c](0.5c/README.md) | 30 Sept 2026 | 37 fights × 40 runs, 8 sweeps, 6 AI matches | Mortar Crews dominate Riflemen in the open; standing still beats walking in; the MG rework works |

## Making a new set

The fights are defined in `lab/fight-scenarios.js`; watch any of them live in `theatre.html`.
To record a new set for patch A.B.C (needs the preview server running, Playwright with Chromium
and an ffmpeg with H.264, e.g. `pip install imageio-ffmpeg`):

1. `node fight-tests/tools/batch.js A.B.C` runs every fight 40 times plus six AI matches on all CPU
   cores (about 8 minutes on 4 cores) and writes `fight-tests/A.B.C/data/`. `node fight-tests/tools/meta.js A.B.C`
   adds the Balance Lab snapshot (about 2.5 minutes).
2. `node fight-tests/tools/record-all.js A.B.C` records the typical fight of each (and the other
   outcome when the underdog wins at least 15%) and writes the group videos to `fight-tests/A.B.C/videos/`.
3. Write `fight-tests/A.B.C/README.md` from the numbers and add a row to the table above.

These tools are for testing only; nothing in the game loads them.
