import {
  play,
  pause,
  next,
  previous,
  seek,
  setVolume,
} from "./spotify";

// Get the current device ID for player commands
async function getCurrentDeviceId(): Promise<string | undefined> {
  try {
    const { effectiveDeviceId } = await import("../stores/devices");
    return effectiveDeviceId.value ?? undefined;
  } catch {
    return undefined;
  }
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
  await next();
}

export async function controllerPrevious(): Promise<void> {
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
