import { useCallback, useEffect } from "preact/compat";
import { ensureActiveDevice } from "../lib/deviceManager";
import { refreshSpotifyDevices, refreshLocalDevices } from "../stores/devices";

export function useDevices() {
  const ensureActiveDeviceCallback = useCallback(ensureActiveDevice, []);

  // Immediately refresh devices on mount to ensure they appear quickly
  useEffect(() => {
    refreshSpotifyDevices().catch(console.warn);
    refreshLocalDevices(true).catch(console.warn);
  }, []);

  return {
    ensureActiveDevice: ensureActiveDeviceCallback,
  };
}
