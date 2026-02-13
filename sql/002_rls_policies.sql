-- ============================================================
-- 002_rls_policies.sql
-- School Attendance Management System - Row Level Security
-- Target: Supabase Postgres
-- Depends on: 001_schema.sql (tables + is_admin() function)
-- ============================================================
-- Convention used throughout:
--   is_admin()                = current user has role 'admin'
--   NOT is_admin()            = current user is data_entry
--   auth.uid()                = current Supabase-authenticated user id
--   is_date_locked(date)      = date falls within a locked period
-- ============================================================


-- =========================
-- 1. ENABLE RLS ON ALL TABLES
-- =========================

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log   ENABLE ROW LEVEL SECURITY;


-- =========================
-- 2. PROFILES
-- =========================

-- 2a. Any authenticated user can read their OWN profile
CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  USING (user_id = auth.uid());

-- 2b. Any authenticated user can update their OWN profile
--     but ONLY the theme and preferences columns.
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2c. Admin can read ALL profiles
CREATE POLICY profiles_admin_select
  ON public.profiles
  FOR SELECT
  USING (is_admin());

-- 2d. Admin can insert new profiles (e.g. when onboarding users)
CREATE POLICY profiles_admin_insert
  ON public.profiles
  FOR INSERT
  WITH CHECK (is_admin());

-- 2e. Admin can update any profile (role changes, etc.)
CREATE POLICY profiles_admin_update
  ON public.profiles
  FOR UPDATE
  USING  (is_admin())
  WITH CHECK (is_admin());


-- =========================
-- 3. EMPLOYEES
-- =========================

-- 3a. Admin: full CRUD
CREATE POLICY employees_admin_select
  ON public.employees
  FOR SELECT
  USING (is_admin());

CREATE POLICY employees_admin_insert
  ON public.employees
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY employees_admin_update
  ON public.employees
  FOR UPDATE
  USING  (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY employees_admin_delete
  ON public.employees
  FOR DELETE
  USING (is_admin());

-- 3b. data_entry: SELECT active employees only
CREATE POLICY employees_data_entry_select
  ON public.employees
  FOR SELECT
  USING (NOT is_admin() AND active = true);


-- =========================
-- 4. SETTINGS
-- =========================

-- 4a. Admin: SELECT + UPDATE
CREATE POLICY settings_admin_select
  ON public.settings
  FOR SELECT
  USING (is_admin());

CREATE POLICY settings_admin_update
  ON public.settings
  FOR UPDATE
  USING  (is_admin())
  WITH CHECK (is_admin());

-- 4b. data_entry: SELECT only
CREATE POLICY settings_data_entry_select
  ON public.settings
  FOR SELECT
  USING (NOT is_admin());


-- =========================
-- 5. ATTENDANCE
-- =========================

-- 5a. Admin: full CRUD (no lock restriction)
CREATE POLICY attendance_admin_select
  ON public.attendance
  FOR SELECT
  USING (is_admin());

CREATE POLICY attendance_admin_insert
  ON public.attendance
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY attendance_admin_update
  ON public.attendance
  FOR UPDATE
  USING  (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY attendance_admin_delete
  ON public.attendance
  FOR DELETE
  USING (is_admin());

-- 5b. data_entry: SELECT always
CREATE POLICY attendance_data_entry_select
  ON public.attendance
  FOR SELECT
  USING (NOT is_admin());

-- 5c. data_entry: INSERT only if date is NOT locked
CREATE POLICY attendance_data_entry_insert
  ON public.attendance
  FOR INSERT
  WITH CHECK (
    NOT is_admin()
    AND NOT is_date_locked(date)
  );

-- 5d. data_entry: UPDATE only if date is NOT locked
CREATE POLICY attendance_data_entry_update
  ON public.attendance
  FOR UPDATE
  USING (
    NOT is_admin()
    AND NOT is_date_locked(date)
  )
  WITH CHECK (
    NOT is_admin()
    AND NOT is_date_locked(date)
  );


-- =========================
-- 6. PERMISSIONS
-- =========================

-- 6a. Admin: full CRUD (no lock restriction)
CREATE POLICY permissions_admin_select
  ON public.permissions
  FOR SELECT
  USING (is_admin());

CREATE POLICY permissions_admin_insert
  ON public.permissions
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY permissions_admin_update
  ON public.permissions
  FOR UPDATE
  USING  (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY permissions_admin_delete
  ON public.permissions
  FOR DELETE
  USING (is_admin());

-- 6b. data_entry: SELECT always
CREATE POLICY permissions_data_entry_select
  ON public.permissions
  FOR SELECT
  USING (NOT is_admin());

-- 6c. data_entry: INSERT only if date is NOT locked
CREATE POLICY permissions_data_entry_insert
  ON public.permissions
  FOR INSERT
  WITH CHECK (
    NOT is_admin()
    AND NOT is_date_locked(date)
  );

-- 6d. data_entry: UPDATE only if date is NOT locked
CREATE POLICY permissions_data_entry_update
  ON public.permissions
  FOR UPDATE
  USING (
    NOT is_admin()
    AND NOT is_date_locked(date)
  )
  WITH CHECK (
    NOT is_admin()
    AND NOT is_date_locked(date)
  );


-- =========================
-- 7. LOCKS
-- =========================

-- Admin only: full CRUD. No policies for data_entry = no access.

CREATE POLICY locks_admin_select
  ON public.locks
  FOR SELECT
  USING (is_admin());

CREATE POLICY locks_admin_insert
  ON public.locks
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY locks_admin_update
  ON public.locks
  FOR UPDATE
  USING  (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY locks_admin_delete
  ON public.locks
  FOR DELETE
  USING (is_admin());


-- =========================
-- 8. BACKUPS
-- =========================

-- Admin only: full CRUD. No policies for data_entry = no access.

CREATE POLICY backups_admin_select
  ON public.backups
  FOR SELECT
  USING (is_admin());

CREATE POLICY backups_admin_insert
  ON public.backups
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY backups_admin_update
  ON public.backups
  FOR UPDATE
  USING  (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY backups_admin_delete
  ON public.backups
  FOR DELETE
  USING (is_admin());


-- =========================
-- 9. AUDIT_LOG
-- =========================

-- 9a. Admin: SELECT + INSERT
CREATE POLICY audit_log_admin_select
  ON public.audit_log
  FOR SELECT
  USING (is_admin());

CREATE POLICY audit_log_admin_insert
  ON public.audit_log
  FOR INSERT
  WITH CHECK (is_admin());

-- 9b. data_entry: INSERT only (for sync conflict logging, etc.)
CREATE POLICY audit_log_data_entry_insert
  ON public.audit_log
  FOR INSERT
  WITH CHECK (NOT is_admin());
