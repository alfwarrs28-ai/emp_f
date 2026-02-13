'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { AttendanceToolbar } from '@/components/attendance/attendance-toolbar';
import { AttendanceTable } from '@/components/attendance/attendance-table';
import { AttendanceSummary } from '@/components/attendance/attendance-summary';
import { OfflineIndicator } from '@/components/attendance/offline-indicator';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { useAttendance } from '@/lib/hooks/use-attendance';
import { useEmployees } from '@/lib/hooks/use-employees';
import { useSettings } from '@/lib/hooks/use-settings';
import { SyncProvider } from '@/lib/providers/sync-provider';
import { getTodaySaudi } from '@/lib/utils/date';
import { DEFAULT_SETTINGS } from '@/lib/utils/constants';
import { formatTime } from '@/lib/utils/time';
import type { SaveStatus } from '@/lib/hooks/use-autosave';
import type { Settings } from '@/types/database';

function AttendancePageContent() {
  // ----- State -----
  const [selectedDate, setSelectedDate] = useState(getTodaySaudi());
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [preparingDay, setPreparingDay] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prepareDayCalledRef = useRef(false);

  // ----- Data hooks -----
  const { employees, loading: empLoading, refetch: refetchEmployees } = useEmployees();
  const { settings, loading: settingsLoading, fetchSettings } = useSettings();
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.active),
    [employees]
  );

  const {
    rows: attendanceRows,
    loading: attendanceLoading,
    updateRow,
    updateMultipleFields,
    prepareDay,
  } = useAttendance(selectedDate, activeEmployees);

  // ----- Bootstrap data (once) -----
  useEffect(() => {
    const bootstrap = async () => {
      await refetchEmployees(false);
      await fetchSettings();
      setBootstrapped(true);
    };
    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- Effective settings (fallback to defaults) -----
  const effectiveSettings: Settings = useMemo(
    () =>
      settings || {
        id: 1,
        start_time: DEFAULT_SETTINGS.start_time,
        end_time: DEFAULT_SETTINGS.end_time,
        grace_minutes: DEFAULT_SETTINGS.grace_minutes,
        workdays: DEFAULT_SETTINGS.workdays,
        updated_at: '',
      },
    [settings]
  );

  // ----- Compute display rows (simplified — all present by default, only late ones marked) -----
  const displayRows = useMemo(() => {
    return attendanceRows.map((row) => ({
      emp_id: row.emp_id,
      employeeName: row.employee?.name || `موظف #${row.emp_id}`,
      in_time: row.in_time,
      note: row.note,
    }));
  }, [attendanceRows]);

  // ----- Summary counts -----
  const lateCount = useMemo(() => displayRows.filter(r => r.in_time !== null).length, [displayRows]);
  const presentCount = useMemo(() => displayRows.filter(r => r.in_time === null).length, [displayRows]);

  // ----- Mark late handler -----
  const handleMarkLate = useCallback(async (empId: number) => {
    const now = new Date();
    const currentTime = formatTime(now.getHours(), now.getMinutes());
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await updateMultipleFields(empId, { in_time: currentTime });
      setSaveStatus(navigator.onLine ? 'saved' : 'offline');
    } catch {
      setSaveStatus('error');
    }
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }, [updateMultipleFields]);

  // ----- Cancel late handler -----
  const handleCancelLate = useCallback(async (empId: number) => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await updateMultipleFields(empId, { in_time: null, note: null });
      setSaveStatus(navigator.onLine ? 'saved' : 'offline');
    } catch {
      setSaveStatus('error');
    }
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }, [updateMultipleFields]);

  // ----- Time change handler (edit arrival time manually) -----
  const handleTimeChange = useCallback(async (empId: number, time: string | null) => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await updateRow(empId, 'in_time', time);
      setSaveStatus(navigator.onLine ? 'saved' : 'offline');
    } catch {
      setSaveStatus('error');
    }
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }, [updateRow]);

  // ----- Note change handler -----
  const handleNoteChange = useCallback(async (empId: number, note: string | null) => {
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    try {
      await updateRow(empId, 'note', note);
      setSaveStatus(navigator.onLine ? 'saved' : 'offline');
    } catch {
      setSaveStatus('error');
    }
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  }, [updateRow]);

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // ----- Prepare day handler -----
  const handlePrepareDay = useCallback(async () => {
    setPreparingDay(true);
    try {
      await prepareDay(activeEmployees);
    } finally {
      setPreparingDay(false);
    }
  }, [prepareDay, activeEmployees]);

  // ----- Auto-prepare day when page loads and no data exists (once per date) -----
  useEffect(() => {
    prepareDayCalledRef.current = false;
  }, [selectedDate]);

  useEffect(() => {
    if (attendanceLoading || !activeEmployees.length || prepareDayCalledRef.current || preparingDay) {
      return;
    }
    prepareDayCalledRef.current = true;
    const hasData = attendanceRows.some(r => r.remoteId || r.in_time || r.out_time);
    if (!hasData) {
      handlePrepareDay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceLoading]);

  // ----- Date change -----
  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date);
    setSearchQuery('');
    setSaveStatus('idle');
  }, []);

  // ----- Loading state -----
  const isInitialLoading = !bootstrapped || empLoading || settingsLoading;

  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="الحضور اليومي"
          description="تسجيل ومتابعة حضور وانصراف الموظفين"
        />
        <LoadingSpinner size="lg" className="py-16" />
      </div>
    );
  }

  // Check if rows have any data (for showing prepare button)
  const hasRows = attendanceRows.some(
    (r) => r.remoteId || r.in_time || r.out_time
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="الحضور اليومي"
        description="تسجيل ومتابعة حضور وانصراف الموظفين"
      />

      {/* Offline indicator */}
      <OfflineIndicator />

      {/* Summary stats */}
      {!attendanceLoading && displayRows.length > 0 && (
        <AttendanceSummary
          presentCount={presentCount}
          lateCount={lateCount}
          totalCount={displayRows.length}
        />
      )}

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <AttendanceToolbar
            date={selectedDate}
            onDateChange={handleDateChange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onPrepareDay={handlePrepareDay}
            preparingDay={preparingDay}
            saveStatus={saveStatus}
            hasRows={hasRows}
          />
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          <AttendanceTable
            rows={displayRows}
            loading={attendanceLoading}
            startTime={effectiveSettings.start_time}
            onMarkLate={handleMarkLate}
            onCancelLate={handleCancelLate}
            onNoteChange={handleNoteChange}
            onTimeChange={handleTimeChange}
            searchQuery={searchQuery}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <SyncProvider>
      <AttendancePageContent />
    </SyncProvider>
  );
}
