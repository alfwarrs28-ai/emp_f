'use client';

import { useMemo } from 'react';
import { Clock, Timer, TrendingUp, UserX } from 'lucide-react';
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
import { toArabicNumerals } from '@/lib/utils/date';
import { calcLateMins, timeToMinutes } from '@/lib/utils/time';
import type { Attendance, Employee } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LatenessReportProps {
  attendance: Attendance[];
  employees: Employee[];
  settings: { start_time: string; grace_minutes: number };
  startDate: string;
  endDate: string;
}

interface LatenessDetail {
  id: number;
  date: string;
  empId: number;
  empNo: string;
  empName: string;
  inTime: string;
  expectedTime: string;
  lateMins: number;
  note: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLateDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${toArabicNumerals(hours)} \u0633 ${toArabicNumerals(mins)} \u062F`;
  if (hours > 0) return `${toArabicNumerals(hours)} \u0633`;
  return `${toArabicNumerals(mins)} \u062F`;
}

function getLateColor(minutes: number): 'red' | 'yellow' | null {
  if (minutes >= 60) return 'red';
  if (minutes >= 30) return 'yellow';
  return null;
}

function getCellColorClass(color: 'red' | 'yellow' | null): string {
  if (color === 'red') return 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400';
  if (color === 'yellow') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400';
  return '';
}

function getBadgeVariant(minutes: number): 'destructive' | 'secondary' {
  if (minutes >= 60) return 'destructive';
  return 'secondary';
}

// ---------------------------------------------------------------------------
// Summary KPI card
// ---------------------------------------------------------------------------

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
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}
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

// ---------------------------------------------------------------------------
// Mobile card for a single lateness record
// ---------------------------------------------------------------------------

function MobileLatenessCard({ record }: { record: LatenessDetail }) {
  const color = getLateColor(record.lateMins);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-base">{record.empName}</p>
            <p className="text-xs text-muted-foreground">{record.empNo}</p>
          </div>
          <Badge variant={getBadgeVariant(record.lateMins)} className="text-xs">
            {formatLateDuration(record.lateMins)}
          </Badge>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">{'\u0627\u0644\u062A\u0627\u0631\u064A\u062E'}</p>
            <p className="font-semibold">{toArabicNumerals(record.date)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">{'\u0648\u0642\u062A \u0627\u0644\u062D\u0636\u0648\u0631'}</p>
            <p className="font-semibold">{toArabicNumerals(record.inTime)}</p>
          </div>
          <div className={cn('rounded-lg p-2', getCellColorClass(color) || 'bg-muted/50')}>
            <p className="text-xs text-muted-foreground">{'\u0645\u062F\u0629 \u0627\u0644\u062A\u0623\u062E\u064A\u0631'}</p>
            <p className="font-semibold">{formatLateDuration(record.lateMins)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">{'\u0627\u0644\u0648\u0642\u062A \u0627\u0644\u0645\u062A\u0648\u0642\u0639'}</p>
            <p className="font-semibold">{toArabicNumerals(record.expectedTime)}</p>
          </div>
          {record.note && (
            <div className="col-span-2 rounded-lg bg-muted/50 p-2">
              <p className="text-xs text-muted-foreground">{'\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629'}</p>
              <p className="font-semibold">{record.note}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LatenessReport({
  attendance,
  employees,
  settings,
  startDate,
  endDate,
}: LatenessReportProps) {
  // Build employee lookup map
  const employeeMap = useMemo(() => {
    const map = new Map<number, Employee>();
    for (const emp of employees) {
      map.set(emp.id, emp);
    }
    return map;
  }, [employees]);

  // Build detail records: filter late arrivals and enrich with employee data
  const latenessRecords = useMemo(() => {
    const records: LatenessDetail[] = [];

    for (const att of attendance) {
      // Must have an in_time to evaluate lateness
      if (!att.in_time) continue;

      // Calculate late minutes using the utility (factors in grace)
      const lateMins = calcLateMins(att.in_time, settings.start_time, settings.grace_minutes);
      if (lateMins <= 0) continue;

      const emp = employeeMap.get(att.emp_id);

      // Compute display late duration: actual difference from start_time (ignoring grace)
      const displayLateMins = timeToMinutes(att.in_time) - timeToMinutes(settings.start_time);
      if (displayLateMins <= 0) continue;

      records.push({
        id: att.id,
        date: att.date,
        empId: att.emp_id,
        empNo: emp?.emp_no ?? '',
        empName: emp?.name ?? '',
        inTime: att.in_time,
        expectedTime: settings.start_time,
        lateMins: displayLateMins,
        note: att.note ?? '',
      });
    }

    // Sort by date descending, then by late duration descending
    records.sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      if (dateCmp !== 0) return dateCmp;
      return b.lateMins - a.lateMins;
    });

    return records;
  }, [attendance, employees, employeeMap, settings]);

  // Summary statistics
  const summary = useMemo(() => {
    const totalInstances = latenessRecords.length;
    const totalLateMins = latenessRecords.reduce((sum, r) => sum + r.lateMins, 0);
    const avgLateMins = totalInstances > 0 ? Math.round(totalLateMins / totalInstances) : 0;

    // Find most late employee
    const empCounts = new Map<number, { name: string; count: number }>();
    for (const r of latenessRecords) {
      const existing = empCounts.get(r.empId);
      if (existing) {
        existing.count++;
      } else {
        empCounts.set(r.empId, { name: r.empName, count: 1 });
      }
    }

    let mostLateEmployee = { name: '-', count: 0 };
    for (const entry of Array.from(empCounts.values())) {
      if (entry.count > mostLateEmployee.count) {
        mostLateEmployee = entry;
      }
    }

    return { totalInstances, totalLateMins, avgLateMins, mostLateEmployee };
  }, [latenessRecords]);

  // Footer totals formatted
  const totalLateDuration = formatLateDuration(summary.totalLateMins);

  if (latenessRecords.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <p className="text-muted-foreground text-lg">
            {'\u0644\u0627 \u062A\u0648\u062C\u062F \u062D\u0627\u0644\u0627\u062A \u062A\u0623\u062E\u064A\u0631 \u0641\u064A \u0627\u0644\u0641\u062A\u0631\u0629 \u0627\u0644\u0645\u062D\u062F\u062F\u0629'}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Summary KPI cards                                                  */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Clock className="h-6 w-6 text-amber-600" />}
          label={'\u0639\u062F\u062F \u062D\u0627\u0644\u0627\u062A \u0627\u0644\u062A\u0623\u062E\u064A\u0631'}
          value={toArabicNumerals(summary.totalInstances)}
          color="bg-amber-100 dark:bg-amber-950"
        />
        <KpiCard
          icon={<Timer className="h-6 w-6 text-red-600" />}
          label={'\u0625\u062C\u0645\u0627\u0644\u064A \u062F\u0642\u0627\u0626\u0642 \u0627\u0644\u062A\u0623\u062E\u064A\u0631'}
          value={toArabicNumerals(summary.totalLateMins)}
          color="bg-red-100 dark:bg-red-950"
        />
        <KpiCard
          icon={<TrendingUp className="h-6 w-6 text-blue-600" />}
          label={'\u0645\u062A\u0648\u0633\u0637 \u0627\u0644\u062A\u0623\u062E\u064A\u0631 \u0644\u0643\u0644 \u062D\u0627\u0644\u0629'}
          value={`${toArabicNumerals(summary.avgLateMins)} \u062F`}
          color="bg-blue-100 dark:bg-blue-950"
        />
        <KpiCard
          icon={<UserX className="h-6 w-6 text-violet-600" />}
          label={'\u0623\u0643\u062B\u0631 \u0645\u0648\u0638\u0641 \u062A\u0623\u062E\u064A\u0631\u0627\u064B'}
          value={
            summary.mostLateEmployee.count > 0
              ? `${summary.mostLateEmployee.name} (${toArabicNumerals(summary.mostLateEmployee.count)})`
              : '-'
          }
          color="bg-violet-100 dark:bg-violet-950"
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Desktop table                                                      */}
      {/* ----------------------------------------------------------------- */}
      <div className="hidden lg:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="whitespace-nowrap text-xs">{'\u0627\u0644\u062A\u0627\u0631\u064A\u062E'}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">{'\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0638\u0641'}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">{'\u0627\u0644\u0645\u0639\u0644\u0645'}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">{'\u0648\u0642\u062A \u0627\u0644\u062D\u0636\u0648\u0631'}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">{'\u0645\u062F\u0629 \u0627\u0644\u062A\u0623\u062E\u064A\u0631'}</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">{'\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0629'}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {latenessRecords.map((record) => {
                  const color = getLateColor(record.lateMins);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {toArabicNumerals(record.date)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {toArabicNumerals(record.empNo)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {record.empName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {toArabicNumerals(record.inTime)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'whitespace-nowrap text-sm font-medium',
                          getCellColorClass(color)
                        )}
                      >
                        {formatLateDuration(record.lateMins)}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {record.note || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

              <TableFooter>
                <TableRow className="font-bold bg-muted/70">
                  <TableCell>{'\u0627\u0644\u0645\u062C\u0645\u0648\u0639'}</TableCell>
                  <TableCell>
                    {toArabicNumerals(latenessRecords.length)} {'\u062D\u0627\u0644\u0629'}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell>{totalLateDuration}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Mobile card view                                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="lg:hidden space-y-3">
        {latenessRecords.map((record) => (
          <MobileLatenessCard key={record.id} record={record} />
        ))}

        {/* Mobile totals card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="font-bold text-base mb-3">
              {'\u0627\u0644\u0645\u062C\u0645\u0648\u0639'} ({toArabicNumerals(latenessRecords.length)} {'\u062D\u0627\u0644\u0629'})
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">{'\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062A\u0623\u062E\u064A\u0631'}: </span>
                <span className="font-semibold">{totalLateDuration}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{'\u0645\u062A\u0648\u0633\u0637 \u0627\u0644\u062A\u0623\u062E\u064A\u0631'}: </span>
                <span className="font-semibold">{toArabicNumerals(summary.avgLateMins)} {'\u062F'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
