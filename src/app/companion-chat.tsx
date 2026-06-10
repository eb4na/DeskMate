import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { BakeryBreadEmoji } from '@/components/bakery-emoji';
import { CoinIcon } from '@/components/coin-icon';
import { CompanionAvatar } from '@/components/companion-avatar';
import { HomeTabIcon, ProgressTabIcon, ShopTabIcon, TasksTabIcon } from '@/components/tab-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  CHAT_HISTORY_CAP,
  PLUS_DAILY_CHAT,
  useApp,
  type ChatTurn,
} from '@/context/app-context';
import { sendCompanionChat } from '@/lib/companion-chat';
import { resolveActiveCompanion } from '@/lib/companion-utils';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, Colors, MaxContentWidth, Spacing } from '@/constants/theme';

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M15 5 L8 12 L15 19"
        stroke={BakeryColors.cocoaDark}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function HeartIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 21 C12 21 3 14.6 3 8.7 C3 5.7 5.2 3.6 7.9 3.6 C9.7 3.6 11.2 4.7 12 6.1 C12.8 4.7 14.3 3.6 16.1 3.6 C18.8 3.6 21 5.7 21 8.7 C21 14.6 12 21 12 21 Z"
        fill={BakeryColors.berry}
      />
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

function formatTime(at?: number) {
  if (!at) return '';
  try {
    return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function CompanionChatScreen() {
  const { t } = useTranslation();
  const {
    isPlus,
    coins,
    chatMessages,
    dailyChatRemaining,
    consumeChatMessage,
    chatThread,
    setChatThread,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
  } = useApp();

  const companion = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins);
  const vibe =
    companion.type === 'slot' ? companion.slot.personality || companion.slot.prompt || '' : '';
  const pfpFocus = companion.type === 'slot' ? companion.slot.pfp : undefined;
  const activeSlotId = companion.type === 'slot' ? companion.slot.id : null;
  const chatTotal = dailyChatRemaining + chatMessages;

  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // Seed from the cached thread so the conversation survives leaving/restarting.
  const [messages, setMessages] = useState<ChatTurn[]>(() => chatThread);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Keep the cached thread in sync with the visible conversation.
  useEffect(() => {
    setChatThread(messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const scrollToEnd = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const handleClear = () => {
    if (messages.length === 0) return;
    Alert.alert(
      t('chat.clearChatQ'),
      t('chat.clearChatMsg', { name: companion.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('chat.clear'), style: 'destructive', onPress: () => setMessages([]) },
      ],
    );
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    if (chatTotal <= 0) {
      Alert.alert(t('chat.outOfChats'), t('chat.outOfChatsMsg'));
      return;
    }

    const history: ChatTurn[] = [...messages, { role: 'user', content: text, at: Date.now() }];
    setMessages(history);
    setInput('');
    setIsSending(true);
    scrollToEnd();

    try {
      const { reply } = await sendCompanionChat({ companionName: companion.name, vibe, history });
      // Only charge a message once the companion actually replies.
      consumeChatMessage();
      setMessages((prev) => [...prev, { role: 'assistant', content: reply, at: Date.now() }]);
      scrollToEnd();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('chat.couldNotReply');
      Alert.alert(t('chat.chatHiccup'), t('chat.chatHiccupMsg', { message }));
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setIsSending(false);
    }
  };

  // ── Plus gate ────────────────────────────────────────────────────────────────
  if (!isPlus) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBtn}>
              <BackIcon />
            </Pressable>
            <ThemedText style={styles.headerTitle}>Chat Companion</ThemedText>
            <View style={styles.headerBtn} />
          </View>
          <View style={styles.lockedWrap}>
            <View style={styles.lockedCard}>
              <ThemedText type="subtitle">Companion chat is a Plus feature 🔒</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.lockedText}>
                Upgrade to DeskMate Plus to chat with your companion. Plus members get{' '}
                {PLUS_DAILY_CHAT} free chats every day.
              </ThemedText>
              <Pressable
                onPress={() => router.push('/plus-upgrade')}
                style={({ pressed }) => [styles.upgradeBtn, pressed && styles.pressed]}>
                <ThemedText style={styles.upgradeBtnText}>See Plus</ThemedText>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const outOfMessages = chatTotal <= 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerBtn}>
            <BackIcon />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Chat Companion</ThemedText>
          <View style={styles.coinPill}>
            <CoinIcon size={18} />
            <ThemedText style={styles.coinText}>{coins}</ThemedText>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
          {/* Faint room mascot, like the cozy background in the design */}
          <View pointerEvents="none" style={styles.bgMascot}>
            <BakeryBreadEmoji size={150} />
          </View>

          {/* Companion profile card */}
          <View style={styles.profileCard}>
            <Pressable
              disabled={!activeSlotId}
              onPress={() =>
                activeSlotId &&
                router.push({ pathname: '/companion-pfp', params: { slotId: activeSlotId } })
              }>
              <CompanionAvatar source={companion.imageSource} size={54} focus={pfpFocus} style={styles.profileAvatarRing} />
            </Pressable>
            <View style={styles.profileInfo}>
              <View style={styles.profileNameRow}>
                <ThemedText style={styles.profileName}>DeskMate</ThemedText>
                <HeartIcon />
              </View>
              <View style={styles.onlineRow}>
                <View style={styles.onlineDot} />
                <ThemedText style={styles.onlineText}>{t('chat.online')}</ThemedText>
              </View>
              <ThemedText style={styles.profileSub}>{t('chat.studyBuddy')}</ThemedText>
            </View>
            <BakeryBreadEmoji size={40} />
          </View>

          {/* Allowance + history + clear */}
          <View style={styles.utilBar}>
            <ThemedText style={styles.utilText} numberOfLines={1}>
              {t('chat.freeToday', { remaining: dailyChatRemaining, total: PLUS_DAILY_CHAT })}
              {chatMessages > 0 ? ` · +${chatMessages}` : ''}
              {messages.length > 0 ? t('chat.savedSuffix', { count: messages.length, cap: CHAT_HISTORY_CAP }) : ''}
            </ThemedText>
            {messages.length > 0 && (
              <Pressable onPress={handleClear} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText style={styles.clearText}>{t('chat.clear')}</ThemedText>
              </Pressable>
            )}
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.thread}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}>
            {messages.length === 0 && (
              <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
                <CompanionAvatar source={companion.imageSource} size={AVATAR} focus={pfpFocus} style={styles.avatarRing} />
                <View style={styles.msgCol}>
                  <View style={[styles.bubble, styles.bubbleAssistant]}>
                    <ThemedText style={styles.bubbleAssistantText}>
                      {t('chat.greeting')}
                    </ThemedText>
                  </View>
                </View>
              </View>
            )}

            {messages.map((m, i) => (
              <View
                key={i}
                style={[styles.bubbleRow, m.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
                {m.role === 'assistant' && (
                  <CompanionAvatar source={companion.imageSource} size={AVATAR} focus={pfpFocus} style={styles.avatarRing} />
                )}
                <View style={[styles.msgCol, m.role === 'user' && styles.msgColUser]}>
                  <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                    <ThemedText style={m.role === 'user' ? styles.bubbleUserText : styles.bubbleAssistantText}>
                      {m.content}
                    </ThemedText>
                  </View>
                  {!!m.at && <ThemedText style={styles.timestamp}>{formatTime(m.at)}</ThemedText>}
                </View>
              </View>
            ))}

            {isSending && (
              <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
                <CompanionAvatar source={companion.imageSource} size={AVATAR} focus={pfpFocus} style={styles.avatarRing} />
                <View style={styles.msgCol}>
                  <View style={[styles.bubble, styles.bubbleAssistant]}>
                    <ActivityIndicator size="small" color={BakeryColors.mocha} />
                  </View>
                </View>
              </View>
            )}
          </ScrollView>

          {outOfMessages && (
            <View style={styles.exchangeCta}>
              <ThemedText style={styles.exchangeCtaText}>
                {t('chat.dailyUsedReset')}
              </ThemedText>
            </View>
          )}

          {/* Composer */}
          <View style={styles.composer}>
            <View style={styles.inputPill}>
              <BakeryBreadEmoji size={20} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={input}
                onChangeText={setInput}
                placeholder={outOfMessages ? t('chat.chatsResetTomorrow') : t('chat.typeMessage')}
                placeholderTextColor={BakeryColors.latte}
                multiline
                editable={!outOfMessages}
                onSubmitEditing={handleSend}
              />
            </View>
            <Pressable
              onPress={handleSend}
              disabled={isSending || !input.trim() || outOfMessages}
              style={({ pressed }) => [
                styles.sendBtn,
                (isSending || !input.trim() || outOfMessages) && styles.sendBtnDisabled,
                pressed && styles.pressed,
              ]}>
              <SendIcon />
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        {/* Bottom tab bar (matches the app shell) */}
        <View style={styles.tabBar}>
          {TAB_ITEMS.map((item, i) => {
            const active = i === 0;
            const tint = active ? BakeryColors.cocoa : BakeryColors.latte;
            return (
              <Pressable
                key={item.labelKey}
                onPress={() => router.navigate(item.route)}
                style={[styles.tabItem, active && styles.tabItemActive]}>
                <item.Icon color={tint} size={24} />
                <ThemedText style={[styles.tabLabel, { color: tint }]}>{t(item.labelKey)}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const TAB_ITEMS = [
  { labelKey: 'nav.home', Icon: HomeTabIcon, route: '/' as const },
  { labelKey: 'nav.tasks', Icon: TasksTabIcon, route: '/tasks' as const },
  { labelKey: 'nav.progress', Icon: ProgressTabIcon, route: '/progress' as const },
  { labelKey: 'nav.shop', Icon: ShopTabIcon, route: '/shop' as const },
];

const AVATAR = 34;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7E7D3' },
  flex: { flex: 1 },
  bgMascot: { position: 'absolute', bottom: 96, right: 14, opacity: 0.16, zIndex: 0 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BakeryColors.frosting,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: BakeryColors.cocoaDark },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: Spacing.two,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  coinText: { fontWeight: '800', color: BakeryColors.cocoaDark, fontSize: 14 },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    padding: Spacing.three,
    borderRadius: BakeryRadii.card,
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  profileAvatarRing: { borderWidth: 3, borderColor: BakeryColors.butter },
  profileInfo: { flex: 1, gap: 2 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileName: { fontSize: 16, fontWeight: '800', color: BakeryColors.cocoaDark },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BakeryColors.success },
  onlineText: { fontSize: 12, color: BakeryColors.success, fontWeight: '700' },
  profileSub: { fontSize: 12, color: BakeryColors.mocha },

  // Utility bar
  utilBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
    gap: Spacing.two,
  },
  utilText: { flex: 1, fontSize: 11, color: BakeryColors.mocha },
  clearText: { fontSize: 12, fontWeight: '700', color: BakeryColors.berry },

  // Thread
  thread: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three, gap: Spacing.two, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  avatarRing: { borderWidth: 2, borderColor: BakeryColors.butter },
  msgCol: { maxWidth: '78%', gap: 2 },
  msgColUser: { alignItems: 'flex-end' },
  bubble: { borderRadius: 18, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  bubbleAssistant: { backgroundColor: BakeryColors.frosting, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: BakeryColors.shortbread },
  bubbleUser: { backgroundColor: BakeryColors.butter, borderBottomRightRadius: 5 },
  bubbleAssistantText: { color: BakeryColors.cocoa, fontSize: 14, lineHeight: 19 },
  bubbleUserText: { color: BakeryColors.cocoaDark, fontSize: 14, lineHeight: 19 },
  timestamp: { fontSize: 10, color: BakeryColors.latte, marginHorizontal: 6 },

  // Exchange CTA
  exchangeCta: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    backgroundColor: `${BakeryColors.honey}22`,
    borderRadius: BakeryRadii.chip,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  exchangeCtaText: { color: BakeryColors.mocha, fontWeight: '700', fontSize: 13, textAlign: 'center', paddingHorizontal: Spacing.three },

  // Composer
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },

  // Bottom tab bar (mirrors components/app-tabs.tsx)
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 78,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 18 : 12,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: BakeryRadii.panel,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E8D4C4',
    shadowColor: BakeryColors.shadow,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 14,
  },
  tabItemActive: { backgroundColor: '#F5E8D6' },
  tabLabel: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    borderRadius: 24,
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  input: { flex: 1, fontSize: 15, maxHeight: 110, paddingVertical: 0 },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BakeryColors.honey,
    borderWidth: 2,
    borderColor: '#B07F3C',
  },
  sendBtnDisabled: { opacity: 0.45 },

  // Locked
  lockedWrap: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  lockedCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
    backgroundColor: BakeryColors.frosting,
  },
  lockedText: { textAlign: 'center', lineHeight: 20 },
  upgradeBtn: {
    backgroundColor: BakeryColors.mocha,
    borderRadius: 20,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two + 2,
    marginTop: Spacing.one,
  },
  upgradeBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  pressed: { opacity: 0.8 },
});
