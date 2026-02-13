'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePickerAr } from '@/components/shared/date-picker-ar';
import { Loader2 } from 'lucide-react';
import { getTodaySaudi } from '@/lib/utils/date';
import { PERMISSION_TYPE_MAP, PERMISSION_STATUS_MAP } from '@/lib/utils/constants';
import type { Employee, PermissionType, PermissionStatus } from '@/types/database';

interface PermissionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  onSubmit: (data: {
    emp_id: number;
    date: string;
    type: string;
    minutes: number;
    reason?: string;
    status?: string;
  }) => Promise<void>;
}

interface FormState {
  emp_id: string;
  date: string;
  type: PermissionType | '';
  minutes: string;
  reason: string;
  status: PermissionStatus;
}

const initialFormState: FormState = {
  emp_id: '',
  date: getTodaySaudi(),
  type: '',
  minutes: '',
  reason: '',
  status: 'approved',
};

interface FormErrors {
  emp_id?: string;
  type?: string;
  minutes?: string;
}

export function PermissionForm({
  open,
  onOpenChange,
  employees,
  onSubmit,
}: PermissionFormProps) {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setForm({ ...initialFormState, date: getTodaySaudi() });
    setErrors({});
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        resetForm();
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, resetForm]
  );

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!form.emp_id) {
      newErrors.emp_id = 'يرجى اختيار الموظف';
    }
    if (!form.type) {
      newErrors.type = 'يرجى اختيار نوع الاستئذان';
    }
    const mins = parseInt(form.minutes, 10);
    if (!form.minutes || isNaN(mins) || mins <= 0) {
      newErrors.minutes = 'يرجى ادخال مدة صالحة (اكبر من صفر)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) return;

      setSubmitting(true);
      try {
        await onSubmit({
          emp_id: parseInt(form.emp_id, 10),
          date: form.date,
          type: form.type,
          minutes: parseInt(form.minutes, 10),
          reason: form.reason || undefined,
          status: form.status,
        });
        handleOpenChange(false);
      } finally {
        setSubmitting(false);
      }
    },
    [form, validate, onSubmit, handleOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>اضافة استئذان جديد</DialogTitle>
          <DialogDescription>
            ادخل بيانات الاستئذان وسيتم حفظه تلقائيا
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee select */}
          <div className="space-y-2">
            <Label htmlFor="perm-emp">الموظف</Label>
            <Select
              value={form.emp_id}
              onValueChange={(val) => {
                setForm((prev) => ({ ...prev, emp_id: val }));
                setErrors((prev) => ({ ...prev, emp_id: undefined }));
              }}
            >
              <SelectTrigger id="perm-emp">
                <SelectValue placeholder="اختر الموظف" />
              </SelectTrigger>
              <SelectContent>
                {employees
                  .filter((e) => e.active)
                  .map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.name} ({emp.emp_no})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {errors.emp_id && (
              <p className="text-xs text-red-500">{errors.emp_id}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>التاريخ</Label>
            <DatePickerAr
              value={form.date}
              onDateChange={(date) =>
                setForm((prev) => ({ ...prev, date }))
              }
              className="w-full"
            />
          </div>

          {/* Permission type */}
          <div className="space-y-2">
            <Label htmlFor="perm-type">نوع الاستئذان</Label>
            <Select
              value={form.type}
              onValueChange={(val) => {
                setForm((prev) => ({
                  ...prev,
                  type: val as PermissionType,
                }));
                setErrors((prev) => ({ ...prev, type: undefined }));
              }}
            >
              <SelectTrigger id="perm-type">
                <SelectValue placeholder="اختر النوع" />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(PERMISSION_TYPE_MAP) as [
                    PermissionType,
                    string,
                  ][]
                ).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-xs text-red-500">{errors.type}</p>
            )}
          </div>

          {/* Duration in minutes */}
          <div className="space-y-2">
            <Label htmlFor="perm-minutes">المدة بالدقائق</Label>
            <Input
              id="perm-minutes"
              type="number"
              min="1"
              max="480"
              inputMode="numeric"
              value={form.minutes}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, minutes: e.target.value }));
                setErrors((prev) => ({ ...prev, minutes: undefined }));
              }}
              placeholder="مثلا: 30"
            />
            {errors.minutes && (
              <p className="text-xs text-red-500">{errors.minutes}</p>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="perm-reason">السبب</Label>
            <Textarea
              id="perm-reason"
              value={form.reason}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="سبب الاستئذان (اختياري)"
              rows={2}
              maxLength={500}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="perm-status">الحالة</Label>
            <Select
              value={form.status}
              onValueChange={(val) =>
                setForm((prev) => ({
                  ...prev,
                  status: val as PermissionStatus,
                }))
              }
            >
              <SelectTrigger id="perm-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(PERMISSION_STATUS_MAP) as [
                    PermissionStatus,
                    string,
                  ][]
                ).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              الغاء
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 ml-1.5 animate-spin" />
                  جارٍ الحفظ...
                </>
              ) : (
                'حفظ الاستئذان'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
