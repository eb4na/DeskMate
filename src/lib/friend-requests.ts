/**
 * Friend-request flow on top of the `friend_requests` table.
 * You send a request by code; the recipient accepts/declines; both become
 * friends only after acceptance.
 */
import { supabase } from '@/lib/supabase';
import { fetchProfileByCode, type SyncedProfile } from '@/lib/profile-sync';

export type IncomingRequest = {
  id: string;
  fromCode: string;
  profile: SyncedProfile | null;
};

export type AcceptedFriend = {
  code: string;
  profile: SyncedProfile | null;
};

// `stage` names exactly which step failed so the UI can show it (instead of one
// vague "couldn't send"): validate → bad input, lookup → couldn't find the
// recipient's profile (or DB unreachable), insert → the request write was
// rejected/unreachable.
export async function sendFriendRequest(args: {
  fromUser: string;
  fromCode: string;
  toCode: string;
}): Promise<{ ok: boolean; error?: string; stage?: 'validate' | 'lookup' | 'insert' }> {
  const toCode = args.toCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (toCode.length !== 6) return { ok: false, stage: 'validate', error: 'Friend codes are 6 letters/numbers.' };
  if (toCode === args.fromCode) return { ok: false, stage: 'validate', error: "That's your own code!" };

  // Look up the recipient directly (not via lookupUserIdByCode, which hides the
  // error) so we can tell "no such profile" apart from "DB unreachable".
  let toUser: string;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('friend_code', toCode)
      .maybeSingle();
    if (error) return { ok: false, stage: 'lookup', error: `DB error: ${error.message}` };
    if (!data) return { ok: false, stage: 'lookup', error: 'No Memobun account uses that code yet. Ask them to open the app first (their profile must sync).' };
    toUser = data.user_id as string;
  } catch (e) {
    return { ok: false, stage: 'lookup', error: `Can't reach Supabase: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (toUser === args.fromUser) return { ok: false, stage: 'validate', error: "That's your own code!" };

  try {
    const { error } = await supabase.from('friend_requests').upsert(
      {
        from_user: args.fromUser,
        from_code: args.fromCode,
        to_user: toUser,
        to_code: toCode,
        status: 'pending',
      },
      { onConflict: 'from_user,to_user' },
    );
    if (error) return { ok: false, stage: 'insert', error: `Write rejected: ${error.message}` };
  } catch (e) {
    return { ok: false, stage: 'insert', error: `Can't reach Supabase: ${e instanceof Error ? e.message : String(e)}` };
  }
  return { ok: true };
}

export async function listIncomingRequests(myUserId: string): Promise<IncomingRequest[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, from_code')
    .eq('to_user', myUserId)
    .eq('status', 'pending');
  if (error || !data) return [];
  return Promise.all(
    data.map(async (r: { id: string; from_code: string }) => ({
      id: r.id,
      fromCode: r.from_code,
      profile: await fetchProfileByCode(r.from_code),
    })),
  );
}

export async function acceptRequest(id: string): Promise<boolean> {
  const { error } = await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', id);
  return !error;
}

export async function declineRequest(id: string): Promise<boolean> {
  const { error } = await supabase.from('friend_requests').delete().eq('id', id);
  return !error;
}

/** Accepted friends involving me (either as sender or recipient). */
export async function listAcceptedFriends(myUserId: string): Promise<AcceptedFriend[]> {
  const { data, error } = await supabase
    .from('friend_requests')
    .select('from_user, from_code, to_user, to_code')
    .eq('status', 'accepted')
    .or(`from_user.eq.${myUserId},to_user.eq.${myUserId}`);
  if (error || !data) return [];
  return Promise.all(
    data.map(async (r: { from_user: string; from_code: string; to_user: string; to_code: string }) => {
      const code = r.from_user === myUserId ? r.to_code : r.from_code;
      return { code, profile: await fetchProfileByCode(code) };
    }),
  );
}

/**
 * The friend's auth user id, read from our accepted friend link. Works even if
 * the friend has never synced a profile (so it's more reliable than looking them
 * up in the public `profiles` table).
 */
export async function lookupFriendUserId(myUserId: string, friendCode: string): Promise<string | null> {
  const code = friendCode.trim().toUpperCase();
  const { data, error } = await supabase
    .from('friend_requests')
    .select('from_user, from_code, to_user, to_code')
    .or(`and(from_user.eq.${myUserId},to_code.eq.${code}),and(to_user.eq.${myUserId},from_code.eq.${code})`)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.from_user === myUserId ? data.to_user : data.from_user;
}

export async function removeFriendLink(myUserId: string, otherCode: string): Promise<void> {
  await supabase
    .from('friend_requests')
    .delete()
    .or(`and(from_user.eq.${myUserId},to_code.eq.${otherCode}),and(to_user.eq.${myUserId},from_code.eq.${otherCode})`);
}

// ── Blocking ─────────────────────────────────────────────────────────────────
// Blocking is "hide them": the codes here are filtered out of incoming requests
// and DMs on this account. Backed by the owner-only `blocked_codes` table.

/** Friend codes this account has blocked. */
export async function listBlocked(myUserId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('blocked_codes')
    .select('blocked_code')
    .eq('user_id', myUserId);
  if (error || !data) return [];
  return data.map((r: { blocked_code: string }) => r.blocked_code);
}

/** Block a code: removes any friend link, then adds them to the block list. */
export async function blockFriend(myUserId: string, otherCode: string): Promise<void> {
  const code = otherCode.trim().toUpperCase();
  await removeFriendLink(myUserId, code);
  await supabase
    .from('blocked_codes')
    .upsert({ user_id: myUserId, blocked_code: code }, { onConflict: 'user_id,blocked_code' });
}

export async function unblockFriend(myUserId: string, otherCode: string): Promise<void> {
  await supabase
    .from('blocked_codes')
    .delete()
    .eq('user_id', myUserId)
    .eq('blocked_code', otherCode.trim().toUpperCase());
}
