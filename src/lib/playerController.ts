import {
  play,
  pause,
  next,
  previous,
  seek,
  setVolume,
} from "./spotify";
import { ensureActiveDevice } from "./deviceManager";

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

export async function controllerPlay(): Promise<void> {
  const deviceId = await getCurrentDeviceId();
  await play(deviceId);
}

export async function controllerPause(): Promise<void> {
  const deviceId = await getCurrentDeviceId();
  await pause(deviceId);
}

export async function controllerNext(): Promise<void> {
  await getCurrentDeviceId();
  await next();
}

export async function controllerPrevious(): Promise<void> {
  await getCurrentDeviceId();
  await previous();
}

export async function controllerSeek(positionMs: number): Promise<void> {
  const deviceId = await getCurrentDeviceId();
  await seek(positionMs, deviceId);
}

export async function controllerSetVolume(volumePercent: number): Promise<void> {
  const deviceId = await getCurrentDeviceId();
  await setVolume(volumePercent, deviceId);
}
