import type {
  Attendance,
  AttendanceStatus,
  Employee,
  Permission,
  Settings,
} from '@/types/database';
import { timeToMinutes, calcLateMins, calcEarlyLeaveMins } from './time';
import { isWorkday, getDaysInRange } from './date';

// ============================================================================
// Attendance calculation functions
// ============================================================================

/**
 * Determine the display status of a single attendance record for a given date.
 */
export function calcAttendanceStatus(
  attendance: Attendance | null,
  settings: Settings,
  workdays: string,
  date: string
): AttendanceStatus {
  // Check if the date is a weekend / non-workday
  if (!isWorkday(date, workdays)) {
    return 'weekend';
  }

  // No record at all => absent
  if (!attendance) {
    return 'absent';
  }

  // Has no in_time => check if marked as excused/unexcused absence
  if (!attendance.in_time) {
    if (attendance.note_type === 'excused_absence') {
      return 'excused_absent';
    }
    if (attendance.note_type === 'unexcused_absence') {
      return 'unexcused_absent';
    }
    return 'absent';
  }

  // Has in_time but no out_time => missing check-out
  if (!attendance.out_time) {
    return 'missing_out';
  }

  // Has both times — determine if late
  const inMins = timeToMinutes(attendance.in_time);
  const startMins = timeToMinutes(settings.start_time);
  const threshold = startMins + settings.grace_minutes;

  if (inMins > threshold) {
    return 'late';
  }

  return 'on_time';
}

/**
 * Calculate net late minutes after subtracting approved late-arrival permission minutes.
 * Never returns a negative value.
 */
export function calcNetLateMinutes(
  rawLate: number,
  approvedLatePerms: number
): number {
  return Math.max(0, rawLate - approvedLatePerms);
}

/**
 * Calculate net early-leave minutes after subtracting approved early-leave permission minutes.
 * Never returns a negative value.
 */
export function calcNetEarlyLeave(
  rawEarly: number,
  approvedEarlyPerms: number
): number {
  return Math.max(0, rawEarly - approvedEarlyPerms);
}

// ---------------------------------------------------------------------------
// Report generation
// ---------------------------------------------------------------------------

export interface ReportData {
  employee: Employee;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  excusedAbsentDays: number;
  unexcusedAbsentDays: number;
  totalLateMins: number;
  totalEarlyLeaveMins: number;
  totalPermMins: number;
  netLateMins: number;
  netEarlyLeaveMins: number;
}

/**
 * Generate a comprehensive attendance report for a set of employees over a date range.
 *
 * @param attendances - All attendance records within the date range.
 * @param permissions - All permission records within the date range.
 * @param employees - The employees to include in the report.
 * @param settings - Current system settings (start_time, end_time, grace_minutes).
 * @param dateRange - The start and end dates (inclusive, "YYYY-MM-DD").
 */
export function generateAttendanceReport(
  attendances: Attendance[],
  permissions: Permission[],
  employees: Employee[],
  settings: Settings,
  dateRange: { start: string; end: string }
): ReportData[] {
  const allDates = getDaysInRange(dateRange.start, dateRange.end);
  const workdays = settings.workdays;

  // Pre-index attendance by emp_id + date
  const attendanceMap = new Map<string, Attendance>();
  for (const att of attendances) {
    attendanceMap.set(`${att.emp_id}_${att.date}`, att);
  }

  // Pre-index approved permissions by emp_id
  const permsByEmp = new Map<number, Permission[]>();
  for (const perm of permissions) {
    if (perm.status !== 'approved') continue;
    const existing = permsByEmp.get(perm.emp_id) || [];
    existing.push(perm);
    permsByEmp.set(perm.emp_id, existing);
  }

  return employees.map((employee) => {
    let presentDays = 0;
    let absentDays = 0;
    let excusedAbsentDays = 0;
    let unexcusedAbsentDays = 0;
    let totalLateMins = 0;
    let totalEarlyLeaveMins = 0;
    let totalWorkdays = 0;

    for (const date of allDates) {
      if (!isWorkday(date, workdays)) continue;

      totalWorkdays++;

      const key = `${employee.id}_${date}`;
      const att = attendanceMap.get(key) || null;
      const status = calcAttendanceStatus(att, settings, workdays, date);

      if (status === 'absent' || status === 'excused_absent' || status === 'unexcused_absent') {
        absentDays++;
        if (status === 'excused_absent') excusedAbsentDays++;
        else if (status === 'unexcused_absent') unexcusedAbsentDays++;
        continue;
      }

      // Present (on_time, late, or missing_out counts as present for the day)
      presentDays++;

      if (att?.in_time) {
        totalLateMins += calcLateMins(att.in_time, settings.start_time, settings.grace_minutes);
      }

      if (att?.out_time) {
        totalEarlyLeaveMins += calcEarlyLeaveMins(att.out_time, settings.end_time);
      }
    }

    // Sum approved permission minutes by type
    const empPerms = permsByEmp.get(employee.id) || [];
    let approvedLatePermMins = 0;
    let approvedEarlyPermMins = 0;
    let totalPermMins = 0;

    for (const perm of empPerms) {
      totalPermMins += perm.minutes;
      if (perm.type === 'late_arrival') {
        approvedLatePermMins += perm.minutes;
      } else if (perm.type === 'early_leave') {
        approvedEarlyPermMins += perm.minutes;
      }
      // 'during_day' permissions are counted in total but don't offset late/early
    }

    return {
      employee,
      totalDays: totalWorkdays,
      presentDays,
      absentDays,
      excusedAbsentDays,
      unexcusedAbsentDays,
      totalLateMins,
      totalEarlyLeaveMins,
      totalPermMins,
      netLateMins: calcNetLateMinutes(totalLateMins, approvedLatePermMins),
      netEarlyLeaveMins: calcNetEarlyLeave(totalEarlyLeaveMins, approvedEarlyPermMins),
    };
  });
}
