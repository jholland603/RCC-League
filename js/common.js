/* common.js — shared across all RCC League pages */

// ── FAVICON ───────────────────────────────────────────────────────────────────
(function () {
  const link = document.createElement('link');
  link.rel   = 'icon';
  link.type  = 'image/png';
  link.href  = 'rcc_logo.png';
  document.head.appendChild(link);
})();

// ── HEADER / FOOTER INJECTION ────────────────────────────────────────────────

(function () {
  const currentPage = location.pathname.split('/').pop() || 'index.html';

  function navLink(href, label) {
    const active = currentPage === href ? ' class="active"' : '';
    return `<a href="${href}"${active}>${label}</a>`;
  }

  const headerHTML = `
    <header class="site-header">
      <a href="index.html" style="display:flex;align-items:center;gap:1.5rem;text-decoration:none;">
        <div class="logo-mark">
          <img src="rcc_logo.png" alt="Rochester Country Club">
        </div>
        <div class="header-text">
          <h1>Men's Twilight League</h1>
          <p>Rochester Country Club &nbsp;·&nbsp; 2026 Season</p>
        </div>
      </a>
      <nav>
        ${navLink('standings.html', 'Standings')}
        ${navLink('schedule.html', 'Schedule')}
        ${navLink('stats.html', 'Stats')}
      </nav>
    </header>`;

  const footerHTML = `
    <footer class="site-footer">
      Rochester Country Club &nbsp;·&nbsp; Men's Twilight League &nbsp;·&nbsp; 2026
    </footer>`;

  document.getElementById('site-header').outerHTML = headerHTML;
  document.getElementById('site-footer').outerHTML = footerHTML;
})();

// ── DATA LOADER ──────────────────────────────────────────────────────────────
// Returns a promise resolving to the parsed league JSON.
// Tries fetch first; falls back to a file-picker if running from file://.

const RCC_JSON_URL = 'RCC_League_2026.json';

function loadLeagueData() {
  return fetch(RCC_JSON_URL)
    .then(r => { if (!r.ok) throw new Error('fetch failed'); return r.json(); });
}

// ── SCORING UTILITIES ────────────────────────────────────────────────────────

function getRoundNumber(roundKey) {
  const m = roundKey.match(/round_(\d+)_/);
  return m ? parseInt(m[1]) : 0;
}

function getRoundDate(roundKey) {
  const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
                   jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
  const m = roundKey.match(/_(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)_(\d+)$/i);
  if (!m) return '';
  return `${months[m[1].toLowerCase()]}/${parseInt(m[2])}`;
}

// hi: the player's handicap_index as stored (always a positive number).
// isPlus: true if this player carries a PLUS handicap (i.e. better than scratch);
//         in that case the index is treated as negative for all calculations.
function calcPlayingHandicap(hi, tee, courseRatings, isPlus) {
  const teeData = courseRatings.tees[tee] || courseRatings.tees['blue'];
  const signedHi = isPlus ? -hi : hi;
  const ch = Math.round(signedHi * teeData.slope / 113);
  const ph = ch + Math.round(teeData.rating - courseRatings.par);
  return ph;
}

// Handicap allowance for this league's Four-Ball Match Play format.
const HANDICAP_ALLOWANCE = 0.80;

function getStrokesFor4(players, courseRatings) {
  // Apply the handicap allowance to each player's playing handicap before
  // computing the low-man differential. Round to nearest integer.
  const phs = players.map(p => {
    const ph = calcPlayingHandicap(p.hi, p.tee || 'blue', courseRatings, p.isPlus);
    return Math.round(ph * HANDICAP_ALLOWANCE);
  });
  const low = Math.min(...phs);
  return phs.map(ph => ph - low);
}

// For 9 holes: halve full strokes. Front gets extra stroke if odd.
function strokesFor9(fullStrokes, nine) {
  return fullStrokes.map(s => {
    if (s % 2 === 0) return s / 2;
    return nine === 'Front' ? Math.ceil(s / 2) : Math.floor(s / 2);
  });
}

