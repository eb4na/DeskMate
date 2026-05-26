import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { SESSION_LENGTHS } from '@/constants/placeholder-data';
import { BakeryColors, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

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
                    style={({ pressed }) => [styles.presetPressable, pressed && styles.cardPressed]}
                    onPress={() => goToSession(p.minutes)}>
                    <View style={styles.presetBreadWrap}>
                      <View style={styles.breadTop}>
                        <View style={[styles.breadBump, styles.breadBumpLeft]} />
                        <View style={[styles.breadBump, styles.breadBumpCenter]} />
                        <View style={[styles.breadBump, styles.breadBumpRight]} />
                      </View>
                      <View style={styles.presetChip}>
                        <View style={styles.breadScores}>
                          <View style={[styles.breadScore, styles.breadScoreLeft]} />
                          <View style={[styles.breadScore, styles.breadScoreCenter]} />
                        </View>
                        <ThemedText type="smallBold" style={styles.presetMin}>
                          {p.minutes}
                        </ThemedText>
                        <ThemedText type="small" style={styles.breadUnitText}>
                          min
                        </ThemedText>
                        <ThemedText type="small" style={styles.presetLabel} numberOfLines={1}>
                          {p.label}
                        </ThemedText>
                      </View>
                    </View>
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
                  <View style={styles.breadCardWrap}>
                    <View style={styles.breadTop}>
                      <View style={[styles.breadBump, styles.breadBumpLeft]} />
                      <View style={[styles.breadBump, styles.breadBumpCenter]} />
                      <View style={[styles.breadBump, styles.breadBumpRight]} />
                    </View>
                    <View style={styles.cardInner}>
                      <View style={styles.breadScores}>
                        <View style={[styles.breadScore, styles.breadScoreLeft]} />
                        <View style={[styles.breadScore, styles.breadScoreCenter]} />
                        <View style={[styles.breadScore, styles.breadScoreRight]} />
                      </View>
                      <ThemedText type="subtitle" style={styles.minutes}>
                        {option.minutes}
                      </ThemedText>
                      <ThemedText type="small" style={styles.breadUnitText}>
                        min
                      </ThemedText>
                      <ThemedText type="smallBold" style={styles.label}>
                        {option.label}
                      </ThemedText>
                    </View>
                  </View>
                </Pressable>
              ))}
            </ThemedView>
          </ThemedView>

          {/* Custom timer (Plus) */}
          <Pressable
            style={({ pressed }) => [styles.customRow, pressed && styles.cardPressed]}
            onPress={() => router.push({ pathname: '/custom-timer', params: { mode: 'focus' } })}>
            <View style={styles.customBreadWrap}>
              <View style={styles.breadTop}>
                <View style={[styles.breadBump, styles.breadBumpLeft]} />
                <View style={[styles.breadBump, styles.breadBumpCenter]} />
                <View style={[styles.breadBump, styles.breadBumpRight]} />
              </View>
              <View style={styles.customCard}>
                <View style={styles.breadScores}>
                  <View style={[styles.breadScore, styles.breadScoreLeft]} />
                  <View style={[styles.breadScore, styles.breadScoreCenter]} />
                  <View style={[styles.breadScore, styles.breadScoreRight]} />
                </View>
                <ThemedText style={styles.customEmoji}>⏱</ThemedText>
                <ThemedView style={styles.customText}>
                  <ThemedText type="smallBold" style={styles.breadTitleText}>
                    Custom duration
                  </ThemedText>
                  <ThemedText type="small" style={styles.breadSubText}>
                    {isPlus ? 'Any length, save as preset' : '🔒 Plus — set any duration'}
                  </ThemedText>
                </ThemedView>
                <ThemedText type="small" style={styles.customArrow}>
                  →
                </ThemedText>
              </View>
            </View>
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
  presetPressable: { minWidth: 94 },
  breadTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 34,
  },
  breadBump: {
    position: 'absolute',
    top: 0,
    height: 32,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: '#D29649',
    backgroundColor: '#F6C979',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  breadBumpLeft: {
    left: '5%',
    width: '34%',
  },
  breadBumpCenter: {
    left: '33%',
    width: '34%',
  },
  breadBumpRight: {
    right: '5%',
    width: '34%',
  },
  presetBreadWrap: {
    position: 'relative',
    paddingTop: 16,
  },
  presetChip: {
    minWidth: 94,
    borderRadius: 18,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    alignItems: 'center',
    gap: 2,
    backgroundColor: BakeryColors.honey,
    borderWidth: 1.5,
    borderColor: '#D29649',
    overflow: 'hidden',
    ...BakeryShadow,
  },
  presetMin: { fontSize: 22, lineHeight: 28, color: BakeryColors.cocoaDark },
  presetLabel: { fontSize: 11, textAlign: 'center', color: BakeryColors.cocoaDark },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'center' },
  card: { flexGrow: 0 },
  cardPressed: { opacity: 0.85 },
  breadCardWrap: {
    position: 'relative',
    paddingTop: 18,
  },
  cardInner: {
    borderRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 120,
    justifyContent: 'center',
    backgroundColor: BakeryColors.honey,
    borderWidth: 1.5,
    borderColor: '#D29649',
    overflow: 'hidden',
    ...BakeryShadow,
  },
  breadScores: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  breadScore: {
    width: 20,
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 248, 241, 0.42)',
  },
  breadScoreLeft: {
    transform: [{ rotate: '-24deg' }],
  },
  breadScoreCenter: {
    transform: [{ rotate: '-10deg' }],
  },
  breadScoreRight: {
    transform: [{ rotate: '16deg' }],
  },
  breadUnitText: { color: BakeryColors.cocoa, lineHeight: 18 },
  breadTitleText: { color: BakeryColors.cocoaDark },
  breadSubText: { color: BakeryColors.cocoa, lineHeight: 20 },
  minutes: { fontSize: 36, lineHeight: 42, color: BakeryColors.cocoaDark },
  label: { marginTop: Spacing.one, textAlign: 'center', color: BakeryColors.cocoaDark },
  customRow: {},
  customBreadWrap: {
    position: 'relative',
    paddingTop: 18,
  },
  customCard: {
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BakeryColors.honey,
    borderWidth: 1.5,
    borderColor: '#D29649',
    overflow: 'hidden',
    ...BakeryShadow,
  },
  customEmoji: { fontSize: 26, lineHeight: 32, width: 34, color: BakeryColors.cocoaDark },
  customText: { flex: 1, gap: 2 },
  customArrow: { color: BakeryColors.cocoaDark, fontWeight: '700', fontSize: 18 },
});
