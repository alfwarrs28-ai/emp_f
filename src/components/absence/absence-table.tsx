'use client';

import { useMemo } from 'react';
import { AbsenceRow, type AbsenceRowData } from './absence-row';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { toArabicNumerals } from '@/lib/utils/date';
import { UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AbsenceTableProps {
  rows: AbsenceRowData[];
  loading: boolean;
  onToggleAbsence: (empId: number) => void;
  onTypeChange: (empId: number, type: 'excused_absence' | 'unexcused_absence') => void;
  onNoteChange: (empId: number, note: string | null) => void;
  searchQuery: string;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2">
          <Skeleton className="h-5 w-8" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      ))}
    </div>
  );
}

// ----- Mobile card for a single row -----
function MobileAbsenceCard({
  row,
  index,
  onToggleAbsence,
  onTypeChange,
  onNoteChange,
}: {
  row: AbsenceRowData;
  index: number;
  onToggleAbsence: (empId: number) => void;
  onTypeChange: (empId: number, type: 'excused_absence' | 'unexcused_absence') => void;
  onNoteChange: (empId: number, note: string | null) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 space-y-3">
        {/* Header: name + status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              {toArabicNumerals(index + 1)}
            </span>
            <span className="font-medium text-sm">{row.employeeName}</span>
          </div>
          <motion.div
            key={row.isAbsent ? 'absent' : 'present'}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
          >
            <Badge
              variant="outline"
              className={cn(
                'text-xs cursor-pointer select-none',
                row.isAbsent
                  ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800'
                  : 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
              )}
              onClick={() => onToggleAbsence(row.emp_id)}
            >
              {row.isAbsent ? 'غائب' : 'حاضر'}
            </Badge>
          </motion.div>
        </div>

        {/* Absence details */}
        <AnimatePresence>
          {row.isAbsent && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2 overflow-hidden"
            >
              {/* Type selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">نوع الغياب:</span>
                <div className="flex gap-1">
                  <Button
                    variant={row.absenceType === 'excused_absence' ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => onTypeChange(row.emp_id, 'excused_absence')}
                  >
                    بعذر
                  </Button>
                  <Button
                    variant={row.absenceType === 'unexcused_absence' ? 'destructive' : 'outline'}
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => onTypeChange(row.emp_id, 'unexcused_absence')}
                  >
                    بدون عذر
                  </Button>
                </div>
              </div>

              {/* Note */}
              <Input
                type="text"
                value={row.note || ''}
                onChange={(e) => onNoteChange(row.emp_id, e.target.value || null)}
                placeholder="ملاحظة"
                className="h-9 text-sm"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export function AbsenceTable({
  rows,
  loading,
  onToggleAbsence,
  onTypeChange,
  onNoteChange,
  searchQuery,
}: AbsenceTableProps) {
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
              <th className="px-2 py-3 text-xs font-medium text-muted-foreground w-20">
                الحالة
              </th>
              <th className="px-2 py-3 text-xs font-medium text-muted-foreground w-40">
                نوع الغياب
              </th>
              <th className="px-2 py-3 text-xs font-medium text-muted-foreground min-w-[100px]">
                ملاحظة
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => (
              <AbsenceRow
                key={row.emp_id}
                data={row}
                index={idx}
                onToggleAbsence={onToggleAbsence}
                onTypeChange={onTypeChange}
                onNoteChange={onNoteChange}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {filteredRows.map((row, idx) => (
          <MobileAbsenceCard
            key={row.emp_id}
            row={row}
            index={idx}
            onToggleAbsence={onToggleAbsence}
            onTypeChange={onTypeChange}
            onNoteChange={onNoteChange}
          />
        ))}
      </div>
    </>
  );
}
