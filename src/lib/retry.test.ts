import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './retry';

describe('withRetry', () => {
  it('returns result on success', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 errors', async () => {
    const error = new Error('Rate limited');
    (error as any).status = 429;
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('success');
    
    const onRetry = vi.fn();
    const result = await withRetry(fn, { onRetry });
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('retries on 5xx errors', async () => {
    const error = new Error('Server error');
    (error as any).status = 503;
    const fn = vi.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('success');
    
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx (non-429) errors', async () => {
    const error = new Error('Not found');
    (error as any).status = 404;
    const fn = vi.fn().mockRejectedValue(error);
    
    await expect(withRetry(fn)).rejects.toThrow('Not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after max retries', async () => {
    const error = new Error('Rate limited');
    (error as any).status = 429;
    const fn = vi.fn().mockRejectedValue(error);
    
    await expect(withRetry(fn, { maxRetries: 2 })).rejects.toThrow('Rate limited');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});
