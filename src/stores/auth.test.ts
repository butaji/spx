import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/spotify', () => ({
  getAccessToken: vi.fn(),
  clearToken: vi.fn(),
}));

import { getAccessToken, clearToken } from '../lib/spotify';
import {
  authState,
  isMockMode,
  authError,
  isAuthLoading,
  appError,
  validateToken,
} from './auth';

describe('auth store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.value = false;
    isMockMode.value = false;
    authError.value = null;
    isAuthLoading.value = false;
    appError.value = null;
  });

  describe('validateToken', () => {
    it('returns false when no access token', async () => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
      const result = await validateToken();
      expect(result).toBe(false);
    });

    it('returns true on 200 OK', async () => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('valid-token');
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
      } as any);
      const result = await validateToken();
      expect(result).toBe(true);
    });

    it('returns false on 401 but does not clear token', async () => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('expired-token');
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
      } as any);
      const result = await validateToken();
      expect(result).toBe(false);
      expect(clearToken).not.toHaveBeenCalled();
    });

    it('returns false on 403 but does not clear token', async () => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('forbidden-token');
      global.fetch = vi.fn().mockResolvedValue({
        status: 403,
        ok: false,
      } as any);
      const result = await validateToken();
      expect(result).toBe(false);
      expect(clearToken).not.toHaveBeenCalled();
    });

    it('returns false on 5xx server errors (not true)', async () => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');
      global.fetch = vi.fn().mockResolvedValue({
        status: 503,
        ok: false,
      } as any);
      const result = await validateToken();
      expect(result).toBe(true);
    });

    it('returns true on network errors (keeps token)', async () => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));
      const result = await validateToken();
      expect(result).toBe(true);
    });

    it('returns false on 401/403 auth errors', async () => {
      (getAccessToken as ReturnType<typeof vi.fn>).mockReturnValue('token');
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
      } as any);
      const result = await validateToken();
      expect(result).toBe(false);
    });
  });

  describe('authError signal', () => {
    it('accepts string messages', () => {
      authError.value = 'Something went wrong';
      expect(authError.value).toBe('Something went wrong');
    });

    it('accepts null', () => {
      authError.value = null;
      expect(authError.value).toBeNull();
    });
  });
});
