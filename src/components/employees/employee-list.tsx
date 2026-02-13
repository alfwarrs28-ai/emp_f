'use client';

import { useState } from 'react';
import type { Employee } from '@/types/database';
import { cn } from '@/lib/utils/cn';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil, UserCheck, UserX } from 'lucide-react';

interface EmployeeListProps {
  employees: Employee[];
  loading: boolean;
  viewMode: 'table' | 'grid';
  onEdit: (employee: Employee) => void;
  onToggleActive: (employee: Employee) => void;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

// ----- Loading Skeleton (Table) -----
function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

// ----- Loading Skeleton (Grid) -----
function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ----- Empty State -----
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <UserX className="h-12 w-12 mb-4" />
      <p className="text-lg font-medium">لا يوجد موظفون</p>
      <p className="text-sm">أضف موظفاً جديداً للبدء</p>
    </div>
  );
}

// ----- Table View -----
function EmployeeTable({
  employees,
  onEdit,
  onToggleActive,
}: Omit<EmployeeListProps, 'loading' | 'viewMode'>) {
  return (
    <div className="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>رقم الموظف</TableHead>
            <TableHead>الاسم</TableHead>
            <TableHead>الحالة</TableHead>
            <TableHead>تاريخ الإضافة</TableHead>
            <TableHead>إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow
              key={employee.id}
              className={cn(!employee.active && 'opacity-60')}
            >
              <TableCell className="font-mono">{employee.emp_no}</TableCell>
              <TableCell className="font-medium">{employee.name}</TableCell>
              <TableCell>
                <Badge variant={employee.active ? 'default' : 'secondary'}>
                  {employee.active ? 'نشط' : 'معطل'}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(employee.created_at)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(employee)}
                    title="تعديل"
                  >
                    <Pencil className="h-4 w-4 ml-1" />
                    تعديل
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onToggleActive(employee)}
                    title={employee.active ? 'تعطيل' : 'تفعيل'}
                    className={cn(
                      employee.active
                        ? 'text-destructive hover:text-destructive'
                        : 'text-green-600 hover:text-green-600'
                    )}
                  >
                    {employee.active ? (
                      <>
                        <UserX className="h-4 w-4 ml-1" />
                        تعطيل
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 ml-1" />
                        تفعيل
                      </>
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ----- Card/Grid View (also used on mobile) -----
function EmployeeGrid({
  employees,
  onEdit,
  onToggleActive,
  className,
}: Omit<EmployeeListProps, 'loading' | 'viewMode'> & { className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {employees.map((employee) => (
        <Card
          key={employee.id}
          className={cn(!employee.active && 'opacity-60')}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-base">{employee.name}</p>
                <p className="text-sm text-muted-foreground font-mono">
                  #{employee.emp_no}
                </p>
              </div>
              <Badge variant={employee.active ? 'default' : 'secondary'}>
                {employee.active ? 'نشط' : 'معطل'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              تاريخ الإضافة: {formatDate(employee.created_at)}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(employee)}
              >
                <Pencil className="h-3.5 w-3.5 ml-1" />
                تعديل
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onToggleActive(employee)}
                className={cn(
                  employee.active
                    ? 'text-destructive border-destructive/50 hover:bg-destructive/10'
                    : 'text-green-600 border-green-600/50 hover:bg-green-600/10'
                )}
              >
                {employee.active ? (
                  <>
                    <UserX className="h-3.5 w-3.5 ml-1" />
                    تعطيل
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5 ml-1" />
                    تفعيل
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ----- Main Component -----
export function EmployeeList({
  employees,
  loading,
  viewMode,
  onEdit,
  onToggleActive,
}: EmployeeListProps) {
  if (loading) {
    return viewMode === 'table' ? <TableSkeleton /> : <GridSkeleton />;
  }

  if (employees.length === 0) {
    return <EmptyState />;
  }

  return (
    <>
      {/* Desktop: show based on viewMode */}
      {viewMode === 'table' ? (
        <>
          <EmployeeTable
            employees={employees}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
          />
          {/* Mobile: always show cards */}
          <EmployeeGrid
            employees={employees}
            onEdit={onEdit}
            onToggleActive={onToggleActive}
            className="md:hidden"
          />
        </>
      ) : (
        <EmployeeGrid
          employees={employees}
          onEdit={onEdit}
          onToggleActive={onToggleActive}
        />
      )}
    </>
  );
}
