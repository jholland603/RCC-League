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
//   1. Recency-weighted baseline: each played round is weighted decay^(roundsAgo)
//      (DECAY chosen so a round ~4 back counts ~half of the most recent one) —
//      a smooth version of "recent form matters more", no hard cutoff.
//   2. Schedule-adjusted power ratings: instead of measuring "opponent strength"
//      as an opponent's raw season average (which is itself distorted by
//      whatever schedule THAT opponent faced — circular), every team's rating
//      is solved for jointly via a ridge-regularized, recency-weighted Massey
//      system: for every played match, margin(a,b) = score_a − score_b is
//      regressed against rating_a − rating_b, across the whole flight at once.
//      This nets out schedule strength network-wide (using common opponents
//      transitively) and the ridge penalty shrinks ratings toward 0 — more so
//      early in the season when there's less data to trust.
//   3. Schedule-effect baseline: a team's own recency-weighted average already
//      reflects whatever mix of opponents it happened to face so far. Projecting
//      a specific future opponent is done relative to THAT team's own
//      already-faced average opponent rating (also shrunk toward 0 by games
//      played), not the flight's grand average — otherwise a team that's had
//      a historically soft (or brutal) schedule gets mis-projected.
//   4. Correlated match simulation: remaining rounds are simulated one MATCH at
//      a time (not one team at a time). Noise is drawn as a matched PAIR from
//      actual historical match residuals, preserving the real (strongly
//      negative — see below) correlation between what happens to two teams
//      playing the same match, rather than treating them as independent.
// Basis is weekly_total_points (NOT round_scores) — see GOLDEN RULE #1 / the
// methodology section for why.

const TOP5_DECAY            = 0.8409; // per-round recency weight; decay^4 ≈ 0.5
const TOP5_RIDGE_LAMBDA_FRAC = 0.3;   // ridge penalty, as a fraction of avg weight/team
const TOP5_OPP_SHRINK_K     = 12;     // pseudo-rounds of "assume average schedule" prior

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

// Solves the n×n linear system M·x = p via Gaussian elimination with partial
// pivoting. Used to solve the (ridge-regularized) Massey ratings system.
function solveLinearSystem(M, p, n) {
  const A = M.map(row => row.slice());
  const b = p.slice();
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    [b[col], b[piv]] = [b[piv], b[col]];
    const pv = A[col][col];
    if (Math.abs(pv) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / pv;
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = 0; i < n; i++) x[i] = Math.abs(A[i][i]) > 1e-12 ? b[i] / A[i][i] : 0;
  return x;
}

// { roundNum: [[a, b], ...] } — schedule matches for one flight only, and
// { teamNum: { roundNum: opponentTeamNum } } for quick per-team lookups.
function buildScheduleMaps(schedule, teamSet) {
  const matchesByRound = {};
  const opponentOf = {};
  Object.keys(schedule).forEach(roundKey => {
    const rnum = getRoundNumber(roundKey);
    const matches = schedule[roundKey].filter(([a, b]) => teamSet.has(a) && teamSet.has(b));
    if (matches.length) matchesByRound[rnum] = matches;
    matches.forEach(([a, b]) => {
      opponentOf[a] = opponentOf[a] || {};
      opponentOf[b] = opponentOf[b] || {};
      opponentOf[a][rnum] = b;
      opponentOf[b][rnum] = a;
    });
  });
  return { matchesByRound, opponentOf };
}

