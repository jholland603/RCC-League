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

function calcPlayingHandicap(hi, tee, courseRatings) {
  const teeData = courseRatings.tees[tee] || courseRatings.tees['blue'];
  const ch = Math.round(hi * teeData.slope / 113);
  const ph = ch + Math.round(teeData.rating - courseRatings.par);
  return ph;
}

function getStrokesFor4(players, courseRatings) {
  const phs = players.map(p => calcPlayingHandicap(p.hi, p.tee || 'blue', courseRatings));
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
