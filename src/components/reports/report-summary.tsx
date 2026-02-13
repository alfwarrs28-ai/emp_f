'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  CalendarDays,
  CalendarCheck2,
  CalendarX2,
  Clock,
  LogOut,
  ClipboardList,
  ShieldAlert,
  ShieldX,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toArabicNumerals } from '@/lib/utils/date';
import type { ReportData } from '@/lib/utils/attendance-calc';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportSummaryProps {
  data: ReportData[];
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  delay?: number;
}

// ---------------------------------------------------------------------------
// Animated counter hook
// ---------------------------------------------------------------------------

function useCountUp(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    if (target === 0) {
      setCount(0);
      return;
    }

    let startTime: number | null = null;
    let rafId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration, isInView]);

  return { count, ref };
}

// ---------------------------------------------------------------------------
// Single KPI card
// ---------------------------------------------------------------------------

function KpiCard({ icon, label, value, color, delay = 0 }: KpiCardProps) {
  const { count, ref } = useCountUp(value);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="relative overflow-hidden">
        <CardContent className="flex items-center gap-4 p-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-bold tabular-nums leading-tight">
              {toArabicNumerals(count)}
            </p>
            <p className="text-sm text-muted-foreground truncate">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Summary component
// ---------------------------------------------------------------------------

export function ReportSummary({ data }: ReportSummaryProps) {
  // Aggregate totals across all employees
  const totals = data.reduce(
    (acc, row) => ({
      totalDays: acc.totalDays + row.totalDays,
      presentDays: acc.presentDays + row.presentDays,
      absentDays: acc.absentDays + row.absentDays,
      excusedAbsentDays: acc.excusedAbsentDays + row.excusedAbsentDays,
      unexcusedAbsentDays: acc.unexcusedAbsentDays + row.unexcusedAbsentDays,
      totalLateMins: acc.totalLateMins + row.totalLateMins,
      totalEarlyLeaveMins: acc.totalEarlyLeaveMins + row.totalEarlyLeaveMins,
      totalPermMins: acc.totalPermMins + row.totalPermMins,
    }),
    {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      excusedAbsentDays: 0,
      unexcusedAbsentDays: 0,
      totalLateMins: 0,
      totalEarlyLeaveMins: 0,
      totalPermMins: 0,
    }
  );

  const kpis = [
    {
      icon: <CalendarDays className="h-6 w-6 text-blue-600" />,
      label: 'إجمالي أيام العمل',
      value: totals.totalDays,
      color: 'bg-blue-100 dark:bg-blue-950',
    },
    {
      icon: <CalendarCheck2 className="h-6 w-6 text-emerald-600" />,
      label: 'إجمالي أيام الحضور',
      value: totals.presentDays,
      color: 'bg-emerald-100 dark:bg-emerald-950',
    },
    {
      icon: <CalendarX2 className="h-6 w-6 text-red-600" />,
      label: 'إجمالي أيام الغياب',
      value: totals.absentDays,
      color: 'bg-red-100 dark:bg-red-950',
    },
    {
      icon: <ShieldAlert className="h-6 w-6 text-orange-600" />,
      label: 'غياب بعذر',
      value: totals.excusedAbsentDays,
      color: 'bg-orange-100 dark:bg-orange-950',
    },
    {
      icon: <ShieldX className="h-6 w-6 text-red-600" />,
      label: 'غياب بدون عذر',
      value: totals.unexcusedAbsentDays,
      color: 'bg-red-100 dark:bg-red-950',
    },
    {
      icon: <Clock className="h-6 w-6 text-amber-600" />,
      label: 'إجمالي دقائق التأخر',
      value: totals.totalLateMins,
      color: 'bg-amber-100 dark:bg-amber-950',
    },
    {
      icon: <LogOut className="h-6 w-6 text-orange-600" />,
      label: 'إجمالي دقائق الخروج المبكر',
      value: totals.totalEarlyLeaveMins,
      color: 'bg-orange-100 dark:bg-orange-950',
    },
    {
      icon: <ClipboardList className="h-6 w-6 text-violet-600" />,
      label: 'إجمالي دقائق الاستئذانات',
      value: totals.totalPermMins,
      color: 'bg-violet-100 dark:bg-violet-950',
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi, index) => (
        <KpiCard
          key={kpi.label}
          icon={kpi.icon}
          label={kpi.label}
          value={kpi.value}
          color={kpi.color}
          delay={index * 0.08}
        />
      ))}
    </div>
  );
}
