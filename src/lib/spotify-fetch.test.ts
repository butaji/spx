import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    save: vi.fn(),
    entries: vi.fn().mockResolvedValue([]),
  }),
}));

import { logout } from './spotify';

describe('spotify module lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logout runs without throwing', async () => {
    await expect(logout()).resolves.not.toThrow();
  });
});
