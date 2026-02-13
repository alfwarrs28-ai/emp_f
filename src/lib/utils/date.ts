import {
  format,
  parse,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  getDay,
  parseISO,
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { SAUDI_TIMEZONE } from './constants';

// ============================================================================
// Date utility functions (Arabic locale, Saudi timezone)
// ============================================================================

/**
 * Ensure we have a Date object. Accepts Date or ISO string.
 */
function toDate(date: Date | string): Date {
  if (typeof date === 'string') {
    return parseISO(date);
  }
  return date;
}

/**
 * Format a date as a full Arabic date string.
 * Example: "الخميس، ١٣ فبراير ٢٠٢٦"
 */
export function formatDateAr(date: Date | string): string {
  const d = toDate(date);
  return format(d, 'EEEE، d MMMM yyyy', { locale: ar });
}

/**
 * Format a date in short Arabic-numeral form: "YYYY/MM/DD" with Arabic digits.
 * Example: "٢٠٢٦/٠٢/١٣"
 */
export function formatDateShort(date: Date | string): string {
  const d = toDate(date);
  const isoDate = format(d, 'yyyy/MM/dd');
  return toArabicNumerals(isoDate);
}

/**
 * Returns today's date in the Saudi (Asia/Riyadh) timezone as "YYYY-MM-DD".
 */
export function getTodaySaudi(): string {
  const now = new Date();
  // Build a formatter that gives us date parts in the Saudi timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: SAUDI_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA locale produces "YYYY-MM-DD" format
  return formatter.format(now);
}

/**
 * Check if a date falls on a workday.
 * @param date - The date to check.
 * @param workdays - Comma-separated day indices (0=Sunday .. 6=Saturday).
 *                   Example: "0,1,2,3,4" for Sunday through Thursday.
 */
export function isWorkday(date: Date | string, workdays: string): boolean {
  const d = toDate(date);
  const dayIndex = getDay(d); // 0 = Sunday
  const workdayIndices = workdays.split(',').map((s) => parseInt(s.trim(), 10));
  return workdayIndices.includes(dayIndex);
}

/**
 * Returns an array of "YYYY-MM-DD" date strings for every day in the range
 * (inclusive of both start and end).
 */
export function getDaysInRange(start: string, end: string): string[] {
  const startDate = parseISO(start);
  const endDate = parseISO(end);

  if (startDate > endDate) return [];

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.map((d) => format(d, 'yyyy-MM-dd'));
}

/**
 * Get the week range (Sunday to Thursday) containing the given date.
 * Defaults to today's Saudi date if no date is provided.
 * Returns { start, end } as "YYYY-MM-DD" strings.
 */
export function getWeekRange(date?: string): { start: string; end: string } {
  const d = date ? parseISO(date) : parseISO(getTodaySaudi());

  // Start of week on Sunday (weekStartsOn: 0)
  const sunday = startOfWeek(d, { weekStartsOn: 0 });
  // Thursday = Sunday + 4 days
  const thursday = new Date(sunday);
  thursday.setDate(sunday.getDate() + 4);

  return {
    start: format(sunday, 'yyyy-MM-dd'),
    end: format(thursday, 'yyyy-MM-dd'),
  };
}

/**
 * Get the first and last day of a given month.
 * Returns { start, end } as "YYYY-MM-DD" strings.
 * @param year - Full year (e.g. 2026).
 * @param month - 1-based month (1 = January).
 */
export function getMonthRange(
  year: number,
  month: number
): { start: string; end: string } {
  // date-fns months are 0-based internally via Date, but we pass 1-based
  const reference = new Date(year, month - 1, 1);
  const first = startOfMonth(reference);
  const last = endOfMonth(reference);

  return {
    start: format(first, 'yyyy-MM-dd'),
    end: format(last, 'yyyy-MM-dd'),
  };
}

// ---------------------------------------------------------------------------
// Arabic numerals
// ---------------------------------------------------------------------------

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Convert a number (or numeric string) to a string with Eastern Arabic-Indic digits.
 * Non-digit characters (like "/" or "-") are preserved.
 * Example: 123 => "١٢٣", "2026/02/13" => "٢٠٢٦/٠٢/١٣"
 */
export function toArabicNumerals(num: number | string): string {
  return String(num).replace(/\d/g, (d) => ARABIC_DIGITS[parseInt(d, 10)]);
}
