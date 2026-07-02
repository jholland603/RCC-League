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
// throughRound: optional cutoff. When provided, only rounds <= throughRound count
// toward the W/L/T record (used for historical week snapshots).
function calcRecords(data, throughRound) {
  const { schedule, round_scores } = data;
  const records = {};
  data.teams.forEach(t => { records[t.team_number] = { w:0, l:0, t:0 }; });

  Object.keys(schedule).forEach(roundKey => {
    const rndNum = getRoundNumber(roundKey);
    if (throughRound !== undefined && rndNum > throughRound) return;
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
// at `targetWeek` vs. the week immediately before it. If targetWeek is omitted,
// defaults to the latest available week (i.e. "this week's" movement).
function calcMovers(data, flightTeams, targetWeek) {
  const weeks = availableWeeks(data);
  if (weeks.length < 2) return {};

  const lastWeek = targetWeek !== undefined ? targetWeek : weeks[weeks.length - 1];
  const priorWeeks = weeks.filter(w => w < lastWeek);
  if (priorWeeks.length === 0) return {};
  const prevWeek = priorWeeks[priorWeeks.length - 1];

  const current  = flightTeams.map(t => ({ num: t.team_number, pts: standingsThroughRound(data, lastWeek)[t.team_number] ?? 0 }));
  const previous = flightTeams.map(t => ({ num: t.team_number, pts: standingsThroughRound(data, prevWeek)[t.team_number] ?? 0 }));

  const currentRanks  = buildRankMap(current);
  const previousRanks = buildRankMap(previous);

  const movers = {};
  flightTeams.forEach(t => {
    const cur  = parseInt(currentRanks[t.team_number].replace('T', ''));
    const prev = parseInt(previousRanks[t.team_number].replace('T', ''));
    movers[t.team_number] = { delta: prev - cur, currentRank: currentRanks[t.team_number] }; // delta positive = moved up
  });

  return movers;
}

// ── BIGGEST MOVERS CALLOUT ───────────────────────────────────────────────────
// Finds the top risers and fallers WITHIN EACH FLIGHT separately for the given
// week (or the latest week if omitted). Returns { Sunshine: {risers, fallers}, Lollipops: {...} }.
function biggestMovers(data, targetWeek, topN = 5) {
  const result = {};
  ['Sunshine', 'Lollipops'].forEach(flight => {
    const flightTeams = data.teams.filter(t => t.flight === flight);
    const movers = calcMovers(data, flightTeams, targetWeek);

    const entries = flightTeams
      .map(t => {
        const m = movers[t.team_number];
        return { team: t, mv: m?.delta, rank: m?.currentRank };
      })
      .filter(e => e.mv !== undefined && e.mv !== 0);

    const risers  = entries.filter(e => e.mv > 0).sort((a, b) => b.mv - a.mv).slice(0, topN);
    const fallers = entries.filter(e => e.mv < 0).sort((a, b) => a.mv - b.mv).slice(0, topN);

    result[flight] = { risers, fallers };
  });
  return result;
}

function renderMoversCallout(data, targetWeek) {
  const byFlight = biggestMovers(data, targetWeek);
  const hasAny = Object.values(byFlight).some(f => f.risers.length || f.fallers.length);
  if (!hasAny) return '';

  function itemRow({ team, mv, rank }, isRiser) {
    const cls   = isRiser ? 'mover-up' : 'mover-down';
    const arrow = isRiser ? '▲' : '▼';
    const rankLabelStr = rank ? rankLabel(rank) : '';
    return `
    <div class="mover-item">
      <span class="mover-arrow ${cls}">${arrow}${Math.abs(mv)}</span>
      <span class="mover-team">${team.players_display}</span>
      <span class="mover-flight">Team ${team.team_number}${rankLabelStr ? ` &nbsp;·&nbsp; now ${rankLabelStr}` : ''}</span>
    </div>`;
  }

  function flightCard(flight) {
    const { risers, fallers } = byFlight[flight];
    const icon = flight === 'Sunshine' ? '☀' : '🍭';
    return `
    <div class="movers-col">
      <div class="movers-col-title">${icon} ${flight}</div>
      <div class="movers-subgroup">
        <div class="movers-flight-label movers-title-up">Biggest Risers</div>
        ${risers.length ? risers.map(r => itemRow(r, true)).join('') : '<div class="movers-empty">No movement</div>'}
      </div>
      <div class="movers-subgroup">
        <div class="movers-flight-label movers-title-down">Biggest Fallers</div>
        ${fallers.length ? fallers.map(f => itemRow(f, false)).join('') : '<div class="movers-empty">No movement</div>'}
      </div>
    </div>`;
  }

  return `
  <div class="movers-callout">
    ${flightCard('Sunshine')}
    ${flightCard('Lollipops')}
  </div>`;
}

// ── TOP-N SEASON-END PROBABILITY (Monte Carlo) ───────────────────────────────
// Methodology mirrors INSTRUCTIONS.md → "TOP-5 / PLAYOFF ODDS METHODOLOGY":
//   1. Recent-trend baseline: last 4 played rounds weighted 2x vs. earlier rounds
//   2. Strength of remaining schedule: regress each team's per-round deviation
//      from its own season average against its opponent's relative strength
//      that round (pooled across the whole flight) to get a single slope (beta).
//      Each remaining round's projection is shifted by beta × (that round's
//      actual scheduled opponent's relative strength, from data.schedule).
//   3. Bootstrap-resampled residuals (deviations from the team's own season
//      average) supply the week-to-week noise.
// Basis is weekly_total_points (NOT round_scores) — see GOLDEN RULE #1 / the
// methodology section for why.

// Small deterministic PRNG so odds don't jitter on every page load between
// data updates (reseeded only when the underlying schedule/rounds change).
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// { teamNum: { roundNum: opponentTeamNum } }, built from data.schedule.
function buildOpponentMap(schedule) {
  const opponentOf = {};
  Object.keys(schedule).forEach(roundKey => {
    const rnum = getRoundNumber(roundKey);
    schedule[roundKey].forEach(([a, b]) => {
      opponentOf[a] = opponentOf[a] || {};
      opponentOf[b] = opponentOf[b] || {};
      opponentOf[a][rnum] = b;
      opponentOf[b][rnum] = a;
    });
  });
  return opponentOf;
}

// Returns { teamNum: percentChanceTopN } for one flight.
function simulateTopNOdds(data, flight, topN = 5, simulations = 6000) {
  const flightTeams = data.teams.filter(t => t.flight === flight);
  const teamNums    = flightTeams.map(t => t.team_number);
  const weeklyTotalPoints = data.weekly_total_points || {};
  const playedRounds = availableWeeks(data);
  if (playedRounds.length === 0) return {};

  const maxRound  = Math.max(...Object.keys(data.schedule).map(getRoundNumber));
  const playedSet = new Set(playedRounds);
  const remainingRounds = [];
  for (let r = 1; r <= maxRound; r++) if (!playedSet.has(r)) remainingRounds.push(r);

  const opponentOf = buildOpponentMap(data.schedule);

  // Per-round historical points, this flight only.
  const histPts = {};
  teamNums.forEach(tn => {
    histPts[tn] = {};
    playedRounds.forEach(r => {
      const v = (weeklyTotalPoints[String(r)] || {})[String(tn)];
      if (v !== undefined) histPts[tn][r] = v;
    });
  });

  const seasonAvg = {};
  teamNums.forEach(tn => {
    const vals = Object.values(histPts[tn]);
    seasonAvg[tn] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });
  const flightAvgStrength = teamNums.reduce((s, tn) => s + seasonAvg[tn], 0) / teamNums.length;

  // ── Strength-of-schedule regression ──
  const xs = [], ys = [];
  teamNums.forEach(tn => {
    playedRounds.forEach(r => {
      if (histPts[tn][r] === undefined) return;
      const opp = (opponentOf[tn] || {})[r];
      if (opp === undefined || seasonAvg[opp] === undefined) return;
      xs.push(seasonAvg[opp] - flightAvgStrength);
      ys.push(histPts[tn][r] - seasonAvg[tn]);
    });
  });
  let beta = 0;
  if (xs.length > 1) {
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    let cov = 0, varX = 0;
    for (let i = 0; i < xs.length; i++) { cov += (xs[i] - meanX) * (ys[i] - meanY); varX += (xs[i] - meanX) ** 2; }
    beta = varX > 0 ? cov / varX : 0;
  }

  // ── Recent-trend baseline (last 4 played rounds weighted 2x) ──
  const recentMean = {};
  teamNums.forEach(tn => {
    const cutoff = playedRounds[Math.max(0, playedRounds.length - 4)];
    const recent = playedRounds.filter(r => r >= cutoff && histPts[tn][r] !== undefined).map(r => histPts[tn][r]);
    const early  = playedRounds.filter(r => r <  cutoff && histPts[tn][r] !== undefined).map(r => histPts[tn][r]);
    if (recent.length === 0) { recentMean[tn] = seasonAvg[tn]; return; }
    const wR = 2, wE = 1;
    const totalW = wR * recent.length + wE * early.length;
    const s = wR * recent.reduce((a, b) => a + b, 0) + wE * early.reduce((a, b) => a + b, 0);
    recentMean[tn] = totalW > 0 ? s / totalW : seasonAvg[tn];
  });

  const residuals = {};
  teamNums.forEach(tn => {
    residuals[tn] = Object.values(histPts[tn]).map(v => v - seasonAvg[tn]);
    if (residuals[tn].length === 0) residuals[tn] = [0];
  });

  const currentPoints = {};
  flightTeams.forEach(t => { currentPoints[t.team_number] = t.total_points; });

  // Season already over: just report the actual finish.
  if (remainingRounds.length === 0) {
    const result = {};
    teamNums.forEach(tn => {
      const above = teamNums.filter(o => currentPoints[o] > currentPoints[tn]).length;
      result[tn] = (above + 1) <= topN ? 100 : 0;
    });
    return result;
  }

  const rng = mulberry32(0x9E3779B9 ^ maxRound ^ playedRounds.length);
  const topCounts = {};
  teamNums.forEach(tn => { topCounts[tn] = 0; });

  for (let s = 0; s < simulations; s++) {
    const totals = {};
    teamNums.forEach(tn => {
      const base = recentMean[tn];
      const pool = residuals[tn];
      let proj = 0;
      remainingRounds.forEach(r => {
        const opp = (opponentOf[tn] || {})[r];
        const oppRel = (opp !== undefined && seasonAvg[opp] !== undefined) ? (seasonAvg[opp] - flightAvgStrength) : 0;
        const adjMean = base + beta * oppRel;
        const noise = pool[Math.floor(rng() * pool.length)];
        proj += Math.max(0, adjMean + noise);
      });
      totals[tn] = currentPoints[tn] + proj;
    });
    teamNums.forEach(tn => {
      const above = teamNums.filter(o => totals[o] > totals[tn]).length;
      if (above + 1 <= topN) topCounts[tn]++;
    });
  }

  const result = {};
  teamNums.forEach(tn => { result[tn] = (100 * topCounts[tn]) / simulations; });
  return result;
}

function formatTopPct(p) {
  if (p === undefined || p === null) return '—';
  if (p <= 0) return '0%';
  if (p < 1) return '<1%';
  if (p < 10) return `${p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
}

// ── RENDER FLIGHT TABLE ──────────────────────────────────────────────────────
// pointsOverride: optional map { teamNum: points } used when viewing a historical
// week. When omitted, falls back to each team's current total_points (live standings).
// showMovers/showPurse: suppressed for historical weeks since "this week's movement"
// and purse winnings aren't meaningful snapshots of a past date in the same way.
function renderFlight(flight, flightTeams, records, pointsOverride, isHistorical, targetWeek, probOdds) {
  const getPts = (t) => pointsOverride ? (pointsOverride[t.team_number] ?? 0) : t.total_points;

  const teamPoints = flightTeams.map(t => ({ num: t.team_number, pts: getPts(t) }));
  const rankMap    = buildRankMap(teamPoints);
  flightTeams.forEach(t => { t._rank = rankMap[t.team_number]; });
  const sorted     = [...flightTeams].sort((a, b) => getPts(b) - getPts(a));

  const movers = calcMovers(data, flightTeams, targetWeek);

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

    const mv = movers[team.team_number]?.delta;
    let moverCell = `<span class="mover-none">—</span>`;
    if (mv !== undefined && mv !== 0) {
      const cls   = mv > 0 ? 'mover-up' : 'mover-down';
      const arrow = mv > 0 ? '▲' : '▼';
      const abs   = Math.abs(mv);
      moverCell   = `<span class="${cls}">${arrow}${abs}</span>`;
    } else if (mv === 0) {
      moverCell = `<span class="mover-flat">—</span>`;
    }

    let top5Cell = '';
    if (!isHistorical) {
      const pct = probOdds ? probOdds[team.team_number] : undefined;
      const pctCls = (pct !== undefined && pct >= 50) ? 'high' : (pct !== undefined && pct < 1) ? 'low' : '';
      top5Cell = `<td class="top5-cell ${pctCls}">${formatTopPct(pct)}</td>`;
    }

    return `
    <tr onclick="goToSchedule('${team.flight}', ${team.team_number})" style="cursor:pointer;">
      <td class="rank-cell ${isTop3 ? 'top3' : ''}">${rankStr}</td>
      <td class="team-name-cell">
        <div class="players">${team.players_display}</div>
        <div class="team-num">Team ${team.team_number}</div>
      </td>
      <td class="record-cell">
        <span class="rec-w">${rec.w}</span><span class="rec-sep">-</span><span class="rec-l">${rec.l}</span>${rec.t > 0 ? `<span class="rec-sep">-</span><span class="rec-t">${rec.t}</span>` : ''}
      </td>
      <td class="points-cell">${fmt(ptsVal)}</td>
      ${top5Cell}
      <td class="mover-cell">${moverCell}</td>
      <td class="purse-cell ${(!isHistorical && team.purse > 0) ? '' : 'empty'}">${isHistorical ? '—' : purseStr}</td>
    </tr>`;
  }).join('');

  const top5Header = isHistorical ? '' :
    `<th class="num top5-th" title="Modeled probability of finishing top 5 in ${flight} by season end — accounts for recent form (last 4 rounds weighted 2x) and strength of remaining schedule. See INSTRUCTIONS.md.">Top 5%</th>`;

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
          ${top5Header}
          <th class="num" title="Position change vs the previous week (based on weekly total points)">+/-</th>
          <th class="num">Purse</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
let data = null;
let showMovers = false; // movers callout is hidden by default, toggled via link
let probOddsCache = { Sunshine: {}, Lollipops: {} }; // top-5 odds, current week only

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
  const sunshine  = data.teams.filter(t => t.flight === 'Sunshine');
  const lollipops = data.teams.filter(t => t.flight === 'Lollipops');

  const isHistorical = selectedValue !== 'current';
  let pointsOverride = null;
  let labelSuffix = '';
  let targetWeek = undefined; // undefined = let calcMovers default to latest week

  const records = calcRecords(data, isHistorical ? parseInt(selectedValue) : undefined);

  if (isHistorical) {
    const rnd = parseInt(selectedValue);
    pointsOverride = standingsThroughRound(data, rnd);
    targetWeek = rnd;
    const roundKey = Object.keys(data.schedule).find(k => getRoundNumber(k) === rnd);
    const dateStr  = roundKey ? getRoundDate(roundKey) : '';
    labelSuffix = `Standings through Week ${rnd}${dateStr ? ' (' + dateStr + ')' : ''}`;
  }

  document.getElementById('standingsWrap').innerHTML =
    (showMovers ? renderMoversCallout(data, targetWeek) : '') +
    renderFlight('Sunshine',  sunshine,  records, pointsOverride, isHistorical, targetWeek, probOddsCache.Sunshine) +
    renderFlight('Lollipops', lollipops, records, pointsOverride, isHistorical, targetWeek, probOddsCache.Lollipops);

  if (isHistorical) {
    document.getElementById('lastUpdated').textContent =
      `${labelSuffix} · movement vs the previous week · purse not shown for historical weeks`;
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

document.getElementById('moversToggle').addEventListener('click', function (e) {
  e.preventDefault();
  showMovers = !showMovers;
  this.textContent = showMovers ? 'Hide Biggest Risers/Fallers' : 'Show Biggest Risers/Fallers';
  if (data) {
    renderForSelection(document.getElementById('weekSelect').value);
  }
});

loadLeagueData()
  .then(d => {
    data = d;
    probOddsCache.Sunshine  = simulateTopNOdds(data, 'Sunshine', 5);
    probOddsCache.Lollipops = simulateTopNOdds(data, 'Lollipops', 5);
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
