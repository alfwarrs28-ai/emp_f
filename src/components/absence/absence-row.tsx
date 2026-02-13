'use client';

import { memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { toArabicNumerals } from '@/lib/utils/date';

export interface AbsenceRowData {
  emp_id: number;
  employeeName: string;
  isAbsent: boolean;
  absenceType: 'excused_absence' | 'unexcused_absence' | null;
  note: string | null;
}

interface AbsenceRowProps {
  data: AbsenceRowData;
  index: number;
  onToggleAbsence: (empId: number) => void;
  onTypeChange: (empId: number, type: 'excused_absence' | 'unexcused_absence') => void;
  onNoteChange: (empId: number, note: string | null) => void;
}

function AbsenceRowInner({
  data,
  index,
  onToggleAbsence,
  onTypeChange,
  onNoteChange,
}: AbsenceRowProps) {
  const handleToggle = useCallback(() => {
    onToggleAbsence(data.emp_id);
  }, [data.emp_id, onToggleAbsence]);

  const handleExcused = useCallback(() => {
    onTypeChange(data.emp_id, 'excused_absence');
  }, [data.emp_id, onTypeChange]);

  const handleUnexcused = useCallback(() => {
    onTypeChange(data.emp_id, 'unexcused_absence');
  }, [data.emp_id, onTypeChange]);

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

      {/* Status badge (clickable) */}
      <td className="px-2 py-2">
        <motion.div
          key={data.isAbsent ? 'absent' : 'present'}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <Badge
            variant="outline"
            className={cn(
              'whitespace-nowrap text-xs cursor-pointer select-none',
              data.isAbsent
                ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800'
                : 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800'
            )}
            onClick={handleToggle}
          >
            {data.isAbsent ? 'غائب' : 'حاضر'}
          </Badge>
        </motion.div>
      </td>

      {/* Absence type (inline segmented buttons) */}
      <td className="px-2 py-2">
        <AnimatePresence mode="wait">
          {data.isAbsent && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1 overflow-hidden"
            >
              <Button
                variant={data.absenceType === 'excused_absence' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={handleExcused}
              >
                بعذر
              </Button>
              <Button
                variant={data.absenceType === 'unexcused_absence' ? 'destructive' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2"
                onClick={handleUnexcused}
              >
                بدون عذر
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </td>

      {/* Note */}
      <td className="px-2 py-2">
        <AnimatePresence mode="wait">
          {data.isAbsent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Input
                type="text"
                value={data.note || ''}
                onChange={handleNoteChange}
                placeholder="ملاحظة"
                maxLength={500}
                className="h-9 text-sm min-w-[100px]"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </td>
    </tr>
  );
}

export const AbsenceRow = memo(AbsenceRowInner);
