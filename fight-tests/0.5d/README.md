# Fight testing: patch 0.5d (30 September 2026)

Patch 0.5d changed only the enemy commander (see `PATCH_NOTES.md`): no unit stats changed, so the
37 set-piece fights of [0.5c](../0.5c/README.md) still hold and were not re-run. This set looks at
what the new enemy does.

## What was checked

| Check | Result |
| --- | --- |
| Falls back to heal | Up to 10 soldiers a side were walking home to heal at once in a 40-minute AI match. |
| Garrisons the HQ | Both sides filled their HQ (6 soldiers) when attacked and let them out afterwards. |
| Digs in | On Highland Pass the enemy finished a 100 m trench across the road a minute before its first raid (Normal, 5.5 min). The first try placed it on a slope nobody could reach; the AI now tries 80 to 190 m out and takes the spot where most of it can be dug. |
| Researches | All eight timetable items arrived on time (Drill 6 min … Storm Troops 25 min on Normal). |
| Supply raids | Against a player with a mine out on the map, three enemy Riflemen checked the nearest deposits, found the mine at 9.7 min and destroyed it by 13 min. |
| A bug found on the way | Some enemy garrison soldiers used to start on cliff cells they could never walk off; they now start on the nearest walkable ground. |
| Pressure on a player who stays home | HQ lost at 11.9 / 8.0 / 5.8 min on Easy / Normal / Hard (0.5c: 12.0 / 8.5 / 6.1). |
| Balance Lab targets | Unchanged: MG pin 4.9 s, height 74%, squadron 59%, first Tier II at 1.5 min. |

## AI v AI, Highland Pass, 40 minute cap

| Difficulty | Seed | Result | Kills blue / red (0.5d) | Kills blue / red (0.5c) |
| --- | --- | --- | --- | --- |
| Easy | 1 | No HQ fell in 40 min | 64 / 32 | 62 / 61 |
| Easy | 2 | No HQ fell in 40 min | 41 / 25 | 70 / 58 |
| Normal | 1 | No HQ fell in 40 min | 102 / 61 | 126 / 107 |
| Normal | 2 | No HQ fell in 40 min | 148 / 67 | 132 / 117 |
| Hard | 1 | No HQ fell in 40 min | 143 / 134 | 173 / 166 |
| Hard | 2 | not run this time (stopped to save time; in 0.5c blue won at 28 min) | | 146 / 96 |

Mostly fewer kills than in 0.5c: wounded soldiers now walk home instead of dying, and trenches and garrisons make attacks costlier. Matches still end in stalemates, which the AI's siege play (0.7) should fix.

## Video

| File | What's inside | Length |
| --- | --- | --- |
| [Dot-War-AI-match-normal-seed1-8x.mp4](videos/Dot-War-AI-match-normal-seed1-8x.mp4) | AI v AI on Normal, 40 minutes at 8× speed. Watch the trenches across the road near both bases, the HQ garrisons and the wounded walking home. | 5 min |
