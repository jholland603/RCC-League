# Men's Twilight League — Project Instructions for Claude

## Overview
This project contains data for the **Rochester Country Club Men's Twilight League 2026**. All league data is consolidated in a single JSON file. When asked about player schedules, standings, stats, or any league info, use the JSON as the **sole source of truth**. Never rely on any external document or prior conversation context — always read from the JSON directly.

---

## Who You're Talking To
The user is **Jeffry Holland** — Team 26, Sunshine Flight (Holland, Jeffry + Spalding, David). When they ask "show me my schedule" or refer to "my team", they mean Team 26.

---

## Project Files

| File | Description |
|------|-------------|
| `RCC_League_2026.json` | **Single source of truth.** Contains all team data, player handicap indexes, player stats, flight assignments, standings, round scores, the complete round-by-round schedule, course ratings, tee assignments, and nine rotations. |
| `INSTRUCTIONS.md` | This file. Instructions for Claude. |

---

## JSON Structure

```
{
  "league": ...,
  "season": ...,
  "rainout_note": ...,
  "flights": { "Sunshine": { "team_numbers": [1-32] }, "Lollipops": { "team_numbers": [33-64] } },
  "teams": [
    {
      "team_number": 1-64,
      "flight": "Sunshine" | "Lollipops",
      "players_display": "Last, First + Last, First",
      "total_points": 0.0,
      "purse": 0,
      "overall_rank": 0,  // ⚠️ DO NOT USE — unreliable. Always calculate rank from total_points.
      "players": [
        {
          "name": "Last, First",
          "handicap_index": 0.0,
          "tee": "blue" | "combo" | "white",
          "stats": {
            "eagles": 0, "birdies": 0, "pars": 0,
            "bogeys": 0, "doubles": 0, "triples_worse": 0
          }
        }
      ]
    }
  ],
  "schedule": {
    "round_N_wed_mon_dd": [[team_a, team_b], ...]
  },
  "round_scores": {
    "team_number": { "round_number": pts, ... }
  },
  "subs": [
    {
      "name": "Last, First",
      "handicap_index": null,
      "tee": "blue" | "combo" | "white",  // may be absent if unknown
      "stats": { ... }
    }
  ],
  "course_ratings": {
    "par": 72,
    "tees": {
      "blue":  { "rating": 70.6, "slope": 132 },
      "combo": { "rating": 68.9, "slope": 130 },
      "white": { "rating": 67.3, "slope": 121 }
    }
  },
  "nine_rotations": {
    "round_N_wed_mon_dd": { "Sunshine": "Front"|"Back", "Lollipops": "Front"|"Back" }
  }
}
```

---

## Rainout Adjustment
The season started **one week late** due to a rainout. The schedule keys in the JSON already reflect the correct adjusted dates. Round 1 = **Wed, May 13** (not May 6). Do not shift dates further.

---

## Flight Assignments
- **Sunshine Flight**: Teams 1-32
- **Lollipops Flight**: Teams 33-64
- Always rank standings **within each flight separately**. Never rank all 64 teams together.

---

## ⚠️ RANKING RULES — READ THIS CAREFULLY ⚠️

1. **Sunshine Flight (Teams 1-32) and Lollipops Flight (Teams 33-64) are ALWAYS ranked separately.**
2. **NEVER rank a Sunshine team against a Lollipops team. NEVER.**
3. **NEVER use the `overall_rank` field** — it is unreliable and must be ignored. Always calculate rank fresh from `total_points` within the flight.
4. To rank a team: count how many teams in the **same flight** have **strictly more** total_points. That count + 1 = their rank.
   - Example: 23 Sunshine teams have more total_points than Team 26 → Team 26 is **24th**
5. Abbreviate tied ranks as **(t)** — e.g. "25th (t)".

---

## ⚠️ SCORING RULES — READ THIS CAREFULLY ⚠️

### ⚠️ BEFORE ANYTHING ELSE — CONCRETE EXAMPLES ⚠️
**Always strip the win bonus from stored scores before displaying. The displayed Us and Them values are raw holes won, not stored scores.**

