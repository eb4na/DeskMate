// The "Spotify background" (disco) study scene's animated backdrop — drawn instead of a
// flat colour so the scene has depth AND motion: a soft radial gradient + vignette base
// (static SVG), with a continuously SPINNING disco ball, PULSING floor lights, music
// notes DRIFTING upward, and TWINKLING sparkles layered over it as native-driver
// Animated views. All code-drawn (no raster art). Sits at the back of the scene; the
// cover disk + character render on top.
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { discoPalette } from '@/lib/disco-palette';

// Static dot stars (x,y as 0..1 fractions).
const STARS: [number, number, number][] = [
  [0.08, 0.12, 1], [0.22, 0.06, 0.7], [0.37, 0.13, 0.6], [0.6, 0.05, 0.8], [0.74, 0.1, 0.6],
  [0.9, 0.07, 1], [0.05, 0.3, 0.7], [0.93, 0.26, 0.8], [0.16, 0.46, 0.6], [0.86, 0.45, 0.7],
  [0.68, 0.2, 0.5], [0.3, 0.33, 0.5], [0.95, 0.6, 0.6], [0.06, 0.62, 0.7],
];
// Twinkling 4-point sparkles (x,y,scale,delayMs).
const SPARKS: [number, number, number, number][] = [
  [0.82, 0.16, 1, 0], [0.14, 0.22, 0.8, 500], [0.9, 0.38, 0.7, 1000], [0.1, 0.5, 0.7, 1500], [0.5, 0.02, 0.7, 800],
];
// Drifting music notes (x,y,scale,rotateDeg,delayMs).
const NOTES: [number, number, number, number, number][] = [
  [0.86, 0.24, 1, 12, 0], [0.1, 0.36, 0.9, -14, 1200], [0.9, 0.54, 0.85, 10, 2400], [0.16, 0.64, 0.8, -8, 600],
];
// Pulsing floor disco lights (x,y,scale,colorIdx,delayMs).
const FLOOR: [number, number, number, number, number][] = [
  [0.5, 0.66, 1.3, 0, 0], [0.32, 0.7, 0.85, 1, 350], [0.68, 0.71, 0.9, 2, 700], [0.42, 0.74, 0.6, 3, 1050], [0.6, 0.75, 0.6, 0, 1400],
];

function useLoop(period: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: period / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    const t = setTimeout(() => anim.start(), delay);
    return () => { clearTimeout(t); anim.stop(); };
  }, [v, period, delay]);
  return v;
}

function SpinningBall({ x, y, r, dark, tileA, tileB }: { x: number; y: number; r: number; dark: boolean; tileA: string; tileB: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }));
    a.start();
    return () => a.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const grid = dark ? '#7D8597' : '#A99FC0';
  const s = r * 2;
  return (
    <Animated.View style={{ position: 'absolute', left: x - r, top: y - r, width: s, height: s, transform: [{ rotate }] }}>
      <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <Circle cx={r} cy={r} r={r - 1} fill={dark ? '#B8C0CF' : '#C9C2DA'} stroke={grid} strokeWidth={1.2} />
        {[-0.62, -0.31, 0, 0.31, 0.62].map((f, i) => {
          const c = Math.cos(Math.asin(f));
          return <Line key={`v${i}`} x1={r + (r - 1) * f} y1={r - (r - 1) * c} x2={r + (r - 1) * f} y2={r + (r - 1) * c} stroke={grid} strokeWidth={0.6} opacity={0.6} />;
        })}
        {[-0.62, -0.31, 0, 0.31, 0.62].map((f, i) => {
          const c = Math.cos(Math.asin(f));
          return <Line key={`h${i}`} x1={r - (r - 1) * c} y1={r + (r - 1) * f} x2={r + (r - 1) * c} y2={r + (r - 1) * f} stroke={grid} strokeWidth={0.6} opacity={0.6} />;
        })}
        <Rect x={r - r * 0.2} y={r - r * 0.15} width={r * 0.28} height={r * 0.28} fill={tileA} opacity={0.85} />
        <Rect x={r + r * 0.2} y={r + r * 0.1} width={r * 0.24} height={r * 0.24} fill={tileB} opacity={0.85} />
        <Circle cx={r - r * 0.35} cy={r - r * 0.35} r={r * 0.16} fill="#FFFFFF" opacity={0.7} />
      </Svg>
    </Animated.View>
  );
}

function PulsingLight({ cx, cy, r, color, dark, delay }: { cx: number; cy: number; r: number; color: string; dark: boolean; delay: number }) {
  const v = useLoop(2600, delay);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [dark ? 0.22 : 0.18, dark ? 0.7 : 0.5] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.14] });
  const s = r * 2;
  const gid = `pl${color.replace('#', '')}${delay}`;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: cx - r, top: cy - r, width: s, height: s, opacity, transform: [{ scale }] }}>
      <Svg width={s} height={s}>
        <Defs>
          <RadialGradient id={gid} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={r} cy={r} r={r} fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  );
}

