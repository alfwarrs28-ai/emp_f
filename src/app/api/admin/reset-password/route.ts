import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resetPasswordSchema } from '@/lib/utils/validation';

export async function POST(request: NextRequest) {
  try {
    // Parse and validate body
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { userId, newPassword } = parsed.data;

    // Verify caller is admin
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'غير مصرح — يجب تسجيل الدخول' },
        { status: 401 }
      );
    }

    // Check profile role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'غير مصرح — هذا الإجراء مخصص للمدراء فقط' },
        { status: 403 }
      );
    }

    // Use admin client to reset password
    const adminClient = createAdminClient();
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error resetting password:', updateError.message);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء إعادة تعيين كلمة المرور' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم إعادة تعيين كلمة المرور بنجاح',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
