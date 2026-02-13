'use client';

import { useState, useCallback } from 'react';
import { AuthProvider } from '@/lib/providers/auth-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { MobileNav } from '@/components/layout/mobile-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleMobileMenuToggle = useCallback(() => {
    setMobileNavOpen((prev) => !prev);
  }, []);

  const handleMobileNavChange = useCallback((open: boolean) => {
    setMobileNavOpen(open);
  }, []);

  return (
    <AuthProvider>
      <div className="flex min-h-screen">
        {/* Desktop sidebar (right side in RTL) */}
        <Sidebar />

        {/* Mobile nav sheet */}
        <MobileNav open={mobileNavOpen} onOpenChange={handleMobileNavChange} />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          <TopBar onMobileMenuToggle={handleMobileMenuToggle} />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
