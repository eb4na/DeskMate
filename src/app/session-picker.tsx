import { Image } from 'expo-image';
import { router } from 'expo-router';
import { setPendingDragSession } from '@/lib/drag-session';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { playPaper } from '@/lib/sounds';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';

import { CoinIcon } from '@/components/coin-icon';
import { DevKnobs } from '@/components/dev-knobs';
import { FitText } from '@/components/fit-text';
import { usePosTweaks } from '@/hooks/use-pos-tweaks';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { useApp } from '@/context/app-context';
import { newRoomId } from '@/lib/game-net';
import { useStudyRoom } from '@/lib/use-study-room';
import { resolveActiveCompanion } from '@/lib/companion-utils';
import { navigateWithLoading, companionPrefetchUri, STUDY_ASSETS } from '@/lib/preload-nav';
import { SESSION_LENGTHS, autoBreakMinutes, coinsForMinutes, formatCoins, PLUS_STUDY_COIN_MULTIPLIER } from '@/constants/placeholder-data';
import { useTranslation } from '@/i18n';
import { localizeSubjectName } from '@/lib/subject-utils';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { CheckBox } from '@/components/check-menu';
import {
  BiscuitStick, CAFE, CAFE_SOFT_SHADOW, DESSERT, DEFAULT_DESSERT_MIN as DEFAULT_MIN, Drip, Gingham,
  SPRINKLES, SPRINKLES_REV, SprinkleLabel, useBiscuitStick,
} from '@/components/cafe-ui';

// "Soft café" Start Baking menu (design approved 2026-11-19, Artifact
// "Start Session Menu Redesign" › "Theme 1 layout × Theme 3 colors").
// The base is cake colors — cream, vanilla sponge, latte lines — never all-pink.
// Each baking time wears its own dessert's pastel, and the page accent (mode
// switch, biscuit-stick slider, Start button) follows the PICKED dessert.
// Palette, gingham, drip, sprinkle labels + slider are shared via cafe-ui.

const CARD_IMG: Record<number, number> = {
  15: require('@/assets/images/cake/dessert-10.png'),
  30: require('@/assets/images/cake/dessert-25.png'),
  60: require('@/assets/images/cake/dessert-50.png'),
  90: require('@/assets/images/cake/dessert-90.png'),
};
// Lock the Oven's picture — the bunny latte.
const LOCK_IN_IMG = require('@/assets/images/cake/lock-in-cup.png');

type Mode = 'single' | 'multi';

const PICKER_ELEMENTS = [
  { name: 'back', label: 'Back btn' },
  { name: 'coinPill', label: 'Coin pill' },
  { name: 'startBtn', label: 'Start btn' },
];

/** Menu-style dotted leader between a name and its price. RN can't draw dotted
 *  borders on iOS, so it's an SVG line with round-capped zero-length dashes. */
