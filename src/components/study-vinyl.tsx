import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

// Degrees of accumulated finger rotation that count as a deliberate "spin" — past
// this, releasing fires onSpin once (toggles play/stop). Below it (a tap or tiny
// wobble) does nothing, so a tap can still fall through to a wrapping Pressable.
const SPIN_THRESHOLD = 55;

// The default disc colour (charcoal-plum); also DEFAULTS.vinylColor in app-context.
export const DEFAULT_VINYL_COLOR = '#3B3340';

// Mix a #rrggbb colour toward white (amt>0) or black (amt<0) by |amt| (0..1), so
// the grooves/edge can be derived from any chosen disc colour.
function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const target = amt < 0 ? 0 : 255;
  const a = Math.abs(amt);
  const mix = (c: number) => Math.round(c + (target - c) * a);
  const r = mix((n >> 16) & 0xff);
  const g = mix((n >> 8) & 0xff);
  const b = mix(n & 0xff);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * A vinyl record. It spins on its own while music is playing — `playing` is wired
 * to the equipped study sound / Spotify. The disc colour is player-chosen
 * (`discColor`), and the label recolours to match. With `centerImage` (a study-sound
 * icon or the Spotify cover) the label becomes that image, ringed in the disc colour.
 *
 * Pass `onSpin` to make the record draggable: a finger rotation turns the disc with
 * the touch and, on release past a small threshold, fires `onSpin` once — used to
 * toggle play/stop ("spin it to start, spin again to stop"). The gesture only claims
 * the touch once the finger actually rotates, so a plain tap still falls through to a
 * wrapping Pressable (e.g. the study-room radio that opens the sound popup).
 */
