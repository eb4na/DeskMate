// Live Connect 4 multiplayer over Supabase Realtime — broadcast + presence only,
// no database tables. Two devices join the same channel keyed by a shared friend
// code; moves are broadcast and applied deterministically on each side.
//
// Convention: host = player 1 (moves first), guest = player 2.

import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type Connect4Handlers = {
  onMove: (col: number) => void;
  onRematch: () => void;
  onPresence: (state: { opponentPresent: boolean }) => void;
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
      const participants = Object.keys(channel.presenceState()).length;
      handlers.onPresence({ opponentPresent: participants >= 2 });
    })
    .subscribe((status) => {
      handlers.onStatus?.(status);
      if (status === 'SUBSCRIBED') {
        channel.track({ role: isHost ? 'host' : 'guest', at: Date.now() });
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
