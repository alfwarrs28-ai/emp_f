// ============================================================================
// Database Types — matches Supabase schema for the school attendance system
// ============================================================================

// ---------------------------------------------------------------------------
// Enum / Union types
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'data_entry';

export type ThemeMode = 'light' | 'dark' | 'system';

export type PermissionType = 'late_arrival' | 'early_leave' | 'during_day';

export type PermissionStatus = 'approved' | 'pending' | 'rejected';

export type LockType = 'half_year' | 'year';

export type BackupType = 'manual' | 'scheduled';

export type NoteType = 'medical' | 'official' | 'personal' | 'other' | 'excused_absence' | 'unexcused_absence' | '';

// ---------------------------------------------------------------------------
// Table row interfaces
// ---------------------------------------------------------------------------

export interface Profile {
  user_id: string;
  role: UserRole;
  theme: ThemeMode;
  preferences: Record<string, any>;
  created_at: string;
}

export interface Employee {
  id: number;
  emp_no: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: number;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  workdays: string;
  updated_at: string;
}

export interface Attendance {
  id: number;
  date: string;
  emp_id: number;
  in_time: string | null;
  out_time: string | null;
  note: string | null;
  note_type: string | null;
  client_updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: number;
  date: string;
  emp_id: number;
  type: PermissionType;
  minutes: number;
  reason: string | null;
  status: PermissionStatus;
  approved_by: string | null;
  approved_at: string | null;
  client_updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lock {
  id: number;
  lock_type: LockType;
  start_date: string;
  end_date: string;
  locked_by: string | null;
  locked_at: string;
  note: string | null;
}

export interface Backup {
  id: number;
  backup_type: BackupType;
  file_path: string;
  created_by: string | null;
  created_at: string;
  note: string | null;
}

export interface AuditLog {
  id: number;
  user_id: string | null;
  action: string;
  table_name: string | null;
  row_id: string | null;
  old_data: any;
  new_data: any;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Computed / display types
// ---------------------------------------------------------------------------

export type AttendanceStatus =
  | 'on_time'
  | 'late'
  | 'absent'
  | 'excused_absent'
  | 'unexcused_absent'
  | 'missing_out'
  | 'weekend'
  | 'holiday';

export interface AttendanceWithEmployee extends Attendance {
  employee?: Employee;
}

export interface PermissionWithEmployee extends Permission {
  employee?: Employee;
}
