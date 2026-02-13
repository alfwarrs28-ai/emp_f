'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils/cn';
import { getTodaySaudi, formatDateAr } from '@/lib/utils/date';

interface DatePickerArProps {
  value?: string; // "YYYY-MM-DD"
  onDateChange: (date: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function DatePickerAr({
  value,
  onDateChange,
  className,
  placeholder = 'اختر التاريخ',
  disabled = false,
}: DatePickerArProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    value ? parseISO(value) : parseISO(getTodaySaudi())
  );

  useEffect(() => {
    if (value) {
      setSelectedDate(parseISO(value));
    }
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      const formatted = format(date, 'yyyy-MM-dd');
      onDateChange(formatted);
      setOpen(false);
    }
  };

  const displayText = selectedDate
    ? formatDateAr(selectedDate)
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start text-right font-normal',
            !selectedDate && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="ml-2 h-4 w-4" />
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          locale={ar}
          defaultMonth={selectedDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
