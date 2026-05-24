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
| `RCC_League_2026.json` | **Single source of truth.** Contains all team data, player handicap indexes, player stats, flight assignments, standings, round scores, and the complete round-by-round schedule. |
| `INSTRUCTIONS.md` | This file. Instructions for Claude. |

No other files are needed. All data lives in the JSON.

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
      "overall_rank": 0,
      "players": [
        {
          "name": "Last, First",
          "handicap_index": 0.0,
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
      "stats": { ... }
    }
  ]
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
- **Do NOT show your work or think out loud about scoring calculations. Compute privately, verify the 9.0 sum, then display. Thinking out loud leads to talking yourself into the wrong answer.**

The Us/Them columns show raw holes won. Strip the win bonus before displaying: winner −1, loser −0, tie −0.5 each.

### ⚠️ WHICH SCORES GET ADJUSTED FOR DISPLAY ⚠️
- **Winner**: display stored score − 1
- **Loser**: display stored score as-is. Do NOT adjust the loser's score.
- **Tie**: display stored score − 0.5 for EACH team
- **Only in a tie do both scores get adjusted. In a win/loss, ONLY the winner's score is adjusted. Never display the winner's stored score directly in the table.**

### How round_scores are stored
Every value in `round_scores` = **holes won + win bonus**. The win bonus is already baked in:
- **Winner**: stored score = holes won + 1
- **Loser**: stored score = holes won + 0
- **Tie**: stored score = holes won + 0.5 (each team)

### What this means in practice
- If Team A won 6 holes and Team B won 3 holes, the stored scores are: Team A = **7.0**, Team B = **3.0**
- If Team A won 5 holes and Team B won 4 holes, the stored scores are: Team A = **6.0**, Team B = **4.0**
- If each team won 4.5 holes (tie), the stored scores are: Team A = **5.0**, Team B = **5.0**
- The two stored scores will always sum to **10.0**, never 9.0

### W/L/T
Compare the two stored scores directly. Higher = win. Equal = tie.

### ⚠️ Margin — THIS IS WHERE CLAUDE GETS IT WRONG ⚠️
**The margin is the hole difference, NOT the score difference.**

To compute margin for a WIN or LOSS:
1. Identify the winner (higher stored score) and loser (lower stored score)
2. Winner's holes = stored score - 1 (strip the +1 win bonus)
3. Loser's holes = stored score (no bonus was added)
4. Margin = loser's holes - winner's holes (negative for the loser, positive for the winner)

To compute margin for a TIE:
1. Each team's holes = stored score - 0.5 (strip the +0.5 tie bonus from each)
2. Margin = 0 (by definition)

**Worked examples using actual Team 26 data:**
- Round 1: Us = 3.0, Them = 7.0. Them are winner: 7.0 - 1 = 6 holes. Us = 3 holes. Margin = 3 - 6 = **-3**
- Round 2: Us = 4.0, Them = 6.0. Them are winner: 6.0 - 1 = 5 holes. Us = 4 holes. Margin = 4 - 5 = **-1**
- Tie example: Us = 5.0, Them = 5.0. Us holes = 5.0 - 0.5 = 4.5. Them holes = 5.0 - 0.5 = 4.5. Margin = **0**

**DO NOT** simply subtract the two stored scores (3.0 - 7.0 = -4 is WRONG; 4.0 - 6.0 = -2 is WRONG).

### total_points
- `total_points` is a **trusted stored value**. Always use it as-is from the JSON.
- **Never recalculate or cross-reference total_points** against round_scores. It includes attendance points not stored elsewhere. Any recalculation will be wrong.
- If total_points doesn't match the sum of round_scores, that is expected and correct.

---

## ⚠️ RANKING RULES — READ THIS CAREFULLY ⚠️

1. **Sunshine Flight (Teams 1-32) and Lollipops Flight (Teams 33-64) are ALWAYS ranked separately.**
2. **NEVER rank a Sunshine team against a Lollipops team. NEVER.**
3. To rank a team: count how many teams in the **same flight** have **strictly more** total_points. That count + 1 = their rank.
   - Example: 24 Sunshine teams have more total_points than Team 26 → Team 26 is **25th (t)**
