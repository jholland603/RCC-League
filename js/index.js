/* index.js — Home page leaderboard */

function buildRankMap(teamPoints) {
  const sorted = [...teamPoints].sort((a, b) => b.pts - a.pts);
  const map = {};
  let rank = 1;
  sorted.forEach((item, i) => {
    if (i > 0 && item.pts === sorted[i - 1].pts) {
      map[item.num] = `T${rank}`;
      map[sorted[i - 1].num] = `T${rank}`;
    } else {
      rank = i + 1;
      map[item.num] = String(rank);
    }
  });
  return map;
}

function calcRecords(data) {
  const { schedule, round_scores } = data;
  const records = {};
  data.teams.forEach(t => { records[t.team_number] = { w:0, l:0, t:0 }; });
  Object.keys(schedule).forEach(roundKey => {
    const rndNum = getRoundNumber(roundKey);
    schedule[roundKey].forEach(([a, b]) => {
      const as = (round_scores[String(a)] || {})[String(rndNum)];
      const bs = (round_scores[String(b)] || {})[String(rndNum)];
      if (as === undefined || bs === undefined) return;
      if      (as > bs) { records[a].w++; records[b].l++; }
      else if (bs > as) { records[b].w++; records[a].l++; }
      else              { records[a].t++; records[b].t++; }
    });
  });
  return records;
}

function renderFlight(flight, teams, records) {
  const icon    = flight === 'Sunshine' ? '☀' : '🍭';
  const sorted  = [...teams].sort((a, b) => b.total_points - a.total_points);
  const rankMap = buildRankMap(teams.map(t => ({ num: t.team_number, pts: t.total_points })));

  const cutoff  = sorted[Math.min(4, sorted.length - 1)]?.total_points;
  const top     = sorted.filter(t => t.total_points >= cutoff);

  const rows = top.map(team => {
    const rankStr = rankMap[team.team_number];
    const rankNum = parseInt(rankStr.replace('T', ''));
    const rankCls = rankNum === 1 ? 'gold' : rankNum === 2 ? 'silver' : rankNum === 3 ? 'bronze' : '';
    const rec     = records[team.team_number] || { w:0, l:0, t:0 };
    const recStr  = rec.t > 0 ? `${rec.w}-${rec.l}-${rec.t}` : `${rec.w}-${rec.l}`;

    return `<tr onclick="goToTeamSchedule(${team.team_number})">
      <td class="lb-rank ${rankCls}">${rankStr}</td>
      <td>
        <div class="lb-team">${team.players_display}</div>
        <div class="lb-team-num">T${team.team_number}</div>
      </td>
      <td class="lb-rec">${recStr}</td>
      <td class="lb-pts">${team.total_points}</td>
    </tr>`;
  }).join('');

  return `<div class="lb-panel">
    <div class="lb-header">
      <h2>${icon} ${flight}</h2>
      <a href="standings.html">Full standings ↗</a>
    </div>
    <table class="lb-table"><tbody>${rows}</tbody></table>
  </div>`;
}

function goToTeamSchedule(teamNum) {
  localStorage.setItem('rcc_team', String(teamNum));
  window.location.href = 'schedule.html';
}

loadLeagueData().then(data => {
  const records   = calcRecords(data);
  const sunshine  = data.teams.filter(t => t.flight === 'Sunshine');
  const lollipops = data.teams.filter(t => t.flight === 'Lollipops');

  document.getElementById('lbGrid').innerHTML =
    renderFlight('Sunshine',  sunshine,  records) +
    renderFlight('Lollipops', lollipops, records);

  const roundNums = Object.values(data.round_scores).flatMap(t => Object.keys(t).map(Number));
  if (roundNums.length) {
    const lastRound = Math.max(...roundNums);
    const roundKey  = Object.keys(data.schedule).find(k => getRoundNumber(k) === lastRound);
    const dateStr   = roundKey ? getRoundDate(roundKey) : '';
    document.getElementById('lbUpdated').textContent =
      `Through Round ${lastRound}${dateStr ? ' (' + dateStr + ')' : ''}`;
  }
}).catch(() => {
  document.getElementById('lbGrid').innerHTML =
    `<div class="lb-panel"><div class="lb-updated">Could not load data.</div></div>`;
});
