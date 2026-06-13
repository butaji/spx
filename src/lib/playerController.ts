/**
 * Unified playback controller.
 * Routes commands to the Web Playback SDK when the SPX Player is the active device,
 * otherwise falls back to the REST API.
 */

import {
  getDeviceId,
  resume as sdkResume,
  pause as sdkPause,
  skipNext as sdkNext,
  skipPrevious as sdkPrev,
  seek as sdkSeek,
  setVolume as sdkSetVolume,
} from "./playback";
import {
  play as restPlay,
  pause as restPause,
  next as restNext,
  previous as restPrev,
  seek as restSeek,
  setVolume as restSetVolume,
} from "./spotify";
import { activeDevice } from "../stores/devices";

function sdkActive(): boolean {
  const sdkId = getDeviceId();
  if (!sdkId) return false;
  return activeDevice.value?.id === sdkId;
}

export async function controllerPlay(deviceId?: string): Promise<void> {
  if (sdkActive()) {
    await sdkResume();
  } else {
    await restPlay(deviceId);
  }
}

export async function controllerPause(): Promise<void> {
  if (sdkActive()) {
    await sdkPause();
  } else {
    await restPause();
  }
}

export async function controllerNext(): Promise<void> {
  if (sdkActive()) {
    await sdkNext();
  } else {
    await restNext();
  }
}

export async function controllerPrevious(): Promise<void> {
  if (sdkActive()) {
    await sdkPrev();
  } else {
    await restPrev();
  }
}

export async function controllerSeek(positionMs: number): Promise<void> {
  if (sdkActive()) {
    await sdkSeek(positionMs);
  } else {
    await restSeek(positionMs);
  }
}

export async function controllerSetVolume(volumePercent: number): Promise<void> {
  if (sdkActive()) {
    await sdkSetVolume(volumePercent / 100);
  } else {
    await restSetVolume(volumePercent);
  }
}
