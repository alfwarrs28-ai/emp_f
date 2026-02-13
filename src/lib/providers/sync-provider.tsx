'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { setupAutoSync, processSyncQueue, type SyncResult } from '@/lib/db/sync';
import { getPendingSyncCount } from '@/lib/db/dexie';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { toast } from 'sonner';

interface SyncContextValue {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncResult: SyncResult | null;
  triggerSync: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const isOnline = useOnlineStatus();

  // Use ref for isSyncing to avoid re-creating triggerSync
  const isSyncingRef = useRef(false);
  isSyncingRef.current = isSyncing;

  const pendingCountRef = useRef(0);
  pendingCountRef.current = pendingCount;

  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    } catch {
      // IndexedDB might not be available
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncingRef.current) return;

    setIsSyncing(true);
    try {
      const result = await processSyncQueue();
      setLastSyncResult(result);
      await refreshPendingCount();

      if (result.success > 0) {
        toast.success(`تمت مزامنة ${result.success} عملية بنجاح`);
      }
      if (result.conflicts > 0) {
        toast.warning(`تم حل ${result.conflicts} تعارض`);
      }
      if (result.failed > 0) {
        toast.error(`فشلت ${result.failed} عملية في المزامنة`);
      }
    } catch {
      toast.error('حدث خطأ أثناء المزامنة');
    } finally {
      setIsSyncing(false);
    }
  }, [refreshPendingCount]); // Stable — no isSyncing dep

  // Setup auto-sync on mount
  useEffect(() => {
    const cleanup = setupAutoSync(async (result) => {
      setLastSyncResult(result);
      await refreshPendingCount();

      if (result.success > 0) {
        toast.success(`تمت مزامنة ${result.success} عملية تلقائياً`);
      }
    });

    return cleanup;
  }, [refreshPendingCount]);

  // Refresh pending count on online status change
  useEffect(() => {
    refreshPendingCount();
  }, [isOnline, refreshPendingCount]);

  // Periodic pending count refresh — every 30 seconds (was 10)
  useEffect(() => {
    const interval = setInterval(refreshPendingCount, 30000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  // Auto-trigger sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCountRef.current > 0) {
      triggerSync();
    }
  }, [isOnline, triggerSync]);

  return (
    <SyncContext.Provider
      value={{
        pendingCount,
        isSyncing,
        lastSyncResult,
        triggerSync,
        refreshPendingCount,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
