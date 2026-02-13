import type { UserRole, AttendanceStatus, PermissionType, PermissionStatus, Settings } from '@/types/database';

// ============================================================================
// Navigation
// ============================================================================

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  requiredRole: UserRole | null; // null = accessible by all authenticated users
}

export const NAV_ITEMS: NavItem[] = [
  // Admin-only routes
  { label: 'لوحة التحكم', href: '/dashboard', icon: 'LayoutDashboard', requiredRole: 'admin' },
  { label: 'الموظفون', href: '/employees', icon: 'Users', requiredRole: 'admin' },
  { label: 'التقارير', href: '/reports', icon: 'FileBarChart', requiredRole: 'admin' },
  { label: 'الإعدادات', href: '/settings', icon: 'Settings', requiredRole: 'admin' },
  { label: 'أدوات المدير', href: '/admin-tools', icon: 'ShieldCheck', requiredRole: 'admin' },
  // Shared routes (accessible by all roles)
  { label: 'الحضور والانصراف', href: '/attendance', icon: 'CalendarCheck', requiredRole: null },
  { label: 'الاستئذانات', href: '/permissions', icon: 'ClipboardList', requiredRole: null },
  { label: 'الغياب', href: '/absence', icon: 'UserX', requiredRole: null },
];

// ============================================================================
// Days of the week (Arabic)
// ============================================================================

/** Arabic day names ordered Sunday (index 0) through Saturday (index 6). */
export const DAYS_AR: string[] = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

/**
 * Maps JavaScript Date.getDay() value (0 = Sunday) to Arabic day name.
 */
export const DAYS_MAP: Record<number, string> = {
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

// ============================================================================
// Status / type label maps (Arabic)
// ============================================================================

export const ATTENDANCE_STATUS_MAP: Record<AttendanceStatus, string> = {
  on_time: 'حاضر',
  late: 'متأخر',
  absent: 'غائب',
  excused_absent: 'غائب بعذر',
  unexcused_absent: 'غائب بدون عذر',
  missing_out: 'لم يسجل انصراف',
  weekend: 'عطلة أسبوعية',
  holiday: 'إجازة',
};

export const PERMISSION_TYPE_MAP: Record<PermissionType, string> = {
  late_arrival: 'تأخر صباحي',
  early_leave: 'خروج مبكر',
  during_day: 'استئذان أثناء الدوام',
};

export const PERMISSION_STATUS_MAP: Record<PermissionStatus, string> = {
  approved: 'موافق عليه',
  pending: 'قيد المراجعة',
  rejected: 'مرفوض',
};

// ============================================================================
// Default settings
// ============================================================================

export const DEFAULT_SETTINGS: Omit<Settings, 'id' | 'updated_at'> = {
  start_time: '07:00',
  end_time: '14:00',
  grace_minutes: 15,
  workdays: '0,1,2,3,4', // Sunday through Thursday
};

// ============================================================================
// Timezone
// ============================================================================

export const SAUDI_TIMEZONE = 'Asia/Riyadh';
