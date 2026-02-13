'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Settings } from '@/types/database';
import type { SettingsFormValues } from '@/lib/utils/validation';
import { toast } from 'sonner';

interface UseSettingsReturn {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  updateSettings: (data: SettingsFormValues) => Promise<boolean>;
}

// Module-level singleton client
const supabase = createClient();

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();

      if (fetchError) {
        const msg = 'حدث خطأ أثناء جلب الإعدادات';
        setError(msg);
        toast.error(msg);
        return;
      }

      setSettings(data as Settings);
    } catch {
      const msg = 'حدث خطأ غير متوقع أثناء جلب الإعدادات';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(
    async (data: SettingsFormValues): Promise<boolean> => {
      try {
        const { error: updateError } = await supabase
          .from('settings')
          .update({
            start_time: data.start_time,
            end_time: data.end_time,
            grace_minutes: data.grace_minutes,
            workdays: data.workdays,
            updated_at: new Date().toISOString(),
          })
          .eq('id', 1);

        if (updateError) {
          toast.error('حدث خطأ أثناء حفظ الإعدادات');
          return false;
        }

        toast.success('تم حفظ الإعدادات بنجاح');
        return true;
      } catch {
        toast.error('حدث خطأ غير متوقع');
        return false;
      }
    },
    []
  );

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSettings,
  };
}
