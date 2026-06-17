import { signal, computed } from "@preact/signals";
import { getAvailableDevices, scanLocalDevices, transferPlayback, getAccessToken, ensureValidToken, tauriInvoke, setVolume, pause, getPlaybackState } from "../lib/spotify";
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

// Whether the last successful transfer fell back to the SPX Player
export const lastTransferUsedFallback = signal(false);

// librespot-based local Connect device created by SPX
export const localConnectDeviceId = signal<string | null>(null);
export const isStartingLocalConnect = signal(false);

// Embedded WebView cookie capture state for Google Cast support
export const isCapturingSpDc = signal(false);
export const spDcCaptureError = signal<string | null>(null);

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
  const spotify = availableDevices.value ?? [];
  const local = localDevices.value ?? [];



  // Start with Spotify API devices
  const merged: Array<SpotifyDevice & { isLocal?: boolean; localNote?: string; canTransfer?: boolean; needsWakeUp?: boolean; deviceIp?: string }> =
    spotify.filter(d => d?.id).map(d => ({ ...d, isLocal: false, canTransfer: true }));

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

  // Add the librespot-based SPX Connect device if started
  if (localConnectDeviceId.value) {
    const exists = merged.some(d => d.id === localConnectDeviceId.value);
    if (!exists) {
      merged.unshift({
        id: localConnectDeviceId.value,
        name: "SPX Connect",
        type: "speaker",
        is_active: false,
        is_restricted: false,
        isLocal: false,
        canTransfer: true,
      });
    }
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
  lastTransferUsedFallback.value = false;
  localConnectDeviceId.value = null;
  isStartingLocalConnect.value = false;
  isCapturingSpDc.value = false;
  spDcCaptureError.value = null;
  previousVolume = 100;
  lastLocalScanAt = 0;
  activeScanPromise = null;
}
let devicePollingInterval: ReturnType<typeof setInterval> | null = null;

// ─── Device Polling ──────────────────────────────────────────────────────────

let pollingRefreshVersion = 0; // Deduplicate polling refreshes

