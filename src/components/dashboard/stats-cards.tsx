'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserCheck,
  UserX,
  Clock,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { toArabicNumerals } from '@/lib/utils/date';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatsData {
  presentToday: number;
  absentToday: number;
  lateToday: number;
  permissionsToday: number;
  totalEmployees: number;
}

interface StatCardConfig {
  key: keyof Omit<StatsData, 'totalEmployees'>;
  label: string;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
  iconBgClass: string;
}

// ---------------------------------------------------------------------------
// Card configurations
// ---------------------------------------------------------------------------

const STAT_CARDS: StatCardConfig[] = [
  {
    key: 'presentToday',
    label: 'الحاضرون اليوم',
    icon: UserCheck,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'border-emerald-200 dark:border-emerald-800',
    iconBgClass: 'bg-emerald-100 dark:bg-emerald-900/50',
  },
  {
    key: 'absentToday',
    label: 'الغائبون اليوم',
    icon: UserX,
    colorClass: 'text-red-600 dark:text-red-400',
    bgClass: 'border-red-200 dark:border-red-800',
    iconBgClass: 'bg-red-100 dark:bg-red-900/50',
  },
  {
    key: 'lateToday',
    label: 'المتأخرون اليوم',
    icon: Clock,
    colorClass: 'text-amber-600 dark:text-amber-400',
    bgClass: 'border-amber-200 dark:border-amber-800',
    iconBgClass: 'bg-amber-100 dark:bg-amber-900/50',
  },
  {
    key: 'permissionsToday',
    label: 'الاستئذانات اليوم',
    icon: ClipboardList,
    colorClass: 'text-blue-600 dark:text-blue-400',
    bgClass: 'border-blue-200 dark:border-blue-800',
    iconBgClass: 'bg-blue-100 dark:bg-blue-900/50',
  },
];

// ---------------------------------------------------------------------------
// Animated counter hook
// ---------------------------------------------------------------------------

function useCountUp(target: number, duration = 800): number {
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Always animate when target changes
    if (target === 0) {
      setCount(0);
      return;
    }

    const startTime = performance.now();
    let rafId: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      setCount(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    hasAnimated.current = true;

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [target, duration]);

  return count;
}

// ---------------------------------------------------------------------------
// Individual stat card
// ---------------------------------------------------------------------------

function StatCard({
  config,
  value,
  total,
  index,
}: {
  config: StatCardConfig;
  value: number;
  total: number;
  index: number;
}) {
  const animatedCount = useCountUp(value);
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className={cn('transition-shadow hover:shadow-md', config.bgClass)}>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                config.iconBgClass,
              )}
            >
              <Icon className={cn('h-6 w-6', config.colorClass)} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground truncate">{config.label}</p>
              <div className="flex items-baseline gap-2">
                <span className={cn('text-3xl font-bold tabular-nums', config.colorClass)}>
                  {toArabicNumerals(animatedCount)}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({toArabicNumerals(percentage)}%)
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stats Cards Grid
// ---------------------------------------------------------------------------

interface StatsCardsProps {
  data: StatsData;
  className?: string;
}

export function StatsCards({ data, className }: StatsCardsProps) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {STAT_CARDS.map((config, index) => (
        <StatCard
          key={config.key}
          config={config}
          value={data[config.key]}
          total={data.totalEmployees}
          index={index}
        />
      ))}
    </div>
  );
}
