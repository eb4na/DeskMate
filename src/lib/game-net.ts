// Lightweight realtime layer for friend game invites + in-game sync, built on
// Supabase Realtime broadcast + presence (no DB tables).
//
// - Invites: each user listens on `invites:<theirCode>`. To invite, we briefly
//   join that channel and broadcast an `invite` event.
// - Game room: both players join `game:<roomId>`; presence tells each side when
//   the opponent is connected; gameplay messages go over a single `msg` event.

import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type OnlineGameId = 'connect4' | 'tictactoe' | 'memory' | 'batterdash' | 'study';

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
// code, and any number of subscribers can read the set of online codes. A single
// channel avoids "can't add presence callbacks after subscribe()" from joining
// the same topic twice in one client.
let presenceChannel: RealtimeChannel | null = null;
let presenceCount = 0;
let onlineCache = new Set<string>();
const presenceSubs = new Set<(codes: Set<string>) => void>();

export function joinPresence(myCode: string, onSync?: (onlineCodes: Set<string>) => void): () => void {
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
        onlineCache = new Set(Object.keys(presenceChannel!.presenceState()));
        presenceSubs.forEach((cb) => cb(onlineCache));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') presenceChannel!.track({ at: Date.now() });
      });
  }

  return () => {
    if (onSync) presenceSubs.delete(onSync);
    presenceCount -= 1;
    if (presenceCount <= 0 && presenceChannel) {
      supabase.removeChannel(presenceChannel);
      presenceChannel = null;
      onlineCache = new Set();
    }
  };
}

// ── Generic 2-player game room ───────────────────────────────────────────────
export type GameRoom = {
  send: (type: string, data?: unknown) => void;
  leave: () => void;
};

export type GameRoomHandlers = {
  onMessage: (type: string, data: unknown) => void;
  onPresence: (opponentPresent: boolean) => void;
  onStatus?: (status: string) => void;
  // Party games use these for an N-player roster: the live participant count and
  // the set of present player codes (from each client's tracked `meta.code`).
  onPresenceCount?: (count: number) => void;
  onPresenceCodes?: (codes: string[]) => void;
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
      const state = channel.presenceState() as Record<string, { code?: string }[]>;
      const keys = Object.keys(state);
      handlers.onPresence(keys.length >= 2);
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
