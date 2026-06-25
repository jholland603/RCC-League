/* player.js — Player gross-score comparison */

let leagueData = null;
let allRosterPlayers = []; // flat list of { name, team, flight, stats } for all 128 regular roster players (no subs)
let chartInstance = null;

const BUCKETS = [
  { key: 'eagles',        label: 'Eagles or better' },
  { key: 'birdies',       label: 'Birdies' },
  { key: 'pars',          label: 'Pars' },
  { key: 'bogeys',        label: 'Bogeys' },
  { key: 'doubles',       label: 'Double bogeys' },
  { key: 'triples_worse', label: 'Triple or worse' },
];

// ── DATA PREP ─────────────────────────────────────────────────────────────────
function buildRosterPlayers(data) {
  const list = [];
  data.teams.forEach(team => {
    team.players.forEach(p => {
      if (!p.stats) return;
      list.push({
        name: p.name,
        team: team.team_number,
        flight: team.flight,
        stats: p.stats,
      });
    });
  });
  return list;
}

function leagueAverageStats() {
  const n = allRosterPlayers.length;
  const sums = { eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0, triples_worse: 0 };
  allRosterPlayers.forEach(p => {
    BUCKETS.forEach(b => { sums[b.key] += p.stats[b.key] || 0; });
  });
  const avg = {};
  BUCKETS.forEach(b => { avg[b.key] = n > 0 ? sums[b.key] / n : 0; });
  return avg;
}

function findPlayer(name) {
  return allRosterPlayers.find(p => p.name === name) || null;
}

// ── RENDER ───────────────────────────────────────────────────────────────────
function renderComparison(playerName, compareValue) {
  const player = findPlayer(playerName);
  const card  = document.getElementById('playerCard');
  const empty = document.getElementById('emptyState');

  if (!player) {
    card.className = 'player-card';
    empty.style.display = '';
    return;
  }

  card.className = 'player-card visible';
  empty.style.display = 'none';

  const isLeagueAvg = compareValue === '__league_avg__';
  const compareStats = isLeagueAvg ? leagueAverageStats() : (findPlayer(compareValue)?.stats || leagueAverageStats());
  const compareLabel = isLeagueAvg ? 'League average' : compareValue;

  const holes = BUCKETS.reduce((sum, b) => sum + (player.stats[b.key] || 0), 0);
  const flightIcon = player.flight === 'Sunshine' ? '☀' : '🍭';

  card.innerHTML = `
    <div class="player-header">
      <h2>${player.name}</h2>
      <div class="player-meta">
        <span class="badge ${player.flight === 'Sunshine' ? 'badge-sun' : 'badge-lol'}">${flightIcon} ${player.flight}</span>
        <span class="badge badge-points">T${player.team}</span>
        <span class="badge badge-points">${holes} holes recorded</span>
      </div>
    </div>
    <div class="chart-wrap">
      <div class="chart-legend" id="chartLegend"></div>
      <div style="position: relative; height: 320px;">
        <canvas id="comparisonChart" role="img" aria-label="Gross score comparison for ${player.name} versus ${compareLabel}"></canvas>
      </div>
    </div>`;

  const playerData  = BUCKETS.map(b => player.stats[b.key] || 0);
  const compareData = BUCKETS.map(b => compareStats[b.key] || 0);

  const colorCompare = '#5a8fd6';
  const colorPlayer  = '#2c2c2a';

  document.getElementById('chartLegend').innerHTML = `
    <span style="display:flex;align-items:center;gap:6px;">
      <span style="width:10px;height:10px;border-radius:2px;background:${colorCompare};"></span>${compareLabel}
    </span>
    <span style="display:flex;align-items:center;gap:6px;">
      <span style="width:10px;height:10px;border-radius:2px;background:${colorPlayer};"></span>${player.name}
    </span>`;

  if (chartInstance) chartInstance.destroy();

  const ctx = document.getElementById('comparisonChart');
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: BUCKETS.map(b => b.label),
      datasets: [
        {
          label: compareLabel,
          data: compareData.map(v => Math.round(v * 10) / 10),
          backgroundColor: colorCompare,
          borderRadius: 3,
        },
        {
          label: player.name,
          data: playerData,
          backgroundColor: colorPlayer,
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

// ── PICKERS ──────────────────────────────────────────────────────────────────
function populatePickers() {
  const playerSel  = document.getElementById('playerSelect');
  const compareSel = document.getElementById('compareSelect');

  playerSel.innerHTML  = '<option value="">— Select a player —</option>';
  compareSel.innerHTML = '<option value="__league_avg__">League Average</option>';

  ['Sunshine', 'Lollipops'].forEach(flight => {
    const group1 = document.createElement('optgroup');
    group1.label = flight === 'Sunshine' ? '☀ Sunshine' : '🍭 Lollipops';
    const group2 = document.createElement('optgroup');
    group2.label = group1.label;

    allRosterPlayers
      .filter(p => p.flight === flight)
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(p => {
        const opt1 = document.createElement('option');
        opt1.value = p.name;
        opt1.textContent = `${p.name} (T${p.team})`;
        group1.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = p.name;
        opt2.textContent = `${p.name} (T${p.team})`;
        group2.appendChild(opt2);
      });

    playerSel.appendChild(group1);
    compareSel.appendChild(group2);
  });
}

function currentSelection() {
  const playerName   = document.getElementById('playerSelect').value;
  const compareValue  = document.getElementById('compareSelect').value;
  return { playerName, compareValue };
}

document.getElementById('playerSelect').addEventListener('change', function () {
  if (!this.value) return;
  localStorage.setItem('rcc_player', this.value);
  const { compareValue } = currentSelection();
  renderComparison(this.value, compareValue);
});

document.getElementById('compareSelect').addEventListener('change', function () {
  const { playerName } = currentSelection();
  if (!playerName) return;
  renderComparison(playerName, this.value);
});

// ── BOOT ─────────────────────────────────────────────────────────────────────
loadLeagueData()
  .then(data => {
    leagueData = data;
    allRosterPlayers = buildRosterPlayers(data);
    populatePickers();

    const savedPlayer = localStorage.getItem('rcc_player');
    if (savedPlayer && findPlayer(savedPlayer)) {
      document.getElementById('playerSelect').value = savedPlayer;
      renderComparison(savedPlayer, '__league_avg__');
    }
  })
  .catch(() => {
    document.getElementById('emptyState').innerHTML = `
      <div class="big-icon">📂</div>
      <p>Could not load league data.</p>`;
  });
