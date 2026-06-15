import { signal, computed } from "@preact/signals";
import { getAvailableDevices, scanLocalDevices, transferPlayback, getAccessToken, tauriInvoke, setVolume, pause } from "../lib/spotify";
import type { SpotifyDevice, LocalDevice } from "../types";
import { currentDeviceId } from "../lib/playback";
import { playbackVolume } from "../stores/playback";
import { debug } from "../lib/utils";

export const availableDevices = signal<SpotifyDevice[]>([]);
export const localDevices = signal<LocalDevice[]>([]);
export const activeDevice = signal<SpotifyDevice | null>(null);
export const isScanning = signal(false);
export const scanError = signal<string | null>(null);

// The device the user has explicitly chosen (persists across refreshes)
export const selectedDeviceId = signal<string | null>(null);

// Whether we're currently transferring playback to a device
export const isTransferring = signal(false);

// ─── Mute State ────────────────────────────────────────────────────────────

// Volume before mute (for restore) - module-level for persistence across operations
let previousVolume = 100;

// Mute state tracking (for UI display)
export const isMuted = signal(false);

/**
 * Toggle mute state, preserving previous volume
 */
export async function toggleMute(): Promise<void> {
  const currentVol = playbackVolume.value;
  
  if (currentVol > 0 || isMuted.value) {
    if (isMuted.value) {
      // Unmute: restore previous volume
      isMuted.value = false;
      await setVolume(previousVolume, effectiveDeviceId.value ?? undefined);
    } else {
      // Mute: save current volume and set to 0
      previousVolume = currentVol > 0 ? currentVol : previousVolume;
      isMuted.value = true;
      await setVolume(0, effectiveDeviceId.value ?? undefined);
    }
  }
}

/**
 * Set mute state explicitly
 */
export async function setMuteState(muted: boolean): Promise<void> {
  if (muted === isMuted.value) return;
  
  if (muted) {
    previousVolume = playbackVolume.value > 0 ? playbackVolume.value : previousVolume;
    isMuted.value = true;
    await setVolume(0, effectiveDeviceId.value ?? undefined);
  } else {
    isMuted.value = false;
    await setVolume(previousVolume, effectiveDeviceId.value ?? undefined);
  }
}

// ─── Computed ────────────────────────────────────────────────────────────────

