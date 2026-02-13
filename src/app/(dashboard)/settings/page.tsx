'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/providers/auth-provider';
import { useSettings } from '@/lib/hooks/use-settings';
import { settingsSchema } from '@/lib/utils/validation';
import { DEFAULT_SETTINGS } from '@/lib/utils/constants';
import { WorkHoursForm } from '@/components/settings/work-hours-form';
import { WorkdaysSelect } from '@/components/settings/workdays-select';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Settings, Save, UserX, RotateCcw } from 'lucide-react';

export default function SettingsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const { settings, loading, fetchSettings, updateSettings } = useSettings();

  // Local form state
  const [startTime, setStartTime] = useState(DEFAULT_SETTINGS.start_time);
  const [endTime, setEndTime] = useState(DEFAULT_SETTINGS.end_time);
  const [graceMinutes, setGraceMinutes] = useState(DEFAULT_SETTINGS.grace_minutes);
  const [workdays, setWorkdays] = useState(DEFAULT_SETTINGS.workdays);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Populate form when settings are loaded
  useEffect(() => {
    if (settings) {
      setStartTime(settings.start_time);
      setEndTime(settings.end_time);
      setGraceMinutes(settings.grace_minutes);
      setWorkdays(settings.workdays);
    }
  }, [settings]);

  const handleSave = async () => {
    // Validate with Zod
    const result = settingsSchema.safeParse({
      start_time: startTime,
      end_time: endTime,
      grace_minutes: graceMinutes,
      workdays,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const success = await updateSettings(result.data);
      if (success) {
        await fetchSettings();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setStartTime(settings.start_time);
      setEndTime(settings.end_time);
      setGraceMinutes(settings.grace_minutes);
      setWorkdays(settings.workdays);
      setErrors({});
    }
  };

  // Not admin — access denied
  if (!authLoading && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <UserX className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">غير مصرح</h2>
            <p className="text-muted-foreground">
              ليس لديك صلاحية الوصول إلى هذه الصفحة. هذه الصفحة مخصصة للمدراء
              فقط.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-6 w-6" />
          الإعدادات
        </h1>
        <p className="text-muted-foreground">
          إدارة إعدادات ساعات الدوام وأيام العمل
        </p>
      </div>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>إعدادات الدوام</CardTitle>
          <CardDescription>
            حدد أوقات بداية ونهاية الدوام وفترة السماح وأيام العمل الرسمية
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {loading ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-10 w-48" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <div className="grid grid-cols-4 gap-3">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Work Hours Section */}
              <WorkHoursForm
                startTime={startTime}
                endTime={endTime}
                graceMinutes={graceMinutes}
                onStartTimeChange={setStartTime}
                onEndTimeChange={setEndTime}
                onGraceMinutesChange={setGraceMinutes}
                errors={errors}
                disabled={saving}
              />

              {/* Separator */}
              <div className="border-t" />

              {/* Workdays Section */}
              <WorkdaysSelect
                value={workdays}
                onChange={setWorkdays}
                error={errors.workdays}
                disabled={saving}
              />

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 ml-2" />
                  )}
                  حفظ الإعدادات
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={saving}
                >
                  <RotateCcw className="h-4 w-4 ml-2" />
                  إعادة تعيين
                </Button>
              </div>

              {/* Last updated */}
              {settings?.updated_at && (
                <p className="text-xs text-muted-foreground">
                  آخر تحديث:{' '}
                  {new Date(settings.updated_at).toLocaleString('ar-SA', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
