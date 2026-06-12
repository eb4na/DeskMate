import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';

// Hanji is rendered as a layered composite so her two head tassels can swing
// while the rest of her stays put: a body PNG (tassels erased) with the left and
// right bead-chain tassels overlaid at full canvas size. All three share the same
// 1254×1254 canvas, so an absolute-fill `contain` overlay registers exactly.
const BODY = require('@/assets/images/hanji/hanji-body.png');
const TASSEL_LEFT = require('@/assets/images/hanji/hanji-tassel-left.png');
const TASSEL_RIGHT = require('@/assets/images/hanji/hanji-tassel-right.png');

// Gentle pendulum sway, paced to feel like the idle bounce. Each tassel pivots at
// the top of its bead chain (where it meets the head); both swing the same
// direction together. PIVOT_* are % of the (square) container, measured from the
// real art — tune here if the anchor drifts.
const SWING_DEG = 6;
const HALF_PERIOD_MS = 850; // one direction; a full L→R→L cycle ≈ 1.7s
// RN requires transformOrigin as exactly [x, y, z] (z = depth, always 0 here).
const PIVOT_LEFT: [string, string, number] = ['32.3%', '22.2%', 0];
const PIVOT_RIGHT: [string, string, number] = ['67.7%', '22.2%', 0];

export function HanjiFigure({ style }: { style?: StyleProp<ViewStyle> }) {
  // 0 = swung left, 1 = swung right (0.5 = centred). One value drives both
  // tassels; created once so the per-second study re-render can't reset it.
  const swing = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    swing.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(swing, { toValue: 1, duration: HALF_PERIOD_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swing, { toValue: 0, duration: HALF_PERIOD_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [swing]);

  // Both tassels swing the same direction, in sync.
  const rot = swing.interpolate({ inputRange: [0, 1], outputRange: [`-${SWING_DEG}deg`, `${SWING_DEG}deg`] });

  // The swing lives on an Animated.View wrapper (transformOrigin pins the top of
  // each bead chain); the tassel art is a plain expo-image inside — the same
  // reliable render path as the body. (RN's <Animated.Image> with absoluteFill
  // can collapse to zero size and not show at all.)
  return (
    <View style={style} pointerEvents="none">
      <Image source={BODY} style={StyleSheet.absoluteFill} contentFit="contain" />
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: PIVOT_LEFT, transform: [{ rotate: rot }] }]}>
        <Image source={TASSEL_LEFT} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: PIVOT_RIGHT, transform: [{ rotate: rot }] }]}>
        <Image source={TASSEL_RIGHT} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
    </View>
  );
}
