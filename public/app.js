// Forecasting System for Female Enrolment in Computer Science in Nigeria.
// Vanilla JS single-page frontend. No external libraries — works offline.
//
// NOTE: the built-in sample dataset is ILLUSTRATIVE ONLY, not real NUC data.
// The banner is shown whenever the sample dataset is loaded.

const METHOD_LABELS = {
  'moving-average': '3-year moving average',
  'linear-regression': 'Linear regression (trend line)',
  'exponential-smoothing': 'Simple exponential smoothing',
};

let state = { rows: [], sampleLoaded: false };
let lastForecast = null; // { method, results } — kept so the chart can redraw

const $ = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

function showBanner() {
  $('sampleBanner').hidden = !state.sampleLoaded;
  $('forecastBanner').hidden = !state.sampleLoaded || !$('forecastResults') || $('forecastResults').hidden;
}

// ---------- data table ----------

function renderTable() {
  const body = $('dataBody');
  body.innerHTML = '';
  $('emptyMsg').hidden = state.rows.length > 0;
  for (const row of state.rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.year}</td>
      <td class="enrol-cell">${row.femaleEnrolment}</td>
      <td>
        <button type="button" class="small edit-btn" data-year="${row.year}">Edit</button>
        <button type="button" class="small danger delete-btn" data-year="${row.year}">Delete</button>
      </td>`;
    body.appendChild(tr);
  }
  body.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => startEdit(Number(btn.dataset.year), btn));
  });
  body.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteRow(Number(btn.dataset.year)));
  });
}

function startEdit(year, btn) {
  const tr = btn.closest('tr');
  // Guard: the Edit button keeps its original click listener after it
  // becomes "Save", so a second click would re-enter startEdit and wipe
  // the input. If the row is already being edited, do nothing here — the
  // Save handler (btn.onclick, attached below) does the work.
  if (tr.querySelector('.edit-input')) return;
  const cell = tr.querySelector('.enrol-cell');
  const current = cell.textContent.trim();
  cell.innerHTML = `<input type="number" class="edit-input" value="${current}" min="0" step="any">`;
  btn.textContent = 'Save';
  btn.onclick = async () => {
    const value = Number(cell.querySelector('input').value);
    try {
      state = await api(`/api/data/${year}`, {
        method: 'PUT',
        body: JSON.stringify({ femaleEnrolment: value }),
      });
      setMsg('formMsg', `Updated ${year} to ${value}.`, 'ok');
      renderTable();
      showBanner();
      drawChart();
    } catch (e) {
      setMsg('formMsg', e.message, 'error');
      renderTable();
    }
  };
}

async function deleteRow(year) {
  if (!confirm(`Delete the row for ${year}?`)) return;
  try {
    state = await api(`/api/data/${year}`, { method: 'DELETE' });
    setMsg('formMsg', `Deleted ${year}.`, 'ok');
    lastForecast = null;
    renderTable();
    showBanner();
    drawChart();
  } catch (e) {
    setMsg('formMsg', e.message, 'error');
  }
}

function setMsg(id, text, kind) {
  const el = $(id);
  el.textContent = text;
  el.className = 'msg' + (kind ? ' ' + kind : '');
}

async function refresh() {
  state = await api('/api/data');
  renderTable();
  showBanner();
  drawChart();
}

// ---------- add / sample / clear / CSV ----------

$('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const year = Number($('yearInput').value);
  const femaleEnrolment = Number($('enrolInput').value);
  try {
    state = await api('/api/data', {
      method: 'POST',
      body: JSON.stringify({ year, femaleEnrolment }),
    });
    setMsg('formMsg', `Added ${year}: ${femaleEnrolment}.`, 'ok');
    $('yearInput').value = '';
    $('enrolInput').value = '';
    renderTable();
    showBanner();
    drawChart();
  } catch (err) {
    setMsg('formMsg', err.message, 'error');
  }
});

$('sampleBtn').addEventListener('click', async () => {
  try {
    state = await api('/api/data/sample', { method: 'POST' });
    setMsg('csvMsg', `Sample dataset loaded (${state.rows.length} rows, 2015–2024).`, 'ok');
    lastForecast = null;
    renderTable();
    showBanner();
    drawChart();
  } catch (err) {
    setMsg('csvMsg', err.message, 'error');
  }
});

$('clearBtn').addEventListener('click', async () => {
  if (!confirm('Clear all data?')) return;
  try {
    state = await api('/api/data', { method: 'DELETE' });
    lastForecast = null;
    $('forecastResults').hidden = true;
    $('accuracyTable').hidden = true;
    $('accuracyDetail').innerHTML = '';
    setMsg('csvMsg', 'All data cleared.', 'ok');
    renderTable();
    showBanner();
    drawChart();
  } catch (err) {
    setMsg('csvMsg', err.message, 'error');
  }
});

$('csvFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.error) {
    setMsg('csvMsg', rows.error, 'error');
    e.target.value = '';
    return;
  }
  try {
    state = await api('/api/data/import', {
      method: 'POST',
      body: JSON.stringify({ rows: rows.data, mode: 'merge' }),
    });
    setMsg('csvMsg', `Imported ${rows.data.length} row(s) from ${file.name}.`, 'ok');
    lastForecast = null;
    renderTable();
    showBanner();
    drawChart();
  } catch (err) {
    setMsg('csvMsg', err.message, 'error');
  }
  e.target.value = '';
});

// Parse CSV text in the browser: header must be year,female_enrolment.
function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) return { error: 'CSV file is empty or has no data rows.' };
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  if (header[0] !== 'year' || header[1] !== 'female_enrolment') {
    return { error: 'CSV header must be: year,female_enrolment' };
  }
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const year = Number(parts[0]);
    const femaleEnrolment = Number(parts[1]);
    if (!Number.isInteger(year) || year < 1000 || year > 9999) {
      return { error: `Row ${i + 1}: invalid year "${parts[0]}".` };
    }
    if (!Number.isFinite(femaleEnrolment) || femaleEnrolment < 0) {
      return { error: `Row ${i + 1}: invalid enrolment "${parts[1]}".` };
    }
    data.push({ year, femaleEnrolment });
  }
  return { data };
}

// ---------- forecast ----------

$('methodSelect').addEventListener('change', () => {
  $('alphaLabel').hidden = $('methodSelect').value !== 'exponential-smoothing';
});

$('forecastForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const method = $('methodSelect').value;
  const yearsAhead = Number($('yearsAheadInput').value);
  const alpha = Number($('alphaInput').value);
  const body = { method, yearsAhead };
  if (method === 'exponential-smoothing') body.alpha = alpha;
  try {
    const res = await api('/api/forecast', { method: 'POST', body: JSON.stringify(body) });
    lastForecast = { method, results: res.results };
    $('forecastTitle').textContent =
      `Forecast results — ${METHOD_LABELS[method]}${method === 'exponential-smoothing' ? ` (alpha = ${res.alpha})` : ''}`;
    const fb = $('forecastBody');
    fb.innerHTML = '';
    for (const r of res.results) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.year}</td><td>${r.forecast}</td>`;
      fb.appendChild(tr);
    }
    $('forecastResults').hidden = false;
    $('forecastBanner').hidden = !res.sampleLoaded;
    setMsg('forecastMsg', '', '');
    drawChart();
  } catch (err) {
    setMsg('forecastMsg', err.message, 'error');
  }
});

