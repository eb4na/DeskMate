// The baked recipe springing up out of the study-session countdown timer when
// the session finishes — a quick spring + wobble with a little sparkle burst.
// Drawn with reanimated + svg (no extra assets). Overlay this on the timer card.
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

function Star({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M24 3 Q26.5 20 43 24 Q26.5 28 24 45 Q21.5 28 5 24 Q21.5 20 24 3 Z" fill={color} />
    </Svg>
  );
}

const SPARKS = [
  { angle: -90, dist: 64, size: 16, delay: 0, color: '#FFD66B' },
  { angle: -40, dist: 70, size: 13, delay: 60, color: '#F7A8C0' },
  { angle: 40, dist: 68, size: 14, delay: 90, color: '#FFE08A' },
  { angle: -140, dist: 66, size: 13, delay: 50, color: '#CDE7A0' },
  { angle: 140, dist: 64, size: 14, delay: 110, color: '#FBBFD6' },
  { angle: 180, dist: 60, size: 12, delay: 30, color: '#FFE08A' },
] as const;

function Spark({ angle, dist, size, delay, color, playing }: (typeof SPARKS)[number] & { playing: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!playing) return;
    p.value = withDelay(220 + delay, withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) }));
  }, [playing]);
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

export function RecipePop({ dish, playing, size = 92 }: { dish: number; playing: boolean; size?: number }) {
  const pop = useSharedValue(0);
  const fade = useSharedValue(0);
  const wob = useSharedValue(0);

  useEffect(() => {
    if (!playing) return;
    fade.value = withTiming(1, { duration: 150 });
    pop.value = withSpring(1, { damping: 8.5, stiffness: 135, mass: 0.9 });
    wob.value = withSequence(
      withTiming(1, { duration: 140 }),
      withTiming(-0.7, { duration: 150 }),
      withTiming(0.35, { duration: 140 }),
      withTiming(0, { duration: 150 }),
    );
  }, [playing]);

  const dishStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      { translateY: interpolate(pop.value, [0, 1], [18, -58]) },
      { scale: interpolate(pop.value, [0, 1], [0.3, 1]) },
      { rotateZ: `${wob.value * 6}deg` },
    ],
  }));

  if (!playing) return null;
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={styles.sparkLayer}>
        {SPARKS.map((s, i) => (
          <Spark key={i} {...s} playing={playing} />
        ))}
      </View>
      <Animated.View style={[styles.dishWrap, dishStyle]}>
        <Image source={dish} style={{ width: size, height: size }} contentFit="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  dishWrap: { position: 'absolute' },
  sparkLayer: { position: 'absolute', width: 1, height: 1, alignItems: 'center', justifyContent: 'center' },
  spark: { position: 'absolute' },
});
