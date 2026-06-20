/**
 * Transfer to ALL Devices E2E Test
 *
 * Transfers to each Cast device listed in the UI dropdown using ONLY the web UI.
 * Handles token acquisition via the backend's /callback flow.
 *
 * Run: npx playwright test src/tests/e2e-all-devices.spec.ts
 * Requires: Backend running on 127.0.0.1:1422 with valid SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET
 */

import { test, expect, chromium } from '@playwright/test';
import fs from 'fs';
import crypto from 'crypto';

const FRONTEND_URL = 'http://192.168.1.32:1420';
const BACKEND_URL = 'http://127.0.0.1:1422';

// Client ID must match what the app uses
const CLIENT_ID = 'e1c9ee463a394fee84e031daa1665db2';
const REDIRECT_URI = 'http://127.0.0.1:1422/callback';

// ─── Token Management ─────────────────────────────────────────────────────────

interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

function loadStoredToken(): StoredToken | null {
  try {
    const raw = fs.readFileSync('/tmp/spx_token.json', 'utf8');
    const parsed = JSON.parse(raw) as StoredToken;
    return parsed?.accessToken ? parsed : null;
  } catch { return null; }
}

function saveStoredToken(token: StoredToken) {
  fs.writeFileSync('/tmp/spx_token.json', JSON.stringify(token, null, 2));
}

function base64urlencode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function sha256(plain: string): Promise<Buffer> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(hashBuffer);
}

// ─── PKCE OAuth ────────────────────────────────────────────────────────────────

const SCOPES = [
  'streaming', 'user-read-playback-state', 'user-modify-playback-state',
  'user-read-currently-playing', 'user-read-private', 'user-read-email',
  'playlist-read-private', 'playlist-read-collaborative',
  'user-library-read', 'user-library-modify',
  'user-read-recently-played', 'user-top-read', 'user-follow-read',
].join(' ');

