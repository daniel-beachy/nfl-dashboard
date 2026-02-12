const fs = require('fs');
const path = require('path');

// Seeded PRNG for reproducible results
let seed = 42;
function random() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return (seed >>> 0) / 0xffffffff;
}

// ── Dates ───────────────────────────────────────────────────────────

const preSeasonDates = [
  '2024-03-01', '2024-04-01', '2024-05-01',
  '2024-06-01', '2024-07-01', '2024-08-01',
];

// Weekly Tuesdays from Sep 10, 2024 through Feb 4, 2025
function getInSeasonTuesdays() {
  const out = [];
  let d = new Date(Date.UTC(2024, 8, 10)); // Sep 10
  const end = new Date(Date.UTC(2025, 1, 4)); // Feb 4
  while (d <= end) {
    out.push(d.toISOString().split('T')[0]);
    d = new Date(d.getTime() + 7 * 86400000);
  }
  return out;
}

const allDates = [...preSeasonDates, ...getInSeasonTuesdays()];

// ── Division "Strength" Curves ──────────────────────────────────────
// Each team has 5 waypoints: [preseason, early, mid, late, final]
// Raw strength values — normalized to percentages later.

const curves = {
  'AFC East': {
    BUF: [40, 42, 50, 62, 75],  // Clear favorite, pulls away
    MIA: [30, 32, 26, 18, 12],  // Starts strong, injury collapse
    NYJ: [18, 16, 15, 13, 9],   // Steady mediocrity
    NE:  [12, 10, 9, 7, 4],     // Rebuilding
  },
  'AFC North': {
    BAL: [33, 36, 42, 52, 60],  // Builds momentum all season
    CIN: [30, 28, 24, 20, 16],  // Good but fading
    PIT: [17, 16, 20, 18, 19],  // Gritty, hangs around
    CLE: [20, 20, 14, 10, 5],   // Starts OK, collapses
  },
  'AFC South': {
    HOU: [26, 30, 42, 55, 68],  // Breakout team of the year
    JAX: [38, 34, 25, 16, 10],  // Preseason darling, big disappointment
    IND: [24, 24, 22, 21, 17],  // Competitive but not enough
    TEN: [12, 12, 11, 8, 5],    // Bottom feeder
  },
  'AFC West': {
    KC:  [50, 52, 60, 72, 85],  // Dynasty continues
    LAC: [22, 20, 17, 12, 6],   // Fades
    DEN: [17, 18, 15, 11, 6],   // Disappointing
    LV:  [11, 10, 8, 5, 3],     // Worst in division
  },
  'NFC East': {
    PHI: [33, 30, 34, 44, 52],  // Slow start, strong finish
    DAL: [35, 36, 32, 25, 18],  // Expectations collapse
    WAS: [14, 18, 22, 22, 24],  // Surprise team! Steady rise
    NYG: [18, 16, 12, 9, 6],    // Disappointing
  },
  'NFC North': {
    DET: [32, 38, 44, 48, 55],  // Builds on prior success
    GB:  [26, 24, 24, 26, 23],  // Competitive all year
    MIN: [24, 22, 20, 17, 15],  // Middle of the pack
    CHI: [18, 16, 12, 9, 7],    // Young team growing pains
  },
  'NFC South': {
    ATL: [26, 28, 32, 36, 42],  // Gradual favorite emerges
    TB:  [24, 22, 25, 30, 32],  // Late surge, makes it interesting
    NO:  [32, 30, 26, 20, 16],  // Preseason favorite falls off
    CAR: [18, 20, 17, 14, 10],  // Brief hope, then reality
  },
  'NFC West': {
    SF:  [44, 46, 52, 60, 70],  // Clear best team
    LAR: [24, 22, 22, 18, 14],  // Solid but outmatched
    SEA: [20, 22, 18, 15, 11],  // Inconsistent
    ARI: [12, 10, 8, 7, 5],     // Rebuilding
  },
};

// ── Interpolation & Generation ──────────────────────────────────────

function interpolate(waypoints, t) {
  const n = waypoints.length - 1;
  const pos = t * n;
  const i = Math.min(Math.floor(pos), n - 1);
  const frac = pos - i;
  return waypoints[i] + (waypoints[i + 1] - waypoints[i]) * frac;
}

const dataDir = path.join(__dirname, '..', 'data', '2024', 'division-odds');
fs.mkdirSync(dataDir, { recursive: true });

const index = [];

allDates.forEach((dateStr, di) => {
  const t = allDates.length === 1 ? 0 : di / (allDates.length - 1);

  // Less noise pre-season (fewer data points), more in-season (game results)
  const isPreSeason = di < preSeasonDates.length;
  const noiseScale = isPreSeason ? 1.5 : 3.5;

  const snapshot = { date: dateStr, season: 2024, divisions: {} };

  for (const [div, teams] of Object.entries(curves)) {
    const raw = {};
    let total = 0;
    for (const [team, wp] of Object.entries(teams)) {
      let val = interpolate(wp, t) + (random() - 0.5) * noiseScale;
      val = Math.max(val, 0.5);
      raw[team] = val;
      total += val;
    }
    const normalized = {};
    for (const [team, val] of Object.entries(raw)) {
      normalized[team] = Math.round((val / total) * 10000) / 10000;
    }
    snapshot.divisions[div] = normalized;
  }

  const filename = `${dateStr}.json`;
  fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(snapshot, null, 2));
  index.push(filename);
});

fs.writeFileSync(path.join(dataDir, 'index.json'), JSON.stringify(index, null, 2));
console.log(`Generated ${allDates.length} snapshots for 2024 test season`);

// Update seasons.json
const seasonsPath = path.join(__dirname, '..', 'data', 'seasons.json');
let seasons = [];
if (fs.existsSync(seasonsPath)) {
  seasons = JSON.parse(fs.readFileSync(seasonsPath, 'utf-8'));
}
if (!seasons.includes(2024)) {
  seasons.push(2024);
  seasons.sort((a, b) => b - a);
  fs.writeFileSync(seasonsPath, JSON.stringify(seasons, null, 2));
}
console.log('Updated data/seasons.json');
