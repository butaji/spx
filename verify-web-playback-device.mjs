import { chromium } from 'playwright';
import fs from 'fs';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const token = JSON.parse(fs.readFileSync('/tmp/spx_token.json', 'utf8'));
  const accessToken = token.access_token;

  // Launch real Chrome (has Widevine DRM) instead of Playwright Chromium
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  let deviceId = null;
  let initError = null;

  page.on('console', msg => {
    const text = msg.text();
    console.log(`[chrome] ${text}`);
    const match = text.match(/SPX_WEB_PLAYER_READY\s+(.+)/);
    if (match) deviceId = match[1];
    if (text.includes('SPX_WEB_PLAYER_INIT_ERROR')) initError = text;
  });

  try {
    const filePath = `http://127.0.0.1:1425/spx-web-player.html?token=${accessToken}`;
    console.log('Opening Web Playback SDK test page...');
    await page.goto(filePath, { waitUntil: 'networkidle', timeout: 60000 });

    // Wait for device ready or error
    let waited = 0;
    while (!deviceId && !initError && waited < 30000) {
      await sleep(1000);
      waited += 1000;
    }

    if (initError) {
      console.log('❌ Web Playback SDK init failed:', initError);
      process.exitCode = 1;
      return;
    }

    if (!deviceId) {
      console.log('❌ Web Playback SDK did not become ready in time');
      process.exitCode = 1;
      return;
    }

    console.log('✅ Web Playback SDK ready, device_id:', deviceId);

    // Poll Spotify for the device to appear
    console.log('Polling Spotify devices...');
    let spotifyDeviceId = null;
    for (let i = 0; i < 15; i++) {
      const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      const found = data.devices?.find(d => d.id === deviceId || d.name === 'SPX Test Player');
      if (found) {
        spotifyDeviceId = found.id;
        break;
      }
      await sleep(2000);
    }

    if (!spotifyDeviceId) {
      console.log('❌ Device did not appear in Spotify Connect list');
      process.exitCode = 1;
      return;
    }

    console.log('✅ Device found in Spotify Connect list:', spotifyDeviceId);

    // Transfer playback to the device WITHOUT starting playback
    console.log('Transferring playback (play=false)...');
    const transferRes = await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_ids: [spotifyDeviceId], play: false }),
    });

    if (transferRes.status !== 204 && transferRes.status !== 202) {
      const err = await transferRes.text();
      console.log('❌ Transfer failed:', transferRes.status, err);
      process.exitCode = 1;
      return;
    }

    console.log('✅ Playback transferred successfully (audio not started)');

    // Verify playback state shows our device as active
    await sleep(2000);
    const stateRes = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const state = await stateRes.json();
    if (state.device?.id === spotifyDeviceId) {
      console.log('✅ Active device verified in playback state');
    } else {
      console.log('❌ Active device mismatch:', state.device?.id, 'expected', spotifyDeviceId);
      process.exitCode = 1;
    }
  } catch (e) {
    console.error('Test failed:', e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
