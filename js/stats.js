/* stats.js — Player stats leaderboards */

// ── COLUMN DEFINITIONS ───────────────────────────────────────────────────────
const COLUMNS = [
  { id:'vspar',   label:'vs Par',  title:'Total score vs par (min 18 holes)', field:'totalVsPar', asc:true,  minHoles:18,
    fmt: v => v > 0 ? `+${v}` : v === 0 ? 'E' : String(v) },
  { id:'holes',   label:'Holes',   title:'Total holes played',                field:'holes',      asc:false,
    fmt: v => String(v) },
  { id:'eagles',  label:'Eag',     title:'Eagles',                            field:'eagles',     asc:false,
    fmt: v => String(v) },
  { id:'birdies', label:'Bird',    title:'Birdies',                           field:'birdies',    asc:false,
    fmt: v => String(v) },
  { id:'pars',    label:'Par',     title:'Pars',                              field:'pars',       asc:false,
    fmt: v => String(v) },
  { id:'bogeys',  label:'Bog',     title:'Bogeys (min 18 holes)',             field:'bogeys',     asc:true,  minHoles:18,
    fmt: v => String(v) },
  { id:'doubles', label:'Dbl',     title:'Doubles (min 18 holes)',            field:'doubles',    asc:true,  minHoles:18,
    fmt: v => String(v) },
  { id:'triples', label:'3+',      title:'Triple or worse (min 18 holes)',   field:'triples',    asc:true,  minHoles:18,
    fmt: v => String(v) },
];

// ── STATE ────────────────────────────────────────────────────────────────────
let allPlayers   = [];
let flightFilter = 'All';
let sortColId    = 'vspar';
let sortDir      = 1; // 1 = natural, -1 = flipped

// ── BUILD PLAYERS ────────────────────────────────────────────────────────────
function buildPlayers(data) {
  const players = [];
  data.teams.forEach(team => {
    team.players.forEach(p => {
      const s = p.stats;
      if (!s) return;
      const holes = s.eagles + s.birdies + s.pars + s.bogeys + s.doubles + s.triples_worse;
      const totalVsPar = (s.eagles * -2) + (s.birdies * -1) + (s.bogeys) + (s.doubles * 2) + (s.triples_worse * 3);
      players.push({
        name:       p.name,
        hi:         p.handicap_index,
        team:       team.team_number,
        flight:     team.flight,
        holes,
        eagles:     s.eagles,
        birdies:    s.birdies,
        pars:       s.pars,
        bogeys:     s.bogeys,
        doubles:    s.doubles,
        triples:    s.triples_worse,
        totalVsPar,
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

  players.sort((a, b) => {
    const natural = col.asc ? 1 : -1;
    const va = a[col.field] ?? (col.asc ? Infinity : -Infinity);
    const vb = b[col.field] ?? (col.asc ? Infinity : -Infinity);
    return (va - vb) * natural * sortDir;
  });

  const maxAbs = Math.max(...players.map(p => Math.abs(p[col.field] ?? 0)), 1);

  // thead
  const ths = COLUMNS.map(c => {
    const active = c.id === sortColId;
    const arrow  = active ? (sortDir === 1 ? ' ↑' : ' ↓') : '';
    return `<th class="num${active ? ' sort-active' : ''}" data-col="${c.id}" title="${c.title}">${c.label}${arrow}</th>`;
  }).join('');

  // tbody
  const rows = players.map((p, i) => {
    const rank    = i + 1;
    const rankCls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const fi      = p.flight === 'Sunshine' ? '☀' : '🍭';
    const barPct  = (Math.abs(p[col.field] ?? 0) / maxAbs * 100).toFixed(1);

    const tds = COLUMNS.map(c => {
      const v      = p[c.field];
      const active = c.id === sortColId;
      return `<td class="num${active ? ' sort-active-cell' : ''}">${v !== undefined ? v : '—'}</td>`;
    }).join('');

    return `<tr>
      <td class="s-rank ${rankCls}">${rank}</td>
      <td>
        <div class="s-name">${p.name}</div>
        <div class="s-team">${fi} T${p.team} &nbsp;·&nbsp; HI: ${p.hi ?? '?'} &nbsp;·&nbsp; ${p.holes} holes</div>
      </td>
      <td class="s-val ${rank <= 3 ? 'gold-val' : ''}">${col.fmt(p[col.field] ?? 0)}</td>
      <td style="width:90px;padding-right:1rem;">
        <div class="s-bar-wrap">
          <div class="s-bar-fill" style="width:${barPct}%;background:${rank<=3?'var(--gold)':'var(--green-light)'}"></div>
        </div>
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
            <th class="num sort-active">${col.label}</th>
            <th></th>
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
