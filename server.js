// Forecasting System for Female Enrolment in Computer Science in Nigeria.
// University of Ibadan final-year project.
// Node.js / Express backend, JSON file storage (data.json), vanilla JS frontend.
//
// SAMPLE DATA NOTE: the built-in sample dataset is ILLUSTRATIVE ONLY — it is
// NOT real NUC (National Universities Commission) enrolment data. It exists
// only so the system can be demonstrated and tested. The UI shows a banner
// whenever it is loaded, and the API reports `sampleLoaded: true`.

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// ILLUSTRATIVE SAMPLE DATA — not real NUC figures.
const SAMPLE_DATA = [
  { year: 2015, femaleEnrolment: 120 },
  { year: 2016, femaleEnrolment: 135 },
  { year: 2017, femaleEnrolment: 142 },
  { year: 2018, femaleEnrolment: 158 },
  { year: 2019, femaleEnrolment: 171 },
  { year: 2020, femaleEnrolment: 165 },
  { year: 2021, femaleEnrolment: 189 },
  { year: 2022, femaleEnrolment: 204 },
  { year: 2023, femaleEnrolment: 218 },
  { year: 2024, femaleEnrolment: 236 },
];

const METHODS = ['moving-average', 'linear-regression', 'exponential-smoothing'];

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- storage ----------

function loadState() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.rows)) {
      return { rows: sortRows(parsed.rows), sampleLoaded: !!parsed.sampleLoaded };
    }
  } catch { /* missing or corrupt file: start empty */ }
  return { rows: [], sampleLoaded: false };
}

function saveState(state) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function sortRows(rows) {
  return [...rows].sort((a, b) => a.year - b.year);
}

// ---------- validation ----------

function validYear(year) {
  return Number.isInteger(year) && year >= 1000 && year <= 9999;
}

