import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { SESSION_LENGTHS } from '@/constants/placeholder-data';
import { MaxContentWidth, Spacing } from '@/constants/theme';

function goToSession(minutes: number) {
  router.push({ pathname: '/subject-picker', params: { sessionLength: String(minutes) } });
}

export default function SessionPickerScreen() {
  const { width } = useWindowDimensions();
  const { isPlus, savedTimerPresets } = useApp();
  const cardWidth = Math.min(
    (width - Spacing.four * 2 - Spacing.three) / 2,
    (MaxContentWidth - Spacing.three) / 2,
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="default" themeColor="textSecondary" style={styles.hint}>
            How long would you like to focus?
          </ThemedText>

          {/* Saved presets (Plus) */}
          {isPlus && savedTimerPresets.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold" style={styles.sectionLabel}>
                Saved presets
              </ThemedText>
              <ThemedView style={styles.presetRow}>
                {savedTimerPresets.map((p) => (
                  <Pressable
                    key={p.id}
                    style={({ pressed }) => [pressed && styles.cardPressed]}
                    onPress={() => goToSession(p.minutes)}>
                    <ThemedView type="backgroundElement" style={styles.presetChip}>
                      <ThemedText type="smallBold" style={styles.presetMin}>
                        {p.minutes}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        min
                      </ThemedText>
                      <ThemedText type="small" style={styles.presetLabel} numberOfLines={1}>
                        {p.label}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </ThemedView>
            </ThemedView>
          )}

          {/* Free preset grid */}
          <ThemedView style={styles.section}>
            {isPlus && savedTimerPresets.length > 0 && (
              <ThemedText type="smallBold" style={styles.sectionLabel}>
                Standard presets
              </ThemedText>
            )}
            <ThemedView style={styles.grid}>
              {SESSION_LENGTHS.map((option) => (
                <Pressable
                  key={option.minutes}
                  style={({ pressed }) => [
                    styles.card,
                    { width: cardWidth },
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => goToSession(option.minutes)}>
                  <ThemedView type="backgroundElement" style={styles.cardInner}>
                    <ThemedText type="subtitle" style={styles.minutes}>
                      {option.minutes}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      min
                    </ThemedText>
                    <ThemedText type="smallBold" style={styles.label}>
                      {option.label}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
          </ThemedView>

          {/* Custom timer (Plus) */}
          <Pressable
            style={({ pressed }) => [styles.customRow, pressed && styles.cardPressed]}
            onPress={() => router.push('/custom-timer')}>
            <ThemedView type="backgroundElement" style={styles.customCard}>
              <ThemedText style={styles.customEmoji}>⏱</ThemedText>
              <ThemedView style={styles.customText}>
                <ThemedText type="smallBold">Custom duration</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {isPlus ? 'Any length, save as preset' : '🔒 Plus — set any duration'}
                </ThemedText>
              </ThemedView>
              <ThemedText type="small" style={styles.customArrow}>
                →
              </ThemedText>
            </ThemedView>
          </Pressable>
        </SafeAreaView>
      </ScrollView>
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
  hint: { textAlign: 'center' },
  section: { gap: Spacing.two },
  sectionLabel: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  presetChip: {
    borderRadius: 14,
    padding: Spacing.two,
    alignItems: 'center',
    gap: 2,
    minWidth: 70,
  },
  presetMin: { fontSize: 22, lineHeight: 28 },
  presetLabel: { fontSize: 11, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'center' },
  card: { flexGrow: 0 },
  cardPressed: { opacity: 0.85 },
  cardInner: {
    borderRadius: 16,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 120,
    justifyContent: 'center',
  },
  minutes: { fontSize: 36, lineHeight: 42 },
  label: { marginTop: Spacing.one, textAlign: 'center' },
  customRow: {},
  customCard: {
    borderRadius: 16,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  customEmoji: { fontSize: 26, lineHeight: 32, width: 34 },
  customText: { flex: 1, gap: 2 },
  customArrow: { color: '#7C6F5A', fontWeight: '700', fontSize: 18 },
});
