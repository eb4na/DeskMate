// Live Connect 4 multiplayer over Supabase Realtime — broadcast + presence only,
// no database tables. Two devices join the same channel keyed by a shared friend
// code; moves are broadcast and applied deterministically on each side.
//
// Convention: host = player 1 (moves first), guest = player 2.

import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// What we share about ourselves so the other side can show our avatar/name.
export type PlayerMeta = { companionId?: string; skinId?: string; name?: string };

export type Connect4Handlers = {
  onMove: (col: number) => void;
  onRematch: () => void;
  onPresence: (state: { opponentPresent: boolean; opponent: PlayerMeta | null }) => void;
  onStatus?: (status: string) => void;
};

export type Connect4Room = {
  sendMove: (col: number) => void;
  sendRematch: () => void;
  leave: () => void;
};

function channelName(roomCode: string): string {
  return `connect4:${roomCode.trim().toUpperCase()}`;
}

export function joinConnect4Room(
  roomCode: string,
  isHost: boolean,
  handlers: Connect4Handlers,
  self: PlayerMeta = {},
): Connect4Room {
  // Unique presence key per device so host + guest are counted separately.
  const selfId = `${isHost ? 'host' : 'guest'}-${Math.random().toString(36).slice(2, 10)}`;

  const channel: RealtimeChannel = supabase.channel(channelName(roomCode), {
    config: {
      broadcast: { self: false },
      presence: { key: selfId },
    },
  });

  channel
    .on('broadcast', { event: 'move' }, ({ payload }) => {
      if (payload && typeof payload.col === 'number') handlers.onMove(payload.col);
    })
    .on('broadcast', { event: 'rematch' }, () => handlers.onRematch())
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PlayerMeta & { presence_ref: string }>();
      const keys = Object.keys(state);
      // The opponent is any presence key that isn't ours; read their shared meta.
      const oppKey = keys.find((k) => k !== selfId);
      const oppEntry = oppKey ? state[oppKey]?.[0] : undefined;
      const opponent = oppEntry
        ? { companionId: oppEntry.companionId, skinId: oppEntry.skinId, name: oppEntry.name }
        : null;
      handlers.onPresence({ opponentPresent: keys.length >= 2, opponent });
    })
    .subscribe((status) => {
      handlers.onStatus?.(status);
      if (status === 'SUBSCRIBED') {
        channel.track({ role: isHost ? 'host' : 'guest', at: Date.now(), ...self });
      }
    });

  return {
    sendMove: (col: number) => {
      channel.send({ type: 'broadcast', event: 'move', payload: { col } });
    },
    sendRematch: () => {
      channel.send({ type: 'broadcast', event: 'rematch', payload: {} });
    },
    leave: () => {
      supabase.removeChannel(channel);
    },
  };
}
