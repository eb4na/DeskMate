import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { bunAvatarNudge, getCompanionImage } from '@/lib/companion-utils';
import { joinPresence, newRoomId, sendInvite, type OnlineGameId } from '@/lib/game-net';
import { acceptGameInvite, hostGameInvite } from '@/lib/invite-actions';
import {
  DM_MAX_LENGTH,
  fetchConversation,
  markConversationRead,
  resolveUserId,
  sendDm,
  subscribeConversation,
  type DmMessage,
} from '@/lib/direct-messages';
import { useStudyRoom } from '@/lib/use-study-room';
import i18n, { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, MaxContentWidth, Spacing } from '@/constants/theme';

const C = BakeryColors;

// Games (plus Study) that can be invited to from a chat.
const INVITE_OPTIONS: { id: OnlineGameId; nameKey: string; emoji: string }[] = [
  { id: 'study', nameKey: 'friends.game_study', emoji: '' },
  { id: 'connect4', nameKey: 'friends.game_connect4', emoji: '' },
  { id: 'tictactoe', nameKey: 'friends.game_tictactoe', emoji: '' },
  { id: 'memory', nameKey: 'friends.game_memory', emoji: '' },
  { id: 'batterdash', nameKey: 'friends.game_batterdash', emoji: '' },
];

const GAME_LABEL_KEY: Record<OnlineGameId, string> = {
  connect4: 'friends.game_connect4',
  tictactoe: 'friends.game_tictactoe',
  memory: 'friends.game_memory',
  batterdash: 'friends.game_batterdash',
  study: 'friends.game_study',
};

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M15 5 L8 12 L15 19" stroke={C.cocoaDark} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function SendIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M3 11 L21 3 L13.5 21 L11 13 Z" fill="#FFFFFF" strokeLinejoin="round" />
    </Svg>
  );
}

