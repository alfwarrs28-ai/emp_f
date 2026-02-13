'use client';

import { useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Employee } from '@/types/database';
import type { EmployeeFormValues } from '@/lib/utils/validation';
import { toast } from 'sonner';

interface UseEmployeesReturn {
  employees: Employee[];
  loading: boolean;
  error: string | null;
  refetch: (includeInactive?: boolean) => Promise<void>;
  addEmployee: (data: EmployeeFormValues) => Promise<boolean>;
  updateEmployee: (id: number, data: EmployeeFormValues) => Promise<boolean>;
  toggleActive: (id: number, active: boolean) => Promise<boolean>;
}

// Module-level singleton client
const supabase = createClient();

export function useEmployees(): UseEmployeesReturn {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = useCallback(
    async (includeInactive = true) => {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('employees')
          .select('id, emp_no, name, active, created_at, updated_at')
          .order('emp_no', { ascending: true });

        if (!includeInactive) {
          query = query.eq('active', true);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
          const msg = 'حدث خطأ أثناء جلب بيانات الموظفين';
          setError(msg);
          toast.error(msg);
          return;
        }

        setEmployees((data as Employee[]) || []);
      } catch {
        const msg = 'حدث خطأ غير متوقع أثناء جلب البيانات';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const addEmployee = useCallback(
    async (data: EmployeeFormValues): Promise<boolean> => {
      try {
        const { data: existing } = await supabase
          .from('employees')
          .select('id')
          .eq('emp_no', data.emp_no)
          .maybeSingle();

        if (existing) {
          toast.error('رقم الموظف موجود مسبقاً');
          return false;
        }

        const { error: insertError } = await supabase
          .from('employees')
          .insert({
            emp_no: data.emp_no,
            name: data.name,
            active: true,
          });

        if (insertError) {
          toast.error('حدث خطأ أثناء إضافة الموظف');
          return false;
        }

        toast.success('تمت إضافة الموظف بنجاح');
        return true;
      } catch {
        toast.error('حدث خطأ غير متوقع');
        return false;
      }
    },
    []
  );

  const updateEmployee = useCallback(
    async (id: number, data: EmployeeFormValues): Promise<boolean> => {
      try {
        const { data: existing } = await supabase
          .from('employees')
          .select('id')
          .eq('emp_no', data.emp_no)
          .neq('id', id)
          .maybeSingle();

        if (existing) {
          toast.error('رقم الموظف موجود مسبقاً لموظف آخر');
          return false;
        }

        const { error: updateError } = await supabase
          .from('employees')
          .update({
            emp_no: data.emp_no,
            name: data.name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          toast.error('حدث خطأ أثناء تعديل بيانات الموظف');
          return false;
        }

        toast.success('تم تعديل بيانات الموظف بنجاح');
        return true;
      } catch {
        toast.error('حدث خطأ غير متوقع');
        return false;
      }
    },
    []
  );

  const toggleActive = useCallback(
    async (id: number, active: boolean): Promise<boolean> => {
      try {
        const { error: updateError } = await supabase
          .from('employees')
          .update({
            active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) {
          toast.error('حدث خطأ أثناء تغيير حالة الموظف');
          return false;
        }

        toast.success(active ? 'تم تفعيل الموظف بنجاح' : 'تم تعطيل الموظف بنجاح');
        return true;
      } catch {
        toast.error('حدث خطأ غير متوقع');
        return false;
      }
    },
    []
  );

  return {
    employees,
    loading,
    error,
    refetch: fetchEmployees,
    addEmployee,
    updateEmployee,
    toggleActive,
  };
}