// Takes stored scores (sum = 10.0), returns displayed scores (sum = 9.0) + result
function parseDisplayScore(storedUs, storedThem) {
  let dispUs, dispThem, result;
  if (storedUs > storedThem) {
    dispUs   = storedUs - 1;
    dispThem = storedThem;
    result   = { type: 'W', margin: (storedUs - 1) - storedThem };
  } else if (storedThem > storedUs) {
    dispUs   = storedUs;
    dispThem = storedThem - 1;
    result   = { type: 'L', margin: storedUs - (storedThem - 1) };
  } else {
    dispUs   = storedUs - 0.5;
    dispThem = storedThem - 0.5;
    result   = { type: 'T', margin: 0 };
  }
  return { dispUs, dispThem, result };
}

// ── RANKING UTILITIES ────────────────────────────────────────────────────────

// Rank a team within its flight by total_points (higher = better).
// Returns a string: "1", "T3", etc.
function calcRank(teamNum, flight, teams) {
  const flightTeams = teams.filter(t => t.flight === flight);
  const me = flightTeams.find(t => t.team_number === teamNum);
  if (!me) return '—';
  const above = flightTeams.filter(t => t.total_points > me.total_points).length;
  const rank  = above + 1;
  const ties  = flightTeams.filter(t => t.total_points === me.total_points).length;
  return ties > 1 ? `T${rank}` : `${rank}`;
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function rankLabel(rankStr) {
  return rankStr.startsWith('T') ? rankStr : ordinal(parseInt(rankStr));
}

// Points behind 1st place and 5th place within the team's flight.
// Returns { from1st, from5th } as non-negative numbers (0 if team IS that position,
// or if fewer than 5 teams exist in the flight for from5th).
function calcPointsFromPositions(teamNum, flight, teams) {
  const flightTeams = teams
    .filter(t => t.flight === flight)
    .slice()
    .sort((a, b) => b.total_points - a.total_points);

  const me = flightTeams.find(t => t.team_number === teamNum);
  if (!me) return { from1st: null, from5th: null };

  const firstPlacePts = flightTeams[0]?.total_points ?? me.total_points;
  const from1st = +(firstPlacePts - me.total_points).toFixed(2);

  let from5th = null;
  if (flightTeams.length >= 5) {
    const fifthPlacePts = flightTeams[4].total_points;
    from5th = +(fifthPlacePts - me.total_points).toFixed(2);
  }

  return { from1st, from5th };
}

// ── STRING HELPERS ───────────────────────────────────────────────────────────

// "Holland, Jeffry" → "J. Holland"
function shortName(fullName) {
  const parts = (fullName || '').split(',').map(s => s.trim());
  const last  = parts[0] || '?';
  const first = parts[1] || '';
  return `${first[0] || '?'}. ${last}`;
}

// "Holland, Jeffry" → "JH"
function initials(fullName) {
  const parts = (fullName || '').split(',').map(s => s.trim());
  const last  = parts[0] || '';
  const first = parts[1] || '';
  return (first[0] || '') + (last[0] || '');
}

// Format a score number: integers show without decimal, halves show .5
function fmt(n) {
  return (n % 1 === 0) ? String(n) : n.toFixed(1);
}

// Format a handicap index for display, prefixing "+" for plus-handicap players.
function formatHI(hi, isPlus) {
  if (hi === null || hi === undefined) return '?';
  return isPlus ? `+${hi}` : `${hi}`;
}

// ── MOVERS / TREND UTILITIES ─────────────────────────────────────────────────
// Built from `weekly_total_points`, which stores each week's individual round
// total (match + attendance points) per team. We reconstruct a *cumulative*
// total through any given round to rank teams at that point in time.

// Returns { teamNum: cumulativeTotalThroughRound } for one flight.
function cumulativeThroughRound(weeklyTotalPoints, teams, flight, throughRound) {
  const flightTeamNums = teams.filter(t => t.flight === flight).map(t => t.team_number);
  const cumulative = {};
  flightTeamNums.forEach(tn => { cumulative[tn] = 0; });

  for (let r = 1; r <= throughRound; r++) {
    const weekData = weeklyTotalPoints[String(r)];
    if (!weekData) continue;
    flightTeamNums.forEach(tn => {
      const pts = weekData[String(tn)];
      if (pts !== undefined) cumulative[tn] += pts;
    });
  }
  return cumulative;
}

// Ranks teams (within a flight) by a cumulative-points map. Returns { teamNum: rank }.
// Rank = 1 + count of teams strictly ahead (ties share the same rank, like calcRank).
function rankFromCumulative(cumulative) {
  const entries = Object.entries(cumulative).map(([tn, pts]) => ({ tn: parseInt(tn), pts }));
  const ranks = {};
  entries.forEach(({ tn, pts }) => {
    const above = entries.filter(e => e.pts > pts).length;
    ranks[tn] = above + 1;
  });
  return ranks;
}

// Returns the team's rank movement from the previous round to the current round,
// within their flight, based on cumulative weekly_total_points.
// Positive = moved up (improved) in rank; negative = moved down; 0 = no change.
// Returns null if there isn't enough data (e.g. round 1, or missing weeks).
function calcMovement(teamNum, flight, teams, weeklyTotalPoints, currentRound) {
  if (currentRound < 2) return null;

  const prevRound = currentRound - 1;
  const cumPrev = cumulativeThroughRound(weeklyTotalPoints, teams, flight, prevRound);
  const cumCurr = cumulativeThroughRound(weeklyTotalPoints, teams, flight, currentRound);

  // Bail if this team has no data in either snapshot.
  if (cumPrev[teamNum] === undefined || cumCurr[teamNum] === undefined) return null;

  const ranksPrev = rankFromCumulative(cumPrev);
  const ranksCurr = rankFromCumulative(cumCurr);

  const prevRank = ranksPrev[teamNum];
  const currRank = ranksCurr[teamNum];
  if (prevRank === undefined || currRank === undefined) return null;

  // Moving to a lower rank number (e.g. 5th -> 3rd) is an improvement.
  return prevRank - currRank;
}

// Finds the most recent round number that has weekly_total_points data.
function latestWeeklyRound(weeklyTotalPoints) {
  const rounds = Object.keys(weeklyTotalPoints || {}).map(r => parseInt(r));
  if (rounds.length === 0) return null;
  return Math.max(...rounds);
}

// Returns the team's flight rank at each available week, in order.
// e.g. [{ round: 1, rank: 22 }, { round: 2, rank: 19 }, ...]
function rankTrajectory(teamNum, flight, teams, weeklyTotalPoints) {
  const rounds = Object.keys(weeklyTotalPoints || {}).map(r => parseInt(r)).sort((a, b) => a - b);
  return rounds.map(r => {
    const cum = cumulativeThroughRound(weeklyTotalPoints, teams, flight, r);
    const ranks = rankFromCumulative(cum);
    return { round: r, rank: ranks[teamNum] };
  }).filter(pt => pt.rank !== undefined);
}

// Builds a small inline SVG sparkline of rank-over-time. Lower rank = better,
// so the y-axis is inverted (rank 1 plots near the top).
// trajectory: array of { round, rank } as returned by rankTrajectory().
// flightSize: total teams in the flight, used to scale the y-axis.
function buildRankSparkline(trajectory, flightSize, width = 110, height = 32) {
  if (!trajectory || trajectory.length < 2) return '';

  const padX = 3, padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const n = trajectory.length;

  // Scale to the actual range of ranks this team has occupied, not the full
  // flight size — a 3-spot swing should look like a clear move, not a flat
  // line buried in a 32-team range.
  const ranks = trajectory.map(pt => pt.rank);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  // Pad the range by 1 on each side (clamped to valid rank bounds) so a line
  // that's been perfectly flat, or that touches the best/worst point, still
  // has breathing room above/below instead of running along the edge.
  const rangePadded = Math.max(maxRank - minRank, 1) + 2;
  const rangeMin = Math.max(minRank - 1, 1);

  const xFor = (i) => padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yFor = (rank) => padY + ((rank - rangeMin) / rangePadded) * innerH;

  const points = trajectory.map((pt, i) => `${xFor(i).toFixed(1)},${yFor(pt.rank).toFixed(1)}`);
  const polyline = points.join(' ');

  const first = trajectory[0].rank;
  const last  = trajectory[trajectory.length - 1].rank;
  const improved = last < first;
  const worsened = last > first;
  const lineColor = improved ? 'var(--win)' : worsened ? 'var(--loss)' : 'var(--text-muted)';

  const lastX = xFor(n - 1);
  const lastY = yFor(last);

  return `
  <svg class="rank-sparkline" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${polyline}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.4" fill="${lineColor}" />
  </svg>`;
}
