import { chromium } from 'playwright';
import fs from 'fs';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const tokenPath = '/tmp/spx_token.json';
  const raw = fs.readFileSync(tokenPath, 'utf8');
  const token = JSON.parse(raw);

  const storedToken = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const logs = [];
  const errors = [];

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    if (msg.type() === 'error') errors.push(text);
  });

  page.on('pageerror', err => {
    errors.push(`[pageerror] ${err.message}`);
  });

  const results = [];
  const check = (name, condition) => {
    results.push({ name, ok: condition });
    console.log(`${condition ? '✅' : '❌'} ${name}`);
  };

  try {
    console.log('Loading SPX...');
    await page.goto('http://127.0.0.1:1422', { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate((t) => localStorage.setItem('spx_spotify_token', JSON.stringify(t)), storedToken);
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await sleep(4000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    check('Authenticated UI rendered', !bodyText.includes('Connect with Spotify'));
    check('Now Playing tab visible', await page.locator('text="Now Playing"').first().isVisible().catch(() => false));

    // Search
    console.log('\n--- Search ---');
    await page.locator('text="Search"').first().click();
    await sleep(1000);
    const searchInput = page.locator('input[placeholder*="want to listen" i], input[type="search"]').first();
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('Daft Punk');
      await page.keyboard.press('Enter');
      await sleep(3000);
      const searchText = await page.evaluate(() => document.body.innerText);
      check('Search results loaded', searchText.includes('Daft Punk') || searchText.includes('Artists') || searchText.includes('Tracks') || searchText.includes('Albums'));
    } else {
      check('Search input visible', false);
    }

    // Library
    console.log('\n--- Library ---');
    await page.locator('text="Library"').first().click();
    await sleep(2000);
    const libText = await page.evaluate(() => document.body.innerText);
    check('Library shows content', libText.includes('Playlists') || libText.includes('Artists') || libText.includes('Albums') || libText.includes('Liked Songs'));

    // Queue
    console.log('\n--- Queue ---');
    await page.locator('text="Queue"').first().click();
    await sleep(1500);
    const queueText = await page.evaluate(() => document.body.innerText);
    check('Queue page loaded', queueText.includes('Queue') || queueText.includes('Now playing') || queueText.includes('Next up'));

    // Back to Now Playing and test controls (won't play because no device)
    console.log('\n--- Playback Controls ---');
    await page.locator('text="Now Playing"').first().click();
    await sleep(1000);

    const playBtn = page.locator('button[title*="Play" i], button[aria-label*="Play" i], button:has-text("▶")').first();
    const prevBtn = page.locator('button[title*="Previous" i], button[aria-label*="Previous" i]').first();
    const nextBtn = page.locator('button[title*="Next" i], button[aria-label*="Next" i]').first();

    check('Play/pause button exists', await playBtn.isVisible().catch(() => false));
    check('Previous button exists', await prevBtn.isVisible().catch(() => false));
    check('Next button exists', await nextBtn.isVisible().catch(() => false));

    // Click play - should not blast because no active device; will likely show error toast
    if (await playBtn.isVisible().catch(() => false)) {
      await playBtn.click();
      await sleep(2000);
      const afterClickText = await page.evaluate(() => document.body.innerText);
      check('Play click handled gracefully', !afterClickText.includes('Unhandled') && !errors.some(e => e.includes('Unhandled')));
    }

    // Device selector
    console.log('\n--- Device Selector ---');
    const deviceBtn = page.locator('button[title*="Device" i], button[aria-label*="Device" i]').first();
    check('Device selector button exists', await deviceBtn.isVisible().catch(() => false));
    if (await deviceBtn.isVisible().catch(() => false)) {
      await deviceBtn.click();
      await sleep(1500);
      const deviceText = await page.evaluate(() => document.body.innerText);
      check('Device menu opened', deviceText.includes('Connect to a device') || deviceText.includes('No devices found'));
      // Close by pressing Escape
      await page.keyboard.press('Escape');
      await sleep(500);
    }

    // Screenshot final state
    await page.screenshot({ path: 'spx-features.png', fullPage: true });
    console.log('\nScreenshot saved: spx-features.png');

    // Summary
    const passed = results.filter(r => r.ok).length;
    console.log(`\n=== RESULTS: ${passed}/${results.length} passed ===`);
    if (errors.length) {
      console.log('\nConsole errors:');
      errors.slice(0, 10).forEach(e => console.log(e));
    }
    if (passed < results.length) process.exitCode = 1;
  } catch (e) {
    console.error('Test failed:', e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
