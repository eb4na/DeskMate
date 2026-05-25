import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { Spacing } from '@/constants/theme';

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
            <ThemedText style={styles.badgeText}>🔒 Plus</ThemedText>
          </ThemedView>
        </ThemedView>
        <ThemedText type="smallBold" style={styles.title}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.desc}>{description}</ThemedText>
        <ThemedText type="small" style={styles.tapHint}>Tap to see what's included →</ThemedText>
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
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  emoji: { fontSize: 28, lineHeight: 34 },
  badge: {
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#F5A623' },
  title: { fontSize: 14 },
  desc: { lineHeight: 18, fontSize: 12 },
  tapHint: { fontSize: 11, color: '#7C6F5A', marginTop: 4 },
  pressed: { opacity: 0.8 },
});
