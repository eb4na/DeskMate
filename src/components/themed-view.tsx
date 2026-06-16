import { View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  // 'transparent' paints no background, so nested layout wrappers inherit their
  // card surface instead of stamping the page `background` colour over it.
  type?: ThemeColor | 'transparent';
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();
  const backgroundColor = type === 'transparent' ? 'transparent' : theme[type ?? 'background'];

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
