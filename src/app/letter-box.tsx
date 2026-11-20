// Letter box — one companion's keepsakes: the notes and little stories they left on the
// desk while the player was away, plus their bond letters (levels 2–15). Opened from
// the companion's card in the gallery (`?persona=<key>&name=<canonical name>`).
//
// Notes open INLINE (KeepsakeOverlay as an absolute-fill view, never a route or a
// Modal): this screen is itself a modal pushed over the gallery modal, and iOS
// silently refuses a third stacked native modal.
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FitText } from '@/components/fit-text';
import { formatKeepsakeDate, KeepsakeOverlay } from '@/components/keepsake-overlay';
import { NotebookBackground } from '@/components/notebook-background';
import { Envelope } from '@/components/paper-note';
import { BakeryColors, MaxContentWidth } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useIsTablet } from '@/hooks/use-device-class';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import type { Keepsake, PersonaKey } from '@/lib/companion-moments';
import { localizeCompanionName } from '@/lib/companion-utils';
import { awayEntry, letterText, noteFontFamily } from '@/lib/companion-voice';

type Filter = 'all' | 'note' | 'story' | 'letter';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'ui.filterAll' },
  { key: 'note', label: 'ui.filterNotes' },
  { key: 'story', label: 'ui.filterStories' },
  { key: 'letter', label: 'ui.filterLetters' },
];
const PERSONAS: readonly PersonaKey[] = ['bun', 'bunny', 'miel', 'gray', 'tira', 'hanji', 'cocoa', 'generic'];
const TAPES = ['rgba(247,167,184,0.62)', 'rgba(170,200,232,0.6)', 'rgba(255,214,140,0.65)', 'rgba(170,215,180,0.62)', 'rgba(190,170,230,0.6)'];
const INK = '#5D3C2E';
const MUTED = '#8A6A5C';
const ACCENT = '#9C4A5C';

function keepsakeText(k: Keepsake): string | null {
  return k.kind === 'letter' ? letterText(k.persona, k.level ?? 0) : awayEntry(k.persona, k.contentId)?.text ?? null;
}

