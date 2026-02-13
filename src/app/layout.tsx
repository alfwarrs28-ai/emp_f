import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic } from 'next/font/google';
import { ThemeProvider } from '@/lib/providers/theme-provider';
import { Toaster } from 'sonner';
import './globals.css';

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'نظام الحضور والغياب',
  description: 'نظام إدارة حضور وغياب وتأخر الموظفين',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={ibmPlexArabic.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-center" dir="rtl" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
