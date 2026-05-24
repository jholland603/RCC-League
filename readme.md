# Rochester Country Club Men's Twilight League 2026

This repository hosts the data tracking, schedule validation, and statistical engine for the **2026 Men's Twilight League** at Rochester Country Club. 

The project streamlines league administration, handles weekly match results, isolates flight standings, and generates formatted schedules.

---

## 📂 Project Structure

The project relies strictly on a flat, two-file structure. No external tracking documents are permitted.

*   **`RCC_League_2026.json`**  
    *Single source of truth.* Houses all player handicaps, flight rosters, weekly matchups, raw statistics, and current point standings.
*   **`INSTRUCTIONS.md`**  
    Core system instructions, display preferences, and strict logic rules for AI processing.

---

## ⚙️ Core Logic Rules

### 1. Flight Isolation
The league is divided into two distinct, independent flights:
*   **Sunshine Flight**: Teams 1 through 32
*   **Lollipops Flight**: Teams 33 through 64

*Note: Leaderboards and rankings must be computed **strictly within each flight**. Teams are never ranked across the entire 64-team field.*

### 2. Scoring & Display Math
Match points are stored with a win/tie bonus baked in, meaning every completed matchup sums to **10.0 points** in the database. When rendering user-facing tables, the system strips the bonus so the displayed match holes sum exactly to **9.0**.

$$ \text{Stored Scores Total} = 10.0 \longrightarrow \text{Displayed Holes Total} = 9.0 $$

*   **Winner Assignment**: Display score = Stored score minus 1.0
*   **Loser Assignment**: Display score = Stored score as-is (no adjustment)
*   **Tie Assignment**: Display score = Stored score minus 0.5 (applied to both teams)

### 3. Margin Calculations
Margins represent raw hole differentials, not points differentials. 
*   **Win/Loss Margin**: Winner's Adjusted Holes minus Loser's Adjusted Holes
*   **Tie Margin**: Always 0

---

## 📅 Schedule Architecture
The season consists of 16 rounds. Due to an early-season rainout, the schedule keys natively account for a one-week delay:
*   **Round 1**: Wednesday, May 13
*   **Round 16**: Wednesday, August 26

---

## 🛠️ Weekly Update Workflow

When new weekly match data arrives, update the data asset using the following sequence:

1.  **Update Round Scores**: Input new match outcomes into `round_scores` using the 10-point format.
2.  **Increment Player Stats**: Log performance variables (pars, birdies, bogeys) for rostered players and active substitutes (`subs`).
3.  **Recalculate Standings**: Update cumulative `total_points`, `purse`, and flight-specific ranks. *Do not overwrite total points with a raw math sum, as attendance points are handled separately.*
