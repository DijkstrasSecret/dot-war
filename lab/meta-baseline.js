'use strict';
// Balance Lab baseline (patch 0.5b.1): LabTests.metaSnapshot({ runs: 30 }) on this build. The Meta snapshot
// section shows every new result next to these numbers. Replace only when Kaan agrees on a new baseline.
const META_BASELINE = {
 "build": "see PATCH_NOTES.md",
 "duels": [
  {
   "a": "rifle",
   "nA": 6,
   "b": "rifle",
   "nB": 6,
   "winA": 50,
   "winB": 50,
   "draw": 0,
   "time": 19.3,
   "survA": 1.93,
   "survB": 1.63
  },
  {
   "a": "rifle",
   "nA": 6,
   "b": "hmg",
   "nB": 6,
   "winA": 0,
   "winB": 100,
   "draw": 0,
   "time": 7.91,
   "survA": 0,
   "survB": 5.7
  },
  {
   "a": "rifle",
   "nA": 6,
   "b": "sniper",
   "nB": 6,
   "winA": 10,
   "winB": 90,
   "draw": 0,
   "time": 12.4,
   "survA": 0.3,
   "survB": 3.93
  },
  {
   "a": "rifle",
   "nA": 6,
   "b": "mortar",
   "nB": 3,
   "winA": 33.33,
   "winB": 66.67,
   "draw": 0,
   "time": 11.38,
   "survA": 1.03,
   "survB": 1.27
  },
  {
   "a": "hmg",
   "nA": 6,
   "b": "hmg",
   "nB": 6,
   "winA": 63.33,
   "winB": 33.33,
   "draw": 3.33,
   "time": 24.98,
   "survA": 2.83,
   "survB": 1.43
  },
  {
   "a": "hmg",
   "nA": 6,
   "b": "sniper",
   "nB": 6,
   "winA": 96.67,
   "winB": 3.33,
   "draw": 0,
   "time": 6.31,
   "survA": 4.1,
   "survB": 0.17
  },
  {
   "a": "hmg",
   "nA": 6,
   "b": "mortar",
   "nB": 3,
   "winA": 100,
   "winB": 0,
   "draw": 0,
   "time": 3.92,
   "survA": 4.27,
   "survB": 0
  },
  {
   "a": "sniper",
   "nA": 6,
   "b": "sniper",
   "nB": 6,
   "winA": 63.33,
   "winB": 36.67,
   "draw": 0,
   "time": 6.44,
   "survA": 1.97,
   "survB": 1.1
  },
  {
   "a": "sniper",
   "nA": 6,
   "b": "mortar",
   "nB": 3,
   "winA": 86.67,
   "winB": 13.33,
   "draw": 0,
   "time": 5.96,
   "survA": 2.63,
   "survB": 0.27
  },
  {
   "a": "mortar",
   "nA": 3,
   "b": "mortar",
   "nB": 3,
   "winA": 53.33,
   "winB": 46.67,
   "draw": 0,
   "time": 2.56,
   "survA": 1.23,
   "survB": 0.73
  }
 ],
 "terrain": [
  {
   "label": "5 v 5 Riflemen, flat",
   "runs": 50,
   "winA": 50,
   "winB": 50,
   "draw": 0,
   "avgTime": 18.63,
   "avgSurvivorsA": 1.44,
   "avgSurvivorsB": 1.4,
   "avgPin": 5.09,
   "pinnedRuns": 40
  },
  {
   "label": "B 30 m higher",
   "runs": 50,
   "winA": 26,
   "winB": 74,
   "draw": 0,
   "avgTime": 17.67,
   "avgSurvivorsA": 0.7,
   "avgSurvivorsB": 2.04,
   "avgPin": 5.09,
   "pinnedRuns": 42
  },
  {
   "label": "B in forest",
   "runs": 50,
   "winA": 0,
   "winB": 100,
   "draw": 0,
   "avgTime": 16.22,
   "avgSurvivorsA": 0,
   "avgSurvivorsB": 4.02,
   "avgPin": 4.88,
   "pinnedRuns": 37
  },
  {
   "label": "6 v 6, A as a squadron",
   "runs": 50,
   "winA": 62,
   "winB": 38,
   "draw": 0,
   "avgTime": 17.85,
   "avgSurvivorsA": 2.24,
   "avgSurvivorsB": 1.22,
   "avgPin": 4.47,
   "pinnedRuns": 49
  },
  {
   "label": "MG pins a Rifleman",
   "runs": 50,
   "winA": 0,
   "winB": 6,
   "draw": 94,
   "avgTime": 5.18,
   "avgSurvivorsA": 0.94,
   "avgSurvivorsB": 1,
   "avgPin": 4.9,
   "pinnedRuns": 47
  }
 ],
 "forts": [
  {
   "label": "8 Riflemen v 5 in the open",
   "runs": 30,
   "winA": 100,
   "winB": 0,
   "draw": 0,
   "avgTime": 16.78,
   "avgSurvivorsA": 6.67,
   "avgSurvivorsB": 0,
   "avgGrenades": 0
  },
  {
   "label": "8 v 5 in a trench",
   "runs": 30,
   "winA": 70,
   "winB": 30,
   "draw": 0,
   "avgTime": 24.71,
   "avgSurvivorsA": 3.17,
   "avgSurvivorsB": 1,
   "avgGrenades": 0
  },
  {
   "label": "8 with grenades v 5 in a trench",
   "runs": 30,
   "winA": 100,
   "winB": 0,
   "draw": 0,
   "avgTime": 8.19,
   "avgSurvivorsA": 7.13,
   "avgSurvivorsB": 0,
   "avgGrenades": 8
  },
  {
   "label": "8 grenadiers v full Bunker (5 inside)",
   "runs": 30,
   "winA": 13.33,
   "winB": 86.67,
   "draw": 0,
   "avgTime": 17.39,
   "avgSurvivorsA": 0.73,
   "avgSurvivorsB": 1.93,
   "avgGrenades": 5.73
  },
  {
   "label": "10 grenadiers v full Bunker (5 inside)",
   "runs": 30,
   "winA": 96.67,
   "winB": 3.33,
   "draw": 0,
   "avgTime": 6.37,
   "avgSurvivorsA": 6.6,
   "avgSurvivorsB": 0.03,
   "avgGrenades": 7.53
  }
 ],
 "economy": {
  "tier2Min": 1.47,
  "at5": {
   "t": 300,
   "wood": 855.69,
   "metal": 371.33,
   "sulfur": 0,
   "workers": 8
  },
  "at10": {
   "t": 600,
   "wood": 1563.5,
   "metal": 768.43,
   "sulfur": 0,
   "workers": 8
  },
  "at15": {
   "t": 900,
   "wood": 2280.99,
   "metal": 1169.02,
   "sulfur": 0,
   "workers": 8
  },
  "at20": {
   "t": 1200,
   "wood": 2997.45,
   "metal": 1566.61,
   "sulfur": 0,
   "workers": 8
  }
 },
 "ai": [
  {
   "seed": 1,
   "difficulty": "easy",
   "firstContactMin": 6.34,
   "hqFellMin": 8.48,
   "raids": 1,
   "log": [
    {
     "min": 0,
     "aiArmy": 6,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 1,
     "aiArmy": 8,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 2,
     "aiArmy": 8,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 3,
     "aiArmy": 8,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 4,
     "aiArmy": 8,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 5,
     "aiArmy": 10,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 6,
     "aiArmy": 10,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 7,
     "aiArmy": 9,
     "playerUnits": 8,
     "hqHp": 1206,
     "kills": 1,
     "lost": 2
    },
    {
     "min": 8,
     "aiArmy": 9,
     "playerUnits": 8,
     "hqHp": 412,
     "kills": 1,
     "lost": 2
    }
   ]
  },
  {
   "seed": 1,
   "difficulty": "normal",
   "firstContactMin": 6.31,
   "hqFellMin": 8.06,
   "raids": 1,
   "log": [
    {
     "min": 0,
     "aiArmy": 9,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 1,
     "aiArmy": 11,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 2,
     "aiArmy": 11,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 3,
     "aiArmy": 11,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 4,
     "aiArmy": 11,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 5,
     "aiArmy": 13,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 6,
     "aiArmy": 13,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 7,
     "aiArmy": 13,
     "playerUnits": 8,
     "hqHp": 1100,
     "kills": 1,
     "lost": 2
    },
    {
     "min": 8,
     "aiArmy": 13,
     "playerUnits": 8,
     "hqHp": 64,
     "kills": 1,
     "lost": 2
    }
   ]
  },
  {
   "seed": 1,
   "difficulty": "hard",
   "firstContactMin": 6.31,
   "hqFellMin": 7.49,
   "raids": 1,
   "log": [
    {
     "min": 0,
     "aiArmy": 12,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 1,
     "aiArmy": 14,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 2,
     "aiArmy": 14,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 3,
     "aiArmy": 14,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 4,
     "aiArmy": 14,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 5,
     "aiArmy": 16,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 6,
     "aiArmy": 16,
     "playerUnits": 10,
     "hqHp": 1500,
     "kills": 0,
     "lost": 0
    },
    {
     "min": 7,
     "aiArmy": 16,
     "playerUnits": 9,
     "hqHp": 866,
     "kills": 2,
     "lost": 1
    }
   ]
  }
 ]
};
