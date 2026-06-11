// Shared navigation for study/game invites, so the invite popup
// (invite-listener), the friends "Play" sheet, and the in-chat invite cards all
// route into rooms identically.

import { router } from 'expo-router';

import type { GameInvite, OnlineGameId } from '@/lib/game-net';

// Minimal shape of the study-room controller from `useStudyRoom()`.
type StudyRoomLike = { joinRoom: (room: string, asHost: boolean) => void };

/** Join a room as the GUEST (accepting someone else's invite). */
export function acceptGameInvite(inv: GameInvite, studyRoom: StudyRoomLike): void {
  if (inv.game === 'study') {
    studyRoom.joinRoom(inv.room, false);
    router.push('/study-lobby');
  } else if (inv.game === 'batterdash') {
    router.push({ pathname: '/cake-game', params: { room: inv.room, role: 'guest', netmode: 'party' } });
  } else {
    router.push({ pathname: '/break-game', params: { game: inv.game, room: inv.room, role: 'guest' } });
  }
}

/** Enter a freshly-created room as the HOST (after sending an invite). */
export function hostGameInvite(game: OnlineGameId, room: string, studyRoom: StudyRoomLike): void {
  if (game === 'study') {
    studyRoom.joinRoom(room, true);
    router.push('/study-lobby');
  } else if (game === 'batterdash') {
    router.push({ pathname: '/cake-game', params: { room, role: 'host', netmode: 'party' } });
  } else {
    router.push({ pathname: '/break-game', params: { game, room, role: 'host' } });
  }
}
