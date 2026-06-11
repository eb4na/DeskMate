// A one-shot "fresh out of the oven" reveal for the session-complete screen:
// the oven gives a little anticipation shake, then the finished recipe springs
// up out of it with an overshoot bounce + wobble, wrapped in a sparkle-star
// burst, rising steam, and a soft glow pulse. Pure reanimated + svg — no assets
// beyond the existing oven art, no extra deps.
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const OVEN = require('@/assets/images/cake/oven-empty.png');

// A little 4-point sparkle (shape mirrors SparkleStarIcon in settings-icons).
function Star({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24 3 Q26.5 20 43 24 Q26.5 28 24 45 Q21.5 28 5 24 Q21.5 20 24 3 Z" fill={color} />
    </Svg>
  );
}

// Sparkles radiating from the dish, each on its own angle + stagger.
const SPARKS = [
  { angle: -90, dist: 80, size: 18, delay: 0, color: '#FFD66B' },
  { angle: -45, dist: 90, size: 14, delay: 70, color: '#F7A8C0' },
  { angle: 0, dist: 94, size: 16, delay: 130, color: '#FFE08A' },
  { angle: 45, dist: 88, size: 13, delay: 95, color: '#FBBFD6' },
  { angle: 90, dist: 72, size: 15, delay: 150, color: '#FFD66B' },
  { angle: 135, dist: 86, size: 14, delay: 60, color: '#CDE7A0' },
  { angle: 180, dist: 92, size: 16, delay: 30, color: '#FFE08A' },
  { angle: -135, dist: 84, size: 13, delay: 120, color: '#F7A8C0' },
] as const;

function Spark({ angle, dist, size, delay, color }: (typeof SPARKS)[number]) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(360 + delay, withTiming(1, { duration: 680, easing: Easing.out(Easing.quad) }));
  }, []);
  const rad = (angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => {
    const d = p.value * dist;
    return {
      opacity: interpolate(p.value, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: Math.cos(rad) * d },
        { translateY: Math.sin(rad) * d },
        { scale: interpolate(p.value, [0, 0.5, 1], [0, 1, 0.6]) },
        { rotate: `${p.value * 110}deg` },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.spark, style]}>
      <Star size={size} color={color} />
    </Animated.View>
  );
}

// A soft puff of steam drifting up off the oven.
function Steam({ left, delay, w }: { left: number; delay: number; w: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2300, easing: Easing.inOut(Easing.quad) }), -1, false),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.18, 0.7, 1], [0, 0.45, 0.22, 0]),
    transform: [
      { translateY: interpolate(p.value, [0, 1], [0, -48]) },
      { translateX: interpolate(p.value, [0, 0.5, 1], [0, 7, -5]) },
      { scale: interpolate(p.value, [0, 1], [0.7, 1.35]) },
    ],
  }));
  return <Animated.View pointerEvents="none" style={[styles.steam, { left, width: w, height: w, borderRadius: w / 2 }, style]} />;
}

export function OvenReveal({ dish, size = 150 }: { dish: number; size?: number }) {
  const shake = useSharedValue(0); // oven anticipation wobble
  const pop = useSharedValue(0); // dish rise + scale (spring overshoot)
  const fade = useSharedValue(0); // dish fade-in
  const wob = useSharedValue(0); // dish rotation wobble
  const glow = useSharedValue(0); // glow pulse behind dish

  useEffect(() => {
    shake.value = withSequence(
      withTiming(-1, { duration: 70 }),
      withTiming(1, { duration: 90 }),
      withTiming(-0.6, { duration: 80 }),
      withTiming(0, { duration: 90 }),
    );
    fade.value = withDelay(280, withTiming(1, { duration: 160 }));
    pop.value = withDelay(280, withSpring(1, { damping: 8.5, stiffness: 130, mass: 0.9 }));
    wob.value = withDelay(
      300,
      withSequence(
        withTiming(1, { duration: 140 }),
        withTiming(-0.7, { duration: 150 }),
        withTiming(0.35, { duration: 140 }),
        withTiming(0, { duration: 150 }),
      ),
    );
    glow.value = withDelay(
      300,
      withSequence(withTiming(1, { duration: 220 }), withTiming(0.55, { duration: 520 })),
    );
  }, []);

  const ovenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value * 3 }, { rotateZ: `${shake.value * 2}deg` }],
  }));
  const dishStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      { translateY: interpolate(pop.value, [0, 1], [26, -60]) },
      { scale: interpolate(pop.value, [0, 1], [0.35, 1]) },
      { rotateZ: `${wob.value * 6}deg` },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.55,
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.6, 1.25]) }],
  }));

  const W = size * 1.4;
  const H = size * 1.32;
  const ovenW = size * 0.86;
  const dishW = size * 0.62;

  return (
    <View style={[styles.wrap, { width: W, height: H }]}>
      {/* steam off the oven top */}
      <Steam left={W * 0.46} delay={500} w={22} />
      <Steam left={W * 0.6} delay={1000} w={18} />
      <Steam left={W * 0.36} delay={1500} w={16} />

      {/* glow behind the dish landing spot */}
      <Animated.View
        pointerEvents="none"
        style={[styles.glow, { width: size * 0.9, height: size * 0.9, borderRadius: size * 0.45, top: size * 0.04 }, glowStyle]}
      />

      {/* dish — rendered before the oven so it reads as rising out from behind it */}
      <Animated.View pointerEvents="none" style={[styles.dishWrap, { top: size * 0.5 }, dishStyle]}>
        <Image source={dish} style={{ width: dishW, height: dishW }} contentFit="contain" />
      </Animated.View>

      {/* oven */}
      <Animated.View style={[styles.ovenWrap, ovenStyle]}>
        <Image source={OVEN} style={{ width: ovenW, height: ovenW }} contentFit="contain" />
      </Animated.View>

      {/* sparkle burst — on top, centered on the dish landing spot */}
      <View pointerEvents="none" style={[styles.sparkLayer, { top: size * 0.18 }]}>
        {SPARKS.map((s, i) => (
          <Spark key={i} {...s} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end', alignSelf: 'center' },
  ovenWrap: { position: 'absolute', bottom: 0, alignSelf: 'center' },
  dishWrap: { position: 'absolute', alignSelf: 'center' },
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#FFE9A8',
    // a soft sun-burst feel; rounded + faint
  },
  sparkLayer: { position: 'absolute', alignSelf: 'center', width: 1, height: 1, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute' },
  steam: { position: 'absolute', top: 0, backgroundColor: '#FFFFFF' },
});
