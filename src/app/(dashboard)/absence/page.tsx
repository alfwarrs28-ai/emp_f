'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { AbsenceToolbar } from '@/components/absence/absence-toolbar';
import { AbsenceTable } from '@/components/absence/absence-table';
import { AbsenceSummary } from '@/components/absence/absence-summary';
import { LatenessTable } from '@/components/absence/lateness-table';
import { OfflineIndicator } from '@/components/attendance/offline-indicator';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { useAttendance } from '@/lib/hooks/use-attendance';
import { useEmployees } from '@/lib/hooks/use-employees';
import { useSettings } from '@/lib/hooks/use-settings';
import { SyncProvider } from '@/lib/providers/sync-provider';
import { getTodaySaudi } from '@/lib/utils/date';
import { calcLateMins } from '@/lib/utils/time';
import { DEFAULT_SETTINGS } from '@/lib/utils/constants';
import type { SaveStatus } from '@/lib/hooks/use-autosave';
import type { Settings } from '@/types/database';

function AbsencePageContent() {
  // ----- State -----
  const [selectedDate, setSelectedDate] = useState(getTodaySaudi());
  const [searchQuery, setSearchQuery] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [activeTab, setActiveTab] = useState<'absence' | 'lateness'>('absence');
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

  // ----- Compute absence display rows -----
  const absenceRows = useMemo(() => {
    return attendanceRows.map((row) => {
      const isAbsent =
        !row.in_time &&
        (row.note_type === 'excused_absence' || row.note_type === 'unexcused_absence');
      return {
        emp_id: row.emp_id,
        employeeName: row.employee?.name || `موظف #${row.emp_id}`,
        isAbsent,
        absenceType: isAbsent
          ? (row.note_type as 'excused_absence' | 'unexcused_absence')
          : null,
        note: isAbsent ? row.note : null,
      };
    });
  }, [attendanceRows]);

  // ----- Compute lateness display rows -----
  const latenessRows = useMemo(() => {
    return attendanceRows.map((row) => {
      const lateMins = row.in_time
        ? calcLateMins(row.in_time, effectiveSettings.start_time, effectiveSettings.grace_minutes)
        : 0;
      return {
        emp_id: row.emp_id,
        employeeName: row.employee?.name || `موظف #${row.emp_id}`,
        in_time: row.in_time,
        lateMins,
        note: row.note,
      };
    });
  }, [attendanceRows, effectiveSettings]);

  // ----- Summary stats -----
  const stats = useMemo(() => {
    const total = absenceRows.length;
    const excused = absenceRows.filter((r) => r.absenceType === 'excused_absence').length;
    const unexcused = absenceRows.filter((r) => r.absenceType === 'unexcused_absence').length;
    const absent = excused + unexcused;
    return {
      totalEmployees: total,
      presentCount: total - absent,
      absentCount: absent,
      excusedCount: excused,
      unexcusedCount: unexcused,
    };
  }, [absenceRows]);

  // ----- Helper: update save status -----
  const withSaveStatus = useCallback(
    async (fn: () => Promise<void>) => {
      setSaveStatus('saving');
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      try {
        await fn();
        setSaveStatus(navigator.onLine ? 'saved' : 'offline');
      } catch {
        setSaveStatus('error');
      }
      saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    },
    []
  );

  // ----- Handler: Toggle absence -----
  const handleToggleAbsence = useCallback(
    async (empId: number) => {
      await withSaveStatus(async () => {
        const row = absenceRows.find((r) => r.emp_id === empId);
        if (row?.isAbsent) {
          // Toggle back to present
          await updateMultipleFields(empId, {
            note_type: null,
            note: null,
            in_time: null,
            out_time: null,
          });
        } else {
          // Toggle to absent (default: unexcused)
          await updateMultipleFields(empId, {
            note_type: 'unexcused_absence',
            in_time: null,
            out_time: null,
          });
        }
      });
    },
    [absenceRows, updateMultipleFields, withSaveStatus]
  );

  // ----- Handler: Change absence type -----
  const handleTypeChange = useCallback(
    async (empId: number, type: 'excused_absence' | 'unexcused_absence') => {
      await withSaveStatus(async () => {
        await updateMultipleFields(empId, { note_type: type });
      });
    },
    [updateMultipleFields, withSaveStatus]
  );

  // ----- Handler: Change note (absence tab) -----
  const handleNoteChange = useCallback(
    async (empId: number, note: string | null) => {
      await withSaveStatus(async () => {
        await updateRow(empId, 'note', note);
      });
    },
    [updateRow, withSaveStatus]
  );

  // ----- Handler: Change time (for lateness) -----
  const handleTimeChange = useCallback(
    async (empId: number, time: string | null) => {
      await withSaveStatus(async () => {
        await updateRow(empId, 'in_time', time);
      });
    },
    [updateRow, withSaveStatus]
  );

  // ----- Handler: Lateness note change -----
  const handleLatenessNoteChange = useCallback(
    async (empId: number, note: string | null) => {
      await withSaveStatus(async () => {
        await updateRow(empId, 'note', note);
      });
    },
    [updateRow, withSaveStatus]
  );

  // ----- Ensure records exist for the day (once per date) -----
  // Use a separate ref to track if we already attempted prepareDay for this date
  useEffect(() => {
    prepareDayCalledRef.current = false;
  }, [selectedDate]);

  // Only run once when loading finishes for the first time
  useEffect(() => {
    if (attendanceLoading || !activeEmployees.length || prepareDayCalledRef.current) {
      return;
    }
    prepareDayCalledRef.current = true;
    // Check if there are already records
    const hasRows = attendanceRows.some(
      (r) => r.remoteId || r.in_time || r.out_time || r.note_type
    );
    if (!hasRows) {
      prepareDay(activeEmployees);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceLoading]);

  // ----- Cleanup -----
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ----- Date change -----
  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date);
    setSearchQuery('');
    setSaveStatus('idle');
  }, []);

  // ----- Loading state -----
  // Wait for bootstrap + employees + settings to be loaded
  const isInitialLoading = !bootstrapped || empLoading || settingsLoading;

  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="الغياب والتأخير"
          description="تسجيل غياب وتأخير الموظفين"
        />
        <LoadingSpinner size="lg" className="py-16" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="الغياب والتأخير"
        description="تسجيل غياب وتأخير الموظفين"
      />

      {/* Offline indicator */}
      <OfflineIndicator />

      {/* Summary stats */}
      {!attendanceLoading && (
        <AbsenceSummary {...stats} />
      )}

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <AbsenceToolbar
            date={selectedDate}
            onDateChange={handleDateChange}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            saveStatus={saveStatus}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </CardContent>
      </Card>

      {/* Table content */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          {activeTab === 'absence' ? (
            <AbsenceTable
              rows={absenceRows}
              loading={attendanceLoading}
              onToggleAbsence={handleToggleAbsence}
              onTypeChange={handleTypeChange}
              onNoteChange={handleNoteChange}
              searchQuery={searchQuery}
            />
          ) : (
            <LatenessTable
              rows={latenessRows}
              loading={attendanceLoading}
              settings={effectiveSettings}
              onTimeChange={handleTimeChange}
              onNoteChange={handleLatenessNoteChange}
              searchQuery={searchQuery}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AbsencePage() {
  return (
    <SyncProvider>
      <AbsencePageContent />
    </SyncProvider>
  );
}
