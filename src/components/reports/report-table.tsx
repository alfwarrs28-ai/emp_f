'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { toArabicNumerals } from '@/lib/utils/date';
import type { ReportData } from '@/lib/utils/attendance-calc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey =
  | 'emp_no'
  | 'name'
  | 'presentDays'
  | 'absentDays'
  | 'excusedAbsentDays'
  | 'unexcusedAbsentDays'
  | 'totalLateMins'
  | 'netLateMins'
  | 'totalEarlyLeaveMins'
  | 'netEarlyLeaveMins'
  | 'totalPermMins';

type SortDir = 'asc' | 'desc';

interface ReportTableProps {
  data: ReportData[];
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: SortKey;
  label: string;
  shortLabel: string;
  getValue: (row: ReportData) => string | number;
  getNumericValue: (row: ReportData) => number;
  warn?: (row: ReportData) => 'red' | 'yellow' | null;
}

const columns: ColumnDef[] = [
  {
    key: 'emp_no',
    label: 'رقم الموظف',
    shortLabel: 'الرقم',
    getValue: (r) => r.employee.emp_no,
    getNumericValue: (r) => parseInt(r.employee.emp_no, 10) || 0,
  },
  {
    key: 'name',
    label: 'الاسم',
    shortLabel: 'الاسم',
    getValue: (r) => r.employee.name,
    getNumericValue: () => 0,
  },
  {
    key: 'presentDays',
    label: 'أيام الحضور',
    shortLabel: 'حضور',
    getValue: (r) => r.presentDays,
    getNumericValue: (r) => r.presentDays,
  },
  {
    key: 'absentDays',
    label: 'أيام الغياب',
    shortLabel: 'غياب',
    getValue: (r) => r.absentDays,
    getNumericValue: (r) => r.absentDays,
    warn: (r) => (r.absentDays >= 5 ? 'red' : r.absentDays >= 3 ? 'yellow' : null),
  },
  {
    key: 'excusedAbsentDays',
    label: 'غياب بعذر',
    shortLabel: 'بعذر',
    getValue: (r) => r.excusedAbsentDays,
    getNumericValue: (r) => r.excusedAbsentDays,
  },
  {
    key: 'unexcusedAbsentDays',
    label: 'غياب بدون عذر',
    shortLabel: 'بدون عذر',
    getValue: (r) => r.unexcusedAbsentDays,
    getNumericValue: (r) => r.unexcusedAbsentDays,
    warn: (r) => (r.unexcusedAbsentDays >= 3 ? 'red' : r.unexcusedAbsentDays >= 1 ? 'yellow' : null),
  },
  {
    key: 'totalLateMins',
    label: 'تأخر خام (دقيقة)',
    shortLabel: 'تأخر خام',
    getValue: (r) => r.totalLateMins,
    getNumericValue: (r) => r.totalLateMins,
    warn: (r) => (r.totalLateMins >= 60 ? 'red' : r.totalLateMins >= 30 ? 'yellow' : null),
  },
  {
    key: 'netLateMins',
    label: 'صافي التأخر',
    shortLabel: 'صافي تأخر',
    getValue: (r) => r.netLateMins,
    getNumericValue: (r) => r.netLateMins,
    warn: (r) => (r.netLateMins >= 60 ? 'red' : r.netLateMins >= 30 ? 'yellow' : null),
  },
  {
    key: 'totalEarlyLeaveMins',
    label: 'خروج مبكر خام',
    shortLabel: 'خروج خام',
    getValue: (r) => r.totalEarlyLeaveMins,
    getNumericValue: (r) => r.totalEarlyLeaveMins,
  },
  {
    key: 'netEarlyLeaveMins',
    label: 'صافي الخروج المبكر',
    shortLabel: 'صافي خروج',
    getValue: (r) => r.netEarlyLeaveMins,
    getNumericValue: (r) => r.netEarlyLeaveMins,
  },
  {
    key: 'totalPermMins',
    label: 'استئذانات أثناء الدوام',
    shortLabel: 'استئذانات',
    getValue: (r) => r.totalPermMins,
    getNumericValue: (r) => r.totalPermMins,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCellColor(warning: 'red' | 'yellow' | null): string {
  if (warning === 'red') return 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400';
  if (warning === 'yellow') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400';
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

// ---------------------------------------------------------------------------
// Mobile card view for a single row
// ---------------------------------------------------------------------------

function MobileCard({ row }: { row: ReportData }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-base">{row.employee.name}</p>
            <p className="text-xs text-muted-foreground">{row.employee.emp_no}</p>
          </div>
          <div className="flex gap-1.5">
            {row.absentDays >= 3 && (
              <Badge variant="destructive" className="text-xs">
                {toArabicNumerals(row.absentDays)} غياب
              </Badge>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">أيام الحضور</p>
            <p className="font-semibold">{toArabicNumerals(row.presentDays)}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">أيام الغياب</p>
            <p className={cn('font-semibold', row.absentDays >= 3 && 'text-red-600')}>
              {toArabicNumerals(row.absentDays)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">غياب بعذر</p>
            <p className="font-semibold">
              {toArabicNumerals(row.excusedAbsentDays)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">غياب بدون عذر</p>
            <p className={cn('font-semibold', row.unexcusedAbsentDays >= 1 && 'text-red-600')}>
              {toArabicNumerals(row.unexcusedAbsentDays)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">تأخر خام</p>
            <p className={cn('font-semibold', row.totalLateMins >= 30 && 'text-amber-600')}>
              {toArabicNumerals(row.totalLateMins)} د
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">صافي التأخر</p>
            <p className={cn('font-semibold', row.netLateMins >= 30 && 'text-amber-600')}>
              {toArabicNumerals(row.netLateMins)} د
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">خروج مبكر خام</p>
            <p className="font-semibold">
              {toArabicNumerals(row.totalEarlyLeaveMins)} د
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">صافي الخروج المبكر</p>
            <p className="font-semibold">
              {toArabicNumerals(row.netEarlyLeaveMins)} د
            </p>
          </div>
          <div className="col-span-2 rounded-lg bg-muted/50 p-2">
            <p className="text-xs text-muted-foreground">استئذانات أثناء الدوام</p>
            <p className="font-semibold">
              {toArabicNumerals(row.totalPermMins)} دقيقة
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main table component
// ---------------------------------------------------------------------------

export function ReportTable({ data }: ReportTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('emp_no');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;

    return [...data].sort((a, b) => {
      // For text columns (name, emp_no) use localeCompare
      if (sortKey === 'name') {
        const cmp = a.employee.name.localeCompare(b.employee.name, 'ar');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      if (sortKey === 'emp_no') {
        const cmp = a.employee.emp_no.localeCompare(b.employee.emp_no, 'ar', { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      }
      // Numeric columns
      const aVal = col.getNumericValue(a);
      const bVal = col.getNumericValue(b);
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortKey, sortDir]);

  // Calculate totals
  const totals = data.reduce(
    (acc, row) => ({
      presentDays: acc.presentDays + row.presentDays,
      absentDays: acc.absentDays + row.absentDays,
      excusedAbsentDays: acc.excusedAbsentDays + row.excusedAbsentDays,
      unexcusedAbsentDays: acc.unexcusedAbsentDays + row.unexcusedAbsentDays,
      totalLateMins: acc.totalLateMins + row.totalLateMins,
      netLateMins: acc.netLateMins + row.netLateMins,
      totalEarlyLeaveMins: acc.totalEarlyLeaveMins + row.totalEarlyLeaveMins,
      netEarlyLeaveMins: acc.netEarlyLeaveMins + row.netEarlyLeaveMins,
      totalPermMins: acc.totalPermMins + row.totalPermMins,
    }),
    {
      presentDays: 0,
      absentDays: 0,
      excusedAbsentDays: 0,
      unexcusedAbsentDays: 0,
      totalLateMins: 0,
      netLateMins: 0,
      totalEarlyLeaveMins: 0,
      netEarlyLeaveMins: 0,
      totalPermMins: 0,
    }
  );

  return (
    <>
      {/* Desktop table */}
      <div className="hidden lg:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {columns.map((col) => (
                    <TableHead
                      key={col.key}
                      className="cursor-pointer select-none whitespace-nowrap hover:bg-muted/80 transition-colors"
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{col.label}</span>
                        <SortIcon
                          active={sortKey === col.key}
                          direction={sortDir}
                        />
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {sortedData.map((row) => (
                  <TableRow key={row.employee.id}>
                    {columns.map((col) => {
                      const val = col.getValue(row);
                      const warning = col.warn?.(row) ?? null;
                      return (
                        <TableCell
                          key={col.key}
                          className={cn(
                            'whitespace-nowrap text-sm',
                            getCellColor(warning)
                          )}
                        >
                          {typeof val === 'number'
                            ? toArabicNumerals(val)
                            : val}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>

              <TableFooter>
                <TableRow className="font-bold bg-muted/70">
                  <TableCell>المجموع</TableCell>
                  <TableCell>
                    {toArabicNumerals(data.length)} موظف
                  </TableCell>
                  <TableCell>{toArabicNumerals(totals.presentDays)}</TableCell>
                  <TableCell>{toArabicNumerals(totals.absentDays)}</TableCell>
                  <TableCell>{toArabicNumerals(totals.excusedAbsentDays)}</TableCell>
                  <TableCell>{toArabicNumerals(totals.unexcusedAbsentDays)}</TableCell>
                  <TableCell>{toArabicNumerals(totals.totalLateMins)}</TableCell>
                  <TableCell>{toArabicNumerals(totals.netLateMins)}</TableCell>
                  <TableCell>{toArabicNumerals(totals.totalEarlyLeaveMins)}</TableCell>
                  <TableCell>{toArabicNumerals(totals.netEarlyLeaveMins)}</TableCell>
                  <TableCell>{toArabicNumerals(totals.totalPermMins)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile card view */}
      <div className="lg:hidden space-y-3">
        {sortedData.map((row) => (
          <MobileCard key={row.employee.id} row={row} />
        ))}

        {/* Mobile totals card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="font-bold text-base mb-3">
              المجموع ({toArabicNumerals(data.length)} موظف)
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">الحضور: </span>
                <span className="font-semibold">{toArabicNumerals(totals.presentDays)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">الغياب: </span>
                <span className="font-semibold">{toArabicNumerals(totals.absentDays)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">بعذر: </span>
                <span className="font-semibold">{toArabicNumerals(totals.excusedAbsentDays)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">بدون عذر: </span>
                <span className="font-semibold">{toArabicNumerals(totals.unexcusedAbsentDays)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">تأخر خام: </span>
                <span className="font-semibold">{toArabicNumerals(totals.totalLateMins)} د</span>
              </div>
              <div>
                <span className="text-muted-foreground">صافي تأخر: </span>
                <span className="font-semibold">{toArabicNumerals(totals.netLateMins)} د</span>
              </div>
              <div>
                <span className="text-muted-foreground">خروج مبكر: </span>
                <span className="font-semibold">{toArabicNumerals(totals.totalEarlyLeaveMins)} د</span>
              </div>
              <div>
                <span className="text-muted-foreground">صافي خروج: </span>
                <span className="font-semibold">{toArabicNumerals(totals.netEarlyLeaveMins)} د</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">استئذانات: </span>
                <span className="font-semibold">{toArabicNumerals(totals.totalPermMins)} دقيقة</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
