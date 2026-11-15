// The app's one "go back / return" button: a real pink button, never a brown text
// link. `filled` (solid pink, white text) when it's the screen's only way out;
// `outline` (pink border + pink text) when it sits next to a solid-pink primary
// action, so the two stay distinguishable.

import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { BakeryColors } from '@/constants/theme';

const PINK_TEXT = '#C2566B';

export function BackButton({
  label,
  onPress,
  variant = 'filled',
  compact = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outline';
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const filled = variant === 'filled';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.regular,
        filled ? styles.filled : styles.outline,
        pressed && styles.pressed,
        style,
      ]}>
      <Text style={[styles.text, compact && styles.textCompact, { color: filled ? '#FFFFFF' : PINK_TEXT }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  regular: { alignSelf: 'stretch', paddingVertical: 13, paddingHorizontal: 22 },
  compact: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 14 },
  filled: { backgroundColor: BakeryColors.buttonPink },
  outline: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: BakeryColors.buttonPink },
  text: { fontSize: 15, fontWeight: '800' },
  textCompact: { fontSize: 12.5 },
  pressed: { opacity: 0.8 },
});
