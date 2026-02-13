'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Check,
  Loader2,
  WifiOff,
  CloudOff,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DatePickerAr } from '@/components/shared/date-picker-ar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SaveStatus } from '@/lib/hooks/use-autosave';

interface AbsenceToolbarProps {
  date: string;
  onDateChange: (date: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  saveStatus: SaveStatus;
  activeTab: 'absence' | 'lateness';
  onTabChange: (tab: 'absence' | 'lateness') => void;
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

export function AbsenceToolbar({
  date,
  onDateChange,
  searchQuery,
  onSearchChange,
  saveStatus,
  activeTab,
  onTabChange,
}: AbsenceToolbarProps) {
  return (
    <div className="space-y-3">
      {/* Top row: Date picker + Save status */}
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

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(value) => onTabChange(value as 'absence' | 'lateness')}
        >
          <TabsList>
            <TabsTrigger value="absence">الغياب</TabsTrigger>
            <TabsTrigger value="lateness">التأخير</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search row */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="بحث بالاسم..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pr-9"
        />
      </div>
    </div>
  );
}
