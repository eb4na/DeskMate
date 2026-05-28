import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import {
  getDecorationEffect,
  getOutfitEffect,
  getPoseEffect,
  getThemeEffect,
} from '@/constants/shop-effects';
import { Colors } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTheme } from '@/hooks/use-theme';
import { STARTER_COMPANION_IMAGES, resolveActiveCompanion } from '@/lib/companion-utils';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export type CompanionPose = 'idle' | 'studying' | 'proud' | 'cheering' | 'break';

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
  const { activeCompanionId, companionSlots, defaultCompanionId, equippedShopItems } = useApp();
  const config = POSE_CONFIG[pose];
  const isFull = size === 'full';
  const theme = useTheme();
  const activeCompanion = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots);
  const [didImageFail, setDidImageFail] = useState(false);
  const activeTheme = getThemeEffect(equippedShopItems);
  const activeOutfit =
    activeCompanion.type === 'starter' ? getOutfitEffect(equippedShopItems) : null;
  const activePose = getPoseEffect(equippedShopItems);
  const activeDecoration = getDecorationEffect(equippedShopItems);
  const isLightTheme = theme.background === Colors.light.background;
  const poseTransform = activePose
    ? [
        { rotate: `${activePose.rotateDeg ?? 0}deg` },
        { scale: activePose.scale ?? 1 },
        { translateY: activePose.translateY ?? 0 },
      ]
    : undefined;
  const roomColor =
    activeTheme?.[isLightTheme ? 'lightRoom' : 'darkRoom'] ?? undefined;
  const labelText = [activeCompanion.name, config.label, activeTheme?.label, activeDecoration?.label]
    .filter(Boolean)
    .join(' · ');
  const resolvedImageSource =
    didImageFail && activeCompanion.type === 'slot'
      ? STARTER_COMPANION_IMAGES[defaultCompanionId]
      : activeCompanion.imageSource;

  useEffect(() => {
    setDidImageFail(false);
  }, [activeCompanionId]);

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.room, isFull && styles.roomFull, roomColor ? { backgroundColor: roomColor } : null]}>
      {activeTheme ? (
        <ThemedView style={[styles.themeBadge, { backgroundColor: `${activeTheme.accent}22` }]}>
          <ThemedText type="small" style={[styles.themeBadgeText, { color: activeTheme.accent }]}>
            {activeTheme.overlay} {activeTheme.label}
          </ThemedText>
        </ThemedView>
      ) : null}

      {activeDecoration?.accents.map((accent, index) => (
        <ThemedText
          key={`${accent}-${index}`}
          style={[
            styles.decorationAccent,
            index === 0 && styles.decorationTopLeft,
            index === 1 && styles.decorationTopRight,
            index === 2 && styles.decorationBottomRight,
          ]}>
          {accent}
        </ThemedText>
      ))}

      <Image
        source={resolvedImageSource}
        style={[
          styles.companionImage,
          isFull && styles.companionImageFull,
          activeOutfit ? { borderColor: activeOutfit.accent, borderWidth: 2 } : null,
          poseTransform ? { transform: poseTransform } : null,
        ]}
        contentFit="contain"
        contentPosition="bottom"
        onError={() => {
          if (activeCompanion.type === 'slot') {
            setDidImageFail(true);
          }
        }}
        accessibilityLabel={`${activeCompanion.name} companion — ${config.label}`}
      />

      {activeOutfit ? (
        <ThemedView style={[styles.outfitBadge, { backgroundColor: `${activeOutfit.accent}20` }]}>
          <ThemedText type="small" style={[styles.outfitBadgeText, { color: activeOutfit.accent }]}>
            {activeOutfit.badge}
          </ThemedText>
        </ThemedView>
      ) : null}

      {activePose ? (
        <ThemedView style={[styles.poseBadge, { borderColor: activePose.accent }]}>
          <ThemedText type="small" style={[styles.poseBadgeText, { color: activePose.accent }]}>
            {activePose.emoji} {activePose.label}
          </ThemedText>
        </ThemedView>
      ) : null}

      <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
        {labelText}
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
  themeBadge: {
    alignSelf: 'stretch',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  themeBadgeText: {
    textAlign: 'center',
    fontWeight: '700',
  },
  decorationAccent: {
    position: 'absolute',
    fontSize: 24,
    lineHeight: 28,
  },
  decorationTopLeft: {
    left: 14,
    top: 14,
  },
  decorationTopRight: {
    right: 14,
    top: 14,
  },
  decorationBottomRight: {
    right: 18,
    bottom: 56,
  },
  outfitBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  outfitBadgeText: {
    fontWeight: '700',
  },
  poseBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
  },
  poseBadgeText: {
    fontWeight: '700',
  },
  label: {
    textAlign: 'center',
    marginTop: 4,
  },
});
