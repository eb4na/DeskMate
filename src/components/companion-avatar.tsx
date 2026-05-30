import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { DEFAULT_PFP_FOCUS, type PfpFocus } from '@/context/app-context';
import type { CompanionImageSource } from '@/lib/companion-utils';
import { BakeryColors } from '@/constants/theme';

type Props = {
  source: CompanionImageSource;
  size: number;
  focus?: PfpFocus | null;
  style?: StyleProp<ViewStyle>;
};

/**
 * Circular companion avatar with a zoom/pan "focus" so it frames the face.
 * The same render is used by the crop adjuster, so the preview matches exactly.
 */
export function CompanionAvatar({ source, size, focus, style }: Props) {
  const f = focus ?? DEFAULT_PFP_FOCUS;
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: BakeryColors.shortbread },
        style,
      ]}>
      <Image
        source={source}
        style={{
          width: size,
          height: size,
          transform: [{ scale: f.scale }, { translateX: f.x * size }, { translateY: f.y * size }],
        }}
        contentFit="cover"
        contentPosition="top"
      />
    </View>
  );
}
