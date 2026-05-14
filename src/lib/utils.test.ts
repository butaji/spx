import { describe, it, expect } from 'vitest';
import { formatTime, formatFollowers } from './utils';

describe('formatTime', () => {
  it('handles 0', () => expect(formatTime(0)).toBe('0:00'));
  it('handles undefined', () => expect(formatTime(undefined as any)).toBe('0:00'));
  it('handles NaN', () => expect(formatTime(NaN)).toBe('0:00'));
  it('handles negative numbers', () => expect(formatTime(-1000)).toBe('0:00'));
  it('handles seconds', () => expect(formatTime(42000)).toBe('0:42'));
  it('handles minutes', () => expect(formatTime(186000)).toBe('3:06'));
  it('handles hours', () => expect(formatTime(3661000)).toBe('61:01'));
  it('handles very large numbers', () => expect(formatTime(36000000)).toBe('600:00'));
});

describe('formatFollowers', () => {
  it('formats small numbers', () => expect(formatFollowers(123)).toBe('123'));
  it('formats thousands with K', () => expect(formatFollowers(1234)).toBe('1K'));
  it('formats millions with M', () => expect(formatFollowers(1234567)).toBe('1.2M'));
  it('handles 0', () => expect(formatFollowers(0)).toBe('0'));
});
