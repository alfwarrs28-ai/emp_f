'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { EmptyState } from '@/components/shared/empty-state';

import { KeyRound, Users, Eye, EyeOff, ShieldCheck, UserCog } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserProfile extends Profile {
  email?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PasswordManager() {
  const supabase = createClient();

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Reset password dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ---- Fetch profiles ----
  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching profiles:', error.message);
        toast.error('حدث خطأ أثناء تحميل المستخدمين');
        return;
      }

      setProfiles((data as UserProfile[]) || []);
    } catch (err) {
      console.error('Unexpected error fetching profiles:', err);
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // ---- Open reset dialog ----
  const handleOpenReset = (profile: UserProfile) => {
    setSelectedUser(profile);
    setNewPassword('');
    setShowPassword(false);
    setDialogOpen(true);
  };

  // ---- Submit password reset ----
  const handleResetPassword = async () => {
    if (!selectedUser) return;

    if (!newPassword || newPassword.length < 8) {
      toast.error('كلمة المرور يجب أن تكون ٨ أحرف على الأقل');
      return;
    }
    if (!/[A-Za-z]/.test(newPassword)) {
      toast.error('كلمة المرور يجب أن تحتوي على حرف واحد على الأقل');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      toast.error('كلمة المرور يجب أن تحتوي على رقم واحد على الأقل');
      return;
    }

    setResetting(true);
    try {
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: selectedUser.user_id,
          newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        toast.error(result.error || 'حدث خطأ أثناء إعادة تعيين كلمة المرور');
        return;
      }

      toast.success(result.message || 'تم إعادة تعيين كلمة المرور بنجاح');
      setDialogOpen(false);
      setSelectedUser(null);
      setNewPassword('');
    } catch (err) {
      console.error('Password reset error:', err);
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setResetting(false);
    }
  };

  // ---- Role badge ----
  const getRoleBadge = (role: string) => {
    if (role === 'admin') {
      return (
        <Badge variant="default" className="gap-1">
          <ShieldCheck className="h-3 w-3" />
          مدير
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <UserCog className="h-3 w-3" />
        مدخل بيانات
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            إدارة كلمات مرور المستخدمين
          </CardTitle>
          <CardDescription>
            إعادة تعيين كلمات المرور لمستخدمي النظام
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingSpinner className="py-8" />
          ) : profiles.length === 0 ? (
            <EmptyState
              icon={<Users className="h-10 w-10 text-muted-foreground" />}
              title="لا يوجد مستخدمون"
              description="لم يتم العثور على أي مستخدمين في النظام"
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>معرف المستخدم</TableHead>
                    <TableHead>الدور</TableHead>
                    <TableHead>تاريخ الإنشاء</TableHead>
                    <TableHead className="w-[140px]">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.user_id}>
                      <TableCell className="font-mono text-xs">
                        {profile.user_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell>{getRoleBadge(profile.role)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(profile.created_at).toLocaleDateString(
                          'ar-SA',
                          {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenReset(profile)}
                          className="gap-1"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          إعادة تعيين
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Password Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              إعادة تعيين كلمة المرور
            </DialogTitle>
            <DialogDescription>
              {selectedUser && (
                <>
                  إعادة تعيين كلمة المرور للمستخدم{' '}
                  <span className="font-mono text-xs">
                    ({selectedUser.user_id.substring(0, 8)}...)
                  </span>{' '}
                  — {selectedUser.role === 'admin' ? 'مدير' : 'مدخل بيانات'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الجديدة"
                  className="pl-10"
                  minLength={8}
                  dir="ltr"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                يجب أن تكون كلمة المرور ٨ أحرف على الأقل، وتحتوي على حرف ورقم
              </p>
            </div>

            {/* Password strength indicator */}
            {newPassword.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-1"
              >
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        newPassword.length >= level * 3
                          ? newPassword.length >= 12
                            ? 'bg-green-500'
                            : newPassword.length >= 8
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {newPassword.length < 8
                    ? 'قصيرة جداً'
                    : newPassword.length < 10
                      ? 'مقبولة'
                      : newPassword.length < 12
                        ? 'جيدة'
                        : 'قوية'}
                </p>
              </motion.div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={resetting}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={resetting || newPassword.length < 8}
            >
              {resetting ? (
                <>
                  <LoadingSpinner size="sm" className="ml-2" />
                  جارٍ التعيين...
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4 ml-2" />
                  تعيين كلمة المرور
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
