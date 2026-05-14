import { signal, computed } from "@preact/signals";
import { invoke } from "@tauri-apps/api/core";
import { getAvailableDevices, scanLocalDevices, transferPlayback } from "../lib/spotify";
import type { SpotifyDevice, LocalDevice } from "../types";
import { currentDeviceId } from "../lib/playback";

export const availableDevices = signal<SpotifyDevice[]>([]);
export const localDevices = signal<LocalDevice[]>([]);
export const activeDevice = signal<SpotifyDevice | null>(null);
export const isScanning = signal(false);
export const scanError = signal<string | null>(null);

// The device the user has explicitly chosen (persists across refreshes)
export const selectedDeviceId = signal<string | null>(null);

// Whether we're currently transferring playback to a device
export const isTransferring = signal(false);

// ─── Computed ────────────────────────────────────────────────────────────────

// Merged view: all controllable devices (Spotify API devices + matched local devices)
export const allDevices = computed(() => {
  const spotify = availableDevices.value;
  const local = localDevices.value;

  // Start with Spotify API devices
  const merged: Array<SpotifyDevice & { isLocal?: boolean; localNote?: string; canTransfer?: boolean; needsWakeUp?: boolean; deviceIp?: string }> =
    spotify.map(d => ({ ...d, isLocal: false }));

  // Add local devices that aren't already in the Spotify list
  for (const ld of local) {
    if (ld.canTransfer && ld.id) {
      // Already covered by Spotify API - skip
      const exists = merged.some(d => d.id === ld.id);
      if (!exists) {
        merged.push({
          id: ld.id,
          name: ld.friendly_name || ld.name,
          type: "speaker",
          is_active: ld.is_active,
          is_restricted: false,
          isLocal: true,
          localNote: ld.note,
          canTransfer: true,
        });
      }
    } else {
      // Cast-only device - can wake up and transfer
      merged.push({
        id: ld.ip, // Use IP as ID for local-only devices
        name: ld.friendly_name || ld.name,
        type: ld.service_type?.includes("googlecast") ? "cast_video" : "speaker",
        is_active: false,
        is_restricted: false, // Cast devices CAN be used after wake-up
        isLocal: true,
        localNote: "Tap to connect",
        canTransfer: true,
        needsWakeUp: true,
        deviceIp: ld.ip,
      });
    }
  }

  return merged;
});

// The effective device ID for playback commands
// Priority: user-selected > active device > Web Playback SDK > first available
export const effectiveDeviceId = computed(() => {
  const selected = selectedDeviceId.value;
  const active = activeDevice.value;
  const devices = allDevices.value;

  if (selected && devices.some(d => d.id === selected)) {
    return selected;
  }
  if (active?.id) {
    return active.id;
  }
  // Fall back to Web Playback SDK device (SPX Player)
  if (currentDeviceId.value) {
    return currentDeviceId.value;
  }
  const first = devices.find(d => d.id && !d.is_restricted);
  return first?.id ?? null;
});

// ─── Concurrency Guards ──────────────────────────────────────────────────────

let activeScanPromise: Promise<void> | null = null;
let lastLocalScanAt = 0;
const LOCAL_SCAN_COOLDOWN_MS = 15_000; // Reduced from 30s to 15s
let devicePollingInterval: ReturnType<typeof setInterval> | null = null;

// ─── Device Polling ──────────────────────────────────────────────────────────

/**
 * Start polling Spotify API for device changes every 10s.
 * This keeps the device list fresh without user interaction.
 */
export function startDevicePolling(intervalMs = 10_000) {
  stopDevicePolling();
  devicePollingInterval = setInterval(() => {
    refreshSpotifyDevices().catch(console.warn);
  }, intervalMs);
  // Also do an immediate refresh
  refreshSpotifyDevices().catch(console.warn);
}

export function stopDevicePolling() {
  if (devicePollingInterval) {
    clearInterval(devicePollingInterval);
    devicePollingInterval = null;
  }
}

// ─── Device Selection ────────────────────────────────────────────────────────

