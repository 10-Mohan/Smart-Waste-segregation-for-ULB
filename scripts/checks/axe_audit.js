// Run: node scripts/checks/axe_audit.js  (requires: npm run dev, Chrome, axe-core installed in client/)
// Purpose: Audits all pages and sub-views for serious/critical ARIA violations using axe-core.
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const AXE_SOURCE = (() => {
  const candidates = [
    path.join(__dirname, '../../client/node_modules/axe-core/axe.min.js'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
  }
  throw new Error('axe-core not found. Run: npm --prefix client install');
})();
const BASE_URL = process.env.CHECK_URL || 'http://localhost:5000';
const SERVER_DIR = path.resolve(__dirname, '../../server');

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let totalViolations = 0;

async function runAxe(page, label) {
  process.stdout.write(`  Auditing: ${label} ... `);
  await page.evaluate(AXE_SOURCE);
  const results = await page.evaluate(async () => window.axe.run());
  const violations = results.violations.filter(v => ['critical', 'serious'].includes(v.impact));
  if (violations.length > 0) {
    totalViolations += violations.length;
    console.log(`[FAIL] ${violations.length} violation(s):`);
    for (const v of violations) {
      const nodes = v.nodes.map(n => n.target.join(' ')).join(' | ');
      console.log(`    [${v.impact.toUpperCase()}] ${v.id}: ${v.description}\n      Nodes: ${nodes}`);
    }
  } else {
    console.log('[PASS]');
  }
}

async function main() {
  console.log('Resetting DB...');
  execSync('npm run seed -- --reset', { cwd: SERVER_DIR, stdio: 'ignore' });

  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  await runAxe(page, 'Home (/)');

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  await runAxe(page, 'Login (/login)');

  await page.goto(`${BASE_URL}/citizen`, { waitUntil: 'networkidle0' });
  await runAxe(page, 'Citizen Landing - Code Tab');
  await page.evaluate(() => document.querySelectorAll('[role="tab"]')[1]?.click());
  await sleep(400);
  await runAxe(page, 'Citizen Landing - Register Tab');

  await page.evaluate(() => document.querySelectorAll('[role="tab"]')[0]?.click());
  await sleep(300);
  await page.$eval('#citizen-code', el => el.value = '');
  await page.type('#citizen-code', 'HH-W01-001');
  await page.type('#citizen-last4', '1001');
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Check status'))?.click());
  await page.waitForSelector('.citizen-dashboard', { timeout: 8000 });
  await sleep(500);
  await runAxe(page, 'Citizen Dashboard - Overview');
  for (const label of ['Pickups', 'Points', 'Messages']) {
    await page.evaluate((l) => Array.from(document.querySelectorAll('[role="tab"]')).find(t => t.textContent.includes(l))?.click(), label);
    await sleep(400);
    await runAxe(page, `Citizen Dashboard - ${label}`);
  }

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  await page.type('#login-email', 'worker@demo.in');
  await page.type('#login-password', 'Demo@1234');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.worker-page', { timeout: 8000 });
  await sleep(500);

  for (const tabId of ['scan', 'today', 'queue', 'households']) {
    await page.click(`#worker-tab-${tabId}`);
    await sleep(400);
    await runAxe(page, `Worker - ${tabId}`);
  }

  await page.goto(`${BASE_URL}/worker/labels`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.worker-labels', { timeout: 8000 });
  await sleep(1000);
  await runAxe(page, 'Worker Labels (/worker/labels)');

  // ═══ Dashboard as Admin ════════════════════════════════════════════════════
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#login-email', { timeout: 5000 });
  await page.type('#login-email', 'admin@demo.in');
  await page.type('#login-password', 'Demo@1234');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.dashboard-page', { timeout: 10000 });
  await sleep(1500);
  await runAxe(page, 'Dashboard (admin)');

  // ═══ Dashboard as Supervisor ═══════════════════════════════════════════════
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#login-email', { timeout: 5000 });
  await page.type('#login-email', 'supervisor@demo.in');
  await page.type('#login-password', 'Demo@1234');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.dashboard-page', { timeout: 10000 });
  await sleep(1500);
  await runAxe(page, 'Dashboard (supervisor)');

  await browser.close();
  console.log(`\nTotal serious/critical violations: ${totalViolations}`);
  if (totalViolations > 0) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
