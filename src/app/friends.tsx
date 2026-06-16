import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { GoogleGIcon } from '@/components/auth-icons';
import { useApp } from '@/context/app-context';
import type { Friend } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { bunAvatarNudge, getCompanionImage, resolveProfileFigure } from '@/lib/companion-utils';
import { joinPresence, newRoomId, sendInvite, type OnlineGameId } from '@/lib/game-net';
import { hostGameInvite } from '@/lib/invite-actions';
import { useStudyRoom } from '@/lib/use-study-room';
import {
  acceptRequest,
  blockFriend,
  declineRequest,
  listAcceptedFriends,
  listBlocked,
  listIncomingRequests,
  removeFriendLink,
  sendFriendRequest,
  unblockFriend,
  type IncomingRequest,
} from '@/lib/friend-requests';
import { fetchProfileByCode, type SyncedProfile } from '@/lib/profile-sync';
import { PlusCrown, isPlusFrame } from '@/components/avatar-frame';
import { useTranslation } from '@/i18n';
import { MaxContentWidth, Spacing } from '@/constants/theme';

function toFriendPatch(p: SyncedProfile): Partial<Friend> {
  return {
    displayName: p.displayName || undefined,
    companionId: p.companionId,
    skinId: p.skinId,
    backgroundId: p.backgroundId,
    avatarFrame: p.avatarFrame,
    description: p.description,
    birthday: p.birthday,
    currentStreak: p.currentStreak,
    longestStreak: p.longestStreak,
    totalMinutes: p.totalMinutes,
  };
}

const P = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F7A7B8',
  pinkSoft: '#FBD9E0',
  peach: '#F4C5A8',
  brown: '#5B3A2E',
  mutedBrown: '#9A7B6D',
  button: '#8A7A60',
} as const;

const INVITE_GAMES: { id: OnlineGameId; nameKey: string; emoji: string }[] = [
  { id: 'connect4', nameKey: 'friends.game_connect4', emoji: '' },
  { id: 'tictactoe', nameKey: 'friends.game_tictactoe', emoji: '' },
];

