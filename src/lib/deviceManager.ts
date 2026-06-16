import {
  refreshSpotifyDevices,
  refreshLocalDevices,
  availableDevices,
  allDevices,
  selectedDeviceId,
  selectDevice,
  isTransferring,
} from "../stores/devices";
import { transferPlayback } from "./spotify";
import { currentDeviceId, waitForDeviceId } from "./playback";
import { handleDeviceError, setDeviceStatus } from "../stores/notifications";

const SPX_PLAYER_NAME = "SPX Player";

/**
 * Ensure there is an active device available for playback commands.
 * Priority:
 * 1. Already-active device
 * 2. User-selected device (with transfer)
 * 3. Any available Spotify Connect device
 * 4. In-app SPX Player (with wait if not ready yet)
 * 5. Any other available device (e.g. Cast-only)
 *
 * Returns the device ID or null if nothing is available.
 */
export async function ensureActiveDevice(): Promise<string | null> {
  // Refresh Spotify API devices first (fast).
  try {
    await refreshSpotifyDevices();
  } catch (e) {
    console.error("[ensureActiveDevice] Failed to refresh devices:", e);
    handleDeviceError(e, "Device Refresh");
    setDeviceStatus("error");
    return null;
  }

  // If the Spotify API has no devices, force a local mDNS scan so Cast and
  // Spotify Connect devices on the LAN get a chance to show up.
  if (availableDevices.value.length === 0) {
    console.log("[ensureActiveDevice] No Spotify API devices, scanning local network...");
    try {
      await refreshLocalDevices(true);
      // Give discovered devices a moment to register with Spotify's API.
      await new Promise((r) => setTimeout(r, 1500));
      await refreshSpotifyDevices();
    } catch (e) {
      console.warn("[ensureActiveDevice] Local scan failed:", e);
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
    if (isTransferring.value) {
      // Another transfer is already in progress; return the selected id optimistically.
      return selected.id;
    }
    try {
      const result = await selectDevice(selected.id, (selected as any).deviceIp as string | undefined);
      if (result.success) {
        setDeviceStatus("available");
        return selected.id;
      }
      console.warn("[ensureActiveDevice] Failed to transfer to selected device:", result.error);
      handleDeviceError(new Error(result.error || "Selected device unavailable"), "Device Transfer");
    } catch (e) {
      console.warn("[ensureActiveDevice] Failed to transfer to selected device:", e);
      handleDeviceError(e, "Device Transfer");
    }
  }

  // Prefer an already-known Spotify Connect device if one exists.
  const spotifyDevice = devices.find((d) => !d.isLocal && d.id && d.name !== SPX_PLAYER_NAME);
  if (spotifyDevice?.id) {
    console.log("[ensureActiveDevice] Using Spotify Connect device:", spotifyDevice.name);
    try {
      await transferPlayback(spotifyDevice.id, false);
      setDeviceStatus("available");
      return spotifyDevice.id;
    } catch (e) {
      console.warn("[ensureActiveDevice] Failed to transfer to Spotify device:", e);
      handleDeviceError(e, "Device Transfer");
    }
  }

  // SPX Player is the guaranteed fallback — it runs on this machine.
  const spx = devices.find((d) => d.name === SPX_PLAYER_NAME || d.id === currentDeviceId);
  if (spx?.id) {
    console.log("[ensureActiveDevice] Activating SPX Player...");
    try {
      await transferPlayback(spx.id, false);
    } catch (e) {
      console.warn("[ensureActiveDevice] Failed to activate SPX Player:", e);
      handleDeviceError(e, "SPX Player Activation");
    }
    setDeviceStatus("available");
    return spx.id;
  }

  // If the Web Playback SDK hasn't connected yet, wait for it.
  if (!currentDeviceId) {
    console.log("[ensureActiveDevice] Waiting for SPX in-app player to connect...");
    const spxId = await waitForDeviceId(10000);
    if (spxId) {
      console.log("[ensureActiveDevice] Using SPX in-app player:", spxId);
      try {
        await transferPlayback(spxId, false);
      } catch (e) {
        console.warn("[ensureActiveDevice] Failed to activate SPX Player:", e);
        handleDeviceError(e, "SPX Player Activation");
      }
      setDeviceStatus("available");
      return spxId;
    }
  }

  if (currentDeviceId) {
    console.log("[ensureActiveDevice] Using SPX in-app player:", currentDeviceId);
    setDeviceStatus("available");
    return currentDeviceId;
  }

  // Absolute last resort: try any other available device (e.g. Cast-only).
  const any = devices.find((d) => d.id && !d.is_restricted && d.name !== SPX_PLAYER_NAME);
  if (any?.id) {
    console.log("[ensureActiveDevice] Selecting device:", any.name, any.id);
    const deviceIp = (any as any).deviceIp as string | undefined;
    const result = await selectDevice(any.id, deviceIp);
    if (result.success) {
      setDeviceStatus("available");
      return any.id;
    }
    console.warn("[ensureActiveDevice] Failed to select device:", result.error);
    handleDeviceError(new Error(result.error || "Device selection failed"), "Device Selection");
  }

  // No devices available at all (should be rare because SPX Player is always present once ready).
  setDeviceStatus("none");
  return null;
}
