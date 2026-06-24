import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { GoogleGIcon, AppleLogoIcon, MailIcon } from '@/components/auth-icons';
import { useApp } from '@/context/app-context';
import type { Friend } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { getCompanionImage, resolveProfileFigure } from '@/lib/companion-utils';
import { joinPresence, newRoomId, sendInvite, type OnlineGameId, type PresenceMap } from '@/lib/game-net';
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
import { fetchSuggestedPlayers, type SuggestedPlayer } from '@/lib/suggestions';
import { isPlusFrame } from '@/components/avatar-frame';
import { cardColors } from '@/constants/card-colors';
import { ROOM_PAIRS } from '@/constants/room-data';
import { useTranslation } from '@/i18n';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTabletScale } from '@/hooks/use-tablet-scale';

function toFriendPatch(p: SyncedProfile): Partial<Friend> {
  return {
    displayName: p.displayName || undefined,
    companionId: p.companionId,
    skinId: p.skinId,
    backgroundId: p.backgroundId,
    avatarFrame: p.avatarFrame,
    cardColor: p.cardColor,
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
  blue: '#9CC2E8',
} as const;

// Fancy gold-bordered card shown behind a Plus friend's row (replaces the plain
// white/pink card). Transparent PNG → the row background is set transparent.
const PLUS_CARD = require('@/assets/images/friends/plus-card.png');

const INVITE_GAMES: { id: OnlineGameId; nameKey: string; emoji: string }[] = [
  { id: 'connect4', nameKey: 'friends.game_connect4', emoji: '' },
  { id: 'tictactoe', nameKey: 'friends.game_tictactoe', emoji: '' },
];

export default function FriendsScreen() {
  const { t } = useTranslation();
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const {
    friendCode, friends: rawFriends, addFriend, removeFriend, setFriendProfile, profileDisplayName, dmUnread,
    activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins,
    profileAvatarFrame, profileCompanionId, profileSkinId, profileCardColor, profileBackgroundId, isPlus,
  } = useApp();
  const friends = rawFriends.filter((f, i, arr) => arr.findIndex((x) => x.code === f.code) === i);
  // My friend-list avatar = the character I pinned on my Profile card, NOT whoever
  // I'm currently using. Only falls back to the active companion if I've never set
  // a card pick (profileCompanionId === '').
  const meSource = resolveProfileFigure({
    profileCompanionId, profileSkinId,
    activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins,
  });
  const { user, isGuest, upgradeGuest, upgradeGuestEmail } = useAuth();
  const studyRoom = useStudyRoom();
  const [input, setInput] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedPlayer[]>([]);
  const [requestedCodes, setRequestedCodes] = useState<string[]>([]); // suggestions I've just requested
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null); // shows the "request sent" confirmation
  const [playFor, setPlayFor] = useState<Friend | null>(null);
  const [onlineCodes, setOnlineCodes] = useState<PresenceMap>(new Map());
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');

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
    const [accepted, reqs, blk, suggested] = await Promise.all([
      listAcceptedFriends(user.id),
      listIncomingRequests(user.id),
      listBlocked(user.id),
      fetchSuggestedPlayers(),
    ]);
    setBlocked(blk);
    for (const a of accepted) {
      if (blk.includes(a.code)) continue; // never re-add a blocked person
      addFriend(a.code); // no-op if already a friend
      if (a.profile) setFriendProfile(a.code, toFriendPatch(a.profile));
    }
    setIncoming(reqs.filter((r) => !blk.includes(r.fromCode))); // hide blocked senders
    // Server already excludes friends/requests/blocked; also drop anyone I've already
    // requested this session so a card never lingers after I tapped Add.
    setSuggestions(suggested.filter((s) => !blk.includes(s.friendCode)));
  };

  // Send a friend request straight from a suggestion card. Mark it requested so the
  // card flips to "Sent" instead of vanishing (less jarring than a list reflow).
  const handleSuggestAdd = async (player: SuggestedPlayer) => {
    if (!user?.id) {
      showPopup(t('friends.signInNeeded'), t('friends.signInToSend'));
      return;
    }
    setRequestedCodes((prev) => (prev.includes(player.friendCode) ? prev : [...prev, player.friendCode]));
    const res = await sendFriendRequest({ fromUser: user.id, fromCode: friendCode, toCode: player.friendCode });
    if (!res.ok) {
      setRequestedCodes((prev) => prev.filter((c) => c !== player.friendCode)); // let them retry
      showPopup(t('friends.couldNotSend'), res.error ?? t('friends.tryAgain'));
    }
  };

  // Re-fetch incoming requests and friend profiles every time this screen is opened
  // so avatars are never stale when someone changed their companion since last visit.
  useFocusEffect(
    useCallback(() => {
      refresh();
      friends.forEach(async (f) => {
        const p = await fetchProfileByCode(f.code);
        if (p) setFriendProfile(f.code, toFriendPatch(p));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]),
  );

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
  const handleUpgrade = async (provider: 'google' | 'apple') => {
    setUpgrading(true);
    const res = await upgradeGuest(provider);
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
              onPress={() => handleUpgrade('google')}
              style={({ pressed }) => [styles.gateGoogleBtn, pressed && styles.pressed, upgrading && styles.gateBtnDisabled]}>
              <GoogleGIcon size={20 * scale} />
              <Text style={styles.gateGoogleText}>{t('auth.continueWithGoogle')}</Text>
            </Pressable>
            <Pressable
              disabled={upgrading}
              onPress={() => handleUpgrade('apple')}
              style={({ pressed }) => [styles.gateGoogleBtn, pressed && styles.pressed, upgrading && styles.gateBtnDisabled]}>
              <AppleLogoIcon size={20 * scale} />
              <Text style={styles.gateGoogleText}>{t('auth.continueWithApple')}</Text>
            </Pressable>
            <Pressable
              disabled={upgrading}
              onPress={async () => {
                await upgradeGuestEmail();
                router.push('/signup');
              }}
              style={({ pressed }) => [styles.gateGoogleBtn, pressed && styles.pressed, upgrading && styles.gateBtnDisabled]}>
              <MailIcon size={20 * scale} />
              <Text style={styles.gateGoogleText}>{t('auth.continueWithEmail')}</Text>
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
      <View style={styles.dragHandleArea} pointerEvents="none">
        <View style={styles.dragHandle} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: P.cream }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await Promise.all([
                refresh(),
                ...friends.map(async (f) => {
                  const p = await fetchProfileByCode(f.code);
                  if (p) setFriendProfile(f.code, toFriendPatch(p));
                }),
              ]);
              setRefreshing(false);
            }}
            tintColor={P.pink}
          />
        }
      >
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.headerPanel}>
            <Text style={styles.headerTitle}>{t('friends.studyFriends')}</Text>
            <Text style={styles.headerSubtitle}>{t('friends.addAndStudy')}</Text>
          </View>

          {/* Suggested players — a random sample of others your age you can friend.
              Hidden entirely when there are none (e.g. RPC not deployed yet) so it
              never shows a broken/empty shell. */}
          {suggestions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('suggestions.title')}</Text>
              <Text style={styles.suggestSub}>{t('suggestions.sub')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestRow}>
                {suggestions.map((s) => {
                  const sBg = ROOM_PAIRS.find((r) => r.id === s.backgroundId) ?? ROOM_PAIRS[0];
                  const sent = requestedCodes.includes(s.friendCode);
                  return (
                    <View key={s.friendCode} style={styles.suggestCard}>
                      <View style={styles.miniCard}>
                        <Image source={sBg.backgroundImage} style={StyleSheet.absoluteFill} contentFit="cover" />
                        <Image source={getCompanionImage(s.companionId, s.skinId)} style={styles.miniCardFig} contentFit="contain" />
                      </View>
                      <Text style={styles.suggestName} numberOfLines={1}>
                        {s.displayName || t('friendCard.friendFallback', { code: s.friendCode })}
                      </Text>
                      <Text style={styles.friendCode}>{s.friendCode}</Text>
                      <Pressable
                        disabled={sent}
                        style={({ pressed }) => [styles.suggestAddBtn, sent && styles.suggestAddedBtn, pressed && !sent && styles.pressed]}
                        onPress={() => handleSuggestAdd(s)}>
                        <Text style={[styles.suggestAddText, sent && styles.suggestAddedText]}>
                          {sent ? t('suggestions.sent') : t('suggestions.add')}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* My profile card — my avatar, name, and code, the way friends see me. */}
          {(() => {
            const myCC = isPlus && isPlusFrame(profileAvatarFrame) ? cardColors(profileCardColor) : null;
            return (
              <Pressable
                style={({ pressed }) => [
                  styles.friendRow, styles.meRow,
                  myCC && { borderColor: myCC.strip },
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push('/profile')}>
                {(() => {
                  const myBg = ROOM_PAIRS.find((r) => r.id === profileBackgroundId) ?? ROOM_PAIRS[0];
                  return (
                    <View style={[styles.miniCard, myCC && { borderColor: myCC.strip }]}>
                      <Image source={myBg.backgroundImage} style={StyleSheet.absoluteFill} contentFit="cover" />
                      <Image source={meSource} style={styles.miniCardFig} contentFit="contain" />
                    </View>
                  );
                })()}
                <View style={styles.friendInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.friendName}>{profileDisplayName || t('friends.you')}</Text>
                  </View>
                  <Text style={styles.friendCode}>{friendCode}</Text>
                </View>
                <View style={[styles.meTag, myCC && { backgroundColor: myCC.strip }]}>
                  <Text style={styles.meTagText}>{t('friends.you')}</Text>
                </View>
                <Text style={styles.profileBtnChevron}>›</Text>
              </Pressable>
            );
          })()}

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
                {incoming.map((req) => {
                  const rCC = isPlusFrame(req.profile?.avatarFrame) ? cardColors(req.profile?.cardColor) : null;
                  return (
                    <View key={req.id} style={[styles.friendRow, rCC && { borderColor: rCC.strip }]}>
                      {(() => {
                        const reqBg = ROOM_PAIRS.find((r) => r.id === req.profile?.backgroundId) ?? ROOM_PAIRS[0];
                        return (
                          <View style={[styles.miniCard, rCC && { borderColor: rCC.strip }]}>
                            <Image source={reqBg.backgroundImage} style={StyleSheet.absoluteFill} contentFit="cover" />
                            <Image source={getCompanionImage(req.profile?.companionId, req.profile?.skinId)} style={styles.miniCardFig} contentFit="contain" />
                          </View>
                        );
                      })()}
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
                  );
                })}
              </View>
            </View>
          )}

          {/* Friends list */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('friends.myFriends', { count: friends.length })}</Text>
            {friends.length > 0 && (
              <TextInput
                style={styles.friendSearchInput}
                placeholder={t('friends.searchFriends', { defaultValue: 'Search friends…' })}
                placeholderTextColor={P.mutedBrown}
                value={friendSearch}
                onChangeText={setFriendSearch}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            )}
            {friends.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}></Text>
                <Text style={styles.emptyTitle}>{t('friends.noFriendsYet')}</Text>
                <Text style={styles.emptyText}>{t('friends.noFriendsHint')}</Text>
              </View>
            ) : (
              <View style={styles.friendList}>
                {friends.filter((f) => {
                  if (!friendSearch.trim()) return true;
                  const q = friendSearch.trim().toLowerCase();
                  const name = (f.displayName || f.code).toLowerCase();
                  return name.includes(q) || f.code.toLowerCase().includes(q);
                }).map((f) => {
                  const fCC = isPlusFrame(f.avatarFrame) ? cardColors(f.cardColor) : null;
                  const fBgRoom = ROOM_PAIRS.find((r) => r.id === f.backgroundId) ?? ROOM_PAIRS[0];
                  return (
                    <View key={f.code} style={[styles.friendRow, fCC && { borderColor: fCC.strip }]}>
                      <Pressable
                        style={({ pressed }) => [styles.friendTap, pressed && styles.pressed]}
                        onPress={() => router.push({ pathname: '/friend-card', params: { code: f.code } })}>
                        <View style={[styles.miniCard, fCC && { borderColor: fCC.strip }]}>
                          <Image source={fBgRoom.backgroundImage} style={StyleSheet.absoluteFill} contentFit="cover" />
                          <Image source={getCompanionImage(f.companionId, f.skinId)} style={styles.miniCardFig} contentFit="contain" />
                          <View style={[styles.statusDot, onlineCodes.has(f.code) ? styles.statusOnline : styles.statusOffline]} />
                        </View>
                        <View style={styles.friendInfo}>
                          <View style={styles.nameRow}>
                            <Text style={styles.friendName}>{f.displayName || f.name}</Text>
                          </View>
                          <Text style={styles.friendCode}>{onlineCodes.has(f.code) ? t('friends.onlineNow') : f.code}</Text>
                        </View>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.chatBtn, fCC && { backgroundColor: fCC.strip }, pressed && styles.pressed]}
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
                  );
                })}
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

