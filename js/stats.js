/* stats.js — Player stats leaderboards */

// ── STAT DEFINITIONS ─────────────────────────────────────────────────────────
const TABS = [
  {
    id:    'scoring',
    label: 'Scoring Avg',
    desc:  'Average score vs par per hole played (min 18 holes)',
    col:   'avg',
    fmt:   v => v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2),
    asc:   true,   // lower is better
    minHoles: 18,
  },
  {
    id:    'birdies',
    label: 'Birdies',
    desc:  'Total birdies + eagles',
    col:   'birdsTotal',
    fmt:   v => String(v),
    asc:   false,
  },
  {
    id:    'eagles',
    label: 'Eagles',
    desc:  'Total eagles',
    col:   'eagles',
    fmt:   v => String(v),
    asc:   false,
  },
  {
    id:    'pars',
    label: 'Pars',
    desc:  'Total pars',
    col:   'pars',
    fmt:   v => String(v),
    asc:   false,
  },
  {
    id:    'bogeys',
    label: 'Bogeys',
    desc:  'Fewest bogeys (min 18 holes)',
    col:   'bogeys',
    fmt:   v => String(v),
    asc:   true,
    minHoles: 18,
  },
  {
    id:    'doubles',
    label: 'Doubles+',
    desc:  'Fewest doubles or worse (min 18 holes)',
    col:   'doublesWorse',
    fmt:   v => String(v),
    asc:   true,
    minHoles: 18,
  },
];

// ── BUILD PLAYER ROWS ────────────────────────────────────────────────────────
function buildPlayers(data) {
  const players = [];

  data.teams.forEach(team => {
    team.players.forEach(p => {
      const s = p.stats;
      const holes = s.eagles + s.birdies + s.pars + s.bogeys + s.doubles + s.triples_worse;
      const totalVsPar = (s.eagles * -2) + (s.birdies * -1) + (s.bogeys * 1) + (s.doubles * 2) + (s.triples_worse * 3);
      const avg = holes > 0 ? totalVsPar / holes : null;

      players.push({
        name:        p.name,
        hi:          p.handicap_index,
        team:        team.team_number,
        flight:      team.flight,
        holes,
        eagles:      s.eagles,
        birdies:     s.birdies,
        birdsTotal:  s.eagles + s.birdies,
        pars:        s.pars,
        bogeys:      s.bogeys,
        doubles:     s.doubles,
        triples:     s.triples_worse,
        doublesWorse: s.doubles + s.triples_worse,
        totalVsPar,
        avg,
      });
    });
  });

  return players;
}

// ── RENDER TABLE ─────────────────────────────────────────────────────────────
function renderTable(allPlayers, tab, flightFilter) {
  let players = allPlayers.filter(p => p.holes > 0);

  // flight filter
  if (flightFilter === 'Sunshine')  players = players.filter(p => p.flight === 'Sunshine');
  if (flightFilter === 'Lollipops') players = players.filter(p => p.flight === 'Lollipops');

  // min holes
  if (tab.minHoles) players = players.filter(p => p.holes >= tab.minHoles);

  // sort
  players.sort((a, b) => {
    const va = a[tab.col] ?? (tab.asc ? Infinity : -Infinity);
    const vb = b[tab.col] ?? (tab.asc ? Infinity : -Infinity);
    return tab.asc ? va - vb : vb - va;
  });

  const maxVal = Math.max(...players.map(p => Math.abs(p[tab.col] ?? 0))) || 1;

  const rows = players.map((p, i) => {
    const rank    = i + 1;
    const rankCls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const val     = p[tab.col];
    const valStr  = val !== null && val !== undefined ? tab.fmt(val) : '—';
    const barPct  = val !== null ? (Math.abs(val) / maxVal * 100).toFixed(1) : 0;
    const flightIcon = p.flight === 'Sunshine' ? '☀' : '🍭';

    return `
    <tr>
      <td class="s-rank ${rankCls}">${rank}</td>
      <td>
        <div class="s-name">${p.name}</div>
        <div class="s-team">${flightIcon} T${p.team} &nbsp;·&nbsp; HI: ${p.hi ?? '?'} &nbsp;·&nbsp; ${p.holes} holes</div>
      </td>
      <td class="s-val ${rank <= 3 ? 'gold-val' : ''}">${valStr}</td>
      <td style="width:90px;padding-right:1rem;">
        <div class="s-bar-wrap">
          <div class="s-bar-fill" style="width:${barPct}%;background:${rank<=3?'var(--gold)':'var(--green-light)'}"></div>
        </div>
      </td>
      <td class="num">${p.eagles}</td>
      <td class="num">${p.birdies}</td>
      <td class="num">${p.pars}</td>
      <td class="num">${p.bogeys}</td>
      <td class="num">${p.doubles}</td>
      <td class="num">${p.triples}</td>
    </tr>`;
  }).join('');

  const note = tab.minHoles ? `<div class="stats-note">Min ${tab.minHoles} holes to qualify</div>` : '';

  document.getElementById('statsPanel').innerHTML = `
    <div class="stats-panel-header">
      <h2>${tab.label}</h2>
      <p>${tab.desc}</p>
    </div>
    ${note}
    <table class="stats-table">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Player</th>
          <th class="num">${tab.label}</th>
          <th></th>
          <th class="num" title="Eagles">Eag</th>
          <th class="num" title="Birdies">Bird</th>
          <th class="num" title="Pars">Par</th>
          <th class="num" title="Bogeys">Bog</th>
          <th class="num" title="Doubles">Dbl</th>
          <th class="num" title="Triple or worse">3+</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
let allPlayers    = [];
let activeTab     = TABS[0];
let flightFilter  = 'All';

function refresh() {
  renderTable(allPlayers, activeTab, flightFilter);
}

loadLeagueData()
  .then(data => {
    allPlayers = buildPlayers(data);

    // build tab buttons
    const tabBar = document.getElementById('tabBar');
    TABS.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (tab === activeTab ? ' active' : '');
      btn.textContent = tab.label;
      btn.addEventListener('click', () => {
        activeTab = tab;
        tabBar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        refresh();
      });
      tabBar.appendChild(btn);
    });

    // flight filter buttons
    document.querySelectorAll('.ff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        flightFilter = btn.dataset.flight;
        document.querySelectorAll('.ff-btn').forEach(b => {
          b.className = 'ff-btn';
        });
        btn.classList.add(
          flightFilter === 'All'       ? 'active-all' :
          flightFilter === 'Sunshine'  ? 'active-sun' : 'active-lol'
        );
        refresh();
      });
    });

    refresh();
  })
  .catch(() => {
    document.getElementById('statsPanel').innerHTML = `
      <div class="empty-state">
        <div class="big-icon">📂</div>
        <p>Could not load league data.</p>
      </div>`;
  });
