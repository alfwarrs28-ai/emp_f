'use client';

import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { ConnectionStatus } from '@/components/shared/connection-status';
import { UserMenu } from '@/components/layout/user-menu';
import { NAV_ITEMS } from '@/lib/utils/constants';

// ---------------------------------------------------------------------------
// Route title mapping
// ---------------------------------------------------------------------------

function getPageTitle(pathname: string): string {
  const item = NAV_ITEMS.find(
    (nav) => pathname === nav.href || pathname.startsWith(nav.href + '/')
  );
  if (item) return item.label;

  // Fallback mapping
  const fallback: Record<string, string> = {
    '/dashboard': 'لوحة التحكم',
    '/attendance': 'الحضور والانصراف',
    '/permissions': 'الاستئذانات',
    '/employees': 'الموظفون',
    '/reports': 'التقارير',
    '/settings': 'الإعدادات',
    '/admin-tools': 'أدوات المدير',
  };

  for (const [route, title] of Object.entries(fallback)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return title;
    }
  }

  return 'نظام الحضور';
}

// ---------------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------------

interface TopBarProps {
  onMobileMenuToggle: () => void;
}

export function TopBar({ onMobileMenuToggle }: TopBarProps) {
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6">
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden h-9 w-9"
        onClick={onMobileMenuToggle}
      >
        <Menu className="h-5 w-5" />
        <span className="sr-only">القائمة</span>
      </Button>

      {/* Page title */}
      <h2 className="text-lg font-semibold truncate flex-1">{pageTitle}</h2>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        <ConnectionStatus />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
