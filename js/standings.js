/* standings.js — Flight standings */

// ── NAVIGATION ───────────────────────────────────────────────────────────────
function goToSchedule(flight, teamNum) {
  localStorage.setItem('rcc_flight', flight);
  localStorage.setItem('rcc_team', String(teamNum));
  window.location.href = 'schedule.html';
}

// ── RECORD CALCULATION ───────────────────────────────────────────────────────
// Derive W/L/T for every team from round_scores
function calcRecords(data) {
  const { schedule, round_scores } = data;
  const records = {};

  data.teams.forEach(t => {
    records[t.team_number] = { w: 0, l: 0, t: 0 };
  });

  const roundKeys = Object.keys(schedule);

  roundKeys.forEach(roundKey => {
    const rndNum = getRoundNumber(roundKey);
    schedule[roundKey].forEach(match => {
      const [a, b] = match;
      const aStored = (round_scores[String(a)] || {})[String(rndNum)];
      const bStored = (round_scores[String(b)] || {})[String(rndNum)];
      if (aStored === undefined || bStored === undefined) return;

      if (aStored > bStored) {
        records[a].w++; records[b].l++;
      } else if (bStored > aStored) {
        records[b].w++; records[a].l++;
      } else {
        records[a].t++; records[b].t++;
      }
    });
  });

  return records;
}

// ── RANK FLIGHT ──────────────────────────────────────────────────────────────
// Returns teams sorted by total_points desc, with rank strings assigned.
function rankFlight(teams) {
  const sorted = [...teams].sort((a, b) => b.total_points - a.total_points);
  let rank = 1;
  sorted.forEach((team, i) => {
    if (i > 0 && team.total_points === sorted[i - 1].total_points) {
      team._rank = `T${rank}`;
      sorted[i - 1]._rank = `T${rank}`;
    } else {
      rank = i + 1;
      team._rank = String(rank);
    }
  });
  return sorted;
}

// ── RENDER FLIGHT TABLE ──────────────────────────────────────────────────────
function renderFlight(flight, flightTeams, records, maxPoints) {
  const sorted   = rankFlight(flightTeams);
  const icon     = flight === 'Sunshine' ? '☀' : '🍭';
  const roundsPlayed = Math.max(...flightTeams.map(t => {
    const s = records[t.team_number];
    return s.w + s.l + s.t;
  }));

  const rows = sorted.map(team => {
    const rec      = records[team.team_number] || { w:0, l:0, t:0 };
    const rankStr  = team._rank;
    const isTop3   = parseInt(rankStr.replace('T','')) <= 3;
    const isTied   = rankStr.startsWith('T');
    const barPct   = maxPoints > 0 ? (team.total_points / maxPoints * 100).toFixed(1) : 0;
    const purseStr = team.purse > 0 ? `$${team.purse.toFixed(0)}` : '—';
    const myTeam   = team.team_number === 26; // Jeffry Holland's team

    return `
    <tr class="${myTeam ? 'my-team' : ''}" onclick="goToSchedule('${team.flight}', ${team.team_number})" style="cursor:pointer;">
      <td class="rank-cell ${isTop3 ? 'top3' : ''}">${rankStr}${isTied ? '' : ''}</td>
      <td class="team-name-cell">
        <div class="players">${team.players_display}</div>
        <div class="team-num">T${team.team_number}</div>
      </td>
      <td class="record-cell">
        <span class="rec-w">${rec.w}W</span>
        <span style="color:var(--text-muted);margin:0 1px;">·</span>
        <span class="rec-l">${rec.l}L</span>
        ${rec.t > 0 ? `<span style="color:var(--text-muted);margin:0 1px;">·</span><span class="rec-t">${rec.t}T</span>` : ''}
      </td>
      <td class="points-cell">${team.total_points}</td>
      <td class="points-bar-cell">
        <div class="points-bar-wrap">
          <div class="points-bar-fill ${isTop3 ? 'top3' : ''}" style="width:${barPct}%"></div>
        </div>
      </td>
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
          <th class="points-bar-cell"></th>
          <th class="num">Purse</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
loadLeagueData()
  .then(data => {
    const records  = calcRecords(data);
    const maxPoints = Math.max(...data.teams.map(t => t.total_points));

    const sunshine  = data.teams.filter(t => t.flight === 'Sunshine');
    const lollipops = data.teams.filter(t => t.flight === 'Lollipops');

    document.getElementById('standingsWrap').innerHTML =
      renderFlight('Sunshine',  sunshine,  records, maxPoints) +
      renderFlight('Lollipops', lollipops, records, maxPoints);

    // last updated — find most recent round with scores
    const roundNums = Object.values(data.round_scores)
      .flatMap(t => Object.keys(t).map(Number));
    if (roundNums.length) {
      const lastRound = Math.max(...roundNums);
      const roundKey  = Object.keys(data.schedule)
        .find(k => getRoundNumber(k) === lastRound);
      const dateStr   = roundKey ? getRoundDate(roundKey) : '';
      document.getElementById('lastUpdated').textContent =
        `Last updated through Round ${lastRound}${dateStr ? ' (' + dateStr + ')' : ''}`;
    }
  })
  .catch(() => {
    document.getElementById('standingsWrap').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="big-icon">📂</div>
        <p>Could not load league data.</p>
      </div>`;
  });
