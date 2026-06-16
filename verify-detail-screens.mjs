import { chromium } from 'playwright';
import fs from 'fs';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const token = JSON.parse(fs.readFileSync('/tmp/spx_token.json', 'utf8'));
  const storedToken = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + token.expires_in * 1000,
  };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  const results = [];
  const check = (name, condition) => {
    results.push({ name, ok: condition });
    console.log(`${condition ? '✅' : '❌'} ${name}`);
  };

  try {
    await page.goto('http://127.0.0.1:1422', { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate((t) => localStorage.setItem('spx_spotify_token', JSON.stringify(t)), storedToken);
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await sleep(4000);

    // Click first recent item (album/playlist)
    const recentItems = await page.locator('.lib-item').all();
    check('Recent grid has items', recentItems.length > 0);

    if (recentItems.length > 0) {
      await recentItems[0].click();
      await sleep(3000);
      const detailText = await page.evaluate(() => document.body.innerText);
      check('Detail screen opened from recent item', detailText.includes('Album') || detailText.includes('Playlist') || detailText.includes('Artist') || detailText.includes('tracks'));
      await page.screenshot({ path: 'spx-detail-recent.png', fullPage: true });
    }

    // Test Library -> Playlists
    await page.locator('button[aria-label="Library"]').click();
    await sleep(2000);

    const playlistTab = await page.locator('button:has-text("Playlists")').first();
    if (await playlistTab.isVisible().catch(() => false)) {
      await playlistTab.click();
      await sleep(2000);
      const libText = await page.evaluate(() => document.body.innerText);
      check('Library Playlists tab loaded', libText.includes('Playlists'));
      await page.screenshot({ path: 'spx-library-playlists.png', fullPage: true });
    } else {
      check('Library Playlists tab visible', false);
    }

    // Test Library -> Albums
    const albumsTab = await page.locator('button:has-text("Albums")').first();
    if (await albumsTab.isVisible().catch(() => false)) {
      await albumsTab.click();
      await sleep(2000);
      const libText = await page.evaluate(() => document.body.innerText);
      check('Library Albums tab loaded', libText.includes('Albums'));
      await page.screenshot({ path: 'spx-library-albums.png', fullPage: true });
    } else {
      check('Library Albums tab visible', false);
    }

    // Test Queue screen with real data
    await page.locator('text="Queue"').first().click();
    await sleep(2000);
    const queueText = await page.evaluate(() => document.body.innerText);
    check('Queue screen loaded', queueText.includes('Up Next'));
    await page.screenshot({ path: 'spx-queue.png', fullPage: true });

    const passed = results.filter(r => r.ok).length;
    console.log(`\n=== DETAIL SCREENS: ${passed}/${results.length} passed ===`);
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
