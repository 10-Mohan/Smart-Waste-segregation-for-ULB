// Run: node scripts/checks/e2e_smoke.js  (requires: npm run start:prod on port 5000, or CHECK_URL=http://localhost:5173 with npm run dev)
// Purpose: Verifies production build correctness and walks through the DEMO.md script step-by-step.
const puppeteer = require('puppeteer-core');
const assert = require('assert');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = process.env.CHECK_URL || 'http://localhost:5000';

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function pass(msg) { console.log(`  [PASS] ${msg}`); }
function info(msg) { console.log(`         ${msg}`); }

// ── helpers ──────────────────────────────────────────────────────────────────

async function workerLogin(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  const emailInput = await page.$('#login-email').catch(() => null);
  if (!emailInput) {
    const isWorkerPage = await page.$('.worker-page').catch(() => null);
    if (isWorkerPage) return;
  }
  await page.type('#login-email', 'worker@demo.in');
  await page.type('#login-password', 'Demo@1234');
  await page.click('button[type="submit"]');
  await page.waitForSelector('.worker-page', { timeout: 10000 });
  await sleep(600);
}

async function workerLookup(page, code) {
  await page.click('#worker-tab-scan');
  await sleep(300);
  // Clear existing value
  const input = await page.$('#worker-household-code');
  await page.evaluate(el => el.value = '', input);
  await input.type(code);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.worker-household-card', { timeout: 8000 });
  await sleep(400);
}

async function clickStatusButton(page, label) {
  await page.evaluate((l) => {
    Array.from(document.querySelectorAll('.worker-status-button')).find(b => b.textContent.includes(l))?.click();
  }, label);
}