export default function LetterBoxScreen() {
  const params = useLocalSearchParams<{ persona?: string; name?: string }>();
  const persona: PersonaKey = PERSONAS.includes(params.persona as PersonaKey) ? (params.persona as PersonaKey) : 'generic';
  const { t } = useTranslation('companion');
  const { t: tMain } = useTranslation();
  const { keepsakes, language } = useApp();
  const isTablet = useIsTablet();
  const { width: winW } = useWindowDimensions();
  const [filter, setFilter] = useState<Filter>('all');
  // Held in local state so the note stays mounted after the overlay marks it seen.
  const [opened, setOpened] = useState<Keepsake | null>(null);

  useEffect(() => {
    track('letter_box_opened');
  }, []);

  const companionName = localizeCompanionName(params.name ?? '', tMain);

  // This companion's keepsakes whose text still resolves, newest first (ties: the one
  // filed later first, so a run of back-filled letters reads 5, 4, 3…).
  const mine = useMemo(() => {
    return keepsakes
      .map((k, i) => ({ k, i }))
      .filter(({ k }) => k.persona === persona && !!keepsakeText(k))
      .sort((a, b) => (a.k.dateISO === b.k.dateISO ? b.i - a.i : a.k.dateISO < b.k.dateISO ? 1 : -1))
      .map(({ k }) => k);
  }, [keepsakes, persona]);
  const shown = filter === 'all' ? mine : mine.filter((k) => k.kind === filter);

  const contentW = Math.min(winW, isTablet ? 640 : MaxContentWidth) - 40;
  const gap = 16;
  const tileW = Math.floor((contentW - gap) / 2);
  const font = noteFontFamily(language);

  return (
    <View style={styles.root}>
      <NotebookBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={[styles.header, { width: contentW }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tMain('common.back')}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.back}
            hitSlop={6}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d="M15 5 L8 12 L15 19" stroke={INK} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </Pressable>
          <View style={styles.headText}>
            <FitText style={styles.title} numberOfLines={1}>
              {t('ui.letterBoxTitle', { name: companionName })}
            </FitText>
            <Text style={styles.count}>{t('ui.count', { count: mine.length })}</Text>
          </View>
        </View>

        <View style={[styles.pills, { width: contentW }]}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <Pressable
                key={f.key}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => setFilter(f.key)}
                style={[styles.pill, on && styles.pillOn]}>
                <Text style={[styles.pillText, on && styles.pillTextOn]}>{t(f.label)}</Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={[styles.grid, { width: contentW, columnGap: gap }]} showsVerticalScrollIndicator={false}>
          {shown.length === 0 ? (
            <Text style={[styles.empty, { width: contentW }]}>{t('ui.empty', { name: companionName })}</Text>
          ) : (
            shown.map((k, i) => {
              // Anything not opened yet shows sealed with a dot — the same rule as the
              // gallery's Letters dot, so the dot always points at something visible.
              const sealed = !k.seen;
              const label =
                k.kind === 'letter'
                  ? t('ui.kindLetter', { level: k.level ?? 0 })
                  : `${t(k.kind === 'story' ? 'ui.kindStory' : 'ui.kindNote')} · ${formatKeepsakeDate(k.dateISO, language)}`;
              return (
                <Pressable
                  key={k.id}
                  accessibilityRole="button"
                  accessibilityLabel={sealed ? `${label}, ${t('ui.newBadge')}` : label}
                  onPress={() => setOpened(k)}
                  style={[styles.tile, { width: tileW, transform: [{ rotate: `${i % 2 === 0 ? -1.5 : 1.5}deg` }] }]}>
                  {sealed ? (
                    <View style={styles.sealedBox}>
                      <Envelope width={Math.min(112, tileW - 30)} sealed />
                      <View style={styles.dot} />
                    </View>
                  ) : (
                    <View style={styles.paper}>
                      <View style={[styles.tape, { backgroundColor: TAPES[i % TAPES.length] }]} />
                      <Text style={[styles.preview, { fontFamily: font, fontSize: font ? 19 : 15 }]} numberOfLines={4}>
                        {keepsakeText(k)}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.tileLabel, sealed && styles.tileLabelNew]} numberOfLines={1}>
                    {sealed ? `${label} · ${t('ui.newBadge')}` : label}
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>

      {opened ? <KeepsakeOverlay keepsake={opened} companionName={companionName} onClose={() => setOpened(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: INK,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  headText: { flex: 1 },
  title: { fontSize: 24, fontWeight: '900', color: INK },
  count: { fontSize: 13, fontWeight: '700', color: MUTED },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 14, paddingBottom: 18 },
  pill: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#FFFDF8',
    borderWidth: 1.5,
    borderColor: '#F1BDCC',
  },
  pillOn: { backgroundColor: BakeryColors.buttonPink, borderColor: BakeryColors.buttonPink },
  pillText: { fontSize: 14, fontWeight: '800', color: INK },
  pillTextOn: { color: '#FFFFFF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 26, paddingTop: 8, paddingBottom: 40 },
  tile: { minHeight: 44 },
  paper: {
    height: 116,
    borderRadius: 4,
    backgroundColor: '#FFFBF4',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 6,
    shadowColor: INK,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  tape: { position: 'absolute', top: -9, alignSelf: 'center', width: 56, height: 16, transform: [{ rotate: '-4deg' }] },
  preview: { color: INK, lineHeight: 22 },
  sealedBox: {
    height: 116,
    borderRadius: 4,
    backgroundColor: '#FBE1E8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: INK,
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  dot: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: BakeryColors.buttonPink,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  tileLabel: { marginTop: 8, fontSize: 12, fontWeight: '800', color: MUTED },
  tileLabelNew: { color: ACCENT },
  empty: { fontSize: 15, fontWeight: '700', color: MUTED, textAlign: 'center', lineHeight: 22, paddingTop: 40 },
});
