// Suggested players — a random sample of other players in your age band you can send
// a friend request to (replaces the old Study Buddy matcher). Backed by the
// `suggested_players` SECURITY DEFINER RPC, which does the age-band match + excludes
// existing friends / pending requests / blocked accounts server-side.
import { supabase } from '@/lib/supabase';
import type { SyncedProfile } from '@/lib/profile-sync';

export type SuggestedPlayer = Pick<
  SyncedProfile,
  | 'friendCode'
  | 'displayName'
  | 'companionId'
  | 'skinId'
  | 'backgroundId'
  | 'avatarFrame'
  | 'cardColor'
  | 'currentStreak'
  | 'longestStreak'
  | 'totalMinutes'
>;

type Row = {
  friend_code: string;
  display_name: string;
  companion_id: string;
  skin_id: string;
  background_id: string;
  avatar_frame: string;
  card_color: string;
  current_streak: number;
  longest_streak: number;
  total_minutes: number;
};

// Fetch up to `limit` suggested players. Returns [] on any error (e.g. the RPC isn't
// deployed yet) so the UI can just show an empty state — never a failure popup.
export async function fetchSuggestedPlayers(limit = 8): Promise<SuggestedPlayer[]> {
  const { data, error } = await supabase.rpc('suggested_players', { p_limit: limit });
  if (error || !Array.isArray(data)) {
    if (error) console.warn('[suggestions] suggested_players error:', error.message);
    return [];
  }
  return (data as Row[]).map((r) => ({
    friendCode: r.friend_code,
    displayName: r.display_name,
    companionId: r.companion_id,
    skinId: r.skin_id,
    backgroundId: r.background_id,
    avatarFrame: r.avatar_frame,
    cardColor: r.card_color,
    currentStreak: r.current_streak,
    longestStreak: r.longest_streak,
    totalMinutes: r.total_minutes,
  }));
}