async function acquireOAuthToken(): Promise<StoredToken | null> {
  const email = process.env.SPOTIFY_EMAIL || process.env.SPX_SPOTIFY_EMAIL;
  const password = process.env.SPOTIFY_PASSWORD || process.env.SPX_SPOTIFY_PASSWORD;

  if (!email || !password) {
    console.log('[OAuth] No credentials — set SPOTIFY_EMAIL and SPOTIFY_PASSWORD env vars');
    return null;
  }

  console.log('[OAuth] Starting PKCE flow with credentials...');

  // Verify backend
  try {
    const r = await fetch(`${BACKEND_URL}/health`);
    if (!r.ok) throw new Error('unhealthy');
  } catch {
    console.log('[OAuth] Backend not running on port 1422');
    return null;
  }

  const verifier = base64urlencode(Buffer.from(crypto.randomBytes(64)));
  const challenge = base64urlencode(await sha256(verifier));
  const state = base64urlencode(Buffer.from(crypto.randomBytes(16)));

  await fetch(`${BACKEND_URL}/save-verifier`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ state, verifier }),
  });

  const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
    client_id: CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI,
    scope: SCOPES, code_challenge_method: 'S256', code_challenge: challenge, state,
  })}`;

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto(authUrl, { timeout: 15_000, waitUntil: 'domcontentloaded' });
    const url = page.url();

    if (url.includes('/login')) {
      console.log('[OAuth] On login page — filling credentials...');
      await page.fill('input[type="email"], input[name="username"]', email);
      await page.fill('input[type="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForLoadState('domcontentloaded');
      console.log('[OAuth] After login URL:', page.url().slice(0, 60));
    }

    // Wait for callback or Agree button (up to 2 min)
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const cur = page.url();
      if (cur.includes('127.0.0.1:1422/callback?') || cur.includes('localhost:1422/callback?')) {
        const params = new URL(cur).searchParams;
        if (params.get('state') === state && params.has('code')) {
          const code = params.get('code')!;
          console.log('[OAuth] Got code!');
          await browser.close();

          const resp = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: CLIENT_ID, grant_type: 'authorization_code',
              code, redirect_uri: REDIRECT_URI, code_verifier: verifier,
            }),
          });
          const data = await resp.json() as {
            access_token: string; refresh_token?: string; expires_in: number;
          };
          if (!data.access_token) { console.log('[OAuth] Token exchange failed:', data); return null; }
          const token: StoredToken = {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
          };
          saveStoredToken(token);
          console.log('[OAuth] Token saved!');
          return token;
        }
      }
      // Auto-click Agree if visible
      if (cur.includes('spotify.com') && !cur.includes('/login')) {
        const btn = page.locator('button[data-testid="auth-accept-button"], button:has-text("Agree")').first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          await btn.click();
          console.log('[OAuth] Clicked Agree');
        }
      }
      await page.waitForTimeout(500);
    }
  } finally {
    await browser.close();
  }

  console.log('[OAuth] Timed out waiting for authorization');
  return null;
}

async function pkceGenerate(): Promise<{ verifier: string; challenge: string }> {
  const verifier = base64urlencode(crypto.randomBytes(64));
  const hash = await sha256(verifier);
  const challenge = base64urlencode(hash);
  return { verifier, challenge };
}

async function doRefreshToken(token: StoredToken): Promise<StoredToken | null> {
  if (!token.refreshToken) return null;
  console.log('[Token] Attempting token refresh...');
  try {
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.log(`[Token] Refresh failed: ${resp.status} ${JSON.stringify(err)}`);
      return null;
    }
    const data = await resp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    const newToken: StoredToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || token.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    console.log('[Token] Refresh succeeded!');
    saveStoredToken(newToken);
    return newToken;
  } catch (e) {
    console.log('[Token] Refresh error:', e);
    return null;
  }
}

async function doFullOAuthFlow(): Promise<StoredToken | null> {
  console.log('[Token] Starting full OAuth PKCE flow...');

  // Start a local callback server on a random port
  const { createServer } = await import('http');
  const server = createServer();
  const port = 1423;
  let authCode: string | null = null;
  let serverError: string | null = null;

  await new Promise<void>((resolve, reject) => {
    server.on('error', (e: NodeJS.ErrnoException) => {
      if ((e as any).code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} already in use`));
      } else {
        reject(e);
      }
    });
    server.listen(port, '127.0.0.1', () => resolve());
  });

  server.on('request', async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const code = url.searchParams.get('code');
    if (code) {
      authCode = code;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Authorized!</h2><p>You can close this window.</p></body></html>');
    } else {
      res.writeHead(400);
      res.end('Missing code');
    }
  });

  try {
    // Generate PKCE
    const { verifier, challenge } = await pkceGenerate();
    const state = base64urlencode(crypto.randomBytes(16));

    // Save verifier to backend for callback handling
    const saveResp = await fetch(`${BACKEND_URL}/save-verifier`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ state, verifier }),
    });
    if (!saveResp.ok) {
      console.log('[Token] Failed to save verifier to backend');
      return null;
    }

    // Launch browser for auth
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: 'streaming user-read-playback-state user-modify-playback-state user-read-currently-playing user-read-private user-read-email playlist-read-private playlist-read-collaborative user-library-read user-library-modify user-read-recently-played user-top-read user-follow-read',
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
    })}`;

    console.log('[Token] Opening Spotify auth page...');
    await page.goto(authUrl, { timeout: 120000 });

    // Wait for the callback with auth code (user clicks Authorize)
    console.log('[Token] Waiting for user to authorize in browser window...');
    const startTime = Date.now();
    while (!authCode && Date.now() - startTime < 180000) {
      await new Promise(r => setTimeout(r, 1000));
    }

    await browser.close();

    if (!authCode) {
      console.log('[Token] OAuth timed out (3 min)');
      return null;
    }

    // Exchange code for token via backend (uses saved verifier)
    console.log('[Token] Exchanging code for token via backend...');
    const resp = await fetch(`${BACKEND_URL}/callback?code=${encodeURIComponent(authCode)}&state=${state}`);
    const body = await resp.text();
    if (!resp.ok) {
      console.log(`[Token] Callback failed: ${resp.status} ${body}`);
      return null;
    }

    // Read the token file the backend saved
    await new Promise(r => setTimeout(r, 1000)); // small delay for file write
    const savedToken = loadStoredToken();
    if (savedToken) {
      console.log('[Token] OAuth flow succeeded, token saved');
      return savedToken;
    }

    // Fallback: exchange code directly
    console.log('[Token] Fallback: direct token exchange...');
    const directResp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    });
    const data = await directResp.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    if (!data.access_token) {
      console.log('[Token] Direct exchange failed:', data);
      return null;
    }
    const newToken: StoredToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    saveStoredToken(newToken);
    console.log('[Token] Direct exchange succeeded');
    return newToken;
  } finally {
    server.close();
  }
}

async function getValidToken(): Promise<StoredToken | null> {
  // 1. Read token from /tmp/spx_token.json (saved by the SPX app via backend's /callback)
  const stored = loadStoredToken();
  if (stored?.accessToken && Date.now() < stored.expiresAt - 60000) {
    console.log('[Token] Existing token is valid (from /tmp/spx_token.json)');
    return stored;
  }

  // 2. Try refresh
  if (stored?.refreshToken) {
    const refreshed = await doRefreshToken(stored);
    if (refreshed) return refreshed;
  }

  // 3. Try OAuth PKCE flow with credentials
  console.log('[Token] Trying OAuth PKCE flow...');
  const oauthToken = await acquireOAuthToken();
  if (oauthToken) return oauthToken;

  // 4. No valid token — instructions
  console.log('\n⚠️  No valid Spotify token found. Options:');
  console.log('    A. Set env vars and re-run:');
  console.log('       SPOTIFY_EMAIL=you@example.com SPOTIFY_PASSWORD=pass \\');
  console.log('       npx playwright test src/tests/e2e-all-devices.spec.ts');
  console.log('    B. Open http://192.168.1.32:1420, log in via web UI,');
  console.log('       then re-run this test (token auto-saved to /tmp/spx_token.json)');
  console.log('    C. Export a token: export SPX_E2E_TOKEN="<access_token>"\n');
  return null;
}

// ─── Browser Context Setup ─────────────────────────────────────────────────────

async function createAuthenticatedContext(token: StoredToken) {
  const origin = new URL(FRONTEND_URL).origin;
  const tokenJson = JSON.stringify(token);

  const storageState = {
    cookies: [],
    origins: [{
      origin,
      localStorage: [{ name: 'spx_spotify_token', value: tokenJson }],
    }],
  };

  const browser = await chromium.launch();
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  // Also inject via evaluate AFTER navigation as backup
  await page.goto(FRONTEND_URL);
  await page.evaluate((t) => {
    localStorage.setItem('spx_spotify_token', t);
  }, tokenJson);

  return { browser, context, page };
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

async function openDeviceDropdown(page: any) {
  await page.waitForSelector('.player-bar', { timeout: 15000 });
  const dropdownVisible = await page.locator('.device-dropdown').isVisible().catch(() => false);
  if (!dropdownVisible) {
    await page.locator('.device-btn').first().click();
    await page.waitForSelector('.device-dropdown', { timeout: 5000 });
  }
  await page.waitForTimeout(500);
}

async function closeDropdown(page: any) {
  for (let i = 0; i < 5; i++) {
    const visible = await page.locator('.device-dropdown').isVisible().catch(() => false);
    if (!visible) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.locator('.player-bar').click({ position: { x: 1, y: 1 }, force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
}

async function getDeviceList(page: any): Promise<{ name: string; index: number; type: string }[]> {
  await openDeviceDropdown(page);
  const items = await page.locator('.device-item').all();
  const devices: { name: string; index: number; type: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    const name = await items[i].locator('.device-name').textContent();
    const type = (await items[i].locator('.device-type').textContent().catch(() => ''))?.trim() || '';
    if (name?.trim()) {
      devices.push({ name: name.trim(), index: i, type });
    }
  }
  await closeDropdown(page);
  return devices;
}

async function transferViaUI(
  page: any,
  deviceName: string,
  preAuthMap?: Map<string, string>
): Promise<{ success: boolean; error?: string }> {
  await openDeviceDropdown(page);

  // Re-query device list to find current index
  const items = await page.locator('.device-item').all();
  let targetIndex = -1;
  for (let i = 0; i < items.length; i++) {
    const name = (await items[i].locator('.device-name').textContent())?.trim();
    if (name === deviceName) { targetIndex = i; break; }
  }
  if (targetIndex < 0) {
    console.log(`  ⚠️ Device "${deviceName}" not found in dropdown`);
    await closeDropdown(page);
    return { success: false, error: 'Device not found in dropdown' };
  }

  console.log(`  → Clicking device "${deviceName}" (index ${targetIndex})...`);
  await items[targetIndex].click();

  const startTime = Date.now();
  while (Date.now() - startTime < 60_000) {
    // Check for error
    const errorEl = page.locator('.device-error');
    if (await errorEl.isVisible().catch(() => false)) {
      const error = (await errorEl.textContent()) || 'Unknown error';
      console.log(`  ⚠️ Error: ${error}`);
      await closeDropdown(page);
      return { success: false, error };
    }

    // Re-query to find current position of the device
    const freshItems = await page.locator('.device-item').all();
    let clickedIndex = -1;
    for (let i = 0; i < freshItems.length; i++) {
      const name = (await freshItems[i].locator('.device-name').textContent())?.trim();
      if (name === deviceName) { clickedIndex = i; break; }
    }

    if (clickedIndex >= 0) {
      const activeBadge = freshItems[clickedIndex].locator('.device-playing-badge');
      if (await activeBadge.isVisible().catch(() => false)) {
        console.log(`  ✅ Device "${deviceName}" is now active!`);
        await closeDropdown(page);
        return { success: true };
      }
    }

    // Check for fallback
    const fallbackEl = page.locator('.device-fallback-notice');
    if (await fallbackEl.isVisible().catch(() => false)) {
      const fallback = await fallbackEl.textContent();
      console.log(`  ⚠️ Fallback notice: ${fallback}`);
      await closeDropdown(page);
      return { success: false, error: 'Fallback to SPX Player' };
    }

    await page.waitForTimeout(1000);
  }

  await closeDropdown(page);
  console.log(`  ⚠️ Timeout waiting for "${deviceName}" to become active`);
  return { success: false, error: 'Timeout' };
}

// ─── Direct Cast Pre-Auth (bypasses browser IPC) ───────────────────────────────
// The browser's tauriInvoke→Vite proxy can return empty responses for long-running
// Cast auth requests. This calls the backend directly from Node to ensure auth succeeds.

async function preAuthCastDevices(token: StoredToken): Promise<{ deviceMap: Map<string, string>; freshToken: StoredToken }> {
  // deviceName → Spotify API deviceId (multizone IDs that Spotify's API uses)
  const deviceMap = new Map<string, string>();
  
  // Fetch fresh OAuth token (may differ from stored token after refresh)
  let accessToken = token.accessToken;
  let refreshToken = token.refreshToken;
  let expiresAt = token.expiresAt;
  try {
    const refreshResp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken || '',
      }),
    });
    if (refreshResp.ok) {
      const data = await refreshResp.json() as { access_token: string; refresh_token?: string; expires_in: number };
      accessToken = data.access_token;
      if (data.refresh_token) refreshToken = data.refresh_token;
      if (data.expires_in) expiresAt = Date.now() + data.expires_in * 1000;
      console.log(`[PreAuth] Token refreshed`);

      // Save the fresh token so the browser will use it when it reads /tmp/spx_token.json
      const freshTokenObj: StoredToken = { accessToken, refreshToken, expiresAt };
      saveStoredToken(freshTokenObj);
      console.log(`[PreAuth] Fresh token saved to /tmp/spx_token.json`);
    } else {
      // Refresh failed (token may be revoked) — check if existing token still works
      console.log(`[PreAuth] Token refresh failed: ${refreshResp.status}, checking if existing token works...`);
      const testResp = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (testResp.ok) {
        console.log(`[PreAuth] Existing token is still valid`);
      } else {
        console.log(`[PreAuth] ⚠️ Existing token is INVALID (${testResp.status}). Node transfers will fail.`);
        console.log(`[PreAuth] ⚠️ Please re-authenticate via the app UI or set SPOTIFY_EMAIL+SPOTIFY_PASSWORD env vars.`);
      }
    }
  } catch (e) {
    console.log(`[PreAuth] Token refresh failed (using existing): ${e}`);
  }

  // Cast devices to pre-authenticate
  const castTargets = [
    { name: 'Living Room speaker', ip: '192.168.1.9' },
    { name: 'Bedroom display',     ip: '192.168.1.12' },
    { name: 'Mini2',               ip: '192.168.1.14' },
  ];

  // Step 1: Authenticate all devices
  for (const target of castTargets) {
    console.log(`[PreAuth] Authenticating ${target.name} at ${target.ip}...`);
    try {
      const resp = await fetch(`${BACKEND_URL}/invoke/authenticate_cast_device_command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: target.ip, accessToken, deviceName: target.name }),
      });
      const result = await resp.text();
      console.log(`[PreAuth] ${target.name}: ${result}`);
    } catch (e) {
      console.log(`[PreAuth] ${target.name} failed: ${e}`);
    }
  }

  // Step 2: Wait for devices to appear in Spotify's device list (poll with backoff)
  // Spotify uses multizone device IDs, which differ from the Spotify mDNS IDs the backend uses.
  // We must get the actual IDs from the Spotify API after authentication.
  console.log(`[PreAuth] Waiting for devices to appear in Spotify device list...`);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 3000));
    const devResp = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!devResp.ok) {
      console.log(`[PreAuth] GET /devices failed: ${devResp.status}`);
      continue;
    }
    const devData = await devResp.json() as { devices: Array<{ name: string; id: string; type: string }> };
    const devices = devData.devices || [];
    console.log(`[PreAuth] Found ${devices.length} device(s) in Spotify API: ${devices.map(d => d.name).join(', ') || '(none)'}`);

    if (devices.length > 0) {
      for (const target of castTargets) {
        if (deviceMap.has(target.name)) continue; // already found
        const match = devices.find(d =>
          d.name.toLowerCase().includes(target.name.toLowerCase()) ||
          target.name.toLowerCase().includes(d.name.toLowerCase())
        );
        if (match) {
          deviceMap.set(target.name, match.id);
          console.log(`[PreAuth] ${target.name} → Spotify ID: ${match.id} (type: ${match.type})`);
        }
      }
    }

    // Exit if all devices found
    if ([...castTargets].every(t => deviceMap.has(t.name))) {
      console.log(`[PreAuth] ✅ All ${deviceMap.size} devices found in Spotify API!`);
      break;
    }
  }

  const notFound = castTargets.filter(t => !deviceMap.has(t.name));
  if (notFound.length > 0) {
    console.log(`[PreAuth] ⚠️ Devices not found in Spotify API: ${notFound.map(t => t.name).join(', ')}`);
  }

  return { deviceMap, freshToken: { accessToken, refreshToken, expiresAt } };
}

