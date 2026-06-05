/* schedule.js — Team schedule viewer */

let leagueData = null;

// ── RENDER ───────────────────────────────────────────────────────────────────

function renderTeam(data, teamNum) {
  const team = data.teams.find(t => t.team_number === teamNum);
  if (!team) return;

  const { schedule, round_scores, nine_rotations, course_ratings, teams } = data;
  const card  = document.getElementById('teamCard');
  const empty = document.getElementById('emptyState');
  card.className = 'team-card visible';
  empty.style.display = 'none';

  // meta
  const rank      = calcRank(teamNum, team.flight, teams);
  const flightSize = teams.filter(t => t.flight === team.flight).length;
  const rankStr   = rankLabel(rank);
  const purseStr  = team.purse > 0 ? `$${team.purse.toFixed(0)}` : null;
  const isSun     = team.flight === 'Sunshine';
  const flightIcon  = isSun ? '☀' : '🍭';
  const flightBadge = isSun ? 'badge-sun' : 'badge-lol';

  // W/L/T record from round_scores
  const myScores = round_scores[String(teamNum)] || {};
  let wins = 0, losses = 0, ties = 0;
  Object.keys(myScores).forEach(rnd => {
    const stored   = myScores[rnd];
    const roundKey = Object.keys(schedule).find(k => getRoundNumber(k) === parseInt(rnd));
    if (!roundKey) return;
    const match  = schedule[roundKey].find(m => m[0] === teamNum || m[1] === teamNum);
    if (!match) return;
    const oppNum    = match[0] === teamNum ? match[1] : match[0];
    const oppStored = (round_scores[String(oppNum)] || {})[rnd];
    if (oppStored === undefined) return;
    if (stored > oppStored)      wins++;
    else if (stored < oppStored) losses++;
    else                         ties++;
  });

  // ── SCHEDULE ROWS ──
  const roundKeys = Object.keys(schedule).sort((a, b) => getRoundNumber(a) - getRoundNumber(b));
  let scheduleHTML = '';

  roundKeys.forEach(roundKey => {
    const rndNum  = getRoundNumber(roundKey);
    const match   = schedule[roundKey].find(m => m[0] === teamNum || m[1] === teamNum);
    if (!match) return;

    const oppNum  = match[0] === teamNum ? match[1] : match[0];
    const oppTeam = teams.find(t => t.team_number === oppNum);
    if (!oppTeam) return;

    const date     = getRoundDate(roundKey);
    const nine     = nine_rotations[roundKey]?.[team.flight] || '?';
    const rndLabel_str = `${rndNum}`; // just the round number, nine shown in its own column

    // stroke allocation
    const fourPlayers = [
      { hi: team.players[0]?.handicap_index    || 0, tee: team.players[0]?.tee    || 'blue' },
      { hi: team.players[1]?.handicap_index    || 0, tee: team.players[1]?.tee    || 'blue' },
      { hi: oppTeam.players[0]?.handicap_index || 0, tee: oppTeam.players[0]?.tee || 'blue' },
      { hi: oppTeam.players[1]?.handicap_index || 0, tee: oppTeam.players[1]?.tee || 'blue' },
    ];
    const fullStrokes = getStrokesFor4(fourPlayers, course_ratings);
    const nineStrokes = strokesFor9(fullStrokes, nine);

    // scores
    const myStored  = (round_scores[String(teamNum)] || {})[String(rndNum)];
    const oppStored = (round_scores[String(oppNum)]  || {})[String(rndNum)];
    const scoreData = (myStored !== undefined && oppStored !== undefined)
                      ? parseDisplayScore(myStored, oppStored) : null;

    // opponent rank
    const oppRank     = calcRank(oppNum, oppTeam.flight, teams);
    const oppRankStr  = rankLabel(oppRank);

    // result badge HTML
    let resultCell = `<span class="res-none">—</span>`;
    if (scoreData) {
      const { type, margin } = scoreData.result;
      const sign  = margin > 0 ? `+${margin}` : margin < 0 ? `${margin}` : '';
      const label = type === 'T' ? 'T 0' : `${type} ${sign}`;
      const cls   = type === 'W' ? 'res-win' : type === 'L' ? 'res-loss' : 'res-tie';
      resultCell  = `<span class="result-badge ${cls}">${label}</span>`;
    }

    const usDisp   = scoreData ? fmt(scoreData.dispUs)   : '—';
    const themDisp = scoreData ? fmt(scoreData.dispThem)  : '—';

    function chip(s) {
      return `<span class="strokes-chip${s === 0 ? ' zero' : ''}">${s}</span>`;
    }

    scheduleHTML += `
    <tr class="match-first">
      <td class="rnd-cell"  rowspan="2">${rndLabel_str}</td>
      <td class="date-cell" rowspan="2">${date}</td>
      <td class="nine-cell" rowspan="2">${nine}</td>
      <td>
        <span class="opp-name">${shortName(team.players[0]?.name)}</span>
        <span class="opp-hi">(${team.players[0]?.handicap_index ?? '?'})</span>${chip(nineStrokes[0])}
      </td>
      <td>
        <span class="opp-name">${shortName(oppTeam.players[0]?.name)}</span>
        <span class="opp-hi">(${oppTeam.players[0]?.handicap_index ?? '?'})</span>${chip(nineStrokes[2])}
      </td>
      <td class="opp-rank" rowspan="2">${oppRankStr}</td>
      <td class="score-cell${usDisp   === '—' ? ' score-dash' : ''}" rowspan="2">${usDisp}</td>
      <td class="score-cell${themDisp === '—' ? ' score-dash' : ''}" rowspan="2">${themDisp}</td>
      <td class="result-cell" rowspan="2">${resultCell}</td>
    </tr>
    <tr class="match-second">
      <td>
        <span class="opp-name">${shortName(team.players[1]?.name)}</span>
        <span class="opp-hi">(${team.players[1]?.handicap_index ?? '?'})</span>${chip(nineStrokes[1])}
      </td>
      <td>
        <span class="opp-name">${shortName(oppTeam.players[1]?.name)}</span>
        <span class="opp-hi">(${oppTeam.players[1]?.handicap_index ?? '?'})</span>${chip(nineStrokes[3])}
      </td>
    </tr>`;
  });

  // ── PLAYERS HTML ──
  const playersHTML = team.players.map(p => `
    <div class="player-chip">
      <div class="player-avatar">${initials(p.name || '')}</div>
      <div>
        <div class="player-name">${p.name || '—'}</div>
        <div class="player-detail">HI: ${p.handicap_index ?? '?'}${p.tee ? ' · ' + p.tee + ' tees' : ''}</div>
      </div>
    </div>`).join('');

  card.innerHTML = `
    <div class="team-header">
      <div style="display:flex;align-items:center;">
        <div class="team-number-badge">#${teamNum}</div>
        <div class="team-info">
          <h2>${team.players_display}</h2>
          <div class="team-meta">
            <span class="badge ${flightBadge}">${flightIcon} ${team.flight}</span>
            <span class="badge badge-points">${team.total_points} pts</span>
            <span class="badge badge-rank">${rankStr} of ${flightSize}</span>
            ${purseStr ? `<span class="badge badge-points">${purseStr} purse</span>` : ''}
          </div>
        </div>
      </div>
      <div class="team-stats-row">
        <div class="stat-item"><span class="stat-val">${wins}</span><span class="stat-lbl">Wins</span></div>
        <div class="stat-item"><span class="stat-val">${losses}</span><span class="stat-lbl">Losses</span></div>
        <div class="stat-item"><span class="stat-val">${ties}</span><span class="stat-lbl">Ties</span></div>
        <div class="stat-item"><span class="stat-val">${team.total_points}</span><span class="stat-lbl">Points</span></div>
      </div>
    </div>
    <div class="players-strip">${playersHTML}</div>
    <div class="schedule-wrap">
      <h3>2026 Season Schedule</h3>
      <table class="schedule">
        <thead>
          <tr>
            <th>Rnd</th>
            <th>Date</th>
            <th>Nine</th>
            <th>Team</th>
            <th>Opponent</th>
            <th>Opp Rank</th>
            <th>Team</th>
            <th>Opp</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>${scheduleHTML}</tbody>
      </table>
    </div>
    <div class="record-row">
      <strong>Record:</strong>
      <span style="display:inline-flex;gap:0.4rem;">
        <span class="rp-w">${wins}W</span>
        <span class="rp-l">${losses}L</span>
        <span class="rp-t">${ties}T</span>
      </span>
      &nbsp;·&nbsp; ${Object.keys(myScores).length} rounds played
    </div>`;
}

