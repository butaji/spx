import { chromium } from 'playwright';
import fs from 'fs';

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

  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  try {
    console.log('Loading SPX on http://127.0.0.1:1422 ...');
    await page.goto('http://127.0.0.1:1422', { waitUntil: 'networkidle', timeout: 30000 });

    // Inject token
    await page.evaluate((t) => {
      localStorage.setItem('spx_spotify_token', JSON.stringify(t));
    }, storedToken);

    console.log('Token injected, reloading...');
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.evaluate(() => document.body.innerText);
    const isAuthed = !bodyText.includes('Connect with Spotify');
    console.log('\n=== AUTHENTICATED UI CHECK ===');
    console.log('Contains "Connect with Spotify":', bodyText.includes('Connect with Spotify'));
    console.log('Authenticated UI rendered:', isAuthed ? '✅' : '❌');

    // Look for main nav tabs
    const tabs = ['Now Playing', 'Search', 'Library', 'Queue'];
    console.log('\n=== NAVIGATION TABS ===');
    for (const tab of tabs) {
      const visible = await page.locator(`text="${tab}"`).first().isVisible().catch(() => false);
      console.log(`${visible ? '✅' : '❌'} ${tab}`);
    }

    // Screenshot
    await page.screenshot({ path: 'spx-authenticated.png', fullPage: true });
    console.log('\nScreenshot saved: spx-authenticated.png');

    if (!isAuthed) {
      console.log('\nBody text (first 500 chars):');
      console.log(bodyText.substring(0, 500));
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('Test failed:', e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
