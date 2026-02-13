import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { backupDataSchema, backupAttendanceItemSchema, backupPermissionItemSchema } from '@/lib/utils/validation';

export async function POST(request: NextRequest) {
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

    // Check content length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'حجم الملف كبير جداً (الحد الأقصى ٥٠ ميغابايت)' },
        { status: 413 }
      );
    }

    // Parse backup data
    let backupData: any;
    try {
      backupData = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'صيغة الملف غير صحيحة — يجب أن يكون JSON' },
        { status: 400 }
      );
    }

    // Validate structure
    const backupParsed = backupDataSchema.safeParse(backupData);
    if (!backupParsed.success) {
      return NextResponse.json(
        { error: 'بنية ملف النسخة الاحتياطية غير صالحة: ' + backupParsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const isPreview = searchParams.get('preview') === 'true';

    // ---- PREVIEW MODE ----
    if (isPreview) {
      // Compute date ranges for attendance
      let attendanceDateRange: { from: string; to: string } | null = null;
      if (backupData.attendance.length > 0) {
        const dates = backupData.attendance
          .map((a: any) => a.date)
          .filter(Boolean)
          .sort();
        attendanceDateRange = {
          from: dates[0],
          to: dates[dates.length - 1],
        };
      }

      // Compute date ranges for permissions
      let permissionDateRange: { from: string; to: string } | null = null;
      if (backupData.permissions.length > 0) {
        const dates = backupData.permissions
          .map((p: any) => p.date)
          .filter(Boolean)
          .sort();
        permissionDateRange = {
          from: dates[0],
          to: dates[dates.length - 1],
        };
      }

      // Sample records (first 3 of each)
      const preview = {
        metadata: backupData.metadata,
        counts: {
          employees: backupData.employees.length,
          settings: backupData.settings.length,
          attendance: backupData.attendance.length,
          permissions: backupData.permissions.length,
          locks: backupData.locks.length,
        },
        dateRanges: {
          attendance: attendanceDateRange,
          permissions: permissionDateRange,
        },
        samples: {
          employees: backupData.employees.slice(0, 3),
          attendance: backupData.attendance.slice(0, 3),
          permissions: backupData.permissions.slice(0, 3),
        },
      };

      return NextResponse.json({ success: true, preview });
    }

    // ---- FULL RESTORE MODE ----
    const adminClient = createAdminClient();
    const restoreErrors: string[] = [];

    // 1. Delete existing attendance and permissions
    const { error: deleteAttError } = await adminClient
      .from('attendance')
      .delete()
      .gte('id', 0); // Delete all rows

    if (deleteAttError) {
      restoreErrors.push(`خطأ حذف سجلات الحضور: ${deleteAttError.message}`);
    }

    const { error: deletePermError } = await adminClient
      .from('permissions')
      .delete()
      .gte('id', 0);

    if (deletePermError) {
      restoreErrors.push(`خطأ حذف سجلات الاستئذانات: ${deletePermError.message}`);
    }

    // If delete failed, don't continue
    if (restoreErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'فشل في حذف البيانات الحالية قبل الاستعادة',
          details: restoreErrors,
        },
        { status: 500 }
      );
    }

    // 2. Insert backup data
    const insertResults: Record<string, { success: number; failed: number }> = {};

    // Filter valid attendance items
    const validAttendance = backupData.attendance.filter(
      (item: unknown) => backupAttendanceItemSchema.safeParse(item).success
    );
    const skippedAttendance = backupData.attendance.length - validAttendance.length;

    // Insert attendance in batches of 500
    if (validAttendance.length > 0) {
      let successCount = 0;
      let failCount = 0;
      const batchSize = 500;

      for (let i = 0; i < validAttendance.length; i += batchSize) {
        const batch = validAttendance.slice(i, i + batchSize);
        const { error } = await adminClient.from('attendance').insert(batch);
        if (error) {
          failCount += batch.length;
          console.error('Attendance insert batch error:', error.message);
        } else {
          successCount += batch.length;
        }
      }
      insertResults.attendance = { success: successCount, failed: failCount };
    }

    // Filter valid permission items
    const validPermissions = backupData.permissions.filter(
      (item: unknown) => backupPermissionItemSchema.safeParse(item).success
    );
    const skippedPermissions = backupData.permissions.length - validPermissions.length;

    // Insert permissions in batches of 500
    if (validPermissions.length > 0) {
      let successCount = 0;
      let failCount = 0;
      const batchSize = 500;

      for (let i = 0; i < validPermissions.length; i += batchSize) {
        const batch = validPermissions.slice(i, i + batchSize);
        const { error } = await adminClient.from('permissions').insert(batch);
        if (error) {
          failCount += batch.length;
          console.error('Permissions insert batch error:', error.message);
        } else {
          successCount += batch.length;
        }
      }
      insertResults.permissions = { success: successCount, failed: failCount };
    }

    // 3. Log to audit_log
    try {
      await adminClient.from('audit_log').insert({
        user_id: user.id,
        action: 'backup_import',
        table_name: null,
        row_id: null,
        old_data: null,
        new_data: {
          backup_timestamp: backupData.metadata.timestamp,
          backup_version: backupData.metadata.version,
          restored_counts: insertResults,
        },
      });
    } catch {
      // Audit logging is non-critical
    }

    return NextResponse.json({
      success: true,
      message: 'تمت استعادة النسخة الاحتياطية بنجاح',
      details: {
        restored: insertResults,
        skipped: {
          attendance: skippedAttendance,
          permissions: skippedPermissions,
        },
        backup_timestamp: backupData.metadata.timestamp,
      },
    });
  } catch (error) {
    console.error('Backup import error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ غير متوقع أثناء الاستعادة' },
      { status: 500 }
    );
  }
}
