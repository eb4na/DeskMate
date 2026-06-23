/**
 * Study Buddy Matching — client wrapper around the server-side buddy RPCs.
 *
 * Safety lives on the server (see migration 20260622b_study_buddies.sql): the
 * waiting pool is never readable here, age-band matching + blocking + report
 * exclusion all run inside SECURITY DEFINER functions, and the partner's friend
 * code is only ever returned once BOTH sides choose to become friends. This file
 * just calls those functions — it must never try to read buddy_queue directly.
 */
import { supabase } from '@/lib/supabase';

// Canned cheers — the ONLY messages a buddy can send. No free text. The `kind` is
// stored server-side; the label is localized in the UI via i18n key `studyBuddy.cheer.<kind>`.
export const CHEER_KINDS = ['keep_going', 'you_got_this', 'dont_break_streak', 'proud_of_you'] as const;
export type CheerKind = (typeof CHEER_KINDS)[number];

export type MatchResult =
  | { status: 'matched'; pairId: string; endsAt: string }
  | { status: 'waiting' }
  | { status: 'error'; error: string; raw?: string };

export type BuddyStatus = {
  endsAt: string;
  pairStatus: 'active' | 'ended';
  endedReason: string | null; // 'ghost' | 'left' | 'reported' | 'expired' when ended
  partnerName: string;
  partnerCompanion: string;
  partnerSkin: string;
  partnerBackground: string;
  partnerStreak: number;
  partnerStudiedToday: boolean;
  iWantFriend: boolean;
  partnerWantsFriend: boolean;
};

/** Mirror the streak's lastStudyDate (account-timezone ISO) + the account timezone to
 * the server so a buddy's check-in can ask "did they study on THEIR today". Called
 * whenever lastStudyDate changes. */
export async function uploadStudyDay(userId: string, lastStudyDate: string, tz: string): Promise<void> {
  if (!lastStudyDate) return;
  const { error } = await supabase.from('study_days').upsert(
    { user_id: userId, last_study_date: lastStudyDate, tz: tz || 'UTC', updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  if (error) console.warn('[study-buddy] uploadStudyDay failed:', error.message);
}

/** Opt in / find a buddy. Pairs with a waiting same-age-band stranger, or enqueues. */
export async function findBuddy(): Promise<MatchResult> {
  const { data, error } = await supabase.rpc('match_study_buddy');
  if (error) {
    const msg = error.message || 'unknown error';
    console.warn('[study-buddy] match_study_buddy error:', msg);
    if (msg.includes('birthday')) return { status: 'error', error: 'birthday', raw: msg };
    if (msg.includes('restricted')) return { status: 'error', error: 'restricted', raw: msg };
    return { status: 'error', error: 'generic', raw: msg };
  }
  console.log('[study-buddy] match_study_buddy data:', JSON.stringify(data));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { status: 'waiting' };
  if (row.status === 'matched') return { status: 'matched', pairId: row.pair_id, endsAt: row.ends_at };
  return { status: 'waiting' };
}

/** Cancel waiting in the queue (only valid while unmatched). */
export async function cancelMatching(userId: string): Promise<void> {
  await supabase.from('buddy_queue').delete().eq('user_id', userId);
}

/** The current active pair for this user, if any (read straight from buddy_pairs RLS). */
export async function getActivePair(userId: string): Promise<{ pairId: string; endsAt: string } | null> {
  const { data, error } = await supabase
    .from('buddy_pairs')
    .select('id, ends_at')
    .eq('status', 'active')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return { pairId: data.id, endsAt: data.ends_at };
}

/** Safe, display-level facts about the partner + whether they studied today. */
export async function getBuddyStatus(pairId: string): Promise<BuddyStatus | null> {
  const { data, error } = await supabase.rpc('buddy_status', { p_pair: pairId });
  if (error) {
    console.warn('[study-buddy] buddy_status failed:', error.message);
    return null;
  }
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return null;
  return {
    endsAt: r.ends_at,
    pairStatus: r.pair_status,
    endedReason: r.ended_reason ?? null,
    partnerName: r.partner_name ?? '',
    partnerCompanion: r.partner_companion ?? '',
    partnerSkin: r.partner_skin ?? 'classic',
    partnerBackground: r.partner_background ?? 'cozy',
    partnerStreak: r.partner_streak ?? 0,
    partnerStudiedToday: !!r.partner_studied_today,
    iWantFriend: !!r.i_want_friend,
    partnerWantsFriend: !!r.partner_wants_friend,
  };
}

/** Send a canned cheer. Returns false if rate-limited (already cheered today). */
export async function sendCheer(pairId: string, kind: CheerKind): Promise<boolean> {
  const { data, error } = await supabase.rpc('send_cheer', { p_pair: pairId, p_kind: kind });
  if (error) {
    console.warn('[study-buddy] send_cheer failed:', error.message);
    return false;
  }
  return data === true;
}

/** Cheers received in this pair (newest first). */
export async function fetchCheers(pairId: string): Promise<{ id: string; fromUser: string; kind: CheerKind; createdAt: string }[]> {
  const { data, error } = await supabase
    .from('buddy_nudges')
    .select('id, from_user, kind, created_at')
    .eq('pair_id', pairId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return data.map((r: { id: string; from_user: string; kind: string; created_at: string }) => ({
    id: r.id,
    fromUser: r.from_user,
    kind: r.kind as CheerKind,
    createdAt: r.created_at,
  }));
}

/** Leave the pairing early (no block, no report). */
export async function leaveBuddy(pairId: string): Promise<boolean> {
  const { error } = await supabase.rpc('leave_buddy', { p_pair: pairId });
  if (error) console.warn('[study-buddy] leave_buddy failed:', error.message);
  return !error;
}

/** Report the partner: files a moderation report, blocks them, ends the pairing. */
export async function reportBuddy(pairId: string, reason: string, details?: string): Promise<boolean> {
  const { error } = await supabase.rpc('report_buddy', { p_pair: pairId, p_reason: reason, p_details: details ?? '' });
  if (error) console.warn('[study-buddy] report_buddy failed:', error.message);
  return !error;
}

/** Tap "become friends". Returns { both: true, partnerCode } only once BOTH have tapped. */
export async function becomeFriends(pairId: string): Promise<{ both: boolean; partnerCode: string | null }> {
  const { data, error } = await supabase.rpc('buddy_become_friends', { p_pair: pairId });
  if (error) {
    console.warn('[study-buddy] buddy_become_friends failed:', error.message);
    return { both: false, partnerCode: null };
  }
  const r = Array.isArray(data) ? data[0] : data;
  if (!r) return { both: false, partnerCode: null };
  return { both: r.now_friends === true, partnerCode: r.partner_code ?? null };
}
