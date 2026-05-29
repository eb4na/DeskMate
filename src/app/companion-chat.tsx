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
import { Image } from 'expo-image';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CHAT_HISTORY_CAP, CHAT_MESSAGES_PER_TICKET, PLUS_DAILY_CHAT, useApp } from '@/context/app-context';
import { sendCompanionChat, type ChatMessage } from '@/lib/companion-chat';
import { resolveActiveCompanion } from '@/lib/companion-utils';
import { BakeryColors, BakeryRadii, Colors, MaxContentWidth, Spacing } from '@/constants/theme';

export default function CompanionChatScreen() {
  const {
    isPlus,
    chatMessages,
    dailyChatRemaining,
    aiTickets,
    purchasedAiTickets,
    exchangeTicketForChat,
    consumeChatMessage,
    chatThread,
    setChatThread,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
  } = useApp();

  const companion = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots);
  const vibe = companion.type === 'slot' ? companion.slot.prompt ?? '' : '';
  const ticketTotal = aiTickets + purchasedAiTickets;
  const chatTotal = dailyChatRemaining + chatMessages;

  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  // Seed from the cached thread so the conversation survives leaving/restarting.
  const [messages, setMessages] = useState<ChatMessage[]>(() => chatThread);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // Keep the cached thread in sync with the visible conversation.
  useEffect(() => {
    setChatThread(messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const scrollToEnd = () => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const handleExchange = () => {
    if (!isPlus) {
      Alert.alert(
        'Plus required',
        'Companion chat is a Plus feature. Upgrade to Plus to chat with your companion.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'See Plus', onPress: () => router.push('/plus-upgrade') },
        ],
      );
      return;
    }
    if (ticketTotal <= 0) {
      Alert.alert(
        'No tickets',
        'You need an AI generation ticket to top up chat. Get more in the shop.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Get tickets', onPress: () => router.push('/coin-shop') },
        ],
      );
      return;
    }
    Alert.alert(
      'Exchange 1 ticket?',
      `Trade 1 AI generation ticket for ${CHAT_MESSAGES_PER_TICKET} companion chat messages?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exchange',
          onPress: () => {
            if (exchangeTicketForChat()) {
              Alert.alert(`+${CHAT_MESSAGES_PER_TICKET} messages added!`, 'Chat away 💬');
            }
          },
        },
      ],
    );
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    if (chatTotal <= 0) {
      handleExchange();
      return;
    }

    const history: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(history);
    setInput('');
    setIsSending(true);
    scrollToEnd();

    try {
      const { reply } = await sendCompanionChat({ companionName: companion.name, vibe, history });
      // Only charge a message once the companion actually replies.
      consumeChatMessage();
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      scrollToEnd();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The companion could not reply.';
      Alert.alert('Chat hiccup', `${message}\n\nNo message was used — try again.`);
      // Roll the failed user turn back out of the visible thread.
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = () => {
    if (messages.length === 0) return;
    Alert.alert(
      'Clear chat?',
      `This permanently deletes your saved conversation with ${companion.name}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setMessages([]) },
      ],
    );
  };

  const inputStyle = {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.backgroundSelected,
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
  };

  const outOfMessages = chatTotal <= 0;

  if (!isPlus) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.lockedWrap} edges={['bottom']}>
          <ThemedView type="backgroundElement" style={styles.lockedCard}>
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
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <SafeAreaView style={styles.flex} edges={['bottom']}>
          {/* Balance header */}
          <ThemedView type="backgroundElement" style={styles.balanceBar}>
            <ThemedText type="smallBold">{companion.name}</ThemedText>
            <Pressable onPress={handleExchange} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="small" style={styles.balanceText}>
                💬 {dailyChatRemaining}/{PLUS_DAILY_CHAT} free today
                {chatMessages > 0 ? ` · +${chatMessages}` : ''}
              </ThemedText>
            </Pressable>
          </ThemedView>

          {/* History meter + clear */}
          {messages.length > 0 && (
            <View style={styles.historyBar}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.historyText}>
                {messages.length}/{CHAT_HISTORY_CAP} saved
              </ThemedText>
              <View style={styles.historyMeter}>
                <View
                  style={[
                    styles.historyFill,
                    { width: `${Math.min(100, (messages.length / CHAT_HISTORY_CAP) * 100)}%` },
                  ]}
                />
              </View>
              <Pressable onPress={handleClear} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="smallBold" style={styles.clearText}>Clear chat</ThemedText>
              </Pressable>
            </View>
          )}

          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.thread}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={scrollToEnd}>
            {messages.length === 0 && (
              <ThemedView type="backgroundElement" style={styles.emptyCard}>
                <ThemedText type="smallBold">Say hi to {companion.name} 👋</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                  Your companion is here to keep you company while you study. Each message you send
                  uses one chat message.
                </ThemedText>
              </ThemedView>
            )}

            {messages.map((m, i) => (
              <View
                key={i}
                style={[styles.bubbleRow, m.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAssistant]}>
                {m.role === 'assistant' && (
                  <Image
                    source={companion.imageSource}
                    style={styles.avatar}
                    contentFit="cover"
                    contentPosition="top"
                    accessibilityLabel={`${companion.name} avatar`}
                  />
                )}
                <ThemedView
                  type="backgroundElement"
                  style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
                  <ThemedText type="small" style={m.role === 'user' ? styles.bubbleUserText : undefined}>
                    {m.content}
                  </ThemedText>
                </ThemedView>
              </View>
            ))}

            {isSending && (
              <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
                <Image
                  source={companion.imageSource}
                  style={styles.avatar}
                  contentFit="cover"
                  contentPosition="top"
                  accessibilityLabel={`${companion.name} avatar`}
                />
                <ThemedView type="backgroundElement" style={[styles.bubble, styles.bubbleAssistant]}>
                  <ActivityIndicator size="small" color={BakeryColors.mocha} />
                </ThemedView>
              </View>
            )}
          </ScrollView>

          {outOfMessages && (
            <Pressable onPress={handleExchange} style={({ pressed }) => [styles.exchangeCta, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={styles.exchangeCtaText}>
                Daily chats used — resets tomorrow, or exchange 1 ticket for {CHAT_MESSAGES_PER_TICKET} →
              </ThemedText>
            </Pressable>
          )}

          {/* Composer */}
          <ThemedView type="backgroundElement" style={styles.composer}>
            <TextInput
              style={inputStyle}
              value={input}
              onChangeText={setInput}
              placeholder={outOfMessages ? 'Exchange a ticket to chat…' : `Message ${companion.name}…`}
              placeholderTextColor={colors.textSecondary}
              multiline
              editable={!outOfMessages}
              onSubmitEditing={handleSend}
            />
            <Pressable
              onPress={handleSend}
              disabled={isSending || !input.trim() || outOfMessages}
              style={({ pressed }) => [
                styles.sendBtn,
                (isSending || !input.trim() || outOfMessages) && styles.sendBtnDisabled,
                pressed && styles.pressed,
              ]}>
              <ThemedText style={styles.sendBtnText}>Send</ThemedText>
            </Pressable>
          </ThemedView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  lockedWrap: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  lockedCard: { borderRadius: BakeryRadii.card, padding: Spacing.four, gap: Spacing.two, alignItems: 'center' },
  lockedText: { textAlign: 'center', lineHeight: 20 },
  upgradeBtn: {
    backgroundColor: BakeryColors.mocha,
    borderRadius: 20,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two + 2,
    marginTop: Spacing.one,
  },
  upgradeBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  balanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  balanceText: { color: BakeryColors.mocha },
  historyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.one,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  historyText: { fontSize: 12 },
  historyMeter: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
  historyFill: { height: '100%', borderRadius: 3, backgroundColor: BakeryColors.honey },
  clearText: { color: BakeryColors.berry, fontSize: 13 },
  thread: {
    padding: Spacing.four,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  emptyCard: { borderRadius: BakeryRadii.card, padding: Spacing.four, gap: Spacing.one, marginTop: Spacing.four },
  emptyText: { lineHeight: 20 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.one },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAssistant: { justifyContent: 'flex-start' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BakeryColors.shortbread,
    borderWidth: 1,
    borderColor: '#E2C9A6',
  },
  bubble: { maxWidth: '82%', borderRadius: BakeryRadii.card, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  bubbleUser: { backgroundColor: BakeryColors.honey, borderBottomRightRadius: 4 },
  bubbleAssistant: { borderBottomLeftRadius: 4 },
  bubbleUserText: { color: BakeryColors.cocoaDark },
  exchangeCta: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.two,
    backgroundColor: `${BakeryColors.honey}22`,
    borderRadius: BakeryRadii.chip,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  exchangeCtaText: { color: BakeryColors.mocha },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  sendBtn: {
    backgroundColor: BakeryColors.mocha,
    borderRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  pressed: { opacity: 0.8 },
});
