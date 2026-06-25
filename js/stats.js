/* stats.js — Player stats leaderboards */

// Par per hole = 4 (par 36 / 9 holes)
const PAR_PER_HOLE = 4;

// ── COLUMN DEFINITIONS ───────────────────────────────────────────────────────
// asc: true = low is better (default sort direction), false = high is better
const COLUMNS = [
  { id:'avg',     label:'Avg',   title:'Scoring average per 9 holes (min 18 holes)', field:'avg',     asc:true,  minHoles:18,
    fmt: v => v.toFixed(2) },
  { id:'eagles',  label:'Eag',   title:'Eagles',                                      field:'eagles',  asc:false,
    fmt: v => String(v) },
  { id:'birdies', label:'Bird',  title:'Birdies',                                     field:'birdies', asc:false,
    fmt: v => String(v) },
  { id:'pars',    label:'Par',   title:'Pars',                                        field:'pars',    asc:false,
    fmt: v => String(v) },
  { id:'bogeys',  label:'Bog',   title:'Bogeys',                                      field:'bogeys',  asc:false,
    fmt: v => String(v) },
  { id:'doubles', label:'Dbl',   title:'Doubles',                                     field:'doubles', asc:false,
    fmt: v => String(v) },
  { id:'triples', label:'3+',    title:'Triple bogey or worse',                       field:'triples', asc:false,
    fmt: v => String(v) },
];

// ── STATE ────────────────────────────────────────────────────────────────────
let allPlayers   = [];
let flightFilter = 'All';
let sortColId    = 'avg';
let sortDir      = 1; // 1 = natural direction for that column

// ── BUILD PLAYERS ────────────────────────────────────────────────────────────
function buildPlayers(data) {
  const players = [];
  data.teams.forEach(team => {
    team.players.forEach(p => {
      const s = p.stats;
      if (!s) return;
      const holes = s.eagles + s.birdies + s.pars + s.bogeys + s.doubles + s.triples_worse;
      // Total strokes: each result type maps to actual strokes taken
      // eagle=2, birdie=3, par=4, bogey=5, double=6, triple+=7
      const totalStrokes = (s.eagles * 2) + (s.birdies * 3) + (s.pars * 4) +
                           (s.bogeys * 5) + (s.doubles * 6) + (s.triples_worse * 7);
      // Per-9 average: (total strokes / holes) * 9
      const avg = holes > 0 ? (totalStrokes / holes) * 9 : null;

      players.push({
        name:    p.name,
        hi:      p.handicap_index,
        team:    team.team_number,
        flight:  team.flight,
        holes,
        eagles:  s.eagles,
        birdies: s.birdies,
        pars:    s.pars,
        bogeys:  s.bogeys,
        doubles: s.doubles,
        triples: s.triples_worse,
        avg,
      });
    });
  });
  return players;
}

// ── RENDER ───────────────────────────────────────────────────────────────────
function render() {
  const col = COLUMNS.find(c => c.id === sortColId) || COLUMNS[0];

  let players = allPlayers.filter(p => p.holes > 0);
  if (flightFilter !== 'All') players = players.filter(p => p.flight === flightFilter);
  if (col.minHoles) players = players.filter(p => p.holes >= col.minHoles);

  // natural direction: asc=true means low is better (sort low→high)
  // sortDir 1 = natural, -1 = flipped
  players.sort((a, b) => {
    const natural = col.asc ? 1 : -1;
    const va = a[col.field] ?? (col.asc ? Infinity : -Infinity);
    const vb = b[col.field] ?? (col.asc ? Infinity : -Infinity);
    return (va - vb) * natural * sortDir;
  });

  // thead
  const ths = COLUMNS.map(c => {
    const active = c.id === sortColId;
    const arrow  = active ? (sortDir === 1 ? ' ↑' : ' ↓') : '';
    return `<th class="num${active ? ' sort-active' : ''}" data-col="${c.id}" title="${c.title}" style="cursor:pointer;">${c.label}${arrow}</th>`;
  }).join('');

  // tbody
  const rows = players.map((p, i) => {
    const rank    = i + 1;
    const rankCls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const fi      = p.flight === 'Sunshine' ? '☀' : '🍭';

    const tds = COLUMNS.map(c => {
      const v      = p[c.field];
      const active = c.id === sortColId;
      const disp   = v !== null && v !== undefined ? c.fmt(v) : '—';
      return `<td class="num${active ? ' sort-active-cell' : ''}">${disp}</td>`;
    }).join('');

    return `<tr class="player-row" data-player="${encodeURIComponent(p.name)}" style="cursor:pointer;">
      <td class="s-rank ${rankCls}">${rank}</td>
      <td>
        <div class="s-name">${p.name}</div>
        <div class="s-team">${fi} Team ${p.team} &nbsp;·&nbsp; ${p.holes} holes</div>
      </td>
      ${tds}
    </tr>`;
  }).join('');

  const note = col.minHoles
    ? `<div class="stats-note">Sorted by <strong>${col.label}</strong> &nbsp;·&nbsp; min ${col.minHoles} holes to qualify</div>`
    : `<div class="stats-note">Sorted by <strong>${col.label}</strong></div>`;

  document.getElementById('statsPanel').innerHTML = `
    <div class="stats-panel-header">
      <h2>Player Stats</h2>
      <p>Click any column header to sort</p>
    </div>
    ${note}
    <div style="overflow-x:auto;">
      <table class="stats-table" id="statsTable">
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Player</th>
            ${ths}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  document.querySelectorAll('#statsTable thead th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      if (th.dataset.col === sortColId) {
        sortDir *= -1;
      } else {
        sortColId = th.dataset.col;
        sortDir   = 1;
      }
      render();
    });
  });

  document.querySelectorAll('#statsTable tbody tr.player-row').forEach(tr => {
    tr.addEventListener('click', () => {
      const name = decodeURIComponent(tr.dataset.player);
      localStorage.setItem('rcc_player', name);
      window.location.href = 'player.html';
    });
  });
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
loadLeagueData()
  .then(data => {
    allPlayers = buildPlayers(data);

    document.querySelectorAll('.ff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        flightFilter = btn.dataset.flight;
        document.querySelectorAll('.ff-btn').forEach(b => { b.className = 'ff-btn'; });
        btn.classList.add(
          flightFilter === 'All'      ? 'active-all' :
          flightFilter === 'Sunshine' ? 'active-sun' : 'active-lol'
        );
        render();
      });
    });

    render();
  })
  .catch(err => {
    console.error('Stats load error:', err);
    document.getElementById('statsPanel').innerHTML = `
      <div class="empty-state">
        <div class="big-icon">📂</div>
        <p>Could not load league data.</p>
      </div>`;
  });
