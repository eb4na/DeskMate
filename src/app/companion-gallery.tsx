import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiTicketIcon } from '@/components/ai-ticket-icon';
import { PlusGate } from '@/components/plus-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth-context';
import { useApp } from '@/context/app-context';
import { generateAiCompanion } from '@/lib/ai-companion';
import { getStarterActiveId } from '@/lib/companion-utils';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

const MAX_SLOTS = 3;

const EMOJI_OPTIONS = ['🐱', '🐶', '🦊', '🐺', '🦋', '🐉', '🦄', '🐧', '🦅', '🌸'];

function GalleryContent() {
  const { isGuest } = useAuth();
  const {
    activeCompanionId,
    companionSlots,
    saveCompanionSlot,
    deleteCompanionSlot,
    aiTickets,
    consumeAiTicket,
    restoreAiTicket,
    defaultCompanionId,
    isPlus,
    setDefaultCompanion,
    setActiveCompanion,
  } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [slotName, setSlotName] = useState('');
  const [slotEmoji, setSlotEmoji] = useState(EMOJI_OPTIONS[0]);
  const [slotDesc, setSlotDesc] = useState('');
  const [generateName, setGenerateName] = useState('');
  const [generateVibe, setGenerateVibe] = useState('sweet, cozy, and gentle');
  const [generateOutfit, setGenerateOutfit] = useState('bakery apron with a soft beret');
  const [generatePrompt, setGeneratePrompt] = useState('');
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  const inputStyle = {
    borderWidth: 1.5,
    borderColor: colors.backgroundSelected,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    color: colors.text,
    fontSize: 15,
  };

  const handleSaveSlot = () => {
    if (!slotName.trim()) {
      Alert.alert('Name required', 'Give your companion a name.');
      return;
    }
    if (companionSlots.length >= MAX_SLOTS) {
      Alert.alert('Slot limit', `You can save up to ${MAX_SLOTS} companions.`);
      return;
    }
    const savedId = saveCompanionSlot({
      name: slotName.trim(),
      emoji: slotEmoji,
      description: slotDesc.trim(),
      isGenerated: false,
      imageUri: null,
      imagePath: null,
      prompt: null,
    });
    if (!savedId) {
      Alert.alert('Slot limit', `You can save up to ${MAX_SLOTS} companions.`);
      return;
    }
    setSlotName('');
    setSlotDesc('');
    setSlotEmoji(EMOJI_OPTIONS[0]);
    setShowForm(false);
  };

  const handleGenerateCompanion = async () => {
    if (isGuest) {
      Alert.alert(
        'Sign in required',
        'AI generation uses your secure account session. Sign in first, then come back here to generate a companion.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Go to login', onPress: () => router.push('/login') },
        ],
      );
      return;
    }
    if (!isPlus) {
      Alert.alert('Plus required', 'AI companion generation is included with DeskMate Plus.');
      return;
    }
    if (aiTickets <= 0) {
      Alert.alert(
        'No tickets left',
        'You have used all AI generation tickets for this month. Tickets reset on the 1st.',
      );
      return;
    }
    if (companionSlots.length >= MAX_SLOTS) {
      Alert.alert('Slot limit', `You can save up to ${MAX_SLOTS} companions.`);
      return;
    }

    if (!generateName.trim()) {
      Alert.alert('Name required', 'Give your generated companion a name.');
      return;
    }

    setIsGenerating(true);
    let ticketUsed = false;
    const savedName = generateName.trim();
    try {
      if (!consumeAiTicket()) {
        throw new Error('You do not have any AI generation tickets left.');
      }
      ticketUsed = true;

      const result = await generateAiCompanion({
        name: savedName,
        vibe: generateVibe.trim(),
        outfit: generateOutfit.trim(),
        prompt: generatePrompt.trim(),
      });

      const slotId = saveCompanionSlot({
        name: savedName,
        emoji: '🎨',
        description: result.description,
        isGenerated: true,
        imageUri: result.imageUrl,
        imagePath: result.storagePath,
        prompt: result.prompt,
      });

      if (!slotId) {
        throw new Error(`You can save up to ${MAX_SLOTS} companions.`);
      }

      setActiveCompanion(slotId);
      setGenerateName('');
      setGenerateVibe('sweet, cozy, and gentle');
      setGenerateOutfit('bakery apron with a soft beret');
      setGeneratePrompt('');
      setShowGenerator(false);

      Alert.alert(
        'Companion ready',
        `${savedName} was generated and is now active across Home and your study screens.`,
      );
    } catch (error) {
      if (ticketUsed) {
        restoreAiTicket();
      }
      Alert.alert(
        'Generation failed',
        error instanceof Error ? error.message : 'The companion could not be generated.',
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseSlot = (slotId: string, hasRenderableImage: boolean) => {
    if (!hasRenderableImage) {
      Alert.alert(
        'No art to show yet',
        'This custom slot does not have character art yet. Generate a companion to use it across Home and study screens.',
      );
      return;
    }
    setActiveCompanion(slotId);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <SafeAreaView style={styles.safeArea}>
        {/* Ticket counter */}
        <ThemedView type="backgroundElement" style={styles.ticketCard}>
          <ThemedView style={styles.ticketRow}>
            <AiTicketIcon size={72} style={styles.ticketIcon} />
            <ThemedView style={styles.ticketInfo}>
              <ThemedText type="smallBold">AI Generation Tickets</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {aiTickets}/3 remaining this month
              </ThemedText>
            </ThemedView>
            <Pressable
              style={({ pressed }) => [styles.generateBtn, pressed && styles.pressed]}
              onPress={() => setShowGenerator((value) => !value)}>
              <ThemedText style={styles.generateBtnText}>
                {showGenerator ? 'Hide' : 'Generate'}
              </ThemedText>
            </Pressable>
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary" style={styles.ticketNote}>
            Each ticket creates one static companion design. Tickets reset monthly. Failed
            generations are refunded.
          </ThemedText>
          {showGenerator && (
            <ThemedView type="backgroundElement" style={styles.form}>
              <ThemedText type="smallBold">AI character generator</ThemedText>
              <TextInput
                style={inputStyle}
                value={generateName}
                onChangeText={setGenerateName}
                placeholder="Name (e.g. Miel)"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
                autoFocus
              />
              <TextInput
                style={inputStyle}
                value={generateVibe}
                onChangeText={setGenerateVibe}
                placeholder="Vibe (e.g. shy, dreamy, warm)"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
              />
              <TextInput
                style={inputStyle}
                value={generateOutfit}
                onChangeText={setGenerateOutfit}
                placeholder="Outfit (e.g. frilly baker dress)"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
              />
              <TextInput
                style={[inputStyle, styles.promptInput]}
                value={generatePrompt}
                onChangeText={setGeneratePrompt}
                placeholder="Extra details (optional)"
                placeholderTextColor={colors.textSecondary}
                multiline
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.generatorNote}>
                Generates a bakery-style companion with OpenAI, then automatically removes the
                background so your sprite is ready for Home.
              </ThemedText>
              <Pressable
                style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed, isGenerating && styles.disabledBtn]}
                disabled={isGenerating}
                onPress={handleGenerateCompanion}>
                <ThemedText type="smallBold" style={styles.saveBtnText}>
                  {isGenerating ? 'Generating...' : `Use 1 ticket (${aiTickets} left)`}
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}
        </ThemedView>

        {/* Starter companions */}
        <ThemedView style={styles.section}>
          <ThemedView style={styles.sectionHeader}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Starter companions
            </ThemedText>
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary" style={styles.starterNote}>
            Free for everyone. Shop outfits in v1 are made only for these two.
          </ThemedText>

          {[
            { id: 'girl' as const, emoji: '🍞', name: 'Bakery Girl' },
            { id: 'dude' as const, emoji: '👦', name: 'Default Dude' },
          ].map((starter) => (
            <Pressable key={starter.id} onPress={() => setDefaultCompanion(starter.id)}>
              <ThemedView
                type="backgroundElement"
                style={[
                  styles.slotCard,
                  styles.defaultSlot,
                  activeCompanionId === getStarterActiveId(starter.id) && styles.defaultSlotActive,
                ]}>
                <ThemedText style={styles.slotEmoji}>{starter.emoji}</ThemedText>
                <ThemedView style={styles.slotInfo}>
                  <ThemedText type="smallBold">{starter.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Founder-created starter companion
                  </ThemedText>
                </ThemedView>
                {activeCompanionId === getStarterActiveId(starter.id) && (
                  <ThemedView style={styles.activeBadge}>
                    <ThemedText style={styles.activeBadgeText}>Active</ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
            </Pressable>
          ))}

          {/* Companion slots */}
          <ThemedView style={styles.sectionHeader}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>
              Extra companion slots ({companionSlots.length}/{MAX_SLOTS})
            </ThemedText>
            {companionSlots.length < MAX_SLOTS && (
              <Pressable onPress={() => setShowForm((v) => !v)}>
                <ThemedText type="small" style={styles.addLink}>
                  {showForm ? 'Cancel' : '+ Add'}
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>

          {/* Add form */}
          {showForm && (
            <ThemedView type="backgroundElement" style={styles.form}>
              <ThemedText type="smallBold">New companion</ThemedText>
              <TextInput
                style={inputStyle}
                value={slotName}
                onChangeText={setSlotName}
                placeholder="Name (e.g. Kira)"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="next"
                autoFocus
              />
              <ThemedView style={styles.emojiRow}>
                {EMOJI_OPTIONS.map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => setSlotEmoji(e)}
                    style={[styles.emojiBtn, slotEmoji === e && styles.emojiBtnSelected]}>
                    <ThemedText style={styles.emojiOpt}>{e}</ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
              <TextInput
                style={inputStyle}
                value={slotDesc}
                onChangeText={setSlotDesc}
                placeholder="Short description (optional)"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
              />
              <Pressable
                style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]}
                onPress={handleSaveSlot}>
                <ThemedText type="smallBold" style={styles.saveBtnText}>
                  Save companion
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {/* User slots */}
          {companionSlots.map((slot) => {
            const canUseSlot = !!slot.imageUri;
            const isActive = activeCompanionId === slot.id;

            return (
              <Pressable key={slot.id} onPress={() => handleUseSlot(slot.id, canUseSlot)}>
                <ThemedView
                  type="backgroundElement"
                  style={[styles.slotCard, isActive && styles.defaultSlotActive]}>
                  {slot.imageUri ? (
                    <Image
                      source={{ uri: slot.imageUri }}
                      style={styles.slotPreview}
                      contentFit="contain"
                      contentPosition="center"
                    />
                  ) : (
                    <ThemedText style={styles.slotEmoji}>{slot.emoji}</ThemedText>
                  )}
                  <ThemedView style={styles.slotInfo}>
                    <ThemedText type="smallBold">
                      {slot.name}
                      {slot.isGenerated && (
                        <ThemedText type="small" style={styles.aiBadgeInline}>
                          {' '}
                          🎨 AI
                        </ThemedText>
                      )}
                    </ThemedText>
                    {slot.description ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {slot.description}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="small" themeColor="textSecondary">
                      {canUseSlot
                        ? isActive
                          ? 'Active across Home and study screens'
                          : 'Tap to use this companion'
                        : 'Saved note only — generate art to use it'}
                    </ThemedText>
                  </ThemedView>
                  <View style={styles.slotActions}>
                    {isActive ? (
                      <ThemedView style={styles.activeBadge}>
                        <ThemedText style={styles.activeBadgeText}>Active</ThemedText>
                      </ThemedView>
                    ) : null}
                    <Pressable
                      onPress={() =>
                        Alert.alert('Remove companion?', `Remove "${slot.name}"?`, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Remove',
                            style: 'destructive',
                            onPress: () => deleteCompanionSlot(slot.id),
                          },
                        ])
                      }
                      style={styles.deleteBtn}>
                      <ThemedText type="small" themeColor="textSecondary">
                        ✕
                      </ThemedText>
                    </Pressable>
                  </View>
                </ThemedView>
              </Pressable>
            );
          })}

          {companionSlots.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyNote}>
              You have 3 open slots. Add a custom note companion or use an AI ticket to generate
              one with art.
            </ThemedText>
          )}
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.noticeCard}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
            AI-generated companions become usable across Home, sessions, breaks, and completion
            screens right away. Guest mode cannot use the secure AI generator.
          </ThemedText>
        </ThemedView>

        <Pressable onPress={() => router.back()} style={styles.doneBtn}>
          <ThemedText type="smallBold" style={styles.doneBtnText}>
            Done
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ScrollView>
  );
}

