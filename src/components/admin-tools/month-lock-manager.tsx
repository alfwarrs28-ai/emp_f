'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/providers/auth-provider';
import type { Lock } from '@/types/database';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { EmptyState } from '@/components/shared/empty-state';
import { toArabicNumerals } from '@/lib/utils/date';

import { Lock as LockIcon, Plus, Trash2, CalendarRange, ShieldCheck } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LockOption = 'half_year_first' | 'half_year_second' | 'year';

interface LockOptionConfig {
  label: string;
  lockType: 'half_year' | 'year';
  getRange: (year: number) => { start: string; end: string };
}

const LOCK_OPTIONS: Record<LockOption, LockOptionConfig> = {
  half_year_first: {
    label: 'إقفال نصف سنوي أول (يناير - يونيو)',
    lockType: 'half_year',
    getRange: (year: number) => ({
      start: `${year}-01-01`,
      end: `${year}-06-30`,
    }),
  },
  half_year_second: {
    label: 'إقفال نصف سنوي ثاني (يوليو - ديسمبر)',
    lockType: 'half_year',
    getRange: (year: number) => ({
      start: `${year}-07-01`,
      end: `${year}-12-31`,
    }),
  },
  year: {
    label: 'إقفال سنوي (يناير - ديسمبر)',
    lockType: 'year',
    getRange: (year: number) => ({
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    }),
  },
};

function getLockTypeLabel(lock: Lock): string {
  if (lock.lock_type === 'year') return 'إقفال سنوي';
  // Determine first or second half based on start_date month
  const startMonth = parseInt(lock.start_date.split('-')[1], 10);
  if (startMonth <= 6) return 'إقفال نصف سنوي أول';
  return 'إقفال نصف سنوي ثاني';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MonthLockManager() {
  const supabase = createClient();
  const { user } = useAuth();

  const [locks, setLocks] = useState<Lock[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedOption, setSelectedOption] = useState<LockOption | ''>('');
  const [selectedYear, setSelectedYear] = useState<string>(
    String(new Date().getFullYear())
  );

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Lock | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ---- Fetch locks ----
  const fetchLocks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('locks')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) {
        console.error('Error fetching locks:', error.message);
        toast.error('حدث خطأ أثناء تحميل الإقفالات');
        return;
      }

      setLocks((data as Lock[]) || []);
    } catch (err) {
      console.error('Unexpected error fetching locks:', err);
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchLocks();
  }, [fetchLocks]);

  // ---- Add lock ----
  const handleAddLock = async () => {
    if (!selectedOption || !selectedYear) {
      toast.error('يرجى اختيار نوع الإقفال والسنة');
      return;
    }

    const config = LOCK_OPTIONS[selectedOption];
    const year = parseInt(selectedYear, 10);
    const range = config.getRange(year);

    // Check for duplicate lock
    const duplicate = locks.find(
      (l) => l.start_date === range.start && l.end_date === range.end
    );
    if (duplicate) {
      toast.error('هذا الإقفال موجود بالفعل');
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase.from('locks').insert({
        lock_type: config.lockType,
        start_date: range.start,
        end_date: range.end,
        locked_by: user?.id || null,
      });

      if (error) {
        console.error('Error adding lock:', error.message);
        toast.error('حدث خطأ أثناء إضافة الإقفال');
        return;
      }

      toast.success('تم إضافة الإقفال بنجاح');
      setSelectedOption('');
      await fetchLocks();
    } catch (err) {
      console.error('Unexpected error adding lock:', err);
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setAdding(false);
    }
  };

  // ---- Delete lock ----
  const handleDeleteLock = async () => {
    if (!deleteTarget) return;

    try {
      const { error } = await supabase
        .from('locks')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) {
        console.error('Error deleting lock:', error.message);
        toast.error('حدث خطأ أثناء حذف الإقفال');
        return;
      }

      toast.success('تم حذف الإقفال بنجاح');
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      await fetchLocks();
    } catch (err) {
      console.error('Unexpected error deleting lock:', err);
      toast.error('حدث خطأ غير متوقع');
    }
  };

  // ---- Available years (current year +/- 2) ----
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) =>
    String(currentYear - 2 + i)
  );

  return (
    <div className="space-y-6">
      {/* Add New Lock */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            إضافة إقفال جديد
          </CardTitle>
          <CardDescription>
            اختر نوع الإقفال والسنة لمنع تعديل البيانات في الفترة المحددة
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">نوع الإقفال</label>
              <Select
                value={selectedOption}
                onValueChange={(val) => setSelectedOption(val as LockOption)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع الإقفال..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LOCK_OPTIONS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-36 space-y-2">
              <label className="text-sm font-medium">السنة</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {toArabicNumerals(y)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleAddLock}
              disabled={adding || !selectedOption}
              className="sm:w-auto"
            >
              {adding ? (
                <LoadingSpinner size="sm" className="ml-2" />
              ) : (
                <LockIcon className="h-4 w-4 ml-2" />
              )}
              إضافة إقفال
            </Button>
          </div>

          {/* Preview of selected lock range */}
          {selectedOption && selectedYear && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 bg-muted rounded-lg flex items-center gap-2 text-sm"
            >
              <CalendarRange className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>
                الفترة: من{' '}
                <strong>
                  {formatDate(
                    LOCK_OPTIONS[selectedOption].getRange(
                      parseInt(selectedYear, 10)
                    ).start
                  )}
                </strong>{' '}
                إلى{' '}
                <strong>
                  {formatDate(
                    LOCK_OPTIONS[selectedOption].getRange(
                      parseInt(selectedYear, 10)
                    ).end
                  )}
                </strong>
              </span>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Existing Locks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            الإقفالات الحالية
          </CardTitle>
          <CardDescription>
            الفترات المقفلة لا يمكن لمدخلي البيانات تعديل الحضور أو الاستئذانات
            فيها
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSpinner className="py-8" />
          ) : locks.length === 0 ? (
            <EmptyState
              icon={<LockIcon className="h-10 w-10 text-muted-foreground" />}
              title="لا توجد إقفالات"
              description="لم يتم إقفال أي فترة بعد. أضف إقفالاً جديداً لمنع التعديل على فترة محددة."
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نوع الإقفال</TableHead>
                    <TableHead>من تاريخ</TableHead>
                    <TableHead>إلى تاريخ</TableHead>
                    <TableHead>تاريخ الإقفال</TableHead>
                    <TableHead className="w-[80px]">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {locks.map((lock) => (
                      <motion.tr
                        key={lock.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell>
                          <Badge
                            variant={
                              lock.lock_type === 'year'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {getLockTypeLabel(lock)}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(lock.start_date)}</TableCell>
                        <TableCell>{formatDate(lock.end_date)}</TableCell>
                        <TableCell>
                          {formatDate(lock.locked_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setDeleteTarget(lock);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="حذف الإقفال"
        description={
          deleteTarget
            ? `هل أنت متأكد من حذف ${getLockTypeLabel(deleteTarget)}؟ سيتمكن مدخلو البيانات من تعديل بيانات هذه الفترة بعد الحذف.`
            : 'هل أنت متأكد من حذف هذا الإقفال؟'
        }
        confirmText="حذف"
        cancelText="إلغاء"
        onConfirm={handleDeleteLock}
        variant="destructive"
      />
    </div>
  );
}
