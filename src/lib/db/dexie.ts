import Dexie, { type Table } from 'dexie';

// ─── Offline cache types ────────────────────────────────────────────────────

export interface LocalEmployee {
  id: number;
  emp_no: string;
  name: string;
  active: boolean;
}

export interface LocalAttendance {
  localId: string;          // client-generated UUID
  remoteId?: number;        // server id (null if not synced yet)
  emp_id: number;
  date: string;             // "YYYY-MM-DD"
  in_time: string | null;
  out_time: string | null;
  note: string | null;
  note_type: string | null;
  syncStatus: 'pending' | 'synced' | 'conflict';
  updatedAt: number;        // Date.now() timestamp
}

export interface LocalPermission {
  localId: string;
  remoteId?: number;
  emp_id: number;
  date: string;
  type: string;             // 'late_arrival' | 'early_leave' | 'during_day'
  minutes: number;
  reason: string | null;
  status: string;           // 'approved' | 'pending' | 'rejected'
  syncStatus: 'pending' | 'synced' | 'conflict';
  updatedAt: number;
}

export interface SyncQueueItem {
  id?: number;              // auto-incremented
  table: 'attendance' | 'permissions';
  operation: 'upsert' | 'delete';
  localId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  retryCount: number;
}

// ─── Dexie database definition ──────────────────────────────────────────────

class AttendanceDB extends Dexie {
  employees!: Table<LocalEmployee, number>;
  attendance!: Table<LocalAttendance, string>;
  permissions!: Table<LocalPermission, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('SchoolAttendanceDB');

    this.version(1).stores({
      employees: 'id, emp_no, active',
      attendance: 'localId, remoteId, [emp_id+date], date, syncStatus',
      permissions: 'localId, remoteId, [emp_id+date], date, syncStatus',
      syncQueue: '++id, table, localId, createdAt',
    });
  }
}

export const db = new AttendanceDB();

// ─── Helper functions ───────────────────────────────────────────────────────

/** Cache the employee list from Supabase into IndexedDB */
export async function cacheEmployees(employees: LocalEmployee[]) {
  await db.employees.clear();
  await db.employees.bulkPut(employees);
}

/** Get cached employees from IndexedDB */
export async function getCachedEmployees(): Promise<LocalEmployee[]> {
  return db.employees.where('active').equals(1).toArray();
}

/** Cache attendance records for a specific date */
export async function cacheAttendanceForDate(date: string, records: LocalAttendance[]) {
  // Remove existing cached records for this date that are already synced
  await db.attendance
    .where('date')
    .equals(date)
    .and(item => item.syncStatus === 'synced')
    .delete();

  // Put new records (won't overwrite pending ones due to different localId)
  await db.attendance.bulkPut(records);
}

/** Get attendance records for a specific date from IndexedDB */
export async function getCachedAttendance(date: string): Promise<LocalAttendance[]> {
  return db.attendance.where('date').equals(date).toArray();
}

/** Get pending sync count */
export async function getPendingSyncCount(): Promise<number> {
  return db.syncQueue.count();
}

/** Add item to sync queue */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>) {
  await db.syncQueue.add(item);
}

/** Get all pending sync items */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return db.syncQueue.orderBy('createdAt').toArray();
}

/** Remove item from sync queue */
export async function removeSyncQueueItem(id: number) {
  await db.syncQueue.delete(id);
}

/** Clear all offline data */
export async function clearAllOfflineData() {
  await Promise.all([
    db.employees.clear(),
    db.attendance.clear(),
    db.permissions.clear(),
    db.syncQueue.clear(),
  ]);
}
