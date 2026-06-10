import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

/**
 * A small code-drawn open book that sits on the study desk. A page turns
 * (right → left) on a gentle loop while `active` is true, and freezes flat the
 * moment studying pauses (break / not studying).
 *
 * The flip uses its own Animated.Value on the native driver only, so it never
 * mixes drivers with anything else on the screen.
 */
const W = 120;
const H = 84;
const PAGE_X = 60; // spine x — pages meet here
const PAGE_TOP = 13;
const PAGE_W = 51;
const PAGE_H = 62;

const CREAM_L = '#FFF6E9';
const CREAM_R = '#FFFDF8';
const COVER = '#C2925E';
const COVER_DARK = '#A9774A';
const SPINE = '#E7D2B4';
const TEXT_LINE = '#E7D2B4';

function pageLines(x0: number, x1: number) {
  return [24, 32, 40, 48, 56, 64].map((y) => (
    <Line key={y} x1={x0} y1={y} x2={x1} y2={y} stroke={TEXT_LINE} strokeWidth={2} strokeLinecap="round" />
  ));
}

export function StudyBook({ active, size = 110 }: { active: boolean; size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(spin, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(800),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, spin]);

  const rotateY = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-162deg'] });
  // The flipping page is only visible mid-turn; it fades in as it lifts and out
  // as it lands, hiding the instant reset between loops.
  const flipOpacity = spin.interpolate({ inputRange: [0, 0.08, 0.82, 1], outputRange: [0, 1, 1, 0] });

  const scale = size / W;

  return (
    <View style={[styles.wrap, { width: W * scale, height: H * scale }]} pointerEvents="none">
      <View style={{ width: W, height: H, transform: [{ scale }] }}>
        {/* Static open book */}
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          {/* Cover */}
          <Rect x={5} y={9} width={110} height={72} rx={9} fill={COVER_DARK} />
          <Rect x={6} y={10} width={108} height={68} rx={8} fill={COVER} />
          {/* Pages */}
          <Rect x={9} y={PAGE_TOP} width={PAGE_W} height={PAGE_H} rx={3} fill={CREAM_L} />
          <Rect x={PAGE_X} y={PAGE_TOP} width={PAGE_W} height={PAGE_H} rx={3} fill={CREAM_R} />
          {/* Spine */}
          <Rect x={57} y={PAGE_TOP} width={6} height={PAGE_H} fill={SPINE} />
          <Line x1={60} y1={PAGE_TOP} x2={60} y2={PAGE_TOP + PAGE_H} stroke="#D8BE9C" strokeWidth={1} />
          {/* Text lines */}
          {pageLines(15, 53)}
          {pageLines(66, 105)}
        </Svg>

        {/* Turning page — pivots at the spine (left edge) */}
        <Animated.View
          style={[
            styles.flip,
            { opacity: flipOpacity, transform: [{ perspective: 600 }, { rotateY }] },
          ]}>
          <Svg width={PAGE_W} height={PAGE_H}>
            <Rect x={0} y={0} width={PAGE_W} height={PAGE_H} rx={3} fill={CREAM_R} />
            {/* soft curl shadow toward the outer edge */}
            <Rect x={PAGE_W - 10} y={0} width={10} height={PAGE_H} rx={3} fill="#EAD9C0" opacity={0.6} />
            {[20, 28, 36, 44, 52].map((y) => (
              <Line key={y} x1={6} y1={y} x2={PAGE_W - 8} y2={y} stroke={TEXT_LINE} strokeWidth={2} strokeLinecap="round" />
            ))}
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', justifyContent: 'flex-start', overflow: 'visible' },
  flip: {
    position: 'absolute',
    left: PAGE_X,
    top: PAGE_TOP,
    width: PAGE_W,
    height: PAGE_H,
    // Pivot around the spine (the page's left edge) for a real page-turn arc.
    transformOrigin: '0% 50%',
  },
});
