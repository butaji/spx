// Check if we are running inside the Tauri WebView by looking for the
// IPC bridge. In plain-browser dev mode this does not exist, so we
// set up a minimal shim to prevent crashes when Tauri API packages
// are loaded dynamically.  The shim provides harmless stubs for every
// property that the Tauri runtime would normally inject.
if (!("__TAURI_INTERNALS__" in window)) {
  console.log("[SPX] Running in browser mode (no Tauri IPC available)");
  (window as any).__TAURI_INTERNALS__ = {
    __is_spx_shim__: true,
    invoke: async () => { console.warn("[SPX] Tauri invoke called in browser mode"); },
    transformCallback: () => 0,
    unregisterCallback: () => {},
    runCallback: () => {},
    callbacks: {},
    convertFileSrc: (s: string) => s,
    metadata: { currentWindow: { label: "" }, currentWebview: { label: "" } },
    plugins: { path: { sep: "/", delimiter: ":" } },
  };

  // Tell tauriInvoke / scanLocalDevices to call the backend directly at 127.0.0.1:1422.
  // This bypasses the Vite http-proxy which has a hard 5s socket timeout — too short
  // for the 20s mDNS device scan. The backend supports CORS with Access-Control-Allow-Origin: *.
  (window as any).SPX_BROWSER_BACKEND_URL = 'http://127.0.0.1:1422';

  // Patch global fetch to route Spotify API calls through the Vite proxy in browser mode.
  const originalFetch = window.fetch;
  window.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
    let url = typeof input === 'string' ? input : input.toString();
    if (url.startsWith('https://api.spotify.com/')) {
      const proxied = url.replace('https://api.spotify.com', '/spotify-api');
      console.log(`[fetch proxy] ${url} -> ${proxied}`);
      return originalFetch(proxied, init);
    }
    if (url.startsWith('https://accounts.spotify.com/')) {
      const proxied = url.replace('https://accounts.spotify.com', '/spotify-accounts');
      console.log(`[fetch proxy] ${url} -> ${proxied}`);
      return originalFetch(proxied, init);
    }
    return originalFetch(input, init);
  };
}

import { render } from "preact";
import App from "./App";
import "./styles/index.css";
import { getAccessToken, tauriInvoke } from "./lib/spotify";
import { isMockMode } from "./stores/auth";
import { enableMockMode } from "./lib/mock";

if (import.meta.env.VITE_SPX_MOCK === "1") {
  isMockMode.value = true;
  enableMockMode();
}

(window as any).requestMacOSNetworkPermission = async () => {
  console.log('[Permission] Requesting macOS local network access...');
  try {
    const result = await tauriInvoke('request_macos_local_network_permission');
    console.log('[Permission] Result:', result);
    console.log('[Permission] If a dialog appeared, click "Allow"');
  } catch (error) {
    console.error('[Permission] Error:', error);
  }
};

(window as any).testCastAuth = async (ip: string) => {
  console.log(`[Test] Starting Cast auth test for ${ip}`);
  try {
    const accessToken = getAccessToken();
    if (!accessToken) { console.error('[Test] No token available'); return; }
    console.log(`[Test] Token: ${accessToken.substring(0, 20)}...`);
    console.log('[Test] Calling authenticate_cast_device_raw_command...');
    const result = await tauriInvoke('authenticate_cast_device_raw_command', { ip, accessToken });
    console.log('[Test] Result:', result);
    console.log('[Test] Checking devices API...');
    const isBrowser = (window as any).__TAURI_INTERNALS__?.__is_spx_shim__ === true;
    const apiUrl = isBrowser ? '/spotify-api/v1/me/player/devices' : 'https://api.spotify.com/v1/me/player/devices';
    const resp = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await resp.json();
    console.log('[Test] Devices:', data.devices?.map((d: any) => `${d.name} (${d.id})`));
  } catch (error) {
    console.error('[Test] Error:', error);
  }
};

(window as any).testAllDevices = async () => {
  const devices = [
    { name: 'Living Room speaker (Nest Audio)', ip: '192.168.1.11' },
    { name: 'Living Room speaker (Nest Mini)', ip: '192.168.1.9' },
    { name: 'Mini2', ip: '192.168.1.14' },
    { name: 'Office', ip: '192.168.1.12' },
    { name: 'Bedroom display', ip: '192.168.1.12' },
  ];
  console.log('[TestAll] Testing all discovered devices...');
  for (const device of devices) {
    console.log(`\n[TestAll] ===== ${device.name} (${device.ip}) =====`);
    try {
      const diag = await tauriInvoke('diagnose_network', { ip: device.ip });
      console.log('[TestAll] Diagnostics:', diag);
      if ((diag as string).includes('Ping succeeded') || (diag as string).includes('TCP connect succeeded')) {
        console.log('[TestAll] Device is reachable! Trying auth...');
        const accessToken = getAccessToken();
        const result = await tauriInvoke('authenticate_cast_device_raw_command', { ip: device.ip, accessToken });
        console.log('[TestAll] Auth result:', result);
      }
    } catch (e) {
      console.error(`[TestAll] ${device.name} failed:`, e);
    }
  }
};

render(<App />, document.getElementById("root")!);
