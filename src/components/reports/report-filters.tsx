'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DatePickerAr } from '@/components/shared/date-picker-ar';
import { getWeekRange, getMonthRange, getTodaySaudi } from '@/lib/utils/date';
import { toArabicNumerals } from '@/lib/utils/date';
import type { Employee } from '@/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportFilters {
  startDate: string;
  endDate: string;
  employeeIds: number[];
}

interface ReportFiltersProps {
  employees: Employee[];
  filters: ReportFilters;
  onApply: (filters: ReportFilters) => void;
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportFiltersPanel({
  employees,
  filters,
  onApply,
  loading = false,
}: ReportFiltersProps) {
  const [expanded, setExpanded] = useState(true);
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>(
    filters.employeeIds
  );
  const [employeeSearch, setEmployeeSearch] = useState('');

  // --- Quick preset helpers ---
  const handleThisWeek = () => {
    const range = getWeekRange(getTodaySaudi());
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const handleThisMonth = () => {
    const today = parseISO(getTodaySaudi());
    const range = getMonthRange(today.getFullYear(), today.getMonth() + 1);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const handleLastMonth = () => {
    const today = parseISO(getTodaySaudi());
    const lastMonth = subMonths(today, 1);
    const range = getMonthRange(lastMonth.getFullYear(), lastMonth.getMonth() + 1);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  // --- Employee filter helpers ---
  const toggleEmployee = (id: number) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]
    );
  };

  const selectAllEmployees = () => {
    setSelectedEmployeeIds([]);
  };

  const clearEmployeeSelection = () => {
    setSelectedEmployeeIds([]);
  };

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const term = employeeSearch.trim().toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(term) ||
        emp.emp_no.toLowerCase().includes(term)
    );
  }, [employees, employeeSearch]);

  const handleApply = () => {
    onApply({
      startDate,
      endDate,
      employeeIds: selectedEmployeeIds,
    });
  };

  const selectedLabel =
    selectedEmployeeIds.length === 0
      ? 'جميع الموظفين'
      : `${toArabicNumerals(selectedEmployeeIds.length)} موظف محدد`;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between p-4 text-right"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          <span className="font-semibold text-base">فلاتر التقرير</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="filter-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <Separator />
            <CardContent className="space-y-6 pt-4">
              {/* Quick presets */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  فترات سريعة
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleThisWeek}
                  >
                    <CalendarRange className="ml-1.5 h-4 w-4" />
                    هذا الأسبوع
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleThisMonth}
                  >
                    <CalendarRange className="ml-1.5 h-4 w-4" />
                    هذا الشهر
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleLastMonth}
                  >
                    <CalendarRange className="ml-1.5 h-4 w-4" />
                    الشهر الماضي
                  </Button>
                </div>
              </div>

              {/* Custom date range */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">من</Label>
                  <DatePickerAr
                    value={startDate}
                    onDateChange={setStartDate}
                    placeholder="تاريخ البداية"
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">إلى</Label>
                  <DatePickerAr
                    value={endDate}
                    onDateChange={setEndDate}
                    placeholder="تاريخ النهاية"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Employee filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">الموظفون</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between text-right"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLabel}</span>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-80 p-0"
                    align="start"
                  >
                    {/* Search */}
                    <div className="flex items-center gap-2 border-b px-3 py-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="بحث عن موظف..."
                        value={employeeSearch}
                        onChange={(e) => setEmployeeSearch(e.target.value)}
                        className="border-0 p-0 h-8 shadow-none focus-visible:ring-0"
                      />
                      {employeeSearch && (
                        <button
                          type="button"
                          onClick={() => setEmployeeSearch('')}
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>

                    {/* Select all / clear */}
                    <div className="flex items-center justify-between border-b px-3 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={selectAllEmployees}
                        className="h-7 text-xs"
                      >
                        الكل
                      </Button>
                      {selectedEmployeeIds.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearEmployeeSelection}
                          className="h-7 text-xs text-destructive"
                        >
                          مسح التحديد
                        </Button>
                      )}
                    </div>

                    {/* Employee list */}
                    <ScrollArea className="max-h-60">
                      <div className="p-2 space-y-1">
                        {filteredEmployees.map((emp) => (
                          <label
                            key={emp.id}
                            className="flex items-center gap-3 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted transition-colors"
                          >
                            <Checkbox
                              checked={selectedEmployeeIds.includes(emp.id)}
                              onCheckedChange={() => toggleEmployee(emp.id)}
                            />
                            <div className="flex flex-col">
                              <span className="text-sm">{emp.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {emp.emp_no}
                              </span>
                            </div>
                          </label>
                        ))}
                        {filteredEmployees.length === 0 && (
                          <p className="text-center text-sm text-muted-foreground py-4">
                            لا توجد نتائج
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                {/* Selected chips */}
                {selectedEmployeeIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedEmployeeIds.slice(0, 5).map((id) => {
                      const emp = employees.find((e) => e.id === id);
                      if (!emp) return null;
                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="gap-1 text-xs"
                        >
                          {emp.name}
                          <button
                            type="button"
                            onClick={() => toggleEmployee(id)}
                            className="mr-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                    {selectedEmployeeIds.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{toArabicNumerals(selectedEmployeeIds.length - 5)} آخرين
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Apply button */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleApply}
                  disabled={loading || !startDate || !endDate}
                  className="min-w-[120px]"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      جاري التحميل...
                    </span>
                  ) : (
                    <>
                      <Search className="ml-2 h-4 w-4" />
                      عرض التقرير
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
