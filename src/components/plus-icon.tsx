import { Image as ExpoImage } from 'expo-image';

type Props = { size?: number };

/** Memobun Plus / premium icon — strawberry-gem crown. */
export function PlusIcon({ size = 32 }: Props) {
  return (
    <ExpoImage
      source={require('@/assets/images/plus/plus-icon.png')}
      style={{ width: size, height: size, backgroundColor: 'transparent' }}
      contentFit="contain"
    />
  );
}
