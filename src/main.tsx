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
      const diag = await invoke('diagnose_network', { ip: device.ip });
      console.log('[TestAll] Diagnostics:', diag);
      
      // If ping works, try auth
      if ((diag as string).includes('Ping succeeded') || (diag as string).includes('TCP connect succeeded')) {
        console.log('[TestAll] Device is reachable! Trying auth...');
        const accessToken = getAccessToken();
        const result = await invoke('authenticate_cast_device_raw_command', {
          ip: device.ip,
          accessToken
        });
        console.log('[TestAll] Auth result:', result);
      }
    } catch (e) {
      console.error(`[TestAll] ${device.name} failed:`, e);
    }
  }
};

render(<App />, document.getElementById("root")!);
