import { describe, it, expect } from 'vitest';
import {
  parseTime,
  timeToMinutes,
  calcLateMins,
  calcEarlyLeaveMins,
  isValidTime,
} from '../time';

// ---------------------------------------------------------------------------
// parseTime
// ---------------------------------------------------------------------------

describe('parseTime', () => {
  it('parses "07:30" correctly', () => {
    expect(parseTime('07:30')).toEqual({ hours: 7, minutes: 30 });
  });

  it('parses "0730" correctly', () => {
    expect(parseTime('0730')).toEqual({ hours: 7, minutes: 30 });
  });

  it('parses "730" correctly', () => {
    expect(parseTime('730')).toEqual({ hours: 7, minutes: 30 });
  });

  it('returns null for "invalid"', () => {
    expect(parseTime('invalid')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// timeToMinutes
// ---------------------------------------------------------------------------

describe('timeToMinutes', () => {
  it('converts "07:30" to 450 minutes', () => {
    expect(timeToMinutes('07:30')).toBe(450);
  });
});

// ---------------------------------------------------------------------------
// calcLateMins
// ---------------------------------------------------------------------------

describe('calcLateMins', () => {
  it('returns 15 when arriving at 07:30 (start 07:00, grace 15)', () => {
    // threshold = 07:00 + 15 = 07:15, arrived at 07:30 => 07:30 - 07:15 = 15 late
    expect(calcLateMins('07:30', '07:00', 15)).toBe(15);
  });

  it('returns 0 when arriving at 07:10 (within grace period)', () => {
    // threshold = 07:00 + 15 = 07:15, arrived at 07:10 => not late
    expect(calcLateMins('07:10', '07:00', 15)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// calcEarlyLeaveMins
// ---------------------------------------------------------------------------

describe('calcEarlyLeaveMins', () => {
  it('returns 60 when leaving at 13:00 (end 14:00)', () => {
    expect(calcEarlyLeaveMins('13:00', '14:00')).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// isValidTime
// ---------------------------------------------------------------------------

describe('isValidTime', () => {
  it('returns true for "07:30"', () => {
    expect(isValidTime('07:30')).toBe(true);
  });

  it('returns false for "25:00"', () => {
    expect(isValidTime('25:00')).toBe(false);
  });
});
