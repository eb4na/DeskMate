import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import type { Friend } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { getCompanionImage } from '@/lib/companion-utils';
import { joinPresence, newRoomId, sendInvite, type OnlineGameId } from '@/lib/game-net';
import {
  acceptRequest,
  declineRequest,
  listAcceptedFriends,
  listIncomingRequests,
  removeFriendLink,
  sendFriendRequest,
  type IncomingRequest,
} from '@/lib/friend-requests';
import { fetchProfileByCode, type SyncedProfile } from '@/lib/profile-sync';
import { useTranslation } from '@/i18n';
import { MaxContentWidth, Spacing } from '@/constants/theme';

function toFriendPatch(p: SyncedProfile): Partial<Friend> {
  return {
    displayName: p.displayName || undefined,
    companionId: p.companionId,
    skinId: p.skinId,
    backgroundId: p.backgroundId,
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
  { id: 'connect4', nameKey: 'friends.game_connect4', emoji: '🔴' },
  { id: 'tictactoe', nameKey: 'friends.game_tictactoe', emoji: '⭕' },
  { id: 'memory', nameKey: 'friends.game_memory', emoji: '🃏' },
  { id: 'batterdash', nameKey: 'friends.game_batterdash', emoji: '🎂' },
];

export default function FriendsScreen() {
  const { t } = useTranslation();
  const { friendCode, friends, addFriend, removeFriend, setFriendProfile, profileDisplayName } = useApp();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [playFor, setPlayFor] = useState<Friend | null>(null);
  const [onlineCodes, setOnlineCodes] = useState<Set<string>>(new Set());

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
    if (game === 'batterdash') {
      // Start a party as host; invite more friends from the lobby.
      router.push({ pathname: '/cake-game', params: { room, role: 'host', netmode: 'party' } });
    } else {
      router.push({ pathname: '/break-game', params: { game, room, role: 'host' } });
    }
  };

  // On open: pull accepted friends + incoming requests from the cloud, and
  // refresh each friend's card.
  const refresh = async () => {
    if (!user?.id) return;
    const [accepted, reqs] = await Promise.all([
      listAcceptedFriends(user.id),
      listIncomingRequests(user.id),
    ]);
    for (const a of accepted) {
      addFriend(a.code); // no-op if already a friend
      if (a.profile) setFriendProfile(a.code, toFriendPatch(a.profile));
    }
    setIncoming(reqs);
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
      Alert.alert(t('friends.signInNeeded'), t('friends.signInToSend'));
      return;
    }
    setBusy(true);
    const res = await sendFriendRequest({ fromUser: user.id, fromCode: friendCode, toCode: input });
    setBusy(false);
    if (res.ok) {
      setInput('');
      Alert.alert(t('friends.requestSent'), t('friends.requestSentMsg'));
    } else {
      Alert.alert(t('friends.couldNotSend'), res.error ?? t('friends.tryAgain'));
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
      Alert.alert(t('friends.yourFriendCodeTitle'), friendCode);
    }
  };

  const confirmRemove = (code: string, name: string) => {
    Alert.alert(t('friends.removeFriendQ'), t('friends.removeFriendMsg', { name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('friends.remove'),
        style: 'destructive',
        onPress: () => {
          removeFriend(code);
          if (user?.id) removeFriendLink(user.id, code);
        },
      },
    ]);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: P.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: P.cream }}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.headerPanel}>
            <Text style={styles.headerTitle}>{t('friends.studyFriends')}</Text>
            <Text style={styles.headerSubtitle}>{t('friends.addAndStudy')}</Text>
          </View>

          {/* My profile card */}
          <Pressable
            style={({ pressed }) => [styles.profileBtn, pressed && styles.pressed]}
            onPress={() => router.push('/profile')}>
            <Text style={styles.profileBtnText}>{t('friends.myProfileCard')}</Text>
            <Text style={styles.profileBtnChevron}>›</Text>
          </Pressable>

          {/* Your code */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('friends.yourFriendCode')}</Text>
            <Pressable style={({ pressed }) => [styles.codeCard, pressed && styles.pressed]} onPress={shareCode}>
              <Text style={styles.codeText}>{friendCode}</Text>
              <View style={styles.copyBtn}>
                <Text style={styles.copyBtnText}>{t('friends.share')}</Text>
              </View>
            </Pressable>
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
                      {req.profile?.companionId !== undefined ? (
                        <Image
                          source={getCompanionImage(req.profile.companionId, req.profile.skinId)}
                          style={styles.friendAvatarImg}
                          contentFit="contain"
                        />
                      ) : (
                        <Text style={styles.friendAvatarText}>{(req.fromCode[0] ?? '?').toUpperCase()}</Text>
                      )}
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
                <Text style={styles.emptyEmoji}>🧁</Text>
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
                          {f.companionId !== undefined ? (
                            <Image
                              source={getCompanionImage(f.companionId, f.skinId)}
                              style={styles.friendAvatarImg}
                              contentFit="contain"
                            />
                          ) : (
                            <Text style={styles.friendAvatarText}>{(f.code[0] ?? '?').toUpperCase()}</Text>
                          )}
                        </View>
                        <View style={[styles.statusDot, onlineCodes.has(f.code) ? styles.statusOnline : styles.statusOffline]} />
                      </View>
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>{f.displayName || f.name}</Text>
                        <Text style={styles.friendCode}>{onlineCodes.has(f.code) ? t('friends.onlineNow') : f.code}</Text>
                      </View>
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
  copyBtn: { backgroundColor: P.pink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  copyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
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
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '800', color: P.brown },
  friendCode: { fontSize: 12, color: P.mutedBrown, letterSpacing: 1 },
  friendRemove: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  friendRemoveText: { fontSize: 14, color: P.mutedBrown, fontWeight: '700' },
  acceptBtn: { backgroundColor: P.pink, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  acceptBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  playBtn: { backgroundColor: P.peach, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  playBtnText: { color: P.brown, fontWeight: '800', fontSize: 13 },

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
    backgroundColor: P.button,
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

  pressed: { opacity: 0.85 },
});
