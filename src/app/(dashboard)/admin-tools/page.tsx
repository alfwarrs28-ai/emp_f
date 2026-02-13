'use client';

import { useAuth } from '@/lib/providers/auth-provider';
import { MonthLockManager } from '@/components/admin-tools/month-lock-manager';
import { BackupManager } from '@/components/admin-tools/backup-manager';
import { DataResetDialog } from '@/components/admin-tools/data-reset-dialog';
import { PasswordManager } from '@/components/admin-tools/password-manager';
import { PageHeader } from '@/components/shared/page-header';
import { LoadingSpinner } from '@/components/shared/loading-spinner';

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  Lock,
  HardDrive,
  Trash2,
  KeyRound,
  ShieldAlert,
  UserX,
} from 'lucide-react';

export default function AdminToolsPage() {
  const { isAdmin, loading: authLoading } = useAuth();

  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Not admin — access denied
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <UserX className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-xl font-semibold mb-2">غير مصرح</h2>
            <p className="text-muted-foreground">
              ليس لديك صلاحية الوصول إلى هذه الصفحة. هذه الصفحة مخصصة للمدراء
              فقط.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="أدوات المدير"
        description="أدوات إدارية متقدمة لإقفال الفترات والنسخ الاحتياطي وإدارة المستخدمين"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" />
          <span>مدير فقط</span>
        </div>
      </PageHeader>

      <Tabs defaultValue="locks" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="locks" className="flex-1 min-w-[120px] gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">إقفال الفترات</span>
            <span className="sm:hidden">إقفال</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex-1 min-w-[120px] gap-2">
            <HardDrive className="h-4 w-4" />
            <span className="hidden sm:inline">النسخ الاحتياطي</span>
            <span className="sm:hidden">نسخ</span>
          </TabsTrigger>
          <TabsTrigger value="reset" className="flex-1 min-w-[120px] gap-2">
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">تصفير البيانات</span>
            <span className="sm:hidden">تصفير</span>
          </TabsTrigger>
          <TabsTrigger value="passwords" className="flex-1 min-w-[120px] gap-2">
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">إدارة كلمات المرور</span>
            <span className="sm:hidden">كلمات مرور</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="locks" className="mt-6">
          <MonthLockManager />
        </TabsContent>

        <TabsContent value="backup" className="mt-6">
          <BackupManager />
        </TabsContent>

        <TabsContent value="reset" className="mt-6">
          <DataResetDialog />
        </TabsContent>

        <TabsContent value="passwords" className="mt-6">
          <PasswordManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
