import { signal } from "@preact/signals";
import { getAvailableDevices, scanLocalDevices } from "../lib/spotify";
import type { SpotifyDevice, LocalDevice } from "../types";

export const availableDevices = signal<SpotifyDevice[]>([]);
export const localDevices = signal<LocalDevice[]>([]);
export const activeDevice = signal<SpotifyDevice | null>(null);
export const isScanning = signal(false);
export const scanError = signal<string | null>(null);

// Concurrency guards + cooldown for expensive mDNS scans
let activeScanPromise: Promise<void> | null = null;
let lastLocalScanAt = 0;
const LOCAL_SCAN_COOLDOWN_MS = 30_000; // minimum 30s between scans

export async function refreshDevices() {
  // If already scanning, wait for it instead of starting a new one
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

      // Find active device from Spotify devices
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
 * Does NOT run the 6-second mDNS scan.
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
  } catch (e) {
    console.warn('[Devices] API refresh failed:', e);
  }
}

/**
 * Slow refresh: mDNS network scan + Spotify API matching (~6s).
 * Used by device picker + app init.
 * Matches mDNS devices with Spotify API devices to determine transfer capability.
 */
export async function refreshLocalDevices(force = false) {
  // Skip if already running
  if (activeScanPromise) {
    return activeScanPromise;
  }

  // Respect cooldown unless forced
  if (!force && Date.now() - lastLocalScanAt < LOCAL_SCAN_COOLDOWN_MS) {
    return;
  }

  activeScanPromise = (async () => {
    isScanning.value = true;
    try {
      const local = await scanLocalDevices();

      // Fetch Spotify devices to match against
      const spotifyData = await getAvailableDevices();
      const spotifyDevices = spotifyData.devices ?? [];

      // Match local mDNS devices with Spotify Connect devices
      const matched = local.map((device) => {
        // Try to find a Spotify device by ID or by name similarity
        const byId = spotifyDevices.find((sd) => sd.id === device.id);
        const byName = spotifyDevices.find(
          (sd) => sd.name?.toLowerCase() === device.name.toLowerCase()
        );
        const spotifyMatch = byId || byName;

        if (spotifyMatch && spotifyMatch.id) {
          // Has Spotify Connect — can transfer
          return {
            ...device,
            id: spotifyMatch.id, // prefer Spotify device ID
            is_active: spotifyMatch.is_active,
            canTransfer: true,
          };
        } else {
          // Google Cast or other Cast-only device — cannot transfer directly
          return {
            ...device,
            canTransfer: false,
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
