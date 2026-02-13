import { describe, it, expect } from 'vitest';
import {
  calcAttendanceStatus,
  calcNetLateMinutes,
  generateAttendanceReport,
} from '../attendance-calc';
import type { Attendance, Employee, Permission, Settings } from '@/types/database';

// ---------------------------------------------------------------------------
// Shared mock settings
// ---------------------------------------------------------------------------

const mockSettings: Settings = {
  id: 1,
  start_time: '07:00',
  end_time: '14:00',
  grace_minutes: 15,
  workdays: '0,1,2,3,4',
  updated_at: '',
};

// ---------------------------------------------------------------------------
// calcAttendanceStatus
// ---------------------------------------------------------------------------

describe('calcAttendanceStatus', () => {
  const workdays = '0,1,2,3,4';
  const workday = '2026-02-09'; // Monday (day index 1) — a workday
  const nonWorkday = '2026-02-13'; // Friday (day index 5) — not a workday

  it('returns "absent" when attendance is null', () => {
    expect(calcAttendanceStatus(null, mockSettings, workdays, workday)).toBe('absent');
  });

  it('returns "excused_absent" when no in_time and note_type is "excused_absence"', () => {
    const att = {
      id: 1,
      date: workday,
      emp_id: 1,
      in_time: null,
      out_time: null,
      note: 'sick',
      note_type: 'excused_absence',
      client_updated_at: null,
      created_by: null,
      updated_by: null,
      created_at: '',
      updated_at: '',
    } as Attendance;

    expect(calcAttendanceStatus(att, mockSettings, workdays, workday)).toBe('excused_absent');
  });

  it('returns "unexcused_absent" when no in_time and note_type is "unexcused_absence"', () => {
    const att = {
      id: 2,
      date: workday,
      emp_id: 1,
      in_time: null,
      out_time: null,
      note: null,
      note_type: 'unexcused_absence',
      client_updated_at: null,
      created_by: null,
      updated_by: null,
      created_at: '',
      updated_at: '',
    } as Attendance;

    expect(calcAttendanceStatus(att, mockSettings, workdays, workday)).toBe('unexcused_absent');
  });

  it('returns "absent" when no in_time and no note_type', () => {
    const att = {
      id: 3,
      date: workday,
      emp_id: 1,
      in_time: null,
      out_time: null,
      note: null,
      note_type: null,
      client_updated_at: null,
      created_by: null,
      updated_by: null,
      created_at: '',
      updated_at: '',
    } as Attendance;

    expect(calcAttendanceStatus(att, mockSettings, workdays, workday)).toBe('absent');
  });

  it('returns "on_time" when in_time is within grace period', () => {
    const att = {
      id: 4,
      date: workday,
      emp_id: 1,
      in_time: '07:10',
      out_time: '14:00',
      note: null,
      note_type: null,
      client_updated_at: null,
      created_by: null,
      updated_by: null,
      created_at: '',
      updated_at: '',
    } as Attendance;

    // 07:10 is within 07:00 + 15 minutes grace = 07:15 threshold
    expect(calcAttendanceStatus(att, mockSettings, workdays, workday)).toBe('on_time');
  });

  it('returns "late" when in_time is after grace period', () => {
    const att = {
      id: 5,
      date: workday,
      emp_id: 1,
      in_time: '07:30',
      out_time: '14:00',
      note: null,
      note_type: null,
      client_updated_at: null,
      created_by: null,
      updated_by: null,
      created_at: '',
      updated_at: '',
    } as Attendance;

    // 07:30 is after 07:00 + 15 = 07:15 threshold
    expect(calcAttendanceStatus(att, mockSettings, workdays, workday)).toBe('late');
  });

  it('returns "missing_out" when has in_time but no out_time', () => {
    const att = {
      id: 6,
      date: workday,
      emp_id: 1,
      in_time: '07:00',
      out_time: null,
      note: null,
      note_type: null,
      client_updated_at: null,
      created_by: null,
      updated_by: null,
      created_at: '',
      updated_at: '',
    } as Attendance;

    expect(calcAttendanceStatus(att, mockSettings, workdays, workday)).toBe('missing_out');
  });

  it('returns "weekend" when date is not a workday', () => {
    expect(calcAttendanceStatus(null, mockSettings, workdays, nonWorkday)).toBe('weekend');
  });
});

// ---------------------------------------------------------------------------
// calcNetLateMinutes
// ---------------------------------------------------------------------------

describe('calcNetLateMinutes', () => {
  it('subtracts approved minutes correctly', () => {
    expect(calcNetLateMinutes(30, 10)).toBe(20);
  });

  it('never returns negative', () => {
    expect(calcNetLateMinutes(5, 20)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateAttendanceReport
// ---------------------------------------------------------------------------

describe('generateAttendanceReport', () => {
  it('correctly counts excused and unexcused absent days', () => {
    const employees: Employee[] = [
      { id: 1, emp_no: 'E001', name: 'Test Employee', active: true, created_at: '', updated_at: '' },
    ];

    // 2026-02-08 is Sunday (day 0 = workday), 2026-02-09 is Monday (day 1 = workday),
    // 2026-02-10 is Tuesday (day 2 = workday)
    const dateRange = { start: '2026-02-08', end: '2026-02-10' };

    const attendances: Attendance[] = [
      {
        id: 1,
        date: '2026-02-08',
        emp_id: 1,
        in_time: null,
        out_time: null,
        note: 'sick',
        note_type: 'excused_absence',
        client_updated_at: null,
        created_by: null,
        updated_by: null,
        created_at: '',
        updated_at: '',
      },
      {
        id: 2,
        date: '2026-02-09',
        emp_id: 1,
        in_time: null,
        out_time: null,
        note: null,
        note_type: 'unexcused_absence',
        client_updated_at: null,
        created_by: null,
        updated_by: null,
        created_at: '',
        updated_at: '',
      },
      // 2026-02-10: no attendance record at all => absent
    ];

    const permissions: Permission[] = [];

    const report = generateAttendanceReport(attendances, permissions, employees, mockSettings, dateRange);

    expect(report).toHaveLength(1);
    const empReport = report[0];

    // All 3 days are workdays (Sun, Mon, Tue with workdays '0,1,2,3,4')
    expect(empReport.totalDays).toBe(3);
    expect(empReport.absentDays).toBe(3); // excused + unexcused + plain absent
    expect(empReport.excusedAbsentDays).toBe(1);
    expect(empReport.unexcusedAbsentDays).toBe(1);
    expect(empReport.presentDays).toBe(0);
  });
});
