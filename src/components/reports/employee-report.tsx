'use client';

import { useState, useMemo } from 'react';
import {
  CalendarDays,
  CalendarCheck2,
  CalendarX2,
  Clock,
  Timer,
  ClipboardList,
  User,
  Hash,
  CalendarRange,
  UserSearch,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';
import {
  toArabicNumerals,
  isWorkday,
  getDaysInRange,
  formatDateAr,
} from '@/lib/utils/date';
import { calcLateMins, calcEarlyLeaveMins } from '@/lib/utils/time';
import type {
  Attendance,
  Permission,
  Employee,
} from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmployeeReportProps {
  attendance: Attendance[];
  permissions: Permission[];
  employees: Employee[];
  settings: {
    start_time: string;
    end_time: string;
    grace_minutes: number;
    workdays: string;
  };
  startDate: string;
  endDate: string;
}

interface DayRecord {
  date: string;
  status: 'present' | 'late' | 'absent' | 'excused' | 'missing_out';
  inTime: string | null;
  outTime: string | null;
  lateMins: number;
  note: string | null;
}

interface KpiItem {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Permission type & status labels
// ---------------------------------------------------------------------------

const PERMISSION_TYPE_LABEL: Record<string, string> = {
  late_arrival: 'تأخر صباحي',
  early_leave: 'خروج مبكر',
  during_day: 'أثناء الدوام',
};

const PERMISSION_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  approved: {
    label: 'موافق',
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  },
  pending: {
    label: 'معلق',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  },
  rejected: {
    label: 'مرفوض',
    className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  },
};

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({ icon, label, value, suffix, color }: KpiItem) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            color
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold tabular-nums leading-tight">
            {toArabicNumerals(value)}
            {suffix && (
              <span className="text-sm font-normal text-muted-foreground mr-1">
                {suffix}
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function DayStatusBadge({ record }: { record: DayRecord }) {
  switch (record.status) {
    case 'present':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          حاضر
        </Badge>
      );
    case 'late':
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          متأخر {toArabicNumerals(record.lateMins)} د
        </Badge>
      );
    case 'absent':
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
          غائب
        </Badge>
      );
    case 'excused':
      return (
        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400">
          غائب بعذر
        </Badge>
      );
    case 'missing_out':
      return (
        <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          لم يسجل انصراف
        </Badge>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EmployeeReport({
  attendance,
  permissions,
  employees,
  settings,
  startDate,
  endDate,
}: EmployeeReportProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  // ------- Filtered data for the selected employee -------
  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return employees.find((e) => String(e.id) === selectedEmployeeId) ?? null;
  }, [selectedEmployeeId, employees]);

  const empAttendance = useMemo(() => {
    if (!selectedEmployeeId) return [];
    const empId = Number(selectedEmployeeId);
    return attendance.filter((a) => a.emp_id === empId);
  }, [selectedEmployeeId, attendance]);

  const empPermissions = useMemo(() => {
    if (!selectedEmployeeId) return [];
    const empId = Number(selectedEmployeeId);
    return permissions.filter((p) => p.emp_id === empId);
  }, [selectedEmployeeId, permissions]);

  // ------- Compute day-by-day records -------
  const dayRecords = useMemo<DayRecord[]>(() => {
    if (!selectedEmployeeId) return [];

    const allDays = getDaysInRange(startDate, endDate);
    const workdayDates = allDays.filter((d) =>
      isWorkday(d, settings.workdays)
    );

    // Index attendance by date
    const attMap = new Map<string, Attendance>();
    for (const att of empAttendance) {
      attMap.set(att.date, att);
    }

    return workdayDates.map((date) => {
      const att = attMap.get(date);

      // No record at all => absent
      if (!att) {
        return {
          date,
          status: 'absent' as const,
          inTime: null,
          outTime: null,
          lateMins: 0,
          note: null,
        };
      }

      // Has no in_time => check note_type for excused
      if (!att.in_time) {
        const isExcused =
          att.note_type === 'excused_absence' ||
          att.note_type === 'medical' ||
          att.note_type === 'official';
        return {
          date,
          status: isExcused ? ('excused' as const) : ('absent' as const),
          inTime: null,
          outTime: null,
          lateMins: 0,
          note: att.note,
        };
      }

      // Has in_time but no out_time
      if (!att.out_time) {
        const lateMins = calcLateMins(
          att.in_time,
          settings.start_time,
          settings.grace_minutes
        );
        return {
          date,
          status: 'missing_out' as const,
          inTime: att.in_time,
          outTime: null,
          lateMins,
          note: att.note,
        };
      }

      // Both times present
      const lateMins = calcLateMins(
        att.in_time,
        settings.start_time,
        settings.grace_minutes
      );

      return {
        date,
        status: lateMins > 0 ? ('late' as const) : ('present' as const),
        inTime: att.in_time,
        outTime: att.out_time,
        lateMins,
        note: att.note,
      };
    });
  }, [selectedEmployeeId, empAttendance, startDate, endDate, settings]);

  // ------- Compute KPIs -------
  const kpis = useMemo(() => {
    if (!selectedEmployeeId || dayRecords.length === 0) return null;

    const totalWorkdays = dayRecords.length;
    const presentDays = dayRecords.filter(
      (r) =>
        r.status === 'present' ||
        r.status === 'late' ||
        r.status === 'missing_out'
    ).length;
    const absentDays = dayRecords.filter(
      (r) => r.status === 'absent' || r.status === 'excused'
    ).length;
    const totalLateMins = dayRecords.reduce((sum, r) => sum + r.lateMins, 0);

    // Sum approved permission minutes
    const approvedPerms = empPermissions.filter(
      (p) => p.status === 'approved'
    );
    const totalApprovedPermMins = approvedPerms.reduce(
      (sum, p) => sum + p.minutes,
      0
    );
    const approvedLatePermMins = approvedPerms
      .filter((p) => p.type === 'late_arrival')
      .reduce((sum, p) => sum + p.minutes, 0);

    const netLateMins = Math.max(0, totalLateMins - approvedLatePermMins);

    return {
      totalWorkdays,
      presentDays,
      absentDays,
      totalLateMins,
      netLateMins,
      totalApprovedPermMins,
    };
  }, [selectedEmployeeId, dayRecords, empPermissions]);

  // ------- Sorted permissions for display -------
  const sortedPermissions = useMemo(() => {
    return [...empPermissions].sort((a, b) => a.date.localeCompare(b.date));
  }, [empPermissions]);

  // ===================================================================
  // Render
  // ===================================================================

  return (
    <div className="space-y-6">
      {/* ----- Employee selector ----- */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <UserSearch className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 max-w-sm">
              <Select
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الموظف..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.name} — {emp.emp_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ----- Empty state ----- */}
      {!selectedEmployee && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <UserSearch className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-lg text-muted-foreground">
              اختر معلما لعرض تقريره التفصيلي
            </p>
          </CardContent>
        </Card>
      )}

      {/* ----- Report content ----- */}
      {selectedEmployee && kpis && (
        <>
          {/* ===== A) Profile card ===== */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-7 w-7 text-primary" />
                </div>
                <div className="space-y-1 flex-1">
                  <h2 className="text-xl font-bold">
                    {selectedEmployee.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5" />
                      رقم الموظف: {toArabicNumerals(selectedEmployee.emp_no)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CalendarRange className="h-3.5 w-3.5" />
                      الفترة: {formatDateAr(startDate)} — {formatDateAr(endDate)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ===== B) KPI Summary ===== */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              icon={<CalendarDays className="h-6 w-6 text-blue-600" />}
              label="أيام العمل"
              value={kpis.totalWorkdays}
              color="bg-blue-100 dark:bg-blue-950"
            />
            <KpiCard
              icon={<CalendarCheck2 className="h-6 w-6 text-emerald-600" />}
              label="أيام الحضور"
              value={kpis.presentDays}
              color="bg-emerald-100 dark:bg-emerald-950"
            />
            <KpiCard
              icon={<CalendarX2 className="h-6 w-6 text-red-600" />}
              label="أيام الغياب"
              value={kpis.absentDays}
              color="bg-red-100 dark:bg-red-950"
            />
            <KpiCard
              icon={<Clock className="h-6 w-6 text-amber-600" />}
              label="إجمالي التأخر"
              value={kpis.totalLateMins}
              suffix="دقيقة"
              color="bg-amber-100 dark:bg-amber-950"
            />
            <KpiCard
              icon={<Timer className="h-6 w-6 text-orange-600" />}
              label="صافي التأخر"
              value={kpis.netLateMins}
              suffix="دقيقة"
              color="bg-orange-100 dark:bg-orange-950"
            />
            <KpiCard
              icon={<ClipboardList className="h-6 w-6 text-violet-600" />}
              label="الاستئذانات"
              value={kpis.totalApprovedPermMins}
              suffix="دقيقة"
              color="bg-violet-100 dark:bg-violet-950"
            />
          </div>

          {/* ===== C) Daily attendance log ===== */}
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-base">
                  سجل الحضور اليومي
                </h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap">التاريخ</TableHead>
                      <TableHead className="whitespace-nowrap">الحالة</TableHead>
                      <TableHead className="whitespace-nowrap">وقت الحضور</TableHead>
                      <TableHead className="whitespace-nowrap">وقت الانصراف</TableHead>
                      <TableHead className="whitespace-nowrap">التأخير (دقيقة)</TableHead>
                      <TableHead className="whitespace-nowrap">الملاحظة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dayRecords.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground"
                        >
                          لا توجد بيانات في هذه الفترة
                        </TableCell>
                      </TableRow>
                    ) : (
                      dayRecords.map((record) => (
                        <TableRow
                          key={record.date}
                          className={cn(
                            record.status === 'absent' &&
                              'bg-red-50/50 dark:bg-red-950/20',
                            record.status === 'excused' &&
                              'bg-orange-50/50 dark:bg-orange-950/20',
                            record.status === 'late' &&
                              'bg-amber-50/50 dark:bg-amber-950/20'
                          )}
                        >
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatDateAr(record.date)}
                          </TableCell>
                          <TableCell>
                            <DayStatusBadge record={record} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm font-mono">
                            {record.inTime
                              ? toArabicNumerals(record.inTime)
                              : '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm font-mono">
                            {record.outTime
                              ? toArabicNumerals(record.outTime)
                              : '—'}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'whitespace-nowrap text-sm',
                              record.lateMins > 0 &&
                                'font-semibold text-amber-600 dark:text-amber-400'
                            )}
                          >
                            {record.lateMins > 0
                              ? toArabicNumerals(record.lateMins)
                              : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {record.note || '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ===== D) Permissions list ===== */}
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-base">الاستئذانات</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="whitespace-nowrap">التاريخ</TableHead>
                      <TableHead className="whitespace-nowrap">النوع</TableHead>
                      <TableHead className="whitespace-nowrap">المدة</TableHead>
                      <TableHead className="whitespace-nowrap">السبب</TableHead>
                      <TableHead className="whitespace-nowrap">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPermissions.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center py-8 text-muted-foreground"
                        >
                          لا توجد استئذانات في هذه الفترة
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedPermissions.map((perm) => {
                        const statusConfig =
                          PERMISSION_STATUS_CONFIG[perm.status] ??
                          PERMISSION_STATUS_CONFIG.pending;
                        return (
                          <TableRow key={perm.id}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {formatDateAr(perm.date)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {PERMISSION_TYPE_LABEL[perm.type] ?? perm.type}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {toArabicNumerals(perm.minutes)} دقيقة
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {perm.reason || '—'}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusConfig.className}>
                                {statusConfig.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