function validEnrolment(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validAlpha(alpha) {
  return typeof alpha === 'number' && Number.isFinite(alpha) && alpha > 0 && alpha <= 1;
}

function validYearsAhead(n) {
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

// ---------- forecasting ----------

function round1(n) {
  return Math.round(n * 10) / 10;
}

// 3-year moving average. For multi-year forecasts, each new forecast joins
// the window (standard rolling approach).
function forecastMovingAverage(rows, yearsAhead) {
  const values = rows.map((r) => r.femaleEnrolment);
  const lastYear = rows[rows.length - 1].year;
  const window = values.slice(-3);
  const results = [];
  for (let i = 1; i <= yearsAhead; i++) {
    const next = window.reduce((a, b) => a + b, 0) / window.length;
    results.push({ year: lastYear + i, forecast: round1(next) });
    window.push(next);
    window.shift();
  }
  return results;
}

// Least-squares linear regression (trend line) on year vs enrolment.
function forecastLinearRegression(rows, yearsAhead) {
  const n = rows.length;
  const xs = rows.map((r) => r.year);
  const ys = rows.map((r) => r.femaleEnrolment);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) * (xs[i] - meanX);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  const lastYear = rows[n - 1].year;
  const results = [];
  for (let i = 1; i <= yearsAhead; i++) {
    const year = lastYear + i;
    results.push({ year, forecast: round1(slope * year + intercept) });
  }
  return results;
}

// Simple exponential smoothing: S_t = alpha * y_t + (1 - alpha) * S_{t-1},
// starting from S_0 = y_0. The forecast for every future year is the last
// smoothed value (flat forecast).
function forecastExponentialSmoothing(rows, yearsAhead, alpha) {
  let s = rows[0].femaleEnrolment;
  for (let i = 1; i < rows.length; i++) {
    s = alpha * rows[i].femaleEnrolment + (1 - alpha) * s;
  }
  const lastYear = rows[rows.length - 1].year;
  const results = [];
  for (let i = 1; i <= yearsAhead; i++) {
    results.push({ year: lastYear + i, forecast: round1(s) });
  }
  return results;
}

function runForecast(rows, method, yearsAhead, alpha) {
  if (method === 'moving-average') return forecastMovingAverage(rows, yearsAhead);
  if (method === 'linear-regression') return forecastLinearRegression(rows, yearsAhead);
  return forecastExponentialSmoothing(rows, yearsAhead, alpha);
}

// Minimum rows needed to run a forecast with a given method.
function minRowsFor(method) {
  if (method === 'moving-average') return 3;
  if (method === 'linear-regression') return 2;
  return 1; // exponential smoothing
}

// ---------- API ----------

app.get('/api/health', (req, res) => {
  const state = loadState();
  res.json({ status: 'ok', rows: state.rows.length, sampleLoaded: state.sampleLoaded });
});

app.get('/api/data', (req, res) => {
  const state = loadState();
  res.json({ rows: state.rows, sampleLoaded: state.sampleLoaded });
});

app.post('/api/data', (req, res) => {
  const { year, femaleEnrolment } = req.body;
  if (!validYear(year)) {
    return res.status(400).json({ error: 'Year must be a 4-digit number (e.g. 2024).' });
  }
  if (!validEnrolment(femaleEnrolment)) {
    return res.status(400).json({ error: 'Female enrolment must be a non-negative number.' });
  }
  const state = loadState();
  if (state.rows.some((r) => r.year === year)) {
    return res.status(400).json({ error: `A row for year ${year} already exists. Edit it instead.` });
  }
  state.rows = sortRows([...state.rows, { year, femaleEnrolment }]);
  saveState(state);
  res.status(201).json({ rows: state.rows, sampleLoaded: state.sampleLoaded });
});

app.put('/api/data/:year', (req, res) => {
  const year = Number(req.params.year);
  const { femaleEnrolment } = req.body;
  if (!validYear(year)) {
    return res.status(400).json({ error: 'Year must be a 4-digit number (e.g. 2024).' });
  }
  if (!validEnrolment(femaleEnrolment)) {
    return res.status(400).json({ error: 'Female enrolment must be a non-negative number.' });
  }
  const state = loadState();
  const row = state.rows.find((r) => r.year === year);
  if (!row) {
    return res.status(404).json({ error: `No row found for year ${year}.` });
  }
  row.femaleEnrolment = femaleEnrolment;
  saveState(state);
  res.json({ rows: state.rows, sampleLoaded: state.sampleLoaded });
});

app.delete('/api/data/:year', (req, res) => {
  const year = Number(req.params.year);
  if (!validYear(year)) {
    return res.status(400).json({ error: 'Year must be a 4-digit number (e.g. 2024).' });
  }
  const state = loadState();
  const before = state.rows.length;
  state.rows = state.rows.filter((r) => r.year !== year);
  if (state.rows.length === before) {
    return res.status(404).json({ error: `No row found for year ${year}.` });
  }
  if (state.rows.length === 0) state.sampleLoaded = false;
  saveState(state);
  res.json({ deleted: true, rows: state.rows, sampleLoaded: state.sampleLoaded });
});

// Clear all rows (used by the "Clear data" button).
app.delete('/api/data', (req, res) => {
  saveState({ rows: [], sampleLoaded: false });
  res.json({ deleted: true, rows: [], sampleLoaded: false });
});

// Load the illustrative sample dataset (replaces any existing rows).
app.post('/api/data/sample', (req, res) => {
  const state = { rows: [...SAMPLE_DATA], sampleLoaded: true };
  saveState(state);
  res.json({ rows: state.rows, sampleLoaded: true });
});

// Bulk import (used by CSV upload, parsed in the browser).
// Body: { rows: [{ year, femaleEnrolment }, ...], mode: "merge" | "replace" }
// Default mode "merge": existing years are overwritten, new years are added.
// Mode "replace": the whole dataset is replaced by the uploaded rows.
app.post('/api/data/import', (req, res) => {
  const { rows, mode } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'Provide at least one row: { rows: [{ year, femaleEnrolment }] }.' });
  }
  const importMode = mode === 'replace' ? 'replace' : 'merge';
  for (const row of rows) {
    if (!row || !validYear(row.year)) {
      return res.status(400).json({ error: `Invalid year in import: ${row && row.year}. Year must be a 4-digit number.` });
    }
    if (!validEnrolment(row.femaleEnrolment)) {
      return res.status(400).json({ error: `Invalid enrolment for year ${row.year}: must be a non-negative number.` });
    }
  }
  const state = loadState();
  if (importMode === 'replace') {
    state.rows = [];
    state.sampleLoaded = false;
  }
  const byYear = new Map(state.rows.map((r) => [r.year, r.femaleEnrolment]));
  for (const row of rows) byYear.set(row.year, row.femaleEnrolment);
  state.rows = sortRows([...byYear.entries()].map(([year, femaleEnrolment]) => ({ year, femaleEnrolment })));
  saveState(state);
  res.json({ rows: state.rows, sampleLoaded: state.sampleLoaded, imported: rows.length });
});

