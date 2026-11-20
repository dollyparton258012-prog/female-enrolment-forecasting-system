# TEST LOG — Forecasting System for Female Enrolment in Computer Science in Nigeria
Tested: 20 November 2026, on this machine (Node v24.22.1, npm 10.9.4).
Server: `node server.js` on port 3000. All tests run against a live server.

## Sample-data note
All test data is the built-in **illustrative sample dataset** (2015: 120,
2016: 135, 2017: 142, 2018: 158, 2019: 171, 2020: 165, 2021: 189,
2022: 204, 2023: 218, 2024: 236). These are **NOT real NUC figures** — they
are made-up numbers for demonstrating and testing the system. The app shows
an "ILLUSTRATIVE SAMPLE DATA — not real NUC figures" banner whenever this
dataset is loaded.

## Setup
- `npm install` — PASS. 70 packages added in ~10 s. No errors.
- Server start — PASS. Log: `Female Enrolment Forecasting System running on http://localhost:3000`.
- Port 3000 was free, so no fallback port was needed.

## Endpoint results (curl)

| # | Test | Result |
|---|---|---|
| 1 | `GET /api/health` (empty) | 200 — `{status:"ok", rows:0, sampleLoaded:false}` |
| 2 | `GET /api/data` (empty) | 200 — `{rows:[], sampleLoaded:false}` |
| 3 | `POST /api/data` 2025: 250 | 201 — row stored |
| 4 | `POST /api/data` duplicate 2025 | 400 — `A row for year 2025 already exists. Edit it instead.` |
| 5 | `POST /api/data` year 25 | 400 — `Year must be a 4-digit number (e.g. 2024).` |
| 6 | `POST /api/data` enrolment −5 | 400 — `Female enrolment must be a non-negative number.` |
| 7 | `PUT /api/data/2025` → 255 | 200 — row updated to 255 |
| 8 | `PUT /api/data/2030` (missing) | 404 — `No row found for year 2030.` |
| 9 | `DELETE /api/data/2025` | 200 — `{deleted:true}`, rows empty |
| 10 | `DELETE /api/data/2025` again | 404 — `No row found for year 2025.` |
| 11 | `POST /api/data/sample` | 200 — 10 rows loaded (2015–2024), `sampleLoaded:true` |
| 12 | `GET /api/data` (sample) | 200 — all 10 sample rows, sorted by year |
| 13 | `POST /api/forecast` moving-average, 3 yr | 200 — 2025: 219.3, 2026: 224.4, 2027: 226.6 |
| 14 | `POST /api/forecast` linear-regression, 3 yr | 200 — 2025: 241.2, 2026: 253.5, 2027: 265.7 |
| 15 | `POST /api/forecast` exponential-smoothing, alpha 0.3, 2 yr | 200 — 2025: 202.8, 2026: 202.8 (flat forecast, as expected) |
| 16 | `POST /api/forecast` method `arima` | 400 — `Method must be one of: moving-average, linear-regression, exponential-smoothing.` |
| 17 | `POST /api/forecast` yearsAhead 6 | 400 — `Years ahead must be a whole number from 1 to 5.` |
| 18 | `POST /api/forecast` alpha 1.5 | 400 — `Alpha must be a number between 0 and 1.` |
| 19 | `POST /api/accuracy` moving-average | 200 — MAPE 19.01%, MAE 42.2 (train 2015–2021, test 2022–2024) |
| 20 | `POST /api/accuracy` linear-regression | 200 — MAPE 5.46%, MAE 12.2 (best of the three) |
| 21 | `POST /api/accuracy` exponential-smoothing, alpha 0.3 | 200 — MAPE 25.01%, MAE 55.43 |
| 22 | `POST /api/accuracy` method `nope` | 400 — method error as in test 16 |
| 23 | `POST /api/data/import` merge 2025: 250, 2024: 240 | 200 — 11 rows; 2024 overwritten to 240, 2025 added, `imported:2` |
| 24 | `POST /api/data/import` row with year 99 | 400 — `Invalid year in import: 99. Year must be a 4-digit number.` |
| 25 | `POST /api/data/import` replace, 2 rows | 200 — dataset replaced by 2020: 100, 2021: 110; `sampleLoaded:false` |
| 26 | `POST /api/forecast` moving-average with 2 rows | 400 — `Need at least 3 year(s) of data for moving-average (have 2).` |
| 27 | `POST /api/accuracy` linear-regression with 2 rows | 400 — `Need at least 5 year(s) of data to backtest linear-regression (train on all but the last 3 years; have 2).` |
| 28 | `DELETE /api/data` (clear all) | 200 — `{deleted:true, rows:[], sampleLoaded:false}` |
| 29–31 | Frontend `GET /`, `/app.js`, `/styles.css` | 200 each |
| 32 | `POST /api/data/sample` (re-load for screenshots) | 200 — 10 rows |

