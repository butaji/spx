import { useCallback } from "preact/compat";
import { ensureActiveDevice } from "../lib/deviceManager";

export function useDevices() {
  const ensureActiveDeviceCallback = useCallback(ensureActiveDevice, []);

  return {
    ensureActiveDevice: ensureActiveDeviceCallback,
  };
}
