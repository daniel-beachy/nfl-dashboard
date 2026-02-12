// ── Team & Division Config ──────────────────────────────────────────

const DIVISION_TEAMS = {
  'AFC East':  ['BUF', 'MIA', 'NE', 'NYJ'],
  'AFC North': ['BAL', 'CIN', 'CLE', 'PIT'],
  'AFC South': ['HOU', 'IND', 'JAX', 'TEN'],
  'AFC West':  ['DEN', 'KC', 'LAC', 'LV'],
  'NFC East':  ['DAL', 'NYG', 'PHI', 'WAS'],
  'NFC North': ['CHI', 'DET', 'GB', 'MIN'],
  'NFC South': ['ATL', 'CAR', 'NO', 'TB'],
  'NFC West':  ['ARI', 'LAR', 'SF', 'SEA'],
};

// Chart-friendly colors (tuned for dark backgrounds, distinct within each division)
const TEAM_INFO = {
  // AFC East
  BUF: { name: 'Bills',       color: '#648FFF' },
  MIA: { name: 'Dolphins',    color: '#00CED1' },
  NE:  { name: 'Patriots',    color: '#DC267F' },
  NYJ: { name: 'Jets',        color: '#44D62C' },
  // AFC North
  BAL: { name: 'Ravens',      color: '#9B6BFF' },
  CIN: { name: 'Bengals',     color: '#FF8C00' },
  CLE: { name: 'Browns',      color: '#C77A3C' },
  PIT: { name: 'Steelers',    color: '#FFD700' },
  // AFC South
  HOU: { name: 'Texans',      color: '#E74C3C' },
  IND: { name: 'Colts',       color: '#3B9FE0' },
  JAX: { name: 'Jaguars',     color: '#1ABC9C' },
  TEN: { name: 'Titans',      color: '#85C1E9' },
  // AFC West
  KC:  { name: 'Chiefs',      color: '#FF2D55' },
  DEN: { name: 'Broncos',     color: '#FF8C42' },
  LAC: { name: 'Chargers',    color: '#00BFFF' },
  LV:  { name: 'Raiders',     color: '#C0C0C0' },
  // NFC East
  DAL: { name: 'Cowboys',     color: '#7EB6FF' },
  NYG: { name: 'Giants',      color: '#3D6DE0' },
  PHI: { name: 'Eagles',      color: '#2ECC71' },
  WAS: { name: 'Commanders',  color: '#E05050' },
  // NFC North
  CHI: { name: 'Bears',       color: '#E67E22' },
  DET: { name: 'Lions',       color: '#2E9FD6' },
  GB:  { name: 'Packers',     color: '#27AE60' },
  MIN: { name: 'Vikings',     color: '#9B59E6' },
  // NFC South
  ATL: { name: 'Falcons',     color: '#FF4757' },
  CAR: { name: 'Panthers',    color: '#45AAF2' },
  NO:  { name: 'Saints',      color: '#F0C040' },
  TB:  { name: 'Buccaneers',  color: '#FF6348' },
  // NFC West
  ARI: { name: 'Cardinals',   color: '#E84393' },
  LAR: { name: 'Rams',        color: '#5A7FD6' },
  SF:  { name: '49ers',       color: '#E63C30' },
  SEA: { name: 'Seahawks',    color: '#7ED321' },
};

// Render order: pairs AFC/NFC by geographic division
const DIVISION_ORDER = [
  'AFC East', 'NFC East',
  'AFC North', 'NFC North',
  'AFC South', 'NFC South',
  'AFC West', 'NFC West',
];

// ── Utilities ───────────────────────────────────────────────────────

function getSeason() {
  const now = new Date();
  const month = now.getMonth() + 1;
  return month <= 2 ? now.getFullYear() - 1 : now.getFullYear();
}

function formatLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const month = d.getMonth() + 1;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (month >= 3 && month <= 8) return months[month - 1];
  return `${months[month - 1]} ${d.getDate()}`;
}

function divisionToCanvasId(division) {
  return 'chart-' + division.toLowerCase().replace(' ', '-');
}

// ── Chart.js Setup ──────────────────────────────────────────────────

