// Broadcast mail / inbox. Mail rows are inserted by the founder in Supabase (see
// supabase/migrations/20260624d_mail.sql); every client reads the live ones here.
// Claims are recorded server-side in `mail_claims` (20260626d_mail_claims.sql) so a
// reward can't be claimed twice; the local claimedMailIds mirrors that for the UI.
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

// Fixed broadcast mails (the welcome / thanks-for-downloading gifts) → i18n keys, so
// their title + body localize. Supabase mail ids are random UUIDs, so we can't key by
// id; instead match a distinctive substring of the (English) title. Any other mail —
// a one-off announcement the founder writes later — falls back to the server text.
const KNOWN_MAIL: { has: string; titleKey: string; bodyKey: string }[] = [
  { has: 'pajama set', titleKey: 'mailbox.welcomeTitle', bodyKey: 'mailbox.welcomeBody' },
  { has: 'thanks for downloading', titleKey: 'mailbox.thanksTitle', bodyKey: 'mailbox.thanksBody' },
];

/** Localized {title, body} for a mail: translated for the known fixed gifts, else the
 *  server-provided text unchanged. */
export function localizeMail(mail: { title: string; body: string }, t: (key: string) => string): { title: string; body: string } {
  const lower = mail.title.toLowerCase();
  const known = KNOWN_MAIL.find((k) => lower.includes(k.has));
  return known ? { title: t(known.titleKey), body: t(known.bodyKey) } : { title: mail.title, body: mail.body };
}

/** Mail ids the signed-in user has already claimed (server-authoritative). */
export async function fetchMailClaims(): Promise<string[]> {
  const { data, error } = await supabase.from('mail_claims').select('mail_id');
  if (error || !data) return [];
  return data.map((r: { mail_id: string }) => String(r.mail_id));
}

// Outcome of a server claim attempt:
//   'new'     – this call recorded a fresh claim → grant the reward now
//   'already' – the mail was already claimed (or is gone/expired) → don't grant, but
//               it's safe to show as claimed
//   'error'   – the request failed (offline / RPC error) → leave it UNCLAIMED so the
//               user can retry; never mark it claimed or we'd forfeit the reward
export type ClaimResult = 'new' | 'already' | 'error';

/** Record a claim server-side. See ClaimResult for the three outcomes. */
export async function claimMailRemote(mailId: string, itemId: string | null): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc('claim_mail', {
    p_mail_id: mailId,
    p_item_id: itemId,
  });
  if (error) {
    console.warn('[mail] claim_mail error:', error.message);
    return 'error';
  }
  return data === true ? 'new' : 'already';
}
