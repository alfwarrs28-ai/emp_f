'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PermissionForm } from '@/components/permissions/permission-form';
import { PermissionList } from '@/components/permissions/permission-list';
import { OfflineIndicator } from '@/components/attendance/offline-indicator';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { useEmployees } from '@/lib/hooks/use-employees';
import { useAuth } from '@/lib/providers/auth-provider';
import { SyncProvider } from '@/lib/providers/sync-provider';

function PermissionsPageContent() {
  const [formOpen, setFormOpen] = useState(false);
  const { isAdmin } = useAuth();

  // ----- Data hooks -----
  const { employees, loading: empLoading, refetch: refetchEmployees } = useEmployees();
  const {
    permissions,
    loading: permLoading,
    addPermission,
    approvePermission,
    rejectPermission,
    deletePermission,
    refetch: refetchPermissions,
  } = usePermissions();

  // ----- Bootstrap data -----
  useEffect(() => {
    refetchEmployees(true); // Include inactive for display
    refetchPermissions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- Handlers -----
  const handleAddPermission = useCallback(
    async (data: {
      emp_id: number;
      date: string;
      type: string;
      minutes: number;
      reason?: string;
      status?: string;
    }) => {
      await addPermission(data);
    },
    [addPermission]
  );

  const handleApprove = useCallback(
    async (id: number) => {
      await approvePermission(id);
    },
    [approvePermission]
  );

  const handleReject = useCallback(
    async (id: number) => {
      await rejectPermission(id);
    },
    [rejectPermission]
  );

  const handleDelete = useCallback(
    async (id: number) => {
      await deletePermission(id);
    },
    [deletePermission]
  );

  // ----- Loading state -----
  const isInitialLoading = empLoading && permissions.length === 0;

  if (isInitialLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="الاستئذانات"
          description="ادارة طلبات الاستئذان والخروج المبكر"
        />
        <LoadingSpinner size="lg" className="py-16" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="الاستئذانات"
        description="ادارة طلبات الاستئذان والخروج المبكر"
      >
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4 ml-1.5" />
          اضافة استئذان
        </Button>
      </PageHeader>

      {/* Offline indicator */}
      <OfflineIndicator />

      {/* Permission list */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          <PermissionList
            permissions={permissions}
            employees={employees}
            loading={permLoading}
            isAdmin={isAdmin}
            onApprove={handleApprove}
            onReject={handleReject}
            onDelete={handleDelete}
          />
        </CardContent>
      </Card>

      {/* Add permission dialog */}
      <PermissionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        employees={employees}
        onSubmit={handleAddPermission}
      />
    </div>
  );
}

export default function PermissionsPage() {
  return (
    <SyncProvider>
      <PermissionsPageContent />
    </SyncProvider>
  );
}
