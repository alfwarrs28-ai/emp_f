-- ============================================================
-- 000_reset_and_rebuild.sql
-- COMPLETE DATABASE RESET: Drop everything + Recreate
-- Run this in Supabase SQL Editor
-- ============================================================

-- =========================
-- STEP 1: DROP ALL EXISTING OBJECTS (safe for empty projects)
-- =========================

-- Drop ALL public tables (including any from other projects)
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', t.tablename);
  END LOOP;
END;
$$;

-- Drop ALL public functions
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT ns.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace ns ON p.pronamespace = ns.oid
    WHERE ns.nspname = 'public'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', f.proname, f.args);
  END LOOP;
END;
$$;

-- Delete all auth users
DELETE FROM auth.users;

-- =========================
-- STEP 2: CREATE TABLES
-- =========================

-- 1. profiles
CREATE TABLE public.profiles (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('admin', 'data_entry')) DEFAULT 'data_entry',
  theme      text        NOT NULL CHECK (theme IN ('light', 'dark', 'system')) DEFAULT 'system',
  preferences jsonb      DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
COMMENT ON TABLE  public.profiles IS 'Application-level user profile linked to Supabase auth.users';
COMMENT ON COLUMN public.profiles.role IS 'admin = full access; data_entry = limited access';

-- 2. employees
CREATE TABLE public.employees (
  id         bigserial   PRIMARY KEY,
  emp_no     text        UNIQUE NOT NULL,
  name       text        NOT NULL,
  active     boolean     DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.employees IS 'Master employee registry';

-- 3. settings (singleton)
CREATE TABLE public.settings (
  id            int          PRIMARY KEY CHECK (id = 1),
  start_time    text         NOT NULL DEFAULT '08:00',
  end_time      text         NOT NULL DEFAULT '16:00',
  grace_minutes int          NOT NULL DEFAULT 10,
  workdays      text         NOT NULL DEFAULT '0,1,2,3,4',
  updated_at    timestamptz  DEFAULT now()
);
COMMENT ON TABLE  public.settings IS 'Global attendance settings (singleton, id=1)';
COMMENT ON COLUMN public.settings.workdays IS 'Comma-separated day numbers: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu';

-- 4. attendance
CREATE TABLE public.attendance (
  id                bigserial   PRIMARY KEY,
  date              date        NOT NULL,
  emp_id            bigint      NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  in_time           text,
  out_time          text,
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

-- 5. permissions
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

-- 6. locks
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

-- 7. backups
CREATE TABLE public.backups (
  id          bigserial   PRIMARY KEY,
  backup_type text        NOT NULL CHECK (backup_type IN ('manual', 'scheduled')) DEFAULT 'manual',
  file_path   text        NOT NULL,
  created_by  uuid        REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  note        text
);
COMMENT ON TABLE public.backups IS 'Backup file metadata';

-- 8. audit_log
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
-- STEP 3: INDEXES
-- =========================

CREATE INDEX idx_attendance_date     ON public.attendance(date);
CREATE INDEX idx_attendance_emp_id   ON public.attendance(emp_id);
CREATE INDEX idx_attendance_date_emp ON public.attendance(date, emp_id);

CREATE INDEX idx_permissions_date     ON public.permissions(date);
CREATE INDEX idx_permissions_emp_id   ON public.permissions(emp_id);
CREATE INDEX idx_permissions_date_emp ON public.permissions(date, emp_id);

CREATE INDEX idx_employees_active ON public.employees(active);

CREATE INDEX idx_audit_log_created ON public.audit_log(created_at);

CREATE INDEX idx_locks_dates ON public.locks(start_date, end_date);


-- =========================
-- STEP 4: TRIGGER FUNCTION
-- =========================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_updated_at_column()
  IS 'Trigger function: sets updated_at = now() on every UPDATE';

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_permissions_updated_at
  BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =========================
-- STEP 5: HELPER FUNCTIONS
-- =========================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_admin()
  IS 'Returns true if the current Supabase user has the admin role';

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
-- STEP 6: ROW LEVEL SECURITY
-- =========================

-- Enable RLS
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log   ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY profiles_admin_select ON public.profiles FOR SELECT USING (is_admin());
CREATE POLICY profiles_admin_insert ON public.profiles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());

-- EMPLOYEES policies
CREATE POLICY employees_admin_select ON public.employees FOR SELECT USING (is_admin());
CREATE POLICY employees_admin_insert ON public.employees FOR INSERT WITH CHECK (is_admin());
CREATE POLICY employees_admin_update ON public.employees FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY employees_admin_delete ON public.employees FOR DELETE USING (is_admin());
CREATE POLICY employees_data_entry_select ON public.employees FOR SELECT USING (NOT is_admin() AND active = true);

-- SETTINGS policies
CREATE POLICY settings_admin_select ON public.settings FOR SELECT USING (is_admin());
CREATE POLICY settings_admin_update ON public.settings FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY settings_data_entry_select ON public.settings FOR SELECT USING (NOT is_admin());

-- ATTENDANCE policies
CREATE POLICY attendance_admin_select ON public.attendance FOR SELECT USING (is_admin());
CREATE POLICY attendance_admin_insert ON public.attendance FOR INSERT WITH CHECK (is_admin());
CREATE POLICY attendance_admin_update ON public.attendance FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY attendance_admin_delete ON public.attendance FOR DELETE USING (is_admin());
CREATE POLICY attendance_data_entry_select ON public.attendance FOR SELECT USING (NOT is_admin());
CREATE POLICY attendance_data_entry_insert ON public.attendance FOR INSERT WITH CHECK (NOT is_admin() AND NOT is_date_locked(date));
CREATE POLICY attendance_data_entry_update ON public.attendance FOR UPDATE USING (NOT is_admin() AND NOT is_date_locked(date)) WITH CHECK (NOT is_admin() AND NOT is_date_locked(date));

-- PERMISSIONS policies
CREATE POLICY permissions_admin_select ON public.permissions FOR SELECT USING (is_admin());
CREATE POLICY permissions_admin_insert ON public.permissions FOR INSERT WITH CHECK (is_admin());
CREATE POLICY permissions_admin_update ON public.permissions FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY permissions_admin_delete ON public.permissions FOR DELETE USING (is_admin());
CREATE POLICY permissions_data_entry_select ON public.permissions FOR SELECT USING (NOT is_admin());
CREATE POLICY permissions_data_entry_insert ON public.permissions FOR INSERT WITH CHECK (NOT is_admin() AND NOT is_date_locked(date));
CREATE POLICY permissions_data_entry_update ON public.permissions FOR UPDATE USING (NOT is_admin() AND NOT is_date_locked(date)) WITH CHECK (NOT is_admin() AND NOT is_date_locked(date));

-- LOCKS policies (admin only)
CREATE POLICY locks_admin_select ON public.locks FOR SELECT USING (is_admin());
CREATE POLICY locks_admin_insert ON public.locks FOR INSERT WITH CHECK (is_admin());
CREATE POLICY locks_admin_update ON public.locks FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY locks_admin_delete ON public.locks FOR DELETE USING (is_admin());

-- BACKUPS policies (admin only)
CREATE POLICY backups_admin_select ON public.backups FOR SELECT USING (is_admin());
CREATE POLICY backups_admin_insert ON public.backups FOR INSERT WITH CHECK (is_admin());
CREATE POLICY backups_admin_update ON public.backups FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY backups_admin_delete ON public.backups FOR DELETE USING (is_admin());

-- AUDIT_LOG policies
CREATE POLICY audit_log_admin_select ON public.audit_log FOR SELECT USING (is_admin());
CREATE POLICY audit_log_admin_insert ON public.audit_log FOR INSERT WITH CHECK (is_admin());
CREATE POLICY audit_log_data_entry_insert ON public.audit_log FOR INSERT WITH CHECK (NOT is_admin());


-- =========================
-- STEP 7: SEED DATA
-- =========================

INSERT INTO public.settings (id, start_time, end_time, grace_minutes, workdays)
VALUES (1, '08:00', '16:00', 10, '0,1,2,3,4');


-- ============================================================
-- DONE! Now run: node scripts/setup-admin.mjs
-- to create the admin user.
-- ============================================================
