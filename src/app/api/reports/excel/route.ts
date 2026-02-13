import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { excelExportSchema } from '@/lib/utils/validation';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'صلاحيات غير كافية' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = excelExportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { startDate, endDate, employeeIds } = parsed.data;

    // Fetch settings
    const { data: settings } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (!settings) {
      return NextResponse.json({ error: 'لم يتم العثور على الإعدادات' }, { status: 400 });
    }

    // Fetch employees
    let employeeQuery = supabase
      .from('employees')
      .select('*')
      .eq('active', true)
      .order('emp_no');

    if (employeeIds && employeeIds.length > 0) {
      employeeQuery = employeeQuery.in('id', employeeIds);
    }

    const { data: employees } = await employeeQuery;

    if (!employees || employees.length === 0) {
      return NextResponse.json({ error: 'لا يوجد موظفون' }, { status: 400 });
    }

    // Fetch attendance
    const { data: attendance } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date')
      .order('emp_id');

    // Fetch permissions
    const { data: permissions } = await supabase
      .from('permissions')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('status', 'approved');

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'نظام الحضور والغياب';
    workbook.created = new Date();

    // --- Sheet 1: Summary Report ---
    const summarySheet = workbook.addWorksheet('ملخص التقرير', {
      views: [{ rightToLeft: true }],
    });

    // Title
    summarySheet.mergeCells('A1:J1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = `تقرير الحضور والغياب - من ${startDate} إلى ${endDate}`;
    titleCell.font = { bold: true, size: 16, name: 'Arial' };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Headers
    const headers = [
      'رقم الموظف',
      'اسم الموظف',
      'أيام الحضور',
      'أيام الغياب',
      'غياب بعذر',
      'غياب بدون عذر',
      'إجمالي التأخر (دقيقة)',
      'صافي التأخر (دقيقة)',
      'إجمالي الخروج المبكر (دقيقة)',
      'صافي الخروج المبكر (دقيقة)',
      'استئذانات أثناء الدوام (دقيقة)',
    ];

    summarySheet.addRow([]);
    const headerRow = summarySheet.addRow(headers);
    headerRow.font = { bold: true, size: 12 };
    headerRow.alignment = { horizontal: 'center' };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Calculate workdays in range
    const workdays = settings.workdays.split(',').map(Number);

    // Parse time to minutes helper
    const timeToMinutes = (time: string): number => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const startTimeMins = timeToMinutes(settings.start_time);
    const endTimeMins = timeToMinutes(settings.end_time);
    const graceMins = settings.grace_minutes;

    // Generate report data per employee
    for (const emp of employees) {
      const empAttendance = (attendance || []).filter(
        (a: { emp_id: number }) => a.emp_id === emp.id
      );
      const empPermissions = (permissions || []).filter(
        (p: { emp_id: number }) => p.emp_id === emp.id
      );

      // Count workdays in range
      const start = new Date(startDate);
      const end = new Date(endDate);
      let totalWorkdays = 0;
      let presentDays = 0;
      let absentDays = 0;
      let excusedAbsentDays = 0;
      let unexcusedAbsentDays = 0;
      let totalLateMins = 0;
      let totalEarlyLeaveMins = 0;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (!workdays.includes(dayOfWeek)) continue;

        totalWorkdays++;
        const dateStr = d.toISOString().split('T')[0];
        const dayAttendance = empAttendance.find(
          (a: { date: string }) => a.date === dateStr
        );

        if (!dayAttendance || !dayAttendance.in_time) {
          absentDays++;
          if (dayAttendance?.note_type === 'excused_absence') {
            excusedAbsentDays++;
          } else if (dayAttendance?.note_type === 'unexcused_absence') {
            unexcusedAbsentDays++;
          }
          continue;
        }

        presentDays++;

        // Calculate late
        if (dayAttendance.in_time) {
          const inMins = timeToMinutes(dayAttendance.in_time);
          const lateMinutes = Math.max(0, inMins - (startTimeMins + graceMins));
          totalLateMins += lateMinutes;
        }

        // Calculate early leave
        if (dayAttendance.out_time) {
          const outMins = timeToMinutes(dayAttendance.out_time);
          const earlyMins = Math.max(0, endTimeMins - outMins);
          totalEarlyLeaveMins += earlyMins;
        }
      }

      // Calculate permission deductions
      const latePerms = empPermissions
        .filter((p: { type: string }) => p.type === 'late_arrival')
        .reduce((sum: number, p: { minutes: number }) => sum + p.minutes, 0);

      const earlyPerms = empPermissions
        .filter((p: { type: string }) => p.type === 'early_leave')
        .reduce((sum: number, p: { minutes: number }) => sum + p.minutes, 0);

      const duringDayPerms = empPermissions
        .filter((p: { type: string }) => p.type === 'during_day')
        .reduce((sum: number, p: { minutes: number }) => sum + p.minutes, 0);

      const netLate = Math.max(0, totalLateMins - latePerms);
      const netEarlyLeave = Math.max(0, totalEarlyLeaveMins - earlyPerms);

      const dataRow = summarySheet.addRow([
        emp.emp_no,
        emp.name,
        presentDays,
        absentDays,
        excusedAbsentDays,
        unexcusedAbsentDays,
        totalLateMins,
        netLate,
        totalEarlyLeaveMins,
        netEarlyLeave,
        duringDayPerms,
      ]);

      dataRow.alignment = { horizontal: 'center' };
      dataRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }

    // Auto-fit columns
    summarySheet.columns.forEach((column) => {
      column.width = 20;
    });

    // --- Sheet 2: Detailed Attendance ---
    const detailSheet = workbook.addWorksheet('تفاصيل الحضور', {
      views: [{ rightToLeft: true }],
    });

    detailSheet.addRow(['التاريخ', 'رقم الموظف', 'اسم الموظف', 'وقت الحضور', 'وقت الانصراف', 'الحالة', 'ملاحظة']);
    const detailHeader = detailSheet.getRow(1);
    detailHeader.font = { bold: true, size: 12 };
    detailHeader.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF10B981' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    const empMap = new Map(employees.map((e: { id: number }) => [e.id, e]));

    (attendance || []).forEach((record: { date: string; emp_id: number; in_time: string | null; out_time: string | null; note: string | null }) => {
      const emp = empMap.get(record.emp_id) as { emp_no: string; name: string } | undefined;
      if (!emp) return;

      let status = 'غائب';
      if (record.in_time) {
        const inMins = timeToMinutes(record.in_time);
        if (inMins <= startTimeMins + graceMins) {
          status = 'حاضر في الوقت';
        } else {
          const lateMins = inMins - (startTimeMins + graceMins);
          status = `متأخر ${lateMins} دقيقة`;
        }
      }

      const row = detailSheet.addRow([
        record.date,
        emp.emp_no,
        emp.name,
        record.in_time || '-',
        record.out_time || '-',
        status,
        record.note || '',
      ]);

      row.alignment = { horizontal: 'center' };
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    detailSheet.columns.forEach((column) => {
      column.width = 18;
    });

    // --- Sheet 3: Permissions ---
    const permSheet = workbook.addWorksheet('الاستئذانات', {
      views: [{ rightToLeft: true }],
    });

    permSheet.addRow(['التاريخ', 'رقم الموظف', 'اسم الموظف', 'النوع', 'المدة (دقيقة)', 'السبب', 'الحالة']);
    const permHeader = permSheet.getRow(1);
    permHeader.font = { bold: true, size: 12 };
    permHeader.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF59E0B' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    const typeLabels: Record<string, string> = {
      late_arrival: 'تأخر صباحي',
      early_leave: 'خروج مبكر',
      during_day: 'أثناء الدوام',
    };

    const statusLabels: Record<string, string> = {
      approved: 'معتمد',
      pending: 'معلق',
      rejected: 'مرفوض',
    };

    (permissions || []).forEach((perm: { date: string; emp_id: number; type: string; minutes: number; reason: string | null; status: string }) => {
      const emp = empMap.get(perm.emp_id) as { emp_no: string; name: string } | undefined;
      if (!emp) return;

      const row = permSheet.addRow([
        perm.date,
        emp.emp_no,
        emp.name,
        typeLabels[perm.type] || perm.type,
        perm.minutes,
        perm.reason || '',
        statusLabels[perm.status] || perm.status,
      ]);

      row.alignment = { horizontal: 'center' };
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    permSheet.columns.forEach((column) => {
      column.width = 18;
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="attendance-report-${startDate}-${endDate}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء التقرير' }, { status: 500 });
  }
}