function FloatingNote({ x, y, u, rot, color, delay }: { x: number; y: number; u: number; rot: number; color: string; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.timing(v, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    const t = setTimeout(() => anim.start(), delay);
    return () => { clearTimeout(t); anim.stop(); };
  }, [v, delay]);
  const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -u * 5] });
  const opacity = v.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const box = u * 8;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: x - box / 2, top: y - box / 2, width: box, height: box, opacity, transform: [{ translateY }, { rotate: `${rot}deg` }] }}>
      <Svg width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
        <G transform={`translate(${box / 2}, ${box / 2})`}>
          <Ellipse cx={-u * 0.7} cy={u * 1.6} rx={u} ry={u * 0.75} fill={color} transform={`rotate(-20 ${-u * 0.7} ${u * 1.6})`} />
          <Rect x={u * 0.15} y={-u * 1.8} width={u * 0.45} height={u * 3.6} rx={u * 0.2} fill={color} />
          <Path d={`M ${u * 0.6} ${-u * 1.8} q ${u * 1.6} ${u * 0.6} ${u * 0.5} ${u * 2.1} q ${u * 0.5} ${-u * 1.2} ${-u * 0.5} ${-u * 1.5} Z`} fill={color} />
        </G>
      </Svg>
    </Animated.View>
  );
}

function TwinkleSpark({ x, y, a, color, delay }: { x: number; y: number; a: number; color: string; delay: number }) {
  const v = useLoop(1800, delay);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] });
  const box = a * 2.4;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: x - box / 2, top: y - box / 2, width: box, height: box, opacity, transform: [{ scale }] }}>
      <Svg width={box} height={box} viewBox={`0 0 ${box} ${box}`}>
        <Path d={`M ${box / 2} ${box / 2 - a} Q ${box / 2} ${box / 2} ${box / 2 + a} ${box / 2} Q ${box / 2} ${box / 2} ${box / 2} ${box / 2 + a} Q ${box / 2} ${box / 2} ${box / 2 - a} ${box / 2} Q ${box / 2} ${box / 2} ${box / 2} ${box / 2 - a} Z`} fill={color} />
      </Svg>
    </Animated.View>
  );
}

export function DiscoBackdrop({ color, vinylColor, width, height }: { color: 'black' | 'white'; vinylColor: string; width: number; height: number }) {
  const dark = color === 'black';
  const W = width, H = height, min = Math.min(W, H);
  // Whole-scene palette themed around the chosen vinyl colour (analogous hues).
  const pal = discoPalette(vinylColor, dark);
  const star = pal.star, note = pal.note;
  const bx = W * 0.18, by = H * 0.085, br = min * 0.07;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Static base: gradient field, light beams, spotlight, dot stars, ball hanger. */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="discoBg" cx="50%" cy="32%" rx="75%" ry="62%">
            <Stop offset="0" stopColor={pal.bg[0]} />
            <Stop offset="0.55" stopColor={pal.bg[1]} />
            <Stop offset="1" stopColor={pal.bg[2]} />
          </RadialGradient>
          <RadialGradient id="discoSpot" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={pal.spot} stopOpacity={dark ? 0.5 : 0.6} />
            <Stop offset="1" stopColor={pal.spot} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="discoBeam" cx="50%" cy="0%" rx="50%" ry="70%">
            <Stop offset="0" stopColor={pal.beam} stopOpacity={dark ? 0.2 : 0.14} />
            <Stop offset="1" stopColor={pal.beam} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill="url(#discoBg)" />
        {[-0.06, 0.18, 0.42].map((dx, i) => {
          const tipX = bx + W * dx;
          return <Path key={`beam${i}`} d={`M ${bx} ${by} L ${tipX - W * 0.16} ${H * 0.95} L ${tipX + W * 0.16} ${H * 0.95} Z`} fill="url(#discoBeam)" />;
        })}
        <Ellipse cx={W * 0.5} cy={H * 0.66} rx={W * 0.52} ry={H * 0.2} fill="url(#discoSpot)" />
        {STARS.map(([x, y, s], i) => (
          <Circle key={`st${i}`} cx={W * x} cy={H * y} r={min * 0.006 * s} fill={star} opacity={dark ? 0.85 : 0.6} />
        ))}
        <Line x1={bx} y1={by - br} x2={bx} y2={0} stroke={dark ? '#6B5B86' : '#B7A6CE'} strokeWidth={1.4} />
      </Svg>

      {/* Animated decorations */}
      {FLOOR.map(([x, y, s, ci, delay], i) => (
        <PulsingLight key={`fl${i}`} cx={W * x} cy={H * y} r={min * 0.1 * s} color={pal.floor[ci]} dark={dark} delay={delay} />
      ))}
      <SpinningBall x={bx} y={by} r={br} dark={dark} tileA={pal.floor[1]} tileB={pal.floor[3]} />
      {/* Twinkling glints ON the ball so it clearly sparkles, not just slowly spins. */}
      {([[-0.35, -0.2], [0.3, 0.05], [-0.05, 0.32], [0.35, -0.3], [0.1, -0.05]] as [number, number][]).map(([dx, dy], i) => (
        <TwinkleSpark key={`bg${i}`} x={bx + br * dx} y={by + br * dy} a={br * (0.24 + 0.06 * (i % 2))} color={i % 2 ? pal.sparkle : '#FFFFFF'} delay={i * 260} />
      ))}
      {SPARKS.map(([x, y, s, delay], i) => (
        <TwinkleSpark key={`sp${i}`} x={W * x} y={H * y} a={min * 0.02 * s} color={star} delay={delay} />
      ))}
      {NOTES.map(([x, y, s, rot, delay], i) => (
        <FloatingNote key={`nt${i}`} x={W * x} y={H * y} u={min * 0.02 * s} rot={rot} color={note} delay={delay} />
      ))}
    </View>
  );
}
