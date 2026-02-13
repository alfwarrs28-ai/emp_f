'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ClipboardCheck,
  Clock,
  Users,
  FileBarChart,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/lib/providers/auth-provider';
import { NAV_ITEMS, type NavItem } from '@/lib/utils/constants';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';

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

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { role } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Filter items based on user role
  const filteredItems = NAV_ITEMS.filter((item) => {
    if (item.requiredRole === null) return true;
    return item.requiredRole === role;
  });

  // Sort: shared routes at bottom
  const adminItems = filteredItems.filter((item) => item.requiredRole === role);
  const sharedItems = filteredItems.filter((item) => item.requiredRole === null);

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-l bg-card h-screen sticky top-0 transition-all duration-300',
        collapsed ? 'w-[70px]' : 'w-[260px]',
        className
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              ح
            </div>
            <span className="font-semibold text-sm">نظام الحضور</span>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            ح
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="flex flex-col gap-1 px-2">
          {adminItems.map((item) => (
            <SidebarItem
              key={item.href}
              item={item}
              isActive={pathname === item.href}
              collapsed={collapsed}
            />
          ))}
          {adminItems.length > 0 && sharedItems.length > 0 && (
            <Separator className="my-2" />
          )}
          {sharedItems.map((item) => (
            <SidebarItem
              key={item.href}
              item={item}
              isActive={pathname === item.href}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </ScrollArea>

      {/* Collapse toggle */}
      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="icon"
          className="w-full h-9"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// SidebarItem
// ---------------------------------------------------------------------------

interface SidebarItemProps {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}

function SidebarItem({ item, isActive, collapsed }: SidebarItemProps) {
  const Icon = getIcon(item.icon);

  const content = (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors relative group',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        collapsed && 'justify-center px-2'
      )}
    >
      {isActive && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-md bg-primary/10"
          transition={{ type: 'spring', duration: 0.3, bounce: 0.15 }}
        />
      )}
      <Icon className={cn('h-5 w-5 shrink-0 relative z-10')} />
      {!collapsed && (
        <span className="relative z-10 truncate">{item.label}</span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="left" className="font-medium">
            {item.label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}
