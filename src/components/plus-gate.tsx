import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { BakeryColors, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';

type CardProps = {
  emoji: string;
  title: string;
  description: string;
};

/** Tappable locked card — navigates to the Plus upgrade screen */
export function PlusGateCard({ emoji, title, description }: CardProps) {
  return (
    <Pressable
      style={({ pressed }) => [pressed && styles.pressed]}
      onPress={() => router.push('/plus-upgrade')}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedView style={styles.header}>
          <ThemedText style={styles.emoji}>{emoji}</ThemedText>
          <ThemedView style={styles.badge}>
            <ThemedText style={styles.badgeText}>Chef&apos;s Special</ThemedText>
          </ThemedView>
        </ThemedView>
        <ThemedText type="smallBold" style={styles.title}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.desc}>{description}</ThemedText>
        <ThemedText type="small" style={styles.tapHint}>Tap to peek at the bakery pass →</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

type GateProps = {
  children: ReactNode;
  feature: string;
  description: string;
  emoji?: string;
};

/**
 * Wraps `children`. If the user is Plus, renders children.
 * Otherwise renders a locked PlusGateCard.
 */
export function PlusGate({ children, feature, description, emoji = '✨' }: GateProps) {
  const { isPlus } = useApp();
  if (isPlus) return <>{children}</>;
  return <PlusGateCard emoji={emoji} title={feature} description={description} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    gap: Spacing.one,
    opacity: 0.96,
    borderWidth: 1.5,
    borderColor: BakeryColors.rose,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  emoji: { fontSize: 28, lineHeight: 34 },
  badge: {
    backgroundColor: BakeryColors.shortbread,
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: BakeryColors.border,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: BakeryColors.mocha },
  title: { fontSize: 14 },
  desc: { lineHeight: 18, fontSize: 12 },
  tapHint: { fontSize: 11, color: BakeryColors.berry, marginTop: 6 },
  pressed: { opacity: 0.8 },
});
