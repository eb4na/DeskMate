import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { CheckBox } from '@/components/check-menu';
import { FitText } from '@/components/fit-text';
import { SoundPressable } from '@/components/sound-pressable';
import { BakeryColors as C, BakeryRadii, BakeryShadow, Fonts, Spacing } from '@/constants/theme';

// Bakery-MENU building blocks — the parchment "menu on paper" look the app already
// uses on the session picker (serif title, dashed section rules, dotted leader lines
// running from an item name to its price, tick badges). Propagated here so Task /
// Progress / Shop read as a cohesive hand-drawn menu / study-notes surface.

/** Parchment card that holds a menu. Pass `fill`/`border` to tint it (e.g. the honey
 * base used for checkbox menus so pink ticks + coins stay crisp). */
export function MenuCard({
  children,
  fill,
  border,
  style,
}: {
  children: ReactNode;
  fill?: string;
  border?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, fill != null && { backgroundColor: fill }, border != null && { borderColor: border }, style]}>
      {children}
    </View>
  );
}

/** Centred serif menu title with an underline (like a cafe menu heading). */
export function MenuHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      {/* Plain Text (wraps to 2 lines if long) — NOT FitText: adjustsFontSizeToFit
          collapses to micro-text at 0-width first layout inside a transparentModal. */}
      <Text numberOfLines={2} style={styles.title}>{title}</Text>
      {subtitle != null && <Text numberOfLines={2} style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

/** Uppercase, letter-spaced in-menu section label ("NOT STARTED", "COMPANIONS"…). */
export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <FitText numberOfLines={1} style={[styles.sectionLabel, style]}>{children}</FitText>;
}

/** Dashed divider between menu sections. */
export function SectionRule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.sectionRule, style]} />;
}

/** The dotted leader line that runs from a name to its price on a menu. */
export function Leader({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.leader, style]} pointerEvents="none" />;
}

export type MenuRowProps = {
  /** Item name (string auto-shrinks; nodes render as-is). */
  name: ReactNode;
  /** Small line under the name. */
  sub?: ReactNode;
  /** Leading art/icon (dessert PNG, subject dot, etc.). */
  icon?: ReactNode;
  /** Trailing content — a price, coin reward, badge, chevron. Sits after the leader. */
  trailing?: ReactNode;
  /** Show a tick checkbox on the left (checklist / selectable menu). */
  checkable?: boolean;
  checked?: boolean;
  checkColor?: string;
  /** Draw the dotted leader between name and trailing (classic menu look). */
  leader?: boolean;
  /** Highlight fill when selected/checked. */
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  sound?: 'tap' | 'confirm' | 'none';
  style?: StyleProp<ViewStyle>;
};

export function MenuRow({
  name,
  sub,
  icon,
  trailing,
  checkable = false,
  checked = false,
  checkColor = C.buttonPink,
  leader = true,
  active = false,
  onPress,
  disabled = false,
  sound = 'tap',
  style,
}: MenuRowProps) {
  const Container: any = onPress ? SoundPressable : View;
  const pressProps = onPress ? { sound, onPress: disabled ? undefined : onPress, disabled } : {};
  return (
    <Container {...pressProps} style={[styles.row, active && styles.rowActive, disabled && styles.rowDisabled, style]}>
      {checkable && <CheckBox checked={checked} size={24} color={checkColor} />}
      {icon != null && <View style={styles.icon}>{icon}</View>}
      <View style={styles.body}>
        <View style={styles.topLine}>
          {typeof name === 'string' ? (
            <FitText numberOfLines={1} minScale={0.75} style={[styles.name, active && styles.nameActive]}>{name}</FitText>
          ) : (
            name
          )}
          {leader && <Leader />}
          {trailing != null && <View style={styles.trailing}>{trailing}</View>}
        </View>
        {sub != null &&
          (typeof sub === 'string' ? (
            <FitText numberOfLines={1} style={styles.sub}>{sub}</FitText>
          ) : (
            sub
          ))}
      </View>
    </Container>
  );
}

const SOFT_SHADOW = BakeryShadow;

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.frosting,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: C.shortbread,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    ...SOFT_SHADOW,
  },
  header: {
    alignItems: 'stretch',
    gap: 2,
    paddingBottom: Spacing.two,
    marginBottom: Spacing.two,
    borderBottomWidth: 1.5,
    borderBottomColor: C.shortbread,
  },
  // iOS RN does not render dashed/dotted borders on rounded/most views, so the "menu"
  // rules + leaders use solid hairlines (reliable) rather than CSS dashed borders.
  title: { fontFamily: 'Baloo2', fontSize: 25, color: C.cocoaDark, letterSpacing: 0.3, textAlign: 'center' },
  subtitle: { fontSize: 12.5, color: C.mocha, fontWeight: '600', textAlign: 'center' },
  sectionLabel: { fontSize: 11.5, fontWeight: '800', color: C.mocha, letterSpacing: 1.4, marginTop: Spacing.two, marginBottom: 2 },
  sectionRule: { borderBottomWidth: 1, borderBottomColor: C.shortbread, marginVertical: Spacing.two },
  // Grows to fill the gap but never SHRINKS the name (flexShrink:0) — otherwise a wide
  // trailing (e.g. "+1000") squeezed the name's box and adjustsFontSizeToFit collapsed
  // it to micro-text. The name keeps its natural width; only this line gives way.
  leader: { flexGrow: 1, flexShrink: 0, flexBasis: 12, marginHorizontal: 8, marginBottom: 5, borderBottomWidth: 1.5, borderColor: `${C.latte}88` },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: BakeryRadii.chip,
  },
  rowActive: { backgroundColor: `${C.buttonPink}16` },
  rowDisabled: { opacity: 0.55 },
  icon: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  topLine: { flexDirection: 'row', alignItems: 'flex-end' },
  name: { fontSize: 15.5, fontWeight: '800', color: C.cocoaDark, flexShrink: 1 },
  nameActive: { color: C.berry },
  sub: { fontSize: 12.5, color: C.mocha, fontWeight: '600' },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 0 },
});
