import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @tauri-apps/api/core before importing tauri-invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
import { tauriInvoke, setSpxBackendUrl } from './tauri-invoke';

describe('tauriInvoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSpxBackendUrl('');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('in Tauri app mode (real invoke available)', () => {
    it('should call @tauri-apps/api/core invoke directly', async () => {
      (invoke as ReturnType<typeof vi.fn>).mockResolvedValue({ result: 'success' });

      const result = await tauriInvoke('test_command', { param: 'value' });

      expect(invoke).toHaveBeenCalledWith('test_command', { param: 'value' });
      expect(result).toEqual({ result: 'success' });
    });

    it('should pass through the result type correctly', async () => {
      (invoke as ReturnType<typeof vi.fn>).mockResolvedValue({ devices: [] });

      const result = await tauriInvoke<{ devices: string[] }>('scan_devices');

      expect(result).toEqual({ devices: [] });
    });

    it('should handle invoke errors', async () => {
      (invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('IPC failed'));

      await expect(tauriInvoke('failing_command')).rejects.toThrow('IPC failed');
    });

    it('should work with no arguments', async () => {
      (invoke as ReturnType<typeof vi.fn>).mockResolvedValue('pong');

      const result = await tauriInvoke<string>('ping');

      expect(invoke).toHaveBeenCalledWith('ping', undefined);
      expect(result).toBe('pong');
    });
  });
});