export default function CompanionGalleryScreen() {
  return (
    <ThemedView style={styles.container}>
      <PlusGate
        feature="Companion Gallery"
        description="Keep your free starter girl and dude, then save up to 3 extra companions with Plus."
        emoji="🐾">
        <GalleryContent />
      </PlusGate>
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
  },
  ticketCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  ticketIcon: { width: 80 },
  ticketInfo: { flex: 1, gap: 2 },
  ticketNote: { lineHeight: 18, fontSize: 12 },
  generateBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  generateBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  starterNote: { lineHeight: 18 },
  addLink: { color: '#7C6F5A', fontWeight: '700' },
  form: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  promptInput: { minHeight: 88, textAlignVertical: 'top' },
  generatorNote: { lineHeight: 18 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
  emojiBtn: {
    borderRadius: 8,
    padding: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiBtnSelected: { borderColor: '#7C6F5A', backgroundColor: 'rgba(124,111,90,0.1)' },
  emojiOpt: { fontSize: 22 },
  saveBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 12,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 15 },
  defaultSlot: {
    borderRadius: 14,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderColor: 'rgba(124,111,90,0.15)',
  },
  defaultSlotActive: {
    borderColor: '#81C784',
  },
  slotCard: {
    borderRadius: 14,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  slotEmoji: { fontSize: 28, lineHeight: 34, width: 36 },
  slotPreview: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: 'rgba(124,111,90,0.08)',
  },
  slotInfo: { flex: 1, gap: 2 },
  slotActions: { alignItems: 'center', gap: Spacing.one },
  aiBadgeInline: { color: '#7C6F5A' },
  deleteBtn: { padding: Spacing.two },
  activeBadge: {
    backgroundColor: 'rgba(129,199,132,0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeBadgeText: { fontSize: 12, color: '#81C784', fontWeight: '700' },
  emptyNote: { textAlign: 'center', lineHeight: 20 },
  noticeCard: { borderRadius: 12, padding: Spacing.three },
  noticeText: { textAlign: 'center', lineHeight: 20 },
  doneBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  doneBtnText: { color: '#FFF', fontSize: 16 },
  disabledBtn: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
});