export function StudyVinyl({
  size = 64,
  playing,
  discColor = DEFAULT_VINYL_COLOR,
  centerImage,
  onSpin,
  disk = false,
  holeColor,
}: {
  size?: number;
  playing: boolean;
  discColor?: string;
  centerImage?: number | { uri: string };
  onSpin?: () => void;
  // `disk`: render a clean disk (cover art filling the circle + a centre hole), with
  // no dark vinyl rim/grooves/label. `holeColor` fills the centre hole (e.g. the study
  // background colour, so it reads as punched through).
  disk?: boolean;
  holeColor?: string;
}) {
  const spin = useRef(new Animated.Value(0)).current;        // continuous auto-spin (0..1 → 0..360°)
  const manual = useRef(new Animated.Value(0)).current;      // extra degrees from finger dragging
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const [dragging, setDragging] = useState(false);

  // Auto-spin runs only while playing AND the finger isn't dragging (the drag drives
  // rotation directly). useNativeDriver:false so the JS `manual.setValue` during a
  // drag composes with this loop without a driver clash.
  useEffect(() => {
    if (playing && !dragging) {
      const loop = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: false }),
      );
      loopRef.current = loop;
      loop.start();
    } else {
      loopRef.current?.stop();
      loopRef.current = null;
    }
    return () => {
      loopRef.current?.stop();
      loopRef.current = null;
    };
    // Only `playing`/`dragging` toggle the loop — NOT centerImage (a new {uri} each
    // poll would otherwise restart the rotation).
  }, [playing, dragging, spin]);

  // ── Finger-spin gesture (only when onSpin is provided) ──
  const onSpinRef = useRef(onSpin);
  onSpinRef.current = onSpin;
  const sizeRef = useRef(size);
  sizeRef.current = size;
  const lastAngle = useRef<number | null>(null);
  const manualVal = useRef(0);
  const spinAccum = useRef(0);

  const pan = useRef(
    PanResponder.create({
      // Never claim on touch-start (lets a tap reach a parent Pressable, e.g. the
      // study-room radio that opens the popup); claim only once the finger has moved
      // enough to read as a rotation.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        !!onSpinRef.current && Math.abs(g.dx) + Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        setDragging(true);
        spinAccum.current = 0;
        lastAngle.current = null;
      },
      onPanResponderMove: (e) => {
        // locationX/Y are relative to the (non-rotated) wrapper — the inner disc is
        // pointerEvents:none, so the wrapper is always the touched view and the
        // centre is just size/2 (no measuring, no rotation skew).
        const c = sizeRef.current / 2;
        const a = (Math.atan2(e.nativeEvent.locationY - c, e.nativeEvent.locationX - c) * 180) / Math.PI;
        if (lastAngle.current == null) { lastAngle.current = a; return; }
        let d = a - lastAngle.current;
        if (d > 180) d -= 360; else if (d < -180) d += 360;
        lastAngle.current = a;
        manualVal.current += d;
        spinAccum.current += Math.abs(d);
        manual.setValue(manualVal.current);
      },
      onPanResponderRelease: () => {
        setDragging(false);
        if (spinAccum.current >= SPIN_THRESHOLD) onSpinRef.current?.();
      },
      onPanResponderTerminate: () => setDragging(false),
    }),
  ).current;

  // Auto rotation (degrees) + the finger's manual offset, mapped to a rotate string.
  const totalDeg = Animated.add(Animated.multiply(spin, 360), manual);
  const rotate = totalDeg.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
    extrapolate: 'extend',
  });

  // Label geometry (SVG r=33 of a 100 viewBox) mapped to real px for the overlay.
  const labelD = size * 0.66;
  const spindleD = size * 0.15;

  return (
    <View
      style={{ width: size, height: size }}
      {...(onSpin ? pan.panHandlers : {})}>
    <Animated.View
      pointerEvents="none"
      style={{ width: size, height: size, transform: [{ rotate }] }}>
      {disk ? (
        /* Clean disk: cover art filling the whole circle + a centre hole; no dark
           vinyl rim, grooves, or label. */
        <>
          <View
            style={[
              styles.center,
              { width: size, height: size, borderRadius: size / 2, marginLeft: -size / 2, marginTop: -size / 2, backgroundColor: centerImage ? 'transparent' : shade(discColor, 0.3), overflow: 'hidden' },
            ]}>
            {!!centerImage && <Image source={centerImage} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />}
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.center,
              {
                width: size * 0.13, height: size * 0.13, borderRadius: size * 0.065,
                marginLeft: -size * 0.065, marginTop: -size * 0.065,
                backgroundColor: holeColor ?? '#111111',
                borderWidth: Math.max(1.5, size * 0.012), borderColor: 'rgba(255,255,255,0.55)',
              },
            ]}
          />
        </>
      ) : (<>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Disc */}
        <Circle cx={50} cy={50} r={48} fill={discColor} />
        <Circle cx={50} cy={50} r={48} stroke={shade(discColor, -0.2)} strokeWidth={1.5} fill="none" />
        {/* Grooves — kept in the rim outside the (large) label */}
        <Circle cx={50} cy={50} r={46} stroke={shade(discColor, 0.18)} strokeWidth={1} fill="none" />
        <Circle cx={50} cy={50} r={42} stroke={shade(discColor, 0.18)} strokeWidth={1} fill="none" />
        <Circle cx={50} cy={50} r={38} stroke={shade(discColor, 0.18)} strokeWidth={1} fill="none" />
        {/* Label — a lighter tint of the disc colour so the whole record recolours.
            With a centerImage the image fills it (overlay below); keep just the ring. */}
        {!centerImage && <Circle cx={50} cy={50} r={33} fill={shade(discColor, 0.55)} />}
        <Circle cx={50} cy={50} r={33} stroke={shade(discColor, 0.35)} strokeWidth={1.5} fill="none" />
        {!centerImage && (
          <>
            {/* Off-centre print dot — makes the spin visible */}
            <Circle cx={50} cy={38} r={2.5} fill="#FBEFE0" />
            {/* Spindle */}
            <Circle cx={50} cy={50} r={6} fill="#E8B96A" />
            <Circle cx={50} cy={50} r={2.4} fill={discColor} />
          </>
        )}
      </Svg>

      {/* Cover/sound image fills the label, with a small spindle on top. expo-image
          (not SVG <Image>) so remote Spotify cover URLs render reliably. */}
      {centerImage && (
        <>
          <Image
            source={centerImage}
            style={[
              styles.center,
              { width: labelD, height: labelD, borderRadius: labelD / 2, marginLeft: -labelD / 2, marginTop: -labelD / 2 },
            ]}
            contentFit="cover"
          />
          <View
            style={[
              styles.center,
              styles.spindle,
              { width: spindleD, height: spindleD, borderRadius: spindleD / 2, marginLeft: -spindleD / 2, marginTop: -spindleD / 2 },
            ]}>
            <View style={[styles.spindleHole, { width: spindleD * 0.34, height: spindleD * 0.34, borderRadius: spindleD * 0.17, backgroundColor: discColor }]} />
          </View>
        </>
      )}
      </>)}
    </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: '50%', top: '50%' },
  spindle: { backgroundColor: '#E8B96A', alignItems: 'center', justifyContent: 'center' },
  spindleHole: {},
});
