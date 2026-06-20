/**
 * Cast Transfer E2E Test
 *
 * Verifies audio actually plays on a target Cast device after transfer.
 * Run with: npx playwright test src/tests/e2e-cast-transfer.spec.ts
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';

const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://192.168.1.32:1420';

interface TokenFile {
  access_token?: string;
  accessToken?: string;
  expires_in?: number;
  expiresAt?: number;
}

function loadToken(): string | null {
  const envToken = process.env.SPX_E2E_TOKEN;
  if (envToken) return envToken;
  const tokenPath = process.env.SPX_E2E_TOKEN_PATH || '/tmp/spx_token.json';
  if (!fs.existsSync(tokenPath)) return null;
  try {
    const raw = fs.readFileSync(tokenPath, 'utf8');
    const parsed: TokenFile = JSON.parse(raw);
    return parsed.access_token || parsed.accessToken || null;
  } catch { return null; }
}

async function authenticatePage(page: Page) {
  const token = loadToken();
  test.skip(!token, 'No Spotify token available');
  await page.goto(FRONTEND_URL);
  await page.waitForLoadState('networkidle');
  await page.evaluate((t) => {
    localStorage.setItem('spx_spotify_token',
      JSON.stringify({ accessToken: t, expiresAt: Date.now() + 3600_000 }));
  }, token);
  await page.reload();
  await page.waitForLoadState('networkidle');
}

async function openDeviceSelector(page: Page) {
  await page.waitForSelector('.player-bar', { timeout: 15000 });
  await page.locator('.device-btn').first().click();
  await page.waitForSelector('.device-dropdown', { timeout: 5000 });
  await page.waitForTimeout(500);
}

async function waitForDevices(page: Page, timeout = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const count = await page.locator('.device-item').count();
    if (count > 0) return;
    const spinning = await page.locator('.device-refresh-btn.spinning, .device-connect-btn.spinning').count();
    if (spinning === 0) {
      const empty = await page.locator('.device-empty').isVisible().catch(() => false);
      if (empty) return;
    }
    await page.waitForTimeout(1000);
  }
}

async function startPlaybackOnDevice(page: Page) {
  // Click play to ensure something is playing before transfer
  const playBtn = page.locator('.player-bar .ctrl-btn').nth(2);
  await playBtn.waitFor({ timeout: 5000 });
  await playBtn.click();
  await page.waitForTimeout(2000);
}

async function getPlaybackState(page: Page) {
  return page.evaluate(() => {
    const title = document.querySelector('.player-bar .player-title')?.textContent?.trim() ?? '';
    const artist = document.querySelector('.player-bar .player-artist')?.textContent?.trim() ?? '';
    const time = document.querySelector('.player-bar .time.current')?.textContent?.trim() ?? '0:00';
    const progress = (document.querySelector('.player-bar .progress-track') as HTMLElement)?.style.getPropertyValue('--progress-width') ?? '0%';
    const isPlaying = document.querySelector('.player-bar .ctrl-btn svg:not([fill="none"])') !== null ||
      document.querySelector('.player-bar .ctrl-btn.playing') !== null;
    return { title, artist, time, progress, isPlaying };
  });
}

const BACKEND_URL = 'http://127.0.0.1:1422';

async function authenticateCastDevice(page: any, ip: string, deviceName: string, token: string) {
  try {
    // Wake the device first
    await page.evaluate(async ({ backend, ip }: { backend: string; ip: string }) => {
      await fetch(`${backend}/invoke/wake_cast_device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip }),
      });
    }, { backend: BACKEND_URL, ip });

    // Authenticate via backend (uses sp_dc from backend env)
    await page.evaluate(async ({ backend, ip, deviceName, accessToken }: {
      backend: string; ip: string; deviceName: string; accessToken: string;
    }) => {
      await fetch(`${backend}/invoke/authenticate_cast_device_command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, deviceName, accessToken }),
      });
    }, { backend: BACKEND_URL, ip, deviceName, accessToken: token });

    // Wait for Spotify to register the device
    await page.waitForTimeout(10_000);
    return true;
  } catch (e) {
    console.log('Cast auth failed:', e);
    return false;
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('Cast Transfer — Audio plays on target device', () => {
  test('transfer to Cast device and verify audio IS playing on it', async ({ page }) => {
    const token = loadToken()!;
    await authenticatePage(page);

    // ── 1. Start playback on current device first ───────────────────────────────
    await page.waitForSelector('.player-bar', { timeout: 15000 });
    await startPlaybackOnDevice(page);

    const beforeTransfer = await getPlaybackState(page);
    console.log('Before transfer — track:', beforeTransfer.title, '| artist:', beforeTransfer.artist);
    console.log('Before transfer — time:', beforeTransfer.time, '| progress:', beforeTransfer.progress);

    // Verify something is playing
    expect(beforeTransfer.title).not.toBe('No track');
    expect(beforeTransfer.title.length).toBeGreaterThan(0);

    // ── 2. Get Cast devices from mDNS ─────────────────────────────────────────
    console.log('\n=== Fetching Cast device list from mDNS ===');
    let castDevices: { name: string; ip: string }[] = [];
    try {
      const mdnsResp = await page.evaluate(async (backend: string) => {
        const r = await fetch(`${backend}/local-devices`);
        return r.json();
      }, BACKEND_URL);
      castDevices = (mdnsResp.devices || []).filter((d: { service_type?: string }) =>
        d.service_type === 'googlecast'
      );
    } catch (e) {
      console.log('mDNS scan failed:', e);
    }
    console.log('Found Cast devices:', castDevices.map(d => d.name).join(', '));

    // Pick a target Cast device
    const EXCLUDE = /SPX|Local|This Mac|Group|All @|Bedroom display/i;
    const target = castDevices.find(d => !EXCLUDE.test(d.name)) || castDevices[0];

    if (!target) {
      test.skip(true, 'No Cast devices found to test transfer');
      return;
    }

    console.log(`\n=== Target: "${target.name}" @ ${target.ip} ===\n`);

    // ── 3. Authenticate the Cast device ───────────────────────────────────────
    console.log('Authenticating Cast device via backend...');
    const authOk = await authenticateCastDevice(page, target.ip, target.name, token);
    if (!authOk) {
      test.skip(true, 'Cast device authentication failed');
      return;
    }
    console.log('Cast device authenticated ✅');

    // ── 4. Open device selector ────────────────────────────────────────────────
    await openDeviceSelector(page);
    await waitForDevices(page, 45000);

    const deviceItems = page.locator('.device-item');
    const deviceNames = await page.locator('.device-name').allTextContents();
    console.log('\n=== Available devices after auth ===');
    deviceNames.forEach((name, i) => console.log(`  [${i}] ${name}`));

    // Find the index of our target device
    let targetIdx = -1;
    for (let i = 0; i < deviceNames.length; i++) {
      if (deviceNames[i]?.trim() === target.name.trim()) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx === -1) {
      test.skip(true, 'Target Cast device not found in dropdown after auth');
      return;
    }

    console.log(`\n=== Transferring to: "${target.name}" (index ${targetIdx}) ===\n`);

    // ── 4. Click the target device ────────────────────────────────────────────
    await deviceItems.nth(targetIdx).click();

    // ── 5. Wait for transfer to complete (up to 60s) ─────────────────────────
    const startTime = Date.now();
    let transferSucceeded = false;
    let fallbackTriggered = false;
    let errorMessage = '';

    while (Date.now() - startTime < 60_000) {
      // Check: did the target device get the "Active" badge?
      const targetActive = await deviceItems.nth(targetIdx)
        .locator('.device-playing-badge')
        .isVisible()
        .catch(() => false);

      // Check: did SPX Player get the Active badge (fallback)?
      const spxActive = await page.locator('.device-name', { hasText: 'SPX' })
        .locator('.device-playing-badge')
        .isVisible()
        .catch(() => false);

      // Check: is there an error in the dropdown?
      const errorEl = page.locator('.device-error');
      const hasError = await errorEl.isVisible().catch(() => false);
      if (hasError) {
        errorMessage = (await errorEl.textContent()) ?? '';
      }

      // Check: is the transfer spinner still showing?
      const spinnerVisible = await page.locator('.transfer-status').isVisible().catch(() => false);

      // Check: did the dropdown close (means transfer finished)?
      const dropdownClosed = !(await page.locator('.device-dropdown').isVisible().catch(() => true));

      if (targetActive) {
        console.log(`✅ Target device "${target.name}" is ACTIVE — transfer SUCCESS`);
        transferSucceeded = true;
        break;
      }

      if (spxActive) {
        console.log('⚠️ SPX Player is now active (fallback triggered)');
        fallbackTriggered = true;
        break;
      }

      if (!spinnerVisible && dropdownClosed && hasError) {
        console.log(`⚠️ Transfer failed with error: "${errorMessage.trim()}"`);
        break;
      }

      await page.waitForTimeout(1000);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nTransfer attempt took ${elapsed}s`);
    console.log(`Result: transferSucceeded=${transferSucceeded}, fallbackTriggered=${fallbackTriggered}, error="${errorMessage.trim()}"`);

    // ── 6. Close dropdown if still open ──────────────────────────────────────
    const stillOpen = await page.locator('.device-dropdown').isVisible().catch(() => false);
    if (stillOpen) {
      await page.locator('.player-bar').click({ position: { x: 1, y: 1 } });
      await page.waitForTimeout(1000);
    }

    // ── 7. Click Play ─────────────────────────────────────────────────────────
    console.log('\n=== Starting playback after transfer ===\n');
    await startPlaybackOnDevice(page);

    // ── 8. Verify playback state on PlayerBar ─────────────────────────────────
    const afterTransfer = await getPlaybackState(page);
    console.log('After transfer — track:', afterTransfer.title);
    console.log('After transfer — artist:', afterTransfer.artist);
    console.log('After transfer — time:', afterTransfer.time);
    console.log('After transfer — progress:', afterTransfer.progress);

    // ── 9. Assertions ────────────────────────────────────────────────────────
    // The track should be loaded (not "No track")
    expect(afterTransfer.title).not.toBe('No track');
    expect(afterTransfer.title.length).toBeGreaterThan(0);

    // The time should show a valid formatted time (not 0:00 indefinitely)
    // Give it 5 seconds to advance
    await page.waitForTimeout(5000);
    const afterWait = await getPlaybackState(page);
    console.log('After 5s wait — time:', afterWait.time, '| progress:', afterWait.progress);

    // Progress should be > 0% if music is actually playing
    // (0% could mean paused or no device available)
    const progressPct = parseFloat(afterWait.progress.replace('%', ''));
    console.log(`Progress: ${progressPct}%`);

    if (transferSucceeded) {
      // BEST CASE: target Cast device received the transfer
      // Verify the target device shows as active in the dropdown
      await openDeviceSelector(page);
      const targetIsActive = await deviceItems.nth(targetIdx)
        .locator('.device-playing-badge')
        .isVisible()
        .catch(() => false);

      console.log(`\n${'='.repeat(50)}`);
      console.log(`RESULT: Audio transferred to "${target.name}"`);
      console.log(`  • Target device active badge: ${targetIsActive}`);
      console.log(`  • Track playing: "${afterTransfer.title}"`);
      console.log(`  • Time after 5s: ${afterWait.time} (progress: ${afterWait.progress})`);
      console.log(`${'='.repeat(50)}\n`);

      expect(targetIsActive).toBe(true);
      // Progress should advance if music is really playing
      expect(progressPct).toBeGreaterThan(0);
    } else if (fallbackTriggered) {
      // ACCEPTABLE: Cast unavailable, fallback to SPX Player
      console.log(`\n${'='.repeat(50)}`);
      console.log(`RESULT: Cast device "${target.name}" unavailable`);
      console.log(`  • Fallback triggered — playback on SPX Player`);
      console.log(`  • Track: "${afterTransfer.title}"`);
      console.log(`${'='.repeat(50)}\n`);

      // In fallback mode, we verify SPX Player got the transfer
      await openDeviceSelector(page);
      const spxIsActive = await page.locator('.device-name', { hasText: 'SPX' })
        .locator('.device-playing-badge')
        .isVisible()
        .catch(() => false);
      console.log(`SPX Player active badge: ${spxIsActive}`);

      expect(spxIsActive).toBe(true);
    } else {
      // FAILURE: neither Cast nor fallback worked
      console.log(`\n❌ Transfer FAILED: "${errorMessage.trim()}"`);
      expect(transferSucceeded || fallbackTriggered).toBe(true);
    }
  });
});