export default function FriendsScreen() {
  const { t } = useTranslation();
  const {
    friendCode, friends, addFriend, removeFriend, setFriendProfile, profileDisplayName, dmUnread,
    activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins,
    profileAvatarFrame, profileCompanionId, profileSkinId,
  } = useApp();
  // My friend-list avatar = the character I pinned on my Profile card, NOT whoever
  // I'm currently using. Only falls back to the active companion if I've never set
  // a card pick (profileCompanionId === '').
  const meSource = resolveProfileFigure({
    profileCompanionId, profileSkinId,
    activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins,
  });
  const { user, isGuest, upgradeGuestWithGoogle } = useAuth();
  const studyRoom = useStudyRoom();
  const [input, setInput] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null); // shows the "request sent" confirmation
  const [playFor, setPlayFor] = useState<Friend | null>(null);
  const [onlineCodes, setOnlineCodes] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!friendCode) return;
    return joinPresence(friendCode, setOnlineCodes);
  }, [friendCode]);

  const startInvite = (friend: Friend, game: OnlineGameId) => {
    const room = newRoomId();
    sendInvite(friend.code, {
      game,
      room,
      fromCode: friendCode,
      fromName: profileDisplayName || t('friendCard.friendFallback', { code: friendCode }),
    });
    setPlayFor(null);
    hostGameInvite(game, room, studyRoom);
  };

  // On open: pull accepted friends + incoming requests from the cloud, and
  // refresh each friend's card.
  const refresh = async () => {
    if (!user?.id) return;
    const [accepted, reqs, blk] = await Promise.all([
      listAcceptedFriends(user.id),
      listIncomingRequests(user.id),
      listBlocked(user.id),
    ]);
    setBlocked(blk);
    for (const a of accepted) {
      if (blk.includes(a.code)) continue; // never re-add a blocked person
      addFriend(a.code); // no-op if already a friend
      if (a.profile) setFriendProfile(a.code, toFriendPatch(a.profile));
    }
    setIncoming(reqs.filter((r) => !blk.includes(r.fromCode))); // hide blocked senders
  };

  useEffect(() => {
    refresh();
    friends.forEach(async (f) => {
      const p = await fetchProfileByCode(f.code);
      if (p) setFriendProfile(f.code, toFriendPatch(p));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleAdd = async () => {
    if (!user?.id) {
      showPopup(t('friends.signInNeeded'), t('friends.signInToSend'));
      return;
    }
    setBusy(true);
    const res = await sendFriendRequest({ fromUser: user.id, fromCode: friendCode, toCode: input });
    setBusy(false);
    if (res.ok) {
      const code = input.trim().toUpperCase();
      setInput('');
      setSentTo(code); // themed confirmation screen instead of a system alert
    } else {
      showPopup(t('friends.couldNotSend'), res.error ?? t('friends.tryAgain'));
    }
  };

  const handleAccept = async (req: IncomingRequest) => {
    await acceptRequest(req.id);
    addFriend(req.fromCode);
    if (req.profile) setFriendProfile(req.fromCode, toFriendPatch(req.profile));
    setIncoming((prev) => prev.filter((r) => r.id !== req.id));
  };

  const handleDecline = async (req: IncomingRequest) => {
    await declineRequest(req.id);
    setIncoming((prev) => prev.filter((r) => r.id !== req.id));
  };

  const shareCode = async () => {
    try {
      await Share.share({ message: t('friends.shareMessage', { code: friendCode }) });
    } catch {
      showPopup(t('friends.yourFriendCodeTitle'), friendCode);
    }
  };

  // Copy the friend code to the clipboard, flashing the button label for ~1.5s.
  // Lazy-require so a dev build missing the native clipboard module doesn't crash
  // the whole screen at import time. If the native module isn't in the binary yet
  // (needs a rebuild), fall back to the OS share sheet so the button still works.
  const copyCode = async () => {
    if (!friendCode) return;
    try {
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(friendCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      shareCode();
    }
  };

  const confirmRemove = (code: string, name: string) => {
    showPopup(t('friends.removeFriendQ'), t('friends.removeFriendMsg', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('friends.remove'),
        style: 'destructive',
        onPress: () => {
          removeFriend(code);
          if (user?.id) removeFriendLink(user.id, code);
        },
      },
      {
        text: t('friends.block', { defaultValue: 'Block' }),
        style: 'destructive',
        onPress: async () => {
          removeFriend(code);
          if (user?.id) {
            await blockFriend(user.id, code);
            setBlocked((p) => (p.includes(code) ? p : [...p, code]));
          }
        },
      },
    ]);
  };

  const handleUnblock = async (code: string) => {
    if (user?.id) await unblockFriend(user.id, code);
    setBlocked((p) => p.filter((c) => c !== code));
  };

  // Guests can't add friends until they create an account. Connecting Google
  // converts them in place (keeping their progress) — the screen then re-renders
  // as the real friends list.
  const handleUpgrade = async () => {
    setUpgrading(true);
    const res = await upgradeGuestWithGoogle();
    setUpgrading(false);
    if (!res.ok && !res.cancelled) {
      showPopup(t('auth.connectFailed'), res.error ?? t('friends.tryAgain'));
    }
  };

  // ── Guest gate: friending requires an account ──
  if (isGuest) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: P.cream }]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.gateWrap}>
            <Text style={styles.gateTitle}>{t('friends.guestGateTitle')}</Text>
            <Text style={styles.gateBody}>{t('friends.guestGateBody')}</Text>
            <Pressable
              disabled={upgrading}
              onPress={handleUpgrade}
              style={({ pressed }) => [styles.gateGoogleBtn, pressed && styles.pressed, upgrading && styles.gateBtnDisabled]}>
              <GoogleGIcon size={20} />
              <Text style={styles.gateGoogleText}>{t('auth.continueWithGoogle')}</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.gateLater, pressed && styles.pressed]} onPress={() => router.back()}>
              <Text style={styles.gateLaterText}>{t('friends.guestGateLater')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: P.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: P.cream }}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.headerPanel}>
            <Text style={styles.headerTitle}>{t('friends.studyFriends')}</Text>
            <Text style={styles.headerSubtitle}>{t('friends.addAndStudy')}</Text>
          </View>

          {/* My profile card — my avatar, name, and code, the way friends see me. */}
          <Pressable
            style={({ pressed }) => [styles.friendRow, styles.meRow, pressed && styles.pressed]}
            onPress={() => router.push('/profile')}>
            <View style={styles.avatarWrap}>
              <View style={styles.friendAvatar}>
                <Image
                  source={meSource}
                  style={[styles.friendAvatarImg, bunAvatarNudge(profileCompanionId)]}
                  contentFit="contain"
                />
              </View>
            </View>
            <View style={styles.friendInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.friendName}>{profileDisplayName || t('friends.you')}</Text>
                {isPlusFrame(profileAvatarFrame) && <PlusCrown size={16} />}
              </View>
              <Text style={styles.friendCode}>{friendCode}</Text>
            </View>
            <View style={styles.meTag}>
              <Text style={styles.meTagText}>{t('friends.you')}</Text>
            </View>
            <Text style={styles.profileBtnChevron}>›</Text>
          </Pressable>

          {/* Your code */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('friends.yourFriendCode')}</Text>
            <View style={styles.codeCard}>
              <Text style={styles.codeText}>{friendCode}</Text>
              <View style={styles.codeBtnRow}>
                <Pressable
                  style={({ pressed }) => [styles.copyBtn, pressed && styles.pressed]}
                  onPress={copyCode}>
                  <Text style={styles.copyBtnText}>{copied ? t('friends.copied') : t('friends.copyCode')}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]}
                  onPress={shareCode}>
                  <Text style={styles.shareBtnText}>{t('friends.share')}</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.codeHint}>{t('friends.shareCodeHint')}</Text>
          </View>

          {/* Add a friend */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('friends.addFriend')}</Text>
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={input}
                onChangeText={(v) => setInput(v.toUpperCase())}
                placeholder={t('friends.enterFriendCode')}
                placeholderTextColor={P.mutedBrown}
                autoCapitalize="characters"
                maxLength={6}
              />
              <Pressable
                style={({ pressed }) => [styles.addBtn, (pressed || busy) && styles.pressed]}
                disabled={busy}
                onPress={handleAdd}>
                <Text style={styles.addBtnText}>{busy ? '…' : t('friends.send')}</Text>
              </Pressable>
            </View>
            <Text style={styles.codeHint}>{t('friends.requestHint')}</Text>
          </View>

          {/* Incoming requests */}
          {incoming.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('friends.friendRequests', { count: incoming.length })}</Text>
              <View style={styles.friendList}>
                {incoming.map((req) => (
                  <View key={req.id} style={styles.friendRow}>
                    <View style={styles.friendAvatar}>
                      <Image
                        source={getCompanionImage(req.profile?.companionId, req.profile?.skinId)}
                        style={[styles.friendAvatarImg, bunAvatarNudge(req.profile?.companionId)]}
                        contentFit="contain"
                      />
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{req.profile?.displayName || t('friendCard.friendFallback', { code: req.fromCode })}</Text>
                      <Text style={styles.friendCode}>{req.fromCode}</Text>
                    </View>
                    <Pressable style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]} onPress={() => handleAccept(req)}>
                      <Text style={styles.acceptBtnText}>{t('friends.accept')}</Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => handleDecline(req)} style={styles.friendRemove}>
                      <Text style={styles.friendRemoveText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Friends list */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('friends.myFriends', { count: friends.length })}</Text>
            {friends.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}></Text>
                <Text style={styles.emptyTitle}>{t('friends.noFriendsYet')}</Text>
                <Text style={styles.emptyText}>{t('friends.noFriendsHint')}</Text>
              </View>
            ) : (
              <View style={styles.friendList}>
                {friends.map((f) => (
                  <View key={f.code} style={styles.friendRow}>
                    <Pressable
                      style={({ pressed }) => [styles.friendTap, pressed && styles.pressed]}
                      onPress={() => router.push({ pathname: '/friend-card', params: { code: f.code } })}>
                      <View style={styles.avatarWrap}>
                        <View style={styles.friendAvatar}>
                          <Image
                            source={getCompanionImage(f.companionId, f.skinId)}
                            style={[styles.friendAvatarImg, bunAvatarNudge(f.companionId)]}
                            contentFit="contain"
                          />
                        </View>
                        <View style={[styles.statusDot, onlineCodes.has(f.code) ? styles.statusOnline : styles.statusOffline]} />
                      </View>
                      <View style={styles.friendInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.friendName}>{f.displayName || f.name}</Text>
                          {isPlusFrame(f.avatarFrame) && <PlusCrown size={16} />}
                        </View>
                        <Text style={styles.friendCode}>{onlineCodes.has(f.code) ? t('friends.onlineNow') : f.code}</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.chatBtn, pressed && styles.pressed]}
                      onPress={() => router.push({ pathname: '/dm-chat', params: { code: f.code } })}>
                      <Text style={styles.chatBtnText}>{t('friends.chat')}</Text>
                      {(dmUnread[f.code] ?? dmUnread[f.code.toUpperCase()] ?? 0) > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>
                            {dmUnread[f.code] ?? dmUnread[f.code.toUpperCase()]}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                    <Pressable style={({ pressed }) => [styles.playBtn, pressed && styles.pressed]} onPress={() => setPlayFor(f)}>
                      <Text style={styles.playBtnText}>{t('friends.play')}</Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => confirmRemove(f.code, f.name)} style={styles.friendRemove}>
                      <Text style={styles.friendRemoveText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Blocked list */}
          {blocked.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('friends.blocked', { defaultValue: 'Blocked' })}</Text>
              <View style={styles.friendList}>
                {blocked.map((code) => (
                  <View key={code} style={styles.friendRow}>
                    <Text style={[styles.friendName, { flex: 1, paddingLeft: 10 }]}>{code}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.chatBtn, pressed && styles.pressed]}
                      onPress={() => handleUnblock(code)}>
                      <Text style={styles.chatBtnText}>{t('friends.unblock', { defaultValue: 'Unblock' })}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Info note */}
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              {t('friends.infoNote')}
            </Text>
          </View>

          {/* Done */}
          <Pressable style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>{t('common.done')}</Text>
          </Pressable>
        </SafeAreaView>
      </ScrollView>

      {/* Game-picker sheet */}
      <Modal visible={!!playFor} transparent animationType="fade" onRequestClose={() => setPlayFor(null)}>
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setPlayFor(null)} />
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>{t('friends.inviteTo', { name: playFor?.displayName || playFor?.name || '' })}</Text>
            {INVITE_GAMES.map((g) => (
              <Pressable
                key={g.id}
                style={({ pressed }) => [styles.sheetItem, pressed && styles.pressed]}
                onPress={() => playFor && startInvite(playFor, g.id)}>
                <Text style={styles.sheetEmoji}>{g.emoji}</Text>
                <Text style={styles.sheetItemText}>{t(g.nameKey)}</Text>
                <Text style={styles.sheetChevron}>›</Text>
              </Pressable>
            ))}
            <Pressable style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]} onPress={() => setPlayFor(null)}>
              <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Friend-request "sent" confirmation — a cozy themed screen, not a system alert. */}
      <Modal visible={!!sentTo} transparent animationType="fade" onRequestClose={() => setSentTo(null)}>
        <View style={styles.sentRoot}>
          <Pressable style={styles.sentBackdrop} onPress={() => setSentTo(null)} />
          <View style={styles.sentCard}>
            <View style={styles.sentCheck}>
              <Text style={styles.sentCheckMark}>✓</Text>
            </View>
            <Text style={styles.sentTitle}>{t('friends.requestSent')}</Text>
            <Text style={styles.sentMsg}>{t('friends.requestSentMsg')}</Text>
            <View style={styles.sentCodePill}>
              <Text style={styles.sentCode}>{sentTo}</Text>
            </View>
            <Pressable style={({ pressed }) => [styles.sentDone, pressed && styles.pressed]} onPress={() => setSentTo(null)}>
              <Text style={styles.sentDoneText}>{t('common.done')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
    backgroundColor: P.cream,
  },
  headerPanel: {
    backgroundColor: P.card,
    borderRadius: 26,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderWidth: 1.5,
    borderColor: P.peach,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#C9A18A',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: P.brown, letterSpacing: 0.2 },
  headerSubtitle: { fontSize: 13, color: P.mutedBrown, fontWeight: '500' },

  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: P.pinkSoft,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: P.pink,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  profileBtnText: { fontSize: 16, fontWeight: '800', color: P.brown },
  profileBtnChevron: { fontSize: 22, fontWeight: '800', color: P.pink },
  meRow: { borderColor: P.pink, borderWidth: 2 },
  meTag: { backgroundColor: P.pink, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  meTagText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },

  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: P.brown },

  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: P.card,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  codeText: { fontSize: 26, fontWeight: '900', letterSpacing: 4, color: P.brown },
  codeBtnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  copyBtn: { backgroundColor: P.pink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  copyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  shareBtn: {
    backgroundColor: P.card,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: P.pink,
  },
  shareBtnText: { color: P.pink, fontWeight: '800', fontSize: 13 },
  codeHint: { fontSize: 12, color: P.mutedBrown, textAlign: 'center' },

  addRow: { flexDirection: 'row', gap: Spacing.two },
  addInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: P.peach,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
    color: P.brown,
    backgroundColor: P.card,
  },
  addBtn: {
    backgroundColor: P.pink,
    borderRadius: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  friendList: { gap: Spacing.two },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: P.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
    padding: Spacing.two,
  },
  friendAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: P.pinkSoft, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  friendAvatarText: { fontSize: 18, fontWeight: '900', color: P.brown },
  friendAvatarImg: { position: 'absolute', width: 72, height: 72, left: -14, top: -3 },
  friendTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  avatarWrap: { width: 44, height: 44 },
  statusDot: {
    position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7,
    borderWidth: 2, borderColor: '#fff',
  },
  statusOnline: { backgroundColor: '#5BC47B' },
  statusOffline: { backgroundColor: '#C9BBA8' },
  // marginLeft clears the enlarged avatar frame's right overhang (FRAME_SCALE 1.35
  // on a 44px avatar ≈ 7.7px past the avatarWrap) so the name/code never sits under it.
  friendInfo: { flex: 1, marginLeft: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  friendName: { fontSize: 15, fontWeight: '800', color: P.brown },
  friendCode: { fontSize: 12, color: P.mutedBrown, letterSpacing: 1 },
  friendRemove: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  friendRemoveText: { fontSize: 14, color: P.mutedBrown, fontWeight: '700' },
  acceptBtn: { backgroundColor: P.pink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  acceptBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  playBtn: { backgroundColor: P.peach, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  playBtnText: { color: P.brown, fontWeight: '800', fontSize: 13 },
  chatBtn: { backgroundColor: P.pink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  chatBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  unreadBadge: {
    position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: P.brown, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(48,32,24,0.4)' },
  sheetCard: {
    backgroundColor: P.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: Spacing.four,
    gap: Spacing.two,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
  },
  sheetTitle: { fontSize: 17, fontWeight: '900', color: P.brown, marginBottom: 4 },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: P.cream,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  sheetEmoji: { fontSize: 22 },
  sheetItemText: { flex: 1, fontSize: 16, fontWeight: '800', color: P.brown },
  sheetChevron: { fontSize: 22, fontWeight: '800', color: P.pink },
  sheetCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  sheetCancelText: { color: P.mutedBrown, fontWeight: '800', fontSize: 15 },

  // "Request sent" confirmation modal — centered cozy card.
  sentRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  sentBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(48,32,24,0.4)' },
  sentCard: {
    width: '100%', maxWidth: 320, backgroundColor: P.card, borderRadius: 26,
    borderWidth: 1.5, borderColor: P.pinkSoft, padding: Spacing.four, alignItems: 'center', gap: Spacing.two,
  },
  sentCheck: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: P.pink,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  sentCheckMark: { color: '#fff', fontSize: 34, fontWeight: '900', lineHeight: 38 },
  sentTitle: { fontSize: 19, fontWeight: '900', color: P.brown, textAlign: 'center' },
  sentMsg: { fontSize: 13, color: P.mutedBrown, textAlign: 'center', lineHeight: 18 },
  sentCodePill: {
    backgroundColor: P.cream, borderRadius: 999, borderWidth: 1.5, borderColor: P.pinkSoft,
    paddingHorizontal: 18, paddingVertical: 8, marginTop: 2,
  },
  sentCode: { fontSize: 18, fontWeight: '900', color: P.pink, letterSpacing: 2 },
  sentDone: {
    alignSelf: 'stretch', alignItems: 'center', backgroundColor: P.pink,
    borderRadius: 16, paddingVertical: 13, marginTop: Spacing.one,
  },
  sentDoneText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  emptyCard: {
    backgroundColor: P.card,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 6,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: P.brown },
  emptyText: { fontSize: 13, color: P.mutedBrown, textAlign: 'center' },

  infoCard: {
    backgroundColor: P.pinkSoft,
    borderRadius: 18,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: P.pink,
  },
  infoText: { fontSize: 12.5, color: P.brown, textAlign: 'center', lineHeight: 18, fontWeight: '500' },

  doneButton: {
    backgroundColor: '#F7A7B8',
    borderRadius: 18,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  doneButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  // Guest gate
  gateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, paddingHorizontal: Spacing.four },
  gateTitle: { fontSize: 22, fontWeight: '900', color: P.brown, textAlign: 'center' },
  gateBody: { fontSize: 15, color: P.mutedBrown, textAlign: 'center', lineHeight: 21 },
  gateGoogleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: Spacing.three,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
    marginTop: Spacing.two,
  },
  gateGoogleText: { fontSize: 16, fontWeight: '800', color: P.brown },
  gateBtnDisabled: { opacity: 0.6 },
  gateLater: { paddingVertical: Spacing.two },
  gateLaterText: { fontSize: 14, fontWeight: '700', color: P.mutedBrown },

  pressed: { opacity: 0.85 },
});