| Stored Us | Stored Them | Display Us | Display Them | W/L/T | Margin |
|-----------|-------------|------------|--------------|-------|--------|
| 3.0 | 7.0 | 3.0 | 6.0 | L | -3 |
| 4.0 | 6.0 | 4.0 | 5.0 | L | -1 |
| 7.0 | 3.0 | 6.0 | 3.0 | W | +3 |
| 5.0 | 5.0 | 4.5 | 4.5 | T | 0 |

- Stored scores always sum to **10.0**
- Displayed (raw holes) always sum to **9.0**
- If your displayed Us + Them does not equal 9.0, you have made an error. Stop and recompute.
- **Do NOT show your work or think out loud about scoring calculations. Compute privately, verify the 9.0 sum, then display.**

### ⚠️ WHICH SCORES GET ADJUSTED FOR DISPLAY ⚠️
- **Winner**: display stored score − 1
- **Loser**: display stored score as-is. Do NOT adjust the loser's score.
- **Tie**: display stored score − 0.5 for EACH team
- **Only in a tie do both scores get adjusted. In a win/loss, ONLY the winner's score is adjusted.**

### How round_scores are stored
Every value in `round_scores` = **holes won + win bonus**:
- **Winner**: stored score = holes won + 1
- **Loser**: stored score = holes won + 0
- **Tie**: stored score = holes won + 0.5 (each team)

### W/L/T
Compare the two stored scores directly. Higher = win. Equal = tie.

### Margin
**The margin is the hole difference, NOT the score difference.**
- Winner's holes = stored score - 1
- Loser's holes = stored score (no adjustment)
- Margin = loser's holes - winner's holes (negative for loser, positive for winner)
- Tie margin = 0

### total_points
- `total_points` is a **trusted stored value** that includes attendance points not stored elsewhere.
- **Never recalculate or cross-reference total_points** against round_scores.

---

## ⚠️ PLUS HANDICAP PLAYERS ⚠️
The following players have **plus handicaps** — their handicap_index in the JSON is stored as a positive number but represents a plus handicap (e.g. 0.7 = +0.7):
- **Ferullo, Kory** (Team 1): 0.6 = +0.6
- **Strong, Kevin** (Team 3): 0.7 = +0.7
- **Cleveland, Jayson** (Team 8): 0.6 = +0.6

When calculating playing handicaps for these players, their course handicap will be negative or near zero. Use the GHIN formula as described below.

---

## PLAYING HANDICAP & STROKES CALCULATION

### Formula (GHIN Method)
```
course_handicap = round(handicap_index * slope / 113)
playing_handicap = course_handicap + round(rating - par)
```
Par = 72. Use the tee's rating and slope from `course_ratings.tees`.

For plus handicap players, handicap_index is positive in the JSON but represents a plus — the formula naturally produces a low or negative course_handicap.

### Strokes Off (Low Man Method)
The league strokes off the **low man** in the foursome:
1. Calculate playing_handicap for all 4 players
2. Find the lowest playing_handicap (the "low man" = 0 strokes)
3. Each other player's strokes = their playing_handicap − low man's playing_handicap
4. For 9 holes, halve the difference:
   - If even: each nine gets the same number
   - If odd: **front nine gets the extra stroke**, back nine gets one fewer
5. Show only the strokes for the nine being played that round

### Nine Rotation
- Stored in `nine_rotations` keyed by round
- Sunshine Flight: Round 1 = Front, Round 2 = Back, alternating
- Lollipops Flight: Round 1 = Back, Round 2 = Front, alternating
- Always use the correct nine when calculating strokes

---

## CRITICAL — How to Build a Schedule

**Follow these steps exactly, in order, every time.**

### Step 1 — Identify the team number
- For Jeffry Holland, the team is always **Team 26**.
- For any other player, search `teams[].players[].name` case-insensitively.