// Returns { teamNum: percentChanceTopN } for one flight.
function simulateTopNOdds(data, flight, topN = 5, simulations = 8000) {
  const flightTeams = data.teams.filter(t => t.flight === flight);
  const teamNums    = flightTeams.map(t => t.team_number);
  const teamSet     = new Set(teamNums);
  const idx = {}; teamNums.forEach((tn, i) => idx[tn] = i);
  const N = teamNums.length;

  const weeklyTotalPoints = data.weekly_total_points || {};
  const playedRounds = availableWeeks(data);
  if (playedRounds.length === 0) return { odds: {}, details: {} };

  const maxPlayed = Math.max(...playedRounds);
  const maxRound  = Math.max(...Object.keys(data.schedule).map(getRoundNumber));
  const playedSet = new Set(playedRounds);
  const remainingRounds = [];
  for (let r = 1; r <= maxRound; r++) if (!playedSet.has(r)) remainingRounds.push(r);

  const { matchesByRound, opponentOf } = buildScheduleMaps(data.schedule, teamSet);

  // Recency weight per played round: most recent = 1, decaying backward.
  const w = {};
  playedRounds.forEach(r => { w[r] = Math.pow(TOP5_DECAY, maxPlayed - r); });

  // Per-round historical points, this flight only.
  const histPts = {};
  teamNums.forEach(tn => {
    histPts[tn] = {};
    playedRounds.forEach(r => {
      const v = (weeklyTotalPoints[String(r)] || {})[String(tn)];
      if (v !== undefined) histPts[tn][r] = v;
    });
  });

  // Plain (unweighted) season average — shown in the tooltip as a trend reference only.
  const seasonAvg = {};
  teamNums.forEach(tn => {
    const vals = Object.values(histPts[tn]);
    seasonAvg[tn] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });

  // ── Recency-weighted baseline ──
  const recentMean = {};
  teamNums.forEach(tn => {
    let sw = 0, sv = 0;
    playedRounds.forEach(r => {
      if (histPts[tn][r] === undefined) return;
      sw += w[r]; sv += w[r] * histPts[tn][r];
    });
    recentMean[tn] = sw > 0 ? sv / sw : 0;
  });

  // ── Ridge-regularized, recency-weighted Massey power ratings ──
  // For every played match: margin(a,b) = score_a - score_b ≈ rating_a - rating_b,
  // solved jointly across the whole flight (weighted least squares + ridge shrinkage).
  const M = Array.from({ length: N }, () => new Array(N).fill(0));
  const p = new Array(N).fill(0);
  let totalWeight = 0;
  playedRounds.forEach(r => {
    (matchesByRound[r] || []).forEach(([a, b]) => {
      const sa = histPts[a] && histPts[a][r], sb = histPts[b] && histPts[b][r];
      if (sa === undefined || sb === undefined) return;
      const wt = w[r], ia = idx[a], ib = idx[b], margin = sa - sb;
      M[ia][ia] += wt; M[ib][ib] += wt; M[ia][ib] -= wt; M[ib][ia] -= wt;
      p[ia] += wt * margin; p[ib] -= wt * margin;
      totalWeight += wt;
    });
  });
  const avgWeightPerTeam = (totalWeight * 2) / N;
  const lambda = avgWeightPerTeam * TOP5_RIDGE_LAMBDA_FRAC;
  for (let i = 0; i < N; i++) M[i][i] += lambda;
  const ratingArr = solveLinearSystem(M, p, N);
  const meanRating = ratingArr.reduce((a, b) => a + b, 0) / N; // re-center so flight avg = 0
  const rating = {};
  teamNums.forEach((tn, i) => { rating[tn] = ratingArr[i] - meanRating; });

  // ── Each team's own already-faced schedule strength (shrunk toward 0) ──
  // Prevents overreacting to a small-sample "easy" or "brutal" schedule so far.
  const avgHistOppRating = {};
  teamNums.forEach(tn => {
    let sw = 0, sv = 0, cnt = 0;
    playedRounds.forEach(r => {
      const opp = (opponentOf[tn] || {})[r];
      if (opp === undefined || rating[opp] === undefined) return;
      sw += w[r]; sv += w[r] * rating[opp]; cnt++;
    });
    const raw = sw > 0 ? sv / sw : 0;
    avgHistOppRating[tn] = raw * (cnt / (cnt + TOP5_OPP_SHRINK_K));
  });

  // Projected score for team t in a round against a specific opponent: t's own
  // recency-weighted baseline, shifted by how much tougher/easier this opponent
  // is than what t has typically already faced.
  function projected(t, opp) {
    return recentMean[t] - (rating[opp] - avgHistOppRating[t]);
  }

  // ── Correlated residual pairs from actual played matches ──
  // Reusing real matched-pairs (rather than drawing independent noise per team)
  // preserves the strong real correlation between two teams' results in the
  // same match (empirically ~ -0.8: one team's good night is the other's bad one).
  const residualPairs = [];
  playedRounds.forEach(r => {
    (matchesByRound[r] || []).forEach(([a, b]) => {
      const sa = histPts[a] && histPts[a][r], sb = histPts[b] && histPts[b][r];
      if (sa === undefined || sb === undefined) return;
      residualPairs.push([sa - projected(a, b), sb - projected(b, a)]);
    });
  });
  if (residualPairs.length === 0) residualPairs.push([0, 0]);

  const currentPoints = {};
  flightTeams.forEach(t => { currentPoints[t.team_number] = t.total_points; });

  // Season already over: just report the actual finish (no useful "detail" to show).
  if (remainingRounds.length === 0) {
    const odds = {}, details = {};
    teamNums.forEach(tn => {
      const above = teamNums.filter(o => currentPoints[o] > currentPoints[tn]).length;
      odds[tn] = (above + 1) <= topN ? 100 : 0;
      details[tn] = null;
    });
    return { odds, details };
  }

  const rng = mulberry32(0x9E3779B9 ^ maxRound ^ playedRounds.length);
  const topCounts = {};
  const projSum = {};
  teamNums.forEach(tn => { topCounts[tn] = 0; projSum[tn] = 0; });

  for (let s = 0; s < simulations; s++) {
    const totals = {};
    teamNums.forEach(tn => { totals[tn] = currentPoints[tn]; });

    // Simulate one MATCH at a time so both sides share a single drawn residual pair.
    remainingRounds.forEach(r => {
      (matchesByRound[r] || []).forEach(([a, b]) => {
        const pair = residualPairs[Math.floor(rng() * residualPairs.length)];
        const swap = rng() < 0.5; // pair isn't ordered by strength, so randomize which side it lands on
        const rA = swap ? pair[1] : pair[0];
        const rB = swap ? pair[0] : pair[1];
        totals[a] += Math.max(0, projected(a, b) + rA);
        totals[b] += Math.max(0, projected(b, a) + rB);
      });
    });

    teamNums.forEach(tn => { projSum[tn] += totals[tn]; });
    teamNums.forEach(tn => {
      const above = teamNums.filter(o => totals[o] > totals[tn]).length;
      if (above + 1 <= topN) topCounts[tn]++;
    });
  }

  const odds = {}, details = {};
  teamNums.forEach(tn => {
    odds[tn] = (100 * topCounts[tn]) / simulations;
    const avgFutureOppRating = remainingRounds.reduce((sum, r) => {
      const opp = (opponentOf[tn] || {})[r];
      return sum + (opp !== undefined && rating[opp] !== undefined ? rating[opp] : 0);
    }, 0) / remainingRounds.length;
    details[tn] = {
      currentPoints: currentPoints[tn],
      seasonAvg: seasonAvg[tn],
      recentMean: recentMean[tn],
      rating: rating[tn],
      avgHistOppRating: avgHistOppRating[tn],
      avgFutureOppRating,
      remainingRounds: remainingRounds.length,
      projFinal: projSum[tn] / simulations,
      simulations,
    };
  });

  return { odds, details };
}

