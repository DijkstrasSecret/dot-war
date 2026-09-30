# Recorded fight testing, by patch

Every patch that changes combat gets a folder here: `fight-tests/<patch>/` with

- `README.md`: the report (findings in plain words first, then every number),
- `videos/`: the recorded fights, grouped, at one game second per video second (AI matches sped up),
- `data/`: the raw results as JSON.

Compare a new patch's folder with the previous one to see what a change did.

| Patch | Date | Fights | Headline |
| --- | --- | --- | --- |
| [0.5c](0.5c/README.md) | 30 Sept 2026 | 37 fights × 40 runs, 8 sweeps, 6 AI matches | Mortar Crews dominate Riflemen in the open; standing still beats walking in; the MG rework works |

## Making a new set

The fights are defined in `lab/fight-scenarios.js`; watch any of them live in `theatre.html`.
To record a new set for patch A.B.C (needs the preview server running, Playwright with Chromium
and an ffmpeg with H.264, e.g. `pip install imageio-ffmpeg`):

1. `node fight-tests/tools/batch.js A.B.C` runs every fight 40 times plus six AI matches (about an
   hour) and writes `fight-tests/A.B.C/data/`.
2. `node fight-tests/tools/record-all.js A.B.C` records the typical fight of each (and the other
   outcome when the underdog wins at least 15%) and writes the group videos to `fight-tests/A.B.C/videos/`.
3. Write `fight-tests/A.B.C/README.md` from the numbers and add a row to the table above.

These tools are for testing only; nothing in the game loads them.
