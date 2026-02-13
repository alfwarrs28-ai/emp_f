'use client';

import { useState } from 'react';
import type { Employee } from '@/types/database';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

interface EmployeeDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onConfirm: (id: number, active: boolean) => Promise<boolean>;
}

export function EmployeeDeleteDialog({
  open,
  onOpenChange,
  employee,
  onConfirm,
}: EmployeeDeleteDialogProps) {
  const [loading, setLoading] = useState(false);

  if (!employee) return null;

  const isActive = employee.active;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const success = await onConfirm(employee.id, !isActive);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isActive ? 'تعطيل الموظف' : 'تفعيل الموظف'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isActive
              ? `هل أنت متأكد من تعطيل الموظف "${employee.name}"؟ لن يظهر الموظف في قوائم الحضور والانصراف بعد التعطيل.`
              : `هل تريد إعادة تفعيل الموظف "${employee.name}"؟ سيظهر الموظف مجدداً في قوائم الحضور والانصراف.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={loading}
            className={
              isActive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }
          >
            {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            {isActive ? 'تعطيل' : 'تفعيل'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
