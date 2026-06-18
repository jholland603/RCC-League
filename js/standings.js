/* standings.js — Flight standings */

// ── NAVIGATION ───────────────────────────────────────────────────────────────
function goToSchedule(flight, teamNum) {
  localStorage.setItem('rcc_team', String(teamNum));
  window.location.href = 'schedule.html';
}

// ── HISTORICAL STANDINGS (week picker) ───────────────────────────────────────
// Returns a map { teamNum: cumulativeTotalThroughRound } using weekly_total_points.
// This reconstructs what the standings looked like as of a given week, since
// weekly_total_points already includes attendance points (same basis as total_points).
function standingsThroughRound(data, throughRound) {
  const weeklyTotalPoints = data.weekly_total_points || {};
  const totals = {};
  data.teams.forEach(t => { totals[t.team_number] = 0; });

  for (let r = 1; r <= throughRound; r++) {
    const weekData = weeklyTotalPoints[String(r)];
    if (!weekData) continue;
    Object.entries(weekData).forEach(([tn, pts]) => {
      const num = parseInt(tn);
      if (totals[num] !== undefined) totals[num] += pts;
    });
  }
  return totals;
}

// Returns the list of round numbers that have weekly_total_points data, sorted ascending.
function availableWeeks(data) {
  const weeklyTotalPoints = data.weekly_total_points || {};
  return Object.keys(weeklyTotalPoints).map(r => parseInt(r)).sort((a, b) => a - b);
}

// ── RECORD CALCULATION ───────────────────────────────────────────────────────
function calcRecords(data) {
  const { schedule, round_scores } = data;
  const records = {};
  data.teams.forEach(t => { records[t.team_number] = { w:0, l:0, t:0 }; });

  Object.keys(schedule).forEach(roundKey => {
    const rndNum = getRoundNumber(roundKey);
    schedule[roundKey].forEach(match => {
      const [a, b]    = match;
      const aStored   = (round_scores[String(a)] || {})[String(rndNum)];
      const bStored   = (round_scores[String(b)] || {})[String(rndNum)];
      if (aStored === undefined || bStored === undefined) return;
      if      (aStored > bStored) { records[a].w++; records[b].l++; }
      else if (bStored > aStored) { records[b].w++; records[a].l++; }
      else                        { records[a].t++; records[b].t++; }
    });
  });
  return records;
}

// ── RANK FLIGHT ──────────────────────────────────────────────────────────────
// Takes an array of {team_number, points_value} and returns a map of
// team_number → rank string ("1", "T3", etc.)
function buildRankMap(teamPoints) {
  const sorted = [...teamPoints].sort((a, b) => b.pts - a.pts);
  const rankMap = {};
  let rank = 1;
  sorted.forEach((item, i) => {
    if (i > 0 && item.pts === sorted[i - 1].pts) {
      rankMap[item.num] = `T${rank}`;
      rankMap[sorted[i - 1].num] = `T${rank}`;
    } else {
      rank = i + 1;
      rankMap[item.num] = String(rank);
    }
  });
  return rankMap;
}

// ── MOVERS CALCULATION ───────────────────────────────────────────────────────
// Uses weekly_total_points (match + attendance points), the same basis total_points
// is built from, rather than round_scores alone. Compares each team's flight rank
// at the latest available week vs. the week before it.
function calcMovers(data, flightTeams) {
  const weeks = availableWeeks(data);
  if (weeks.length < 2) return {};

  const lastWeek = weeks[weeks.length - 1];
  const prevWeek = weeks[weeks.length - 2];

  const current  = flightTeams.map(t => ({ num: t.team_number, pts: standingsThroughRound(data, lastWeek)[t.team_number] ?? 0 }));
  const previous = flightTeams.map(t => ({ num: t.team_number, pts: standingsThroughRound(data, prevWeek)[t.team_number] ?? 0 }));

  const currentRanks  = buildRankMap(current);
  const previousRanks = buildRankMap(previous);

  const movers = {};
  flightTeams.forEach(t => {
    const cur  = parseInt(currentRanks[t.team_number].replace('T', ''));
    const prev = parseInt(previousRanks[t.team_number].replace('T', ''));
    movers[t.team_number] = prev - cur; // positive = moved up, negative = moved down
  });

  return movers;
}

