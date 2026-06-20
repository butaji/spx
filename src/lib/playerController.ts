import {
  play,
  pause,
  next,
  previous,
  seek,
  setVolume,
} from "./spotify";
import { ensureActiveDevice } from "./deviceManager";
import { currentDeviceId } from "./playback";

// Get the current device ID for player commands, falling back to ensureActiveDevice
async function getCurrentDeviceId(): Promise<string | undefined> {
  try {
    const { effectiveDeviceId } = await import("../stores/devices");
    if (effectiveDeviceId.value) {
      return effectiveDeviceId.value;
    }
  } catch {
    // store not available
  }

  // No effective device — try to activate one.
  return (await ensureActiveDevice()) ?? undefined;
}

/**
 * Is the given device ID the SPX Player (Web Playback SDK)?
 */
function isSpxPlayer(deviceId?: string): boolean {
  return !!deviceId && deviceId === currentDeviceId;
}

/**
 * Execute a playback control function, falling back to SPX Player
 * if the target device is not the SDK and the command fails.
 * This handles cases where the user transfers playback to an external
 * Spotify Connect device but the command needs to route through the REST API.
 */
async function withSpxFallback<T>(
  fn: (deviceId?: string) => Promise<T>,
  deviceId?: string
): Promise<T> {
  try {
    return await fn(deviceId);
  } catch (err: any) {
    // If non-SPX device and we got a 403 (Premium/permission), try SPX Player
    const status = err?.statusCode || err?.status;
    const is403 = status === 403 || String(err).includes("403") || String(err).includes("Premium");
    if (is403 && deviceId && !isSpxPlayer(deviceId) && currentDeviceId) {
      console.warn(`[PlayerController] 403 on device ${deviceId}, falling back to SPX Player`);
      return await fn(currentDeviceId);
    }
    throw err;
  }
}

export async function controllerPlay(): Promise<void> {
  const deviceId = await getCurrentDeviceId();
  await withSpxFallback(play, deviceId);
}

export async function controllerPause(): Promise<void> {
  const deviceId = await getCurrentDeviceId();
  await withSpxFallback(pause, deviceId);
}

export async function controllerNext(): Promise<void> {
  const deviceId = await getCurrentDeviceId();
  await withSpxFallback(next, deviceId);
}

export async function controllerPrevious(): Promise<void> {
  const deviceId = await getCurrentDeviceId();
  await withSpxFallback(previous, deviceId);
}

export async function controllerSeek(positionMs: number): Promise<void> {
  const deviceId = await getCurrentDeviceId();
  await withSpxFallback(
    (id) => seek(positionMs, id),
    deviceId
  );
}

export async function controllerSetVolume(volumePercent: number): Promise<void> {
  const deviceId = await getCurrentDeviceId();
  await withSpxFallback(
    (id) => setVolume(volumePercent, id),
    deviceId
  );
}
