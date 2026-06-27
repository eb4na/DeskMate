/**
 * Cloud sync for the shareable profile card. Each signed-in user upserts their
 * card to the public `profiles` table (keyed by friend code); friends fetch it
 * by code so avatars/cards reflect the character the person actually chose.
 */
import { supabase } from '@/lib/supabase';

export type SyncedProfile = {
  friendCode: string;
  displayName: string;
  description: string;
  birthday: string;
  companionId: string;
  skinId: string;
  backgroundId: string;
  avatarFrame: string;
  cardColor: string;
  currentStreak: number;
  longestStreak: number;
  totalMinutes: number;
  // Highest companion ("chef") bond level across all the player's companions. Synced
  // so the founder can see the top level reached across the user base (SQL query).
  topChefLevel?: number;
};

export async function uploadProfile(userId: string, p: SyncedProfile): Promise<boolean> {
  // Don't log PII (friend code / display name) — these can land in crash/log tools.
  console.log('[profile-sync] uploading', { companionId: p.companionId });
  const { error } = await supabase.from('profiles').upsert(
    {
      user_id: userId,
      friend_code: p.friendCode,
      display_name: p.displayName,
      description: p.description,
      birthday: p.birthday,
      companion_id: p.companionId,
      skin_id: p.skinId,
      background_id: p.backgroundId,
      avatar_frame: p.avatarFrame,
      card_color: p.cardColor,
      current_streak: p.currentStreak,
      longest_streak: p.longestStreak,
      total_minutes: p.totalMinutes,
      top_chef_level: p.topChefLevel ?? 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) console.warn('[profile-sync] UPLOAD FAILED:', error.message, error.details, error.hint);
  else console.log('[profile-sync] upload OK', { companionId: p.companionId });
  return !error;
}

// A profile's user id, looked up by friend code. Goes through get_profile_by_code so
// it doesn't depend on the (now removed) blanket profiles read.
export async function lookupUserIdByCode(code: string): Promise<string | null> {
  const row = await fetchProfileRow(code);
  return row?.user_id ?? null;
}

// Raw row from the get_profile_by_code RPC (SECURITY DEFINER, exact friend-code match).
// Deliberately has NO `birthday`/DOB field — that never leaves the server.
type ProfileRow = {
  user_id: string;
  friend_code: string;
  display_name: string | null;
  description: string | null;
  // Year-masked (month/day only) by the RPC — never the real DOB year.
  birthday: string | null;
  companion_id: string | null;
  skin_id: string | null;
  background_id: string | null;
  avatar_frame: string | null;
  card_color: string | null;
  current_streak: number | null;
  longest_streak: number | null;
  total_minutes: number | null;
  top_chef_level: number | null;
};

async function fetchProfileRow(code: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.rpc('get_profile_by_code', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) {
    console.warn('[profile-sync] get_profile_by_code error:', error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ProfileRow) ?? null;
}

export async function fetchProfileByCode(code: string): Promise<SyncedProfile | null> {
  const data = await fetchProfileRow(code);
  if (!data) { console.log('[profile-sync] no profile found for that code'); return null; }
  return {
    friendCode: data.friend_code,
    displayName: data.display_name ?? '',
    description: data.description ?? '',
    // Year-masked month/day from the RPC (the real DOB year never leaves the server).
    birthday: data.birthday ?? '',
    companionId: data.companion_id ?? '',
    skinId: data.skin_id ?? 'classic',
    backgroundId: data.background_id ?? 'cozy',
    avatarFrame: data.avatar_frame ?? 'none',
    cardColor: data.card_color ?? 'pink',
    currentStreak: data.current_streak ?? 0,
    longestStreak: data.longest_streak ?? 0,
    totalMinutes: data.total_minutes ?? 0,
    topChefLevel: data.top_chef_level ?? 1,
  };
}
