import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './retry';

describe('withRetry with HTTP-style errors', () => {
  it('retries on errors with .status property (like spotifyFetch now throws)', async () => {
    const fn = vi.fn();
    fn.mockRejectedValueOnce(Object.assign(new Error('Rate limited'), { status: 429 }))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, { maxRetries: 2 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on 5xx errors thrown as objects with .status', async () => {
    const fn = vi.fn();
    fn.mockRejectedValueOnce(Object.assign(new Error('Server error'), { status: 503 }))
      .mockRejectedValueOnce(Object.assign(new Error('Server error'), { status: 503 }))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, { maxRetries: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry on 401 unauthorized', async () => {
    const fn = vi.fn();
    fn.mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));

    await expect(withRetry(fn, { maxRetries: 2 })).rejects.toThrow('Unauthorized');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 400 bad request', async () => {
    const fn = vi.fn();
    fn.mockRejectedValue(Object.assign(new Error('Bad request'), { status: 400 }));

    await expect(withRetry(fn, { maxRetries: 2 })).rejects.toThrow('Bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on network errors without .status', async () => {
    const fn = vi.fn();
    fn.mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce('success');

    // Network errors (no .status) should be retried as they are often transient
    const result = await withRetry(fn, { maxRetries: 2 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
