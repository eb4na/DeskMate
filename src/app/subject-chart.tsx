import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { G, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { useTranslation } from '@/i18n';
import { historyCutoffISO } from '@/lib/history-window';
import { BakeryColors, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';

const RANGES = ['day', 'week', 'month', 'year'] as const;
type Range = (typeof RANGES)[number];

const GENERAL_KEY = 'General Study';
const GENERAL_COLOR = '#B8A98C';
const FALLBACK_COLOR = '#7C6F5A';

const PIE_SIZE = 220;
const RADIUS = PIE_SIZE / 2;

// Earliest dateISO (inclusive) a session must have to fall inside the range.
// Mirrors todayISO()/weekStartISO in the app: derive the date from the current
// instant via toISOString() (UTC), without snapping to local midnight, so this
// threshold agrees with how each SessionRecord.dateISO is stamped.
function rangeStartISO(range: Range): string {
  const d = new Date();
  if (range === 'week') d.setDate(d.getDate() - 6);
  else if (range === 'month') d.setDate(d.getDate() - 29);
  else if (range === 'year') d.setDate(d.getDate() - 364);
  // 'day' keeps today only.
  return d.toISOString().split('T')[0];
}

// SVG arc path for a pie slice spanning [startAngle, endAngle] (degrees,
// clockwise from 12 o'clock), centered on the pie with radius RADIUS.
function slicePath(startAngle: number, endAngle: number): string {
  const polar = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: RADIUS + RADIUS * Math.cos(rad), y: RADIUS + RADIUS * Math.sin(rad) };
  };
  const start = polar(endAngle);
  const end = polar(startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${RADIUS} ${RADIUS} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export default function SubjectChartScreen() {
  const { t } = useTranslation();
  const { sessionHistory, subjects, isPlus } = useApp();
  // Tablet: scale every size by the shared factor so labels/percentages aren't
  // phone-tiny (and the % stops wrapping in its box) on iPad.
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);

  const [range, setRange] = useState<Range>('week');

  // Free accounts only chart the last 3 months, so the "year" range (which would
  // imply older data) is Plus-only; day/week/month all sit inside the window.
  const cutoff = historyCutoffISO(isPlus);
  const availableRanges = isPlus ? RANGES : RANGES.filter((r) => r !== 'year');

  // Minutes per subject within the selected range, sorted descending.
  const slices = useMemo(() => {
    const startISO = rangeStartISO(range);
    const totals: Record<string, number> = {};
    for (const r of sessionHistory) {
      if (r.dateISO < startISO) continue;
      if (cutoff && r.dateISO < cutoff) continue;
      const key = r.subjectName ?? GENERAL_KEY;
      totals[key] = (totals[key] ?? 0) + r.minutes;
    }
    return Object.entries(totals)
      .filter(([, m]) => m > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, minutes]) => {
        const color =
          name === GENERAL_KEY
            ? GENERAL_COLOR
            : subjects.find((s) => s.name === name)?.color ?? FALLBACK_COLOR;
        return { name, minutes, color };
      });
  }, [sessionHistory, subjects, range, cutoff]);

  const total = slices.reduce((sum, s) => sum + s.minutes, 0);

  // Pre-compute each slice's sweep angles so the pie and legend agree.
  const arcs = useMemo(() => {
    let cursor = 0;
    return slices.map((s) => {
      const sweep = total > 0 ? (s.minutes / total) * 360 : 0;
      const arc = { ...s, start: cursor, end: cursor + sweep };
      cursor += sweep;
      return arc;
    });
  }, [slices, total]);

  const subjectLabel = (name: string) => (name === GENERAL_KEY ? t('subjectChart.general') : name);

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBox}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle" style={styles.title}>
            {t('screens.subjectChart')}
          </ThemedText>

          {/* Range picker */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickerRow}>
            {availableRanges.map((r) => {
              const active = r === range;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRange(r)}
                  style={[styles.pill, active && styles.pillActive]}>
                  <ThemedText type="small" style={[styles.pillLabel, active && styles.pillLabelActive]}>
                    {t(`subjectChart.${r}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          {total === 0 ? (
            <ThemedView type="backgroundElement" style={styles.emptyCard}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                {t('subjectChart.noData')}
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              {/* Headline total */}
              <ThemedView type="backgroundElement" style={styles.headlineCard}>
                <ThemedText type="smallBold">{t('subjectChart.totalTime')}</ThemedText>
                <ThemedText style={styles.headlineCount}>
                  {t('subjectChart.minutes', { count: total })}
                </ThemedText>
              </ThemedView>

              {/* Pie */}
              <ThemedView type="backgroundElement" style={styles.chartCard}>
                <Svg width={PIE_SIZE * scale} height={PIE_SIZE * scale} viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`}>
                  <G>
                    {arcs.length === 1 ? (
                      // Single subject: a full disc (arc command can't draw 360°).
                      <Path
                        d={`M ${RADIUS} ${RADIUS} m -${RADIUS} 0 a ${RADIUS} ${RADIUS} 0 1 0 ${PIE_SIZE} 0 a ${RADIUS} ${RADIUS} 0 1 0 -${PIE_SIZE} 0`}
                        fill={arcs[0].color}
                      />
                    ) : (
                      arcs.map((a) => (
                        <Path key={a.name} d={slicePath(a.start, a.end)} fill={a.color} />
                      ))
                    )}
                  </G>
                </Svg>
              </ThemedView>

              {/* Legend */}
              <ThemedView style={styles.legend}>
                {arcs.map((a) => {
                  const pct = Math.round((a.minutes / total) * 100);
                  return (
                    <ThemedView key={a.name} type="backgroundElement" style={styles.legendRow}>
                      <ThemedView type="transparent" style={styles.legendLeft}>
                        <View style={[styles.dot, { backgroundColor: a.color }]} />
                        <ThemedText type="small" style={styles.legendName}>
                          {subjectLabel(a.name)}
                        </ThemedText>
                      </ThemedView>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.legendPct}>
                        {pct}%
                      </ThemedText>
                      <ThemedText type="smallBold" style={styles.legendMins}>
                        {a.minutes}m
                      </ThemedText>
                    </ThemedView>
                  );
                })}
              </ThemedView>
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

// `s` = shared tablet scale (1 on phone). Every font/size/spacing literal × s so the
// chart scales as one piece — the legend % box widens with the scaled text so it no
// longer wraps, and labels aren't phone-tiny on iPad.
const makeStyles = (s: number, contentWidth: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: BakeryColors.frosting },
  scrollBox: { flex: 1 },
  safeArea: {
    paddingHorizontal: Spacing.four * s,
    paddingTop: Spacing.four * s,
    paddingBottom: Spacing.six * s,
    maxWidth: contentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three * s,
  },
  title: { fontSize: 28 * s, lineHeight: 34 * s },
  pickerRow: { gap: Spacing.two * s, paddingVertical: 2 * s, paddingRight: Spacing.four * s },
  pill: {
    paddingHorizontal: Spacing.three * s,
    paddingVertical: 6 * s,
    borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.cream,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  pillActive: { backgroundColor: BakeryColors.rose, borderColor: BakeryColors.berry },
  pillLabel: { fontSize: 13 * s },
  pillLabelActive: { color: BakeryColors.cocoaDark, fontWeight: '700' },
  emptyCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.six * s,
    alignItems: 'center',
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  emptyText: { textAlign: 'center', lineHeight: 20 * s },
  headlineCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.three * s,
    gap: 2 * s,
    backgroundColor: '#FBDCE4',
    borderWidth: 1.5,
    borderColor: BakeryColors.rose,
    ...BakeryShadow,
  },
  headlineCount: { fontSize: 26 * s, fontWeight: '800', lineHeight: 32 * s, color: BakeryColors.berry },
  chartCard: {
    borderRadius: BakeryRadii.card * s,
    padding: Spacing.four * s,
    alignItems: 'center',
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  legend: { gap: Spacing.two * s },
  legendRow: {
    borderRadius: BakeryRadii.card * s,
    paddingVertical: Spacing.two * s,
    paddingHorizontal: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  legendLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 * s },
  dot: { width: 12 * s, height: 12 * s, borderRadius: 6 * s },
  legendName: { fontSize: 13 * s },
  legendPct: { width: 48 * s, textAlign: 'right', fontSize: 13 * s },
  legendMins: { width: 56 * s, textAlign: 'right', fontSize: 13 * s },
  backBtn: { alignItems: 'center', paddingVertical: Spacing.three * s },
});