Spot-check of the maths (hand-verified): moving-average 2025 = mean of
204, 218, 236 = 219.3 ✓; 2026 = mean of 218, 236, 219.3 = 224.4 ✓.
Linear regression slope ≈ 12.24/year, giving 2025 ≈ 241.2 ✓.

## UI checks (stock Chrome Headless Shell, CDP)
- Data page loads with the sample dataset: 10 rows in the table, banner
  "ILLUSTRATIVE SAMPLE DATA — not real NUC figures" visible — PASS
  (see `figures/fig-4-1-data-entry.png`).
- Forecast via the real UI (linear regression, 3 years ahead): results
  table 2025: 241.2, 2026: 253.5, 2027: 265.7; banner shown on the
  results too — PASS (see `figures/fig-4-2-forecast-results.png`).
- Chart: blue history line 2015–2024 + dashed orange forecast line
  2025–2027, axis labels and legend — PASS
  (see `figures/fig-4-3-forecast-chart.png`).
- Accuracy "Compare all methods" button: 3-row table — moving average
  MAPE 19.01 / MAE 42.2, linear regression MAPE 5.46 / MAE 12.2
  ("Best (lowest MAPE)"), exponential smoothing MAPE 25.01 / MAE 55.43
  — PASS (matches the API results in tests 19–21).
- CSV upload in the browser (FileReader + DataTransfer test file
  `year,female_enrolment` with 2025: 250, 2026: 262): message
  "Imported 2 row(s) from test-upload.csv.", table grew to 12 rows — PASS.
- Add / edit / delete in the UI: added 2025: 250 ("Added 2025: 250."),
  edited to 255 ("Updated 2025 to 255.", value confirmed 255), deleted
  ("Deleted 2025.", back to 10 rows) — PASS.
- Exponential smoothing in the UI: choosing the method reveals the alpha
  input; forecast 2025: 202.8, 2026: 202.8 — PASS (matches test 15).
- Clear data: `DELETE /api/data` verified via API (test 28); the button
  calls the same endpoint.

## Bugs found and fixed during testing
1. **Alpha step validation blocked every forecast submit.** The alpha
   input had `min="0.01" step="0.05"`, and 0.3 is not a valid step value
   from base 0.01, so HTML5 constraint validation silently blocked the
   forecast form's submit (no submit event, no error shown). Fixed by
   changing both alpha inputs to `step="any"` (server still validates
   0 < alpha ≤ 1). Re-tested: forecast submit works.
2. **CSS `label { display: flex }` overrode the `hidden` attribute**,
   so the alpha field showed even for non-smoothing methods. Fixed with
   a global `[hidden] { display: none !important; }` rule. Re-tested:
   alpha field hidden for linear regression, shown for smoothing.
3. **Edit → Save wiped the value to 0.** The Edit button kept its
   original click listener after becoming "Save", so the second click
   re-ran `startEdit` (clearing the input) before the save handler read
   it. Fixed with a guard in `startEdit` that returns early when the row
   is already being edited. Re-tested: edit 2025 → 255 saved correctly.

## Persistence
After the tests, `data.json` holds the 10-row sample dataset with
`sampleLoaded: true` (re-loaded after the clear-all test so the system
ships in the same state as the screenshots). The server re-reads it
correctly on restart.

## Screenshots
- `figures/fig-4-1-data-entry.png` — data entry, sample dataset, banner.
- `figures/fig-4-2-forecast-results.png` — linear-regression forecast table.
- `figures/fig-4-3-forecast-chart.png` — history + forecast chart.
Captured with `screenshots/capture.mjs` (CDP via the stock Chrome Headless
Shell — `/opt/meta-chromium` blocks all localhost navigation). Each PNG was
read and visually verified. Server stopped afterwards; no process left running.
