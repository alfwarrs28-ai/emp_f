'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface WorkHoursFormProps {
  startTime: string;
  endTime: string;
  graceMinutes: number;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onGraceMinutesChange: (value: number) => void;
  errors: Record<string, string>;
  disabled?: boolean;
}

export function WorkHoursForm({
  startTime,
  endTime,
  graceMinutes,
  onStartTimeChange,
  onEndTimeChange,
  onGraceMinutesChange,
  errors,
  disabled = false,
}: WorkHoursFormProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">ساعات الدوام</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Start Time */}
        <div className="space-y-2">
          <Label htmlFor="start_time">بداية الدوام</Label>
          <Input
            id="start_time"
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            disabled={disabled}
            className="text-right"
            dir="ltr"
          />
          {errors.start_time && (
            <p className="text-sm text-destructive">{errors.start_time}</p>
          )}
        </div>

        {/* End Time */}
        <div className="space-y-2">
          <Label htmlFor="end_time">نهاية الدوام</Label>
          <Input
            id="end_time"
            type="time"
            value={endTime}
            onChange={(e) => onEndTimeChange(e.target.value)}
            disabled={disabled}
            className="text-right"
            dir="ltr"
          />
          {errors.end_time && (
            <p className="text-sm text-destructive">{errors.end_time}</p>
          )}
        </div>
      </div>

      {/* Grace Minutes */}
      <div className="space-y-2 max-w-xs">
        <Label htmlFor="grace_minutes">فترة السماح بالدقائق</Label>
        <Input
          id="grace_minutes"
          type="number"
          min={0}
          max={120}
          value={graceMinutes}
          onChange={(e) => onGraceMinutesChange(parseInt(e.target.value) || 0)}
          disabled={disabled}
          dir="ltr"
          className="text-right"
        />
        {errors.grace_minutes && (
          <p className="text-sm text-destructive">{errors.grace_minutes}</p>
        )}
        <p className="text-xs text-muted-foreground">
          عدد الدقائق المسموح بها بعد وقت بداية الدوام قبل احتساب التأخير
        </p>
      </div>
    </div>
  );
}
