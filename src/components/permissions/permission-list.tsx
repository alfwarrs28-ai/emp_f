'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Check,
  X,
  Trash2,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PermissionTypeBadge } from './permission-type-badge';
import { DatePickerAr } from '@/components/shared/date-picker-ar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';
import { formatDateAr, toArabicNumerals } from '@/lib/utils/date';
import {
  PERMISSION_TYPE_MAP,
  PERMISSION_STATUS_MAP,
} from '@/lib/utils/constants';
import type {
  PermissionWithEmployee,
  PermissionType,
  PermissionStatus,
  Employee,
} from '@/types/database';
import { ClipboardList } from 'lucide-react';

interface PermissionListProps {
  permissions: PermissionWithEmployee[];
  employees: Employee[];
  loading: boolean;
  isAdmin: boolean;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const STATUS_STYLES: Record<PermissionStatus, string> = {
  approved:
    'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  pending:
    'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800',
  rejected:
    'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
};

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

export function PermissionList({
  permissions,
  employees,
  loading,
  isAdmin,
  onApprove,
  onReject,
  onDelete,
}: PermissionListProps) {
  // ----- Filter state -----
  const [filterEmployee, setFilterEmployee] = useState<string>('_all');
  const [filterType, setFilterType] = useState<string>('_all');
  const [filterStatus, setFilterStatus] = useState<string>('_all');
  const [showFilters, setShowFilters] = useState(false);

  // ----- Delete confirm dialog -----
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // ----- Filtered list -----
  const filteredPermissions = useMemo(() => {
    let result = permissions;

    if (filterEmployee && filterEmployee !== '_all') {
      result = result.filter(
        (p) => p.emp_id === parseInt(filterEmployee, 10)
      );
    }
    if (filterType && filterType !== '_all') {
      result = result.filter((p) => p.type === filterType);
    }
    if (filterStatus && filterStatus !== '_all') {
      result = result.filter((p) => p.status === filterStatus);
    }

    return result;
  }, [permissions, filterEmployee, filterType, filterStatus]);

  const handleDelete = useCallback(async () => {
    if (deleteId !== null) {
      await onDelete(deleteId);
      setDeleteId(null);
    }
  }, [deleteId, onDelete]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterEmployee && filterEmployee !== '_all') count++;
    if (filterType && filterType !== '_all') count++;
    if (filterStatus && filterStatus !== '_all') count++;
    return count;
  }, [filterEmployee, filterType, filterStatus]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-3">
      {/* Filter toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters((prev) => !prev)}
          className="relative"
        >
          <Filter className="h-4 w-4 ml-1.5" />
          تصفية
          {activeFiltersCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-2 -left-2 h-5 min-w-[20px] p-0 flex items-center justify-center text-[10px]"
            >
              {toArabicNumerals(activeFiltersCount)}
            </Badge>
          )}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 mr-1 transition-transform',
              showFilters && 'rotate-180'
            )}
          />
        </Button>

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterEmployee('_all');
              setFilterType('_all');
              setFilterStatus('_all');
            }}
            className="text-xs text-muted-foreground"
          >
            مسح الكل
          </Button>
        )}
      </div>

      {/* Filter controls */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          <div>
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="جميع الموظفين" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">جميع الموظفين</SelectItem>
                {employees
                  .filter((e) => e.active)
                  .map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="جميع الانواع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">جميع الانواع</SelectItem>
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
          </div>

          <div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="جميع الحالات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">جميع الحالات</SelectItem>
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
        </motion.div>
      )}

      {/* Empty state */}
      {filteredPermissions.length === 0 && (
        <EmptyState
          icon={<ClipboardList className="h-10 w-10 text-muted-foreground" />}
          title="لا توجد استئذانات"
          description={
            permissions.length > 0
              ? 'لا توجد نتائج تطابق معايير البحث'
              : 'لم يتم تسجيل اي استئذانات بعد'
          }
        />
      )}

      {/* Desktop table */}
      {filteredPermissions.length > 0 && (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-3 text-xs font-medium text-muted-foreground">
                    التاريخ
                  </th>
                  <th className="px-3 py-3 text-xs font-medium text-muted-foreground">
                    الموظف
                  </th>
                  <th className="px-3 py-3 text-xs font-medium text-muted-foreground">
                    النوع
                  </th>
                  <th className="px-3 py-3 text-xs font-medium text-muted-foreground">
                    المدة
                  </th>
                  <th className="px-3 py-3 text-xs font-medium text-muted-foreground">
                    السبب
                  </th>
                  <th className="px-3 py-3 text-xs font-medium text-muted-foreground">
                    الحالة
                  </th>
                  {isAdmin && (
                    <th className="px-3 py-3 text-xs font-medium text-muted-foreground">
                      اجراءات
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredPermissions.map((perm) => (
                  <tr
                    key={perm.id}
                    className="border-b transition-colors hover:bg-muted/50"
                  >
                    <td className="px-3 py-2.5 text-sm whitespace-nowrap">
                      {formatDateAr(perm.date)}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium whitespace-nowrap">
                      {perm.employee?.name || `موظف #${perm.emp_id}`}
                    </td>
                    <td className="px-3 py-2.5">
                      <PermissionTypeBadge type={perm.type} />
                    </td>
                    <td className="px-3 py-2.5 text-sm">
                      {toArabicNumerals(perm.minutes)} دقيقة
                    </td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground max-w-[200px] truncate">
                      {perm.reason || '-'}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs whitespace-nowrap',
                          STATUS_STYLES[perm.status]
                        )}
                      >
                        {PERMISSION_STATUS_MAP[perm.status]}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {perm.status === 'pending' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => onApprove(perm.id)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>موافقة</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {perm.status === 'pending' && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => onReject(perm.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>رفض</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setDeleteId(perm.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>حذف</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filteredPermissions.map((perm) => (
              <Card key={perm.id}>
                <CardContent className="p-3 space-y-2">
                  {/* Header: name + status */}
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {perm.employee?.name || `موظف #${perm.emp_id}`}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        STATUS_STYLES[perm.status]
                      )}
                    >
                      {PERMISSION_STATUS_MAP[perm.status]}
                    </Badge>
                  </div>

                  {/* Details */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDateAr(perm.date)}</span>
                    <span className="text-muted-foreground/50">|</span>
                    <PermissionTypeBadge type={perm.type} />
                    <span className="text-muted-foreground/50">|</span>
                    <span>{toArabicNumerals(perm.minutes)} دقيقة</span>
                  </div>

                  {/* Reason */}
                  {perm.reason && (
                    <p className="text-xs text-muted-foreground">
                      {perm.reason}
                    </p>
                  )}

                  {/* Actions */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 pt-1 border-t">
                      {perm.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 text-xs h-7"
                            onClick={() => onApprove(perm.id)}
                          >
                            <Check className="h-3.5 w-3.5 ml-1" />
                            موافقة
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs h-7"
                            onClick={() => onReject(perm.id)}
                          >
                            <X className="h-3.5 w-3.5 ml-1" />
                            رفض
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs h-7 mr-auto"
                        onClick={() => setDeleteId(perm.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 ml-1" />
                        حذف
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="حذف الاستئذان"
        description="هل انت متاكد من حذف هذا الاستئذان؟ لا يمكن التراجع عن هذا الاجراء."
        confirmText="حذف"
        cancelText="الغاء"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  );
}
