/* stats.js — Player stats leaderboards */

// ── COLUMN DEFINITIONS ───────────────────────────────────────────────────────
// Each column: id, label, title tooltip, field, ascending=better, format fn
const COLUMNS = [
  { id:'vspar',   label:'vs Par',  title:'Total score vs par for all holes played (min 18 holes)',  field:'totalVsPar',   asc:true,  fmt: v => v > 0 ? `+${v}` : v === 0 ? 'E' : String(v), minHoles:18 },
  { id:'holes',   label:'Holes',   title:'Total holes played',                                       field:'holes',        asc:false, fmt: v => String(v) },
  { id:'eagles',  label:'Eag',     title:'Eagles',                                                   field:'eagles',       asc:false, fmt: v => String(v) },
  { id:'birdies', label:'Bird',    title:'Birdies',                                                  field:'birdies',      asc:false, fmt: v => String(v) },
  { id:'pars',    label:'Par',     title:'Pars',                                                     field:'pars',         asc:false, fmt: v => String(v) },
  { id:'bogeys',  label:'Bog',     title:'Bogeys',                                                   field:'bogeys',       asc:true,  fmt: v => String(v), minHoles:18 },
  { id:'doubles', label:'Dbl',     title:'Doubles',                                                  field:'doubles',      asc:true,  fmt: v => String(v), minHoles:18 },
  { id:'triples', label:'3+',      title:'Triple bogey or worse',                                    field:'triples',      asc:true,  fmt: v => String(v), minHoles:18 },
];

// ── STATE ────────────────────────────────────────────────────────────────────
let allPlayers   = [];
let flightFilter = 'All';
let sortCol      = COLUMNS[0];
let sortDir      = 1; // 1 = natural direction (asc for asc cols, desc for desc cols)

// ── BUILD PLAYERS ────────────────────────────────────────────────────────────
function buildPlayers(data) {
  const players = [];
  data.teams.forEach(team => {
    team.players.forEach(p => {
      const s = p.stats;
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
  let players = allPlayers.filter(p => p.holes > 0);

  if (flightFilter !== 'All') players = players.filter(p => p.flight === flightFilter);

  // apply minHoles for the active sort column
  if (sortCol.minHoles) players = players.filter(p => p.holes >= sortCol.minHoles);

  // sort: sortDir 1 = natural (asc cols go low→high, desc cols go high→low)
  players.sort((a, b) => {
    const natural = sortCol.asc ? 1 : -1;
    const va = a[sortCol.field] ?? (sortCol.asc ? Infinity : -Infinity);
    const vb = b[sortCol.field] ?? (sortCol.asc ? Infinity : -Infinity);
    return (va - vb) * natural * sortDir;
  });

  const maxAbs = Math.max(...players.map(p => Math.abs(p[sortCol.field] ?? 0))) || 1;

  const rows = players.map((p, i) => {
    const rank    = i + 1;
    const rankCls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const val     = p[sortCol.field];
    const valStr  = val !== null && val !== undefined ? sortCol.fmt(val) : '—';
    const barPct  = val !== null ? (Math.abs(val) / maxAbs * 100).toFixed(1) : 0;
    const fi      = p.flight === 'Sunshine' ? '☀' : '🍭';

    return `<tr>
      <td class="s-rank ${rankCls}">${rank}</td>
      <td>
        <div class="s-name">${p.name}</div>
        <div class="s-team">${fi} T${p.team} &nbsp;·&nbsp; HI: ${p.hi ?? '?'} &nbsp;·&nbsp; ${p.holes} holes</div>
      </td>
      <td class="s-val ${rank <= 3 ? 'gold-val' : ''}">${valStr}</td>
      <td style="width:90px;padding-right:1rem;">
        <div class="s-bar-wrap"><div class="s-bar-fill" style="width:${barPct}%;background:${rank<=3?'var(--gold)':'var(--green-light)'}"></div></div>
      </td>
      ${COLUMNS.map(col => {
        const cv   = p[col.field];
        const isActive = col === sortCol;
        return `<td class="num${isActive ? ' sort-active-cell' : ''}" title="${col.title}">${cv !== undefined ? cv : '—'}</td>`;
      }).join('')}
    </tr>`;
  }).join('');

  const note = sortCol.minHoles
    ? `<div class="stats-note">Sorted by <strong>${sortCol.label}</strong> · min ${sortCol.minHoles} holes to qualify</div>`
    : `<div class="stats-note">Sorted by <strong>${sortCol.label}</strong></div>`;

  // build header with sort indicators
  const headers = COLUMNS.map(col => {
    const isActive  = col === sortCol;
    const indicator = isActive ? (sortDir === 1 ? ' ↑' : ' ↓') : '';
    return `<th class="num${isActive ? ' sort-active' : ''}" data-col="${col.id}" title="${col.title}">${col.label}${indicator}</th>`;
  }).join('');

  document.getElementById('statsPanel').innerHTML = `
    <div class="stats-panel-header">
      <h2>Player Stats</h2>
      <p>Click any column header to sort</p>
    </div>
    ${note}
    <table class="stats-table" id="statsTable">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Player</th>
          <th class="num sort-active" data-col="${sortCol.id}" title="${sortCol.label}">
            ${sortCol.label}${sortDir === 1 ? ' ↑' : ' ↓'}
          </th>
          <th></th>
          ${headers}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  // attach sort listeners to all th[data-col]
  document.querySelectorAll('#statsTable thead th[data-col]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const col = COLUMNS.find(c => c.id === th.dataset.col);
      if (!col) return;
      if (col === sortCol) {
        sortDir *= -1; // flip direction
      } else {
        sortCol = col;
        sortDir = 1;   // reset to natural direction
      }
      render();
    });
  });
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
loadLeagueData()
  .then(data => {
    allPlayers = buildPlayers(data);

    // flight filter buttons
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
  .catch(() => {
    document.getElementById('statsPanel').innerHTML = `
      <div class="empty-state">
        <div class="big-icon">📂</div>
        <p>Could not load league data.</p>
      </div>`;
  });
