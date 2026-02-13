'use client';

import { motion } from 'framer-motion';
import { Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { toArabicNumerals } from '@/lib/utils/date';

interface AttendanceSummaryProps {
  presentCount: number;
  lateCount: number;
  totalCount: number;
}

interface SummaryItem {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

export function AttendanceSummary({ presentCount, lateCount, totalCount }: AttendanceSummaryProps) {
  const items: SummaryItem[] = [
    {
      label: 'حاضر في الوقت',
      count: presentCount,
      icon: <Users className="h-4 w-4" />,
      color: 'text-green-700 dark:text-green-400',
      bgColor: 'bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-900',
    },
    {
      label: 'متأخر',
      count: lateCount,
      icon: <Clock className="h-4 w-4" />,
      color: 'text-yellow-700 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/50 dark:border-yellow-900',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
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
            <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
