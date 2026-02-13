import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { UserRole } from '@/types/database';

export default async function DashboardRootPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  const role = (profile?.role as UserRole) ?? null;

  if (role === 'admin') {
    redirect('/dashboard');
  }

  redirect('/attendance');
}
