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

  console.log("[Devices] allDevices computed - spotify:", spotify.length, "local:", local.length);

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

  console.log("[Devices] allDevices returning:", merged.length, "devices");
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
  if (currentDeviceId) {
    return currentDeviceId;
  }
  const first = devices.find(d => d.id && !d.is_restricted);
  return first?.id ?? null;
});

// ─── Concurrency Guards ──────────────────────────────────────────────────────

let activeScanPromise: Promise<void> | null = null;
let lastLocalScanAt = 0;
const LOCAL_SCAN_COOLDOWN_MS = 15_000;
let devicePollingInterval: ReturnType<typeof setInterval> | null = null;

// ─── Device Polling ──────────────────────────────────────────────────────────

/**
 * Start polling devices every 10s.
 * Includes local mDNS scan on each poll.
 */
export function startDevicePolling(intervalMs = 10_000) {
  console.log("[Devices] startDevicePolling called");
  stopDevicePolling();
  devicePollingInterval = setInterval(() => {
    console.log("[Devices] Polling interval tick");
    refreshDevices({ includeLocal: true }).catch(console.warn);
  }, intervalMs);
  refreshDevices({ includeLocal: true }).catch(console.warn);
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
 */
async function wakeDevice(ip: string): Promise<string> {
  try {
    const result = await invoke<string>("wake_cast_device", { ip });
    console.log("[Devices] Cast device woken:", result);
    return result;
  } catch (error) {
    throw new Error(`Failed to wake Cast device: ${error}`);
  }
}

/**
 * Poll until a Cast device appears in Spotify Connect (max 5s).
 */
async function waitForDevice(deviceName: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const data = await getAvailableDevices();
    const match = data.devices?.find(d =>
      d.name?.toLowerCase() === deviceName ||
      (deviceName && d.name?.toLowerCase()?.includes(deviceName)) ||
      (deviceName && deviceName.includes(d.name?.toLowerCase() ?? ""))
    );
    if (match?.id) return match.id;
  }
  throw new Error("Cast device did not appear in Spotify Connect. Please try again.");
}

/**
 * Resolve device ID (handles Cast devices that need wake-up first).
 */
async function resolveDevice(deviceId: string, deviceIp?: string): Promise<string> {
  const device = allDevices.value.find(d => d.id === deviceId);
  const isCastOnly = device?.isLocal && device?.needsWakeUp === true;

  if (isCastOnly && deviceIp) {
    console.log("[Devices] Waking Cast device at", deviceIp);
    await wakeDevice(deviceIp);
    const deviceName = device?.name?.toLowerCase() ?? "";
    return await waitForDevice(deviceName);
  }
  return deviceId;
}

/**
 * Select a device and transfer playback to it.
 * For Cast-only devices: wakes the device first, then transfers.
 */
export async function selectDevice(deviceId: string, deviceIp?: string): Promise<boolean> {
  if (isTransferring.value) return false;

  isTransferring.value = true;
  selectedDeviceId.value = deviceId;

  try {
    // Resolve Cast devices to Spotify Connect IDs
    const resolvedId = await resolveDevice(deviceId, deviceIp);
    selectedDeviceId.value = resolvedId;

    // Re-fetch devices before transfer
    await refreshSpotifyDevices();

    // Verify device still exists
    let currentDevices = availableDevices.value;
    if (!currentDevices.some(d => d.id === resolvedId)) {
      const name = allDevices.value.find(d => d.id === resolvedId)?.name?.toLowerCase();
      const match = currentDevices.find(d =>
        d.name?.toLowerCase() === name ||
        (name && d.name?.toLowerCase()?.includes(name))
      );
      if (match?.id) {
        selectedDeviceId.value = match.id;
      } else {
        throw new Error("Device not found. It may have gone offline.");
      }
    }

    await transferPlayback(selectedDeviceId.value, true);
    await refreshSpotifyDevices();
    return true;
  } catch (error) {
    console.error("[Devices] Failed to transfer playback:", error);
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

export interface RefreshDevicesOptions {
  /** Bypass local scan cooldown */
  force?: boolean;
  /** Also scan mDNS for local Cast devices */
  includeLocal?: boolean;
}

/**
 * Unified device refresh.
 * - Always fetches Spotify Connect devices
 * - Optionally scans mDNS for local Cast devices
 */
export async function refreshDevices(options: RefreshDevicesOptions = {}): Promise<void> {
  const { force = false, includeLocal = false } = options;

  if (activeScanPromise) {
    return activeScanPromise;
  }

  const shouldScanLocal = includeLocal && (force || Date.now() - lastLocalScanAt >= LOCAL_SCAN_COOLDOWN_MS);
  console.log("[Devices] shouldScanLocal:", shouldScanLocal, "includeLocal:", includeLocal, "force:", force, "timeSinceLastScan:", Date.now() - lastLocalScanAt);

  activeScanPromise = (async () => {
    isScanning.value = true;
    scanError.value = null;

    try {
      // Fetch Spotify devices (always)
      const spotifyData = await getAvailableDevices();
      const spotifyDevices = spotifyData.devices ?? [];

      availableDevices.value = spotifyDevices.map(d => ({
        ...d,
        id: d.id ?? undefined,
        volume_percent: d.volume_percent ?? undefined,
      }));

      const active = spotifyDevices.find(d => d.is_active) ?? null;
      activeDevice.value = active
        ? { ...active, id: active.id ?? undefined, volume_percent: active.volume_percent ?? undefined }
        : null;

      // If selected device disappeared, fall back to active
      if (selectedDeviceId.value && !availableDevices.value.some(d => d.id === selectedDeviceId.value)) {
        selectedDeviceId.value = active?.id ?? null;
      }

      // Optionally scan local devices
      if (shouldScanLocal) {
        const local = await scanLocalDevices();
        console.log("[Devices] scanLocalDevices returned:", local.length, "devices");
        const matched = local.map((device) => {
          const displayName = device.friendly_name || device.name;
          const byId = device.id ? spotifyDevices.find(sd => sd.id === device.id) : null;
          const byName = spotifyDevices.find(sd => sd.name?.toLowerCase() === displayName.toLowerCase());
          const byFuzzyName = !byId && !byName
            ? spotifyDevices.find(sd =>
                sd.name?.toLowerCase().includes(displayName.toLowerCase()) ||
                displayName.toLowerCase().includes(sd.name?.toLowerCase() ?? "")
              )
            : null;
          const spotifyMatch = byId || byName || byFuzzyName;

          if (spotifyMatch?.id) {
            return { ...device, id: spotifyMatch.id, is_active: spotifyMatch.is_active, canTransfer: true, friendly_name: displayName };
          } else {
            return { ...device, canTransfer: false, friendly_name: displayName, note: "Open Spotify on this device" };
          }
        });
        localDevices.value = matched;
        lastLocalScanAt = Date.now();
      }
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
 * Fast refresh: Spotify API only.
 * @deprecated Use refreshDevices() instead
 */
export async function refreshSpotifyDevices(): Promise<void> {
  await refreshDevices();
}

/**
 * Force local device scan.
 * @deprecated Use refreshDevices({ includeLocal: true, force: true }) instead
 */
export async function refreshLocalDevices(force = false): Promise<void> {
  console.log("[Devices] refreshLocalDevices called, force:", force);
  await refreshDevices({ includeLocal: true, force });
}