function formatTopPct(p) {
  if (p === undefined || p === null) return '—';
  if (p <= 0) return '0%';
  if (p < 1) return '<1%';
  if (p < 10) return `${p.toFixed(1)}%`;
  return `${Math.round(p)}%`;
}

// Builds the per-team hover explanation for a Top 5% cell, using the detail
// object returned alongside the odds from simulateTopNOdds().
function buildTop5Tooltip(team, rankStr, pct, d, flight) {
  if (!d) return `${formatTopPct(pct)} chance of finishing top 5 in ${flight}.`;

  const trendDir = d.recentMean > d.seasonAvg ? 'up' : d.recentMean < d.seasonAvg ? 'down' : 'flat';
  const trendWord = trendDir === 'up' ? 'trending up' : trendDir === 'down' ? 'trending down' : 'steady';

  const sign = (v) => (v > 0 ? '+' : '') + v.toFixed(2);

  const oppDiff = d.avgFutureOppRating - d.avgHistOppRating;
  const oppWord = oppDiff > 0.15 ? 'tougher than' : oppDiff < -0.15 ? 'easier than' : 'about the same as';

  const lines = [
    `${rankLabel(rankStr)} in ${flight} · ${fmt(d.currentPoints)} pts now`,
    ``,
    `Recent form (recency-weighted): ${d.recentMean.toFixed(2)} pts/rd — ${trendWord} vs ${d.seasonAvg.toFixed(2)} season avg`,
    `Power rating (schedule-adjusted): ${sign(d.rating)} pts/rd vs an average ${flight} team`,
    `Remaining ${d.remainingRounds} rounds' opponents rate ${sign(d.avgFutureOppRating)} avg — ${oppWord} the schedule already played (${sign(d.avgHistOppRating)})`,
    `Projected final total: ~${d.projFinal.toFixed(1)} pts (avg of ${d.simulations.toLocaleString()} simulated seasons, using actual remaining matchups)`,
    ``,
    `→ ${formatTopPct(pct)} chance of finishing top 5 in ${flight}`,
  ];
  return lines.join('\n');
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
      const pct = probOdds ? probOdds.odds[team.team_number] : undefined;
      const detail = probOdds ? probOdds.details[team.team_number] : undefined;
      const pctCls = (pct !== undefined && pct >= 50) ? 'high' : (pct !== undefined && pct < 1) ? 'low' : '';
      const tooltip = buildTop5Tooltip(team, rankStr, pct, detail, flight);
      top5Cell = `<td class="top5-cell ${pctCls}" title="${tooltip.replace(/"/g, '&quot;')}">${formatTopPct(pct)}</td>`;
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
    `<th class="num top5-th" title="Modeled probability of finishing top 5 in ${flight} by season end — accounts for recency-weighted form, a schedule-adjusted power rating for every team, and each team's actual remaining matchups. Hover a team's percentage for the full breakdown.">Top 5%</th>`;

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
let probOddsCache = { Sunshine: { odds: {}, details: {} }, Lollipops: { odds: {}, details: {} } }; // top-5 odds, current week only

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