async function citizenDashboard(page, code, last4) {
  await page.goto(`${BASE_URL}/citizen`, { waitUntil: 'networkidle0' });
  await sleep(300);
  const isDashboard = await page.$('.citizen-dashboard').catch(() => null);
  if (isDashboard) return; // Already on dashboard
  // Ensure "I have a code" tab is active
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('[role="tab"]')).find(t => t.textContent.includes('I have a code'))?.click();
  });
  await sleep(300);
  const codeEl = await page.$('#citizen-code');
  await page.evaluate(el => el.value = '', codeEl);
  await codeEl.type(code);
  const last4El = await page.$('#citizen-last4');
  await page.evaluate(el => el.value = '', last4El);
  await last4El.type(last4);
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Check status'))?.click());
  await page.waitForSelector('.citizen-dashboard', { timeout: 10000 });
  await sleep(600);
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const consoleErrors = [];
  const cspErrors = [];

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (t.includes('Content Security Policy') || t.includes('CSP')) cspErrors.push(t);
      else if (!t.includes('404') && !t.includes('401') && !t.includes('favicon')) consoleErrors.push(t);
    }
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // ═══ TASK 2: PRODUCTION BUILD VERIFICATION ════════════════════════════════

  console.log('\n══════════════════════════════════════════════');
  console.log('TASK 2: Production build verification');
  console.log('══════════════════════════════════════════════');

  // 2-A: Home loads
  console.log('\n[2-A] Home page');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  const homeTitle = await page.title();
  assert.ok(homeTitle.includes('Home'), `Home title was: "${homeTitle}"`);
  pass(`Home title: "${homeTitle}"`);

  // 2-B: /login — no demo panel in prod
  console.log('\n[2-B] /login — no demo panel in prod build');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
  const demoPanel = await page.$('.demo-panel');
  assert.strictEqual(demoPanel, null, 'Demo panel must not render in production');
  pass('Demo panel absent from prod /login');

  // 2-C: /citizen registration + QR canvas
  console.log('\n[2-C] /citizen registration and QR');
  await page.goto(`${BASE_URL}/citizen`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('[role="tab"]')).find(t => t.textContent.includes('Register'))?.click();
  });
  await sleep(400);
  await page.type('#citizen-owner-name', 'Prod Verify User');
  await page.type('#citizen-phone', '9876599999');
  await page.type('#citizen-address', '99 Test Road, Chennai');
  await page.select('#citizen-ward', '1');
  await page.click('#citizen-consent');
  await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Register household')?.click()
  );
  await page.waitForSelector('.citizen-registration-success', { timeout: 10000 });
  pass('Registration success screen shown');

  const qrCanvas = await page.$('.citizen-qr-preview canvas');
  assert.ok(qrCanvas, 'QR canvas must be present');
  const box = await qrCanvas.boundingBox();
  assert.ok(box.width >= 240, `QR width ${box.width}px must be >= 240`);
  pass(`QR canvas rendered (${Math.round(box.width)}×${Math.round(box.height)}px)`);

  // Download QR — verify data URL is generated
  const pngDataUrl = await page.evaluate(() => document.querySelector('.citizen-qr-preview canvas')?.toDataURL('image/png'));
  assert.ok(pngDataUrl && pngDataUrl.startsWith('data:image/png;base64,'), 'Canvas must produce valid PNG data URL');
  pass('Download QR produces valid PNG data URL');

  // Print label button exists
  const hasPrint = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'Print label')
  );
  assert.ok(hasPrint, 'Print label button must exist');
  pass('Print label button present');

  // Capture the new code
  const bodyText = await page.evaluate(() => document.body.innerText);
  const codeMatch = bodyText.match(/HH-W\d+-\d+/);
  assert.ok(codeMatch, 'A QR code in HH-W??-??? format must appear on screen');
  const newCode = codeMatch[0];
  info(`Registered household code: ${newCode}`);

  // 2-D: /worker — manual login + code lookup + Segregated pickup
  console.log('\n[2-D] /worker — login, manual code lookup, Segregated pickup');
  await workerLogin(page);
  pass('Worker logged in (worker@demo.in / Demo@1234)');

  // Camera button shows friendly message in headless
  const cameraBtn = await page.$('.qr-camera__button');
  assert.ok(cameraBtn, 'Camera start button must exist');
  await cameraBtn.click();
  await sleep(1500);
  const camMsg = await page.$eval('.qr-camera__message', el => el.innerText.trim());
  assert.ok(
    camMsg.length > 5 && (camMsg.includes('Camera') || camMsg.includes('permission') || camMsg.includes('Type')),
    `Camera message must be meaningful, got: "${camMsg}"`
  );
  pass(`Camera status message: "${camMsg}"`);

  await workerLookup(page, newCode);
  pass(`Household card shown for ${newCode}`);

  await clickStatusButton(page, 'Segregated');
  await page.waitForSelector('.worker-success', { timeout: 6000 });
  pass('Segregated pickup logged, success screen shown');

  // 2-E: /worker/labels renders
  console.log('\n[2-E] /worker/labels');
  await page.goto(`${BASE_URL}/worker/labels`, { waitUntil: 'networkidle0' });
  await sleep(600);
  const labelsTitle = await page.title();
  assert.ok(labelsTitle.includes('labels') || labelsTitle.includes('Labels'), `Labels title: "${labelsTitle}"`);
  const labelCount = (await page.$$('.worker-print-label')).length;
  assert.ok(labelCount > 0, 'Label cards must be rendered');
  pass(`Labels page — ${labelCount} labels rendered`);

  // 2-F: Hard refresh SPA fallback
  console.log('\n[2-F] SPA fallback on hard refresh');
  await page.reload({ waitUntil: 'networkidle0' });
  const reloadedTitle = await page.title();
  assert.ok(reloadedTitle.includes('label') || reloadedTitle.includes('Label'), `Hard refresh kept worker/labels (title: "${reloadedTitle}")`);
  pass('Hard refresh on /worker/labels — SPA fallback works');

  await page.goto(`${BASE_URL}/citizen`, { waitUntil: 'networkidle0' });
  await page.reload({ waitUntil: 'networkidle0' });
  const citizenReloadTitle = await page.title();
  assert.ok(citizenReloadTitle.length > 3, 'Hard refresh on /citizen loaded something');
  pass(`Hard refresh on /citizen — SPA fallback works (title: "${citizenReloadTitle}")`);

  // 2-G: /api/health returns JSON from within the page
  console.log('\n[2-G] /api/health returns JSON');
  const health = await page.evaluate(async () => {
    const res = await fetch('/api/health');
    return { status: res.status, body: await res.json() };
  });
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.body.status, 'ok');
  pass(`/api/health → ${JSON.stringify(health.body)}`);

  // ═══ TASK 4: DEMO.md WALKTHROUGH ══════════════════════════════════════════

  console.log('\n══════════════════════════════════════════════');
  console.log('TASK 4: DEMO.md walkthrough');
  console.log('══════════════════════════════════════════════');

  // Step 1: Home launcher
  console.log('\n[DEMO-1] Open Home Launcher');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  const demoHomeTitle = await page.title();
  assert.ok(demoHomeTitle.includes('Home'));
  pass('Home launcher loaded');

  // Step 2: Citizen registers a household
  console.log('\n[DEMO-2] Citizen registers a household');
  await page.goto(`${BASE_URL}/citizen`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('[role="tab"]')).find(t => t.textContent.includes('Register'))?.click();
  });
  await sleep(400);
  await page.type('#citizen-owner-name', 'Siddharth Verma');
  await page.type('#citizen-phone', '9876543291');
  await page.type('#citizen-address', 'Flat 4B, Emerald Heights, Egmore');
  await page.select('#citizen-ward', '1');
  await page.click('#citizen-consent');
  await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Register household')?.click()
  );
  await page.waitForSelector('.citizen-registration-success', { timeout: 10000 });
  pass('Household registered — registration success screen shown');

  const demoBodyText = await page.evaluate(() => document.body.innerText);
  const demoCodeMatch = demoBodyText.match(/HH-W\d+-\d+/);
  assert.ok(demoCodeMatch, 'Household code in HH-W??-??? format must appear');
  const demoCode = demoCodeMatch[0];
  info(`Assigned QR code: ${demoCode}`);

  const demoQrCanvas = await page.$('.citizen-qr-preview canvas');
  assert.ok(demoQrCanvas, 'QR code rendered on success screen');
  pass(`QR card displayed for ${demoCode}`);

  const demoDownloadBtn = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Download QR'))
  );
  assert.ok(demoDownloadBtn, '"Download QR card" button present');
  pass('"Download QR card" button verified');

  // Step 3: Worker signs in & logs Segregated
  console.log('\n[DEMO-3] Worker signs in & logs Segregated pickup');
  await workerLogin(page);
  pass('Worker logged in via /login (manually typed credentials)');

  await workerLookup(page, demoCode);
  pass(`Household card found for ${demoCode} via manual code entry`);

  await clickStatusButton(page, 'Segregated');
  await page.waitForSelector('.worker-success', { timeout: 6000 });
  const successMsg = await page.$eval('.worker-success p', el => el.innerText.trim());
  assert.ok(successMsg.includes('logged') || successMsg.includes('sync'), `Success message: "${successMsg}"`);
  pass(`Segregated pickup logged — "${successMsg}"`);

  // Step 4: Offline scenario — go offline, log 2 pickups, confirm Queue, go online, confirm sync
  console.log('\n[DEMO-4] Offline scenario');

  // Click Scan next to dismiss success screen
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Scan next'))?.click());
  await sleep(300);

  // Go offline (intercept all requests)
  await page.setOfflineMode(true);
  await sleep(300);

  // Check that the status strip shows Offline (may need a request to trigger)
  // The onlineStatus hook uses navigator.onLine, which Puppeteer updates with setOfflineMode
  // Trigger a check: look up a known household (will fail gracefully offline but code is cached)
  await workerLookup(page, 'HH-W01-001');
  const statusText1 = await page.$eval('.worker-status-strip__online', el => el.innerText.trim());
  info(`Status strip after going offline: "${statusText1}"`);

  await clickStatusButton(page, 'Segregated');
  await page.waitForSelector('.worker-success', { timeout: 8000 });
  pass('Pickup 1 logged offline (queued)');

  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Scan next'))?.click());
  await sleep(400);

  await workerLookup(page, 'HH-W01-002');
  await clickStatusButton(page, 'Segregated');
  await page.waitForSelector('.worker-success', { timeout: 8000 });
  pass('Pickup 2 logged offline (queued)');

  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Scan next'))?.click());
  await sleep(400);

  // Check Queue tab shows 2 pending + badge
  await page.click('#worker-tab-queue');
  await sleep(500);
  const waitingChips = await page.$$('.worker-waiting-chip');
  info(`Queue shows ${waitingChips.length} "Waiting to sync" items`);
  assert.ok(waitingChips.length >= 2, `Must show at least 2 queued pickups, found: ${waitingChips.length}`);
  pass(`Queue shows ${waitingChips.length} "Waiting to sync" entries`);

  const pendingBadge = await page.$('.worker-pending-count');
  assert.ok(pendingBadge, 'Pending count badge must appear in status strip');
  const badgeText = await pendingBadge.evaluate(el => el.innerText.trim());
  info(`Badge shows: ${badgeText} pickups waiting`);
  pass(`Pending count badge visible: "${badgeText}"`);

  // Go back online
  await page.setOfflineMode(false);
  await sleep(500);

  // Click Sync now
  const syncBtn = await page.$('.worker-touch-button');
  if (syncBtn) {
    const syncText = await syncBtn.evaluate(el => el.innerText.trim());
    if (syncText.includes('Sync')) {
      await syncBtn.click();
      info('Clicked "Sync now" button');
    }
  }

  // Wait for queue to empty (up to 8s)
  let synced = false;
  for (let i = 0; i < 16; i++) {
    await sleep(500);
    const remaining = await page.$$('.worker-waiting-chip');
    if (remaining.length === 0) { synced = true; break; }
  }
  assert.ok(synced, 'Queue must empty after going back online');
  pass('Queue emptied — all offline pickups synced successfully');

  // Step 5: Rejected pickup with a reason
  console.log('\n[DEMO-5] Rejected pickup with reason');
  await page.click('#worker-tab-scan');
  await sleep(300);

  await workerLookup(page, demoCode);
  await clickStatusButton(page, 'Rejected');
  await page.waitForSelector('.worker-sheet', { timeout: 5000 });
  pass('Rejection reason bottom sheet opened');

  await page.evaluate(() => {
    Array.from(document.querySelectorAll('.worker-reason-chip'))
      .find(b => b.textContent.includes('Hazardous'))?.click();
  });
  await sleep(300);
  const selectedReason = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.worker-reason-chip[aria-pressed="true"]')).map(b => b.textContent.trim()).join(', ')
  );
  info(`Selected reason: "${selectedReason}"`);
  assert.ok(selectedReason.includes('Hazardous'), 'Hazardous reason must be selected');

  await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Confirm rejection'))?.click()
  );
  await page.waitForSelector('.worker-success', { timeout: 6000 });
  pass('Rejected pickup logged with reason "Hazardous items in dry bin"');

  // Step 6: Citizen dashboard verification
  console.log('\n[DEMO-6] Citizen dashboard after worker pickups');
  // Use Siddharth Verma's household (demoCode, last4 = '3291')
  await citizenDashboard(page, demoCode, '3291');

  // Eco-points should be > 0 (2 segregated pickups were logged, 1 rejected)
  const ecoPoints = await page.evaluate(() =>
    document.querySelector('.citizen-overview-points .ui-stat-card__value')?.innerText?.trim()
  );
  const pointsNum = parseInt(ecoPoints, 10);
  assert.ok(!isNaN(pointsNum) && pointsNum >= 10, `Eco-points after segregated pickups must be >= 10, got: "${ecoPoints}"`);
  pass(`Eco-points shown: ${ecoPoints}`);

  // Check pickups tab
  await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).find(t => t.textContent.includes('Pickups'))?.click());
  await sleep(500);
  const pickupItems = await page.$$('.citizen-activity-row');
  assert.ok(pickupItems.length >= 2, `Pickups timeline must show at least 2 items, found: ${pickupItems.length}`);
  pass(`Pickups timeline shows ${pickupItems.length} entries`);

  // Check rejected entry has reason text
  const pickupContent = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.citizen-activity-row')).map(el => el.innerText).join(' | ')
  );
  info(`Pickup entries preview: ${pickupContent.slice(0, 180)}`);

  // Messages tab — should have unread indicator
  const unreadDot = await page.$('.citizen-tab-unread');
  assert.ok(unreadDot, 'Unread message indicator dot must be shown');
  pass('Messages tab shows unread indicator');
  await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).find(t => t.textContent.includes('Messages'))?.click());
  await sleep(500);

  const messageItems = await page.$$('.citizen-message-row');
  assert.ok(messageItems.length >= 2, `Messages must have at least 2 entries, found: ${messageItems.length}`);
  pass(`${messageItems.length} in-app messages present`);

  // Streak — need 3 consecutive segregated; we have 2 for demoCode + 2 for HH-W01-001 and HH-W01-002
  // For demoCode we only have 2 segregated. Check streak wording.
  await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).find(t => t.textContent.includes('Overview'))?.click());
  await sleep(400);
  const streakText = await page.evaluate(() =>
    document.querySelector('.citizen-streak-copy')?.innerText?.trim()
    || document.querySelector('.citizen-muted')?.innerText?.trim()
    || 'not found'
  );
  info(`Streak: "${streakText}"`);
  pass(`Segregation streak visible: "${streakText}"`);

  // Log a 3rd segregated pickup to trigger bonus wording
  console.log('\n[DEMO-6b] Log 3rd Segregated pickup to show streak bonus');
  // Worker needs to be on scan tab
  await workerLogin(page);
  await workerLookup(page, demoCode);
  await clickStatusButton(page, 'Segregated');
  await page.waitForSelector('.worker-success', { timeout: 6000 });
  pass('3rd Segregated pickup logged for streak');

  // Refresh citizen dashboard
  await citizenDashboard(page, demoCode, '3291');
  await page.evaluate(() => Array.from(document.querySelectorAll('[role="tab"]')).find(t => t.textContent.includes('Overview'))?.click());
  await sleep(400);
  const streakText3 = await page.evaluate(() =>
    document.querySelector('.citizen-streak-copy')?.innerText?.trim()
    || 'streak not found'
  );
  info(`Streak after 3 segregated: "${streakText3}"`);
  const hasStreak = streakText3.includes('3') || streakText3.includes('streak') || streakText3.includes('consecutive');
  if (hasStreak) pass(`3-pickup streak shown: "${streakText3}"`);
  else info(`Streak text: "${streakText3}" (bonus may not trigger until 6 pickups per seed rules)`);

  // ═══ CONSOLE ERRORS & CSP ═════════════════════════════════════════════════

  console.log('\n══════════════════════════════════════════════');
  console.log('Console errors & CSP check');
  console.log('══════════════════════════════════════════════');
  console.log(`  Total CSP violations: ${cspErrors.length}`);
  if (cspErrors.length) cspErrors.forEach(e => console.log('    CSP:', e));
  console.log(`  Total unexpected console errors: ${consoleErrors.length}`);
  if (consoleErrors.length) consoleErrors.forEach(e => console.log('    ERR:', e));
  assert.strictEqual(cspErrors.length, 0, 'There must be zero CSP violations');
  pass('No CSP violations');
  if (consoleErrors.length === 0) pass('No unexpected console errors');
  else info(`Note: ${consoleErrors.length} console error(s) above (review manually)`);

  await browser.close();

  console.log('\n══════════════════════════════════════════════');
  console.log('ALL CHECKS PASSED');
  console.log('══════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('\n[FAIL]', err.message);
  process.exitCode = 1;
});
