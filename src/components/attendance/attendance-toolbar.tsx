'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  RefreshCw,
  CalendarPlus,
  Check,
  Loader2,
  WifiOff,
  CloudOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DatePickerAr } from '@/components/shared/date-picker-ar';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { useSync } from '@/lib/providers/sync-provider';
import type { SaveStatus } from '@/lib/hooks/use-autosave';
import { cn } from '@/lib/utils/cn';
import { toArabicNumerals } from '@/lib/utils/date';

interface AttendanceToolbarProps {
  date: string;
  onDateChange: (date: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onPrepareDay: () => void;
  preparingDay: boolean;
  saveStatus: SaveStatus;
  hasRows: boolean;
}

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 5 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-1.5"
      >
        {status === 'saving' && (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
            <span className="text-xs text-blue-600 dark:text-blue-400">
              يتم الحفظ...
            </span>
          </>
        )}
        {status === 'saved' && (
          <>
            <Check className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs text-green-600 dark:text-green-400">
              تم الحفظ
            </span>
          </>
        )}
        {status === 'error' && (
          <>
            <CloudOff className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs text-red-600 dark:text-red-400">
              خطا في الحفظ
            </span>
          </>
        )}
        {status === 'offline' && (
          <>
            <WifiOff className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs text-orange-600 dark:text-orange-400">
              محفوظ محليا
            </span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export function AttendanceToolbar({
  date,
  onDateChange,
  searchQuery,
  onSearchChange,
  onPrepareDay,
  preparingDay,
  saveStatus,
  hasRows,
}: AttendanceToolbarProps) {
  const isOnline = useOnlineStatus();
  const { pendingCount, isSyncing, triggerSync } = useSync();

  return (
    <div className="space-y-3">
      {/* Top row: Date picker + Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <DatePickerAr
            value={date}
            onDateChange={onDateChange}
            className="w-auto min-w-[200px]"
          />

          {/* Save status */}
          {saveStatus !== 'idle' && (
            <SaveStatusIndicator status={saveStatus} />
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Prepare day button */}
          {!hasRows && (
            <Button
              onClick={onPrepareDay}
              disabled={preparingDay}
              size="sm"
            >
              {preparingDay ? (
                <Loader2 className="h-4 w-4 ml-1.5 animate-spin" />
              ) : (
                <CalendarPlus className="h-4 w-4 ml-1.5" />
              )}
              تجهيز اليوم
            </Button>
          )}

          {/* Sync button (visible when there are pending items) */}
          {pendingCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={triggerSync}
              disabled={isSyncing || !isOnline}
              className="relative"
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4 ml-1.5',
                  isSyncing && 'animate-spin'
                )}
              />
              مزامنة
              <Badge
                variant="destructive"
                className="absolute -top-2 -left-2 h-5 min-w-[20px] p-0 flex items-center justify-center text-[10px]"
              >
                {toArabicNumerals(pendingCount)}
              </Badge>
            </Button>
          )}
        </div>
      </div>

      {/* Search row */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="بحث عن موظف بالاسم..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pr-9"
        />
      </div>
    </div>
  );
}
