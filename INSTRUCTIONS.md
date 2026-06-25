# Men's Twilight League — Claude Instructions

## WHO YOU ARE TALKING TO
**Jeffry Holland** — Team 26, Sunshine Flight (Holland, Jeffry + Spalding, David). When he says "my team", "my schedule", "us", etc. — that's Team 26.

---

## THE GOLDEN RULES — READ THESE FIRST

1. **`total_points` comes from the standings report ONLY.** Never calculate it from `round_scores`. Standings include attendance points not stored elsewhere. If you calculate it, you will be wrong. Wet noodle.
2. **Never rank Sunshine vs Lollipops together.** Always rank within each flight separately.
3. **Never use `overall_rank`** — it's unreliable. Always calculate rank fresh from `total_points` within the flight.
4. **Rank formula:** count teams in same flight with strictly more `total_points`. That count + 1 = rank. Ties get **(t)**.
5. **Displayed scores always sum to 9.0.** If they don't, stop and recompute.
6. **Today's date matters.** Check it before saying "tonight", "this week", etc.

---

## SOURCE OF TRUTH
All data lives in `RCC_League_2026.json`. Never use prior conversation context or uploaded documents — always read the JSON.

---

## JSON STRUCTURE
```
{
  "league", "season", "rainout_note",
  "flights": { "Sunshine": [1-32], "Lollipops": [33-64] },
  "teams": [
    {
      "team_number", "flight", "players_display",
      "total_points",   ← TRUST THIS. Never recalculate.
      "purse",
      "overall_rank",   ← IGNORE. Always recalculate.
      "players": [ { "name", "handicap_index", "plus_handicap", "tee", "stats": {eagles, birdies, pars, bogeys, doubles, triples_worse} } ]
    }
  ],
  "schedule": { "round_N_wed_mon_dd": [[team_a, team_b], ...] },
  "round_scores": { "team_number": { "round_number": stored_score } },
  "weekly_total_points": { "round_number": { "team_number": weekly_total } },
  "subs": [ { "name", "handicap_index", "stats" } ],
  "course_ratings": { "par": 72, "tees": { "blue": {rating, slope}, "combo": {rating, slope}, "white": {rating, slope} } },
  "nine_rotations": { "round_N_wed_mon_dd": { "Sunshine": "Front"|"Back", "Lollipops": "Front"|"Back" } }
}
```

---

## FLIGHT & SCHEDULE
- Sunshine: Teams 1–32. Lollipops: Teams 33–64.
- 16 rounds, Wednesday evenings. Season started one week late — Round 1 = May 13. Schedule keys already reflect correct dates.
- Sunshine alternates Front/Back starting Round 1 = Front. Lollipops is opposite.

## PLUS HANDICAP PLAYERS
Players with plus handicaps (better than scratch) are flagged with `"plus_handicap": true` on their player record in the JSON. Their `handicap_index` is still stored as a positive number — when `plus_handicap` is true, treat that number as negative for all handicap and stroke calculations.

---

## SCORING

### Round Scores
Values in `round_scores` are stored exactly as shown in the weekly points report. No conversion needed.

### Weekly Total Points (for movers/trend tracking)
`weekly_total_points` is a **separate** field from `round_scores`. Each week's "Team Points Summary" report (per-round, not cumulative) includes match points **plus attendance points**, so these numbers will NOT match `round_scores` for the same round — that's expected, not an error. Store these exactly as shown in that week's report. Used for week-over-week rank movement ("movers") on the schedule page.

### W/L/T and Margin (for display purposes)
- Higher score = win, equal = tie.
- Displayed scores sum to **9.0**. Subtract 1 from the winner's score when displaying; ties subtract 0.5 from each.

### Quick Reference
| Stored Us | Stored Them | Display Us | Display Them | Result |
|-----------|-------------|------------|--------------|--------|
| 3.0 | 7.0 | 3.0 | 6.0 | L -3 |
| 4.0 | 6.0 | 4.0 | 5.0 | L -1 |
| 6.5 | 3.5 | 5.5 | 3.5 | W +2 |
| 5.0 | 5.0 | 4.5 | 4.5 | T 0 |

