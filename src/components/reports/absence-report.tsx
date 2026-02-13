'use client';

import { useMemo, useState } from 'react';
import { CalendarX2, ShieldAlert, ShieldX, UserX, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
import { toArabicNumerals, isWorkday, getDaysInRange, formatDateShort } from '@/lib/utils/date';
import type { Attendance, Employee } from '@/types/database';

// =============================================================================
// Types
// =============================================================================

interface AbsenceReportProps {
  attendance: Attendance[];
  employees: Employee[];
  settings: { workdays: string };
  startDate: string;
  endDate: string;
}

type AbsenceType = 'excused_absence' | 'unexcused_absence' | 'general';

interface EmployeeAbsenceSummary {
  employee: Employee;
  totalAbsent: number;
  excusedAbsent: number;
  unexcusedAbsent: number;
  absentDates: { date: string; type: AbsenceType; note: string | null }[];
}

interface AbsenceDetailRow {
  date: string;
  employee: Employee;
  type: AbsenceType;
  note: string | null;
}

type SummarySortKey = 'emp_no' | 'name' | 'totalAbsent' | 'excusedAbsent' | 'unexcusedAbsent';
type DetailSortKey = 'date' | 'emp_no' | 'name' | 'type';
type SortDir = 'asc' | 'desc';

// =============================================================================
// Helpers
// =============================================================================

function classifyAbsence(noteType: string | null): AbsenceType {
  if (noteType === 'excused_absence') return 'excused_absence';
  if (noteType === 'unexcused_absence') return 'unexcused_absence';
  return 'general';
}

function getAbsenceBadge(type: AbsenceType) {
  switch (type) {
    case 'excused_absence':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
          بعذر
        </Badge>
      );
    case 'unexcused_absence':
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950 dark:text-red-400 dark:border-red-800">
          بدون عذر
        </Badge>
      );
    default:
      return (
        <Badge className="bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700">
          غياب
        </Badge>
      );
  }
}

function getRowColor(totalAbsent: number): string {
  if (totalAbsent >= 5) return 'bg-red-50 dark:bg-red-950/30';
  if (totalAbsent >= 3) return 'bg-amber-50 dark:bg-amber-950/30';
  return '';
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  return direction === 'asc' ? (
    <ArrowUp className="h-3.5 w-3.5 text-primary" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-primary" />
  );
}

// =============================================================================
// Summary KPI Card
// =============================================================================

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            color
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
          <p className="text-sm text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Mobile card for per-employee summary
// =============================================================================

