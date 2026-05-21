import { render } from "preact";
import App from "./App";
import "./styles/index.css";

// Expose test function globally for Cast auth debugging
import { invoke } from "@tauri-apps/api/core";
import { getAccessToken } from "./lib/spotify";
(window as any).testCastAuth = async (ip: string) => {
  console.log(`[Test] Starting Cast auth test for ${ip}`);
  try {
    const accessToken = getAccessToken();
    if (!accessToken) {
      console.error('[Test] No token available');
      return;
    }
    console.log(`[Test] Token: ${accessToken.substring(0, 20)}...`);
    
    // Run network diagnostics first
    console.log('[Test] Running network diagnostics...');
    const diag = await invoke('diagnose_network', { ip });
    console.log('[Test] Network diagnostics:\n', diag);
    
    // Try raw auth
    console.log('[Test] Calling authenticate_cast_device_raw_command...');
    const result = await invoke('authenticate_cast_device_raw_command', {
      ip,
      accessToken
    });
    console.log('[Test] Result:', result);
    
    // Check if device appears in API
    console.log('[Test] Checking devices API...');
    const resp = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const data = await resp.json();
    console.log('[Test] Devices:', data.devices?.map((d: any) => `${d.name} (${d.id})`));
    
  } catch (error) {
    console.error('[Test] Error:', error);
  }
};

render(<App />, document.getElementById("root")!);