export function startDevicePolling(intervalMs = 10_000) {
  if (devicePollingInterval) {
    // Already polling; avoid duplicate intervals.
    return;
  }
  const currentVersion = ++pollingRefreshVersion;
  devicePollingInterval = setInterval(() => {
    // Skip if another refresh is already in progress (debounce)
    if (pollingRefreshVersion !== currentVersion) return;
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
    // Refresh the token if expired so Cast auth always has a valid token.
    const tokenValid = await ensureValidToken();
    if (!tokenValid) {
      throw new Error("No access token available");
    }

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
 * Retry a Spotify transfer with a short backoff.
 * Retries on transient failures (429, 5xx, network, and 404 when the device
 * may still be registering with Spotify Connect).
 */
async function transferPlaybackWithRetry(
  deviceId: string,
  play = true,
  onStatus?: (msg: string) => void,
  maxAttempts = 3
): Promise<void> {
  let lastError: any;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (attempt > 0) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 4000);
        onStatus?.(`Retrying transfer (${attempt}/${maxAttempts})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      await transferPlayback(deviceId, play);
      return;
    } catch (e: any) {
      lastError = e;
      const msg = e?.message || String(e);
      const status = e?.statusCode || e?.status || e?.response?.status;
      const isTransient =
        status === 429 ||
        (typeof status === "number" && status >= 500 && status < 600) ||
        status == null ||
        msg.includes("Device not found") ||
        msg.includes("404") ||
        msg.includes("No active device");

      if (!isTransient || attempt === maxAttempts - 1) {
        break;
      }
      console.warn(`[Devices] Transfer attempt ${attempt + 1} failed, retrying:`, msg);
    }
  }

  throw lastError ?? new Error("Failed to transfer playback");
}

/**
 * Verify that the target device became active after transfer.
 * Returns true if the device is now the active device, false otherwise.
 * This is a health check pattern used by spotcast and other mature Spotify projects.
 */
async function verifyDeviceHealth(
  targetDeviceId: string,
  onStatus?: (msg: string) => void,
  maxAttempts = 3
): Promise<boolean> {
  console.log(`[verifyDeviceHealth] Checking if device ${targetDeviceId} is active...`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
    
    try {
      const state = await getPlaybackState();
      const activeId = state?.device?.id;
      
      if (activeId === targetDeviceId) {
        console.log(`[verifyDeviceHealth] ✓ Device ${targetDeviceId} is active`);
        return true;
      }
      
      console.log(`[verifyDeviceHealth] Attempt ${attempt + 1}/${maxAttempts}: device=${activeId ?? 'none'} (waiting for ${targetDeviceId})`);
    } catch (e) {
      console.warn(`[verifyDeviceHealth] Attempt ${attempt + 1} failed:`, e);
    }
  }
  
  console.warn(`[verifyDeviceHealth] ✗ Device ${targetDeviceId} did not become active after ${maxAttempts} attempts`);
  return false;
}

/**
 * Fall back to the local SPX Connect device when another device fails.
 * SPX Connect uses librespot and works with the current OAuth token,
 * unlike Cast devices which require a Spotify Web Player token.
 *
 * If SPX Connect cannot be started (e.g. macOS 26 CoreAudio workaround),
 * fall back to the SPX Player (Web Playback SDK) so playback still works
 * on this Mac.
 */
async function fallbackToSpxConnect(onStatus?: (msg: string) => void): Promise<string | null> {
  onStatus?.("Falling back to SPX Connect...");
  console.log("[selectDevice] Attempting SPX Connect fallback");

  let spxId = localConnectDeviceId.value;
  if (!spxId) {
    const result = await startLocalConnectDevice("SPX Connect", 50);
    if (!result.success || !result.deviceId) {
      console.warn("[selectDevice] SPX Connect failed:", result.error);
      onStatus?.("SPX Connect unavailable, using SPX Player...");
      if (currentDeviceId) {
        await transferPlayback(currentDeviceId, true);
        selectedDeviceId.value = currentDeviceId;
        return currentDeviceId;
      }
      throw new Error(result.error || "SPX Connect could not be started.");
    }
    spxId = result.deviceId;
  }

  await transferPlayback(spxId, true);
  selectedDeviceId.value = spxId;
  return spxId;
}

/**
 * Start the librespot-based local Spotify Connect device.
 * Once started, "SPX Connect" appears in the device list and can receive playback.
 */
export async function startLocalConnectDevice(name = "SPX Connect", volume = 50): Promise<{ success: boolean; error?: string; deviceId?: string }> {
  if (isStartingLocalConnect.value) return { success: false, error: "Already starting SPX Connect" };
  if (localConnectDeviceId.value) return { success: true, deviceId: localConnectDeviceId.value };

  const token = getAccessToken();
  if (!token) {
    return { success: false, error: "No access token. Please sign in to Spotify first." };
  }

  isStartingLocalConnect.value = true;
  try {
    const deviceId = await tauriInvoke<string>("start_local_connect_device", {
      accessToken: token,
      name,
      volumePercent: Math.min(100, Math.max(0, volume)),
    });
    localConnectDeviceId.value = deviceId;
    console.log("[Devices] Started SPX Connect device:", deviceId);
    // Refresh so the device appears alongside Spotify API devices
    await refreshDevices();
    return { success: true, deviceId };
  } catch (error: any) {
    console.error("[Devices] Failed to start SPX Connect:", error);
    const msg = error?.message || String(error);
    return { success: false, error: msg };
  } finally {
    isStartingLocalConnect.value = false;
  }
}

/**
 * Open an embedded WebView so the user can log in to Spotify and grant SPX
 * the `sp_dc` cookie that Google Cast receivers require.
 */
export async function startSpotifyCookieCapture(): Promise<{ success: boolean; error?: string }> {
  if (isCapturingSpDc.value) return { success: false, error: "Cookie capture already in progress" };
  isCapturingSpDc.value = true;
  spDcCaptureError.value = null;
  try {
    const result = await tauriInvoke<string>("start_spotify_cookie_capture");
    console.log("[Devices] Cookie capture started:", result);
    return { success: true };
  } catch (error) {
    const msg = (error as Error)?.message || String(error);
    console.error("[Devices] Cookie capture failed:", msg);
    spDcCaptureError.value = msg;
    return { success: false, error: msg };
  } finally {
    isCapturingSpDc.value = false;
  }
}

/**
 * Select a device and transfer playback to it.
 * For Cast-only devices: wakes the device first, then transfers.
 * Returns the actual error message so the UI can show something useful.
 */
export async function selectDevice(deviceId: string, deviceIp?: string): Promise<{ success: boolean; error?: string; usedFallback?: boolean }> {
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
  let usedFallback = false;

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
      } else if (resolvedId !== currentDeviceId) {
        console.log(`[selectDevice] Device ${resolvedId} not found in API after refresh`);
        return { success: false, error: "Device went offline. Select SPX Player or another available device." };
      }
    }

    const targetId = selectedDeviceId.value!;
    console.log(`[selectDevice] Calling transferPlayback(${targetId})...`);

    try {
      await transferPlaybackWithRetry(targetId, true, onStatus);
      
      // Health check: verify device became active (pattern from spotcast/spotifyd)
      const isHealthy = await verifyDeviceHealth(targetId, onStatus);
      if (!isHealthy && targetId !== currentDeviceId) {
        console.warn("[selectDevice] Device health check failed, trying fallback...");
        onStatus?.("Device not responding, trying SPX Connect...");
        await fallbackToSpxConnect(onStatus);
        usedFallback = true;
      }
    } catch (transferError: any) {
      // Don't fall back to SPX Player if the user explicitly selected SPX Player.
      if (targetId === currentDeviceId) {
        throw transferError;
      }
      console.warn("[selectDevice] Primary transfer failed, trying SPX Connect fallback:", transferError);
      await fallbackToSpxConnect(onStatus);
      usedFallback = true;
    }

    console.log(`[selectDevice] Transfer succeeded!`);
    lastTransferUsedFallback.value = usedFallback;
    await refreshSpotifyDevices();
    return { success: true, ...(usedFallback ? { usedFallback: true as const } : {}) };
  } catch (error: any) {
    console.error("[Devices] Failed to transfer playback:", error);
    selectedDeviceId.value = activeDevice.value?.id ?? null;

    const msg = error?.message || String(error);
    if (statusMessage && !msg.includes("didn't respond") && !msg.includes("didn't appear") && !msg.includes("isn't visible") && !msg.includes("Failed to authenticate")) {
      // Return the staged status message if set (e.g. "Waiting for Spotify to register...")
      return { success: false, error: statusMessage };
    }
    if (msg.includes("isn't visible") || msg.includes("Spotify is not running")) {
      return { success: false, error: "This speaker needs to be activated. Select SPX Connect to play on this Mac, or start playback on the speaker from the official Spotify app." };
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
export async function switchDevice(deviceId: string, deviceIp?: string): Promise<{ success: boolean; error?: string; usedFallback?: boolean }> {
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
 * 
 * FIX: Properly handle concurrent calls by returning existing promise only when
 * options are identical, otherwise start a new refresh.
 */
export async function refreshDevices(options: RefreshDevicesOptions = {}): Promise<void> {

  const { force = false, includeLocal = false } = options;

  // Only return existing promise if options are identical (avoid redundant refreshes)
  if (activeScanPromise) {
    const currentOptions = activeScanOptions;
    if (currentOptions && currentOptions.includeLocal === includeLocal && currentOptions.force === force) {
      return activeScanPromise;
    }
    // Different options requested - let current scan finish but don't await it
    // The new call will proceed with its own scan
  }

  // Only scan if includeLocal=true AND (cooldown passed OR never scanned)
  const shouldScanLocal = includeLocal && (force || lastLocalScanAt === 0 || (lastLocalScanAt > 0 && Date.now() - lastLocalScanAt >= LOCAL_SCAN_COOLDOWN_MS));

  activeScanOptions = options;
  const scanPromise = (async () => {
    isScanning.value = true;
    scanError.value = null;
    let spotifyDevices: any[] = [];
    let localScanError: Error | null = null;

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

        // If selected device disappeared, fall back to active.
        // Keep SPX Connect and the Web Playback SDK device even if Spotify's API
        // doesn't list them yet.
        if (selectedDeviceId.value) {
          const isKnownLocalDevice =
            selectedDeviceId.value === localConnectDeviceId.value ||
            selectedDeviceId.value === currentDeviceId;
          if (!isKnownLocalDevice && !availableDevices.value.some(d => d.id === selectedDeviceId.value)) {
            selectedDeviceId.value = active?.id ?? null;
          }
        }
      } catch (spotifyErr) {
        debug("[Devices] Spotify API unavailable (likely not authenticated yet):", spotifyErr);
        // Keep spotifyDevices as empty array — local scan will still proceed
      }

      // Always scan local devices when requested, regardless of Spotify auth state
      if (shouldScanLocal) {
        console.log(`[refreshDevices] Scanning local devices (force=${force}, cooldown=${Date.now() - lastLocalScanAt}ms ago)`);
        try {
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
        } catch (localError) {
          // Surface local scan errors but don't fail the whole refresh
          localScanError = localError instanceof Error ? localError : new Error(String(localError));
          console.warn("[refreshDevices] Local scan failed:", localScanError.message);
          // Keep existing local devices on scan failure
        }
      }
    } catch (error) {
      console.error("Failed to refresh devices:", error);
      scanError.value = error instanceof Error ? error.message : "Failed to scan devices";
    } finally {
      isScanning.value = false;
      // Report local scan errors if no main error occurred
      if (localScanError && !scanError.value) {
        console.log("[refreshDevices] Reporting local scan error:", localScanError.message);
      }
      activeScanPromise = null;
      activeScanOptions = null;
    }
  })();

  activeScanPromise = scanPromise;
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