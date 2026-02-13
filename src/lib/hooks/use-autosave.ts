'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

interface UseAutosaveOptions {
  debounceMs?: number;
  enabled?: boolean;
}

export function useAutosave<T>(
  value: T,
  saveFn: (value: T) => Promise<void>,
  options: UseAutosaveOptions = {}
) {
  const { debounceMs = 800, enabled = true } = options;
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevValueRef = useRef<T>(value);
  const isFirstRender = useRef(true);

  const save = useCallback(async (val: T) => {
    if (!navigator.onLine) {
      setSaveStatus('offline');
      return;
    }

    setSaveStatus('saving');
    try {
      await saveFn(val);
      setSaveStatus('saved');
      // Reset to idle after 2 seconds
      savedTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [saveFn]);

  useEffect(() => {
    // Skip first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevValueRef.current = value;
      return;
    }

    if (!enabled) return;

    // Check if value actually changed
    if (JSON.stringify(value) === JSON.stringify(prevValueRef.current)) {
      return;
    }
    prevValueRef.current = value;

    // Clear previous timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    // Debounce the save
    timeoutRef.current = setTimeout(() => {
      save(value);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, enabled, debounceMs, save]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const forceSave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    save(prevValueRef.current);
  }, [save]);

  return { saveStatus, forceSave };
}
