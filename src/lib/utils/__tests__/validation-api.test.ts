import { describe, it, expect } from 'vitest';
import {
  resetPasswordSchema,
  excelExportSchema,
  backupDataSchema,
  backupAttendanceItemSchema,
  backupPermissionItemSchema,
  loginSchema,
} from '../validation';

// ============================================================================
// resetPasswordSchema tests
// ============================================================================

describe('resetPasswordSchema', () => {
  // --------------------------------------------------------------------------
  // Valid cases
  // --------------------------------------------------------------------------

  it('should accept a valid userId and strong password', () => {
    const result = resetPasswordSchema.safeParse({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      newPassword: 'Admin@123',
    });
    expect(result.success).toBe(true);
  });

  it('should accept a non-UUID userId (any non-empty string)', () => {
    const result = resetPasswordSchema.safeParse({
      userId: 'some-user-id',
      newPassword: 'StrongPass1',
    });
    expect(result.success).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Invalid cases
  // --------------------------------------------------------------------------

  it('should reject empty userId', () => {
    const result = resetPasswordSchema.safeParse({
      userId: '',
      newPassword: 'Admin@123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password shorter than 8 characters', () => {
    const result = resetPasswordSchema.safeParse({
      userId: 'user-1',
      newPassword: 'Ab1',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password longer than 72 characters', () => {
    const result = resetPasswordSchema.safeParse({
      userId: 'user-1',
      newPassword: 'A1' + 'x'.repeat(72),
    });
    expect(result.success).toBe(false);
  });

  it('should reject password without any letter', () => {
    const result = resetPasswordSchema.safeParse({
      userId: 'user-1',
      newPassword: '12345678',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password without any digit', () => {
    const result = resetPasswordSchema.safeParse({
      userId: 'user-1',
      newPassword: 'abcdefgh',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// loginSchema tests (updated — min 8 chars)
// ============================================================================

describe('loginSchema', () => {
  it('should accept valid email and password (8+ chars)', () => {
    const result = loginSchema.safeParse({
      email: 'admin@school.com',
      password: 'Admin@123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject password with only 6 characters', () => {
    const result = loginSchema.safeParse({
      email: 'admin@school.com',
      password: '123456',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid email format', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'Admin@123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty email', () => {
    const result = loginSchema.safeParse({
      email: '',
      password: 'Admin@123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject password longer than 72 characters', () => {
    const result = loginSchema.safeParse({
      email: 'admin@school.com',
      password: 'x'.repeat(73),
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// excelExportSchema tests
// ============================================================================

describe('excelExportSchema', () => {
  // --------------------------------------------------------------------------
  // Valid cases
  // --------------------------------------------------------------------------

  it('should accept valid date range', () => {
    const result = excelExportSchema.safeParse({
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    });
    expect(result.success).toBe(true);
  });

  it('should accept same start and end date', () => {
    const result = excelExportSchema.safeParse({
      startDate: '2025-06-15',
      endDate: '2025-06-15',
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid date range with employeeIds', () => {
    const result = excelExportSchema.safeParse({
      startDate: '2025-01-01',
      endDate: '2025-06-01',
      employeeIds: [1, 2, 3],
    });
    expect(result.success).toBe(true);
  });

  it('should accept up to 366 day range', () => {
    const result = excelExportSchema.safeParse({
      startDate: '2025-01-01',
      endDate: '2026-01-01',
    });
    expect(result.success).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Invalid cases
  // --------------------------------------------------------------------------

  it('should reject invalid date format', () => {
    const result = excelExportSchema.safeParse({
      startDate: '01/01/2025',
      endDate: '2025-01-31',
    });
    expect(result.success).toBe(false);
  });

  it('should reject end date before start date', () => {
    const result = excelExportSchema.safeParse({
      startDate: '2025-06-15',
      endDate: '2025-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('should reject date range exceeding 366 days', () => {
    const result = excelExportSchema.safeParse({
      startDate: '2025-01-01',
      endDate: '2026-02-01',
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer employeeIds', () => {
    const result = excelExportSchema.safeParse({
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      employeeIds: [1.5, 2],
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative employeeIds', () => {
    const result = excelExportSchema.safeParse({
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      employeeIds: [-1, 2],
    });
    expect(result.success).toBe(false);
  });

  it('should reject too many employeeIds (>200)', () => {
    const result = excelExportSchema.safeParse({
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      employeeIds: Array.from({ length: 201 }, (_, i) => i + 1),
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing startDate', () => {
    const result = excelExportSchema.safeParse({
      endDate: '2025-01-31',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// backupAttendanceItemSchema tests
// ============================================================================

describe('backupAttendanceItemSchema', () => {
  it('should accept a valid attendance record', () => {
    const result = backupAttendanceItemSchema.safeParse({
      date: '2025-01-15',
      emp_id: 1,
      in_time: '08:00',
      out_time: '16:00',
      note: 'ملاحظة',
      note_type: 'medical',
    });
    expect(result.success).toBe(true);
  });

  it('should accept nullable in_time/out_time/note', () => {
    const result = backupAttendanceItemSchema.safeParse({
      date: '2025-01-15',
      emp_id: 1,
      in_time: null,
      out_time: null,
      note: null,
      note_type: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept extra fields (passthrough)', () => {
    const result = backupAttendanceItemSchema.safeParse({
      date: '2025-01-15',
      emp_id: 1,
      status: 'on_time', // extra field
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid date format', () => {
    const result = backupAttendanceItemSchema.safeParse({
      date: '15/01/2025',
      emp_id: 1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid time format', () => {
    const result = backupAttendanceItemSchema.safeParse({
      date: '2025-01-15',
      emp_id: 1,
      in_time: '25:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-positive emp_id', () => {
    const result = backupAttendanceItemSchema.safeParse({
      date: '2025-01-15',
      emp_id: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject note longer than 500 chars', () => {
    const result = backupAttendanceItemSchema.safeParse({
      date: '2025-01-15',
      emp_id: 1,
      note: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// backupPermissionItemSchema tests
// ============================================================================

describe('backupPermissionItemSchema', () => {
  it('should accept a valid permission record', () => {
    const result = backupPermissionItemSchema.safeParse({
      date: '2025-01-15',
      emp_id: 1,
      type: 'late_arrival',
      minutes: 30,
      reason: 'ظرف طارئ',
      status: 'approved',
    });
    expect(result.success).toBe(true);
  });

  it('should accept all valid permission types', () => {
    for (const type of ['late_arrival', 'early_leave', 'during_day']) {
      const result = backupPermissionItemSchema.safeParse({
        date: '2025-01-15',
        emp_id: 1,
        type,
        minutes: 30,
        status: 'pending',
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid permission type', () => {
    const result = backupPermissionItemSchema.safeParse({
      date: '2025-01-15',
      emp_id: 1,
      type: 'invalid_type',
      minutes: 30,
      status: 'approved',
    });
    expect(result.success).toBe(false);
  });

  it('should reject minutes > 480', () => {
    const result = backupPermissionItemSchema.safeParse({
      date: '2025-01-15',
      emp_id: 1,
      type: 'late_arrival',
      minutes: 481,
      status: 'approved',
    });
    expect(result.success).toBe(false);
  });

  it('should reject minutes < 1', () => {
    const result = backupPermissionItemSchema.safeParse({
      date: '2025-01-15',
      emp_id: 1,
      type: 'late_arrival',
      minutes: 0,
      status: 'approved',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = backupPermissionItemSchema.safeParse({
      date: '2025-01-15',
      emp_id: 1,
      type: 'late_arrival',
      minutes: 30,
      status: 'unknown',
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// backupDataSchema tests
// ============================================================================

describe('backupDataSchema', () => {
  const validBackup = {
    metadata: {
      version: '1.0',
      timestamp: '2025-01-15T12:00:00Z',
      exported_by: 'admin',
      counts: {
        employees: 1,
        settings: 1,
        attendance: 1,
        permissions: 1,
        locks: 0,
      },
    },
    employees: [{ id: 1, name: 'أحمد' }],
    settings: [{ id: 1 }],
    attendance: [
      { date: '2025-01-15', emp_id: 1, in_time: '08:00', out_time: '16:00' },
    ],
    permissions: [
      {
        date: '2025-01-15',
        emp_id: 1,
        type: 'late_arrival' as const,
        minutes: 15,
        status: 'approved' as const,
      },
    ],
    locks: [],
  };

  it('should accept a valid complete backup structure', () => {
    const result = backupDataSchema.safeParse(validBackup);
    expect(result.success).toBe(true);
  });

  it('should reject missing metadata', () => {
    const { metadata, ...rest } = validBackup;
    const result = backupDataSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should reject missing employees array', () => {
    const { employees, ...rest } = validBackup;
    const result = backupDataSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('should reject metadata with missing counts', () => {
    const result = backupDataSchema.safeParse({
      ...validBackup,
      metadata: {
        version: '1.0',
        timestamp: '2025-01-15T12:00:00Z',
        exported_by: 'admin',
        // missing counts
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject employees without id field', () => {
    const result = backupDataSchema.safeParse({
      ...validBackup,
      employees: [{ name: 'أحمد' }], // missing id
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid attendance item inside backup', () => {
    const result = backupDataSchema.safeParse({
      ...validBackup,
      attendance: [
        { date: 'bad-date', emp_id: 1 }, // invalid date format
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid permission item inside backup', () => {
    const result = backupDataSchema.safeParse({
      ...validBackup,
      permissions: [
        { date: '2025-01-15', emp_id: 1, type: 'invalid', minutes: 30, status: 'approved' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should accept empty arrays for all collections', () => {
    const result = backupDataSchema.safeParse({
      metadata: {
        version: '1.0',
        timestamp: '2025-01-15T12:00:00Z',
        exported_by: 'admin',
        counts: {
          employees: 0,
          settings: 0,
          attendance: 0,
          permissions: 0,
          locks: 0,
        },
      },
      employees: [],
      settings: [],
      attendance: [],
      permissions: [],
      locks: [],
    });
    expect(result.success).toBe(true);
  });
});
