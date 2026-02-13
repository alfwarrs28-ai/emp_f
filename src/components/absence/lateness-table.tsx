'use client';

import { memo, useCallback, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { TimeInput } from '@/components/shared/time-input';
import { cn } from '@/lib/utils/cn';
import { toArabicNumerals } from '@/lib/utils/date';
import { calcLateMins } from '@/lib/utils/time';
import { UserCheck } from 'lucide-react';
import type { Settings } from '@/types/database';

export interface LatenessRowData {
  emp_id: number;
  employeeName: string;
  in_time: string | null;
  lateMins: number;
  note: string | null;
}

interface LatenessTableProps {
  rows: LatenessRowData[];
  loading: boolean;
  settings: Settings;
  onTimeChange: (empId: number, time: string | null) => void;
  onNoteChange: (empId: number, note: string | null) => void;
  searchQuery: string;
}

// ----- Memoized lateness row -----
interface LatenessRowProps {
  data: LatenessRowData;
  index: number;
  onTimeChange: (empId: number, time: string | null) => void;
  onNoteChange: (empId: number, note: string | null) => void;
}

function LatenessRowInner({
  data,
  index,
  onTimeChange,
  onNoteChange,
}: LatenessRowProps) {
  const handleTimeChange = useCallback(
    (time: string | null) => {
      onTimeChange(data.emp_id, time);
    },
    [data.emp_id, onTimeChange]
  );

  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onNoteChange(data.emp_id, e.target.value || null);
    },
    [data.emp_id, onNoteChange]
  );

  return (
    <tr className="border-b transition-colors hover:bg-muted/50">
      {/* Row number */}
      <td className="px-2 py-2 text-center text-sm text-muted-foreground w-10">
        {toArabicNumerals(index + 1)}
      </td>

      {/* Employee name */}
      <td className="px-2 py-2 text-sm font-medium whitespace-nowrap min-w-[140px]">
        {data.employeeName}
      </td>

      {/* In time */}
      <td className="px-2 py-2">
        <TimeInput
          value={data.in_time}
          onTimeChange={handleTimeChange}
          placeholder="الحضور"
        />
      </td>

      {/* Late minutes */}
      <td className="px-2 py-2">
        <span
          className={cn(
            'text-sm font-medium',
            data.lateMins > 0
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-500 dark:text-gray-400'
          )}
        >
          {toArabicNumerals(data.lateMins)} د
        </span>
      </td>

      {/* Note */}
      <td className="px-2 py-2">
        <Input
          type="text"
          value={data.note || ''}
          onChange={handleNoteChange}
          placeholder="ملاحظة"
          className="h-9 text-sm min-w-[100px]"
        />
      </td>
    </tr>
  );
}

const LatenessRow = memo(LatenessRowInner);

// ----- Mobile card -----
function MobileLatenessCard({
  row,
  index,
  onTimeChange,
  onNoteChange,
}: {
  row: LatenessRowData;
  index: number;
  onTimeChange: (empId: number, time: string | null) => void;
  onNoteChange: (empId: number, note: string | null) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 space-y-3">
        {/* Header: name + late badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              {toArabicNumerals(index + 1)}
            </span>
            <span className="font-medium text-sm">{row.employeeName}</span>
          </div>
          <span
            className={cn(
              'text-sm font-medium',
              row.lateMins > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400'
            )}
          >
            {toArabicNumerals(row.lateMins)} د
          </span>
        </div>

        {/* Time input + Note */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              وقت الحضور
            </label>
            <TimeInput
              value={row.in_time}
              onTimeChange={(t) => onTimeChange(row.emp_id, t)}
              placeholder="الحضور"
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              ملاحظة
            </label>
            <Input
              type="text"
              value={row.note || ''}
              onChange={(e) =>
                onNoteChange(row.emp_id, e.target.value || null)
              }
              placeholder="ملاحظة"
              className="h-9 text-sm"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ----- Loading skeleton -----
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2">
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-9 w-24" />
        </div>
      ))}
    </div>
  );
}

export function LatenessTable({
  rows,
  loading,
  settings,
  onTimeChange,
  onNoteChange,
  searchQuery,
}: LatenessTableProps) {
  // Filter rows by search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => row.employeeName.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<UserCheck className="h-10 w-10 text-muted-foreground" />}
        title="لا توجد بيانات لهذا اليوم"
        description="لا يوجد موظفون مسجلون لهذا التاريخ"
      />
    );
  }

  if (filteredRows.length === 0 && searchQuery.trim()) {
    return (
      <EmptyState
        title="لا توجد نتائج"
        description="لم يتم العثور على موظفين بهذا الاسم"
      />
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-right">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-3 text-center text-xs font-medium text-muted-foreground w-10">
                #
              </th>
              <th className="px-2 py-3 text-xs font-medium text-muted-foreground min-w-[140px]">
                الموظف
              </th>
              <th className="px-2 py-3 text-xs font-medium text-muted-foreground w-24">
                وقت الحضور
              </th>
              <th className="px-2 py-3 text-xs font-medium text-muted-foreground w-24">
                دقائق التأخر
              </th>
              <th className="px-2 py-3 text-xs font-medium text-muted-foreground min-w-[100px]">
                ملاحظة
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => (
              <LatenessRow
                key={row.emp_id}
                data={row}
                index={idx}
                onTimeChange={onTimeChange}
                onNoteChange={onNoteChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filteredRows.map((row, idx) => (
          <MobileLatenessCard
            key={row.emp_id}
            row={row}
            index={idx}
            onTimeChange={onTimeChange}
            onNoteChange={onNoteChange}
          />
        ))}
      </div>
    </>
  );
}
