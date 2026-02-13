'use client';

import { useAuth } from '@/lib/providers/auth-provider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { KeyRound, LogOut } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير النظام',
  data_entry: 'مدخل بيانات',
};

export function UserMenu() {
  const { user, role, signOut } = useAuth();

  const email = user?.email ?? '';
  const initials = email
    ? email.substring(0, 2).toUpperCase()
    : '؟؟';
  const roleLabel = role ? ROLE_LABELS[role] ?? role : '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">{email}</p>
            {roleLabel && (
              <p className="text-xs leading-none text-muted-foreground">
                {roleLabel}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 cursor-pointer">
          <KeyRound className="h-4 w-4" />
          <span>تغيير كلمة المرور</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="h-4 w-4" />
          <span>تسجيل الخروج</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
