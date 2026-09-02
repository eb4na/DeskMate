// 1-to-1 friend direct messages. History is persisted in the Supabase
// `direct_messages` table (so offline messages are delivered on next open);
// live updates ride on a Realtime *broadcast* channel keyed by the friend-code
// pair. A separate `dm-inbox:<code>` channel pings the recipient app-wide so
// unread badges update even when they're not on the conversation screen.

import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { lookupUserIdByCode } from '@/lib/profile-sync';
import { lookupFriendUserId } from '@/lib/friend-requests';
import { maskProfanity } from '@/lib/profanity';
import type { OnlineGameId } from '@/lib/game-net';

// Max characters allowed in a single DM message.
export const DM_MAX_LENGTH = 500;

// `kind` is free-form text server-side, so 'emote' needed no migration. The
// `invite` jsonb column is the table's only free-form payload slot, so emotes
// reuse it as { emote: '<id>' } rather than adding a column (migrations here are
// run by hand). rowToMsg splits that column by `kind` so callers get typed fields.
//
// An emote's `body` is NOT the id — it's a human-readable fallback, because a
// client older than this feature has no 'emote' branch and renders `body` in a
// plain text bubble. Putting the id there made those clients print "sleepy".
export type DmKind = 'text' | 'invite' | 'emote';
export type DmInvite = { game: OnlineGameId; room: string };

export type DmMessage = {
  id: string;
  fromUser: string;
  toUser: string;
  fromCode: string;
  toCode: string;
  kind: DmKind;
  body: string | null;
  invite: DmInvite | null;
  emote: string | null;
  createdAt: string;
  readAt: string | null;
};

type Row = {
  id: string;
  from_user: string;
  to_user: string;
  from_code: string;
  to_code: string;
  kind: DmKind;
  body: string | null;
  invite: (DmInvite & { emote?: string }) | null;
  created_at: string;
  read_at: string | null;
};

function rowToMsg(r: Row): DmMessage {
  return {
    id: r.id,
    fromUser: r.from_user,
    toUser: r.to_user,
    fromCode: r.from_code,
    toCode: r.to_code,
    kind: r.kind,
    body: r.body,
    invite: r.kind === 'invite' ? ((r.invite as DmInvite) ?? null) : null,
    emote: r.kind === 'emote' ? (r.invite?.emote ?? null) : null,
    createdAt: r.created_at,
    readAt: r.read_at,
  };
}

const pairTopic = (a: string, b: string) =>
  `dm:${[a.trim().toUpperCase(), b.trim().toUpperCase()].sort().join('-')}`;
const inboxTopic = (code: string) => `dm-inbox:${code.trim().toUpperCase()}`;

// The conversation screen subscribes to the pair topic while it's open. We track
// that live channel here so sendDm can broadcast THROUGH it instead of opening a
// second channel on the same topic — supabase-js can't join one topic twice on a
// client (the duplicate fails to subscribe and the send silently no-ops, which is
// why a sent message only appeared after leaving and re-entering the chat).
const liveChannels = new Map<string, RealtimeChannel>();

// Cache friend code → auth user UUID (friends are stored by code; messages are
// addressed by UUID).
const idCache = new Map<string, string>();
export async function resolveUserId(code: string, myUserId?: string): Promise<string | null> {
  const key = code.trim().toUpperCase();
  const cached = idCache.get(key);
  if (cached) return cached;
  // Prefer the accepted friend link — it always has the friend's UUID, even if
  // they've never synced a public profile. Fall back to the profiles table.
  let id: string | null = null;
  if (myUserId) id = await lookupFriendUserId(myUserId, key);
  if (!id) id = await lookupUserIdByCode(key);
  if (id) idCache.set(key, id);
  return id;
}

/** Full conversation between me and another user, oldest → newest. */
export async function fetchConversation(myUserId: string, otherUserId: string): Promise<DmMessage[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(
      `and(from_user.eq.${myUserId},to_user.eq.${otherUserId}),and(from_user.eq.${otherUserId},to_user.eq.${myUserId})`,
    )
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return (data as Row[]).map(rowToMsg);
}

