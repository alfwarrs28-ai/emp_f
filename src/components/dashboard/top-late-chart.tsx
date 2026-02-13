'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  type TooltipProps,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toArabicNumerals } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopLateEmployee {
  name: string;
  totalLateMins: number;
}

interface TopLateChartProps {
  data: TopLateEmployee[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Color gradient (yellow to red for top 5)
// ---------------------------------------------------------------------------

const BAR_COLORS = [
  '#ef4444', // red-500 (most late)
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#eab308', // yellow-500
  '#fbbf24', // amber-400 (least late)
];

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0];
  const value = entry.value ?? 0;
  const name = entry.payload?.name ?? '';

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-medium text-muted-foreground mb-1">{name}</p>
      <p className="text-sm font-bold">
        دقائق التأخر: <span className="text-amber-600">{toArabicNumerals(value)}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopLateChart({ data, className }: TopLateChartProps) {
  // Sort descending and take top 5
  const sorted = [...data]
    .sort((a, b) => b.totalLateMins - a.totalLateMins)
    .slice(0, 5);

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          أكثر ٥ موظفين تأخرًا
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            لا توجد بيانات للفترة المحددة
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sorted}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  className="stroke-muted"
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  tickFormatter={(v: number) => toArabicNumerals(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="totalLateMins"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={28}
                >
                  {sorted.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={BAR_COLORS[index] || BAR_COLORS[BAR_COLORS.length - 1]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