function DottedLeader({ color, g }: { color: string; g: number }) {
  return (
    <View style={{ flex: 1, height: 4 * g, marginHorizontal: 5 * g, marginBottom: 6 * g }}>
      <Svg width="100%" height={4 * g}>
        <Line x1={2 * g} y1={2 * g} x2="100%" y2={2 * g} stroke={color} strokeWidth={2.4 * g} strokeDasharray={`0.1,${5 * g}`} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export default function SessionPickerScreen() {
  const insets = useSafeAreaInsets();
  // Proportional tablet scaling: `scale` is anchored so the 11" Pro reproduces the
  // tuned 1.3×; `grow` re-bases it so bigger iPads (13") grow past that.
  const { isTablet, scale } = useTabletScale();
  const grow = isTablet ? Math.max(1, scale / 1.3) : 1;
  const g = isTablet ? 1.3 * grow : 1;
  const styles = useMemo(() => makeStyles(g, grow), [g, grow]);
  const { knobs: twKnobs, onChange: twChange, t: tw } = usePosTweaks('sessionpicker', PICKER_ELEMENTS);
  const { subjects, coins, isPlus, activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins } = useApp();
  const studyRoom = useStudyRoom();
  const { t } = useTranslation();
  // Preselect the 30-minute bake: opening with nothing chosen left the Start
  // button disabled but still looking tappable, so the first tap did nothing.
  const [selected, setSelected] = useState<number | null>(DEFAULT_MIN);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('single');
  // Solo "lock the oven". Off by default: it costs you the session if you step
  // away, so it has to be chosen, not stumbled into.
  const [lockedIn, setLockedIn] = useState(false);

  // Biscuit-stick slider under the subject tags (food-shaped, no scrollbar).
  const chipStick = useBiscuitStick();

  const activeSubjects = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);
  // The page accent follows the picked dessert.
  const theme = DESSERT[selected ?? DEFAULT_MIN] ?? DESSERT[DEFAULT_MIN];

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  function startSolo() {
    if (selected == null) return;
    const subjectName = selectedSubjectId
      ? subjects.find((s) => s.id === selectedSubjectId && !s.archived)?.name ?? null
      : null;
    setPendingDragSession({
      durationMinutes: selected,
      subjectName,
      lockedIn,
      taskId: null,
      taskTitle: null,
    });
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  }

  function startMultiplayer() {
    studyRoom.joinRoom(newRoomId(), true);
    // Warm my own (possibly remote) companion avatar so it doesn't pop into the
    // lobby roster / study room once it loads.
    const meImg = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins).imageSource;
    navigateWithLoading(
      () =>
        router.push({
          pathname: '/study-lobby',
          // In multiplayer every player sets their own length in the lobby, so
          // this is only the lobby's starting value.
          params: { minutes: String(selected ?? DEFAULT_MIN) },
        }),
      { assets: STUDY_ASSETS, prefetch: [companionPrefetchUri(meImg)] },
    );
  }

  const onStart = () => (mode === 'single' ? startSolo() : startMultiplayer());
  const startDisabled = mode === 'single' && selected == null;

  return (
    <View style={styles.screen}>
      <Gingham />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {/* Top bar — back + coin pill */}
        <View style={[styles.topBar, { paddingTop: insets.top + 4 * g }]}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, tw('back'), pressed && styles.pressed]}
            onPress={goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.back', { defaultValue: 'Back' })}>
            <Svg width={18 * g} height={18 * g} viewBox="0 0 24 24" fill="none">
              <Path d="M15 5l-7 7 7 7" stroke={CAFE.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
          <View style={styles.topSpacer} />
          <Pressable style={({ pressed }) => [styles.coinPill, tw('coinPill'), pressed && styles.pressed]} onPress={() => router.push('/coin-shop')}>
            <CoinIcon size={22 * g} />
            <Text style={styles.coinText}>{formatCoins(coins)}</Text>
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Bake Solo / Bake Together — the picked side takes the dessert's colour */}
          <View style={styles.modeSwitch}>
            {(['single', 'multi'] as const).map((m) => {
              const on = mode === m;
              return (
                <Pressable
                  key={m}
                  style={[styles.modeSeg, on && { backgroundColor: theme.pill }]}
                  onPress={() => setMode(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}>
                  <FitText numberOfLines={1} minScale={0.7} style={[styles.modeText, { color: on ? theme.pillText : CAFE.offText }]}>
                    {t(m === 'single' ? 'sessionPicker.bakeSolo' : 'sessionPicker.bakeTogether')}
                  </FitText>
                </Pressable>
              );
            })}
          </View>

          {/* The café menu card */}
          <View style={styles.cardShadow}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.kicker, { color: theme.ink }]}>{t('sessionPicker.cafeKicker')}</Text>
                <FitText numberOfLines={1} minScale={0.6} style={styles.title}>{t('sessionPicker.bakeTitle')}</FitText>
              </View>
              <Drip color={CAFE.header} height={12 * g} />

              <View style={styles.cardBody}>
                <SprinkleLabel text={t('sessionPicker.bakingTime')} dots={SPRINKLES} g={g} />
                {SESSION_LENGTHS.map((opt) => {
                  const d = DESSERT[opt.minutes] ?? DESSERT[DEFAULT_MIN];
                  const on = selected === opt.minutes;
                  const brk = autoBreakMinutes(opt.minutes);
                  return (
                    <Pressable
                      key={opt.minutes}
                      style={({ pressed }) => [styles.row, on && { backgroundColor: d.soft, borderColor: d.ring }, pressed && styles.pressed]}
                      onPress={() => { playPaper(); setSelected(opt.minutes); }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}>
                      <View style={[styles.plate, { backgroundColor: d.plate }]}>
                        <Image source={CARD_IMG[opt.minutes]} style={styles.plateImg} contentFit="contain" />
                      </View>
                      <View style={styles.rowBody}>
                        <View style={styles.rowTop}>
                          <FitText numberOfLines={1} minScale={0.7} style={[styles.rowName, { color: d.ink }]}>
                            {t(`sessionPicker.bake_${opt.minutes}`)}
                          </FitText>
                          <DottedLeader color={d.leader} g={g} />
                          <CoinIcon size={15 * g} style={styles.rowCoin} />
                          <Text style={styles.rowPrice}>{coinsForMinutes(opt.minutes) * (isPlus ? PLUS_STUDY_COIN_MULTIPLIER : 1)}</Text>
                        </View>
                        <Text style={styles.rowDesc} numberOfLines={1}>
                          {opt.minutes} {t('customTimer.min')}
                          {brk > 0 ? `  ·  ${t('sessionPicker.teaBreak', { min: brk })}` : ''}
                        </Text>
                      </View>
                      {/* Every option shows a box; it fills with a check when picked. */}
                      <CheckBox checked={on} size={24 * g} color={d.tick} ink={CAFE.box} />
                    </Pressable>
                  );
                })}

                <SprinkleLabel text={t('sessionPicker.flavorHeader')} dots={SPRINKLES_REV} g={g} />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                  {...chipStick.scrollProps}>
                  {activeSubjects.map((s) => {
                    const on = selectedSubjectId === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        style={[styles.chip, { backgroundColor: `${s.color}1F`, borderColor: on ? s.color : `${s.color}1F` }]}
                        onPress={() => setSelectedSubjectId(on ? null : s.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}>
                        <View style={[styles.chipDot, { backgroundColor: s.color }]} />
                        <Text style={styles.chipText}>
                          {s.emoji ? `${s.emoji} ` : ''}{localizeSubjectName(s.name, t)}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable style={[styles.chip, styles.chipAdd]} onPress={() => router.push('/manage-subjects')} accessibilityRole="button">
                    <Text style={[styles.chipText, styles.chipAddText]}>{t('common.addChip')}</Text>
                  </Pressable>
                </ScrollView>
                <BiscuitStick view={chipStick.view} track={theme.plate} coat={theme.coat} g={g} />

                {mode === 'single' ? (
                  // Solo extras: Lock the Oven + Custom Bake, side by side. Not offered
                  // in a shared room (one person's text would end everyone's bake).
                  <View style={styles.extrasRow}>
                    <Pressable
                      style={({ pressed }) => [styles.lockCard, lockedIn && { backgroundColor: theme.soft, borderColor: theme.ring }, pressed && styles.pressed]}
                      onPress={() => { playPaper(); setLockedIn((v) => !v); }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: lockedIn }}>
                      <Image source={LOCK_IN_IMG} style={styles.lockImg} contentFit="contain" />
                      <View style={styles.lockBody}>
                        <FitText numberOfLines={1} minScale={0.6} style={styles.lockTitle}>{t('sessionPicker.lockOven')}</FitText>
                        <View style={styles.lockNoteRow}>
                          <CoinIcon size={12 * g} />
                          <FitText numberOfLines={1} minScale={0.7} style={[styles.cardNote, styles.lockNote]}>{t('sessionPicker.lockOvenNote')}</FitText>
                        </View>
                      </View>
                      <CheckBox checked={lockedIn} size={22 * g} color={theme.tick} ink={CAFE.box} />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.customCard, pressed && styles.pressed]}
                      onPress={() => router.push('/custom-timer')}
                      accessibilityRole="button">
                      <FitText numberOfLines={1} minScale={0.6} style={styles.customTitle}>{t('sessionPicker.customBake')} ›</FitText>
                      <Text style={[styles.cardNote, styles.customNote]} numberOfLines={1}>{t('sessionPicker.customBakeSub')}</Text>
                    </Pressable>
                  </View>
                ) : (
                  // Baking together never bakes a recipe — said up front as a menu footnote.
                  <Text style={styles.footnote}>{t('sessionPicker.multiNoRecipeFoot')}</Text>
                )}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* One call to action, pinned below the menu. No break caption. */}
        <View style={styles.startBlock}>
          <SoundPressable
            sound="confirm"
            disabled={startDisabled}
            style={({ pressed }) => [
              styles.startBtn,
              tw('startBtn'),
              { backgroundColor: theme.btn, shadowColor: theme.btn },
              startDisabled && styles.startBtnDisabled,
              pressed && styles.pressed,
            ]}
            onPress={onStart}>
            <Text style={[styles.startBtnText, { color: theme.btnText }]}>{t('sessionPicker.startBaking')}  →</Text>
          </SoundPressable>
        </View>
      </SafeAreaView>
      <DevKnobs screen="sessionpicker" knobs={twKnobs} onChange={twChange} />
    </View>
  );
}

