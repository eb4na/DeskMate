// Broadcast mail / inbox. Mail rows are inserted by the founder in Supabase (see
// supabase/migrations/20260624d_mail.sql); every client reads the live ones here.
// "Claimed" state is tracked per save in app-context (claimedMailIds).
import { supabase } from '@/lib/supabase';

export type Mail = {
  id: string;
  title: string;
  body: string;
  coins: number;
  itemId: string | null;
  // Optional "pick one" reward: the player chooses exactly one of these shop item
  // ids to claim (e.g. any one of the three pajama sets). Empty when not a choice.
  itemChoices: string[];
  createdAt: string;
};

/** Fetch all live broadcast mail, newest first. Returns [] on any error/offline. */
export async function fetchMail(): Promise<Mail[]> {
  const { data, error } = await supabase
    .from('mail')
    .select('id, title, body, coins, item_id, item_choices, created_at, active, expires_at')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const now = Date.now();
  return data
    .filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now)
    .map((m) => ({
      id: String(m.id),
      title: m.title ?? '',
      body: m.body ?? '',
      coins: m.coins ?? 0,
      itemId: m.item_id ?? null,
      itemChoices: Array.isArray(m.item_choices) ? m.item_choices.map(String) : [],
      createdAt: m.created_at ?? '',
    }));
}
