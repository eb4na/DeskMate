import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import i18n, { useTranslation } from '@/i18n';
import { historyCutoffISO } from '@/lib/history-window';
import { AFTER_SESSION_MOODS, BEFORE_SESSION_MOODS } from '@/constants/placeholder-data';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

// Mood metadata (image + canonical label) keyed by value, deduped across the
// before/after lists.
const MOOD_META: Record<string, { image: number; label: string }> = {};
for (const m of [...BEFORE_SESSION_MOODS, ...AFTER_SESSION_MOODS]) {
  if (!(m.value in MOOD_META)) MOOD_META[m.value] = { image: m.image, label: m.label };
}

const WEEKS = 8;

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day + (day === 0 ? -6 : 1));
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function MoodChartScreen() {
  const { t } = useTranslation();
  const { moodEntries, isPlus } = useApp();

  // Free accounts only chart the last 3 months of moods; Plus sees the full log.
  const cutoff = historyCutoffISO(isPlus);
  const visibleMoods = useMemo(
    () => (cutoff ? moodEntries.filter((e) => e.timestamp >= cutoff) : moodEntries),
    [moodEntries, cutoff],
  );

  const localeLabel = (value: string, fallback: string) =>
    t(`moods.${value}`, { defaultValue: fallback });

  // Distinct moods the player has actually logged, most frequent first.
  const moodCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of visibleMoods) counts[e.value] = (counts[e.value] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [visibleMoods]);

  const [selected, setSelected] = useState<string | null>(moodCounts[0]?.[0] ?? null);

  // Occurrences of the selected mood, newest first.
  const selectedEntries = useMemo(
    () =>
      visibleMoods
        .filter((e) => e.value === selected)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [visibleMoods, selected],
  );

  // Bucket the selected mood into the last 8 calendar weeks.
  const weekBuckets = useMemo(() => {
    const thisMonday = mondayOf(new Date());
    const buckets = Array.from({ length: WEEKS }, (_, i) => {
      const start = new Date(thisMonday);
      start.setDate(start.getDate() - (WEEKS - 1 - i) * 7);
      return { start, count: 0 };
    });
    for (const e of selectedEntries) {
      const wk = mondayOf(new Date(e.timestamp)).getTime();
      const b = buckets.find((bk) => bk.start.getTime() === wk);
      if (b) b.count += 1;
    }
    return buckets;
  }, [selectedEntries]);

  const maxCount = Math.max(1, ...weekBuckets.map((b) => b.count));
  const total = selectedEntries.length;
  const selMeta = selected ? MOOD_META[selected] : null;
  const selLabel = selected ? localeLabel(selected, selMeta?.label ?? selected) : '';

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBox}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle" style={styles.title}>
            {t('screens.moodChart')}
          </ThemedText>

          {moodCounts.length === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {t('moodChart.noData')}
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              {/* Mood picker */}
              <ThemedText type="smallBold">{t('moodChart.pickMood')}</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pickerRow}>
                {moodCounts.map(([value, count]) => {
                  const meta = MOOD_META[value];
                  const active = value === selected;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setSelected(value)}
                      style={[styles.moodPill, active && styles.moodPillActive]}>
                      {meta?.image && (
                        <Image source={meta.image} style={styles.pillImage} contentFit="contain" />
                      )}
                      <ThemedText type="small" style={[styles.pillLabel, active && styles.pillLabelActive]}>
                        {localeLabel(value, meta?.label ?? value)}
                      </ThemedText>
                      <ThemedText type="small" style={[styles.pillCount, active && styles.pillLabelActive]}>
                        {count}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Headline */}
              <ThemedView type="backgroundElement" style={styles.headlineCard}>
                {selMeta?.image && (
                  <Image source={selMeta.image} style={styles.headlineImage} contentFit="contain" />
                )}
                <View style={styles.headlineText}>
                  <ThemedText type="smallBold">{t('moodChart.headline', { mood: selLabel })}</ThemedText>
                  <ThemedText style={styles.headlineCount}>{t('moodChart.totalTimes', { count: total })}</ThemedText>
                </View>
              </ThemedView>

              {/* 8-week bar chart */}
              <ThemedView style={styles.section}>
                <ThemedText type="smallBold">{t('moodChart.last8Weeks')}</ThemedText>
                <ThemedView type="backgroundElement" style={styles.chartCard}>
                  <ThemedView type="transparent" style={styles.chart}>
                    {weekBuckets.map((b, i) => (
                      <View key={i} style={styles.barCol}>
                        <ThemedText type="small" style={styles.barValue}>
                          {b.count > 0 ? b.count : ''}
                        </ThemedText>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                height: `${b.count > 0 ? Math.max(8, (b.count / maxCount) * 100) : 0}%`,
                              },
                            ]}
                          />
                        </View>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.barLabel}>
                          {b.start.toLocaleDateString(i18n.language || 'en-US', {
                            month: 'numeric',
                            day: 'numeric',
                          })}
                        </ThemedText>
                      </View>
                    ))}
                  </ThemedView>
                </ThemedView>
              </ThemedView>

              {/* Every occurrence */}
              {selectedEntries.length > 0 && (
                <ThemedView style={styles.section}>
                  <ThemedText type="smallBold">{t('moodChart.allTimes')}</ThemedText>
                  <ThemedView style={styles.list}>
                    {selectedEntries.map((e) => (
                      <ThemedView key={e.id} type="backgroundElement" style={styles.listRow}>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.listType}>
                          {e.type === 'before' ? t('progress.before') : t('progress.after')}
                        </ThemedText>
                        <ThemedText type="small" style={styles.listDate}>
                          {new Date(e.timestamp).toLocaleDateString(i18n.language || 'en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {e.sessionMinutes}m
                        </ThemedText>
                      </ThemedView>
                    ))}
                  </ThemedView>
                </ThemedView>
              )}
            </>
          )}

          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('common.close')}
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BakeryColors.frosting },
  scrollBox: { flex: 1 },
  safeArea: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  title: { fontSize: 28, lineHeight: 34 },
  emptyCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.six,
    alignItems: 'center',
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  emptyText: { textAlign: 'center', lineHeight: 20 },
  pickerRow: { gap: Spacing.two, paddingVertical: 2, paddingRight: Spacing.four },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.cream,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  moodPillActive: { backgroundColor: BakeryColors.rose, borderColor: BakeryColors.berry },
  pillImage: { width: 24, height: 24 },
  pillLabel: { fontSize: 13 },
  pillLabelActive: { color: BakeryColors.cocoaDark, fontWeight: '700' },
  pillCount: {
    fontSize: 12,
    fontWeight: '700',
    color: BakeryColors.mocha,
    minWidth: 14,
    textAlign: 'center',
  },
  headlineCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: '#FBDCE4',
    borderWidth: 1.5,
    borderColor: BakeryColors.rose,
    ...BakeryShadow,
  },
  headlineImage: { width: 48, height: 48 },
  headlineText: { flex: 1, gap: 2 },
  headlineCount: { fontSize: 26, fontWeight: '800', lineHeight: 32, color: BakeryColors.berry },
  section: { gap: Spacing.two },
  chartCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barValue: { fontSize: 11, fontWeight: '700', color: BakeryColors.mocha, height: 14 },
  barTrack: {
    width: 16,
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 8, backgroundColor: BakeryColors.berry, minHeight: 0 },
  barLabel: { fontSize: 10 },
  list: { gap: Spacing.two },
  listRow: {
    borderRadius: BakeryRadii.card,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  listType: { width: 44, fontSize: 11 },
  listDate: { flex: 1 },
  backBtn: { alignItems: 'center', paddingVertical: Spacing.three },
});
