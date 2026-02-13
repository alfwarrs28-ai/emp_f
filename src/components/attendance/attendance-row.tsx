'use client';

import { memo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TimeInput } from '@/components/shared/time-input';
import { cn } from '@/lib/utils/cn';
import { toArabicNumerals } from '@/lib/utils/date';
import { timeToMinutes } from '@/lib/utils/time';
import { Clock, X, CheckCircle2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttendanceRowData {
  emp_id: number;
  employeeName: string;
  in_time: string | null; // null = present on time, has value = late
  note: string | null;
}

interface AttendanceRowProps {
  data: AttendanceRowData;
  index: number;
  startTime: string; // from settings e.g. "07:00"
  onMarkLate: (empId: number) => void;
  onCancelLate: (empId: number) => void;
  onNoteChange: (empId: number, note: string | null) => void;
  onTimeChange: (empId: number, time: string | null) => void;
}

// ---------------------------------------------------------------------------
// Style constants
// ---------------------------------------------------------------------------

const PRESENT_BADGE =
  'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800';

const LATE_BADGE =
  'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the Arabic late-duration label.
 * Examples:
 *   lateMinutes = 75  => "متأخر ١ س ١٥ د"
 *   lateMinutes = 30  => "متأخر ٣٠ د"
 */
function formatLateDuration(lateMinutes: number): string {
  const hours = Math.floor(lateMinutes / 60);
  const mins = lateMinutes % 60;

  if (hours > 0 && mins > 0) {
    return `متأخر ${toArabicNumerals(hours)} س ${toArabicNumerals(mins)} د`;
  }
  if (hours > 0) {
    return `متأخر ${toArabicNumerals(hours)} س`;
  }
  return `متأخر ${toArabicNumerals(mins)} د`;
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const rowContentVariants = {
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 8 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AttendanceRowInner({
  data,
  index,
  startTime,
  onMarkLate,
  onCancelLate,
  onNoteChange,
  onTimeChange,
}: AttendanceRowProps) {
  const isLate = data.in_time !== null;

  // Calculate late minutes only when the teacher is late
  const lateMinutes = isLate
    ? timeToMinutes(data.in_time!) - timeToMinutes(startTime)
    : 0;

  // ---- Callbacks ----

  const handleMarkLate = useCallback(() => {
    onMarkLate(data.emp_id);
  }, [data.emp_id, onMarkLate]);

  const handleCancelLate = useCallback(() => {
    onCancelLate(data.emp_id);
  }, [data.emp_id, onCancelLate]);

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
      {/* # */}
      <td className="px-2 py-2 text-center text-sm text-muted-foreground w-10">
        {toArabicNumerals(index + 1)}
      </td>

      {/* Employee name */}
      <td className="px-2 py-2 text-sm font-medium whitespace-nowrap min-w-[140px]">
        {data.employeeName}
      </td>

      {/* Status badge */}
      <td className="px-2 py-2">
        <AnimatePresence mode="wait">
          {isLate ? (
            <motion.div
              key="late"
              variants={rowContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <Badge
                variant="outline"
                className={cn('whitespace-nowrap text-xs gap-1', LATE_BADGE)}
              >
                <Clock className="h-3 w-3" />
                {lateMinutes > 0
                  ? formatLateDuration(lateMinutes)
                  : 'متأخر'}
              </Badge>
            </motion.div>
          ) : (
            <motion.div
              key="present"
              variants={rowContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <Badge
                variant="outline"
                className={cn('whitespace-nowrap text-xs gap-1', PRESENT_BADGE)}
              >
                <CheckCircle2 className="h-3 w-3" />
                حاضر
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
      </td>

      {/* Action column */}
      <td className="px-2 py-2">
        <AnimatePresence mode="wait">
          {isLate ? (
            <motion.div
              key="late-actions"
              variants={rowContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              {/* Arrival time — editable */}
              <TimeInput
                value={data.in_time}
                onTimeChange={handleTimeChange}
                placeholder="الحضور"
                className="w-20"
              />

              {/* Note input */}
              <Input
                type="text"
                value={data.note || ''}
                onChange={handleNoteChange}
                placeholder="سبب التأخير"
                maxLength={500}
                className="h-8 text-sm min-w-[120px] max-w-[200px]"
              />

              {/* Cancel late button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelLate}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                <X className="h-3.5 w-3.5 ml-1" />
                إلغاء
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="present-action"
              variants={rowContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkLate}
                className="h-8 text-xs"
              >
                <Clock className="h-3.5 w-3.5 ml-1" />
                تأخير
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </td>
    </tr>
  );
}

export const AttendanceRow = memo(AttendanceRowInner);