// ── RENDER FLIGHT TABLE ──────────────────────────────────────────────────────
// pointsOverride: optional map { teamNum: points } used when viewing a historical
// week. When omitted, falls back to each team's current total_points (live standings).
// showMovers/showPurse: suppressed for historical weeks since "this week's movement"
// and purse winnings aren't meaningful snapshots of a past date in the same way.
function renderFlight(flight, flightTeams, records, pointsOverride, isHistorical) {
  const getPts = (t) => pointsOverride ? (pointsOverride[t.team_number] ?? 0) : t.total_points;

  const teamPoints = flightTeams.map(t => ({ num: t.team_number, pts: getPts(t) }));
  const rankMap    = buildRankMap(teamPoints);
  flightTeams.forEach(t => { t._rank = rankMap[t.team_number]; });
  const sorted     = [...flightTeams].sort((a, b) => getPts(b) - getPts(a));

  const movers = isHistorical ? {} : calcMovers(data, flightTeams);

  const icon = flight === 'Sunshine' ? '☀' : '🍭';
  const roundsPlayed = Math.max(...flightTeams.map(t => {
    const s = records[t.team_number];
    return s.w + s.l + s.t;
  }));

  const rows = sorted.map(team => {
    const rec      = records[team.team_number] || { w:0, l:0, t:0 };
    const rankStr  = team._rank;
    const isTop3   = parseInt(rankStr.replace('T','')) <= 3;
    const purseStr = team.purse > 0 ? `$${team.purse.toFixed(0)}` : '—';
    const ptsVal   = getPts(team);

    const mv = movers[team.team_number];
    let moverCell = `<span class="mover-none">—</span>`;
    if (mv !== undefined && mv !== 0) {
      const cls   = mv > 0 ? 'mover-up' : 'mover-down';
      const arrow = mv > 0 ? '▲' : '▼';
      const abs   = Math.abs(mv);
      moverCell   = `<span class="${cls}">${arrow}${abs}</span>`;
    } else if (mv === 0) {
      moverCell = `<span class="mover-flat">—</span>`;
    }

    return `
    <tr onclick="goToSchedule('${team.flight}', ${team.team_number})" style="cursor:pointer;">
      <td class="rank-cell ${isTop3 ? 'top3' : ''}">${rankStr}</td>
      <td class="team-name-cell">
        <div class="players">${team.players_display}</div>
        <div class="team-num">T${team.team_number}</div>
      </td>
      <td class="record-cell">
        ${isHistorical ? '—' : `<span class="rec-w">${rec.w}</span><span class="rec-sep">-</span><span class="rec-l">${rec.l}</span>${rec.t > 0 ? `<span class="rec-sep">-</span><span class="rec-t">${rec.t}</span>` : ''}`}
      </td>
      <td class="points-cell">${fmt(ptsVal)}</td>
      <td class="mover-cell">${isHistorical ? '<span class="mover-none">—</span>' : moverCell}</td>
      <td class="purse-cell ${(!isHistorical && team.purse > 0) ? '' : 'empty'}">${isHistorical ? '—' : purseStr}</td>
    </tr>`;
  }).join('');

  return `
  <div class="flight-panel">
    <div class="flight-header">
      <h2>${icon} ${flight}</h2>
      <span class="flight-meta">${flightTeams.length} teams ${isHistorical ? '' : `&nbsp;·&nbsp; ${roundsPlayed} rounds played`}</span>
    </div>
    <table class="standings">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Team</th>
          <th>Record</th>
          <th class="num">Pts</th>
          <th class="num" title="Position change vs last week (based on weekly total points)">+/-</th>
          <th class="num">Purse</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
let data = null;

function populateWeekSelect() {
  const sel = document.getElementById('weekSelect');
  const weeks = availableWeeks(data);
  sel.innerHTML = '<option value="current">Current (latest)</option>';
  weeks.forEach(w => {
    const roundKey = Object.keys(data.schedule).find(k => getRoundNumber(k) === w);
    const dateStr  = roundKey ? getRoundDate(roundKey) : '';
    const opt = document.createElement('option');
    opt.value = String(w);
    opt.textContent = `Week ${w}${dateStr ? ' (' + dateStr + ')' : ''}`;
    sel.appendChild(opt);
  });
}

function renderForSelection(selectedValue) {
  const records   = calcRecords(data);
  const sunshine  = data.teams.filter(t => t.flight === 'Sunshine');
  const lollipops = data.teams.filter(t => t.flight === 'Lollipops');

  const isHistorical = selectedValue !== 'current';
  let pointsOverride = null;
  let labelSuffix = '';

  if (isHistorical) {
    const rnd = parseInt(selectedValue);
    pointsOverride = standingsThroughRound(data, rnd);
    const roundKey = Object.keys(data.schedule).find(k => getRoundNumber(k) === rnd);
    const dateStr  = roundKey ? getRoundDate(roundKey) : '';
    labelSuffix = `Standings through Week ${rnd}${dateStr ? ' (' + dateStr + ')' : ''}`;
  }

  document.getElementById('standingsWrap').innerHTML =
    renderFlight('Sunshine',  sunshine,  records, pointsOverride, isHistorical) +
    renderFlight('Lollipops', lollipops, records, pointsOverride, isHistorical);

  if (isHistorical) {
    document.getElementById('lastUpdated').textContent =
      `${labelSuffix} · viewing a past snapshot (records, movement, and purse aren't shown for historical weeks)`;
  } else {
    const roundNums = Object.values(data.round_scores)
      .flatMap(t => Object.keys(t).map(Number));
    if (roundNums.length) {
      const lastRound = Math.max(...roundNums);
      const roundKey  = Object.keys(data.schedule).find(k => getRoundNumber(k) === lastRound);
      const dateStr   = roundKey ? getRoundDate(roundKey) : '';
      document.getElementById('lastUpdated').textContent =
        `Last updated through Round ${lastRound}${dateStr ? ' (' + dateStr + ')' : ''} · movement based on weekly total points`;
    }
  }
}

document.getElementById('weekSelect').addEventListener('change', function () {
  renderForSelection(this.value);
});

loadLeagueData()
  .then(d => {
    data = d;
    populateWeekSelect();
    renderForSelection('current');
  })
  .catch(() => {
    document.getElementById('standingsWrap').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="big-icon">📂</div>
        <p>Could not load league data.</p>
      </div>`;
  });