// ── BOOT ─────────────────────────────────────────────────────────────────────

function populateTeams() {
  const sel      = document.getElementById('teamSelect');
  const isMobile = window.innerWidth < 600;
  sel.innerHTML  = '<option value="">— Select a team —</option>';
  if (!leagueData) return;

  ['Sunshine', 'Lollipops'].forEach(flight => {
    const group = document.createElement('optgroup');
    group.label = flight === 'Sunshine' ? '☀ Sunshine (Teams 1–32)' : '🍭 Lollipops (Teams 33–64)';
    leagueData.teams
      .filter(t => t.flight === flight)
      .sort((a, b) => a.team_number - b.team_number)
      .forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.team_number;
        if (isMobile) {
          // "Holland, Jeffry + Spalding, David" → "J. Holland + D. Spalding"
          const names = t.players_display.split('+').map(n => {
            const parts = n.trim().split(',').map(s => s.trim());
            const last  = parts[0] || '';
            const first = parts[1] || '';
            return `${first[0] ? first[0] + '. ' : ''}${last}`;
          });
          opt.textContent = `${t.team_number} — ${names.join(' + ')}`;
        } else {
          opt.textContent = `${t.team_number} — ${t.players_display}`;
        }
        group.appendChild(opt);
      });
    sel.appendChild(group);
  });
}

document.getElementById('teamSelect').addEventListener('change', function () {
  const num = parseInt(this.value);
  if (!num || !leagueData) return;
  localStorage.setItem('rcc_team', this.value);
  renderTeam(leagueData, num);
});

loadLeagueData()
  .then(data => {
    leagueData = data;
    populateTeams();
    const savedTeam = localStorage.getItem('rcc_team');
    if (savedTeam) {
      document.getElementById('teamSelect').value = savedTeam;
      renderTeam(leagueData, parseInt(savedTeam));
    }
  })
  .catch(() => {
    document.getElementById('emptyState').innerHTML = `
      <div class="big-icon">📂</div>
      <p>Could not load data. Drop <strong>RCC_League_2026.json</strong> here to continue.</p>
      <input type="file" id="fileInput" accept=".json" style="margin-top:1rem;font-size:0.85rem;color:var(--green-pale)">`;
    document.getElementById('fileInput')?.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        leagueData = JSON.parse(ev.target.result);
        populateTeams();
        document.getElementById('emptyState').innerHTML = `
          <div class="big-icon">✅</div>
          <p>Data loaded — select a team above.</p>`;
      };
      reader.readAsText(file);
    });
  });
