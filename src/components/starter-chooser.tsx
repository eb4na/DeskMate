import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FOOD_ITEMS } from '@/app/food-gallery';
import { starterRecipe } from '@/constants/recipes';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { localizeCompanionName, STARTER_CHOICES } from '@/lib/companion-utils';
import { showLoadingScreen } from '@/lib/loading-signal';
import { playSwoosh, playTapConfirm } from '@/lib/sounds';

// Per-character tagline i18n keys (shared with the gallery), keyed by the
// canonical English name in STARTER_CHOICES.
const TAGLINE_KEYS: Record<string, string> = {
  Bun: 'gallery.tagline_Bun',
  Cocoa: 'gallery.tagline_Cocoa',
  Bunny: 'gallery.tagline_Bunny',
  Miel: 'gallery.tagline_Miel',
  Tira: 'gallery.tagline_Tira',
};

// Soft patisserie palette, matching the Companion Bakery.
const P = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F7A7B8',
  pinkSoft: '#FBD9E0',
  brown: '#5B3A2E',
  mutedBrown: '#9A7B6D',
  arrow: '#C75A78',
} as const;

function Chevron({ dir, size = 30 }: { dir: 'left' | 'right'; size?: number }) {
  // A simple chevron; mirror horizontally for "left".
  const d = dir === 'right' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={d} stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// First-launch starter picker: a one-of-five carousel. Swipe or tap the arrows to
// advance (wraps Tira → Bun); the chosen character is granted free and the other
// four go to the shop. Shown once, after the legal consent gate, for any new
// account or guest (gated on !starterChosen).
export function StarterChooser() {
  const { t } = useTranslation();
  const { chooseStarter } = useApp();
  const [index, setIndex] = useState(0); // starts on Bun (STARTER_CHOICES[0])
  const choice = STARTER_CHOICES[index];
  // The companions on either side, shown as faded sneak peeks at the edges so you
  // can tell who's next (wraps around).
  const n = STARTER_CHOICES.length;
  const prev = STARTER_CHOICES[(index - 1 + n) % n];
  const next = STARTER_CHOICES[(index + 1) % n];

  // Idle bounce — identical feel to the Home companion: a slow rise with a tiny
  // squash-and-stretch. 0 = resting (squished), 1 = apex (stretched).
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    bounce.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);
  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const scaleY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] });
  const scaleX = bounce.interpolate({ inputRange: [0, 1], outputRange: [1.02, 0.99] });

  const step = (delta: number) => {
    playSwoosh();
    setIndex((i) => (i + delta + STARTER_CHOICES.length) % STARTER_CHOICES.length);
  };

  // Swipe the carousel left/right to flip companions (in addition to the arrows).
  // Only claims the gesture on a clear horizontal drag, so taps on the arrows and
  // the confirm button still work. Created once — `step` reads no stale state.
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -40) step(1); // swipe left → next
        else if (g.dx >= 40) step(-1); // swipe right → previous
      },
    }),
  ).current;

  const name = localizeCompanionName(choice.name, t);

  // The signature recipe granted alongside this character (Bun's is free for
  // everyone). Shown as a small "comes with" chip — the character is the focus,
  // this just hints at the bake that joins them. Matches chooseStarter's mapping.
  const recipeId =
    starterRecipe(choice.activeId === 'starter:girl' ? '' : choice.activeId)?.recipeId ??
    'strawberry-shortcake';
  const recipeImage = (FOOD_ITEMS.find((f) => f.id === recipeId) ?? FOOD_ITEMS[0]).image;
  const recipeName = t(`foodGallery.food_${recipeId}`);

  // Confirm the pick. The home screen is already mounted behind this chooser
  // showing the DEFAULT Bun, and the post-pick celebration card has a transparent
  // backdrop — so without this the player watches Bun visibly swap to their pick
  // behind the card. Play the quick loading screen FIRST (preloading the chosen
  // companion's art) and only run chooseStarter once the loader lifts, so home is
  // already warm on the chosen character. The loader's own failsafe lifts it even
  // if the preload hangs, so this can never get stuck.
  const [submitting, setSubmitting] = useState(false);
  // "Choose" first opens an are-you-sure card (the pick is permanent — the other
  // four become paid shop items), and only the card's Yes actually commits.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const askConfirm = () => {
    playTapConfirm();
    setConfirmOpen(true);
  };
  const confirm = () => {
    if (submitting) return;
    setSubmitting(true);
    playTapConfirm();
    showLoadingScreen(() => chooseStarter(choice.activeId), {
      quick: true,
      until: Asset.loadAsync(choice.image).catch(() => {}),
    });
  };

  return (
    <View style={styles.root}>
      {/* While the loader plays over the chooser, hide the carousel so the loader's
          fade-out reveals just the cream backdrop (not a flash of the old card). */}
      {!submitting && (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('starter.title')}</Text>
          <Text style={styles.subtitle}>{t('starter.subtitle')}</Text>
        </View>

        {/* Carousel — swipe to flip, or use the left/right arrows. The
            neighbouring companions peek in, faded, at the edges. */}
        <View style={styles.stage} {...swipe.panHandlers}>
          <View style={styles.peekLeft} pointerEvents="none">
            <Image source={prev.image} style={styles.peekImage} contentFit="contain" />
          </View>
          <View style={styles.peekRight} pointerEvents="none">
            <Image source={next.image} style={styles.peekImage} contentFit="contain" />
          </View>

          <Pressable
            onPress={() => step(-1)}
            hitSlop={12}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
            <Chevron dir="left" />
          </Pressable>

          <View style={styles.charWrap}>
            <Animated.View style={[styles.charInner, { transform: [{ translateY }, { scaleX }, { scaleY }] }]}>
              <Image source={choice.image} style={styles.charImage} contentFit="contain" />
            </Animated.View>
          </View>

          <Pressable
            onPress={() => step(1)}
            hitSlop={12}
            style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
            <Chevron dir="right" />
          </Pressable>
        </View>

        {/* Name + tagline + paging dots. */}
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.tagline}>
            {TAGLINE_KEYS[choice.name] ? t(TAGLINE_KEYS[choice.name]) : t('gallery.defaultTagline')}
          </Text>
          <View style={styles.recipeChip}>
            <Image source={recipeImage} style={styles.recipeImage} contentFit="contain" />
            <Text style={styles.recipeText}>{t('starter.comesWith', { recipe: recipeName })}</Text>
          </View>
          <View style={styles.dots}>
            {STARTER_CHOICES.map((c, i) => (
              <View key={c.shopItemId} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.hint}>{t('starter.hint')}</Text>
          <Pressable
            onPress={askConfirm}
            style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}>
            <Text style={styles.confirmText}>{t('starter.choose', { name })}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      )}

      {/* Are-you-sure card — an in-screen overlay (NOT a native Modal, which could
          stack with other root modals). Tapping the dim backdrop goes back to the
          carousel; only the pink Yes commits the pick. */}
      {confirmOpen && !submitting && (
        <Pressable style={styles.confirmBackdrop} onPress={() => setConfirmOpen(false)}>
          <Pressable style={styles.confirmCard} onPress={() => {}}>
            <Image source={choice.image} style={styles.confirmImage} contentFit="contain" />
            <Text style={styles.confirmTitle}>{t('starter.confirmTitle', { name })}</Text>
            <Text style={styles.confirmBody}>{t('starter.confirmBody', { name })}</Text>
            <Pressable
              onPress={confirm}
              style={({ pressed }) => [styles.confirmBtn, styles.confirmYesBtn, pressed && styles.pressed]}>
              <Text style={styles.confirmText}>{t('starter.confirmYes')}</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmOpen(false)} hitSlop={8} style={({ pressed }) => [pressed && styles.pressed]}>
              <Text style={styles.confirmBackText}>{t('starter.confirmBack')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: P.cream,
    zIndex: 999,
  },
  safe: { flex: 1, paddingHorizontal: 20, justifyContent: 'space-between' },
  header: { paddingTop: 12, gap: 8, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: P.brown, textAlign: 'center' },
  subtitle: { fontSize: 14, color: P.mutedBrown, textAlign: 'center', lineHeight: 19, paddingHorizontal: 8 },

  stage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Faded sneak peeks of the neighbouring companions, half tucked off each edge
  // and sitting behind the arrows + the centred character.
  peekLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '-18%',
    width: '40%',
    opacity: 0.4,
    justifyContent: 'flex-end',
  },
  peekRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: '-18%',
    width: '40%',
    opacity: 0.4,
    justifyContent: 'flex-end',
  },
  peekImage: { width: '100%', height: '82%', backgroundColor: 'transparent' },
  arrow: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: P.pink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  charWrap: { flex: 1, aspectRatio: 0.92, alignItems: 'center', justifyContent: 'flex-end' },
  charInner: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  charImage: { width: '100%', height: '100%', backgroundColor: 'transparent' },

  info: { alignItems: 'center', gap: 8 },
  name: { fontSize: 26, fontWeight: '900', color: P.brown },
  tagline: { fontSize: 15, color: P.mutedBrown, fontWeight: '600', textAlign: 'center' },
  recipeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: P.pinkSoft,
  },
  recipeImage: { width: 22, height: 22, backgroundColor: 'transparent' },
  recipeText: { fontSize: 12.5, color: P.brown, fontWeight: '700' },
  dots: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: P.pinkSoft },
  dotActive: { backgroundColor: P.pink, width: 22 },

  footer: { paddingBottom: 16, gap: 12 },
  hint: { fontSize: 12.5, color: P.mutedBrown, textAlign: 'center', fontWeight: '500' },
  confirmBtn: {
    backgroundColor: P.pink,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  confirmText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  pressed: { opacity: 0.85 },

  // Are-you-sure overlay
  confirmBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(91, 58, 46, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: P.card,
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#5B3A2E',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  confirmImage: { width: 120, height: 120, backgroundColor: 'transparent' },
  confirmTitle: { fontSize: 20, fontWeight: '900', color: P.brown, textAlign: 'center' },
  confirmBody: { fontSize: 14, color: P.mutedBrown, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  confirmYesBtn: { alignSelf: 'stretch', marginTop: 6 },
  confirmBackText: { fontSize: 14.5, fontWeight: '700', color: P.mutedBrown, padding: 6 },
});
