import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { localizeCompanionName, STARTER_CHOICES } from '@/lib/companion-utils';
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

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('starter.title')}</Text>
          <Text style={styles.subtitle}>{t('starter.subtitle')}</Text>
        </View>

        {/* Carousel — swipe to flip, or use the left/right arrows. */}
        <View style={styles.stage} {...swipe.panHandlers}>
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
          <View style={styles.dots}>
            {STARTER_CHOICES.map((c, i) => (
              <View key={c.shopItemId} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.hint}>{t('starter.hint')}</Text>
          <Pressable
            onPress={() => { playTapConfirm(); chooseStarter(choice.activeId); }}
            style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}>
            <Text style={styles.confirmText}>{t('starter.choose', { name })}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
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
});
