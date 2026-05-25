import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { useApp } from '@/context/app-context';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export type CompanionPose = 'idle' | 'studying' | 'proud' | 'cheering' | 'break';

const DEFAULT_COMPANION_IMAGES = {
  girl: require('@/assets/images/companion/default-girl.png'),
  dude: require('@/assets/images/companion/default-dude.png'),
} as const;

const POSE_CONFIG: Record<CompanionPose, { label: string }> = {
  idle: { label: 'Ready to study with you' },
  studying: { label: 'Studying alongside you' },
  proud: { label: 'Session complete!' },
  cheering: { label: 'Amazing work!' },
  break: { label: 'Enjoy your break' },
};

type Props = {
  pose: CompanionPose;
  size?: 'full' | 'compact';
};

export function Companion({ pose, size = 'full' }: Props) {
  const { defaultCompanionId } = useApp();
  const config = POSE_CONFIG[pose];
  const isFull = size === 'full';

  return (
    <ThemedView type="backgroundElement" style={[styles.room, isFull && styles.roomFull]}>
      <Image
        source={DEFAULT_COMPANION_IMAGES[defaultCompanionId]}
        style={[styles.companionImage, isFull && styles.companionImageFull]}
        contentFit="cover"
        accessibilityLabel={`${defaultCompanionId} companion — ${config.label}`}
      />

      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {config.label}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  room: {
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 160,
    overflow: 'hidden',
  },
  roomFull: {
    flex: 1,
    minHeight: 220,
  },
  companionImage: {
    width: '100%',
    maxWidth: 320,
    height: 180,
    borderRadius: 14,
  },
  companionImageFull: {
    flex: 1,
    minHeight: 200,
    maxHeight: 320,
  },
  label: {
    textAlign: 'center',
    marginTop: 4,
  },
});