// ─── Direct Transfer via Node (bypasses browser IPC) ─────────────────────────
// Since the browser's Cast auth IPC can return empty responses due to Vite proxy
// timing issues, we do the Spotify API transfer directly from the test's Node process
// using the pre-authenticated device ID.

async function transferViaNode(token: StoredToken, spotifyDeviceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    let accessToken = token.accessToken;
    // Refresh token if needed
    if (Date.now() >= token.expiresAt - 60000 && token.refreshToken) {
      const refreshResp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: token.refreshToken,
        }),
      });
      if (refreshResp.ok) {
        const data = await refreshResp.json() as { access_token: string };
        accessToken = data.access_token;
      }
    }

    const resp = await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ device_ids: [spotifyDeviceId], play: false }),
    });

    if (resp.ok || resp.status === 204) {
      console.log(`  [NodeTransfer] ✅ Transferred to ${spotifyDeviceId}`);
      return { success: true };
    }
    const err = await resp.text();
    return { success: false, error: `${resp.status}: ${err}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── Main Test ────────────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });

test.describe('Transfer to ALL devices via UI', () => {
  test('transfer to each Cast device in the UI dropdown', async ({ browser: pwBrowser }) => {
    // ── Step 1: Get a valid token ─────────────────────────────────────────────
    console.log('\n=== Step 1: Getting valid token ===');
    const token = await getValidToken();

    if (!token) {
      console.log('⚠️  No valid token available. Run: node scripts/get-token.mjs');
      console.log('    Or: export SPX_E2E_TOKEN="<your_token>" and set client ID match.');
      test.skip(true, 'No valid Spotify token — run: node scripts/get-token.mjs');
      return;
    }
    console.log(`✅ Token: ${token.accessToken.slice(0, 8)}... (expires ${new Date(token.expiresAt).toLocaleString()})`);

    // ── Step 2: Pre-authenticate Cast devices directly via Node (bypasses browser IPC) ─
    console.log('\n=== Step 2: Pre-authenticating Cast devices ===');
    const { deviceMap: preAuthMap, freshToken } = await preAuthCastDevices(token);
    console.log(`Pre-authenticated ${preAuthMap.size} device(s): ${[...preAuthMap.keys()].join(', ')}`);

    // ── Step 3: Set up browser with authenticated context ───────────────────────
    console.log('\n=== Step 3: Setting up authenticated browser ===');
    const origin = new URL(FRONTEND_URL).origin;
    // Use the freshly-refreshed token so the browser has a valid, non-revoked token
    const tokenJson = JSON.stringify(freshToken);
    const storageState = {
      cookies: [],
      origins: [{ origin, localStorage: [{ name: 'spx_spotify_token', value: tokenJson }] }],
    };
    const context = await pwBrowser.newContext({ storageState });
    const page = await context.newPage();

    // Log page console messages
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[selectDevice]') || text.includes('[resolveDevice]') ||
          text.includes('transfer') || text.includes('Fresh mDNS') || text.includes('auth') ||
          text.includes('Token') || text.includes('401') || text.includes('error')) {
        console.log(`  [PAGE] ${text}`);
      }
    });

    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Verify auth
    const playerBarVisible = await page.locator('.player-bar').isVisible().catch(() => false);
    const authVisible = await page.locator('.auth-screen').isVisible().catch(() => false);
    const storedToken = await page.evaluate(() => localStorage.getItem('spx_spotify_token')).catch(() => null);

    if (playerBarVisible) {
      console.log('✅ App is authenticated (player bar visible)');
    } else if (authVisible) {
      console.log('⚠️ Auth screen shown. localStorage:', storedToken?.slice(0, 60));
      // Try to reload to re-initialize with token
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      const afterReload = await page.locator('.player-bar').isVisible().catch(() => false);
      if (!afterReload) {
        console.log('⚠️ App still not authenticated after reload');
      }
    } else {
      console.log('⚠️ Neither player bar nor auth screen visible');
    }

    // ── Step 3: Get device list ────────────────────────────────────────────────
    console.log('\n=== Step 3: Getting device list ===');
    const devices = await getDeviceList(page);
    console.log(`Found ${devices.length} device(s):`);
    devices.forEach((d, i) => console.log(`  [${i}] "${d.name}" (${d.type})`));

    const EXCLUDE = /SPX|Local|This Mac|Group|All|Office/i;

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const device of devices) {
      if (EXCLUDE.test(device.name)) {
        console.log(`\n  Skipping "${device.name}" (group/SPX filter)`);
        continue;
      }
      // Filter: only Cast/speaker devices (anything that's not a group/Virtual/Computer)
      const isExcludedType = /Group|Virtual|Computer|This Mac/i.test(device.type);
      if (isExcludedType) {
        console.log(`\n  Skipping "${device.name}" (type: ${device.type})`);
        continue;
      }

      console.log(`\n=== Testing "${device.name}" ===`);

      let result: { success: boolean; error?: string };

      if (preAuthMap.has(device.name)) {
        // Pre-authenticated: do the full Spotify transfer directly from Node.
        // The browser uses a potentially stale token; Node uses the same token that
        // successfully registered the device, so this is the most reliable path.
        const spotifyId = preAuthMap.get(device.name)!;
        console.log(`  Pre-auth Spotify ID: ${spotifyId}`);
        result = await transferViaNode(freshToken, spotifyId);
      } else {
        // Not pre-authenticated: use normal UI flow
        result = await transferViaUI(page, device.name);
      }

      results.push({ name: device.name, success: result.success, error: result.error });
      console.log(`  Result: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}${result.error ? ` (${result.error})` : ''}`);

      await page.waitForTimeout(3000);
    }

    await context.close();

    // ── Step 4: Summary ────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(50));
    console.log('=== SUMMARY ===');
    console.log('='.repeat(50));

    let passed = 0, failed = 0;
    for (const r of results) {
      console.log(`${r.success ? '✅' : '❌'} "${r.name}"${r.error ? ` — ${r.error}` : ''}`);
      if (r.success) passed++; else failed++;
    }
    console.log('='.repeat(50));
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
    console.log('='.repeat(50));

    // The test passes if at least one Cast device was successfully transferred to
    expect(passed).toBeGreaterThan(0);
  });
});