// ---------- accuracy ----------

$('accuracyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const alpha = Number($('accuracyAlpha').value);
  const methods = ['moving-average', 'linear-regression', 'exponential-smoothing'];
  const results = [];
  for (const method of methods) {
    try {
      const res = await api('/api/accuracy', {
        method: 'POST',
        body: JSON.stringify({ method, alpha }),
      });
      results.push(res);
    } catch (err) {
      results.push({ method, error: err.message });
    }
  }
  const ok = results.filter((r) => !r.error);
  if (ok.length === 0) {
    setMsg('accuracyMsg', results[0].error, 'error');
    return;
  }
  setMsg('accuracyMsg', '', '');
  const best = ok.reduce((a, b) => (b.mape < a.mape ? b : a));
  const ab = $('accuracyBody');
  ab.innerHTML = '';
  for (const r of results) {
    const tr = document.createElement('tr');
    if (r.error) {
      tr.innerHTML = `<td>${METHOD_LABELS[r.method]}</td><td colspan="3">${r.error}</td>`;
    } else {
      tr.innerHTML = `<td>${METHOD_LABELS[r.method]}</td><td>${r.mape}</td><td>${r.mae}</td><td>${r === best ? 'Best (lowest MAPE)' : ''}</td>`;
    }
    ab.appendChild(tr);
  }
  $('accuracyTable').hidden = false;

  const detail = $('accuracyDetail');
  detail.innerHTML = '';
  for (const r of ok) {
    const h = document.createElement('h3');
    h.textContent = `${METHOD_LABELS[r.method]} — tested on ${r.testYears[0]}–${r.testYears[1]}`;
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>Year</th><th>Actual</th><th>Forecast</th></tr></thead><tbody>` +
      r.detail.map((d) => `<tr><td>${d.year}</td><td>${d.actual}</td><td>${d.forecast}</td></tr>`).join('') +
      `</tbody>`;
    detail.appendChild(h);
    detail.appendChild(table);
  }
});

// ---------- chart (plain canvas, no libraries) ----------

function drawChart() {
  const canvas = $('chart');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const history = state.rows;
  const forecast = lastForecast ? lastForecast.results : [];
  if (history.length === 0) {
    $('chartMsg').textContent = 'No data yet. Load the sample dataset or add rows above.';
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText('No data to chart yet.', 20, 30);
    return;
  }
  $('chartMsg').textContent = forecast.length
    ? `History (${history[0].year}–${history[history.length - 1].year}) and forecast (${forecast[0].year}–${forecast[forecast.length - 1].year}) — ${METHOD_LABELS[lastForecast.method]}.`
    : `History only (${history[0].year}–${history[history.length - 1].year}). Run a forecast to add the forecast line.`;

  const padL = 60, padR = 20, padT = 20, padB = 40;
  const allYears = [...history.map((r) => r.year), ...forecast.map((r) => r.year)];
  const allVals = [...history.map((r) => r.femaleEnrolment), ...forecast.map((r) => r.forecast)];
  const minY = Math.floor(Math.min(...allVals) * 0.9);
  const maxY = Math.ceil(Math.max(...allVals) * 1.05);
  const minX = Math.min(...allYears);
  const maxX = Math.max(...allYears);
  const x = (yr) => padL + ((yr - minX) / Math.max(1, maxX - minX)) * (W - padL - padR);
  const y = (v) => H - padB - ((v - minY) / (maxY - minY)) * (H - padT - padB);

  // Gridlines + y labels
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#333';
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const v = minY + ((maxY - minY) * i) / steps;
    ctx.beginPath();
    ctx.moveTo(padL, y(v));
    ctx.lineTo(W - padR, y(v));
    ctx.stroke();
    ctx.fillText(String(Math.round(v)), 8, y(v) + 4);
  }
  // Axes
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, H - padB);
  ctx.lineTo(W - padR, H - padB);
  ctx.stroke();
  // X labels
  for (const yr of allYears) {
    ctx.fillText(String(yr), x(yr) - 14, H - padB + 18);
  }
  ctx.fillText('Year', W - padR - 30, H - 6);
  ctx.save();
  ctx.translate(14, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Female enrolment', -50, 0);
  ctx.restore();

  // History line (solid blue)
  ctx.strokeStyle = '#1a73e8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  history.forEach((r, i) => (i === 0 ? ctx.moveTo(x(r.year), y(r.femaleEnrolment)) : ctx.lineTo(x(r.year), y(r.femaleEnrolment))));
  ctx.stroke();
  ctx.fillStyle = '#1a73e8';
  for (const r of history) {
    ctx.beginPath();
    ctx.arc(x(r.year), y(r.femaleEnrolment), 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Forecast line (dashed orange), starting from the last history point
  if (forecast.length) {
    ctx.strokeStyle = '#e8710a';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    const last = history[history.length - 1];
    ctx.moveTo(x(last.year), y(last.femaleEnrolment));
    for (const r of forecast) ctx.lineTo(x(r.year), y(r.forecast));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e8710a';
    for (const r of forecast) {
      ctx.beginPath();
      ctx.arc(x(r.year), y(r.forecast), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

refresh().catch((err) => setMsg('formMsg', 'Could not reach the server: ' + err.message, 'error'));
