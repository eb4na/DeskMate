// Cloud sync for a signed-in user's game state. Each account's full local
// PersistedState is mirrored to a single `public.user_state` row (jsonb), so
// progress follows the account to any device. Guests are never synced.
//
// Strategy: last-write-wins by an `updatedAt` epoch stamped into the blob. On
// login we take whichever of local / cloud is newer; on every save we push a
// debounced copy up. Run the migration in `supabase/migrations/` once.

import { supabase } from '@/lib/supabase';

const TABLE = 'user_state';

export type CloudState = { data: Record<string, unknown>; updatedAt: number };

// ── Single active session ─────────────────────────────────────────────────────
// Once this device has been kicked (its account signed in elsewhere), it must
// never push its now-stale state, or it would clobber the surviving device.
let kicked = false;
export function markKicked() {
  kicked = true;
}
export function resetKicked() {
  kicked = false;
}

/** Claim this device as the account's single active session. */
export async function claimActiveDevice(userId: string, deviceId: string): Promise<string | null> {
  try {
    const { error } = await supabase
      .from(TABLE)
      // `data` is omitted: it defaults to '{}' on insert and is left untouched on
      // conflict, so claiming never overwrites an existing game-state blob.
      .upsert({ user_id: userId, active_device_id: deviceId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    return error?.message ?? null;
  } catch (e) {
    return e instanceof Error ? e.message : 'claim failed';
  }
}

/** Read the account's currently-active device id (null if none / on error). */
export async function fetchActiveDevice(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('active_device_id')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return (data as { active_device_id: string | null }).active_device_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Watch for another device claiming this account. Calls `onKicked` when the
 * row's active_device_id changes to something other than this device. Returns
 * an unsubscribe function.
 */
export function subscribeActiveDevice(userId: string, deviceId: string, onKicked: () => void): () => void {
  const channel = supabase
    .channel(`active-device:${userId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` },
      (payload) => {
        const next = (payload.new as { active_device_id?: string | null } | null)?.active_device_id;
        if (next && next !== deviceId) onKicked();
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

function blobUpdatedAt(blob: Record<string, unknown> | null | undefined): number {
  return blob && typeof blob.updatedAt === 'number' ? blob.updatedAt : 0;
}

/** Read the signed-in user's saved state from Supabase (null if none / on error). */
export async function fetchCloudState(userId: string): Promise<CloudState | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    const blob = (data as { data: Record<string, unknown> | null }).data;
    if (!blob) return null;
    return { data: blob, updatedAt: blobUpdatedAt(blob) };
  } catch {
    return null;
  }
}

// Like fetchCloudState but distinguishes a CONFIRMED-empty account
// ({ ok: true, cloud: null }) from a failed/transient fetch ({ ok: false }).
// The guest→account migration relies on this: it must never treat "couldn't
// reach the cloud" as "brand-new account" and seed guest data over real data.
export type CloudProbe = { ok: true; cloud: CloudState | null } | { ok: false };

export async function probeCloudState(userId: string): Promise<CloudProbe> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return { ok: false };
    const blob = data ? (data as { data: Record<string, unknown> | null }).data : null;
    return { ok: true, cloud: blob ? { data: blob, updatedAt: blobUpdatedAt(blob) } : null };
  } catch {
    return { ok: false };
  }
}

/** Upsert the user's state row. Returns an error message or null. */
export async function pushCloudState(userId: string, data: Record<string, unknown>): Promise<string | null> {
  if (kicked) return null; // kicked device must not clobber the surviving one
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    return error?.message ?? null;
  } catch (e) {
    return e instanceof Error ? e.message : 'cloud push failed';
  }
}

// ── Debounced push, so rapid in-game changes coalesce into one upload ──────────
const timers = new Map<string, ReturnType<typeof setTimeout>>();
// The most recent payload waiting to be pushed, kept so a flush (e.g. on
// backgrounding) can send it immediately instead of losing it when the timer
// is dropped by an OS suspend/kill.
const pending = new Map<string, Record<string, unknown>>();

export function pushCloudStateDebounced(userId: string, data: Record<string, unknown>, delayMs = 1500) {
  if (kicked) return; // kicked device must not clobber the surviving one
  pending.set(userId, data);
  const existing = timers.get(userId);
  if (existing) clearTimeout(existing);
  timers.set(
    userId,
    setTimeout(() => {
      timers.delete(userId);
      const d = pending.get(userId);
      pending.delete(userId);
      if (d) void pushCloudState(userId, d);
    }, delayMs),
  );
}

/**
 * Push any pending debounced state for this user right now, cancelling the
 * timer. Call this the moment the app leaves the foreground: saving a timer
 * preset (or any last action before closing the app) writes to local storage
 * immediately but only schedules the cloud push, so without a flush the 1.5s
 * timer can be dropped when iOS suspends the process — the change reaches the
 * device but never the cloud, and a later login elsewhere restores the stale
 * copy. No-op when there's nothing pending or the device has been kicked.
 */
export function flushCloudState(userId: string): Promise<string | null> {
  const existing = timers.get(userId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(userId);
  }
  const d = pending.get(userId);
  pending.delete(userId);
  if (!d || kicked) return Promise.resolve(null);
  return pushCloudState(userId, d);
}
