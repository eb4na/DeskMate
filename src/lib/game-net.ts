// Lightweight realtime layer for friend game invites + in-game sync, built on
// Supabase Realtime broadcast + presence (no DB tables).
//
// - Invites: each user listens on `invites:<theirCode>`. To invite, we briefly
//   join that channel and broadcast an `invite` event.
// - Game room: both players join `game:<roomId>`; presence tells each side when
//   the opponent is connected; gameplay messages go over a single `msg` event.

import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type OnlineGameId = 'connect4' | 'tictactoe' | 'batterdash' | 'study';

export type GameInvite = {
  game: OnlineGameId;
  room: string;
  fromCode: string;
  fromName: string;
};

function inviteChannel(code: string): string {
  return `invites:${code.trim().toUpperCase()}`;
}

/** Listen for game invites addressed to me. Returns an unsubscribe fn. */
export function subscribeToInvites(myCode: string, onInvite: (inv: GameInvite) => void): () => void {
  if (!myCode) return () => {};
  const channel = supabase.channel(inviteChannel(myCode), { config: { broadcast: { self: false } } });
  channel
    .on('broadcast', { event: 'invite' }, ({ payload }) => {
      if (payload && payload.game && payload.room) onInvite(payload as GameInvite);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Fire-and-forget invite to a friend's invite channel. */
export function sendInvite(toCode: string, invite: GameInvite): void {
  const channel = supabase.channel(inviteChannel(toCode));
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({ type: 'broadcast', event: 'invite', payload: invite });
      setTimeout(() => supabase.removeChannel(channel), 1500);
    }
  });
}

export function newRoomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Online presence ──────────────────────────────────────────────────────────
// One shared, ref-counted `online-users` channel: everyone tracks their friend
// code + current study status, and any number of subscribers read the live
// code→status map. `.has(code)` = online (any status); `.get(code)` = their status.
// A single channel avoids "can't add presence callbacks after subscribe()" from
// joining the same topic twice in one client.
//   studying — in a study session, focused (not invitable to a break game)
//   break    — in a study session, on a break (invitable)
//   free     — online but not in a session (invitable)
export type PresenceStatus = 'studying' | 'break' | 'free';
export type PresenceMap = ReadonlyMap<string, PresenceStatus>;

let presenceChannel: RealtimeChannel | null = null;
let presenceCount = 0;
let onlineCache = new Map<string, PresenceStatus>();
// This client's broadcast study status, re-tracked whenever it changes. Defaults to
// 'free' (online, not studying).
let myPresenceStatus: PresenceStatus = 'free';
const presenceSubs = new Set<(online: PresenceMap) => void>();

function readPresence(): Map<string, PresenceStatus> {
  const state = presenceChannel?.presenceState() as Record<string, { status?: PresenceStatus }[]> | undefined;
  const m = new Map<string, PresenceStatus>();
  if (state) for (const key in state) m.set(key, state[key]?.[0]?.status ?? 'free');
  return m;
}

export function joinPresence(myCode: string, onSync?: (online: PresenceMap) => void): () => void {
  if (!myCode) return () => {};
  if (onSync) {
    presenceSubs.add(onSync);
    onSync(onlineCache);
  }
  presenceCount += 1;

  if (!presenceChannel) {
    presenceChannel = supabase.channel('online-users', {
      config: { presence: { key: myCode.trim().toUpperCase() } },
    });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        onlineCache = readPresence();
        presenceSubs.forEach((cb) => cb(onlineCache));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') presenceChannel!.track({ at: Date.now(), status: myPresenceStatus });
      });
  }

  return () => {
    if (onSync) presenceSubs.delete(onSync);
    presenceCount -= 1;
    if (presenceCount <= 0 && presenceChannel) {
      supabase.removeChannel(presenceChannel);
      presenceChannel = null;
      onlineCache = new Map();
    }
  };
}

// Update this client's broadcast study status. Re-tracks on the live presence
// channel so friends see the change at once. Remembered even when not joined, so it
// applies on the next join.
export function setMyPresenceStatus(status: PresenceStatus) {
  if (myPresenceStatus === status) return;
  myPresenceStatus = status;
  presenceChannel?.track({ at: Date.now(), status });
}

// ── Generic 2-player game room ───────────────────────────────────────────────
export type GameRoom = {
  send: (type: string, data?: unknown) => void;
  leave: () => void;
};

// What a player shares about themselves so the opponent can show their avatar.
export type PlayerMeta = { companionId?: string; skinId?: string; name?: string };

export type GameRoomHandlers = {
  onMessage: (type: string, data: unknown) => void;
  onPresence: (opponentPresent: boolean) => void;
  onStatus?: (status: string) => void;
  // Party games use these for an N-player roster: the live participant count and
  // the set of present player codes (from each client's tracked `meta.code`).
  onPresenceCount?: (count: number) => void;
  onPresenceCodes?: (codes: string[]) => void;
  // 1v1 games: the opponent's shared companion/name (null until they sync).
  onOpponentMeta?: (meta: PlayerMeta | null) => void;
};

// `meta` is merged into this client's presence payload (e.g. `{ code }`) so other
// players can map a present participant back to a friend code.
export function joinGameRoom(
  roomId: string,
  isHost: boolean,
  handlers: GameRoomHandlers,
  meta?: Record<string, unknown>,
): GameRoom {
  const selfId = `${isHost ? 'host' : 'guest'}-${Math.random().toString(36).slice(2, 10)}`;
  const channel: RealtimeChannel = supabase.channel(`game:${roomId}`, {
    config: { broadcast: { self: false }, presence: { key: selfId } },
  });

  channel
    .on('broadcast', { event: 'msg' }, ({ payload }) => {
      if (payload && typeof payload.type === 'string') handlers.onMessage(payload.type, payload.data);
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, (PlayerMeta & { code?: string })[]>;
      const keys = Object.keys(state);
      handlers.onPresence(keys.length >= 2);
      if (handlers.onOpponentMeta) {
        const oppKey = keys.find((k) => k !== selfId);
        const e = oppKey ? state[oppKey]?.[0] : undefined;
        handlers.onOpponentMeta(e ? { companionId: e.companionId, skinId: e.skinId, name: e.name } : null);
      }
      handlers.onPresenceCount?.(keys.length);
      if (handlers.onPresenceCodes) {
        const codes = Object.values(state)
          .flat()
          .map((m) => m?.code)
          .filter((c): c is string => typeof c === 'string');
        handlers.onPresenceCodes(codes);
      }
    })
    .subscribe((status) => {
      handlers.onStatus?.(status);
      if (status === 'SUBSCRIBED') channel.track({ role: isHost ? 'host' : 'guest', at: Date.now(), ...(meta ?? {}) });
    });

  return {
    send: (type, data) => {
      channel.send({ type: 'broadcast', event: 'msg', payload: { type, data } });
    },
    leave: () => {
      supabase.removeChannel(channel);
    },
  };
}
