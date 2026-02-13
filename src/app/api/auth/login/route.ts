import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loginSchema } from '@/lib/utils/validation';
import { loginBruteForce, getClientIP } from '@/lib/utils/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request);

    // Brute force check
    const bruteCheck = loginBruteForce.check(ip);
    if (!bruteCheck.allowed) {
      return NextResponse.json(
        { error: `تم تجاوز عدد المحاولات المسموح. يرجى الانتظار ${bruteCheck.lockoutSeconds} ثانية.` },
        { status: 429 }
      );
    }

    // Validate input
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    // Attempt login
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      loginBruteForce.recordFailure(ip);
      return NextResponse.json(
        { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    // Success — reset brute force
    loginBruteForce.reset(ip);

    // Fetch role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', data.user.id)
      .single();

    return NextResponse.json({
      success: true,
      role: profile?.role || 'data_entry',
    });
  } catch {
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
