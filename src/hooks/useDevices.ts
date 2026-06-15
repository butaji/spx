import { useCallback } from "preact/compat";
import {
  refreshSpotifyDevices,
  refreshLocalDevices,
  availableDevices,
  allDevices,
  selectedDeviceId,
  selectDevice,
} from "../stores/devices";
import { transferPlayback } from "../lib/spotify";
import { currentDeviceId } from "../lib/playback";
import { handleDeviceError, setDeviceStatus } from "../stores/notifications";

export function useDevices() {
  const ensureActiveDevice = useCallback(async () => {
    // Refresh Spotify API devices first (fast).
    try {
      await refreshSpotifyDevices();
    } catch (e) {
      console.error("[useDevices] Failed to refresh devices:", e);
      handleDeviceError(e, "Device Refresh");
      setDeviceStatus("error");
      return null;
    }

    // If the Spotify API has no devices, force a local mDNS scan so Cast and
    // Spotify Connect devices on the LAN get a chance to show up.
    if (availableDevices.value.length === 0) {
      console.log("[useDevices] No Spotify API devices, scanning local network...");
      try {
        await refreshLocalDevices(true);
        // Give discovered devices a moment to register with Spotify's API.
        await new Promise((r) => setTimeout(r, 1500));
        await refreshSpotifyDevices();
      } catch (e) {
        console.warn("[useDevices] Local scan failed:", e);
      }
    }

    // Use the merged device list (Spotify API + local Cast devices + SPX Player).
    const devices = allDevices.value;

    // If a device is already active, use it.
    const active = devices.find((d) => d.is_active);
    if (active?.id) {
      setDeviceStatus("available");
      return active.id;
    }

    // Respect an explicit user selection if it still exists.
    const selected = selectedDeviceId.value
      ? devices.find((d) => d.id === selectedDeviceId.value)
      : null;
    if (selected?.id) {
      if (!selected.is_active) {
        try {
          await transferPlayback(selected.id, false);
        } catch (e) {
          console.warn("[useDevices] Failed to transfer to selected device:", e);
        }
      }
      setDeviceStatus("available");
      return selected.id;
    }

    // Prefer an already-known Spotify Connect device if one exists.
    const spotifyDevice = devices.find((d) => !d.isLocal && d.id && d.name !== "SPX Player");
    if (spotifyDevice?.id) {
      console.log("[useDevices] Using Spotify Connect device:", spotifyDevice.name);
      try {
        await transferPlayback(spotifyDevice.id, false);
        setDeviceStatus("available");
        return spotifyDevice.id;
      } catch (e) {
        console.warn("[useDevices] Failed to transfer to Spotify device:", e);
        handleDeviceError(e, "Device Transfer");
      }
    }

    // SPX Player is the guaranteed fallback — it runs on this machine.
    const spx = devices.find((d) => d.name === "SPX Player" || d.id === currentDeviceId);
    if (spx?.id) {
      console.log("[useDevices] Activating SPX Player...");
      try {
        await transferPlayback(spx.id, false);
      } catch (e) {
        console.warn("[useDevices] Failed to activate SPX Player:", e);
        handleDeviceError(e, "SPX Player Activation");
      }
      setDeviceStatus("available");
      return spx.id;
    }

    // If the Web Playback SDK hasn't connected yet, wait for it.
    if (!currentDeviceId) {
      console.log("[useDevices] Waiting for SPX in-app player to connect...");
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (currentDeviceId) break;
      }
    }

    if (currentDeviceId) {
      console.log("[useDevices] Using SPX in-app player:", currentDeviceId);
      setDeviceStatus("available");
      return currentDeviceId;
    }

    // Absolute last resort: try any other available device (e.g. Cast-only).
    const any = devices.find((d) => d.id && !d.is_restricted && d.name !== "SPX Player");
    if (any?.id) {
      console.log("[useDevices] Selecting device:", any.name, any.id);
      const deviceIp = (any as any).deviceIp as string | undefined;
      const result = await selectDevice(any.id, deviceIp);
      if (result.success) {
        setDeviceStatus("available");
        return any.id;
      }
      console.warn("[useDevices] Failed to select device:", result.error);
      handleDeviceError(new Error(result.error || "Device selection failed"), "Device Selection");
    }

    // No devices available at all (should be rare because SPX Player is always present once ready).
    setDeviceStatus("none");
    return null;
  }, []);

  return {
    ensureActiveDevice,
  };
}