const makeStyles = (s: number, contentWidth: number) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    padding: Spacing.four * s,
    maxWidth: contentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four * s,
    backgroundColor: P.cream,
  },
  headerPanel: {
    backgroundColor: P.card,
    borderRadius: 26 * s,
    paddingVertical: Spacing.four * s,
    paddingHorizontal: Spacing.four * s,
    borderWidth: 1.5,
    borderColor: P.peach,
    alignItems: 'center',
    gap: 4 * s,
    shadowColor: '#C9A18A',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  headerTitle: { fontSize: 22 * s, fontWeight: '800', color: P.brown, letterSpacing: 0.2 },
  headerSubtitle: { fontSize: 13 * s, color: P.mutedBrown, fontWeight: '500' },

  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: P.pinkSoft,
    borderRadius: 18 * s,
    borderWidth: 1.5,
    borderColor: P.pink,
    paddingVertical: 14 * s,
    paddingHorizontal: 18 * s,
  },
  profileBtnText: { fontSize: 16 * s, fontWeight: '800', color: P.brown },
  profileBtnChevron: { fontSize: 22 * s, fontWeight: '800', color: P.pink },
  meRow: { borderColor: P.pink, borderWidth: 2 },
  suggestSub: { fontSize: 12 * s, color: P.mutedBrown, fontWeight: '500', marginTop: -2 * s },
  suggestRow: { gap: 12 * s, paddingVertical: 4 * s, paddingRight: 8 * s },
  suggestCard: { width: 72 * s, alignItems: 'center', gap: 3 * s },
  suggestName: { fontSize: 12 * s, fontWeight: '800', color: P.brown, textAlign: 'center', maxWidth: 72 * s },
  suggestAddBtn: { backgroundColor: P.pink, borderRadius: 999, paddingHorizontal: 16 * s, paddingVertical: 6 * s, marginTop: 2 * s },
  suggestAddText: { color: '#fff', fontWeight: '800', fontSize: 12 * s },
  suggestAddedBtn: { backgroundColor: P.pinkSoft },
  suggestAddedText: { color: P.mutedBrown },
  meTag: { backgroundColor: P.pink, borderRadius: 999, paddingHorizontal: 12 * s, paddingVertical: 5 * s },
  meTagText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 * s },

  section: { gap: Spacing.two * s },
  sectionTitle: { fontSize: 16 * s, fontWeight: '800', color: P.brown },

  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: P.card,
    borderRadius: 18 * s,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    paddingVertical: 14 * s,
    paddingHorizontal: 18 * s,
  },
  codeText: { fontSize: 26 * s, fontWeight: '900', letterSpacing: 4, color: P.brown },
  codeBtnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s },
  copyBtn: { backgroundColor: P.pink, borderRadius: 999, paddingHorizontal: 16 * s, paddingVertical: 7 * s },
  copyBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 * s },
  shareBtn: {
    backgroundColor: P.card,
    borderRadius: 999,
    paddingHorizontal: 16 * s,
    paddingVertical: 7 * s,
    borderWidth: 1.5,
    borderColor: P.pink,
  },
  shareBtnText: { color: P.pink, fontWeight: '800', fontSize: 13 * s },
  codeHint: { fontSize: 12 * s, color: P.mutedBrown, textAlign: 'center' },

  addRow: { flexDirection: 'row', gap: Spacing.two * s },
  addInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: P.peach,
    borderRadius: 14 * s,
    paddingHorizontal: 14 * s,
    paddingVertical: 11 * s,
    fontSize: 16 * s,
    fontWeight: '700',
    letterSpacing: 2,
    color: P.brown,
    backgroundColor: P.card,
  },
  addBtn: {
    backgroundColor: P.pink,
    borderRadius: 14 * s,
    paddingHorizontal: 22 * s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 * s },

  friendList: { gap: Spacing.two * s },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
    backgroundColor: P.card,
    borderRadius: 16 * s,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
    padding: Spacing.two * s,
  },
  miniCard: {
    width: 58 * s, height: 80 * s, borderRadius: 12 * s, overflow: 'hidden',
    borderWidth: 2, borderColor: P.pinkSoft, backgroundColor: P.pinkSoft,
    alignItems: 'center', justifyContent: 'flex-end',
  },
  miniCardFig: { width: '130%', height: '95%', marginBottom: -4 },
  // Plus friend: drop the white card + pink border; the gold PLUS_CARD image fills
  // behind the row instead. Keep padding/radius so the content still sits inset.
  friendRowPlus: { backgroundColor: 'transparent', borderColor: 'transparent' },
  friendRowPlusBg: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  friendTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s },
  statusDot: {
    position: 'absolute', right: 4 * s, bottom: 4 * s, width: 11 * s, height: 11 * s, borderRadius: 6 * s,
    borderWidth: 2, borderColor: P.pinkSoft,
  },
  statusOnline: { backgroundColor: '#5BC47B' },
  statusOffline: { backgroundColor: '#C9BBA8' },
  // marginLeft clears the enlarged avatar frame's right overhang (FRAME_SCALE 1.35
  // on a 44px avatar ≈ 7.7px past the avatarWrap) so the name/code never sits under it.
  friendInfo: { flex: 1, marginLeft: 6 * s },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 * s },
  friendName: { fontSize: 15 * s, fontWeight: '800', color: P.brown },
  friendCode: { fontSize: 12 * s, color: P.mutedBrown, letterSpacing: 1 },
  friendRemove: { width: 30 * s, height: 30 * s, borderRadius: 15 * s, alignItems: 'center', justifyContent: 'center' },
  friendRemoveText: { fontSize: 14 * s, color: P.mutedBrown, fontWeight: '700' },
  acceptBtn: { backgroundColor: P.pink, borderRadius: 999, paddingHorizontal: 14 * s, paddingVertical: 7 * s },
  acceptBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 * s },
  playBtn: { backgroundColor: P.peach, borderRadius: 999, paddingHorizontal: 14 * s, paddingVertical: 7 * s },
  playBtnText: { color: P.brown, fontWeight: '800', fontSize: 13 * s },
  chatBtn: { backgroundColor: P.pink, borderRadius: 999, paddingHorizontal: 14 * s, paddingVertical: 7 * s },
  chatBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 * s },
  unreadBadge: {
    position: 'absolute', top: -5, right: -5, minWidth: 18 * s, height: 18 * s, borderRadius: 9 * s,
    backgroundColor: P.brown, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 * s,
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 10 * s, fontWeight: '900' },

  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  sheetCard: {
    backgroundColor: P.card,
    borderTopLeftRadius: 26 * s,
    borderTopRightRadius: 26 * s,
    padding: Spacing.four * s,
    gap: Spacing.two * s,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
  },
  sheetTitle: { fontSize: 17 * s, fontWeight: '900', color: P.brown, marginBottom: 4 * s },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12 * s,
    backgroundColor: P.cream,
    borderRadius: 16 * s,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
    paddingVertical: 14 * s,
    paddingHorizontal: 16 * s,
  },
  sheetEmoji: { fontSize: 22 * s },
  sheetItemText: { flex: 1, fontSize: 16 * s, fontWeight: '800', color: P.brown },
  sheetChevron: { fontSize: 22 * s, fontWeight: '800', color: P.pink },
  sheetCancel: { alignItems: 'center', paddingVertical: 12 * s, marginTop: 4 * s },
  sheetCancelText: { color: P.mutedBrown, fontWeight: '800', fontSize: 15 * s },

  // "Request sent" confirmation modal — centered cozy card.
  sentRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  sentBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  sentCard: {
    width: '100%', maxWidth: 320 * s, backgroundColor: P.card, borderRadius: 26 * s,
    borderWidth: 1.5, borderColor: P.pinkSoft, padding: Spacing.four * s, alignItems: 'center', gap: Spacing.two * s,
  },
  sentCheck: {
    width: 64 * s, height: 64 * s, borderRadius: 32 * s, backgroundColor: P.pink,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2 * s,
  },
  sentCheckMark: { color: '#fff', fontSize: 34 * s, fontWeight: '900', lineHeight: 38 * s },
  sentTitle: { fontSize: 19 * s, fontWeight: '900', color: P.brown, textAlign: 'center' },
  sentMsg: { fontSize: 13 * s, color: P.mutedBrown, textAlign: 'center', lineHeight: 18 * s },
  sentCodePill: {
    backgroundColor: P.cream, borderRadius: 999, borderWidth: 1.5, borderColor: P.pinkSoft,
    paddingHorizontal: 18 * s, paddingVertical: 8 * s, marginTop: 2 * s,
  },
  sentCode: { fontSize: 18 * s, fontWeight: '900', color: P.pink, letterSpacing: 2 },
  sentDone: {
    alignSelf: 'stretch', alignItems: 'center', backgroundColor: P.pink,
    borderRadius: 16 * s, paddingVertical: 13 * s, marginTop: Spacing.one * s,
  },
  sentDoneText: { color: '#fff', fontSize: 16 * s, fontWeight: '900' },

  dragHandleArea: { alignItems: 'center', paddingTop: 10 * s, paddingBottom: 2 * s },
  dragHandle: { width: 36 * s, height: 4 * s, borderRadius: 2 * s, backgroundColor: 'rgba(91,58,46,0.18)' },
  friendSearchInput: {
    backgroundColor: P.card,
    borderRadius: 14 * s,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
    paddingHorizontal: 14 * s,
    paddingVertical: 10 * s,
    fontSize: 14 * s,
    color: P.brown,
    marginBottom: 10 * s,
  },

  emptyCard: {
    backgroundColor: P.card,
    borderRadius: 22 * s,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
    paddingVertical: 28 * s,
    alignItems: 'center',
    gap: 6 * s,
  },
  emptyEmoji: { fontSize: 40 * s },
  emptyTitle: { fontSize: 16 * s, fontWeight: '800', color: P.brown },
  emptyText: { fontSize: 13 * s, color: P.mutedBrown, textAlign: 'center' },

  infoCard: {
    backgroundColor: P.pinkSoft,
    borderRadius: 18 * s,
    padding: Spacing.three * s,
    borderWidth: 1.5,
    borderColor: P.pink,
  },
  infoText: { fontSize: 12.5 * s, color: P.brown, textAlign: 'center', lineHeight: 18 * s, fontWeight: '500' },

  doneButton: {
    backgroundColor: '#F7A7B8',
    borderRadius: 18 * s,
    paddingVertical: Spacing.three * s,
    alignItems: 'center',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  doneButtonText: { color: '#fff', fontSize: 17 * s, fontWeight: '800' },

  // Guest gate
  gateWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three * s, paddingHorizontal: Spacing.four * s },
  gateTitle: { fontSize: 22 * s, fontWeight: '900', color: P.brown, textAlign: 'center' },
  gateBody: { fontSize: 15 * s, color: P.mutedBrown, textAlign: 'center', lineHeight: 21 * s },
  gateGoogleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two * s,
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 18 * s,
    paddingVertical: Spacing.three * s,
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
    marginTop: Spacing.two * s,
  },
  gateGoogleText: { fontSize: 16 * s, fontWeight: '800', color: P.brown },
  gateBtnDisabled: { opacity: 0.6 },
  gateLater: { paddingVertical: Spacing.two * s },
  gateLaterText: { fontSize: 14 * s, fontWeight: '700', color: P.mutedBrown },

  pressed: { opacity: 0.85 },
});
