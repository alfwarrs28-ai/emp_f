'use client';

import { useMemo } from 'react';
import { AttendanceRow } from './attendance-row';
import type { AttendanceRowData } from './attendance-row';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { CalendarX } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttendanceTableProps {
  rows: AttendanceRowData[];
  loading: boolean;
  startTime: string;
  onMarkLate: (empId: number) => void;
  onCancelLate: (empId: number) => void;
  onNoteChange: (empId: number, note: string | null) => void;
  onTimeChange: (empId: number, time: string | null) => void;
  searchQuery: string;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2">
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-9 w-20" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile card for a single row
// ---------------------------------------------------------------------------

function MobileAttendanceCard({
  row,
  index,
  startTime,
  onMarkLate,
  onCancelLate,
  onNoteChange,
  onTimeChange,
}: {
  row: AttendanceRowData;
  index: number;
  startTime: string;
  onMarkLate: (empId: number) => void;
  onCancelLate: (empId: number) => void;
  onNoteChange: (empId: number, note: string | null) => void;
  onTimeChange: (empId: number, time: string | null) => void;
}) {
  // We render the same row component inside a single-row table for consistency,
  // but for mobile we use a simplified card layout instead.
  // Re-use the same logic inline to keep the card lightweight.

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right">
        <tbody>
          <AttendanceRow
            data={row}
            index={index}
            startTime={startTime}
            onMarkLate={onMarkLate}
            onCancelLate={onCancelLate}
            onNoteChange={onNoteChange}
            onTimeChange={onTimeChange}
          />
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main table component
// ---------------------------------------------------------------------------

export function AttendanceTable({
  rows,
  loading,
  startTime,
  onMarkLate,
  onCancelLate,
  onNoteChange,
  onTimeChange,
  searchQuery,
}: AttendanceTableProps) {
  // Filter rows by search query
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => row.employeeName.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  // ---- Loading state ----
  if (loading) {
    return <LoadingSkeleton />;
  }

  // ---- Empty: no records at all ----
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<CalendarX className="h-10 w-10 text-muted-foreground" />}
        title="لا توجد بيانات حضور لهذا اليوم"
        description='اضغط على "تجهيز اليوم" لانشاء سجلات الحضور للموظفين'
      />
    );
  }

  // ---- Empty: search returned nothing ----
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
      {/* ===== Desktop table ===== */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-right">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-3 text-center text-xs font-medium text-muted-foreground w-10">
                #
              </th>
              <th className="px-2 py-3 text-xs font-medium text-muted-foreground min-w-[140px]">
                المعلم
              </th>
              <th className="px-2 py-3 text-xs font-medium text-muted-foreground w-28">
                الحالة
              </th>
              <th className="px-2 py-3 text-xs font-medium text-muted-foreground">
                الإجراء
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => (
              <AttendanceRow
                key={row.emp_id}
                data={row}
                index={idx}
                startTime={startTime}
                onMarkLate={onMarkLate}
                onCancelLate={onCancelLate}
                onNoteChange={onNoteChange}
                onTimeChange={onTimeChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== Mobile cards ===== */}
      <div className="md:hidden space-y-2">
        {filteredRows.map((row, idx) => (
          <MobileAttendanceCard
            key={row.emp_id}
            row={row}
            index={idx}
            startTime={startTime}
            onMarkLate={onMarkLate}
            onCancelLate={onCancelLate}
            onNoteChange={onNoteChange}
            onTimeChange={onTimeChange}
          />
        ))}
      </div>
    </>
  );
}
