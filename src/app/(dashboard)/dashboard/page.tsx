'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/lib/providers/auth-provider';
import { useSettings } from '@/lib/hooks/use-settings';
import { createClient } from '@/lib/supabase/client';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import {
  DashboardFilters,
  type DateFilter,
} from '@/components/dashboard/dashboard-filters';
import { StatsCards, type StatsData } from '@/components/dashboard/stats-cards';
import type { DailyLateData } from '@/components/dashboard/attendance-line-chart';
import type { DailyAbsenceData } from '@/components/dashboard/absence-bar-chart';
import type { TopLateEmployee } from '@/components/dashboard/top-late-chart';
import {
  STATUS_COLORS,
  type StatusDistribution,
} from '@/components/dashboard/status-donut-chart';

// Dynamic imports for heavy chart components (Recharts)
const AttendanceLineChart = dynamic(
  () => import('@/components/dashboard/attendance-line-chart').then(m => ({ default: m.AttendanceLineChart })),
  { loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> }
);
const AbsenceBarChart = dynamic(
  () => import('@/components/dashboard/absence-bar-chart').then(m => ({ default: m.AbsenceBarChart })),
  { loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> }
);
const TopLateChart = dynamic(
  () => import('@/components/dashboard/top-late-chart').then(m => ({ default: m.TopLateChart })),
  { loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> }
);
const StatusDonutChart = dynamic(
  () => import('@/components/dashboard/status-donut-chart').then(m => ({ default: m.StatusDonutChart })),
  { loading: () => <Skeleton className="h-[300px] w-full rounded-lg" /> }
);
import {
  getTodaySaudi,
  getMonthRange,
  getDaysInRange,
  isWorkday,
  toArabicNumerals,
} from '@/lib/utils/date';
import { calcLateMins } from '@/lib/utils/time';
import { calcAttendanceStatus } from '@/lib/utils/attendance-calc';
import type {
  Attendance,
  Permission,
  Employee,
  Settings,
} from '@/types/database';

// ============================================================================
// Data computation helpers
// ============================================================================

function computeStatsForToday(
  attendances: Attendance[],
  permissions: Permission[],
  employees: Employee[],
  settings: Settings,
  today: string,
): StatsData {
  const totalEmployees = employees.length;

  // Filter today's attendance
  const todayAttendance = attendances.filter((a) => a.date === today);
  const attendanceMap = new Map<number, Attendance>();
  for (const a of todayAttendance) {
    attendanceMap.set(a.emp_id, a);
  }

  // Count today's permissions (approved)
  const todayPermissions = permissions.filter(
    (p) => p.date === today && p.status === 'approved',
  );

  let presentToday = 0;
  let absentToday = 0;
  let lateToday = 0;

  // Only count if today is a workday
  if (isWorkday(today, settings.workdays)) {
    for (const emp of employees) {
      const att = attendanceMap.get(emp.id) || null;
      const status = calcAttendanceStatus(att, settings, settings.workdays, today);

      switch (status) {
        case 'on_time':
        case 'missing_out':
          presentToday++;
          break;
        case 'late':
          presentToday++;
          lateToday++;
          break;
        case 'absent':
        case 'excused_absent':
        case 'unexcused_absent':
          absentToday++;
          break;
      }
    }
  }

  return {
    presentToday,
    absentToday,
    lateToday,
    permissionsToday: todayPermissions.length,
    totalEmployees,
  };
}

function computeDailyLateData(
  attendances: Attendance[],
  settings: Settings,
  startDate: string,
  endDate: string,
): DailyLateData[] {
  const days = getDaysInRange(startDate, endDate);

  // Group attendance by date
  const byDate = new Map<string, Attendance[]>();
  for (const a of attendances) {
    const list = byDate.get(a.date) || [];
    list.push(a);
    byDate.set(a.date, list);
  }

  return days
    .filter((d) => isWorkday(d, settings.workdays))
    .map((day) => {
      const dayAttendances = byDate.get(day) || [];
      let totalLateMins = 0;

      for (const att of dayAttendances) {
        if (att.in_time) {
          totalLateMins += calcLateMins(
            att.in_time,
            settings.start_time,
            settings.grace_minutes,
          );
        }
      }

      const parsed = parseISO(day);
      const dateLabel = toArabicNumerals(format(parsed, 'MM/dd'));

      return { date: day, dateLabel, totalLateMins };
    });
}

