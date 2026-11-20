# Forecasting System for Female Enrolment in Computer Science in Nigeria

University of Ibadan — Department of Computer Science (final-year project).

A web application for entering yearly female Computer Science enrolment
figures, forecasting future enrolment with three statistical methods, and
comparing the methods by backtest accuracy. It runs entirely offline once
installed: no external libraries or CDNs — the chart is drawn with plain
canvas.

## Sample-data note (please read)

The built-in sample dataset is **ILLUSTRATIVE ONLY — it is NOT real NUC
(National Universities Commission) enrolment data**. The figures were made up
for demonstrating and testing the system:

2015: 120, 2016: 135, 2017: 142, 2018: 158, 2019: 171, 2020: 165,
2021: 189, 2022: 204, 2023: 218, 2024: 236.

Whenever the sample dataset is loaded, the app shows a visible banner —
"ILLUSTRATIVE SAMPLE DATA — not real NUC figures" — on the data page and on
forecast results. Replace it with real, sourced figures (manual entry or CSV
upload) before using any forecast in the project write-up.

## How to run

```bash
cd software/forecasting-system
npm install
node server.js
```

Then open <http://localhost:3000> in a browser.

- Port: **3000** by default (`PORT` environment variable overrides it).
- Only dependencies: `express` and `cors`.
- Data is stored in `data.json` (created on first run; JSON file storage,
  no database needed).

## Features

1. **Data entry** — add a row (year + female enrolment), edit a row
   in place, delete a row. The table is always sorted by year.
2. **CSV upload** — a file with columns `year,female_enrolment` is parsed
   in the browser (FileReader, no upload middleware) and sent to the API;
   existing years are overwritten and new years added.
3. **Load sample dataset / Clear data** buttons.
4. **Forecasting** — three methods:
   - 3-year moving average (rolling: each new forecast joins the window);
   - linear regression (least-squares trend line);
   - simple exponential smoothing (alpha input, default 0.3).
   Choose 1–5 years ahead. Results appear as a table and as a line chart
   (history in blue, forecast in dashed orange) drawn with plain canvas.
5. **Accuracy (backtest)** — each method is trained on all but the last
   3 years and tested against those 3 years. MAPE (mean absolute percentage
   error) and MAE (mean absolute error) are shown for all three methods
   side by side, with the best (lowest MAPE) highlighted.

## API

| Method | Endpoint | Body / notes |
|---|---|---|
| GET | `/api/health` | `{ status, rows, sampleLoaded }` |
| GET | `/api/data` | `{ rows, sampleLoaded }` — rows sorted by year |
| POST | `/api/data` | `{ year, femaleEnrolment }` — 201; 400 if the year already exists |
| PUT | `/api/data/:year` | `{ femaleEnrolment }` — 404 if the year is not found |
| DELETE | `/api/data/:year` | Deletes one row; 404 if not found |
| DELETE | `/api/data` | Clears all rows |
| POST | `/api/data/sample` | Loads the illustrative sample dataset |
| POST | `/api/data/import` | `{ rows: [{ year, femaleEnrolment }], mode: "merge" \| "replace" }` — CSV upload target |
| POST | `/api/forecast` | `{ method, yearsAhead, alpha? }` → `{ method, yearsAhead, alpha, results: [{ year, forecast }], sampleLoaded }` |
| POST | `/api/accuracy` | `{ method, alpha? }` → `{ method, alpha, trainYears, testYears, mape, mae, detail, sampleLoaded }` |

Methods: `moving-average`, `linear-regression`, `exponential-smoothing`.

Validation (all return a clear 400 error message): year must be a 4-digit
number; enrolment must be a non-negative number; alpha must be between 0
and 1; years ahead must be a whole number from 1 to 5. Forecasting needs at
least 3 rows (moving average), 2 rows (linear regression) or 1 row
(exponential smoothing); backtesting needs at least 3 more rows than that
(the last 3 years are held out as the test set).

## Project layout

```
forecasting-system/
├── package.json          # express + cors only
├── server.js             # Express API + forecasting engine
├── data.json             # JSON file storage (created on first run)
├── public/
│   ├── index.html        # single-page frontend
│   ├── styles.css
│   └── app.js            # vanilla JS; CSV parsing + canvas chart
├── screenshots/
│   └── capture.mjs       # CDP screenshot script (stock Chrome Headless Shell)
├── README.md
└── TEST-LOG.md           # full test evidence (20 Nov 2026)
```

## Screenshots

Figures for the write-up (Chapter 4) live in `../../figures/`:

- `fig-4-1-data-entry.png` — data entry screen, sample dataset loaded,
  ILLUSTRATIVE SAMPLE DATA banner visible.
- `fig-4-2-forecast-results.png` — linear-regression forecast, 3 years
  ahead (2025: 241.2, 2026: 253.5, 2027: 265.7).
- `fig-4-3-forecast-chart.png` — chart with history and forecast lines.

Re-capture: start the server, then run `node screenshots/capture.mjs`
(it loads the sample dataset itself first). It uses the stock Chrome
Headless Shell at `~/workspace/tools/chrome-headless-shell/` — the Hatch
`/opt/meta-chromium` build blocks all localhost navigation and cannot be
used for this.
