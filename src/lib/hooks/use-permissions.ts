'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOnlineStatus } from './use-online-status';
import { db, addToSyncQueue, type LocalPermission } from '@/lib/db/dexie';
import type { Permission, PermissionWithEmployee } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

interface UsePermissionsOptions {
  date?: string;
  empId?: number;
  dateRange?: { start: string; end: string };
}

interface UsePermissionsReturn {
  permissions: PermissionWithEmployee[];
  loading: boolean;
  error: string | null;
  addPermission: (data: {
    emp_id: number;
    date: string;
    type: string;
    minutes: number;
    reason?: string;
    status?: string;
  }) => Promise<void>;
  updatePermission: (id: number, data: Partial<Permission>) => Promise<void>;
  deletePermission: (id: number) => Promise<void>;
  approvePermission: (id: number) => Promise<void>;
  rejectPermission: (id: number) => Promise<void>;
  refetch: () => Promise<void>;
}

export function usePermissions(options: UsePermissionsOptions = {}): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<PermissionWithEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();
  const supabase = createClient();

  const fetchOnline = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('permissions')
        .select('*, employee:employees(id, emp_no, name, active)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (options.date) {
        query = query.eq('date', options.date);
      }
      if (options.empId) {
        query = query.eq('emp_id', options.empId);
      }
      if (options.dateRange) {
        query = query
          .gte('date', options.dateRange.start)
          .lte('date', options.dateRange.end);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setPermissions((data || []) as unknown as PermissionWithEmployee[]);

      // Cache in IndexedDB
      const cacheRecords: LocalPermission[] = (data || []).map((p: Permission) => ({
        localId: `server-${p.id}`,
        remoteId: p.id,
        emp_id: p.emp_id,
        date: p.date,
        type: p.type,
        minutes: p.minutes,
        reason: p.reason,
        status: p.status,
        syncStatus: 'synced' as const,
        updatedAt: Date.now(),
      }));

      // Clear and re-cache
      if (options.date) {
        await db.permissions
          .where('date')
          .equals(options.date)
          .and((item) => item.syncStatus === 'synced')
          .delete();
      }
      if (cacheRecords.length > 0) {
        await db.permissions.bulkPut(cacheRecords);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في تحميل الاستئذانات');
    } finally {
      setLoading(false);
    }
  }, [options.date, options.empId, options.dateRange?.start, options.dateRange?.end, supabase]);

  const fetchOffline = useCallback(async () => {
    try {
      setLoading(true);
      let cached: LocalPermission[];

      if (options.date) {
        cached = await db.permissions.where('date').equals(options.date).toArray();
      } else {
        cached = await db.permissions.toArray();
      }

      const records: PermissionWithEmployee[] = cached.map((p) => ({
        id: p.remoteId || 0,
        date: p.date,
        emp_id: p.emp_id,
        type: p.type as Permission['type'],
        minutes: p.minutes,
        reason: p.reason,
        status: p.status as Permission['status'],
        approved_by: null,
        approved_at: null,
        client_updated_at: null,
        created_by: null,
        updated_by: null,
        created_at: '',
        updated_at: '',
      }));

      setPermissions(records);
    } catch {
      setError('تعذر تحميل البيانات من الذاكرة المحلية');
    } finally {
      setLoading(false);
    }
  }, [options.date]);

  const refetch = useCallback(async () => {
    if (isOnline) {
      await fetchOnline();
    } else {
      await fetchOffline();
    }
  }, [isOnline, fetchOnline, fetchOffline]);

  useEffect(() => {
    refetch();
  }, [options.date, options.empId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addPermission = useCallback(
    async (data: {
      emp_id: number;
      date: string;
      type: string;
      minutes: number;
      reason?: string;
      status?: string;
    }) => {
      const now = Date.now();
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
      const localId = uuidv4();

      const permission = {
        ...data,
        status: data.status || 'approved',
        reason: data.reason || null,
        client_updated_at: new Date(now).toISOString(),
        created_by: userId,
        updated_by: userId,
      };

      // Save to IndexedDB
      await db.permissions.put({
        localId,
        emp_id: data.emp_id,
        date: data.date,
        type: data.type,
        minutes: data.minutes,
        reason: data.reason || null,
        status: data.status || 'approved',
        syncStatus: 'pending',
        updatedAt: now,
      });

      // Add to sync queue
      await addToSyncQueue({
        table: 'permissions',
        operation: 'upsert',
        localId,
        payload: { ...permission, updated_by: userId },
        createdAt: now,
        retryCount: 0,
      });

      if (navigator.onLine) {
        try {
          const { error: insertError } = await supabase
            .from('permissions')
            .insert(permission);

          if (insertError) throw insertError;

          toast.success('تمت إضافة الاستئذان بنجاح');

          // Remove from sync queue
          const queueItems = await db.syncQueue
            .where('localId')
            .equals(localId)
            .toArray();
          for (const qi of queueItems) {
            if (qi.id) await db.syncQueue.delete(qi.id);
          }

          await refetch();
        } catch (err) {
          toast.error('حدث خطأ أثناء حفظ الاستئذان');
          console.error(err);
        }
      } else {
        toast.info('تم حفظ الاستئذان محلياً وسيتم مزامنته عند الاتصال');
        await refetch();
      }
    },
    [supabase, refetch]
  );

  const updatePermission = useCallback(
    async (id: number, data: Partial<Permission>) => {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;

      if (navigator.onLine) {
        try {
          const { error: updateError } = await supabase
            .from('permissions')
            .update({
              ...data,
              updated_by: userId,
              client_updated_at: new Date().toISOString(),
            })
            .eq('id', id);

          if (updateError) throw updateError;
          toast.success('تم تحديث الاستئذان');
          await refetch();
        } catch {
          toast.error('حدث خطأ أثناء تحديث الاستئذان');
        }
      } else {
        toast.info('سيتم تحديث الاستئذان عند الاتصال');
      }
    },
    [supabase, refetch]
  );

  const deletePermission = useCallback(
    async (id: number) => {
      if (navigator.onLine) {
        try {
          const { error: deleteError } = await supabase
            .from('permissions')
            .delete()
            .eq('id', id);

          if (deleteError) throw deleteError;
          toast.success('تم حذف الاستئذان');
          await refetch();
        } catch {
          toast.error('حدث خطأ أثناء حذف الاستئذان');
        }
      }
    },
    [supabase, refetch]
  );

  const approvePermission = useCallback(
    async (id: number) => {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
      await updatePermission(id, {
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
      } as Partial<Permission>);
    },
    [supabase, updatePermission]
  );

  const rejectPermission = useCallback(
    async (id: number) => {
      await updatePermission(id, { status: 'rejected' } as Partial<Permission>);
    },
    [updatePermission]
  );

  return {
    permissions,
    loading,
    error,
    addPermission,
    updatePermission,
    deletePermission,
    approvePermission,
    rejectPermission,
    refetch,
  };
}