/**
 * Wake up a Cast device by launching the Spotify receiver app.
 * Returns the IP address on success.
 */
async function wakeCastDevice(ip: string): Promise<string> {
  try {
    const result = await invoke<string>("wake_cast_device", { ip });
    console.log("[Devices] Cast device woken:", result);
    return result;
  } catch (error) {
    console.error("[Devices] Failed to wake Cast device:", error);
    throw new Error(`Failed to wake Cast device: ${error}`);
  }
}

/**
 * Select a device and transfer playback to it.
 * For Cast-only devices: wakes the device first, then transfers.
 * The current song continues playing on the new device.
 */
export async function selectDevice(deviceId: string, deviceIp?: string): Promise<boolean> {
  if (isTransferring.value) return false;

  isTransferring.value = true;
  selectedDeviceId.value = deviceId;

  try {
    // Check if this is a Cast-only device (needs wake-up)
    const device = allDevices.value.find(d => d.id === deviceId);
    const isCastOnly = device?.isLocal && (device?.needsWakeUp === true);

    if (isCastOnly && deviceIp) {
      // Wake up the Cast device first
      console.log("[Devices] Waking Cast device at", deviceIp);
      await wakeCastDevice(deviceIp);

      // Wait for the device to register with Spotify Connect
      // Poll every 500ms for up to 5 seconds
      let spotifyDeviceId: string | null = null;
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const data = await getAvailableDevices();
        const devices = data.devices ?? [];

        // Try to find the newly registered device by name
        const castDevice = allDevices.value.find(d => d.id === deviceId);
        const deviceName = castDevice?.name?.toLowerCase();

        const match = devices.find(d =>
          d.name?.toLowerCase() === deviceName ||
          (deviceName && d.name?.toLowerCase()?.includes(deviceName)) ||
          (deviceName && deviceName.includes(d.name?.toLowerCase() ?? ""))
        );

        if (match?.id) {
          spotifyDeviceId = match.id;
          break;
        }
      }

      if (!spotifyDeviceId) {
        throw new Error("Cast device did not appear in Spotify Connect. Please try again.");
      }

      // Update the device ID to the Spotify Connect ID
      selectedDeviceId.value = spotifyDeviceId;
      deviceId = spotifyDeviceId;
    }

    // Re-fetch devices before transfer to avoid stale IDs
    await refreshSpotifyDevices();

    // Verify the device still exists
    const currentDevices = availableDevices.value;
    const deviceExists = currentDevices.some(d => d.id === deviceId);

    if (!deviceExists) {
      // Device disappeared - try to find it by name
      const selectedDevice = allDevices.value.find(d => d.id === selectedDeviceId.value);
      const name = selectedDevice?.name?.toLowerCase();
      const match = currentDevices.find(d =>
        d.name?.toLowerCase() === name ||
        (name && d.name?.toLowerCase()?.includes(name))
      );

      if (match?.id) {
        // Device ID changed (ephemeral IDs) - use the new one
        selectedDeviceId.value = match.id;
        deviceId = match.id;
      } else {
        throw new Error("Device not found. It may have gone offline.");
      }
    }

    await transferPlayback(deviceId, true);

    // Refresh to get updated active device state
    await refreshSpotifyDevices();
    return true;
  } catch (error) {
    console.error("[Devices] Failed to transfer playback:", error);
    // Revert selection on failure
    selectedDeviceId.value = activeDevice.value?.id ?? null;
    return false;
  } finally {
    isTransferring.value = false;
  }
}

/**
 * Clear device selection (e.g., on logout)
 */
export function clearDeviceSelection() {
  selectedDeviceId.value = null;
  activeDevice.value = null;
  availableDevices.value = [];
  localDevices.value = [];
  stopDevicePolling();
}

// ─── Refresh Functions ───────────────────────────────────────────────────────

/**
 * Full refresh: both Spotify API + local mDNS scan
 */