4. Abbreviate tied ranks as **(t)** — e.g. "25th (t)".

---

## CRITICAL — How to Build a Schedule

**This is the most failure-prone task. Follow these steps exactly, in order, every time.**

### Step 1 — Identify the team number
- For Jeffry Holland, the team is always **Team 26**.
- For any other player, search `teams[].players[].name` case-insensitively to find their team.

### Step 2 — Extract the schedule for that team
- Open the `schedule` node. It has 16 keys, one per round (e.g. `round_1_wed_may_13`).
- Each round is a list of matchups: `[[team_a, team_b], [team_a, team_b], ...]`
- For **each of the 16 rounds**, find the one matchup that contains the team number.
- **Do this for all 16 rounds before building the table.** Do not guess or infer — read every round explicitly.
- The two numbers in the matchup are the two team numbers playing each other that week. One will be your team; the other is the opponent.
- **Cross-check your results against the Verified Correct Schedule at the bottom of this file before displaying.**

### Step 3 — Look up each opponent
- For each round, take the opponent team number and find that team in `teams[]`.
- Read their `players_display` to get player names, and look up each player's `handicap_index` from `teams[].players[]`.
- Rank the opponent within their flight by `total_points` (see Ranking Rules above).

### Step 4 — Look up round scores for completed rounds
- A round is completed if its date is before today.
- For completed rounds, look up `round_scores[team_number][round_number]` for both teams.
- Compute W/L/T and margin using the rules above.

### Step 5 — Build the table
- Use the exact format specified in Display Preferences below.

---

## Weekly Update Workflow

Each week, updated data will be provided for ingestion into the JSON. When this happens:

### Step 1 — Update round scores
For each team, record their score for the new round in `round_scores` keyed by team number (outer) and round number (inner). Round score = holes won + win bonus (1 for winner, 0 for loser, 0.5 each for tie).

### Step 2 — Update player stats
For each player, find them in `teams[].players[]` by name and update their `stats`. If not found in any team, check `subs[]`. If not found anywhere, note as unmatched and offer to add to `subs`.

### Step 3 — Update team totals
Update each team's `total_points`, `purse`, and `overall_rank`.

### Step 4 — Save and confirm
Write the updated JSON and provide it as a download. Report: how many players updated and any unmatched names.

---

## Display Preferences

- **Always use plain markdown tables** for schedules, standings, and stat leaderboards. Do NOT use interactive widgets or visualizations.
- Always show **flight rank within the team's flight only**, never a combined rank across both flights.
- Abbreviate tied ranks as **(t)** — e.g. "25th (t)".
- Use **short date format**: M/DD (e.g. 5/13, 6/3, 8/26).
- Show the player's flight rank and cumulative round score points in a brief header line above the schedule table.
- **Source all data from `RCC_League_2026.json`** — never from uploaded documents or prior conversation context.

### Schedule Table Format
Display schedule tables with these columns, in this order:

| Rnd | Date | Opponent | Opp Rank | Us | Them | W/L/T | Margin |
|-----|------|----------|----------|----|------|-------|--------|

- **Rnd**: round number (1-16).
- **Date**: short format M/DD derived from the schedule key (e.g. `round_1_wed_may_13` → 5/13).
- **Opponent**: last names only, with handicap index in parentheses. E.g. `Levesque (5.6) + McCarthy (6.0)`. Do NOT include team numbers.
- **Opp Rank**: opponent's flight rank by `total_points`, within their flight only. E.g. `12th (t)`.
- **Us**: your team's `round_scores` value for that round. Show `—` for unplayed rounds.
- **Them**: opponent's `round_scores` value for that round. Show `—` for unplayed rounds.
- **W/L/T**: W, L, or T based on comparing Us vs Them. Show `—` for unplayed rounds.
- **Margin**: hole difference as described in Scoring Rules above (e.g. -3, +2). Show `—` for unplayed rounds.
- Do NOT include a Status column.
- Do NOT include team numbers anywhere in the table.

---

## Verified Correct Schedule for Team 26 (Holland + Spalding)
The following opponent team numbers are correct for all 16 rounds. **Always cross-check your schedule output against this table before displaying.**

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
