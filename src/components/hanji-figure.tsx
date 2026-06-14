import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';

// Hanji renders as a layered composite so her two head tassels can swing while the
// rest of her stays put: a body PNG (tassels erased) plus the left/right tassels as
// two INDEPENDENT sprites, each placed and sized on its own and pivoting from the
// top of its bead chain.
const BODY = require('@/assets/images/hanji/hanji-body.png');
const TASSEL_LEFT = require('@/assets/images/hanji/hanji-tassel-left.png');
const TASSEL_RIGHT = require('@/assets/images/hanji/hanji-tassel-right.png');

// Gentle pendulum sway, paced to feel like the idle bounce; both tassels swing the
// same direction together.
const SWING_DEG = 6;
const HALF_PERIOD_MS = 850; // one direction; a full L→R→L cycle ≈ 1.7s

// Each tassel is positioned independently as a % of the (square) container.
// left/top = the sprite's top-left corner; width/height = its size; pivotX = the
// chain's attach point across the sprite (where the swing rotates from, at the top).
// Tweak per side here — lower = bigger top%, smaller = smaller width/height%.
type Tassel = { src: number; left: string; top: string; width: string; height: string; pivotX: string };
const LEFT: Tassel = { src: TASSEL_LEFT, left: '26.4%', top: '29%', width: '4.5%', height: '19.6%', pivotX: '60.4%' };
const RIGHT: Tassel = { src: TASSEL_RIGHT, left: '68.5%', top: '29%', width: '4.45%', height: '19.5%', pivotX: '38.1%' };

export function HanjiFigure({ style }: { style?: StyleProp<ViewStyle> }) {
  // 0 = swung left, 1 = swung right. Created once so the per-second study re-render
  // can't reset it.
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

  const rot = swing.interpolate({ inputRange: [0, 1], outputRange: [`-${SWING_DEG}deg`, `${SWING_DEG}deg`] });

  const renderTassel = (t: Tassel) => (
    <Animated.View
      style={{
        position: 'absolute',
        left: t.left as `${number}%`,
        top: t.top as `${number}%`,
        width: t.width as `${number}%`,
        height: t.height as `${number}%`,
        transformOrigin: [t.pivotX, '0%', 0],
        transform: [{ rotate: rot }],
      }}>
      <Image source={t.src} style={StyleSheet.absoluteFill} contentFit="contain" />
    </Animated.View>
  );

  return (
    <View style={style} pointerEvents="none">
      <Image source={BODY} style={StyleSheet.absoluteFill} contentFit="contain" />
      {renderTassel(LEFT)}
      {renderTassel(RIGHT)}
    </View>
  );
}
