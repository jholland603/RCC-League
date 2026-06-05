# Men's Twilight League — Claude Instructions

## WHO YOU ARE TALKING TO
**Jeffry Holland** — Team 26, Sunshine Flight (Holland, Jeffry + Spalding, David).

---

## PURPOSE
This conversation exists to maintain `RCC_League_2026.json`. Jeffry uploads weekly reports and Claude updates the JSON accordingly. The web site reads the JSON directly — Claude does not need to render schedules, standings, or stats in chat.

---

## WEEKLY UPDATE WORKFLOW
Jeffry will upload some or all of the following each week. Update only what's provided.

### 1. Standings Report → `total_points` and `purse`
- Update `teams[].total_points` and `teams[].purse` directly from the report.
- **Never calculate total_points** — the report includes attendance points that aren't stored anywhere else.

### 2. Round Scores → `round_scores`
- Add each team's score for the new round under `round_scores[team_number][round_number]`.
- Stored score = holes won + win bonus (winner +1, loser +0, tie +0.5 each).
- Stored scores for any match must always sum to **10.0**. Verify before saving.

### 3. Player Stats → `teams[].players[].stats`
- Stats are cumulative season totals: eagles, birdies, pars, bogeys, doubles, triples_worse.
- Match players by name to their team entry. If a name doesn't match any rostered player, add them to `subs[]`.

### 4. Confirm
After updating, tell Jeffry what was changed: which round was added, which teams had points/purse updates, and how many player stat lines were updated.

---

## JSON STRUCTURE
```
{
  "league", "season", "rainout_note",
  "flights": { "Sunshine": [1-32], "Lollipops": [33-64] },
  "teams": [
    {
      "team_number", "flight", "players_display",
      "total_points",   ← from standings report only
      "purse",
      "overall_rank",   ← ignore, not used
      "players": [ { "name", "handicap_index", "tee", "stats": {eagles, birdies, pars, bogeys, doubles, triples_worse} } ]
    }
  ],
  "schedule": { "round_N_wed_mon_dd": [[team_a, team_b], ...] },
  "round_scores": { "team_number": { "round_number": stored_score } },
  "subs": [ { "name", "handicap_index", "stats" } ],
  "course_ratings": { "par": 72, "tees": { "blue": {rating, slope}, "combo": {rating, slope}, "white": {rating, slope} } },
  "nine_rotations": { "round_N_wed_mon_dd": { "Sunshine": "Front"|"Back", "Lollipops": "Front"|"Back" } }
}
```

---

## KEY FACTS
- Sunshine: Teams 1–32. Lollipops: Teams 33–64.
- 16 rounds, Wednesday evenings. Round 1 = May 13 (started one week late due to rainout).
- Par = 72 (full round), 36 per nine. Par per hole = 4.
- Plus handicap players stored as positive numbers: Ferullo Kory (T1) +0.6, Strong Kevin (T3) +0.7, Cleveland Jayson (T8) +0.6.
