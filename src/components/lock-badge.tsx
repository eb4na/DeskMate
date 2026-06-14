import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// App-wide "locked / not yet unlocked" badge: a soft pink disc with a white
// padlock. Single source of truth — every lock indicator in the app uses this so
// the look stays consistent.
export const LOCK_PINK = '#E48A9A';

export function LockBadge({ size = 32 }: { size?: number }) {
  const disc = LOCK_PINK;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* soft white ring */}
      <Circle cx="16" cy="16" r="15.2" fill="#FFFFFF" opacity={0.95} />
      {/* coloured disc */}
      <Circle cx="16" cy="16" r="13.4" fill={disc} />
      {/* padlock shackle */}
      <Path
        d="M11 15 V12.4 a5 5 0 0 1 10 0 V15"
        stroke="#FFFFFF"
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
      {/* padlock body */}
      <Rect x="9" y="14.5" width="14" height="10.5" rx="3" fill="#FFFFFF" />
      {/* keyhole (shows the disc colour through the white body) */}
      <Circle cx="16" cy="18.8" r="1.7" fill={disc} />
      <Rect x="15.1" y="18.8" width="1.8" height="3.6" rx="0.9" fill={disc} />
    </Svg>
  );
}

// Full-cover lock state for an art tile: a dark scrim over the artwork with the
// lock badge centered. Drop it as the last child of a relatively-positioned,
// image-sized wrapper so it darkens exactly the art (not the surrounding card).
export function LockOverlay({
  size = 34,
  radius = 16,
  style,
}: {
  size?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.scrim, { borderRadius: radius }, style]} pointerEvents="none">
      <LockBadge size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Warm frosted-cream veil covering the whole card (the item shows through),
  // so locked items look gently "frosted over" instead of pink-washed.
  scrim: {
    backgroundColor: 'rgba(255, 250, 243, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
