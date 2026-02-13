'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/providers/auth-provider';
import { useEmployees } from '@/lib/hooks/use-employees';
import { EmployeeList } from '@/components/employees/employee-list';
import { EmployeeForm } from '@/components/employees/employee-form';
import { EmployeeDeleteDialog } from '@/components/employees/employee-delete-dialog';
import type { Employee } from '@/types/database';
import type { EmployeeFormValues } from '@/lib/utils/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  UserPlus,
  Search,
  LayoutGrid,
  TableProperties,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
} from 'lucide-react';

export default function EmployeesPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const {
    employees,
    loading,
    refetch,
    addEmployee,
    updateEmployee,
    toggleActive,
  } = useEmployees();

  // UI state
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showInactive, setShowInactive] = useState(true);

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [targetEmployee, setTargetEmployee] = useState<Employee | null>(null);

  // Fetch employees on mount
  useEffect(() => {
    refetch(true);
  }, [refetch]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    let result = employees;

    // Filter inactive
    if (!showInactive) {
      result = result.filter((e) => e.active);
    }

    // Search filter
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(term) ||
          e.emp_no.toLowerCase().includes(term)
      );
    }

    return result;
  }, [employees, search, showInactive]);

  // Stats
  const totalCount = employees.length;
  const activeCount = employees.filter((e) => e.active).length;
  const inactiveCount = totalCount - activeCount;

  // Handlers
  const handleAdd = () => {
    setEditingEmployee(null);
    setFormOpen(true);
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormOpen(true);
  };

  const handleToggleActive = (employee: Employee) => {
    setTargetEmployee(employee);
    setDeleteDialogOpen(true);
  };

  const handleFormSubmit = async (data: EmployeeFormValues): Promise<boolean> => {
    if (editingEmployee) {
      const success = await updateEmployee(editingEmployee.id, data);
      if (success) await refetch(true);
      return success;
    } else {
      const success = await addEmployee(data);
      if (success) await refetch(true);
      return success;
    }
  };

  const handleToggleConfirm = async (
    id: number,
    active: boolean
  ): Promise<boolean> => {
    const success = await toggleActive(id, active);
    if (success) await refetch(true);
    return success;
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">إدارة الموظفين</h1>
          <p className="text-muted-foreground">
            إضافة وتعديل وإدارة بيانات الموظفين
          </p>
        </div>
        <Button onClick={handleAdd}>
          <UserPlus className="h-4 w-4 ml-2" />
          إضافة موظف
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الموظفين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نشطون</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">معطلون</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {inactiveCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو رقم الموظف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showInactive ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
          >
            {showInactive ? 'إخفاء المعطلين' : 'عرض المعطلين'}
          </Button>
          <div className="border rounded-md flex">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-none rounded-r-md"
              onClick={() => setViewMode('table')}
              title="عرض جدول"
            >
              <TableProperties className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9 rounded-none rounded-l-md"
              onClick={() => setViewMode('grid')}
              title="عرض بطاقات"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch(true)}
            disabled={loading}
            title="تحديث"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Employee List */}
      <EmployeeList
        employees={filteredEmployees}
        loading={loading}
        viewMode={viewMode}
        onEdit={handleEdit}
        onToggleActive={handleToggleActive}
      />

      {/* Add/Edit Dialog */}
      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editingEmployee}
        onSubmit={handleFormSubmit}
      />

      {/* Deactivate/Activate Confirmation */}
      <EmployeeDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        employee={targetEmployee}
        onConfirm={handleToggleConfirm}
      />
    </div>
  );
}
