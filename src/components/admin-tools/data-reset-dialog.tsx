'use client';

import { useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers/auth-provider';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LoadingSpinner } from '@/components/shared/loading-spinner';

import { AlertTriangle, Trash2, CalendarRange, RotateCcw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResetTarget = 'attendance' | 'permissions';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataResetDialog() {
  const supabase = createClient();
  const { user } = useAuth();

  // Options
  const [targets, setTargets] = useState<Set<ResetTarget>>(new Set());
  const [useDateRange, setUseDateRange] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  // ---- Toggle target ----
  const toggleTarget = (target: ResetTarget) => {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(target)) {
        next.delete(target);
      } else {
        next.add(target);
      }
      return next;
    });
  };

  // ---- Validate before opening dialog ----
  const handleOpenDialog = () => {
    if (targets.size === 0) {
      toast.error('يرجى اختيار نوع البيانات المراد تصفيرها');
      return;
    }

    if (useDateRange) {
      if (!dateFrom || !dateTo) {
        toast.error('يرجى تحديد نطاق التاريخ');
        return;
      }
      if (dateFrom > dateTo) {
        toast.error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
        return;
      }
    }

    setConfirmText('');
    setDialogOpen(true);
  };

  // ---- Execute reset ----
  const handleReset = useCallback(async () => {
    if (confirmText !== 'تأكيد') return;

    setResetting(true);
    try {
      const errors: string[] = [];

      for (const target of Array.from(targets)) {
        let query = supabase.from(target).delete();

        if (useDateRange && dateFrom && dateTo) {
          query = query.gte('date', dateFrom).lte('date', dateTo);
        } else {
          // Delete all rows
          query = query.gte('id', 0);
        }

        const { error } = await query;
        if (error) {
          errors.push(
            `${target === 'attendance' ? 'الحضور' : 'الاستئذانات'}: ${error.message}`
          );
        }
      }

      // Log to audit_log
      try {
        await supabase.from('audit_log').insert({
          user_id: user?.id || null,
          action: 'data_reset',
          table_name: Array.from(targets).join(','),
          row_id: null,
          old_data: null,
          new_data: {
            targets: Array.from(targets),
            date_range: useDateRange
              ? { from: dateFrom, to: dateTo }
              : 'all',
          },
        });
      } catch {
        // Audit logging is non-critical
      }

      if (errors.length > 0) {
        toast.error(`حدثت أخطاء أثناء التصفير: ${errors.join('، ')}`);
      } else {
        toast.success('تم تصفير البيانات بنجاح');
      }

      // Reset form
      setDialogOpen(false);
      setTargets(new Set());
      setUseDateRange(false);
      setDateFrom('');
      setDateTo('');
      setConfirmText('');
    } catch (err) {
      console.error('Unexpected error during reset:', err);
      toast.error('حدث خطأ غير متوقع أثناء التصفير');
    } finally {
      setResetting(false);
    }
  }, [confirmText, targets, useDateRange, dateFrom, dateTo, supabase, user]);

  // ---- Build summary text ----
  const getSummaryText = (): string => {
    const parts: string[] = [];
    if (targets.has('attendance')) parts.push('سجلات الحضور');
    if (targets.has('permissions')) parts.push('سجلات الاستئذانات');

    let text = `سيتم حذف: ${parts.join(' و ')}`;
    if (useDateRange && dateFrom && dateTo) {
      text += ` في الفترة من ${dateFrom} إلى ${dateTo}`;
    } else {
      text += ' (جميع السجلات)';
    }
    return text;
  };

  const isConfirmValid = confirmText === 'تأكيد';

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-400">
              تحذير: هذا الإجراء لا يمكن التراجع عنه
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
              تصفير البيانات سيؤدي إلى حذف السجلات المحددة نهائياً. تأكد من أخذ
              نسخة احتياطية قبل المتابعة.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Reset Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            خيارات التصفير
          </CardTitle>
          <CardDescription>
            اختر نوع البيانات المراد حذفها ونطاق التاريخ (اختياري)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Data type selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">
              نوع البيانات المراد تصفيرها
            </Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label
                className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                  targets.has('attendance')
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={targets.has('attendance')}
                  onCheckedChange={() => toggleTarget('attendance')}
                />
                <div>
                  <p className="font-medium">سجلات الحضور</p>
                  <p className="text-sm text-muted-foreground">
                    حذف جميع سجلات الحضور والانصراف
                  </p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                  targets.has('permissions')
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={targets.has('permissions')}
                  onCheckedChange={() => toggleTarget('permissions')}
                />
                <div>
                  <p className="font-medium">سجلات الاستئذانات</p>
                  <p className="text-sm text-muted-foreground">
                    حذف جميع سجلات الاستئذانات والتصاريح
                  </p>
                </div>
              </label>
            </div>
          </div>

          <Separator />

          {/* Date range */}
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={useDateRange}
                onCheckedChange={(checked) =>
                  setUseDateRange(checked === true)
                }
              />
              <div>
                <p className="font-medium flex items-center gap-2">
                  <CalendarRange className="h-4 w-4" />
                  تحديد نطاق تاريخ
                </p>
                <p className="text-sm text-muted-foreground">
                  حذف السجلات في فترة محددة فقط بدلاً من حذف الكل
                </p>
              </div>
            </label>

            {useDateRange && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 pr-8"
              >
                <div className="space-y-2">
                  <Label htmlFor="date-from">من تاريخ</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-to">إلى تاريخ</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </motion.div>
            )}
          </div>

          <Separator />

          {/* Summary & Action */}
          {targets.size > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg space-y-3"
            >
              <p className="text-sm font-medium">{getSummaryText()}</p>
              <div className="flex flex-wrap gap-2">
                {targets.has('attendance') && (
                  <Badge variant="destructive">حضور</Badge>
                )}
                {targets.has('permissions') && (
                  <Badge variant="destructive">استئذانات</Badge>
                )}
                {!useDateRange && (
                  <Badge variant="outline">جميع السجلات</Badge>
                )}
                {useDateRange && dateFrom && dateTo && (
                  <Badge variant="outline">
                    {dateFrom} → {dateTo}
                  </Badge>
                )}
              </div>
            </motion.div>
          )}

          <Button
            variant="destructive"
            onClick={handleOpenDialog}
            disabled={targets.size === 0}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 ml-2" />
            تصفير البيانات المحددة
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد تصفير البيانات
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>{getSummaryText()}</p>
                <div className="p-3 bg-destructive/10 rounded-md border border-destructive/20">
                  <p className="text-sm font-semibold text-destructive">
                    هذا الإجراء نهائي ولا يمكن التراجع عنه!
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-input">
                    اكتب &quot;تأكيد&quot; للمتابعة
                  </Label>
                  <Input
                    id="confirm-input"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="تأكيد"
                    className="text-center"
                    dir="rtl"
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleReset();
              }}
              disabled={!isConfirmValid || resetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting ? (
                <>
                  <LoadingSpinner size="sm" className="ml-2" />
                  جارٍ التصفير...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 ml-2" />
                  تصفير نهائي
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
