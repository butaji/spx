import { useCallback } from "preact/compat";
import {
  refreshSpotifyDevices,
  availableDevices,
} from "../stores/devices";
import { transferPlayback } from "../lib/spotify";
import { handleDeviceError, setDeviceStatus } from "../stores/notifications";

export function useDevices() {
  const ensureActiveDevice = useCallback(async () => {
    // Refresh device list
    try {
      await refreshSpotifyDevices();
    } catch (e) {
      console.error("[useDevices] Failed to refresh devices:", e);
      handleDeviceError(e, "Device Refresh");
      setDeviceStatus("error");
      return null;
    }

    const devices = availableDevices.value;

    // Update device status
    if (devices.length === 0) {
      setDeviceStatus("none");
      return null;
    }

    // Check if any device is already active
    const active = devices.find(d => d.is_active);
    if (active?.id) {
      setDeviceStatus("available");
      return active.id;
    }

    // Try SPX Player
    const spx = devices.find(d => d.name === 'SPX Player');
    if (spx?.id) {
      console.log('[Play] Activating SPX Player...');
      try {
        await transferPlayback(spx.id, false);
        setDeviceStatus("available");
        
        // Poll until active
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 500));
          await refreshSpotifyDevices();
          if (availableDevices.value.find(d => d.is_active)?.id === spx.id) {
            return spx.id;
          }
        }
        
        // If not active after polling, still return the device ID
        return spx.id;
      } catch (e) {
        console.warn('[useDevices] Failed to activate SPX Player:', e);
        handleDeviceError(e, "SPX Player Activation");
      }
    }

    // Try any other device
    const any = devices[0];
    if (any?.id) {
      try {
        await transferPlayback(any.id, false);
        setDeviceStatus("available");
        return any.id;
      } catch (e) {
        console.warn('[useDevices] Failed to activate device:', e);
        handleDeviceError(e, "Device Transfer");
      }
    }

    // No devices available
    setDeviceStatus("none");
    return null;
  }, []);

  return {
    ensureActiveDevice,
  };
}
