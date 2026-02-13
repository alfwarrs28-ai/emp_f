'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useOnlineStatus } from './use-online-status';
import {
  db,
  cacheAttendanceForDate,
  getCachedAttendance,
  addToSyncQueue,
  type LocalAttendance,
} from '@/lib/db/dexie';
import type { Attendance, Employee } from '@/types/database';
import { isValidTime } from '@/lib/utils/time';
import { v4 as uuidv4 } from 'uuid';

interface AttendanceRow {
  localId: string;
  remoteId?: number;
  emp_id: number;
  employee?: Employee;
  date: string;
  in_time: string | null;
  out_time: string | null;
  note: string | null;
  note_type: string | null;
  syncStatus: 'pending' | 'synced' | 'conflict';
}

interface UseAttendanceReturn {
  rows: AttendanceRow[];
  loading: boolean;
  error: string | null;
  updateRow: (empId: number, field: string, value: string | null) => Promise<void>;
  updateMultipleFields: (empId: number, fields: Record<string, string | null>) => Promise<void>;
  prepareDay: (employees: Employee[]) => Promise<void>;
  refetch: () => Promise<void>;
}

// Module-level supabase client (singleton via client.ts)
const supabase = createClient();

export function useAttendance(date: string, employees: Employee[]): UseAttendanceReturn {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  // Use refs for values needed in callbacks to avoid dependency churn
  const rowsRef = useRef<AttendanceRow[]>(rows);
  rowsRef.current = rows;

  const dateRef = useRef(date);
  dateRef.current = date;

  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
  }, []);

  // Stable reference to employees via ref
  const employeesRef = useRef(employees);
  employeesRef.current = employees;

  const fetchOnline = useCallback(async () => {
    const currentDate = dateRef.current;
    const currentEmployees = employeesRef.current;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('attendance')
        .select('id, emp_id, date, in_time, out_time, note, note_type')
        .eq('date', currentDate)
        .order('emp_id');

      if (fetchError) throw fetchError;

      const attendanceMap = new Map<number, Attendance>();
      (data || []).forEach((record: Attendance) => {
        attendanceMap.set(record.emp_id, record);
      });

      const newRows: AttendanceRow[] = currentEmployees.map((emp) => {
        const record = attendanceMap.get(emp.id);
        return {
          localId: record ? `server-${record.id}` : uuidv4(),
          remoteId: record?.id,
          emp_id: emp.id,
          employee: emp,
          date: currentDate,
          in_time: record?.in_time ?? null,
          out_time: record?.out_time ?? null,
          note: record?.note ?? null,
          note_type: record?.note_type ?? null,
          syncStatus: 'synced' as const,
        };
      });

      setRows(newRows);

      // Cache in IndexedDB for offline use
      const cacheRecords: LocalAttendance[] = newRows.map((row) => ({
        localId: row.localId,
        remoteId: row.remoteId,
        emp_id: row.emp_id,
        date: row.date,
        in_time: row.in_time,
        out_time: row.out_time,
        note: row.note,
        note_type: row.note_type,
        syncStatus: 'synced',
        updatedAt: Date.now(),
      }));

      await cacheAttendanceForDate(currentDate, cacheRecords);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, []); // No deps — uses refs

  const fetchOffline = useCallback(async () => {
    const currentDate = dateRef.current;
    const currentEmployees = employeesRef.current;

    try {
      setLoading(true);
      setError(null);

      const cached = await getCachedAttendance(currentDate);
      const cachedMap = new Map<number, LocalAttendance>();
      cached.forEach((record) => {
        cachedMap.set(record.emp_id, record);
      });

      const newRows: AttendanceRow[] = currentEmployees.map((emp) => {
        const record = cachedMap.get(emp.id);
        return {
          localId: record?.localId ?? uuidv4(),
          remoteId: record?.remoteId,
          emp_id: emp.id,
          employee: emp,
          date: currentDate,
          in_time: record?.in_time ?? null,
          out_time: record?.out_time ?? null,
          note: record?.note ?? null,
          note_type: record?.note_type ?? null,
          syncStatus: record?.syncStatus ?? 'pending',
        };
      });

      setRows(newRows);
    } catch {
      setError('تعذر تحميل البيانات من الذاكرة المحلية');
    } finally {
      setLoading(false);
    }
  }, []); // No deps — uses refs

  const refetch = useCallback(async () => {
    if (navigator.onLine) {
      await fetchOnline();
    } else {
      await fetchOffline();
    }
  }, [fetchOnline, fetchOffline]);

  // Fetch when date or employees change
  useEffect(() => {
    if (employees.length > 0) {
      refetch();
    } else {
      // No employees yet — don't stay stuck on loading
      setRows([]);
      setLoading(false);
    }
  }, [date, employees.length, refetch]);

  const updateRow = useCallback(
    async (empId: number, field: string, value: string | null) => {
      const now = Date.now();
      const userId = userIdRef.current;
      const currentDate = dateRef.current;

      // Re-validate time values before saving
      if ((field === 'in_time' || field === 'out_time') && value !== null) {
        if (!isValidTime(value)) {
          console.warn(`Invalid time value rejected: ${field}=${value}`);
          return;
        }
      }

      // Truncate note if too long
      if (field === 'note' && value !== null && value.length > 500) {
        value = value.substring(0, 500);
      }

      // Read current row from ref (no dependency needed)
      const currentRow = rowsRef.current.find((r) => r.emp_id === empId);
      if (!currentRow) return;

      // Update local state immediately (optimistic) — single setRows call
      setRows((prev) =>
        prev.map((row) => {
          if (row.emp_id !== empId) return row;
          return {
            ...row,
            [field]: value,
            syncStatus: 'pending' as const,
          };
        })
      );

      const updatedRecord: LocalAttendance = {
        localId: currentRow.localId,
        remoteId: currentRow.remoteId,
        emp_id: empId,
        date: currentDate,
        in_time: field === 'in_time' ? value : currentRow.in_time,
        out_time: field === 'out_time' ? value : currentRow.out_time,
        note: field === 'note' ? value : currentRow.note,
        note_type: field === 'note_type' ? value : currentRow.note_type,
        syncStatus: 'pending',
        updatedAt: now,
      };

      // Save to IndexedDB
      await db.attendance.put(updatedRecord);

      // Add to sync queue
      await addToSyncQueue({
        table: 'attendance',
        operation: 'upsert',
        localId: currentRow.localId,
        payload: {
          emp_id: empId,
          date: currentDate,
          in_time: updatedRecord.in_time,
          out_time: updatedRecord.out_time,
          note: updatedRecord.note,
          note_type: updatedRecord.note_type,
          client_updated_at: new Date(now).toISOString(),
          updated_by: userId,
        },
        createdAt: now,
        retryCount: 0,
      });

      // If online, try to save to Supabase directly
      if (navigator.onLine) {
        try {
          const payload = {
            date: currentDate,
            emp_id: empId,
            in_time: updatedRecord.in_time,
            out_time: updatedRecord.out_time,
            note: updatedRecord.note,
            note_type: updatedRecord.note_type,
            client_updated_at: new Date(now).toISOString(),
            updated_by: userId,
          };

          let newRemoteId = currentRow.remoteId;

          if (currentRow.remoteId) {
            await supabase
              .from('attendance')
              .update(payload)
              .eq('id', currentRow.remoteId);
          } else {
            const { data } = await supabase
              .from('attendance')
              .upsert(
                { ...payload, created_by: userId },
                { onConflict: 'date,emp_id' }
              )
              .select('id')
              .single();

            if (data) {
              newRemoteId = data.id;
            }
          }

          // Single setRows call to mark as synced + set remoteId
          setRows((prev) =>
            prev.map((row) =>
              row.emp_id === empId
                ? { ...row, remoteId: newRemoteId, syncStatus: 'synced' as const }
                : row
            )
          );

          // Remove from sync queue
          const queueItems = await db.syncQueue
            .where('localId')
            .equals(currentRow.localId)
            .toArray();
          for (const qi of queueItems) {
            if (qi.id) await db.syncQueue.delete(qi.id);
          }

          // Update IndexedDB status
          await db.attendance.update(currentRow.localId, {
            remoteId: newRemoteId,
            syncStatus: 'synced',
          });
        } catch {
          // Failed to sync, will be retried by sync engine
        }
      }
    },
    [] // No deps — uses refs for all mutable state
  );

  const updateMultipleFields = useCallback(
    async (empId: number, fields: Record<string, string | null>) => {
      const now = Date.now();
      const userId = userIdRef.current;
      const currentDate = dateRef.current;

      // Re-validate time values before saving
      if (fields.in_time !== undefined && fields.in_time !== null && !isValidTime(fields.in_time)) {
        console.warn('Invalid in_time value rejected:', fields.in_time);
        return;
      }
      if (fields.out_time !== undefined && fields.out_time !== null && !isValidTime(fields.out_time)) {
        console.warn('Invalid out_time value rejected:', fields.out_time);
        return;
      }

      // Truncate note if too long
      if (fields.note !== undefined && fields.note !== null && fields.note.length > 500) {
        fields = { ...fields, note: fields.note.substring(0, 500) };
      }

      // Read current row from ref
      const currentRow = rowsRef.current.find((r) => r.emp_id === empId);
      if (!currentRow) return;

      // Update local state immediately (optimistic)
      setRows((prev) =>
        prev.map((row) => {
          if (row.emp_id !== empId) return row;
          return { ...row, ...fields, syncStatus: 'pending' as const };
        })
      );

      const updatedRecord: LocalAttendance = {
        localId: currentRow.localId,
        remoteId: currentRow.remoteId,
        emp_id: empId,
        date: currentDate,
        in_time: 'in_time' in fields ? fields.in_time : currentRow.in_time,
        out_time: 'out_time' in fields ? fields.out_time : currentRow.out_time,
        note: 'note' in fields ? fields.note : currentRow.note,
        note_type: 'note_type' in fields ? fields.note_type : currentRow.note_type,
        syncStatus: 'pending',
        updatedAt: now,
      };

      // Save to IndexedDB
      await db.attendance.put(updatedRecord);

      // Add to sync queue
      await addToSyncQueue({
        table: 'attendance',
        operation: 'upsert',
        localId: currentRow.localId,
        payload: {
          emp_id: empId,
          date: currentDate,
          in_time: updatedRecord.in_time,
          out_time: updatedRecord.out_time,
          note: updatedRecord.note,
          note_type: updatedRecord.note_type,
          client_updated_at: new Date(now).toISOString(),
          updated_by: userId,
        },
        createdAt: now,
        retryCount: 0,
      });

      // If online, try to save to Supabase directly
      if (navigator.onLine) {
        try {
          const payload = {
            date: currentDate,
            emp_id: empId,
            in_time: updatedRecord.in_time,
            out_time: updatedRecord.out_time,
            note: updatedRecord.note,
            note_type: updatedRecord.note_type,
            client_updated_at: new Date(now).toISOString(),
            updated_by: userId,
          };

          let newRemoteId = currentRow.remoteId;

          if (currentRow.remoteId) {
            await supabase.from('attendance').update(payload).eq('id', currentRow.remoteId);
          } else {
            const { data } = await supabase
              .from('attendance')
              .upsert({ ...payload, created_by: userId }, { onConflict: 'date,emp_id' })
              .select('id')
              .single();

            if (data) {
              newRemoteId = data.id;
            }
          }

          // Single setRows to mark synced + update remoteId
          setRows((prev) =>
            prev.map((row) =>
              row.emp_id === empId
                ? { ...row, remoteId: newRemoteId, syncStatus: 'synced' as const }
                : row
            )
          );

          const queueItems = await db.syncQueue.where('localId').equals(currentRow.localId).toArray();
          for (const qi of queueItems) {
            if (qi.id) await db.syncQueue.delete(qi.id);
          }
          await db.attendance.update(currentRow.localId, {
            remoteId: newRemoteId,
            syncStatus: 'synced',
          });
        } catch {
          // Failed to sync, will be retried by sync engine
        }
      }
    },
    [] // No deps — uses refs
  );

  const prepareDay = useCallback(
    async (emps: Employee[]) => {
      const userId = userIdRef.current;
      const now = Date.now();
      const currentDate = dateRef.current;
      const currentRows = rowsRef.current;

      // Find employees without attendance records
      const existingEmpIds = new Set(
        currentRows.filter((r) => r.remoteId || r.in_time || r.out_time).map((r) => r.emp_id)
      );

      const newRecords = emps
        .filter((emp) => !existingEmpIds.has(emp.id))
        .map((emp) => ({
          date: currentDate,
          emp_id: emp.id,
          in_time: null,
          out_time: null,
          note: null,
          note_type: null,
          client_updated_at: new Date(now).toISOString(),
          created_by: userId,
          updated_by: userId,
        }));

      if (newRecords.length === 0) return;

      if (navigator.onLine) {
        try {
          await supabase.from('attendance').upsert(newRecords, {
            onConflict: 'date,emp_id',
          });
          await refetch();
        } catch {
          // Will try offline mode
        }
      }
    },
    [refetch] // Only depends on refetch, which is stable
  );

  return { rows, loading, error, updateRow, updateMultipleFields, prepareDay, refetch };
}
