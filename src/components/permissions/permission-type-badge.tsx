'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { PERMISSION_TYPE_MAP } from '@/lib/utils/constants';
import type { PermissionType } from '@/types/database';

interface PermissionTypeBadgeProps {
  type: PermissionType;
  className?: string;
}

const TYPE_STYLES: Record<PermissionType, string> = {
  late_arrival:
    'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800',
  early_leave:
    'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
  during_day:
    'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
};

export function PermissionTypeBadge({ type, className }: PermissionTypeBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('text-xs whitespace-nowrap', TYPE_STYLES[type], className)}
    >
      {PERMISSION_TYPE_MAP[type]}
    </Badge>
  );
}
