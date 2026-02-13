'use client';

import { useState, useMemo } from 'react';
import { ClipboardList, Clock, LogOut, Timer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils/cn';
import { toArabicNumerals, formatDateShort } from '@/lib/utils/date';
import type { Permission, Employee } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PermissionsReportProps {
  permissions: Permission[];
  employees: Employee[];
  startDate: string;
  endDate: string;
}

type ViewMode = 'summary' | 'detail';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  late_arrival: 'تأخر صباحي',
  early_leave: 'خروج مبكر',
  during_day: 'أثناء الدوام',
};

const STATUS_LABELS: Record<string, string> = {
  approved: 'موافق عليه',
  pending: 'قيد المراجعة',
  rejected: 'مرفوض',
};

const STATUS_COLORS: Record<string, string> = {
  approved:
    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
  pending:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
  rejected:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEmployeeName(empId: number, employees: Employee[]): string {
  return employees.find((e) => e.id === empId)?.name ?? `موظف #${empId}`;
}

function getEmployeeNo(empId: number, employees: Employee[]): string {
  return employees.find((e) => e.id === empId)?.emp_no ?? '-';
}

// ---------------------------------------------------------------------------
// Per-employee aggregation type
// ---------------------------------------------------------------------------

interface EmployeeSummary {
  empId: number;
  empNo: string;
  name: string;
  lateArrivalCount: number;
  lateArrivalMinutes: number;
  earlyLeaveCount: number;
  earlyLeaveMinutes: number;
  duringDayCount: number;
  duringDayMinutes: number;
  totalMinutes: number;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PermissionsReport({
  permissions,
  employees,
  startDate,
  endDate,
}: PermissionsReportProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('summary');

  // -------------------------------------------------------------------------
  // Summary cards data
  // -------------------------------------------------------------------------

  const summaryData = useMemo(() => {
    const totalCount = permissions.length;
    const approvedCount = permissions.filter(
      (p) => p.status === 'approved'
    ).length;
    const approvedMinutes = permissions
      .filter((p) => p.status === 'approved')
      .reduce((sum, p) => sum + p.minutes, 0);

    // Distribution by type (count all permissions)
    const typeCounts: Record<string, number> = {
      late_arrival: 0,
      early_leave: 0,
      during_day: 0,
    };
    for (const p of permissions) {
      typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
    }

    // Find the type with the most permissions
    let dominantType = 'late_arrival';
    let dominantCount = 0;
    for (const [type, count] of Object.entries(typeCounts)) {
      if (count > dominantCount) {
        dominantCount = count;
        dominantType = type;
      }
    }

    return {
      totalCount,
      approvedCount,
      approvedMinutes,
      dominantType,
      dominantCount,
    };
  }, [permissions]);

  // -------------------------------------------------------------------------
  // Per-employee summary (approved only)
  // -------------------------------------------------------------------------

  const employeeSummaries = useMemo(() => {
    const approvedPerms = permissions.filter((p) => p.status === 'approved');

    const map = new Map<number, EmployeeSummary>();

    for (const perm of approvedPerms) {
      let entry = map.get(perm.emp_id);
      if (!entry) {
        entry = {
          empId: perm.emp_id,
          empNo: getEmployeeNo(perm.emp_id, employees),
          name: getEmployeeName(perm.emp_id, employees),
          lateArrivalCount: 0,
          lateArrivalMinutes: 0,
          earlyLeaveCount: 0,
          earlyLeaveMinutes: 0,
          duringDayCount: 0,
          duringDayMinutes: 0,
          totalMinutes: 0,
        };
        map.set(perm.emp_id, entry);
      }

      switch (perm.type) {
        case 'late_arrival':
          entry.lateArrivalCount++;
          entry.lateArrivalMinutes += perm.minutes;
          break;
        case 'early_leave':
          entry.earlyLeaveCount++;
          entry.earlyLeaveMinutes += perm.minutes;
          break;
        case 'during_day':
          entry.duringDayCount++;
          entry.duringDayMinutes += perm.minutes;
          break;
      }
      entry.totalMinutes += perm.minutes;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.empNo.localeCompare(b.empNo, 'ar', { numeric: true })
    );
  }, [permissions, employees]);

  // -------------------------------------------------------------------------
  // Summary table totals
  // -------------------------------------------------------------------------

  const summaryTotals = useMemo(() => {
    return employeeSummaries.reduce(
      (acc, row) => ({
        lateArrivalCount: acc.lateArrivalCount + row.lateArrivalCount,
        lateArrivalMinutes: acc.lateArrivalMinutes + row.lateArrivalMinutes,
        earlyLeaveCount: acc.earlyLeaveCount + row.earlyLeaveCount,
        earlyLeaveMinutes: acc.earlyLeaveMinutes + row.earlyLeaveMinutes,
        duringDayCount: acc.duringDayCount + row.duringDayCount,
        duringDayMinutes: acc.duringDayMinutes + row.duringDayMinutes,
        totalMinutes: acc.totalMinutes + row.totalMinutes,
      }),
      {
        lateArrivalCount: 0,
        lateArrivalMinutes: 0,
        earlyLeaveCount: 0,
        earlyLeaveMinutes: 0,
        duringDayCount: 0,
        duringDayMinutes: 0,
        totalMinutes: 0,
      }
    );
  }, [employeeSummaries]);

  // -------------------------------------------------------------------------
  // Detail table data (all permissions, sorted by date desc)
  // -------------------------------------------------------------------------

  const detailRows = useMemo(() => {
    return [...permissions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [permissions]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Summary KPI cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total permissions */}
        <Card className="relative overflow-hidden">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-950">
              <ClipboardList className="h-6 w-6 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-bold tabular-nums leading-tight">
                {toArabicNumerals(summaryData.totalCount)}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                إجمالي الاستئذانات
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Approved count */}
        <Card className="relative overflow-hidden">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950">
              <Clock className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-bold tabular-nums leading-tight">
                {toArabicNumerals(summaryData.approvedCount)}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                الموافق عليها
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total approved minutes */}
        <Card className="relative overflow-hidden">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950">
              <Timer className="h-6 w-6 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl font-bold tabular-nums leading-tight">
                {toArabicNumerals(summaryData.approvedMinutes)}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                إجمالي الدقائق (الموافق عليها)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Dominant type */}
        <Card className="relative overflow-hidden">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950">
              <LogOut className="h-6 w-6 text-violet-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold leading-tight">
                {TYPE_LABELS[summaryData.dominantType] ?? summaryData.dominantType}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                الأكثر تكرارا ({toArabicNumerals(summaryData.dominantCount)})
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode('summary')}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            viewMode === 'summary'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          ملخص الموظفين
        </button>
        <button
          type="button"
          onClick={() => setViewMode('detail')}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            viewMode === 'detail'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          التفاصيل الكاملة
        </button>
      </div>

      {/* Summary view */}
      {viewMode === 'summary' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="whitespace-nowrap text-xs">
                    رقم الموظف
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-xs">
                    المعلم
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-xs text-center">
                    تأخر صباحي
                    <span className="block text-[10px] text-muted-foreground">
                      (عدد / دقائق)
                    </span>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-xs text-center">
                    خروج مبكر
                    <span className="block text-[10px] text-muted-foreground">
                      (عدد / دقائق)
                    </span>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-xs text-center">
                    أثناء الدوام
                    <span className="block text-[10px] text-muted-foreground">
                      (عدد / دقائق)
                    </span>
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-xs text-center">
                    الإجمالي (دقائق)
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {employeeSummaries.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      لا توجد استئذانات موافق عليها في هذه الفترة
                    </TableCell>
                  </TableRow>
                ) : (
                  employeeSummaries.map((row) => (
                    <TableRow key={row.empId}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {toArabicNumerals(row.empNo)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium">
                        {row.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-center">
                        {toArabicNumerals(row.lateArrivalCount)} /{' '}
                        {toArabicNumerals(row.lateArrivalMinutes)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-center">
                        {toArabicNumerals(row.earlyLeaveCount)} /{' '}
                        {toArabicNumerals(row.earlyLeaveMinutes)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-center">
                        {toArabicNumerals(row.duringDayCount)} /{' '}
                        {toArabicNumerals(row.duringDayMinutes)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-center font-bold">
                        {toArabicNumerals(row.totalMinutes)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>

              {employeeSummaries.length > 0 && (
                <TableFooter>
                  <TableRow className="font-bold bg-muted/70">
                    <TableCell>المجموع</TableCell>
                    <TableCell>
                      {toArabicNumerals(employeeSummaries.length)} موظف
                    </TableCell>
                    <TableCell className="text-center">
                      {toArabicNumerals(summaryTotals.lateArrivalCount)} /{' '}
                      {toArabicNumerals(summaryTotals.lateArrivalMinutes)}
                    </TableCell>
                    <TableCell className="text-center">
                      {toArabicNumerals(summaryTotals.earlyLeaveCount)} /{' '}
                      {toArabicNumerals(summaryTotals.earlyLeaveMinutes)}
                    </TableCell>
                    <TableCell className="text-center">
                      {toArabicNumerals(summaryTotals.duringDayCount)} /{' '}
                      {toArabicNumerals(summaryTotals.duringDayMinutes)}
                    </TableCell>
                    <TableCell className="text-center">
                      {toArabicNumerals(summaryTotals.totalMinutes)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Detail view */}
      {viewMode === 'detail' && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="whitespace-nowrap text-xs">
                    التاريخ
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-xs">
                    المعلم
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-xs">
                    النوع
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-xs text-center">
                    المدة (دقيقة)
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-xs">
                    السبب
                  </TableHead>
                  <TableHead className="whitespace-nowrap text-xs text-center">
                    الحالة
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {detailRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      لا توجد استئذانات في هذه الفترة
                    </TableCell>
                  </TableRow>
                ) : (
                  detailRows.map((perm) => (
                    <TableRow key={perm.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateShort(perm.date)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium">
                        {getEmployeeName(perm.emp_id, employees)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {TYPE_LABELS[perm.type] ?? perm.type}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-center">
                        {toArabicNumerals(perm.minutes)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {perm.reason ?? '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        <Badge
                          className={cn(
                            'text-xs',
                            STATUS_COLORS[perm.status]
                          )}
                        >
                          {STATUS_LABELS[perm.status] ?? perm.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
