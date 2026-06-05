/* standings.js — Flight standings */

// ── NAVIGATION ───────────────────────────────────────────────────────────────
function goToSchedule(flight, teamNum) {
  localStorage.setItem('rcc_flight', flight);
  localStorage.setItem('rcc_team', String(teamNum));
  window.location.href = 'schedule.html';
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
// Strategy: find the last completed round, sum each team's round_scores
// excluding that round to get "last week's score total", rank both,
// compare ranks. Attendance points aren't stored so this is directional only.
function calcMovers(data, flightTeams) {
  const { round_scores } = data;

  // find the most recent round that has scores for at least one flight team
  const allRounds = new Set();
  flightTeams.forEach(t => {
    Object.keys(round_scores[String(t.team_number)] || {}).forEach(r => allRounds.add(Number(r)));
  });

  if (allRounds.size < 2) {
    // not enough history to compare
    return {};
  }

  const lastRound = Math.max(...allRounds);
  const prevRound = Math.max(...[...allRounds].filter(r => r < lastRound));
  if (!prevRound) return {};

  // Sum round scores for current (all rounds) and previous (exclude lastRound)
  // We use round score totals as a proxy for standings points
  const current  = flightTeams.map(t => {
    const scores = round_scores[String(t.team_number)] || {};
    const pts    = Object.values(scores).reduce((s, v) => s + v, 0);
    return { num: t.team_number, pts };
  });

  const previous = flightTeams.map(t => {
    const scores = round_scores[String(t.team_number)] || {};
    const pts    = Object.entries(scores)
      .filter(([rnd]) => Number(rnd) !== lastRound)
      .reduce((s, [, v]) => s + v, 0);
    return { num: t.team_number, pts };
  });

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
function renderFlight(flight, flightTeams, records) {
  // rank by total_points (the authoritative figure from standings report)
  const teamPoints = flightTeams.map(t => ({ num: t.team_number, pts: t.total_points }));
  const rankMap    = buildRankMap(teamPoints);
  flightTeams.forEach(t => { t._rank = rankMap[t.team_number]; });
  const sorted     = [...flightTeams].sort((a, b) => b.total_points - a.total_points);

  const movers = calcMovers(data, flightTeams);

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
    const myTeam   = team.team_number === 26;

    // mover arrow
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
    <tr class="${myTeam ? 'my-team' : ''}" onclick="goToSchedule('${team.flight}', ${team.team_number})" style="cursor:pointer;">
      <td class="rank-cell ${isTop3 ? 'top3' : ''}">${rankStr}</td>
      <td class="team-name-cell">
        <div class="players">${team.players_display}</div>
        <div class="team-num">T${team.team_number}</div>
      </td>
      <td class="record-cell">
        <span class="rec-w">${rec.w}</span><span class="rec-sep">-</span><span class="rec-l">${rec.l}</span>${rec.t > 0 ? `<span class="rec-sep">-</span><span class="rec-t">${rec.t}</span>` : ''}
      </td>
      <td class="points-cell">${team.total_points}</td>
      <td class="mover-cell">${moverCell}</td>
      <td class="purse-cell ${team.purse > 0 ? '' : 'empty'}">${purseStr}</td>
    </tr>`;
  }).join('');

  return `
  <div class="flight-panel">
    <div class="flight-header">
      <h2>${icon} ${flight}</h2>
      <span class="flight-meta">${flightTeams.length} teams &nbsp;·&nbsp; ${roundsPlayed} rounds played</span>
    </div>
    <table class="standings">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Team</th>
          <th>Record</th>
          <th class="num">Pts</th>
          <th class="num" title="Position change vs last round (based on round scores)">+/-</th>
          <th class="num">Purse</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
let data = null;

loadLeagueData()
  .then(d => {
    data = d;
    const records   = calcRecords(data);

    const sunshine  = data.teams.filter(t => t.flight === 'Sunshine');
    const lollipops = data.teams.filter(t => t.flight === 'Lollipops');

    document.getElementById('standingsWrap').innerHTML =
      renderFlight('Sunshine',  sunshine,  records) +
      renderFlight('Lollipops', lollipops, records);

    // last updated
    const roundNums = Object.values(data.round_scores)
      .flatMap(t => Object.keys(t).map(Number));
    if (roundNums.length) {
      const lastRound = Math.max(...roundNums);
      const roundKey  = Object.keys(data.schedule).find(k => getRoundNumber(k) === lastRound);
      const dateStr   = roundKey ? getRoundDate(roundKey) : '';
      document.getElementById('lastUpdated').textContent =
        `Last updated through Round ${lastRound}${dateStr ? ' (' + dateStr + ')' : ''} · movement based on round scores`;
    }
  })
  .catch(() => {
    document.getElementById('standingsWrap').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="big-icon">📂</div>
        <p>Could not load league data.</p>
      </div>`;
  });