app.post('/api/forecast', (req, res) => {
  const { method, yearsAhead, alpha } = req.body;
  if (!METHODS.includes(method)) {
    return res.status(400).json({ error: `Method must be one of: ${METHODS.join(', ')}.` });
  }
  if (!validYearsAhead(yearsAhead)) {
    return res.status(400).json({ error: 'Years ahead must be a whole number from 1 to 5.' });
  }
  const a = alpha === undefined ? 0.3 : alpha;
  if (method === 'exponential-smoothing' && !validAlpha(a)) {
    return res.status(400).json({ error: 'Alpha must be a number between 0 and 1.' });
  }
  const state = loadState();
  const min = minRowsFor(method);
  if (state.rows.length < min) {
    return res.status(400).json({ error: `Need at least ${min} year(s) of data for ${method} (have ${state.rows.length}).` });
  }
  const results = runForecast(state.rows, method, yearsAhead, a);
  res.json({ method, yearsAhead, alpha: a, results, sampleLoaded: state.sampleLoaded });
});

// Backtest: train on all but the last 3 years, forecast those 3 years,
// report MAPE (mean absolute percentage error) and MAE (mean absolute error).
app.post('/api/accuracy', (req, res) => {
  const { method, alpha } = req.body;
  if (!METHODS.includes(method)) {
    return res.status(400).json({ error: `Method must be one of: ${METHODS.join(', ')}.` });
  }
  const a = alpha === undefined ? 0.3 : alpha;
  if (method === 'exponential-smoothing' && !validAlpha(a)) {
    return res.status(400).json({ error: 'Alpha must be a number between 0 and 1.' });
  }
  const state = loadState();
  const train = state.rows.slice(0, -3);
  const test = state.rows.slice(-3);
  const min = minRowsFor(method);
  if (state.rows.length < 3 || train.length < min) {
    return res.status(400).json({
      error: `Need at least ${min + 3} year(s) of data to backtest ${method} (train on all but the last 3 years; have ${state.rows.length}).`,
    });
  }
  const forecasts = runForecast(train, method, 3, a);
  const detail = test.map((row, i) => ({
    year: row.year,
    actual: row.femaleEnrolment,
    forecast: forecasts[i].forecast,
  }));
  const absErrors = detail.map((d) => Math.abs(d.actual - d.forecast));
  const mae = absErrors.reduce((x, y) => x + y, 0) / absErrors.length;
  const pctErrors = detail.map((d) => (d.actual === 0 ? 0 : Math.abs(d.actual - d.forecast) / d.actual));
  const mape = (pctErrors.reduce((x, y) => x + y, 0) / pctErrors.length) * 100;
  res.json({
    method,
    alpha: a,
    trainYears: [train[0].year, train[train.length - 1].year],
    testYears: [test[0].year, test[test.length - 1].year],
    mape: Math.round(mape * 100) / 100,
    mae: Math.round(mae * 100) / 100,
    detail,
    sampleLoaded: state.sampleLoaded,
  });
});

app.listen(PORT, () => {
  console.log(`Female Enrolment Forecasting System running on http://localhost:${PORT}`);
});