export async function refreshDevices() {
  if (activeScanPromise) {
    return activeScanPromise;
  }

  activeScanPromise = (async () => {
    isScanning.value = true;
    scanError.value = null;

    try {
      const [spotifyDevices, local] = await Promise.all([
        getAvailableDevices(),
        scanLocalDevices(),
      ]);

      availableDevices.value = (spotifyDevices.devices ?? []).map(d => ({
        ...d,
        id: d.id ?? undefined,
        volume_percent: d.volume_percent ?? undefined,
      }));

      const active = spotifyDevices.devices?.find((d) => d.is_active) ?? null;
      if (active) {
        activeDevice.value = {
          ...active,
          id: active.id ?? undefined,
          volume_percent: active.volume_percent ?? undefined,
        };
      } else {
        activeDevice.value = null;
      }

      localDevices.value = local;
      lastLocalScanAt = Date.now();
    } catch (error) {
      console.error("Failed to refresh devices:", error);
      scanError.value = error instanceof Error ? error.message : "Failed to scan devices";
    } finally {
      isScanning.value = false;
      activeScanPromise = null;
    }
  })();

  return activeScanPromise;
}

/**
 * Fast refresh: Spotify API only (~200ms).
 * Used by play/pause, transfer, ensureActiveDevice.
 */
export async function refreshSpotifyDevices() {
  try {
    const data = await getAvailableDevices();
    availableDevices.value = (data.devices ?? []).map((d: any) => ({
      ...d,
      id: d.id ?? undefined,
      volume_percent: d.volume_percent ?? undefined,
    }));
    const active = (data.devices ?? []).find((d: any) => d.is_active) ?? null;
    activeDevice.value = active ? { ...active, id: active.id ?? undefined, volume_percent: active.volume_percent ?? undefined } : null;

    // If the selected device is no longer available, clear selection
    if (selectedDeviceId.value && !availableDevices.value.some(d => d.id === selectedDeviceId.value)) {
      selectedDeviceId.value = active?.id ?? null;
    }
  } catch (e) {
    console.warn('[Devices] API refresh failed:', e);
  }
}

/**
 * Slow refresh: mDNS network scan + Spotify API matching.
 * Matches local devices with Spotify Connect devices.
 */
export async function refreshLocalDevices(force = false) {
  if (activeScanPromise) {
    return activeScanPromise;
  }

  if (!force && Date.now() - lastLocalScanAt < LOCAL_SCAN_COOLDOWN_MS) {
    return;
  }

  activeScanPromise = (async () => {
    isScanning.value = true;
    try {
      const local = await scanLocalDevices();
      const spotifyData = await getAvailableDevices();
      const spotifyDevices = spotifyData.devices ?? [];

      const matched = local.map((device) => {
        const displayName = device.friendly_name || device.name;

        // Try matching by Spotify device ID first
        const byId = device.id ? spotifyDevices.find((sd) => sd.id === device.id) : null;

        // Then try exact name match
        const byName = spotifyDevices.find(
          (sd) => sd.name?.toLowerCase() === displayName.toLowerCase()
        );

        // Then try fuzzy name match (contains)
        const byFuzzyName = !byId && !byName ? spotifyDevices.find(
          (sd) => sd.name?.toLowerCase().includes(displayName.toLowerCase()) ||
                  displayName.toLowerCase().includes(sd.name?.toLowerCase() ?? "")
        ) : null;

        const spotifyMatch = byId || byName || byFuzzyName;

        if (spotifyMatch && spotifyMatch.id) {
          return {
            ...device,
            id: spotifyMatch.id,
            is_active: spotifyMatch.is_active,
            canTransfer: true,
            friendly_name: displayName,
          };
        } else {
          return {
            ...device,
            canTransfer: false,
            friendly_name: displayName,
            note: "Open Spotify on this device",
          };
        }
      });

      localDevices.value = matched;
      lastLocalScanAt = Date.now();
    } catch (e) {
      console.warn('[Devices] Local scan failed:', e);
    } finally {
      isScanning.value = false;
      activeScanPromise = null;
    }
  })();

  return activeScanPromise;
}