function EmployeeMobileCard({ summary }: { summary: EmployeeAbsenceSummary }) {
  return (
    <Card className={cn('overflow-hidden', getRowColor(summary.totalAbsent))}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-base">{summary.employee.name}</p>
            <p className="text-xs text-muted-foreground">{summary.employee.emp_no}</p>
          </div>
          {summary.totalAbsent >= 3 && (
            <Badge variant="destructive" className="text-xs">
              {toArabicNumerals(summary.totalAbsent)} غياب
            </Badge>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">إجمالي الغياب</p>
            <p className={cn('font-semibold', summary.totalAbsent >= 3 && 'text-red-600')}>
              {toArabicNumerals(summary.totalAbsent)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">غياب بعذر</p>
            <p className="font-semibold">{toArabicNumerals(summary.excusedAbsent)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">غياب بدون عذر</p>
            <p className={cn('font-semibold', summary.unexcusedAbsent >= 1 && 'text-red-600')}>
              {toArabicNumerals(summary.unexcusedAbsent)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AbsenceReport({
  attendance,
  employees,
  settings,
  startDate,
  endDate,
}: AbsenceReportProps) {
  const [summarySortKey, setSummarySortKey] = useState<SummarySortKey>('totalAbsent');
  const [summarySortDir, setSummarySortDir] = useState<SortDir>('desc');
  const [detailSortKey, setDetailSortKey] = useState<DetailSortKey>('date');
  const [detailSortDir, setDetailSortDir] = useState<SortDir>('desc');

  // ---------------------------------------------------------------------------
  // Core computation: build per-employee summaries and flat detail list
  // ---------------------------------------------------------------------------

  const { summaries, details, totals } = useMemo(() => {
    // 1. Get all workdays in the range
    const allDays = getDaysInRange(startDate, endDate);
    const workdays = allDays.filter((date) => isWorkday(date, settings.workdays));

    // 2. Build a lookup map: `${emp_id}-${date}` -> Attendance
    const attendanceMap = new Map<string, Attendance>();
    for (const record of attendance) {
      const key = `${record.emp_id}-${record.date}`;
      attendanceMap.set(key, record);
    }

    // 3. For each employee, check each workday
    const employeeSummaries: EmployeeAbsenceSummary[] = [];
    const allDetails: AbsenceDetailRow[] = [];

    for (const emp of employees) {
      const absentDates: { date: string; type: AbsenceType; note: string | null }[] = [];

      for (const day of workdays) {
        const key = `${emp.id}-${day}`;
        const record = attendanceMap.get(key);

        // Absent if no record or no in_time
        if (!record || !record.in_time) {
          const noteType = record?.note_type ?? null;
          const type = classifyAbsence(noteType);
          const note = record?.note ?? null;

          absentDates.push({ date: day, type, note });
          allDetails.push({ date: day, employee: emp, type, note });
        }
      }

      if (absentDates.length > 0) {
        employeeSummaries.push({
          employee: emp,
          totalAbsent: absentDates.length,
          excusedAbsent: absentDates.filter((d) => d.type === 'excused_absence').length,
          unexcusedAbsent: absentDates.filter((d) => d.type === 'unexcused_absence').length,
          absentDates,
        });
      }
    }

    // 4. Compute totals
    const totalAbsent = allDetails.length;
    const totalExcused = allDetails.filter((d) => d.type === 'excused_absence').length;
    const totalUnexcused = allDetails.filter((d) => d.type === 'unexcused_absence').length;

    // 5. Employee with most absences
    let mostAbsentEmployee: EmployeeAbsenceSummary | null = null;
    for (const s of employeeSummaries) {
      if (!mostAbsentEmployee || s.totalAbsent > mostAbsentEmployee.totalAbsent) {
        mostAbsentEmployee = s;
      }
    }

    return {
      summaries: employeeSummaries,
      details: allDetails,
      totals: {
        totalAbsent,
        totalExcused,
        totalUnexcused,
        mostAbsentEmployee,
      },
    };
  }, [attendance, employees, settings.workdays, startDate, endDate]);

  // ---------------------------------------------------------------------------
  // Sorted summaries
  // ---------------------------------------------------------------------------

  const sortedSummaries = useMemo(() => {
    return [...summaries].sort((a, b) => {
      let cmp = 0;
      switch (summarySortKey) {
        case 'emp_no':
          cmp = a.employee.emp_no.localeCompare(b.employee.emp_no, 'ar', { numeric: true });
          break;
        case 'name':
          cmp = a.employee.name.localeCompare(b.employee.name, 'ar');
          break;
        case 'totalAbsent':
          cmp = a.totalAbsent - b.totalAbsent;
          break;
        case 'excusedAbsent':
          cmp = a.excusedAbsent - b.excusedAbsent;
          break;
        case 'unexcusedAbsent':
          cmp = a.unexcusedAbsent - b.unexcusedAbsent;
          break;
      }
      return summarySortDir === 'asc' ? cmp : -cmp;
    });
  }, [summaries, summarySortKey, summarySortDir]);

  // ---------------------------------------------------------------------------
  // Sorted details
  // ---------------------------------------------------------------------------

  const sortedDetails = useMemo(() => {
    return [...details].sort((a, b) => {
      let cmp = 0;
      switch (detailSortKey) {
        case 'date':
          cmp = a.date.localeCompare(b.date);
          break;
        case 'emp_no':
          cmp = a.employee.emp_no.localeCompare(b.employee.emp_no, 'ar', { numeric: true });
          break;
        case 'name':
          cmp = a.employee.name.localeCompare(b.employee.name, 'ar');
          break;
        case 'type': {
          const typeOrder: Record<AbsenceType, number> = {
            unexcused_absence: 0,
            general: 1,
            excused_absence: 2,
          };
          cmp = typeOrder[a.type] - typeOrder[b.type];
          break;
        }
      }
      return detailSortDir === 'asc' ? cmp : -cmp;
    });
  }, [details, detailSortKey, detailSortDir]);

  // ---------------------------------------------------------------------------
  // Sort handlers
  // ---------------------------------------------------------------------------

  const handleSummarySort = (key: SummarySortKey) => {
    if (summarySortKey === key) {
      setSummarySortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSummarySortKey(key);
      setSummarySortDir('asc');
    }
  };

  const handleDetailSort = (key: DetailSortKey) => {
    if (detailSortKey === key) {
      setDetailSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setDetailSortKey(key);
      setDetailSortDir('desc');
    }
  };

  // ---------------------------------------------------------------------------
  // Summary totals row
  // ---------------------------------------------------------------------------

  const summaryTotals = useMemo(() => {
    return summaries.reduce(
      (acc, s) => ({
        totalAbsent: acc.totalAbsent + s.totalAbsent,
        excusedAbsent: acc.excusedAbsent + s.excusedAbsent,
        unexcusedAbsent: acc.unexcusedAbsent + s.unexcusedAbsent,
      }),
      { totalAbsent: 0, excusedAbsent: 0, unexcusedAbsent: 0 }
    );
  }, [summaries]);

  // ---------------------------------------------------------------------------
  // Summary column definitions
  // ---------------------------------------------------------------------------

  const summaryColumns: {
    key: SummarySortKey;
    label: string;
  }[] = [
    { key: 'emp_no', label: 'رقم الموظف' },
    { key: 'name', label: 'المعلم' },
    { key: 'totalAbsent', label: 'إجمالي الغياب' },
    { key: 'excusedAbsent', label: 'غياب بعذر' },
    { key: 'unexcusedAbsent', label: 'غياب بدون عذر' },
  ];

  // ---------------------------------------------------------------------------
  // Detail column definitions
  // ---------------------------------------------------------------------------

  const detailColumns: {
    key: DetailSortKey;
    label: string;
  }[] = [
    { key: 'date', label: 'التاريخ' },
    { key: 'emp_no', label: 'رقم الموظف' },
    { key: 'name', label: 'المعلم' },
    { key: 'type', label: 'نوع الغياب' },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* A) Summary KPI cards                                              */}
      {/* ================================================================= */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<CalendarX2 className="h-6 w-6 text-red-600" />}
          label="إجمالي حالات الغياب"
          value={toArabicNumerals(totals.totalAbsent)}
          color="bg-red-100 dark:bg-red-950"
        />
        <KpiCard
          icon={<ShieldAlert className="h-6 w-6 text-emerald-600" />}
          label="غياب بعذر"
          value={toArabicNumerals(totals.totalExcused)}
          color="bg-emerald-100 dark:bg-emerald-950"
        />
        <KpiCard
          icon={<ShieldX className="h-6 w-6 text-red-600" />}
          label="غياب بدون عذر"
          value={toArabicNumerals(totals.totalUnexcused)}
          color="bg-red-100 dark:bg-red-950"
        />
        <KpiCard
          icon={<UserX className="h-6 w-6 text-orange-600" />}
          label="أكثر موظف غياباً"
          value={
            totals.mostAbsentEmployee
              ? `${totals.mostAbsentEmployee.employee.name} (${toArabicNumerals(totals.mostAbsentEmployee.totalAbsent)})`
              : '—'
          }
          color="bg-orange-100 dark:bg-orange-950"
        />
      </div>

      {/* ================================================================= */}
      {/* B) Per-employee summary table                                     */}
      {/* ================================================================= */}
      <div>
        <h3 className="text-lg font-semibold mb-3">ملخص الغياب حسب الموظف</h3>

        {sortedSummaries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              لا يوجد حالات غياب في الفترة المحددة
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        {summaryColumns.map((col) => (
                          <TableHead
                            key={col.key}
                            className="cursor-pointer select-none whitespace-nowrap hover:bg-muted/80 transition-colors"
                            onClick={() => handleSummarySort(col.key)}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs">{col.label}</span>
                              <SortIcon
                                active={summarySortKey === col.key}
                                direction={summarySortDir}
                              />
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {sortedSummaries.map((summary) => (
                        <TableRow
                          key={summary.employee.id}
                          className={getRowColor(summary.totalAbsent)}
                        >
                          <TableCell className="whitespace-nowrap text-sm">
                            {summary.employee.emp_no}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm font-medium">
                            {summary.employee.name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm font-bold">
                            {toArabicNumerals(summary.totalAbsent)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {toArabicNumerals(summary.excusedAbsent)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">
                            {toArabicNumerals(summary.unexcusedAbsent)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>

                    <TableFooter>
                      <TableRow className="font-bold bg-muted/70">
                        <TableCell>المجموع</TableCell>
                        <TableCell>
                          {toArabicNumerals(sortedSummaries.length)} موظف
                        </TableCell>
                        <TableCell>{toArabicNumerals(summaryTotals.totalAbsent)}</TableCell>
                        <TableCell>{toArabicNumerals(summaryTotals.excusedAbsent)}</TableCell>
                        <TableCell>{toArabicNumerals(summaryTotals.unexcusedAbsent)}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Mobile card view */}
            <div className="lg:hidden space-y-3">
              {sortedSummaries.map((summary) => (
                <EmployeeMobileCard key={summary.employee.id} summary={summary} />
              ))}

              {/* Mobile totals card */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <p className="font-bold text-base mb-3">
                    المجموع ({toArabicNumerals(sortedSummaries.length)} موظف)
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">إجمالي الغياب: </span>
                      <span className="font-semibold">
                        {toArabicNumerals(summaryTotals.totalAbsent)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">بعذر: </span>
                      <span className="font-semibold">
                        {toArabicNumerals(summaryTotals.excusedAbsent)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">بدون عذر: </span>
                      <span className="font-semibold">
                        {toArabicNumerals(summaryTotals.unexcusedAbsent)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* ================================================================= */}
      {/* C) Detail table                                                   */}
      {/* ================================================================= */}
      {sortedDetails.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">تفاصيل الغياب</h3>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {detailColumns.map((col) => (
                      <TableHead
                        key={col.key}
                        className="cursor-pointer select-none whitespace-nowrap hover:bg-muted/80 transition-colors"
                        onClick={() => handleDetailSort(col.key)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{col.label}</span>
                          <SortIcon
                            active={detailSortKey === col.key}
                            direction={detailSortDir}
                          />
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="whitespace-nowrap">
                      <span className="text-xs">الملاحظة</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {sortedDetails.map((row, index) => (
                    <TableRow key={`${row.employee.id}-${row.date}-${index}`}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateShort(row.date)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {row.employee.emp_no}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm font-medium">
                        {row.employee.name}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {getAbsenceBadge(row.type)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {row.note || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