// `g` scales every size on tablet (1 on phones); `grow` only widens the column on
// iPads bigger than the 11" reference. Colours/flex are left alone.
const makeStyles = (g: number, grow: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: CAFE.bg },
  safe: { flex: 1, paddingHorizontal: 16 * g, maxWidth: MaxContentWidth * grow, width: '100%', alignSelf: 'center' },
  scroll: { paddingBottom: 12 * g, gap: 12 * g },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 10 * g },
  topSpacer: { flex: 1 },
  iconBtn: {
    width: 44 * g, height: 44 * g, borderRadius: 22 * g,
    backgroundColor: CAFE.paper, borderWidth: 1.5, borderColor: CAFE.line,
    alignItems: 'center', justifyContent: 'center', ...CAFE_SOFT_SHADOW,
  },
  coinPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7 * g, height: 40 * g,
    paddingLeft: 10 * g, paddingRight: 14 * g, borderRadius: 20 * g,
    backgroundColor: CAFE.paper, borderWidth: 1.5, borderColor: CAFE.line, ...CAFE_SOFT_SHADOW,
  },
  coinText: { fontFamily: Fonts.rounded, fontSize: 16 * g, fontWeight: '800', color: CAFE.ink },

  // Mode switch
  modeSwitch: {
    flexDirection: 'row', gap: 6 * g, padding: 4 * g, borderRadius: 26 * g,
    backgroundColor: CAFE.paper, borderWidth: 1.5, borderColor: CAFE.line, ...CAFE_SOFT_SHADOW,
  },
  // alignItems 'stretch' (not 'center') so FitText measures the full width.
  modeSeg: { flex: 1, height: 40 * g, borderRadius: 20 * g, justifyContent: 'center', alignItems: 'stretch', paddingHorizontal: 8 * g },
  modeText: { fontFamily: Fonts.rounded, fontSize: 15.5 * g, fontWeight: '800', textAlign: 'center' },

  // Menu card (shadow lives on a wrapper: overflow:hidden would clip it on iOS)
  cardShadow: {
    borderRadius: 18 * g, backgroundColor: CAFE.paper,
    shadowColor: 'rgb(150,110,80)', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 3,
  },
  card: { borderRadius: 18 * g, borderWidth: 1.5, borderColor: CAFE.line, backgroundColor: CAFE.paper, overflow: 'hidden' },
  cardHeader: { backgroundColor: CAFE.header, paddingTop: 12 * g, paddingHorizontal: 14 * g, paddingBottom: 4 * g, alignItems: 'stretch' },
  kicker: { fontFamily: Fonts.rounded, fontSize: 10 * g, fontWeight: '900', letterSpacing: 3 * g, textAlign: 'center' },
  title: { fontFamily: Fonts.serif, fontSize: 28 * g, fontWeight: '700', color: CAFE.title, textAlign: 'center' },
  cardBody: { paddingHorizontal: 12 * g, paddingTop: 2 * g, paddingBottom: 12 * g },


  // Baking-time rows
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10 * g,
    paddingVertical: 4 * g, paddingLeft: 4 * g, paddingRight: 6 * g, marginBottom: 4 * g,
    borderRadius: 14 * g, borderWidth: 1.5, borderColor: 'transparent',
  },
  plate: { width: 46 * g, height: 46 * g, borderRadius: 23 * g, alignItems: 'center', justifyContent: 'center' },
  plateImg: { width: 40 * g, height: 40 * g },
  rowBody: { flex: 1, minWidth: 0, gap: 1 * g },
  rowTop: { flexDirection: 'row', alignItems: 'flex-end' },
  rowName: { fontFamily: Fonts.rounded, fontSize: 16 * g, fontWeight: '800', flexShrink: 1 },
  rowCoin: { marginBottom: 2 * g },
  rowPrice: { fontFamily: Fonts.rounded, fontSize: 15 * g, fontWeight: '800', color: CAFE.ink, marginLeft: 3 * g },
  rowDesc: { fontFamily: Fonts.rounded, fontSize: 12.5 * g, fontWeight: '700', color: CAFE.inkSoft },

  // Subject tags
  chipRow: { flexDirection: 'row', gap: 6 * g, alignItems: 'center', paddingRight: 4 * g },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6 * g, height: 32 * g, paddingHorizontal: 12 * g, borderRadius: 16 * g, borderWidth: 1.5 },
  chipDot: { width: 8 * g, height: 8 * g, borderRadius: 4 * g },
  chipText: { fontFamily: Fonts.rounded, fontSize: 13.5 * g, fontWeight: '800', color: CAFE.ink },
  chipAdd: { borderStyle: 'dashed', borderColor: '#D9C3B0', backgroundColor: CAFE.paper },
  chipAddText: { color: '#7A5440' },


  // Solo extras
  extrasRow: { flexDirection: 'row', gap: 6 * g, marginTop: 10 * g },
  lockCard: {
    flex: 1.45, flexDirection: 'row', alignItems: 'center', gap: 6 * g, minHeight: 50 * g,
    paddingLeft: 4 * g, paddingRight: 6 * g, borderRadius: 14 * g, borderWidth: 1.5,
    borderColor: CAFE.line, backgroundColor: '#FFFAF4',
  },
  lockImg: { width: 36 * g, height: 36 * g },
  lockBody: { flex: 1, minWidth: 0 },
  lockTitle: { fontFamily: Fonts.rounded, fontSize: 14.5 * g, fontWeight: '800', color: CAFE.title },
  lockNoteRow: { flexDirection: 'row', alignItems: 'center', gap: 3 * g },
  // flex:1 gives FitText a definite width to shrink into (else it just truncates).
  lockNote: { flex: 1 },
  cardNote: { fontFamily: Fonts.rounded, fontSize: 11.5 * g, fontWeight: '700', color: CAFE.inkSoft, flexShrink: 1 },
  customCard: {
    flex: 1, minHeight: 50 * g, borderRadius: 14 * g, borderWidth: 1.5,
    borderColor: '#F2DEC0', backgroundColor: '#FFF5E6',
    justifyContent: 'center', alignItems: 'stretch', paddingHorizontal: 8 * g,
  },
  customTitle: { fontFamily: Fonts.rounded, fontSize: 14.5 * g, fontWeight: '800', color: '#8A5320', textAlign: 'center' },
  customNote: { textAlign: 'center' },
  footnote: {
    fontFamily: Fonts.serif, fontStyle: 'italic', fontSize: 13 * g, lineHeight: 19 * g,
    color: CAFE.inkSoft, textAlign: 'center', marginTop: 12 * g, marginHorizontal: 4 * g,
  },

  // Start
  startBlock: { paddingTop: 10 * g, paddingBottom: 8 * g },
  startBtn: {
    height: 54 * g, borderRadius: 27 * g, alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.3, shadowRadius: 11, shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  startBtnDisabled: { opacity: 0.5 },
  startBtnText: { fontFamily: Fonts.rounded, fontSize: 19 * g, fontWeight: '800', letterSpacing: 0.3 },
  pressed: { opacity: 0.85 },
});
