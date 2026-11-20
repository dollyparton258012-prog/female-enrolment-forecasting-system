// Screenshots for the Female Enrolment Forecasting System (Fig 4.1–4.3)
// via headless Chrome CDP (Node 24 global WebSocket).
// Adapted from the DLC platform's capture.mjs.
//
// REQUIREMENT: the server must be running first:
//   cd software/forecasting-system && node server.js   (port 3000)
// The sample dataset must be loaded (POST /api/data/sample) — this script
// loads it itself via the API before capturing, so the run is repeatable.
//
// Uses ONLY the stock Chrome Headless Shell — /opt/meta-chromium blocks ALL
// localhost navigation (ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS).
import { execFile } from 'node:child_process';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT = '/home/hatch/workspace/female-enrolment-forecasting-project/figures';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Load the sample dataset so every shot shows real data.
const sample = await fetch(`${BASE}/api/data/sample`, { method: 'POST' });
if (!sample.ok) { console.error('SAMPLE LOAD FAILED'); process.exit(1); }
console.log('sample loaded:', (await sample.json()).rows.length, 'rows');

const chrome = execFile('/home/hatch/workspace/tools/chrome-headless-shell/chrome-headless-shell-linux64/chrome-headless-shell', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--remote-debugging-port=9223', '--user-data-dir=/tmp/forecast-chrome-profile',
  '--window-size=1280,800', `${BASE}/`,
], () => {});

let target = null;
for (let i = 0; i < 30; i++) {
  await sleep(500);
  try {
    const res = await fetch('http://127.0.0.1:9223/json/list');
    const list = await res.json();
    target = list.find((t) => t.type === 'page');
    if (target) break;
  } catch { /* retry */ }
}
if (!target) { console.error('NO TARGET'); chrome.kill(); process.exit(1); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => new Promise((res) => {
  const mid = ++id; pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) console.error('EVAL ERR', JSON.stringify(r.result.exceptionDetails).slice(0, 500));
  return r.result?.result?.value;
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${OUT}/${name}`, Buffer.from(r.result.data, 'base64'));
  console.log('saved', name);
};
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await sleep(2500);

// 1. Data entry screen: sample dataset + ILLUSTRATIVE banner
console.log('banner visible:', await evalJs(`!document.querySelector('#sampleBanner').hidden`));
console.log('data rows:', await evalJs(`document.querySelectorAll('#dataBody tr').length`));
await shot('fig-4-1-data-entry.png');

// 2. Run a linear-regression forecast, 3 years ahead, via the real UI
await evalJs(`
  document.querySelector('#methodSelect').value = 'linear-regression';
  document.querySelector('#yearsAheadInput').value = '3';
  document.querySelector('#forecastForm button[type="submit"]').click();
`);
await sleep(1500);
console.log('forecast rows:', await evalJs(`document.querySelectorAll('#forecastBody tr').length`));
console.log('forecast values:', await evalJs(`[...document.querySelectorAll('#forecastBody td')].map(td => td.textContent).join(',')`));
console.log('forecast banner visible:', await evalJs(`!document.querySelector('#forecastBanner').hidden`));
await evalJs(`document.querySelector('#forecastSection').scrollIntoView();`);
await sleep(800);
await shot('fig-4-2-forecast-results.png');

// 3. Chart view: history + forecast lines
await evalJs(`document.querySelector('#chartSection').scrollIntoView();`);
await sleep(800);
console.log('chart text:', await evalJs(`document.querySelector('#chartMsg').textContent`));
await shot('fig-4-3-forecast-chart.png');

ws.close();
chrome.kill();
console.log('DONE');
process.exit(0);
