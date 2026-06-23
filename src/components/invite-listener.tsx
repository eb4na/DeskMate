/**
 * App-wide listener: shows a popup when a friend invites you to a minigame.
 * Mounted once in the root navigator so it works on any screen.
 */
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { bunAvatarNudge, getCompanionImage } from '@/lib/companion-utils';
import { listBlocked } from '@/lib/friend-requests';
import { joinPresence, subscribeToInvites, type GameInvite, type OnlineGameId } from '@/lib/game-net';
import { acceptGameInvite } from '@/lib/invite-actions';
import { fetchUnreadCounts, subscribeInbox } from '@/lib/direct-messages';
import { useStudyRoom } from '@/lib/use-study-room';
import { useTranslation } from '@/i18n';

const GAME_LABEL_KEY: Record<OnlineGameId, string> = {
  connect4: 'invite.game_connect4',
  tictactoe: 'invite.game_tictactoe',
  batterdash: 'invite.game_batterdash',
  study: 'invite.game_study',
};

// This invite popup is a root-level <Modal>, which iOS will NOT present over a
// modally-presented screen (the same limitation that makes Settings use its own
// local modals). So if an invite arrives while one of these modal screens is open
// — including `friends` / `dm-chat`, where you're most likely chatting with the
// inviter — we pop back to the base first so the popup is actually visible.
// Deliberately EXCLUDES the study flow (study-lobby/study-desk) and the games
// (break-game/cake-game, which aren't modal anyway), so a live session or an
// in-progress match is never interrupted.
const SURFACE_INVITE_OVER = new Set([
  '/settings', '/friends', '/profile', '/friend-card', '/dm-chat', '/companion-chat', '/companion-pfp',
  '/session-picker', '/subject-picker', '/add-task', '/add-exam', '/reminder-settings', '/manage-subjects',
  '/weekly-report', '/mood-chart', '/subject-chart', '/plus-upgrade', '/coin-shop', '/ambience-picker',
  '/companion-gallery', '/edit-room', '/food-gallery', '/legal', '/party-invite', '/custom-timer',
]);

export function InviteListener() {
  const { t } = useTranslation();
  const { friendCode, friends, setDmUnreadCounts, bumpDmUnread } = useApp();
  const { user } = useAuth();
  const studyRoom = useStudyRoom();
  const [invite, setInvite] = useState<GameInvite | null>(null);
  // Current route, kept in a ref so the realtime invite callback reads it live.
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  useEffect(() => { pathRef.current = pathname; }, [pathname]);
  // Blocked codes (in a ref so the realtime subscriptions don't need to re-bind).
  const blockedRef = useRef<string[]>([]);
  useEffect(() => {
    if (!user?.id) return;
    listBlocked(user.id).then((b) => { blockedRef.current = b; }).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    if (!friendCode) return;
    return subscribeToInvites(friendCode, (inv) => {
      if (blockedRef.current.includes(inv.fromCode)) return; // hide blocked
      // On a modal screen the root <Modal> can't present — pop back first, then
      // show the popup once the dismissal animation has settled.
      if (SURFACE_INVITE_OVER.has(pathRef.current) && router.canDismiss()) {
        router.dismissAll();
        setTimeout(() => setInvite(inv), 350);
      } else {
        setInvite(inv);
      }
    });
  }, [friendCode]);

  // Mark this user online app-wide while Memobun is open.
  useEffect(() => {
    if (!friendCode) return;
    return joinPresence(friendCode);
  }, [friendCode]);

  // Seed unread DM counts once, then keep them live via inbox pings.
  useEffect(() => {
    if (!user?.id) return;
    fetchUnreadCounts(user.id).then(setDmUnreadCounts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!friendCode) return;
    return subscribeInbox(friendCode, (fromCode) => {
      if (blockedRef.current.includes(fromCode)) return; // don't ping for blocked
      bumpDmUnread(fromCode);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendCode]);

  const fromFriend = friends.find((f) => f.code === invite?.fromCode);

  const accept = () => {
    if (!invite) return;
    const inv = invite;
    setInvite(null);
    acceptGameInvite(inv, studyRoom);
  };

  return (
    <Modal visible={!!invite} transparent animationType="fade" onRequestClose={() => setInvite(null)}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={() => setInvite(null)} />
        <View style={styles.card}>
          <View style={styles.avatar}>
            {fromFriend?.companionId !== undefined ? (
              <Image
                source={getCompanionImage(fromFriend.companionId, fromFriend.skinId)}
                style={[styles.avatarImg, bunAvatarNudge(fromFriend.companionId)]}
                contentFit="contain"
              />
            ) : (
              <Text style={styles.avatarText}>{(invite?.fromName?.[0] ?? '?').toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.title}>{t('invite.invitedYou', { name: invite?.fromName || t('invite.aFriend') })}</Text>
          <Text style={styles.subtitle}>
            {t('invite.playTogether', { game: invite ? t(GAME_LABEL_KEY[invite.game]) : t('invite.aGame') })}
          </Text>
          <View style={styles.actions}>
            <Pressable style={({ pressed }) => [styles.declineBtn, pressed && styles.pressed]} onPress={() => setInvite(null)}>
              <Text style={styles.declineText}>{t('invite.later')}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]} onPress={accept}>
              <Text style={styles.acceptText}>{t('invite.join')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const P = { card: '#FFFDF8', pink: '#F7A7B8', pinkSoft: '#FBD9E0', brown: '#5B3A2E', muted: '#9A7B6D' };

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: P.card,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    padding: 22,
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: P.pinkSoft,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  avatarImg: { position: 'absolute', width: 104, height: 104, left: -20, top: -4 },
  avatarText: { fontSize: 26, fontWeight: '900', color: P.brown },
  title: { fontSize: 17, fontWeight: '900', color: P.brown, textAlign: 'center' },
  subtitle: { fontSize: 14, color: P.muted, fontWeight: '600', textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8, alignSelf: 'stretch' },
  declineBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: '#EFE6DA', alignItems: 'center' },
  declineText: { color: P.brown, fontWeight: '800', fontSize: 15 },
  acceptBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, backgroundColor: P.pink, alignItems: 'center' },
  acceptText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  pressed: { opacity: 0.85 },
});