---

## PLAYING HANDICAP & STROKES

### Formula (GHIN Method)
```
course_handicap = round(handicap_index × slope / 113)
playing_handicap = course_handicap + round(rating − par)
```
Par = 72. Use tee's rating and slope from `course_ratings`. If `plus_handicap` is true for a player, use **−handicap_index** in the formula above.

### Course Ratings
| Tee | Rating | Slope |
|-----|--------|-------|
| Blue | 70.6 | 132 |
| Combo | 68.9 | 130 |
| White | 67.3 | 121 |

### Strokes Off (Low Man Method)
1. Calculate playing_handicap for all 4 players.
2. Low man = 0 strokes. Each other player's strokes = their PH − low man's PH (the raw differential).
3. Apply **80% handicap allowance**: multiply each player's differential by 0.80 and round to nearest integer. (Apply the allowance to the differential, not to each player's raw playing handicap — doing it beforehand double-rounds and overstates strokes.)
4. For 9 holes, halve the full difference. If odd: **front nine gets the extra stroke**.
5. Show only strokes for the nine being played that round.

---

## SCHEDULE TABLE FORMAT
Two rows per match. Compute all handicaps/strokes privately. Show only the final table.

| Rnd | Date | Opponent | P1 / P2 | Opp Rank | Us | Them | Result |
|-----|------|----------|---------|----------|----|------|--------|
| 4-B | 6/3 | D. Ceppetelli (11.8) (1) | JH (9.9) (0) | 19th (t) | 5.5 | 3.5 | W +2 |
| | | J. McKenney (13.7) (2) | DS (12.3) (1) | | | | |

- **Rnd:** round number + nine (1-F, 2-B, etc.)
- **Date:** M/DD
- **Opponent:** F. Lastname (HI) (strokes)
- **P1/P2:** initials (HI) (strokes) — JH = Jeffry Holland, DS = David Spalding
- **Opp Rank:** within opponent's flight only
- **Us/Them:** displayed scores (9.0 sum). `—` if unplayed.
- **Result:** W/L/T with margin, or `—` if unplayed.

### Rendering
Always display the schedule as a **markdown table**, not an HTML widget. Markdown renders natively in chat with no iframe overhead and loads instantly.

---

## VERIFIED SCHEDULE — TEAM 26
| Rnd | Date | Opponent |
|-----|------|----------|
| 1-F | 5/13 | Team 7 |
| 2-B | 5/20 | Team 5 |
| 3-F | 5/27 | Team 3 |
| 4-B | 6/3 | Team 32 |
| 5-F | 6/10 | Team 30 |
| 6-B | 6/17 | Team 28 |
| 7-F | 6/24 | Team 1 |
| 8-B | 7/1 | Team 27 |
| 9-F | 7/8 | Team 22 |
| 10-B | 7/15 | Team 20 |
| 11-F | 7/22 | Team 18 |
| 12-B | 7/29 | Team 16 |
| 13-F | 8/5 | Team 14 |
| 14-B | 8/12 | Team 12 |
| 15-F | 8/19 | Team 10 |
| 16-B | 8/26 | Team 2 |

---

## WEEKLY UPDATE WORKFLOW
When new data is provided:
1. **Round scores** — add to `round_scores` exactly as shown in the report. No back-calculation needed.
2. **Weekly total points** (if a "Team Points Summary" report is given) — add to `weekly_total_points` under that round number, exactly as shown. This is separate from `round_scores` and includes attendance points — do not reconcile the two.
3. **Player stats** — update `teams[].players[].stats`. Unmatched names go in `subs[]`.
4. **Team totals** — update `total_points` and `purse` directly from the standings report. **Do not calculate.**
5. **Handicaps** (when a roster/handicap report is given) — update `handicap_index` for each player. A `+` prefix in the report means `plus_handicap: true`; store the index as a positive number either way.
6. Save JSON and confirm what was updated.
