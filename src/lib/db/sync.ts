import { createClient } from '@/lib/supabase/client';
import {
  db,
  getPendingSyncItems,
  removeSyncQueueItem,
  type SyncQueueItem,
} from './dexie';

export interface SyncResult {
  success: number;
  failed: number;
  conflicts: number;
  errors: string[];
}

/**
 * Process the offline sync queue.
 * Sends all pending operations to Supabase in FIFO order.
 * Uses last-write-wins conflict resolution via client_updated_at.
 */
export async function processSyncQueue(): Promise<SyncResult> {
  const result: SyncResult = { success: 0, failed: 0, conflicts: 0, errors: [] };

  if (!navigator.onLine) {
    return result;
  }

  const items = await getPendingSyncItems();
  if (items.length === 0) return result;

  const supabase = createClient();

  for (const item of items) {
    try {
      if (item.table === 'attendance') {
        await syncAttendanceItem(supabase, item, result);
      } else if (item.table === 'permissions') {
        await syncPermissionItem(supabase, item, result);
      }
    } catch (err) {
      result.failed++;
      result.errors.push(`خطأ في مزامنة ${item.table}: ${String(err)}`);

      // Increment retry count
      if (item.id) {
        const updated = item.retryCount + 1;
        if (updated >= 5) {
          // Too many retries, mark as conflict and remove from queue
          await removeSyncQueueItem(item.id);
          result.conflicts++;
        } else {
          await db.syncQueue.update(item.id, { retryCount: updated });
        }
      }
    }
  }

  return result;
}

async function syncAttendanceItem(
  supabase: ReturnType<typeof createClient>,
  item: SyncQueueItem,
  result: SyncResult
) {
  const payload = item.payload as {
    emp_id: number;
    date: string;
    in_time: string | null;
    out_time: string | null;
    note: string | null;
    note_type: string | null;
    client_updated_at: string;
    updated_by: string | null;
  };

  if (item.operation === 'upsert') {
    // Check for conflicts: does the server have a newer version?
    const { data: existing } = await supabase
      .from('attendance')
      .select('id, updated_at, client_updated_at')
      .eq('date', payload.date)
      .eq('emp_id', payload.emp_id)
      .single();

    if (existing) {
      const serverTime = new Date(existing.client_updated_at || existing.updated_at).getTime();
      const clientTime = new Date(payload.client_updated_at).getTime();

      if (serverTime > clientTime) {
        // Server is newer — skip this update (last-write-wins, server wins)
        result.conflicts++;
        if (item.id) await removeSyncQueueItem(item.id);

        // Update local record to synced with server data
        const localRecord = await db.attendance
          .where('[emp_id+date]')
          .equals([payload.emp_id, payload.date])
          .first();
        if (localRecord) {
          await db.attendance.update(localRecord.localId, { syncStatus: 'synced' });
        }
        return;
      }

      // Client is newer or equal — update
      const { error } = await supabase
        .from('attendance')
        .update({
          in_time: payload.in_time,
          out_time: payload.out_time,
          note: payload.note,
          note_type: payload.note_type,
          client_updated_at: payload.client_updated_at,
          updated_by: payload.updated_by,
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // No existing record — insert
      const { error } = await supabase.from('attendance').insert({
        date: payload.date,
        emp_id: payload.emp_id,
        in_time: payload.in_time,
        out_time: payload.out_time,
        note: payload.note,
        note_type: payload.note_type,
        client_updated_at: payload.client_updated_at,
        created_by: payload.updated_by,
        updated_by: payload.updated_by,
      });

      if (error) {
        // If unique constraint violation, try update instead
        if (error.code === '23505') {
          const { error: updateError } = await supabase
            .from('attendance')
            .update({
              in_time: payload.in_time,
              out_time: payload.out_time,
              note: payload.note,
              note_type: payload.note_type,
              client_updated_at: payload.client_updated_at,
              updated_by: payload.updated_by,
            })
            .eq('date', payload.date)
            .eq('emp_id', payload.emp_id);

          if (updateError) throw updateError;
        } else {
          throw error;
        }
      }
    }

    // Mark local record as synced
    const localRecord = await db.attendance
      .where('[emp_id+date]')
      .equals([payload.emp_id, payload.date])
      .first();
    if (localRecord) {
      await db.attendance.update(localRecord.localId, { syncStatus: 'synced' });
    }
  }

  // Remove from queue on success
  if (item.id) await removeSyncQueueItem(item.id);
  result.success++;
}

async function syncPermissionItem(
  supabase: ReturnType<typeof createClient>,
  item: SyncQueueItem,
  result: SyncResult
) {
  const payload = item.payload as {
    emp_id: number;
    date: string;
    type: string;
    minutes: number;
    reason: string | null;
    status: string;
    client_updated_at: string;
    updated_by: string | null;
    remoteId?: number;
  };

  if (item.operation === 'upsert') {
    if (payload.remoteId) {
      // Update existing permission
      const { error } = await supabase
        .from('permissions')
        .update({
          type: payload.type,
          minutes: payload.minutes,
          reason: payload.reason,
          status: payload.status,
          client_updated_at: payload.client_updated_at,
          updated_by: payload.updated_by,
        })
        .eq('id', payload.remoteId);

      if (error) throw error;
    } else {
      // Insert new permission
      const { error } = await supabase.from('permissions').insert({
        date: payload.date,
        emp_id: payload.emp_id,
        type: payload.type,
        minutes: payload.minutes,
        reason: payload.reason,
        status: payload.status,
        client_updated_at: payload.client_updated_at,
        created_by: payload.updated_by,
        updated_by: payload.updated_by,
      });

      if (error) throw error;
    }

    // Mark local record as synced
    const localRecord = await db.permissions
      .where('localId')
      .equals(item.localId)
      .first();
    if (localRecord) {
      await db.permissions.update(localRecord.localId, { syncStatus: 'synced' });
    }
  }

  if (item.id) await removeSyncQueueItem(item.id);
  result.success++;
}

/**
 * Listen for online status and trigger sync automatically
 */
export function setupAutoSync(onSyncComplete?: (result: SyncResult) => void) {
  const handler = async () => {
    if (navigator.onLine) {
      const result = await processSyncQueue();
      onSyncComplete?.(result);
    }
  };

  window.addEventListener('online', handler);

  // Also try to sync periodically when online (every 30 seconds)
  const interval = setInterval(async () => {
    if (navigator.onLine) {
      const count = await db.syncQueue.count();
      if (count > 0) {
        const result = await processSyncQueue();
        onSyncComplete?.(result);
      }
    }
  }, 30000);

  return () => {
    window.removeEventListener('online', handler);
    clearInterval(interval);
  };
}
