import {
  play,
  pause,
  next,
  previous,
  seek,
  setVolume,
} from "./spotify";

export async function controllerPlay(): Promise<void> {
  await play();
}

export async function controllerPause(): Promise<void> {
  await pause();
}

export async function controllerNext(): Promise<void> {
  await next();
}

export async function controllerPrevious(): Promise<void> {
  await previous();
}

export async function controllerSeek(positionMs: number): Promise<void> {
  await seek(positionMs);
}

export async function controllerSetVolume(volumePercent: number): Promise<void> {
  await setVolume(volumePercent);
}
