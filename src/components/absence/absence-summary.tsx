'use client';

import { motion } from 'framer-motion';
import { Users, UserCheck, UserX, ShieldAlert, ShieldX } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { toArabicNumerals } from '@/lib/utils/date';

interface AbsenceSummaryProps {
  totalEmployees: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  unexcusedCount: number;
}

interface SummaryItem {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export function AbsenceSummary({
  totalEmployees,
  presentCount,
  absentCount,
  excusedCount,
  unexcusedCount,
}: AbsenceSummaryProps) {
  const items: SummaryItem[] = [
    {
      label: 'إجمالي الموظفين',
      count: totalEmployees,
      icon: <Users className="h-4 w-4" />,
      color: 'text-blue-700 dark:text-blue-400',
      bgColor:
        'bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-900',
    },
    {
      label: 'حاضرون',
      count: presentCount,
      icon: <UserCheck className="h-4 w-4" />,
      color: 'text-green-700 dark:text-green-400',
      bgColor:
        'bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-900',
    },
    {
      label: 'غائبون',
      count: absentCount,
      icon: <UserX className="h-4 w-4" />,
      color: 'text-red-700 dark:text-red-400',
      bgColor:
        'bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-900',
    },
    {
      label: 'بعذر',
      count: excusedCount,
      icon: <ShieldAlert className="h-4 w-4" />,
      color: 'text-orange-700 dark:text-orange-400',
      bgColor:
        'bg-orange-50 border-orange-200 dark:bg-orange-950/50 dark:border-orange-900',
    },
    {
      label: 'بدون عذر',
      count: unexcusedCount,
      icon: <ShieldX className="h-4 w-4" />,
      color: 'text-red-800 dark:text-red-300',
      bgColor:
        'bg-red-100 border-red-300 dark:bg-red-950/70 dark:border-red-800',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <motion.div
          key={item.label}
          layout
          className={cn(
            'flex items-center gap-3 rounded-lg border px-3 py-2.5',
            item.bgColor
          )}
        >
          <div className={cn('shrink-0', item.color)}>{item.icon}</div>
          <div className="min-w-0">
            <motion.p
              key={item.count}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className={cn('text-lg font-bold leading-none', item.color)}
            >
              {toArabicNumerals(item.count)}
            </motion.p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {item.label}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
