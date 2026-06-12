import { Image as ExpoImage } from 'expo-image';

type Props = { size?: number };

/** DeskMate Plus / premium icon — crossed fork & spoon with a bow. */
export function PlusIcon({ size = 32 }: Props) {
  return (
    <ExpoImage
      source={require('@/assets/images/plus/plus-icon.png')}
      style={{ width: size, height: size, backgroundColor: 'transparent' }}
      contentFit="contain"
    />
  );
}
