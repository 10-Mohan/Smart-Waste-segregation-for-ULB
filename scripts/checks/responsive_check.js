// Run: node scripts/checks/responsive_check.js  (requires: npm run dev or start:prod running on CHECK_URL)
// Purpose: Tests horizontal overflow at 360/375/412/768/1280px viewports across all pages.
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_URL = process.env.CHECK_URL || 'http://localhost:5173';
const VIEWPORTS = [360, 375, 412, 768, 1280];

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

let failed = 0;

async function checkOverflow(page, label, width) {
  const result = await page.evaluate(() => {
    const sw = document.documentElement.scrollWidth;
    const cw = document.documentElement.clientWidth;
    return { hasHScroll: sw > cw, scrollWidth: sw, clientWidth: cw };
  });
  if (result.hasHScroll) {
    console.log(`  [FAIL] ${label} (${width}px): Horizontal scroll! (${result.scrollWidth}px > ${result.clientWidth}px)`);
    failed++;
  } else {
    console.log(`  [PASS] ${label} (${width}px)`);
  }
}

async function main() {
  const browser = await puppeteer.launch({ executablePath: CHROME_PATH, headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  for (const width of VIEWPORTS) {
    console.log(`\n=== ${width}px ===`);
    await page.setViewport({ width, height: 800 });

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await checkOverflow(page, 'Home', width);

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await checkOverflow(page, 'Login', width);

    await page.goto(`${BASE_URL}/citizen`, { waitUntil: 'networkidle0' });
    await checkOverflow(page, 'Citizen Landing', width);

    // Citizen dashboard
    await page.type('#citizen-code', 'HH-W01-001');
    await page.type('#citizen-last4', '1001');
    await page.evaluate(() => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Check status'))?.click());
    await page.waitForSelector('.citizen-dashboard', { timeout: 10000 });
    await sleep(400);
    await checkOverflow(page, 'Citizen Dashboard', width);

    // Worker
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.type('#login-email', 'worker@demo.in');
    await page.type('#login-password', 'Demo@1234');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.worker-page', { timeout: 10000 });
    await sleep(400);
    await checkOverflow(page, 'Worker Scan', width);
    await page.click('#worker-tab-today'); await sleep(300);
    await checkOverflow(page, 'Worker Today', width);
    await page.click('#worker-tab-queue'); await sleep(300);
    await checkOverflow(page, 'Worker Queue', width);
    await page.click('#worker-tab-households'); await sleep(300);
    await checkOverflow(page, 'Worker Households', width);

    await page.goto(`${BASE_URL}/worker/labels`, { waitUntil: 'networkidle0' });
    await sleep(400);
    await checkOverflow(page, 'Worker Labels', width);
  }

  await browser.close();
  console.log(`\nResponsive sweep done. Failures: ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
