// Free ("comp") Plus gifted by the founder, independent of RevenueCat.
//
// A row in `public.plus_comps` (see supabase/migrations/20261117_plus_comps.sql)
// means "this account has Plus regardless of the store". The launch reconcile in
// _layout.tsx grants Plus from it and never revokes a comped account — without
// that, a hand-gifted Plus is switched off on the next launch because RevenueCat
// reports no entitlement.

import { supabase } from '@/lib/supabase';

// What a lifetime comp (until = null) is stored as locally. FIXED, not rolling:
// a rolling "now + 1 year" would differ on every launch and re-run setIsPlus each
// time (it grants tickets/freezes), where a constant settles after the first launch.
export const COMP_LIFETIME_UNTIL = '2126-01-01T00:00:00.000Z';

/**
 * The account's active comp, as the ISO `plusUntil` to store.
 * - `{ until }` — comped and still active
 * - `null`      — no comp (or it has expired)
 * - `undefined` — couldn't tell (offline / error). Callers must treat this as
 *                 "maybe comped" and never revoke Plus on it.
 */
export async function fetchPlusComp(userId: string): Promise<{ until: string } | null | undefined> {
  try {
    const { data, error } = await supabase
      .from('plus_comps')
      .select('until')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return undefined;
    if (!data) return null;
    const until = (data as { until: string | null }).until;
    if (until == null) return { until: COMP_LIFETIME_UNTIL };
    const iso = new Date(until).toISOString();
    return new Date(iso) > new Date() ? { until: iso } : null;
  } catch {
    return undefined;
  }
}
