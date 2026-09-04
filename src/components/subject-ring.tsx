import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { BakeryColors } from '@/constants/theme';

// The donut behind the Progress tab's subject split. Code-drawn in
// react-native-svg per the app's icon convention — no charting library, no
// raster art.
//
// Slices are stroked arcs on one circle rather than filled wedges: a stroke
// keeps the hole crisp at any size without a second masking shape, and lets the
// centre stay a plain View so the total can use the app's normal text styles.

export type RingSlice = { name: string; minutes: number; color: string };

type Props = {
  slices: RingSlice[];
  /** Minutes represented by the merged tail, drawn last in a muted grey. */
  otherMinutes?: number;
  size?: number;
  /** Ring thickness. Scales with size unless given. */
  thickness?: number;
  /** Centre content — the total and its caption. */
  children?: React.ReactNode;
};

const OTHER_COLOR = '#D9C6B4';
/** Gap between slices, in degrees, so touching colours stay separable. */
const GAP_DEG = 2;

export function SubjectRing({ slices, otherMinutes = 0, size = 158, thickness, children }: Props) {
  const stroke = thickness ?? Math.round(size * 0.155);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  const drawn = otherMinutes > 0
    ? [...slices, { name: '__other', minutes: otherMinutes, color: OTHER_COLOR }]
    : slices;
  const total = drawn.reduce((sum, s) => sum + s.minutes, 0);

  // A single slice would leave two gap seams on an otherwise unbroken ring, which
  // reads as a rendering fault rather than a divider — so gaps only appear once
  // there is actually more than one colour to separate.
  const gap = drawn.length > 1 ? (GAP_DEG / 360) * circumference : 0;

  let offset = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Track: also the whole ring when there's nothing to show yet. */}
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={BakeryColors.cream}
          strokeWidth={stroke}
          fill="none"
        />
        {/* -90° so the first slice starts at 12 o'clock instead of 3. */}
        <G rotation={-90} origin={`${cx}, ${cy}`}>
          {total > 0 &&
            drawn.map((slice) => {
              const share = slice.minutes / total;
              const arc = Math.max(share * circumference - gap, 0.5);
              const dash = `${arc} ${circumference - arc}`;
              const el = (
                <Circle
                  key={slice.name}
                  cx={cx}
                  cy={cy}
                  r={r}
                  stroke={slice.color}
                  strokeWidth={stroke}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  fill="none"
                />
              );
              offset += share * circumference;
              return el;
            })}
        </G>
      </Svg>
      {/* Centre content is clamped to the hole's width. Without this a large
          total ("3755 minutes") renders wider than the hole and overlaps the
          arc. 0.86 leaves a little breathing room inside the inner edge. */}
      <View style={styles.center} pointerEvents="none">
        <View style={{ width: (size - stroke * 2) * 0.86, alignItems: 'center' }}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
