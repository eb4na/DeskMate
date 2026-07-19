// Shared navigation for study/game invites, so the invite popup
// (invite-listener), the friends "Play" sheet, and the in-chat invite cards all
// route into rooms identically.

import { router } from 'expo-router';

import { sendInviteAccepted, type GameInvite, type OnlineGameId } from '@/lib/game-net';
import { navigateWithLoading, STUDY_ASSETS } from '@/lib/preload-nav';

// Minimal shape of the study-room controller from `useStudyRoom()`.
type StudyRoomLike = { joinRoom: (room: string, asHost: boolean) => void };

/** Join a room as the GUEST (accepting someone else's invite). */
export function acceptGameInvite(inv: GameInvite, studyRoom: StudyRoomLike): void {
  if (inv.game === 'study') {
    studyRoom.joinRoom(inv.room, false);
    navigateWithLoading(() => router.push('/study-lobby'), { assets: STUDY_ASSETS });
  } else if (inv.game === 'batterdash') {
    router.push({ pathname: '/cake-game', params: { room: inv.room, role: 'guest', netmode: 'party' } });
  } else {
    // 1v1 (connect4/tictactoe): the match starts the instant we join, so tell the
    // inviter we accepted — their "invite friends" screen closes itself. Not sent
    // for study/batterdash, whose invite screens intentionally stay open.
    sendInviteAccepted(inv.fromCode, inv.room);
    router.push({ pathname: '/break-game', params: { game: inv.game, room: inv.room, role: 'guest' } });
  }
}

/** Enter a freshly-created room as the HOST (after sending an invite). */
export function hostGameInvite(game: OnlineGameId, room: string, studyRoom: StudyRoomLike): void {
  if (game === 'study') {
    studyRoom.joinRoom(room, true);
    navigateWithLoading(() => router.push('/study-lobby'), { assets: STUDY_ASSETS });
  } else if (game === 'batterdash') {
    router.push({ pathname: '/cake-game', params: { room, role: 'host', netmode: 'party' } });
  } else {
    router.push({ pathname: '/break-game', params: { game, room, role: 'host' } });
  }
}
