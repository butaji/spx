import { useCallback, useEffect } from "preact/compat";
import {
  refreshSpotifyDevices,
  startDevicePolling,
  stopDevicePolling,
  availableDevices,
} from "../stores/devices";
import { transferPlayback } from "../lib/spotify";

export function useDevices() {
  console.log("[Devices] useDevices hook initialized");
  // Start device polling on mount
  useEffect(() => {
    console.log("[Devices] useDevices useEffect running");
    startDevicePolling();
    return () => stopDevicePolling();
  }, []);

  const ensureActiveDevice = useCallback(async () => {
    // Refresh device list
    await refreshSpotifyDevices();

    const devices = availableDevices.value;

    // Check if any device is already active
    const active = devices.find(d => d.is_active);
    if (active?.id) {
      return active.id;
    }

    // Try SPX Player
    const spx = devices.find(d => d.name === 'SPX Player');
    if (spx?.id) {
      console.log('[Play] Activating SPX Player...');
      try {
        await transferPlayback(spx.id, false);
        // Poll until active
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 500));
          await refreshSpotifyDevices();
          if (availableDevices.value.find(d => d.is_active)?.id === spx.id) {
            return spx.id;
          }
        }
      } catch (e) {
        console.warn('Failed to activate SPX Player:', e);
      }
    }

    // Try any other device
    const any = devices[0];
    if (any?.id) {
      try {
        await transferPlayback(any.id, false);
        return any.id;
      } catch (e) {
        console.warn('Failed to activate device:', e);
      }
    }

    return null;
  }, []);

  return {
    ensureActiveDevice,
  };
}
