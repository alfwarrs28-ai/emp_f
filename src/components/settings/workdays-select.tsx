'use client';

import { DAYS_AR } from '@/lib/utils/constants';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface WorkdaysSelectProps {
  /** Comma-separated day indices, e.g. "0,1,2,3,4" */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function WorkdaysSelect({
  value,
  onChange,
  error,
  disabled = false,
}: WorkdaysSelectProps) {
  // Parse the comma-separated string to a Set of numbers
  const selectedDays = new Set(
    value
      .split(',')
      .filter(Boolean)
      .map(Number)
  );

  const handleToggle = (dayIndex: number) => {
    const updated = new Set(selectedDays);
    if (updated.has(dayIndex)) {
      updated.delete(dayIndex);
    } else {
      updated.add(dayIndex);
    }

    // Sort and join as comma-separated string
    const sorted = Array.from(updated).sort((a, b) => a - b);
    onChange(sorted.join(','));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">أيام العمل</h3>
      <p className="text-sm text-muted-foreground">
        اختر الأيام التي يعمل فيها الموظفون
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {DAYS_AR.map((dayName, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => !disabled && handleToggle(index)}
          >
            <Checkbox
              id={`day-${index}`}
              checked={selectedDays.has(index)}
              onCheckedChange={() => handleToggle(index)}
              disabled={disabled}
            />
            <Label
              htmlFor={`day-${index}`}
              className="cursor-pointer text-sm font-medium"
            >
              {dayName}
            </Label>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        الأيام المحددة: {selectedDays.size === 0 ? 'لم يتم اختيار أي يوم' : Array.from(selectedDays).sort((a, b) => a - b).map((d) => DAYS_AR[d]).join('، ')}
      </p>
    </div>
  );
}
