import { describe, it, expect } from 'vitest';
import { isWorkday, toArabicNumerals, getDaysInRange } from '../date';

// ---------------------------------------------------------------------------
// isWorkday
// ---------------------------------------------------------------------------

describe('isWorkday', () => {
  it('returns true for Monday 2026-02-09 with workdays "0,1,2,3,4"', () => {
    // 2026-02-09 is Monday (day index 1)
    expect(isWorkday('2026-02-09', '0,1,2,3,4')).toBe(true);
  });

  it('returns false for Friday 2026-02-13 with workdays "0,1,2,3,4"', () => {
    // 2026-02-13 is Friday (day index 5) — not in "0,1,2,3,4"
    expect(isWorkday('2026-02-13', '0,1,2,3,4')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// toArabicNumerals
// ---------------------------------------------------------------------------

describe('toArabicNumerals', () => {
  it('converts 123 to "١٢٣"', () => {
    expect(toArabicNumerals(123)).toBe('١٢٣');
  });

  it('converts 0 to "٠"', () => {
    expect(toArabicNumerals(0)).toBe('٠');
  });
});

// ---------------------------------------------------------------------------
// getDaysInRange
// ---------------------------------------------------------------------------

describe('getDaysInRange', () => {
  it('returns array of 3 dates for 2026-02-09 to 2026-02-11', () => {
    const result = getDaysInRange('2026-02-09', '2026-02-11');
    expect(result).toHaveLength(3);
    expect(result).toEqual(['2026-02-09', '2026-02-10', '2026-02-11']);
  });
});
