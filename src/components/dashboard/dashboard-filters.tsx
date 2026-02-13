'use client';

import { useState, useMemo, useCallback } from 'react';
import { format, parseISO, startOfYear, endOfYear } from 'date-fns';
import { Button } from '@/components/ui/button';
import { DatePickerAr } from '@/components/shared/date-picker-ar';
import { cn } from '@/lib/utils/cn';
import { getTodaySaudi, getMonthRange } from '@/lib/utils/date';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateFilter {
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
}

interface DashboardFiltersProps {
  onFilterChange: (filter: DateFilter) => void;
  className?: string;
}

type PresetKey =
  | 'this_week'
  | 'this_month'
  | 'first_half'
  | 'second_half'
  | 'this_year'
  | 'custom';

interface Preset {
  key: PresetKey;
  label: string;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

const PRESETS: Preset[] = [
  { key: 'this_week', label: 'هذا الأسبوع' },
  { key: 'this_month', label: 'هذا الشهر' },
  { key: 'first_half', label: 'النصف الأول' },
  { key: 'second_half', label: 'النصف الثاني' },
  { key: 'this_year', label: 'هذه السنة' },
  { key: 'custom', label: 'مدى مخصص' },
];

// ---------------------------------------------------------------------------
// Helper: compute date range for a preset
// ---------------------------------------------------------------------------

function getPresetRange(key: PresetKey): DateFilter | null {
  const today = getTodaySaudi();
  const todayDate = parseISO(today);
  const year = todayDate.getFullYear();

  switch (key) {
    case 'this_week': {
      // Saudi work week: Sunday-Thursday
      const dayOfWeek = todayDate.getDay(); // 0=Sun
      const sunday = new Date(todayDate);
      sunday.setDate(todayDate.getDate() - dayOfWeek);
      const thursday = new Date(sunday);
      thursday.setDate(sunday.getDate() + 4);
      return {
        startDate: format(sunday, 'yyyy-MM-dd'),
        endDate: format(thursday, 'yyyy-MM-dd'),
      };
    }
    case 'this_month': {
      const month = todayDate.getMonth() + 1;
      const range = getMonthRange(year, month);
      return { startDate: range.start, endDate: range.end };
    }
    case 'first_half': {
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-06-30`,
      };
    }
    case 'second_half': {
      return {
        startDate: `${year}-07-01`,
        endDate: `${year}-12-31`,
      };
    }
    case 'this_year': {
      return {
        startDate: format(startOfYear(todayDate), 'yyyy-MM-dd'),
        endDate: format(endOfYear(todayDate), 'yyyy-MM-dd'),
      };
    }
    case 'custom':
      return null; // custom shows date pickers
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardFilters({ onFilterChange, className }: DashboardFiltersProps) {
  const defaultRange = useMemo(() => {
    const today = parseISO(getTodaySaudi());
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    return getMonthRange(year, month);
  }, []);

  const [activePreset, setActivePreset] = useState<PresetKey>('this_month');
  const [customStart, setCustomStart] = useState(defaultRange.start);
  const [customEnd, setCustomEnd] = useState(defaultRange.end);

  const handlePresetClick = useCallback(
    (preset: PresetKey) => {
      setActivePreset(preset);

      if (preset === 'custom') {
        // Keep current custom dates, don't fire callback yet
        return;
      }

      const range = getPresetRange(preset);
      if (range) {
        onFilterChange(range);
      }
    },
    [onFilterChange],
  );

  const handleCustomStartChange = useCallback(
    (date: string) => {
      setCustomStart(date);
      onFilterChange({ startDate: date, endDate: customEnd });
    },
    [customEnd, onFilterChange],
  );

  const handleCustomEndChange = useCallback(
    (date: string) => {
      setCustomEnd(date);
      onFilterChange({ startDate: customStart, endDate: date });
    },
    [customStart, onFilterChange],
  );

  return (
    <div className={cn('space-y-3', className)}>
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.key}
            variant={activePreset === preset.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => handlePresetClick(preset.key)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {/* Custom date pickers */}
      {activePreset === 'custom' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">من</span>
          <DatePickerAr
            value={customStart}
            onDateChange={handleCustomStartChange}
            className="w-full sm:w-auto"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">إلى</span>
          <DatePickerAr
            value={customEnd}
            onDateChange={handleCustomEndChange}
            className="w-full sm:w-auto"
          />
        </div>
      )}
    </div>
  );
}