function computeDailyAbsenceData(
  attendances: Attendance[],
  employees: Employee[],
  settings: Settings,
  startDate: string,
  endDate: string,
): DailyAbsenceData[] {
  const days = getDaysInRange(startDate, endDate);

  // Group attendance by date
  const byDate = new Map<string, Set<number>>();
  for (const a of attendances) {
    if (a.in_time) {
      const set = byDate.get(a.date) || new Set();
      set.add(a.emp_id);
      byDate.set(a.date, set);
    }
  }

  return days
    .filter((d) => isWorkday(d, settings.workdays))
    .map((day) => {
      const presentEmpIds = byDate.get(day) || new Set();
      const absentCount = employees.filter(
        (emp) => !presentEmpIds.has(emp.id),
      ).length;

      const parsed = parseISO(day);
      const dateLabel = toArabicNumerals(format(parsed, 'MM/dd'));

      return { date: day, dateLabel, absentCount };
    });
}

function computeTopLateEmployees(
  attendances: Attendance[],
  employees: Employee[],
  settings: Settings,
): TopLateEmployee[] {
  // Sum late minutes per employee
  const lateByEmp = new Map<number, number>();

  for (const att of attendances) {
    if (att.in_time) {
      const late = calcLateMins(
        att.in_time,
        settings.start_time,
        settings.grace_minutes,
      );
      if (late > 0) {
        lateByEmp.set(att.emp_id, (lateByEmp.get(att.emp_id) || 0) + late);
      }
    }
  }

  // Build employee name map
  const empMap = new Map<number, string>();
  for (const emp of employees) {
    empMap.set(emp.id, emp.name);
  }

  const result: TopLateEmployee[] = [];
  for (const [empId, totalLateMins] of Array.from(lateByEmp.entries())) {
    const name = empMap.get(empId) || `موظف #${empId}`;
    result.push({ name, totalLateMins });
  }

  return result.sort((a, b) => b.totalLateMins - a.totalLateMins).slice(0, 5);
}

function computeStatusDistribution(
  attendances: Attendance[],
  employees: Employee[],
  settings: Settings,
  startDate: string,
  endDate: string,
): StatusDistribution[] {
  const days = getDaysInRange(startDate, endDate);

  // Index attendance by emp_id + date
  const attMap = new Map<string, Attendance>();
  for (const a of attendances) {
    attMap.set(`${a.emp_id}_${a.date}`, a);
  }

  let onTimeCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let excusedAbsentCount = 0;
  let unexcusedAbsentCount = 0;
  let missingOutCount = 0;

  for (const day of days) {
    if (!isWorkday(day, settings.workdays)) continue;

    for (const emp of employees) {
      const key = `${emp.id}_${day}`;
      const att = attMap.get(key) || null;
      const status = calcAttendanceStatus(att, settings, settings.workdays, day);

      switch (status) {
        case 'on_time':
          onTimeCount++;
          break;
        case 'late':
          lateCount++;
          break;
        case 'absent':
          absentCount++;
          break;
        case 'excused_absent':
          excusedAbsentCount++;
          break;
        case 'unexcused_absent':
          unexcusedAbsentCount++;
          break;
        case 'missing_out':
          missingOutCount++;
          break;
      }
    }
  }

  return [
    {
      name: 'حاضر في الوقت',
      value: onTimeCount,
      color: STATUS_COLORS['حاضر في الوقت'],
    },
    {
      name: 'متأخر',
      value: lateCount,
      color: STATUS_COLORS['متأخر'],
    },
    {
      name: 'غائب',
      value: absentCount,
      color: STATUS_COLORS['غائب'],
    },
    {
      name: 'غائب بعذر',
      value: excusedAbsentCount,
      color: STATUS_COLORS['غائب بعذر'],
    },
    {
      name: 'غائب بدون عذر',
      value: unexcusedAbsentCount,
      color: STATUS_COLORS['غائب بدون عذر'],
    },
    {
      name: 'بدون خروج',
      value: missingOutCount,
      color: STATUS_COLORS['بدون خروج'],
    },
  ];
}

// ============================================================================
// Loading skeleton
// ============================================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24" />
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Access Denied
// ============================================================================

