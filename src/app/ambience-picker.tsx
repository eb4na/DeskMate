import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlusGate } from '@/components/plus-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export const AMBIENCE_OPTIONS = [
  { id: 'rain', name: 'Rainy Day', emoji: '🌧️', desc: 'Soft rain outside the window' },
  { id: 'cafe', name: 'Cozy Cafe', emoji: '☕', desc: 'Murmur of a quiet coffee shop' },
  { id: 'library', name: 'Library', emoji: '📚', desc: 'Quiet turning of pages' },
  { id: 'fireplace', name: 'Fireplace', emoji: '🔥', desc: 'Crackling warm fire' },
  { id: 'keyboard', name: 'Keyboard', emoji: '⌨️', desc: 'Gentle mechanical keys' },
  { id: 'night', name: 'Night Sounds', emoji: '🌙', desc: 'Crickets and cool evening air' },
] as const;

export type AmbienceId = (typeof AMBIENCE_OPTIONS)[number]['id'];

export function getAmbienceName(id: string): string {
  return AMBIENCE_OPTIONS.find((a) => a.id === id)?.name ?? id;
}
export function getAmbienceEmoji(id: string): string {
  return AMBIENCE_OPTIONS.find((a) => a.id === id)?.emoji ?? '🎵';
}

function AmbienceContent() {
  const { ambienceId, setAmbience } = useApp();

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="default" themeColor="textSecondary" style={styles.hint}>
          Choose a background sound for your study sessions.
          Audio will be added in a future update — for now, set your preference.
        </ThemedText>

        <ThemedView style={styles.grid}>
          {AMBIENCE_OPTIONS.map((opt) => {
            const selected = ambienceId === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={({ pressed }) => [pressed && styles.pressed]}
                onPress={() => setAmbience(selected ? null : opt.id)}>
                <ThemedView
                  type="backgroundElement"
                  style={[styles.card, selected && styles.cardSelected]}>
                  <ThemedText style={styles.cardEmoji}>{opt.emoji}</ThemedText>
                  <ThemedText type="smallBold" style={styles.cardName}>
                    {opt.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.cardDesc}>
                    {opt.desc}
                  </ThemedText>
                  {selected && (
                    <ThemedView style={styles.selectedBadge}>
                      <ThemedText style={styles.selectedBadgeText}>✓ Active</ThemedText>
                    </ThemedView>
                  )}
                </ThemedView>
              </Pressable>
            );
          })}
        </ThemedView>

        {ambienceId && (
          <Pressable onPress={() => setAmbience(null)} style={styles.clearBtn}>
            <ThemedText type="small" themeColor="textSecondary">
              Clear ambience
            </ThemedText>
          </Pressable>
        )}

        <ThemedView type="backgroundElement" style={styles.noticeCard}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
            🛠 Real audio playback will be wired in a future update. Your preference is saved!
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

export default function AmbiencePickerScreen() {
  return (
    <ThemedView style={styles.container}>
      <PlusGate
        feature="Ambience Sounds"
        description="Study with rain, cafe chatter, library sounds, and more. Calming audio for deep focus."
        emoji="🎵">
        <AmbienceContent />
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
  hint: { textAlign: 'center', lineHeight: 22 },
  grid: { gap: Spacing.three },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: '#7C6F5A',
  },
  cardEmoji: { fontSize: 32, lineHeight: 40 },
  cardName: { fontSize: 16 },
  cardDesc: { lineHeight: 18 },
  selectedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(124,111,90,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  selectedBadgeText: { fontSize: 12, color: '#7C6F5A', fontWeight: '700' },
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  noticeCard: { borderRadius: 12, padding: Spacing.three },
  noticeText: { textAlign: 'center', lineHeight: 20 },
  doneBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  doneBtnText: { color: '#FFF', fontSize: 16 },
  pressed: { opacity: 0.85 },
});
