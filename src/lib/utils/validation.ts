import { z } from 'zod';

// ============================================================================
// Zod validation schemas
// ============================================================================

// ---------------------------------------------------------------------------
// Reusable field schemas
// ---------------------------------------------------------------------------

/**
 * Validates a "HH:MM" formatted time string (24-hour clock).
 */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'صيغة الوقت غير صحيحة (HH:MM)');

// ---------------------------------------------------------------------------
// Employee form
// ---------------------------------------------------------------------------

export const employeeSchema = z.object({
  emp_no: z
    .string()
    .min(1, 'رقم الموظف مطلوب')
    .max(20, 'رقم الموظف طويل جداً'),
  name: z
    .string()
    .min(2, 'اسم الموظف مطلوب (حرفان على الأقل)')
    .max(100, 'اسم الموظف طويل جداً'),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

// ---------------------------------------------------------------------------
// Attendance upsert
// ---------------------------------------------------------------------------

export const attendanceSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)'),
  emp_id: z
    .number({ required_error: 'يجب اختيار الموظف' })
    .int()
    .positive('يجب اختيار الموظف'),
  in_time: timeSchema.nullable().optional(),
  out_time: timeSchema.nullable().optional(),
  note: z.string().max(500, 'الملاحظة طويلة جداً').nullable().optional(),
  note_type: z
    .enum(['medical', 'official', 'personal', 'other', 'excused_absence', 'unexcused_absence', ''])
    .nullable()
    .optional(),
});

export type AttendanceFormValues = z.infer<typeof attendanceSchema>;

// ---------------------------------------------------------------------------
// Permission form
// ---------------------------------------------------------------------------

export const permissionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)'),
  emp_id: z
    .number({ required_error: 'يجب اختيار الموظف' })
    .int()
    .positive('يجب اختيار الموظف'),
  type: z.enum(['late_arrival', 'early_leave', 'during_day'], {
    required_error: 'نوع الاستئذان مطلوب',
  }),
  minutes: z
    .number({ required_error: 'المدة مطلوبة' })
    .int('المدة يجب أن تكون عدداً صحيحاً')
    .min(1, 'المدة يجب أن تكون دقيقة واحدة على الأقل')
    .max(480, 'المدة لا يمكن أن تتجاوز ٤٨٠ دقيقة'),
  reason: z.string().max(500, 'السبب طويل جداً').nullable().optional(),
  status: z
    .enum(['approved', 'pending', 'rejected'])
    .default('pending'),
});

export type PermissionFormValues = z.infer<typeof permissionSchema>;

// ---------------------------------------------------------------------------
// Settings form
// ---------------------------------------------------------------------------

export const settingsSchema = z.object({
  start_time: timeSchema,
  end_time: timeSchema,
  grace_minutes: z
    .number({ required_error: 'فترة السماح مطلوبة' })
    .int()
    .min(0, 'فترة السماح لا يمكن أن تكون سالبة')
    .max(120, 'فترة السماح لا يمكن أن تتجاوز ١٢٠ دقيقة'),
  workdays: z
    .string()
    .min(1, 'يجب اختيار يوم عمل واحد على الأقل'),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

// ---------------------------------------------------------------------------
// Login form
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('صيغة البريد الإلكتروني غير صحيحة')
    .max(255, 'البريد الإلكتروني طويل جداً'),
  password: z
    .string()
    .min(8, 'كلمة المرور يجب أن تكون ٨ أحرف على الأقل')
    .max(72, 'كلمة المرور طويلة جداً'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// API: Reset Password
// ---------------------------------------------------------------------------

export const resetPasswordSchema = z.object({
  userId: z.string().min(1, 'معرف المستخدم مطلوب'),
  newPassword: z
    .string()
    .min(8, 'كلمة المرور يجب أن تكون ٨ أحرف على الأقل')
    .max(72, 'كلمة المرور طويلة جداً')
    .regex(/[A-Za-z]/, 'كلمة المرور يجب أن تحتوي على حرف واحد على الأقل')
    .regex(/[0-9]/, 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل'),
});
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

// ---------------------------------------------------------------------------
// API: Excel Export
// ---------------------------------------------------------------------------

export const excelExportSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة تاريخ البداية غير صحيحة (YYYY-MM-DD)')
    .refine((d) => !isNaN(Date.parse(d)), 'تاريخ البداية غير صالح'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة تاريخ النهاية غير صحيحة (YYYY-MM-DD)')
    .refine((d) => !isNaN(Date.parse(d)), 'تاريخ النهاية غير صالح'),
  employeeIds: z
    .array(z.number().int().positive('معرف الموظف غير صالح'))
    .max(200, 'عدد الموظفين كبير جداً')
    .optional(),
}).refine(
  (data) => new Date(data.startDate) <= new Date(data.endDate),
  { message: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية', path: ['startDate'] }
).refine(
  (data) => {
    const diffMs = new Date(data.endDate).getTime() - new Date(data.startDate).getTime();
    return diffMs / (1000 * 60 * 60 * 24) <= 366;
  },
  { message: 'نطاق التاريخ لا يمكن أن يتجاوز سنة واحدة', path: ['endDate'] }
);
export type ExcelExportValues = z.infer<typeof excelExportSchema>;

// ---------------------------------------------------------------------------
// API: Backup import item-level validation
// ---------------------------------------------------------------------------

export const backupAttendanceItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  emp_id: z.number().int().positive(),
  in_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
  out_time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  note_type: z.string().max(50).nullable().optional(),
}).passthrough();

export const backupPermissionItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  emp_id: z.number().int().positive(),
  type: z.enum(['late_arrival', 'early_leave', 'during_day']),
  minutes: z.number().int().min(1).max(480),
  reason: z.string().max(500).nullable().optional(),
  status: z.enum(['approved', 'pending', 'rejected']),
}).passthrough();

export const backupMetadataSchema = z.object({
  version: z.string(),
  timestamp: z.string(),
  exported_by: z.string(),
  counts: z.object({
    employees: z.number().int().nonnegative(),
    settings: z.number().int().nonnegative(),
    attendance: z.number().int().nonnegative(),
    permissions: z.number().int().nonnegative(),
    locks: z.number().int().nonnegative(),
  }),
});

export const backupDataSchema = z.object({
  metadata: backupMetadataSchema,
  employees: z.array(z.object({ id: z.number().int() }).passthrough()),
  settings: z.array(z.any()),
  attendance: z.array(backupAttendanceItemSchema),
  permissions: z.array(backupPermissionItemSchema),
  locks: z.array(z.any()),
});
export type BackupDataValues = z.infer<typeof backupDataSchema>;