function AccessDenied() {
  return (
    <div className="space-y-6">
      <PageHeader title="لوحة التحكم" />
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="text-center space-y-2">
            <p className="text-xl font-semibold text-destructive">
              غير مصرح لك بالوصول
            </p>
            <p className="text-sm text-muted-foreground">
              هذه الصفحة متاحة فقط للمدراء
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Dashboard Page
// ============================================================================

export default function DashboardPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { settings, loading: settingsLoading, fetchSettings } = useSettings();
  const supabase = createClient();

  // Data state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Filter state
  const defaultRange = useMemo(() => {
    const today = parseISO(getTodaySaudi());
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    return getMonthRange(year, month);
  }, []);

  const [filter, setFilter] = useState<DateFilter>({
    startDate: defaultRange.start,
    endDate: defaultRange.end,
  });

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Fetch data when filter changes
  const fetchData = useCallback(
    async (dateFilter: DateFilter) => {
      setDataLoading(true);
      try {
        const [empResult, attResult, permResult] = await Promise.all([
          supabase
            .from('employees')
            .select('*')
            .eq('active', true)
            .order('name'),
          supabase
            .from('attendance')
            .select('*')
            .gte('date', dateFilter.startDate)
            .lte('date', dateFilter.endDate),
          supabase
            .from('permissions')
            .select('*')
            .gte('date', dateFilter.startDate)
            .lte('date', dateFilter.endDate),
        ]);

        if (empResult.data) setEmployees(empResult.data as Employee[]);
        if (attResult.data) setAttendances(attResult.data as Attendance[]);
        if (permResult.data) setPermissions(permResult.data as Permission[]);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setDataLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (isAdmin) {
      fetchData(filter);
    }
  }, [filter, isAdmin, fetchData]);

  // Handle filter change
  const handleFilterChange = useCallback((newFilter: DateFilter) => {
    setFilter(newFilter);
  }, []);

  // Compute chart data
  const today = useMemo(() => getTodaySaudi(), []);

  const statsData = useMemo<StatsData>(() => {
    if (!settings || employees.length === 0) {
      return {
        presentToday: 0,
        absentToday: 0,
        lateToday: 0,
        permissionsToday: 0,
        totalEmployees: 0,
      };
    }
    return computeStatsForToday(attendances, permissions, employees, settings, today);
  }, [attendances, permissions, employees, settings, today]);

  const dailyLateData = useMemo<DailyLateData[]>(() => {
    if (!settings) return [];
    return computeDailyLateData(attendances, settings, filter.startDate, filter.endDate);
  }, [attendances, settings, filter.startDate, filter.endDate]);

  const dailyAbsenceData = useMemo<DailyAbsenceData[]>(() => {
    if (!settings || employees.length === 0) return [];
    return computeDailyAbsenceData(
      attendances,
      employees,
      settings,
      filter.startDate,
      filter.endDate,
    );
  }, [attendances, employees, settings, filter.startDate, filter.endDate]);

  const topLateData = useMemo<TopLateEmployee[]>(() => {
    if (!settings || employees.length === 0) return [];
    return computeTopLateEmployees(attendances, employees, settings);
  }, [attendances, employees, settings]);

  const statusDistribution = useMemo<StatusDistribution[]>(() => {
    if (!settings || employees.length === 0) return [];
    return computeStatusDistribution(
      attendances,
      employees,
      settings,
      filter.startDate,
      filter.endDate,
    );
  }, [attendances, employees, settings, filter.startDate, filter.endDate]);

  // Auth loading
  if (authLoading) {
    return <DashboardSkeleton />;
  }

  // Admin guard
  if (!isAdmin) {
    return <AccessDenied />;
  }

  // Settings loading
  if (settingsLoading || !settings) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="لوحة التحكم"
        description="نظرة عامة على حالة الحضور والغياب"
      />

      {/* Filters */}
      <DashboardFilters onFilterChange={handleFilterChange} />

      {dataLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Stats Cards */}
          <StatsCards data={statsData} />

          {/* Charts Row 1: Late minutes (2/3) + Status donut (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <AttendanceLineChart
              data={dailyLateData}
              className="lg:col-span-2"
            />
            <StatusDonutChart data={statusDistribution} />
          </div>

          {/* Charts Row 2: Absence bar (2/3) + Top late (1/3) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <AbsenceBarChart
              data={dailyAbsenceData}
              className="lg:col-span-2"
            />
            <TopLateChart data={topLateData} />
          </div>
        </>
      )}
    </div>
  );
}