// Vertical crosshair plugin
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    const active = chart.tooltip?.getActiveElements();
    if (active && active.length) {
      const x = active[0].element.x;
      const { top, bottom } = chart.scales.y;
      const ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.stroke();
      ctx.restore();
    }
  }
};
Chart.register(crosshairPlugin);

// Global defaults
Chart.defaults.color = '#999';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';

const charts = {};

function createChart(canvasId, division, snapshots) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = snapshots.map(s => formatLabel(s.date));
  const teams = DIVISION_TEAMS[division] || [];

  const datasets = teams.map(abbr => {
    const info = TEAM_INFO[abbr] || { name: abbr, color: '#888' };
    return {
      label: abbr,
      data: snapshots.map(s => {
        const val = s.divisions?.[division]?.[abbr];
        return val != null ? +(val * 100).toFixed(1) : null;
      }),
      borderColor: info.color,
      backgroundColor: info.color + '20',
      borderWidth: 2.5,
      pointRadius: snapshots.length === 1 ? 5 : 4,
      pointHoverRadius: 6,
      tension: 0.3,
      spanGaps: true,
    };
  });

  if (charts[canvasId]) {
    charts[canvasId].destroy();
  }

  charts[canvasId] = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: v => v + '%',
            stepSize: 25,
          },
        },
        x: {
          ticks: {
            maxRotation: 45,
          },
        },
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 14,
            padding: 12,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            title: items => {
              const idx = items[0]?.dataIndex;
              if (idx == null) return '';
              return snapshots[idx]?.date || '';
            },
            label: ctx => {
              const abbr = ctx.dataset.label;
              const info = TEAM_INFO[abbr];
              const name = info ? `${abbr} ${info.name}` : abbr;
              return `${name}: ${ctx.parsed.y.toFixed(1)}%`;
            },
          },
        },
      },
    },
  });
}

// ── Data Loading ────────────────────────────────────────────────────

async function loadSnapshots(season) {
  const res = await fetch(`data/${season}/division-odds/index.json`);
  if (!res.ok) return [];

  const files = await res.json();
  const snapshots = await Promise.all(
    files.map(async f => {
      const r = await fetch(`data/${season}/division-odds/${f}`);
      return r.ok ? r.json() : null;
    })
  );
  return snapshots.filter(Boolean);
}

// ── Tab Switching ───────────────────────────────────────────────────

function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      const section = document.getElementById(tab.dataset.tab);
      if (section) section.classList.add('active');
    });
  });
}

// ── Season Selector ─────────────────────────────────────────────────

async function loadSeasons() {
  try {
    const res = await fetch('data/seasons.json');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function initSeasonSelect(seasons, defaultSeason) {
  const select = document.getElementById('season-select');
  select.innerHTML = '';
  seasons.forEach(y => {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `${y} Season`;
    select.appendChild(opt);
  });
  select.value = seasons.includes(defaultSeason) ? defaultSeason : seasons[0];
  select.addEventListener('change', () => renderDashboard(parseInt(select.value)));
  return parseInt(select.value);
}

// ── Render ──────────────────────────────────────────────────────────

async function renderDashboard(season) {
  const emptyState = document.getElementById('empty-state');
  const chartsSection = document.getElementById('division-odds');
  const lastUpdated = document.getElementById('last-updated');

  const snapshots = await loadSnapshots(season);

  if (snapshots.length === 0) {
    chartsSection.style.display = 'none';
    emptyState.style.display = 'block';
    lastUpdated.textContent = '';
    return;
  }

  chartsSection.style.display = '';
  emptyState.style.display = 'none';

  const latest = snapshots[snapshots.length - 1];
  lastUpdated.textContent = `Updated: ${latest.date}`;

  DIVISION_ORDER.forEach(division => {
    createChart(divisionToCanvasId(division), division, snapshots);
  });
}

// ── Init ────────────────────────────────────────────────────────────

async function init() {
  initTabs();

  const seasons = await loadSeasons();
  if (seasons.length === 0) {
    document.getElementById('division-odds').style.display = 'none';
    document.getElementById('empty-state').style.display = 'block';
    return;
  }

  const activeSeason = initSeasonSelect(seasons, getSeason());
  await renderDashboard(activeSeason);
}

init();
