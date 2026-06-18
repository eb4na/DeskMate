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
};

export async function uploadProfile(userId: string, p: SyncedProfile): Promise<boolean> {
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
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  return !error;
}

export async function lookupUserIdByCode(code: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('friend_code', code.trim().toUpperCase())
    .maybeSingle();
  if (error || !data) return null;
  return data.user_id as string;
}

export async function fetchProfileByCode(code: string): Promise<SyncedProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('friend_code', code.trim().toUpperCase())
    .maybeSingle();
  if (error || !data) return null;
  return {
    friendCode: data.friend_code,
    displayName: data.display_name ?? '',
    description: data.description ?? '',
    birthday: data.birthday ?? '',
    companionId: data.companion_id ?? '',
    skinId: data.skin_id ?? 'classic',
    backgroundId: data.background_id ?? 'cozy',
    avatarFrame: data.avatar_frame ?? 'none',
    cardColor: data.card_color ?? 'pink',
    currentStreak: data.current_streak ?? 0,
    longestStreak: data.longest_streak ?? 0,
    totalMinutes: data.total_minutes ?? 0,
  };
}