// Merged view: all controllable devices (Spotify API devices + matched local devices)
export const allDevices = computed(() => {
  const spotify = availableDevices.value;
  const local = localDevices.value;



  // Start with Spotify API devices
  const merged: Array<SpotifyDevice & { isLocal?: boolean; localNote?: string; canTransfer?: boolean; needsWakeUp?: boolean; deviceIp?: string }> =
    spotify.map(d => ({ ...d, isLocal: false, canTransfer: true }));

  // Inject the in-app SPX Player as a guaranteed device if it has a device ID
  // but Spotify's API hasn't returned it yet (e.g. right after connect).
  if (currentDeviceId && !merged.some(d => d.id === currentDeviceId)) {
    merged.unshift({
      id: currentDeviceId,
      name: "SPX Player",
      type: "computer",
      is_active: false,
      is_restricted: false,
      isLocal: false,
      canTransfer: true,
    });
  }

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
      // Cast-only device - check if Spotify already has a matching device (by name)
      const displayName = ld.friendly_name || ld.name;
      const fuzzyMatch = merged.find(d =>
        d.name?.toLowerCase().includes(displayName.toLowerCase()) ||
        displayName.toLowerCase().includes(d.name?.toLowerCase() ?? "")
      );
      // Skip if Spotify already exposes this device under a similar name
      if (fuzzyMatch) {
        continue;
      }
      // Cast-only device - can wake up and transfer
      merged.push({
        id: ld.ip, // Use IP as ID for local-only devices
        name: displayName,
        type: ld.service_type?.includes("googlecast") ? "cast_video" : "speaker",
        is_active: false,
        is_restricted: false, // Cast devices CAN be used after wake-up
        isLocal: true,
        localNote: "Wake this speaker to control it from SPX",
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
  if (currentDeviceId) {
    return currentDeviceId;
  }
  const first = devices.find(d => d.id && !d.is_restricted);
  return first?.id ?? null;
});

// ─── Concurrency Guards ──────────────────────────────────────────────────────

let activeScanPromise: Promise<void> | null = null;
let activeScanOptions: RefreshDevicesOptions | null = null;
let lastLocalScanAt = 0;
const LOCAL_SCAN_COOLDOWN_MS = 15_000;

/**
 * Resets all module-level state. Used by tests to ensure clean state between tests.
 */
export function __resetDeviceStore() {
  availableDevices.value = [];
  localDevices.value = [];
  activeDevice.value = null;
  isScanning.value = false;
  scanError.value = null;
  isTransferring.value = false;
  selectedDeviceId.value = null;
  isMuted.value = false;
  previousVolume = 100;
  lastLocalScanAt = 0;
  activeScanPromise = null;
}
let devicePollingInterval: ReturnType<typeof setInterval> | null = null;

// ─── Device Polling ──────────────────────────────────────────────────────────

/**
 * Start polling devices every 10s.
 * Includes local mDNS scan on each poll.
 */
export function startDevicePolling(intervalMs = 10_000) {
  if (devicePollingInterval) {
    // Already polling; avoid duplicate intervals.
    return;
  }
  devicePollingInterval = setInterval(() => {
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
    const result = await Promise.race([
      tauriInvoke<string>("wake_cast_device", { ip }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Cast device wake timed out after 15 seconds")), 15000)
      )
    ]);

    return result;
  } catch (error) {
    throw new Error(`Failed to wake Cast device: ${error}`);
  }
}

/**
 * Authenticate a Cast device with Spotify using the proper protocol.
 * Tries raw auth first (with correct Spotify userAgent), falls back to old method.
 */
async function authenticateCastDevice(ip: string, deviceName: string): Promise<string> {
  try {
    const token = getAccessToken();
    if (!token) {
      throw new Error("No access token available");
    }
    
    // Try new raw protocol with proper Spotify CONNECT message
    console.log(`[authenticateCastDevice] Trying raw auth for ${deviceName} at ${ip}`);
    try {
      const result = await Promise.race([
        tauriInvoke<string>("authenticate_cast_device_raw_command", { 
          ip, 
          accessToken: token
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Raw Cast auth timed out after 45 seconds")), 45000)
        )
      ]);
      console.log(`[authenticateCastDevice] Raw auth succeeded: ${result}`);
      return result;
    } catch (rawError) {
      console.log(`[authenticateCastDevice] Raw auth failed: ${rawError}, falling back to old method`);
    }
    
    // Fallback to old method
    const result = await Promise.race([
      tauriInvoke<string>("authenticate_cast_device_command", { 
        ip, 
        accessToken: token,
        deviceName
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Cast auth timed out after 30 seconds")), 30000)
      )
    ]);

    return result;
  } catch (error) {
    throw new Error(`Failed to authenticate Cast device: ${error}`);
  }
}

/**
 * Poll until a Cast device appears in Spotify Connect (max 30s).
 * Progressively reports waiting state to caller via onStatus callback.
 */
async function waitForDevice(
  deviceName: string,
  onStatus?: (msg: string) => void
): Promise<string> {
  console.log(`[waitForDevice] Starting poll for "${deviceName}"`);
  // Poll every 1s for up to 15s - if device doesn't appear quickly, it likely won't at all
  // (Spotify API limitation with some Cast devices)
  for (let i = 0; i < 15; i++) {
    if (i === 3) onStatus?.("Waiting for Spotify to register...");
    if (i === 8) onStatus?.("Still waiting...");
    await new Promise(resolve => setTimeout(resolve, 1000));
    const data = await getAvailableDevices();
    console.log(`[waitForDevice] Poll ${i + 1}/15: API returned ${data.devices?.length ?? 0} devices`);
    if (data.devices?.length) {
      console.log(`[waitForDevice] Device names: ${data.devices.map((d: any) => `"${d.name}" (id=${d.id?.slice(0, 8)}...)`).join(', ')}`);
    }

    // Try multiple matching strategies
    const targetName = deviceName.toLowerCase();

    // 1. Exact match
    let match = data.devices?.find((d: any) => d.name?.toLowerCase() === targetName);

    // 2. Substring match (device name contains target)
    if (!match) {
      match = data.devices?.find((d: any) => d.name?.toLowerCase().includes(targetName));
    }

    // 3. Substring match (target contains device name)
    if (!match) {
      match = data.devices?.find((d: any) => targetName.includes(d.name?.toLowerCase() ?? ""));
    }

    // 4. Word-by-word match (for "Living Room speaker" vs "Living Room")
    if (!match && targetName.includes(" ")) {
      const words = targetName.split(" ").filter(w => w.length > 2);
      match = data.devices?.find((d: any) => {
        const deviceWords = d.name?.toLowerCase().split(" ") ?? [];
        return words.some(w => deviceWords.includes(w));
      });
    }

    if (match?.id) {
      console.log(`[waitForDevice] MATCHED: "${match.name}" with id=${match.id}`);
      return match.id;
    }
  }
  console.log(`[waitForDevice] TIMEOUT: "${deviceName}" never appeared in Spotify API`);
  throw new Error("This speaker isn't visible to the Spotify Web API yet. Select the SPX Player or another available device, then try again.");
}

/**
 * Resolve device ID (handles Cast devices that need wake-up first).
 * Pre-checks availableDevices before waking. Entire operation is wrapped in a 20s timeout.
 */
async function resolveDevice(
  deviceId: string,
  deviceIp?: string,
  onStatus?: (msg: string) => void
): Promise<string> {
  const device = allDevices.value.find(d => d.id === deviceId);
  const isCastOnly = device?.isLocal && device?.needsWakeUp === true;
  console.log(`[resolveDevice] deviceId=${deviceId}, isCastOnly=${isCastOnly}, deviceIp=${deviceIp}, name="${device?.name}"`);

  if (isCastOnly && deviceIp) {
    const deviceName = device?.name?.toLowerCase() ?? "";

    // Pre-check: skip wake if device already exists in Spotify's device list
    const alreadyExists = availableDevices.value.some(d =>
      d.name?.toLowerCase() === deviceName ||
      (deviceName && d.name?.toLowerCase()?.includes(deviceName))
    );
    console.log(`[resolveDevice] Pre-check: alreadyExists=${alreadyExists}, availableDevices=${availableDevices.value.length}`);
    if (availableDevices.value.length) {
      console.log(`[resolveDevice] Available: ${availableDevices.value.map(d => `"${d.name}"`).join(', ')}`);
    }

    if (alreadyExists) {
      const match = availableDevices.value.find(d =>
        d.name?.toLowerCase() === deviceName ||
        (deviceName && d.name?.toLowerCase()?.includes(deviceName))
      );
      console.log(`[resolveDevice] Pre-check MATCH: using Spotify id=${match?.id}`);
      return match?.id ?? deviceId;
    }

    // Wrap in 60s timeout (wake takes ~3-5s + auth ~10s + polling up to 15s)
    return await Promise.race([
      (async () => {
        onStatus?.("Device is starting up...");
        console.log(`[resolveDevice] Calling wakeDevice(${deviceIp})...`);
        await wakeDevice(deviceIp);
        console.log(`[resolveDevice] Wake done, now polling for "${deviceName}"...`);
        
        try {
          return await waitForDevice(deviceName, onStatus);
        } catch (e) {
          // Device didn't appear after wake - try authenticating it
          console.log(`[resolveDevice] Device not in API after wake, trying Cast auth...`);
          onStatus?.("Authenticating with Spotify...");
          await authenticateCastDevice(deviceIp, device?.name ?? "");
          console.log(`[resolveDevice] Auth done, polling again...`);
          return await waitForDevice(deviceName, onStatus);
        }
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Device didn't appear in Spotify. Select the SPX Player or another available device.")), 60_000)
      )
    ]);
  }
  return deviceId;
}

/**
 * Select a device and transfer playback to it.
 * For Cast-only devices: wakes the device first, then transfers.
 * Returns the actual error message so the UI can show something useful.
 */
export async function selectDevice(deviceId: string, deviceIp?: string): Promise<{ success: boolean; error?: string }> {
  if (isTransferring.value) return { success: false, error: "Transfer already in progress" };

  isTransferring.value = true;
  selectedDeviceId.value = deviceId;
  console.log(`[selectDevice] Starting transfer to deviceId=${deviceId}, deviceIp=${deviceIp}`);

  // Safety net: force-reset isTransferring after 65s no matter what
  const safetyTimer = setTimeout(() => {
    if (isTransferring.value) {
      console.warn("[Devices] Safety timer reset isTransferring");
      isTransferring.value = false;
    }
  }, 65_000);

  let statusMessage = "";
  const onStatus = (msg: string) => { statusMessage = msg; };

  try {
    // Resolve Cast devices to Spotify Connect IDs (40s timeout inside)
    const resolvedId = await resolveDevice(deviceId, deviceIp, onStatus);
    console.log(`[selectDevice] Resolved to id=${resolvedId}`);
    selectedDeviceId.value = resolvedId;

    // Re-fetch devices before transfer
    await refreshSpotifyDevices();

    // Verify device still exists
    let currentDevices = availableDevices.value;
    console.log(`[selectDevice] Current API devices: ${currentDevices.length}`);
    if (!currentDevices.some(d => d.id === resolvedId)) {
      const name = allDevices.value.find(d => d.id === resolvedId)?.name?.toLowerCase();
      const match = currentDevices.find(d =>
        d.name?.toLowerCase() === name ||
        (name && d.name?.toLowerCase()?.includes(name))
      );
      if (match?.id) {
        console.log(`[selectDevice] Found match by name: ${match.id}`);
        selectedDeviceId.value = match.id;
      } else {
        console.log(`[selectDevice] Device ${resolvedId} not found in API after refresh`);
        return { success: false, error: "Device went offline. Select SPX Player or another available device." };
      }
    }

    console.log(`[selectDevice] Calling transferPlayback(${selectedDeviceId.value})...`);
    await transferPlayback(selectedDeviceId.value, true);
    console.log(`[selectDevice] Transfer succeeded!`);
    await refreshSpotifyDevices();
    return { success: true };
  } catch (error: any) {
    console.error("[Devices] Failed to transfer playback:", error);
    selectedDeviceId.value = activeDevice.value?.id ?? null;

    const msg = error?.message || String(error);
    if (statusMessage && !msg.includes("didn't respond") && !msg.includes("didn't appear") && !msg.includes("isn't visible") && !msg.includes("Failed to authenticate")) {
      // Return the staged status message if set (e.g. "Waiting for Spotify to register...")
      return { success: false, error: statusMessage };
    }
    if (msg.includes("isn't visible") || msg.includes("Spotify is not running")) {
      return { success: false, error: "This speaker needs to be activated. Select the SPX Player to play here, or start playback on the speaker from SPX." };
    }
    if (msg.includes("403") || msg.includes("Premium")) {
      return { success: false, error: "Spotify Premium required to control playback remotely." };
    }
    if (msg.includes("404") || msg.includes("Not Found") || msg.includes("Device not found")) {
      return { success: false, error: "Device not found. It may have gone offline." };
    }
    if (msg.includes("401") || msg.includes("Unauthorized")) {
      return { success: false, error: "Session expired. Please sign in again." };
    }
    if (msg.includes("Network") || msg.includes("fetch") || msg.includes("Failed to wake") || msg.includes("timed out")) {
      return { success: false, error: "Network error. Make sure the device is on the same network." };
    }
    if (msg.includes("didn't respond")) {
      return { success: false, error: msg };
    }
    return { success: false, error: msg };
  } finally {
    isTransferring.value = false;
    clearTimeout(safetyTimer);
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
  // Reset mute state
  isMuted.value = false;
  previousVolume = 100;
}

// ─── Device Switching ────────────────────────────────────────────────────────

/**
 * Graceful device switching: pauses current playback before transferring
 * to ensure clean state transition.
 */
export async function switchDevice(deviceId: string, deviceIp?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Pause current playback first (graceful switch per spotify-player pattern)
    await pause(effectiveDeviceId.value ?? undefined);
    // Small delay to let the pause propagate
    await new Promise(resolve => setTimeout(resolve, 100));
  } catch {
    // Ignore pause errors - device might not be playing
  }
  // Transfer to new device
  return selectDevice(deviceId, deviceIp);
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
    const currentOptions = activeScanOptions;
    if (currentOptions && currentOptions.includeLocal === includeLocal && currentOptions.force === force) {
      return activeScanPromise;
    }
  }

  // Only scan if includeLocal=true AND (cooldown passed OR never scanned)
  const shouldScanLocal = includeLocal && (force || lastLocalScanAt === 0 || (lastLocalScanAt > 0 && Date.now() - lastLocalScanAt >= LOCAL_SCAN_COOLDOWN_MS));


    activeScanOptions = options;
    activeScanPromise = (async () => {
    isScanning.value = true;
    scanError.value = null;
    let spotifyDevices: any[] = [];

    try {
      // Fetch Spotify devices (always) — but don't let auth failures block local scanning
      try {
        const spotifyData = await getAvailableDevices();
        spotifyDevices = spotifyData.devices ?? [];
        console.log(`[refreshDevices] Spotify API returned ${spotifyDevices.length} devices:`, spotifyDevices.map(d => ({ name: d.name, id: d.id?.slice(0, 8), type: d.type })));

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
      } catch (spotifyErr) {
        debug("[Devices] Spotify API unavailable (likely not authenticated yet):", spotifyErr);
        // Keep spotifyDevices as empty array — local scan will still proceed
      }

      // Always scan local devices when requested, regardless of Spotify auth state
      if (shouldScanLocal) {
        console.log(`[refreshDevices] Scanning local devices (force=${force}, cooldown=${Date.now() - lastLocalScanAt}ms ago)`);
        const local = await scanLocalDevices();
        console.log(`[refreshDevices] mDNS found ${local.length} devices:`, local.map(d => ({ name: d.friendly_name || d.name, ip: d.ip, port: d.port })));
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
            console.log(`[refreshDevices] MATCHED local "${displayName}" to Spotify API device "${spotifyMatch.name}" (id=${spotifyMatch.id})`);
            return { ...device, id: spotifyMatch.id, is_active: spotifyMatch.is_active, canTransfer: true, friendly_name: displayName };
          } else {
            console.log(`[refreshDevices] NO MATCH for local "${displayName}" — will show as Cast-only device`);
            return { ...device, canTransfer: false, friendly_name: displayName, note: "Start playback in SPX to activate this speaker" };
          }
        });
        localDevices.value = matched;
        // Only update timestamp when scan actually ran (not when blocked by cooldown)
        if (shouldScanLocal) {
          lastLocalScanAt = Date.now();
        }
      }
    } catch (error) {
      console.error("Failed to refresh devices:", error);
      scanError.value = error instanceof Error ? error.message : "Failed to scan devices";
    } finally {
      isScanning.value = false;
      activeScanPromise = null;
      activeScanOptions = null;
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
  await refreshDevices({ includeLocal: true, force });
}