// ============================================================================
// Time utility functions
// ============================================================================

/**
 * Parse a time string in "HH:MM", "HHMM", or "HMM" format.
 * Returns an object with hours and minutes, or null if the input is invalid.
 */
export function parseTime(str: string): { hours: number; minutes: number } | null {
  if (!str || typeof str !== 'string') return null;

  const trimmed = str.trim();

  // Try "HH:MM" format
  const colonMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const minutes = parseInt(colonMatch[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
    return null;
  }

  // Try "HHMM" (4 digits) format
  const fourDigitMatch = trimmed.match(/^(\d{2})(\d{2})$/);
  if (fourDigitMatch) {
    const hours = parseInt(fourDigitMatch[1], 10);
    const minutes = parseInt(fourDigitMatch[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
    return null;
  }

  // Try "HMM" (3 digits) format — e.g. "805" => 08:05
  const threeDigitMatch = trimmed.match(/^(\d)(\d{2})$/);
  if (threeDigitMatch) {
    const hours = parseInt(threeDigitMatch[1], 10);
    const minutes = parseInt(threeDigitMatch[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return { hours, minutes };
    }
    return null;
  }

  return null;
}

/**
 * Format hours and minutes into "HH:MM" (zero-padded).
 */
export function formatTime(hours: number, minutes: number): string {
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Quick-format a raw numeric string into "HH:MM".
 * Accepts "805" => "08:05", "1530" => "15:30", already formatted "08:05", etc.
 * Returns null if the input is invalid.
 */
export function quickTimeFormat(input: string): string | null {
  const parsed = parseTime(input);
  if (!parsed) return null;
  return formatTime(parsed.hours, parsed.minutes);
}

/**
 * Convert a "HH:MM" time string to total minutes since midnight.
 */
export function timeToMinutes(time: string): number {
  const parsed = parseTime(time);
  if (!parsed) return 0;
  return parsed.hours * 60 + parsed.minutes;
}

/**
 * Convert total minutes since midnight to "HH:MM".
 */
export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(mins, 1439)); // 23:59 max
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return formatTime(hours, minutes);
}

/**
 * Calculate raw late minutes.
 * Returns the number of minutes the employee arrived after `startTime + graceMinutes`.
 * Returns 0 if the employee was on time or early.
 */
export function calcLateMins(
  inTime: string,
  startTime: string,
  graceMinutes: number
): number {
  const inMins = timeToMinutes(inTime);
  const startMins = timeToMinutes(startTime);
  const threshold = startMins + graceMinutes;
  const diff = inMins - threshold;
  return diff > 0 ? diff : 0;
}

/**
 * Calculate raw early-leave minutes.
 * Returns the number of minutes the employee left before `endTime`.
 * Returns 0 if the employee left on time or later.
 */
export function calcEarlyLeaveMins(outTime: string, endTime: string): number {
  const outMins = timeToMinutes(outTime);
  const endMins = timeToMinutes(endTime);
  const diff = endMins - outMins;
  return diff > 0 ? diff : 0;
}

/**
 * Validate that a string is a well-formed "HH:MM" time.
 */
export function isValidTime(time: string): boolean {
  if (!time || typeof time !== 'string') return false;
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
