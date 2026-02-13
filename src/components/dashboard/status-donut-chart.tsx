'use client';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
  type TooltipProps,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toArabicNumerals } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StatusDistribution {
  name: string;   // Arabic label
  value: number;  // count
  color: string;
}

interface StatusDonutChartProps {
  data: StatusDistribution[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Status colors
// ---------------------------------------------------------------------------

export const STATUS_COLORS: Record<string, string> = {
  'حاضر في الوقت': '#22c55e',  // green-500
  'متأخر': '#f59e0b',          // amber-500
  'غائب': '#ef4444',           // red-500
  'غائب بعذر': '#f97316',     // orange-500
  'غائب بدون عذر': '#dc2626',  // red-600
  'بدون خروج': '#9ca3af',     // gray-400
};

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0];
  const name = entry.name ?? '';
  const value = entry.value ?? 0;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <div className="flex items-center gap-2">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: entry.payload?.color || '#ccc' }}
        />
        <span className="text-sm font-medium">{name}</span>
      </div>
      <p className="text-sm font-bold mt-1">
        العدد: {toArabicNumerals(value)}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom Legend
// ---------------------------------------------------------------------------

function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null;

  return (
    <div className="flex flex-wrap justify-center gap-4 mt-2">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-1.5">
          <div
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom center label for the donut
// ---------------------------------------------------------------------------

function CenterLabel({ viewBox, total }: { viewBox?: { cx: number; cy: number }; total: number }) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;

  return (
    <g>
      <text
        x={cx}
        y={cy - 8}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground"
        fontSize="24"
        fontWeight="bold"
      >
        {toArabicNumerals(total)}
      </text>
      <text
        x={cx}
        y={cy + 16}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-muted-foreground"
        fontSize="12"
      >
        إجمالي السجلات
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatusDonutChart({ data, className }: StatusDonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          توزيع حالات الحضور
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            لا توجد بيانات للفترة المحددة
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={0}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <Label
                    content={<CenterLabel total={total} />}
                    position="center"
                  />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  content={<CustomLegend />}
                  verticalAlign="bottom"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
