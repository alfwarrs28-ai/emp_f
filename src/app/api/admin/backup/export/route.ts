import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface BackupData {
  metadata: {
    version: string;
    timestamp: string;
    exported_by: string;
    counts: {
      employees: number;
      settings: number;
      attendance: number;
      permissions: number;
      locks: number;
    };
  };
  employees: any[];
  settings: any[];
  attendance: any[];
  permissions: any[];
  locks: any[];
}

export async function GET(request: NextRequest) {
  try {
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

    // Fetch all tables using admin client (bypasses RLS)
    const adminClient = createAdminClient();

    const [
      employeesResult,
      settingsResult,
      attendanceResult,
      permissionsResult,
      locksResult,
    ] = await Promise.all([
      adminClient.from('employees').select('*').order('id'),
      adminClient.from('settings').select('*').order('id'),
      adminClient.from('attendance').select('*').order('id'),
      adminClient.from('permissions').select('*').order('id'),
      adminClient.from('locks').select('*').order('id'),
    ]);

    // Check for errors
    const errors = [
      employeesResult.error,
      settingsResult.error,
      attendanceResult.error,
      permissionsResult.error,
      locksResult.error,
    ].filter(Boolean);

    if (errors.length > 0) {
      console.error('Backup export errors:', errors);
      return NextResponse.json(
        { error: 'حدث خطأ أثناء تصدير البيانات' },
        { status: 500 }
      );
    }

    const employees = employeesResult.data || [];
    const settings = settingsResult.data || [];
    const attendance = attendanceResult.data || [];
    const permissions = permissionsResult.data || [];
    const locks = locksResult.data || [];

    // Build backup structure
    const backup: BackupData = {
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        exported_by: user.id,
        counts: {
          employees: employees.length,
          settings: settings.length,
          attendance: attendance.length,
          permissions: permissions.length,
          locks: locks.length,
        },
      },
      employees,
      settings,
      attendance,
      permissions,
      locks,
    };

    const jsonString = JSON.stringify(backup, null, 2);

    // Try to store in Supabase Storage (optional — don't fail if bucket doesn't exist)
    try {
      const fileName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      await adminClient.storage
        .from('backups')
        .upload(fileName, jsonString, {
          contentType: 'application/json',
          upsert: false,
        });
    } catch {
      // Storage bucket may not exist — silently ignore
    }

    // Log to audit_log
    try {
      await adminClient.from('audit_log').insert({
        user_id: user.id,
        action: 'backup_export',
        table_name: null,
        row_id: null,
        old_data: null,
        new_data: {
          counts: backup.metadata.counts,
          timestamp: backup.metadata.timestamp,
        },
      });
    } catch {
      // Audit logging is non-critical
    }

    // Check backup size
    const MAX_BACKUP_SIZE = 50 * 1024 * 1024; // 50MB
    if (jsonString.length > MAX_BACKUP_SIZE) {
      return NextResponse.json(
        { error: 'حجم النسخة الاحتياطية كبير جداً (الحد الأقصى ٥٠ ميغابايت)' },
        { status: 413 }
      );
    }

    // Return as downloadable JSON file
    const dateStr = new Date()
      .toISOString()
      .split('T')[0];
    const filename = `school-attendance-backup-${dateStr}.json`;

    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Backup export error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء التصدير' },
      { status: 500 }
    );
  }
}
