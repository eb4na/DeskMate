// First-launch coachmark tour. Shows a handful of popups (no screen dimming),
// each with a short line of text and an arrow pointing at the real UI element
// (Start Session, the streak + coin chips, and the Tasks / Shop tabs). Anchors
// register their native node via setTutorialTarget; we measure the live window
// rect per step so arrows land correctly on both phone and tablet. Gated +
// dismissed by the persisted `tutorialSeen` flag in app-context.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from '@/i18n';

import { ThemedText } from '@/components/themed-text';
import { measureTutorialTarget, type TargetRect } from '@/lib/tutorial-targets';
import { BakeryColors } from '@/constants/theme';

// The most important starting features, in order. Edit this array to change which
// elements get a popup (each `target` must be a registered anchor).
const STEPS: { target: string; titleKey: string; bodyKey: string }[] = [
  { target: 'start', titleKey: 'tutorial.start_title', bodyKey: 'tutorial.start_body' },
  { target: 'streak', titleKey: 'tutorial.streak_title', bodyKey: 'tutorial.streak_body' },
  { target: 'coins', titleKey: 'tutorial.coins_title', bodyKey: 'tutorial.coins_body' },
  { target: 'switchChar', titleKey: 'tutorial.character_title', bodyKey: 'tutorial.character_body' },
  { target: 'food', titleKey: 'tutorial.recipe_title', bodyKey: 'tutorial.recipe_body' },
  { target: 'editRoom', titleKey: 'tutorial.room_title', bodyKey: 'tutorial.room_body' },
  { target: 'tasks', titleKey: 'tutorial.tasks_title', bodyKey: 'tutorial.tasks_body' },
  { target: 'shop', titleKey: 'tutorial.shop_title', bodyKey: 'tutorial.shop_body' },
];

const CARD_W = 250;
const SCREEN_PAD = 16;
const GAP = 12; // space between the target and the tooltip card

export function HomeTutorial({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<TargetRect | null>(null);

  // Measure the current step's anchor (retry briefly — the tab bar mounts a tick
  // after the home screen). A null rect just hides the arrow, not the card.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const measure = async () => {
      const r = await measureTutorialTarget(STEPS[step].target);
      if (cancelled) return;
      if (r) setRect(r);
      else if (tries++ < 8) setTimeout(measure, 60);
      else setRect(null);
    };
    setRect(null);
    measure();
    return () => { cancelled = true; };
  }, [step]);

  const isLast = step >= STEPS.length - 1;
  const next = () => (isLast ? onDone() : setStep((s) => s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const s = STEPS[step];

  // Decide whether the card sits above or below the target, and where its arrow
  // points. When we have no rect yet, center the card so text still reads.
  const targetCY = rect ? rect.y + rect.height / 2 : screenH / 2;
  const below = targetCY < screenH * 0.5; // target in top half → card goes below it
  const targetCX = rect ? rect.x + rect.width / 2 : screenW / 2;

  const cardLeft = Math.max(SCREEN_PAD, Math.min(targetCX - CARD_W / 2, screenW - SCREEN_PAD - CARD_W));
  const cardTop = rect
    ? below
      ? rect.y + rect.height + GAP + 8 // +8 leaves room for the arrow
      : undefined
    : screenH / 2 - 60;
  const cardBottom = rect && !below ? screenH - (rect.y - GAP - 8) : undefined;

  // Arrow horizontal position relative to the card (clamped inside it).
  const arrowLeft = Math.max(16, Math.min(targetCX - cardLeft - 8, CARD_W - 32));

  return (
    // High zIndex so the overlay sits above every home element (which use zIndex up
    // to 30) — otherwise those paint over the tap-catcher and taps do nothing. NOTE:
    // intentionally NOT a native <Modal> — wrapping this in a transparent Modal could
    // present an invisible touch-blocking layer (no visible card) that froze the home
    // screen, so the coachmark lives in-screen as a high-zIndex overlay instead.
    //
    // The overlay itself is the full-screen tap-catcher (a Pressable, NOT a box-none
    // View with a child catcher): a box-none parent delegates hit-testing to children,
    // and a transparent child catcher under it could drop taps so nothing advanced.
    // Making the root Pressable claim the touch directly is what fixes the freeze.
    <Pressable style={[StyleSheet.absoluteFill, styles.overlay]} onPress={next}>
      {/* Tooltip card. Itself a Pressable that advances, so tapping the card (not
          just the backdrop around it) isn't a dead zone — the Back/Skip pressables
          nested below still take their own taps first. */}
      <Pressable
        onPress={next}
        style={[
          styles.card,
          { left: cardLeft, width: CARD_W, top: cardTop, bottom: cardBottom },
        ]}>
        {/* Arrow pointing at the target. */}
        {rect && (
          <View
            pointerEvents="none"
            style={[
              below ? styles.arrowUp : styles.arrowDown,
              { left: arrowLeft },
              below ? { top: -8 } : { bottom: -8 },
            ]}
          />
        )}
        <ThemedText type="smallBold" style={styles.title}>{t(s.titleKey)}</ThemedText>
        <ThemedText type="small" style={styles.body}>{t(s.bodyKey)}</ThemedText>

        <View style={styles.footer}>
          {step > 0 ? (
            <Pressable onPress={back} hitSlop={6}>
              <ThemedText type="small" style={styles.navText}>{t('tutorial.back')}</ThemedText>
            </Pressable>
          ) : (
            <Pressable onPress={onDone} hitSlop={6}>
              <ThemedText type="small" style={styles.skipText}>{t('tutorial.skip')}</ThemedText>
            </Pressable>
          )}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>
          <Pressable onPress={next} hitSlop={6}>
            <ThemedText type="small" style={styles.navText}>
              {isLast ? t('tutorial.done') : t('tutorial.next')}
            </ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 100 },
  card: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: { fontSize: 15, marginBottom: 4 },
  body: { color: BakeryColors.mocha, lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BakeryColors.shortbread },
  dotActive: { backgroundColor: BakeryColors.berry, width: 16 },
  navText: { color: BakeryColors.berry, fontSize: 12, fontWeight: '700' },
  navSpacer: { width: 44 },
  skipText: { color: BakeryColors.latte, fontSize: 12 },
  arrowUp: {
    position: 'absolute',
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFFFFF',
  },
  arrowDown: {
    position: 'absolute',
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFFFFF',
  },
});
