'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/providers/auth-provider';
import { useEmployees } from '@/lib/hooks/use-employees';
import { useSettings } from '@/lib/hooks/use-settings';
import { createClient } from '@/lib/supabase/client';
import { generateAttendanceReport, type ReportData } from '@/lib/utils/attendance-calc';
import { getMonthRange, getTodaySaudi } from '@/lib/utils/date';
import type { Attendance, Permission } from '@/types/database';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import {
  ReportFiltersPanel,
  type ReportFilters,
} from '@/components/reports/report-filters';
import { ReportSummary } from '@/components/reports/report-summary';
import { ReportTable } from '@/components/reports/report-table';
import { LatenessReport } from '@/components/reports/lateness-report';
import { AbsenceReport } from '@/components/reports/absence-report';
import { PermissionsReport } from '@/components/reports/permissions-report';
import { EmployeeReport } from '@/components/reports/employee-report';
import { ExcelExportButton } from '@/components/reports/excel-export-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ShieldAlert,
  FileBarChart,
  Clock,
  CalendarX2,
  ClipboardList,
  UserCircle,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseISO } from 'date-fns';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDefaultFilters(): ReportFilters {
  const today = parseISO(getTodaySaudi());
  const range = getMonthRange(today.getFullYear(), today.getMonth() + 1);
  return {
    startDate: range.start,
    endDate: range.end,
    employeeIds: [],
  };
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-14 w-full rounded-lg" />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report tab definitions
// ---------------------------------------------------------------------------

const REPORT_TABS = [
  { value: 'overview', label: 'التقرير الشامل', shortLabel: 'شامل', icon: BarChart3 },
  { value: 'lateness', label: 'تقرير التأخير', shortLabel: 'تأخير', icon: Clock },
  { value: 'absence', label: 'تقرير الغياب', shortLabel: 'غياب', icon: CalendarX2 },
  { value: 'permissions', label: 'تقرير الاستئذانات', shortLabel: 'أذونات', icon: ClipboardList },
  { value: 'employee', label: 'تقرير المعلم', shortLabel: 'معلم', icon: UserCircle },
] as const;

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { employees, loading: empLoading, refetch: fetchEmployees } = useEmployees();
  const { settings, loading: settingsLoading, fetchSettings } = useSettings();

  const [filters, setFilters] = useState<ReportFilters>(getDefaultFilters);
  const [reportData, setReportData] = useState<ReportData[] | null>(null);
  const [rawAttendance, setRawAttendance] = useState<Attendance[]>([]);
  const [rawPermissions, setRawPermissions] = useState<Permission[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const supabase = createClient();

  // --- Initial data fetch ---
  useEffect(() => {
    fetchEmployees(false);
    fetchSettings();
  }, [fetchEmployees, fetchSettings]);

  // --- Fetch report data ---
  const fetchReportData = useCallback(
    async (appliedFilters: ReportFilters) => {
      if (!settings) {
        toast.error('لم يتم تحميل الإعدادات بعد');
        return;
      }

      setDataLoading(true);
      setHasQueried(true);

      try {
        const { startDate, endDate, employeeIds } = appliedFilters;

        const targetEmployees =
          employeeIds.length > 0
            ? employees.filter((emp) => employeeIds.includes(emp.id))
            : employees;

        if (targetEmployees.length === 0) {
          toast.error('لا يوجد موظفون مطابقون للفلاتر');
          setReportData([]);
          setRawAttendance([]);
          setRawPermissions([]);
          setDataLoading(false);
          return;
        }

        const empIds = targetEmployees.map((e) => e.id);

        // Fetch attendance records
        const { data: attendanceData, error: attError } = await supabase
          .from('attendance')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .in('emp_id', empIds)
          .order('date');

        if (attError) {
          console.error('Error fetching attendance:', attError);
          toast.error('حدث خطأ أثناء جلب بيانات الحضور');
          setDataLoading(false);
          return;
        }

        // Fetch ALL permissions (not just approved — for the permissions report)
        const { data: permData, error: permError } = await supabase
          .from('permissions')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .in('emp_id', empIds);

        if (permError) {
          console.error('Error fetching permissions:', permError);
          toast.error('حدث خطأ أثناء جلب بيانات الاستئذانات');
          setDataLoading(false);
          return;
        }

        const attendance = (attendanceData as Attendance[]) || [];
        const permissions = (permData as Permission[]) || [];

        // Store raw data for sub-reports
        setRawAttendance(attendance);
        setRawPermissions(permissions);

        // Generate overview report using the existing utility
        const report = generateAttendanceReport(
          attendance,
          permissions,
          targetEmployees,
          settings,
          { start: startDate, end: endDate }
        );

        setReportData(report);
      } catch (error) {
        console.error('Report generation error:', error);
        toast.error('حدث خطأ غير متوقع أثناء إنشاء التقرير');
      } finally {
        setDataLoading(false);
      }
    },
    [settings, employees, supabase]
  );

  // --- Handle filter apply ---
  const handleApplyFilters = (newFilters: ReportFilters) => {
    setFilters(newFilters);
    fetchReportData(newFilters);
  };

  // --- Get target employees for sub-reports ---
  const targetEmployees =
    filters.employeeIds.length > 0
      ? employees.filter((emp) => filters.employeeIds.includes(emp.id))
      : employees;

  // --- Auth/loading guards ---
  const isInitializing = authLoading || empLoading || settingsLoading;

  if (isInitializing) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="التقارير"
          description="عرض وتصدير تقارير الحضور والغياب والتأخير"
        />
        <ReportsSkeleton />
      </div>
    );
  }

  // Admin-only gate
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="التقارير" />
        <EmptyState
          icon={<ShieldAlert className="h-10 w-10 text-destructive" />}
          title="صلاحيات غير كافية"
          description="هذه الصفحة متاحة للمسؤولين فقط"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="التقارير"
        description="عرض وتصدير تقارير الحضور والغياب والتأخير والاستئذانات"
      >
        <ExcelExportButton
          startDate={filters.startDate}
          endDate={filters.endDate}
          employeeIds={
            filters.employeeIds.length > 0 ? filters.employeeIds : undefined
          }
          disabled={!reportData || reportData.length === 0}
        />
      </PageHeader>

      {/* Filters */}
      <ReportFiltersPanel
        employees={employees}
        filters={filters}
        onApply={handleApplyFilters}
        loading={dataLoading}
      />

      {/* Loading state */}
      {dataLoading && <ReportsSkeleton />}

      {/* Results with Tabs */}
      {!dataLoading && hasQueried && reportData !== null && reportData.length > 0 && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <Card>
            <CardContent className="p-2">
              <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
                {REPORT_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="flex items-center gap-1.5 text-xs sm:text-sm px-2 sm:px-3 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.shortLabel}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </CardContent>
          </Card>

          {/* Tab 1: Overview (existing report) */}
          <TabsContent value="overview" className="space-y-6">
            <ReportSummary data={reportData} />
            <ReportTable data={reportData} />
          </TabsContent>

          {/* Tab 2: Lateness Detail */}
          <TabsContent value="lateness">
            {settings && (
              <LatenessReport
                attendance={rawAttendance}
                employees={targetEmployees}
                settings={{
                  start_time: settings.start_time,
                  grace_minutes: settings.grace_minutes,
                }}
                startDate={filters.startDate}
                endDate={filters.endDate}
              />
            )}
          </TabsContent>

          {/* Tab 3: Absence */}
          <TabsContent value="absence">
            {settings && (
              <AbsenceReport
                attendance={rawAttendance}
                employees={targetEmployees}
                settings={{ workdays: settings.workdays }}
                startDate={filters.startDate}
                endDate={filters.endDate}
              />
            )}
          </TabsContent>

          {/* Tab 4: Permissions */}
          <TabsContent value="permissions">
            <PermissionsReport
              permissions={rawPermissions}
              employees={targetEmployees}
              startDate={filters.startDate}
              endDate={filters.endDate}
            />
          </TabsContent>

          {/* Tab 5: Individual Employee */}
          <TabsContent value="employee">
            {settings && (
              <EmployeeReport
                attendance={rawAttendance}
                permissions={rawPermissions}
                employees={targetEmployees}
                settings={{
                  start_time: settings.start_time,
                  end_time: settings.end_time,
                  grace_minutes: settings.grace_minutes,
                  workdays: settings.workdays,
                }}
                startDate={filters.startDate}
                endDate={filters.endDate}
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Empty state: queried but no data */}
      {!dataLoading && hasQueried && reportData !== null && reportData.length === 0 && (
        <EmptyState
          icon={<FileBarChart className="h-10 w-10 text-muted-foreground" />}
          title="لا توجد بيانات"
          description="لم يتم العثور على بيانات حضور للفترة والموظفين المحددين. جرّب تغيير الفلاتر."
        />
      )}

      {/* Initial state: haven't queried yet */}
      {!dataLoading && !hasQueried && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileBarChart className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">
              حدد الفترة والموظفين ثم اضغط &quot;عرض التقرير&quot;
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              يمكنك استخدام الفترات السريعة أو تحديد تاريخ مخصص
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
