'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { useSync } from '@/lib/providers/sync-provider';
import { toArabicNumerals } from '@/lib/utils/date';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const { pendingCount, isSyncing, triggerSync } = useSync();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/50"
        >
          {/* Pulsing red dot */}
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <WifiOff className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                انت غير متصل بالانترنت
              </p>
            </div>
            {pendingCount > 0 && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                {toArabicNumerals(pendingCount)} عملية في انتظار المزامنة
              </p>
            )}
          </div>

          {pendingCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={triggerSync}
              disabled={isSyncing || !isOnline}
              className="shrink-0 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ml-1.5 ${isSyncing ? 'animate-spin' : ''}`}
              />
              مزامنة
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
