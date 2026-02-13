'use client';

import { useState, useEffect } from 'react';
import { employeeSchema, type EmployeeFormValues } from '@/lib/utils/validation';
import type { Employee } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  onSubmit: (data: EmployeeFormValues) => Promise<boolean>;
}

export function EmployeeForm({
  open,
  onOpenChange,
  employee,
  onSubmit,
}: EmployeeFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [empNo, setEmpNo] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = !!employee;

  // Pre-fill / reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (employee) {
        setEmpNo(employee.emp_no);
        setName(employee.name);
      } else {
        setEmpNo('');
        setName('');
      }
      setErrors({});
    }
  }, [open, employee]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const result = employeeSchema.safeParse({ emp_no: empNo, name });
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
    setSubmitting(true);
    try {
      const success = await onSubmit(result.data);
      if (success) {
        onOpenChange(false);
        setEmpNo('');
        setName('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emp_no">رقم الموظف</Label>
            <Input
              id="emp_no"
              placeholder="أدخل رقم الموظف"
              value={empNo}
              onChange={(e) => setEmpNo(e.target.value)}
              disabled={submitting}
              className="text-right"
            />
            {errors.emp_no && (
              <p className="text-sm text-destructive">{errors.emp_no}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">اسم الموظف</Label>
            <Input
              id="name"
              placeholder="أدخل اسم الموظف"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              className="text-right"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'حفظ التعديلات' : 'إضافة الموظف'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
