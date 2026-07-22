import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { FitText } from '@/components/fit-text';
import { SoundPressable } from '@/components/sound-pressable';
import { BakeryColors, BakeryRadii, Spacing } from '@/constants/theme';

// Notebook "tick-the-checkmark" menu: a vertical list of rows where you tap to
// choose an option (single- or multi-select — the semantics live in the parent,
// which owns `checked`). Used for session duration/subject, shop categories, task
// subjects, and the daily-goals / achievements checklist.
//
//   <CheckMenu>
//     {options.map((o) => (
//       <CheckRow key={o.id} checked={sel === o.id} label={o.name}
//                 onPress={() => setSel(o.id)} trailing={<Price n={o.cost} />} />
//     ))}
//   </CheckMenu>

const AnimatedPath = Animated.createAnimatedComponent(Path);

// The tick sits inside the 18×18 box (x/y 5 → 23). A touch bigger than a neat
// centred tick, and drawn round-capped. TICK_LEN is ~the path's arc length (two
// segments) so the draw-on animation can stroke it on cleanly; slightly generous
// is fine (keeps the start fully hidden).
const TICK_PATH = 'M7.6 14.7 L12.4 19.3 L21.2 8.4';
const TICK_LEN = 21;

// Hand-drawn checkbox: a rounded square with a round-capped tick that, when
// checked, DRAWS ITSELF ON (stroke reveal) rather than just popping in — and sits
// slightly off-square (a few degrees) so it reads hand-sketched, not machine-neat.
export function CheckBox({
  checked = false,
  size = 26,
  color = BakeryColors.success,
  ink = '#A87C5E',
}: {
  checked?: boolean;
  size?: number;
  /** Fill + used as the tick backdrop when checked. */
  color?: string;
  /** Box outline colour — a soft darkish brown (not black) so the UI stays light. */
  ink?: string;
}) {
  // 1 = fully hidden (dash offset the whole length), 0 = fully drawn. Starts drawn
  // if it mounts already checked with no prior state, but the effect below always
  // re-strokes it from scratch whenever `checked` flips true.
  const draw = useRef(new Animated.Value(checked ? 0 : 1)).current;
  useEffect(() => {
    if (!checked) return;
    draw.setValue(1);
    Animated.timing(draw, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // strokeDashoffset is an SVG prop, not transform/opacity
    }).start();
  }, [checked, draw]);
  const dashoffset = draw.interpolate({ inputRange: [0, 1], outputRange: [0, TICK_LEN] });

  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Rect
        x={5}
        y={5}
        width={18}
        height={18}
        rx={1}
        ry={1}
        fill="#FFFFFF"
        stroke={ink}
        strokeWidth={2.1}
      />
      {checked && (
        <AnimatedPath
          d={TICK_PATH}
          fill="none"
          stroke={color}
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${TICK_LEN}, ${TICK_LEN}`}
          strokeDashoffset={dashoffset}
          rotation={-8}
          origin="14, 14"
        />
      )}
    </Svg>
  );
}

export type CheckRowProps = {
  checked?: boolean;
  onPress?: () => void;
  /** Row title (string is auto-shrunk via FitText; nodes render as-is). */
  label: ReactNode;
  /** Optional secondary line under the label. */
  sublabel?: ReactNode;
  /** Optional icon shown after the checkbox. */
  leading?: ReactNode;
  /** Optional trailing content (price tag, reward chip, chevron…). */
  trailing?: ReactNode;
  disabled?: boolean;
  /** Checkbox fill colour when checked (defaults to bakery success pink). */
  checkColor?: string;
  /** Pastel highlight fill for the whole row when checked (defaults to a tint of checkColor). */
  selectedFill?: string;
  sound?: 'tap' | 'confirm' | 'none';
  style?: StyleProp<ViewStyle>;
};

export function CheckRow({
  checked = false,
  onPress,
  label,
  sublabel,
  leading,
  trailing,
  disabled = false,
  checkColor = BakeryColors.success,
  selectedFill,
  sound = 'tap',
  style,
}: CheckRowProps) {
  const fill = checked ? selectedFill ?? `${checkColor}22` : BakeryColors.frosting;
  const borderColor = checked ? checkColor : BakeryColors.latte;
  return (
    <SoundPressable
      sound={sound}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[
        styles.row,
        { backgroundColor: fill, borderColor },
        disabled && styles.rowDisabled,
        style,
      ]}>
      <CheckBox checked={checked} color={checkColor} />
      {leading != null && <View style={styles.leading}>{leading}</View>}
      <View style={styles.labels}>
        {typeof label === 'string' ? (
          <FitText numberOfLines={1} style={styles.label}>
            {label}
          </FitText>
        ) : (
          label
        )}
        {sublabel != null &&
          (typeof sublabel === 'string' ? (
            <FitText numberOfLines={1} style={styles.sublabel}>
              {sublabel}
            </FitText>
          ) : (
            sublabel
          ))}
      </View>
      {trailing != null && <View style={styles.trailing}>{trailing}</View>}
    </SoundPressable>
  );
}

export function CheckMenu({
  children,
  gap = Spacing.two + 2,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: BakeryRadii.chip,
    borderWidth: 2,
  },
  rowDisabled: { opacity: 0.5 },
  leading: { justifyContent: 'center', alignItems: 'center' },
  labels: { flex: 1, gap: 2 },
  label: { color: BakeryColors.cocoaDark, fontSize: 16, fontWeight: '800' },
  sublabel: { color: BakeryColors.mocha, fontSize: 12.5, fontWeight: '600' },
  trailing: { justifyContent: 'center', alignItems: 'center' },
});