### Step 2 — Extract the schedule
- Sort `schedule` keys by round number (use regex to extract the integer, not alphabetical sort).
- For each of the 16 rounds, find the matchup containing the team number.
- Cross-check Team 26's schedule against the Verified Correct Schedule below.

### Step 3 — Look up opponents
- Get opponent's `players_display`, each player's `handicap_index` and `tee`.
- Calculate opponent's flight rank using `total_points` within their flight only.

### Step 4 — Calculate strokes
- Use the GHIN playing handicap formula.
- Find the low man across all 4 players in the foursome.
- Calculate each player's strokes off for the correct nine (front or back).

### Step 5 — Look up round scores for completed rounds
- Compare stored scores to determine W/L/T and margin.
- Always verify displayed scores sum to 9.0.

### Step 6 — Build the table using the format below.

---

## Display Preferences

- **Always use plain markdown tables** for schedules, standings, and stat leaderboards.
- Always show **flight rank within the team's flight only**.
- Abbreviate tied ranks as **(t)** — e.g. "25th (t)".
- Use **short date format**: M/DD (e.g. 5/13, 6/3, 8/26).
- Show the player's flight rank and cumulative total_points in a brief header line above the schedule table.
- **Source all data from `RCC_League_2026.json`** — never from uploaded documents or prior conversation context.

### Schedule Table Format
Two rows per match (one per player pair). Use first initial + last name for opponents.

| Rnd | Date | Opponent | P1 / P2 | Opp Rank | Us | Them | Result |
|-----|------|----------|---------|----------|----|------|--------|
| 1-F | 5/13 | T. Levesque (5.6) (0) | JH (9.9) (1) | 18th (t) | 3.0 | 6.0 | L -3 |
| | | R. McCarthy (6.0) (0) | DS (12.3) (3) | | | | |

**Column details:**
- **Rnd**: round number + nine (e.g. `1-F`, `2-B`)
- **Date**: M/DD from schedule key
- **Opponent**: `F. Lastname (HI) (strokes)` — first initial, last name, handicap index, strokes for that nine
- **P1 / P2**: team players shown as initials `(HI) (strokes)` — e.g. `JH (9.9) (4)`
- **Opp Rank**: opponent's flight rank by total_points, within their flight only
- **Us / Them**: displayed scores (win bonus stripped). Show `—` for unplayed rounds.
- **Result**: W/L/T combined with margin — e.g. `L -3`, `W +2`, `T`. Show `—` for unplayed.

---

## Weekly Update Workflow

Each week, updated data will be provided. When this happens:

### Step 1 — Update round scores
For each team, record their score for the new round in `round_scores`. Round score = holes won + win bonus (1 for winner, 0 for loser, 0.5 each for tie). Stored scores always sum to 10.0.

### Step 2 — Update player stats
Find each player in `teams[].players[]` by name and update their `stats`. If not found in any team, check `subs[]`. If not found anywhere, note as unmatched and offer to add to `subs`.

### Step 3 — Update team totals
Update each team's `total_points` and `purse` from the standings report. **Do not recalculate total_points from round_scores** — the standings include attendance points not stored elsewhere.

### Step 4 — Save and confirm
Write the updated JSON and provide it as a download. Report: how many players/teams updated and any unmatched names.

---

## Verified Correct Schedule for Team 26 (Holland + Spalding)

| Rnd | Date | Opponent Team # |
|-----|------|----------------|
| 1 | 5/13 | 7 |
| 2 | 5/20 | 5 |
| 3 | 5/27 | 3 |
| 4 | 6/3 | 32 |
| 5 | 6/10 | 30 |
| 6 | 6/17 | 28 |
| 7 | 6/24 | 1 |
| 8 | 7/1 | 27 |
| 9 | 7/8 | 22 |
| 10 | 7/15 | 20 |
| 11 | 7/22 | 18 |
| 12 | 7/29 | 16 |
| 13 | 8/5 | 14 |
| 14 | 8/12 | 12 |
| 15 | 8/19 | 10 |
| 16 | 8/26 | 2 |