function formatTime(at?: string) {
  if (!at) return '';
  try {
    return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

// A full date label for the day-separator rows (e.g. "Jun 11, 2026").
function formatDate(at?: string) {
  if (!at) return '';
  try {
    return new Date(at).toLocaleDateString(i18n.language || undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

// Local YYYY-MM-DD key so we can tell when the calendar day changes.
function dayKey(at?: string) {
  if (!at) return '';
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function DmChatScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { friends, friendCode, profileDisplayName, clearDmUnread } = useApp();
  const { user } = useAuth();
  const studyRoom = useStudyRoom();

  const friend = friends.find((f) => f.code === code);
  const friendName = friend?.displayName || friend?.name || t('friendCard.friendFallback', { code });
  const myName = profileDisplayName || t('friendCard.friendFallback', { code: friendCode });

  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [input, setInput] = useState('');
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToEnd = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  // Online presence dot for this friend.
  useEffect(() => {
    if (!friendCode || !code) return;
    return joinPresence(friendCode, (codes) => setOnline(codes.has(code.toUpperCase())));
  }, [friendCode, code]);

  // Load history, mark read, and subscribe for live messages.
  useEffect(() => {
    if (!user?.id || !code) return;
    let unsub: (() => void) | undefined;
    let active = true;
    clearDmUnread(code);
    (async () => {
      const otherId = await resolveUserId(code, user.id);
      if (!active) return;
      setOtherUserId(otherId);
      if (otherId) {
        const history = await fetchConversation(user.id, otherId);
        if (!active) return;
        setMessages(history);
        scrollToEnd();
        await markConversationRead(user.id, otherId);
      }
    })();
    unsub = subscribeConversation(friendCode, code, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      scrollToEnd();
      clearDmUnread(code);
      if (user?.id && otherUserId) markConversationRead(user.id, otherUserId);
    });
    return () => {
      active = false;
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, code, friendCode]);

  const append = (m: DmMessage | null) => {
    if (!m) return;
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    scrollToEnd();
  };

  // Resolve (or re-resolve) the friend's user id, surfacing a clear reason if we
  // can't reach them yet (they've never synced a profile to the server).
  const ensureOtherId = async (): Promise<string | null> => {
    if (otherUserId) return otherUserId;
    if (!code || !user?.id) return null;
    const id = await resolveUserId(code, user.id);
    if (id) setOtherUserId(id);
    return id;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    if (!user?.id) {
      Alert.alert(t('dm.sendFailed'), t('dm.signInNeeded'));
      return;
    }
    const otherId = await ensureOtherId();
    if (!otherId) {
      Alert.alert(t('dm.sendFailed'), t('dm.friendNotReachable', { name: friendName }));
      return;
    }
    setInput('');
    const res = await sendDm({
      fromUser: user.id,
      fromCode: friendCode,
      toUser: otherId,
      toCode: code!,
      kind: 'text',
      body: text,
    });
    if (!res.ok) {
      setInput(text);
      Alert.alert(t('dm.sendFailed'), res.error);
      return;
    }
    append(res.msg);
  };

  const sendGameInvite = async (game: OnlineGameId) => {
    setSheetOpen(false);
    if (!user?.id) {
      Alert.alert(t('dm.sendFailed'), t('dm.signInNeeded'));
      return;
    }
    const otherId = await ensureOtherId();
    if (!otherId || !code) {
      Alert.alert(t('dm.sendFailed'), t('dm.friendNotReachable', { name: friendName }));
      return;
    }
    const room = newRoomId();
    // Realtime popup for the friend (works even if they're not in the chat).
    sendInvite(code, { game, room, fromCode: friendCode, fromName: myName });
    // Persistent invite card in the conversation.
    const res = await sendDm({
      fromUser: user.id,
      fromCode: friendCode,
      toUser: otherId,
      toCode: code,
      kind: 'invite',
      invite: { game, room },
    });
    if (!res.ok) {
      Alert.alert(t('dm.sendFailed'), res.error);
      return;
    }
    // Enter the room as host.
    hostGameInvite(game, room, studyRoom);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBtn}>
            <BackIcon />
          </Pressable>
          <View style={styles.headerCenter}>
            <View style={styles.headerAvatar}>
              <Image source={getCompanionImage(friend?.companionId, friend?.skinId)} style={[styles.headerAvatarImg, bunAvatarNudge(friend?.companionId)]} contentFit="contain" />
            </View>
            <View>
              <Text style={styles.headerTitle} numberOfLines={1}>{friendName}</Text>
              <View style={styles.statusRow}>
                {online && <View style={styles.onlineDot} />}
                <Text style={[styles.statusText, online && styles.statusOnline]}>
                  {online ? t('dm.online') : t('dm.offline')}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerBtn} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.thread}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}>
            {messages.length === 0 && (
              <Text style={styles.empty}>{t('dm.empty', { name: friendName })}</Text>
            )}

            {messages.map((m, i) => {
              const mine = m.fromCode === friendCode.toUpperCase() || m.fromCode === friendCode;
              // Show a date divider when the calendar day changes (and before the first message).
              const showDate = i === 0 || dayKey(m.createdAt) !== dayKey(messages[i - 1]?.createdAt);
              const divider = showDate && (
                <View style={styles.dateDivider}>
                  <Text style={styles.dateDividerText}>{formatDate(m.createdAt)}</Text>
                </View>
              );

              if (m.kind === 'invite' && m.invite) {
                const gameLabel = t(GAME_LABEL_KEY[m.invite.game]);
                return (
                  <View key={m.id}>
                    {divider}
                    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
                      <View style={[styles.inviteCard, mine ? styles.inviteCardMine : styles.inviteCardTheirs]}>
                        <Text style={styles.inviteTitle}>
                          {mine ? t('dm.sentInvite', { game: gameLabel }) : t('dm.invitedYou', { game: gameLabel })}
                        </Text>
                        {!mine && (
                          <Pressable
                            style={({ pressed }) => [styles.joinBtn, pressed && styles.pressed]}
                            onPress={() => acceptGameInvite({ ...m.invite!, fromCode: m.fromCode, fromName: friendName }, studyRoom)}>
                            <Text style={styles.joinBtnText}>{t('dm.join')}</Text>
                          </Pressable>
                        )}
                        {!!m.createdAt && <Text style={styles.timestamp}>{formatTime(m.createdAt)}</Text>}
                      </View>
                    </View>
                  </View>
                );
              }
              return (
                <View key={m.id}>
                  {divider}
                  <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
                    <View style={[styles.msgCol, mine && styles.msgColMine]}>
                      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                        <Text style={mine ? styles.bubbleMineText : styles.bubbleTheirsText}>{m.body}</Text>
                      </View>
                      {!!m.createdAt && <Text style={styles.timestamp}>{formatTime(m.createdAt)}</Text>}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Composer */}
          <View style={styles.composer}>
            <Pressable onPress={() => setSheetOpen(true)} hitSlop={8} style={({ pressed }) => [styles.inviteBtn, pressed && styles.pressed]}>
              <Text style={styles.inviteBtnText}>＋</Text>
            </Pressable>
            <View style={styles.inputPill}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder={t('dm.placeholder', { name: friendName })}
                placeholderTextColor={C.latte}
                multiline
                maxLength={DM_MAX_LENGTH}
                onSubmitEditing={handleSend}
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={!input.trim()}
              style={({ pressed }) => [styles.sendBtn, !input.trim() && styles.sendBtnDisabled, pressed && styles.pressed]}>
              <SendIcon />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Invite picker sheet */}
      <Modal visible={sheetOpen} transparent animationType="fade" onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setSheetOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('dm.invitePrompt', { name: friendName })}</Text>
            {INVITE_OPTIONS
              // Multiplayer study needs the friend live in the room — only offer it
              // when they're online; the games can still be invited to anytime.
              .filter((g) => g.id !== 'study' || online)
              .map((g) => (
              <Pressable
                key={g.id}
                style={({ pressed }) => [styles.sheetRow, pressed && styles.pressed]}
                onPress={() => sendGameInvite(g.id)}>
                <Text style={styles.sheetEmoji}>{g.emoji}</Text>
                <Text style={styles.sheetRowText}>{t(g.nameKey)}</Text>
              </Pressable>
            ))}
            <Pressable style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]} onPress={() => setSheetOpen(false)}>
              <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7E7D3' },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: C.frosting },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, justifyContent: 'center' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: C.shortbread, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.butter },
  headerAvatarImg: { position: 'absolute', width: 64, height: 64, top: -2 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.cocoaDark, maxWidth: 180 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.success },
  statusText: { fontSize: 12, color: C.mocha, fontWeight: '600' },
  statusOnline: { color: C.success, fontWeight: '700' },

  thread: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  empty: { textAlign: 'center', color: C.mocha, fontSize: 13, marginTop: Spacing.five, paddingHorizontal: Spacing.four, lineHeight: 19 },

  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  msgCol: { maxWidth: '78%', gap: 2 },
  msgColMine: { alignItems: 'flex-end' },
  bubble: { borderRadius: 18, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  bubbleTheirs: { backgroundColor: C.frosting, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: C.shortbread },
  bubbleMine: { backgroundColor: C.jam, borderBottomRightRadius: 5 },
  bubbleTheirsText: { color: C.cocoa, fontSize: 14, lineHeight: 19 },
  bubbleMineText: { color: '#FFFFFF', fontSize: 14, lineHeight: 19 },
  timestamp: { fontSize: 10, color: C.latte, marginHorizontal: 6 },
  dateDivider: { alignItems: 'center', paddingVertical: Spacing.two },
  dateDividerText: {
    fontSize: 11, fontWeight: '700', color: C.mocha,
    backgroundColor: `${C.shortbread}99`, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
    overflow: 'hidden',
  },

  inviteCard: { maxWidth: '82%', borderRadius: 18, padding: Spacing.three, gap: Spacing.two, borderWidth: 1.5 },
  inviteCardMine: { backgroundColor: `${C.jam}22`, borderColor: C.jam, borderBottomRightRadius: 5 },
  inviteCardTheirs: { backgroundColor: C.frosting, borderColor: C.shortbread, borderBottomLeftRadius: 5 },
  inviteTitle: { fontSize: 14, fontWeight: '800', color: C.cocoaDark },
  joinBtn: { backgroundColor: C.jam, borderRadius: BakeryRadii.pill, paddingVertical: 9, alignItems: 'center' },
  joinBtnText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.one },
  inviteBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: C.frosting, borderWidth: 1.5, borderColor: C.shortbread },
  inviteBtnText: { fontSize: 24, fontWeight: '800', color: C.berry, marginTop: -2 },
  inputPill: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.three, paddingVertical: Platform.OS === 'ios' ? 10 : 4, borderRadius: 24, backgroundColor: C.frosting, borderWidth: 1.5, borderColor: C.shortbread },
  input: { flex: 1, fontSize: 15, maxHeight: 110, paddingVertical: 0, color: C.cocoaDark },
  sendBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: C.jam, borderWidth: 2, borderColor: '#E68299' },
  sendBtnDisabled: { opacity: 0.45 },

  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(48,32,24,0.4)' },
  sheet: { backgroundColor: C.frosting, borderTopLeftRadius: BakeryRadii.panel, borderTopRightRadius: BakeryRadii.panel, padding: Spacing.four, gap: Spacing.two },
  sheetTitle: { fontSize: 16, fontWeight: '900', color: C.cocoaDark, marginBottom: Spacing.one },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: 12, paddingHorizontal: Spacing.three, borderRadius: BakeryRadii.card, backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.shortbread },
  sheetEmoji: { fontSize: 22 },
  sheetRowText: { fontSize: 15, fontWeight: '800', color: C.cocoaDark },
  sheetCancel: { paddingVertical: 12, alignItems: 'center', marginTop: Spacing.one },
  sheetCancelText: { fontSize: 15, fontWeight: '800', color: C.mocha },

  pressed: { opacity: 0.85 },
});
