const fs = require('fs');
const path = require('path');

const DIVISION_FUTURES = {
  'AFC East': 2740,
  'AFC North': 2738,
  'AFC South': 2737,
  'AFC West': 2739,
  'NFC East': 3906,
  'NFC North': 3905,
  'NFC South': 3908,
  'NFC West': 3907,
};

const TEAMS = {
  1:  { abbr: 'ATL', name: 'Atlanta Falcons' },
  2:  { abbr: 'BUF', name: 'Buffalo Bills' },
  3:  { abbr: 'CHI', name: 'Chicago Bears' },
  4:  { abbr: 'CIN', name: 'Cincinnati Bengals' },
  5:  { abbr: 'CLE', name: 'Cleveland Browns' },
  6:  { abbr: 'DAL', name: 'Dallas Cowboys' },
  7:  { abbr: 'DEN', name: 'Denver Broncos' },
  8:  { abbr: 'DET', name: 'Detroit Lions' },
  9:  { abbr: 'GB',  name: 'Green Bay Packers' },
  10: { abbr: 'TEN', name: 'Tennessee Titans' },
  11: { abbr: 'IND', name: 'Indianapolis Colts' },
  12: { abbr: 'KC',  name: 'Kansas City Chiefs' },
  13: { abbr: 'LV',  name: 'Las Vegas Raiders' },
  14: { abbr: 'LAR', name: 'Los Angeles Rams' },
  15: { abbr: 'MIA', name: 'Miami Dolphins' },
  16: { abbr: 'MIN', name: 'Minnesota Vikings' },
  17: { abbr: 'NE',  name: 'New England Patriots' },
  18: { abbr: 'NO',  name: 'New Orleans Saints' },
  19: { abbr: 'NYG', name: 'New York Giants' },
  20: { abbr: 'NYJ', name: 'New York Jets' },
  21: { abbr: 'PHI', name: 'Philadelphia Eagles' },
  22: { abbr: 'ARI', name: 'Arizona Cardinals' },
  23: { abbr: 'PIT', name: 'Pittsburgh Steelers' },
  24: { abbr: 'LAC', name: 'Los Angeles Chargers' },
  25: { abbr: 'SF',  name: 'San Francisco 49ers' },
  26: { abbr: 'SEA', name: 'Seattle Seahawks' },
  27: { abbr: 'TB',  name: 'Tampa Bay Buccaneers' },
  28: { abbr: 'WAS', name: 'Washington Commanders' },
  29: { abbr: 'CAR', name: 'Carolina Panthers' },
  30: { abbr: 'JAX', name: 'Jacksonville Jaguars' },
  33: { abbr: 'BAL', name: 'Baltimore Ravens' },
  34: { abbr: 'HOU', name: 'Houston Texans' },
};

function getSeason() {
  if (process.env.NFL_SEASON) return parseInt(process.env.NFL_SEASON);
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  return month <= 2 ? year - 1 : year;
}

function americanToImplied(oddsStr) {
  const odds = parseInt(oddsStr);
  if (isNaN(odds)) return 0;
  if (odds < 0) return Math.abs(odds) / (Math.abs(odds) + 100);
  return 100 / (odds + 100);
}

async function fetchDivisionOdds(divisionName, futureId, season) {
  const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${season}/futures/${futureId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${divisionName}`);
  const data = await res.json();

  const books = data.futures?.[0]?.books || [];
  if (books.length === 0) throw new Error(`No odds data for ${divisionName}`);

  const rawOdds = {};
  for (const book of books) {
    const teamRef = book.team?.$ref || '';
    const teamIdMatch = teamRef.match(/teams\/(\d+)/);
    if (!teamIdMatch) continue;

    const team = TEAMS[teamIdMatch[1]];
    if (!team) {
      console.warn(`  Unknown team ID: ${teamIdMatch[1]}`);
      continue;
    }
    rawOdds[team.abbr] = americanToImplied(book.value);
  }

  // Normalize so probabilities sum to 1.0
  const total = Object.values(rawOdds).reduce((sum, v) => sum + v, 0);
  if (total === 0) throw new Error(`All zero odds for ${divisionName}`);

  const normalized = {};
  for (const [abbr, prob] of Object.entries(rawOdds)) {
    normalized[abbr] = Math.round((prob / total) * 10000) / 10000;
  }
  return normalized;
}

async function main() {
  const season = getSeason();
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  console.log(`Fetching division odds for ${season} season (${dateStr})`);

  const snapshot = {
    date: dateStr,
    season: season,
    divisions: {},
  };

  for (const [division, futureId] of Object.entries(DIVISION_FUTURES)) {
    process.stdout.write(`  ${division}...`);
    try {
      snapshot.divisions[division] = await fetchDivisionOdds(division, futureId, season);
      console.log(' OK');
    } catch (err) {
      console.log(` FAILED: ${err.message}`);
    }
  }

  if (Object.keys(snapshot.divisions).length === 0) {
    console.error('No division data fetched. Exiting without writing.');
    process.exit(1);
  }

  // Write snapshot file
  const dataDir = path.join(__dirname, '..', 'data', String(season), 'division-odds');
  fs.mkdirSync(dataDir, { recursive: true });

  const snapshotPath = path.join(dataDir, `${dateStr}.json`);
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`\nSnapshot saved: data/${season}/division-odds/${dateStr}.json`);

  // Update index
  const indexPath = path.join(dataDir, 'index.json');
  let index = [];
  if (fs.existsSync(indexPath)) {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  }
  const filename = `${dateStr}.json`;
  if (!index.includes(filename)) {
    index.push(filename);
    index.sort();
  }
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`Index updated (${index.length} total snapshots)`);

  // Update seasons manifest
  const seasonsPath = path.join(__dirname, '..', 'data', 'seasons.json');
  let seasons = [];
  if (fs.existsSync(seasonsPath)) {
    seasons = JSON.parse(fs.readFileSync(seasonsPath, 'utf-8'));
  }
  if (!seasons.includes(season)) {
    seasons.push(season);
    seasons.sort((a, b) => b - a);
    fs.writeFileSync(seasonsPath, JSON.stringify(seasons, null, 2));
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
