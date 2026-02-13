'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardCheck,
  Clock,
  Users,
  FileBarChart,
  Settings,
  Shield,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/lib/providers/auth-provider';
import { NAV_ITEMS } from '@/lib/utils/constants';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  CalendarCheck: ClipboardCheck,
  ClipboardList: Clock,
  Users,
  FileBarChart,
  Settings,
  ShieldCheck: Shield,
  UserX,
};

function getIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || LayoutDashboard;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير النظام',
  data_entry: 'مدخل بيانات',
};

// ---------------------------------------------------------------------------
// MobileNav
// ---------------------------------------------------------------------------

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname();
  const { user, role } = useAuth();

  // Close on route change
  useEffect(() => {
    onOpenChange(false);
  }, [pathname, onOpenChange]);

  // Filter items based on role
  const filteredItems = NAV_ITEMS.filter((item) => {
    if (item.requiredRole === null) return true;
    return item.requiredRole === role;
  });

  const adminItems = filteredItems.filter((item) => item.requiredRole === role);
  const sharedItems = filteredItems.filter((item) => item.requiredRole === null);

  const email = user?.email ?? '';
  const initials = email ? email.substring(0, 2).toUpperCase() : '؟؟';
  const roleLabel = role ? ROLE_LABELS[role] ?? role : '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[280px] p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-right">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              ح
            </div>
            <span className="font-semibold">نظام الحضور</span>
          </SheetTitle>
        </SheetHeader>

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className="flex flex-col gap-1 px-3">
            {adminItems.map((item) => {
              const Icon = getIcon(item.icon);
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {adminItems.length > 0 && sharedItems.length > 0 && (
              <Separator className="my-2" />
            )}
            {sharedItems.map((item) => {
              const Icon = getIcon(item.icon);
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User info at bottom */}
        <div className="border-t p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate">{email}</span>
              {roleLabel && (
                <span className="text-xs text-muted-foreground">
                  {roleLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
