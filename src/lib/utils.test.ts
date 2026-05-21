import { describe, it, expect } from 'vitest';
import { formatTime } from './utils';

describe('formatTime', () => {
  it('handles 0', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('handles undefined', () => {
    expect(formatTime(undefined)).toBe('0:00');
  });

  it('handles NaN', () => {
    expect(formatTime(NaN)).toBe('0:00');
  });

  it('handles seconds', () => {
    expect(formatTime(42000)).toBe('0:42');
  });

  it('handles minutes', () => {
    expect(formatTime(186000)).toBe('3:06');
  });

  it('handles hours', () => {
    expect(formatTime(3661000)).toBe('61:01');
  });
});
