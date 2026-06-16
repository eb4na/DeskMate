import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SoundPreviewButton } from '@/components/sound-preview-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { stopPreview } from '@/lib/ambience-audio';
import i18n, { useTranslation } from '@/i18n';
import { MaxContentWidth, Spacing } from '@/constants/theme';

// Emojis are interim placeholders so each sound has a distinct picture; swap for
// real per-sound art (assets/images/sounds/<id>.png) when it's drawn.
export const AMBIENCE_OPTIONS = [
  { id: 'rain', emoji: '🌧️' },
  { id: 'ocean', emoji: '🌊' },
  { id: 'fireplace', emoji: '🔥' },
  { id: 'night', emoji: '🌙' },
] as const;

export type AmbienceId = (typeof AMBIENCE_OPTIONS)[number]['id'];

export function getAmbienceName(id: string): string {
  return AMBIENCE_OPTIONS.some((a) => a.id === id) ? i18n.t(`ambience.name_${id}`) : id;
}
export function getAmbienceEmoji(id: string): string {
  return AMBIENCE_OPTIONS.find((a) => a.id === id)?.emoji ?? '';
}

function AmbienceContent() {
  const { t } = useTranslation();
  const { ambienceId, setAmbience, isPlus, ownedShopItems } = useApp();

  // Stop any running preview when leaving the screen.
  useEffect(() => () => stopPreview(), []);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="default" themeColor="textSecondary" style={styles.hint}>
          {t('ambience.hint')}
        </ThemedText>

        <ThemedView style={styles.grid}>
          {AMBIENCE_OPTIONS.map((opt) => {
            // Plus unlocks every sound; everyone else uses the ones they've bought
            // in the shop (sound_<id>). Locked cards send you to the shop.
            const unlocked = isPlus || ownedShopItems.includes(`sound_${opt.id}`);
            const selected = unlocked && ambienceId === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={({ pressed }) => [pressed && styles.pressed]}
                onPress={() =>
                  unlocked
                    ? setAmbience(selected ? null : opt.id)
                    : router.replace({ pathname: '/shop', params: { category: 'sound' } })
                }>
                <ThemedView
                  type="backgroundElement"
                  style={[styles.card, selected && styles.cardSelected, !unlocked && styles.cardLocked]}>
                  <SoundPreviewButton id={opt.id} style={styles.previewBtn} />
                  <ThemedText style={styles.cardEmoji}>{opt.emoji}</ThemedText>
                  <ThemedText type="smallBold" style={styles.cardName}>
                    {t(`ambience.name_${opt.id}`)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.cardDesc}>
                    {t(`ambience.desc_${opt.id}`)}
                  </ThemedText>
                  {unlocked ? (
                    selected && (
                      <ThemedView style={styles.selectedBadge}>
                        <ThemedText style={styles.selectedBadgeText}>{t('ambience.active')}</ThemedText>
                      </ThemedView>
                    )
                  ) : (
                    <ThemedView style={styles.lockedBadge}>
                      <ThemedText style={styles.lockedBadgeText}>{t('shop.lockedBadge')}</ThemedText>
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
              {t('ambience.clearAmbience')}
            </ThemedText>
          </Pressable>
        )}

        <ThemedView type="backgroundElement" style={styles.noticeCard}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
            {t('ambience.audioNotice')}
          </ThemedText>
        </ThemedView>

        <Pressable onPress={() => router.back()} style={styles.doneBtn}>
          <ThemedText type="smallBold" style={styles.doneBtnText}>
            {t('common.done')}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ScrollView>
  );
}

export default function AmbiencePickerScreen() {
  // No blanket Plus lock: Plus members get all sounds, everyone else picks from the
  // ones they've bought in the shop (the cards gate themselves).
  return (
    <ThemedView style={styles.container}>
      <AmbienceContent />
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
    position: 'relative',
  },
  previewBtn: { position: 'absolute', top: 10, right: 10 },
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
  cardLocked: { opacity: 0.6 },
  lockedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(124,111,90,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  lockedBadgeText: { fontSize: 12, color: '#9A7B6D', fontWeight: '700' },
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  noticeCard: { borderRadius: 12, padding: Spacing.three },
  noticeText: { textAlign: 'center', lineHeight: 20 },
  doneBtn: {
    backgroundColor: '#F7A7B8',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  doneBtnText: { color: '#FFF', fontSize: 16 },
  pressed: { opacity: 0.85 },
});
