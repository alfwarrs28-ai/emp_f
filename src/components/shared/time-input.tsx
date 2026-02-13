'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { quickTimeFormat } from '@/lib/utils/time';
import { cn } from '@/lib/utils/cn';

interface TimeInputProps {
  value: string | null;
  onTimeChange: (time: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Called when user presses Tab or Enter to move to next field */
  onMoveNext?: () => void;
  /** Called when user presses Shift+Tab to move to previous field */
  onMovePrev?: () => void;
}

export function TimeInput({
  value,
  onTimeChange,
  placeholder = '00:00',
  className,
  disabled = false,
  onMoveNext,
  onMovePrev,
}: TimeInputProps) {
  const [rawValue, setRawValue] = useState(value || '');
  const [isFocused, setIsFocused] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    if (!isFocused) {
      setRawValue(value || '');
    }
  }, [value, isFocused]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setIsInvalid(false);
    // Show raw digits for easy editing
    if (value) {
      setRawValue(value.replace(':', ''));
    }
    // Select all text on focus for quick replacement
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
  }, [value]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);

    const trimmed = rawValue.trim();

    // Empty = clear
    if (!trimmed) {
      setRawValue('');
      setIsInvalid(false);
      onTimeChange(null);
      return;
    }

    // Try to format
    const formatted = quickTimeFormat(trimmed);

    if (formatted) {
      setRawValue(formatted);
      setIsInvalid(false);
      onTimeChange(formatted);
    } else {
      // Invalid input
      setIsInvalid(true);
      // Revert to previous valid value
      setRawValue(value || '');
    }
  }, [rawValue, value, onTimeChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Allow only digits and colon
      const val = e.target.value.replace(/[^\d:]/g, '');
      setRawValue(val);
      setIsInvalid(false);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
        // Format on Enter, then move to next field
        if (e.key === 'Enter') {
          e.preventDefault();
          inputRef.current?.blur();
          onMoveNext?.();
        }
        // Tab naturally moves, but we blur first to trigger format
        if (e.key === 'Tab' && !e.shiftKey) {
          // Allow default Tab behavior but trigger blur first
          handleBlur();
          onMoveNext?.();
        }
      }

      if (e.key === 'Tab' && e.shiftKey) {
        handleBlur();
        onMovePrev?.();
      }
    },
    [handleBlur, onMoveNext, onMovePrev]
  );

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      dir="ltr"
      value={rawValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={5}
      className={cn(
        'w-20 text-center font-mono tabular-nums',
        isInvalid && 'border-red-500 focus-visible:ring-red-500',
        className
      )}
    />
  );
}
