-- ============================================================
-- 001_schema.sql
-- School Attendance Management System - Schema, Indexes,
-- Triggers, Helper Functions, and Seed Data
-- Target: Supabase Postgres (uses auth.users, auth.uid())
-- ============================================================

-- =========================
-- 1. TABLES
-- =========================

-- ---------------------------------------------------------
-- 1.1  profiles
--      One row per authenticated user; stores role & prefs.
-- ---------------------------------------------------------
CREATE TABLE public.profiles (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('admin', 'data_entry')) DEFAULT 'data_entry',
  theme      text        NOT NULL CHECK (theme IN ('light', 'dark', 'system')) DEFAULT 'system',
  preferences jsonb      DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE  public.profiles IS 'Application-level user profile linked to Supabase auth.users';
COMMENT ON COLUMN public.profiles.role IS 'admin = full access; data_entry = limited access';

-- ---------------------------------------------------------
-- 1.2  employees
--      Master list of school employees tracked for attendance.
-- ---------------------------------------------------------
CREATE TABLE public.employees (
  id         bigserial   PRIMARY KEY,
  emp_no     text        UNIQUE NOT NULL,
  name       text        NOT NULL,
  active     boolean     DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.employees IS 'Master employee registry';

-- ---------------------------------------------------------
-- 1.3  settings
--      Singleton configuration row (id = 1 enforced by CHECK).
-- ---------------------------------------------------------
CREATE TABLE public.settings (
  id            int          PRIMARY KEY CHECK (id = 1),
  start_time    text         NOT NULL DEFAULT '08:00',
  end_time      text         NOT NULL DEFAULT '16:00',
  grace_minutes int          NOT NULL DEFAULT 10,
  workdays      text         NOT NULL DEFAULT '0,1,2,3,4',   -- 0 = Sunday .. 4 = Thursday
  updated_at    timestamptz  DEFAULT now()
);

COMMENT ON TABLE  public.settings IS 'Global attendance settings (singleton, id=1)';
COMMENT ON COLUMN public.settings.workdays IS 'Comma-separated day numbers: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu';

-- ---------------------------------------------------------
-- 1.4  attendance
--      Daily check-in / check-out records per employee.
-- ---------------------------------------------------------
CREATE TABLE public.attendance (
  id                bigserial   PRIMARY KEY,
  date              date        NOT NULL,
  emp_id            bigint      NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  in_time           text,                       -- "HH:MM" format
  out_time          text,                       -- "HH:MM" format
  note              text,
  note_type         text,
  client_updated_at timestamptz,
  created_by        uuid        REFERENCES auth.users(id),
  updated_by        uuid        REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(date, emp_id)
);

COMMENT ON TABLE public.attendance IS 'Daily attendance records (one row per employee per date)';

-- ---------------------------------------------------------
-- 1.5  permissions
--      Late arrivals, early leaves, and mid-day permissions.
-- ---------------------------------------------------------
CREATE TABLE public.permissions (
  id                bigserial   PRIMARY KEY,
  date              date        NOT NULL,
  emp_id            bigint      NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type              text        NOT NULL CHECK (type IN ('late_arrival', 'early_leave', 'during_day')),
  minutes           int         NOT NULL CHECK (minutes > 0),
  reason            text,
  status            text        NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')) DEFAULT 'approved',
  approved_by       uuid        REFERENCES auth.users(id),
  approved_at       timestamptz,
  client_updated_at timestamptz,
  created_by        uuid        REFERENCES auth.users(id),
  updated_by        uuid        REFERENCES auth.users(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

COMMENT ON TABLE public.permissions IS 'Employee permission slips (late, early leave, during day)';

-- ---------------------------------------------------------
-- 1.6  locks
--      Period locks that prevent data_entry users from
--      modifying attendance / permissions in that range.
-- ---------------------------------------------------------
CREATE TABLE public.locks (
  id         bigserial   PRIMARY KEY,
  lock_type  text        NOT NULL CHECK (lock_type IN ('half_year', 'year')),
  start_date date        NOT NULL,
  end_date   date        NOT NULL,
  locked_by  uuid        REFERENCES auth.users(id),
  locked_at  timestamptz DEFAULT now(),
  note       text
);

COMMENT ON TABLE public.locks IS 'Date-range locks that freeze attendance data for data_entry users';

-- ---------------------------------------------------------
-- 1.7  backups
--      Metadata for manual and scheduled backup files.
-- ---------------------------------------------------------
CREATE TABLE public.backups (
  id          bigserial   PRIMARY KEY,
  backup_type text        NOT NULL CHECK (backup_type IN ('manual', 'scheduled')) DEFAULT 'manual',
  file_path   text        NOT NULL,
  created_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  note        text
);

COMMENT ON TABLE public.backups IS 'Backup file metadata';

-- ---------------------------------------------------------
-- 1.8  audit_log
--      Immutable append-only log of data mutations.
-- ---------------------------------------------------------
CREATE TABLE public.audit_log (
  id         bigserial   PRIMARY KEY,
  user_id    uuid        REFERENCES auth.users(id),
  action     text        NOT NULL,
  table_name text,
  row_id     text,
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.audit_log IS 'Immutable audit trail for all data changes';


-- =========================
-- 2. INDEXES
-- =========================

-- attendance
CREATE INDEX idx_attendance_date     ON public.attendance(date);
CREATE INDEX idx_attendance_emp_id   ON public.attendance(emp_id);
CREATE INDEX idx_attendance_date_emp ON public.attendance(date, emp_id);

-- permissions
CREATE INDEX idx_permissions_date     ON public.permissions(date);
CREATE INDEX idx_permissions_emp_id   ON public.permissions(emp_id);
CREATE INDEX idx_permissions_date_emp ON public.permissions(date, emp_id);

-- employees
CREATE INDEX idx_employees_active ON public.employees(active);

-- audit_log
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at);

-- locks
CREATE INDEX idx_locks_dates ON public.locks(start_date, end_date);


-- =========================
-- 3. TRIGGERS
-- =========================

-- ---------------------------------------------------------
-- 3.1  Reusable trigger function: auto-set updated_at
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_updated_at_column()
  IS 'Trigger function: sets updated_at = now() on every UPDATE';

-- Attach to employees
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Attach to attendance
CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Attach to permissions
CREATE TRIGGER trg_permissions_updated_at
  BEFORE UPDATE ON public.permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Attach to settings
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- =========================
-- 4. HELPER FUNCTIONS
-- =========================

-- ---------------------------------------------------------
-- 4.1  is_admin()
--      Returns true when the calling user has role = 'admin'.
--      SECURITY DEFINER so it can read profiles regardless
--      of the caller's own RLS policies (avoids recursion).
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_admin()
  IS 'Returns true if the current Supabase user has the admin role';

-- ---------------------------------------------------------
-- 4.2  is_date_locked(check_date)
--      Returns true when the given date falls within any
--      existing lock period.
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_date_locked(check_date date)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.locks
    WHERE check_date BETWEEN start_date AND end_date
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_date_locked(date)
  IS 'Returns true if the supplied date is within a locked period';


-- =========================
-- 5. SEED DATA
-- =========================

-- Default settings row (singleton)
INSERT INTO public.settings (id, start_time, end_time, grace_minutes, workdays)
VALUES (1, '08:00', '16:00', 10, '0,1,2,3,4');