export type SendResult = { ok: true; msg: DmMessage } | { ok: false; error: string };

/** Persist a message, then broadcast it live to the pair + ping the recipient. */
export async function sendDm(args: {
  fromUser: string;
  fromCode: string;
  toUser: string;
  toCode: string;
  kind?: DmKind;
  body?: string | null;
  invite?: DmInvite | null;
  emote?: string | null;
}): Promise<SendResult> {
  // Cap length (safety net — the composer also enforces this) before masking.
  const body = args.body != null ? maskProfanity(args.body.slice(0, DM_MAX_LENGTH)) : null;
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({
      from_user: args.fromUser,
      to_user: args.toUser,
      from_code: args.fromCode.trim().toUpperCase(),
      to_code: args.toCode.trim().toUpperCase(),
      kind: args.kind ?? 'text',
      body,
      invite: args.invite ?? (args.emote ? { emote: args.emote } : null),
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'No row returned from insert.' };
  const msg = rowToMsg(data as Row);

  // Live append on the open conversation channel. Reuse the channel the screen
  // already holds for this topic (a second channel on the same topic would fail
  // to subscribe and never send); only fall back to an ephemeral one if the chat
  // isn't currently open on this device.
  const topic = pairTopic(args.fromCode, args.toCode);
  const live = liveChannels.get(topic);
  if (live) {
    live.send({ type: 'broadcast', event: 'dm', payload: msg });
  } else {
    broadcastOnce(topic, 'dm', msg);
  }
  // App-wide unread ping for the recipient (its own topic — no conflict).
  broadcastOnce(inboxTopic(args.toCode), 'dm', { fromCode: msg.fromCode });

  return { ok: true, msg };
}

/** Briefly join a channel, send one broadcast, then leave (fire-and-forget). */
function broadcastOnce(topic: string, event: string, payload: unknown): void {
  const channel = supabase.channel(topic);
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({ type: 'broadcast', event, payload });
      setTimeout(() => supabase.removeChannel(channel), 1500);
    }
  });
}

/** Live-subscribe to new messages in an open conversation. Returns unsubscribe. */
export function subscribeConversation(
  myCode: string,
  otherCode: string,
  onMessage: (m: DmMessage) => void,
): () => void {
  const topic = pairTopic(myCode, otherCode);
  const channel: RealtimeChannel = supabase.channel(topic, {
    config: { broadcast: { self: false } },
  });
  channel
    .on('broadcast', { event: 'dm' }, ({ payload }) => {
      if (payload && (payload as DmMessage).id) onMessage(payload as DmMessage);
    })
    .subscribe();
  // Register so sendDm broadcasts through this channel instead of a duplicate.
  liveChannels.set(topic, channel);
  return () => {
    if (liveChannels.get(topic) === channel) liveChannels.delete(topic);
    supabase.removeChannel(channel);
  };
}

/** App-wide listener for incoming-message pings (for unread badges). */
export function subscribeInbox(myCode: string, onPing: (fromCode: string) => void): () => void {
  if (!myCode) return () => {};
  const channel: RealtimeChannel = supabase.channel(inboxTopic(myCode), {
    config: { broadcast: { self: false } },
  });
  channel
    .on('broadcast', { event: 'dm' }, ({ payload }) => {
      const from = (payload as { fromCode?: string })?.fromCode;
      if (from) onPing(from);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Mark every unread message from `otherUserId` to me as read. */
export async function markConversationRead(myUserId: string, otherUserId: string): Promise<void> {
  await supabase
    .from('direct_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('to_user', myUserId)
    .eq('from_user', otherUserId)
    .is('read_at', null);
}

/** Unread counts addressed to me, grouped by the sender's friend code. */
export async function fetchUnreadCounts(myUserId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('from_code')
    .eq('to_user', myUserId)
    .is('read_at', null);
  if (error || !data) return {};
  const counts: Record<string, number> = {};
  for (const r of data as { from_code: string }[]) {
    counts[r.from_code] = (counts[r.from_code] ?? 0) + 1;
  }
  return counts;
}
