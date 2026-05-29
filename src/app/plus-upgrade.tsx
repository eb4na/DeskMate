import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiTicketIcon } from '@/components/ai-ticket-icon';
import { StreakFreezeIcon } from '@/components/streak-freeze-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const FEATURES = [
  { emoji: '⏱', title: 'Custom timers', desc: 'Any duration, saved presets' },
  { emoji: '🔔', title: 'Multiple reminders', desc: 'Weekday/weekend schedules, custom messages' },
  { emoji: '📆', title: 'Unlimited exam countdowns', desc: 'Plus advanced exam planning fields' },
  { title: 'Streak freezes', desc: '3 per month — protect your streak from missed days', streakFreezeIcon: true },
  { emoji: '📊', title: 'Advanced reports', desc: 'Monthly trends, best study hours, mood insights' },
  { emoji: '🎵', title: 'Ambience sounds', desc: 'Rain, cafe, library, fireplace, and more' },
  { emoji: '🐾', title: 'Extra companion slots', desc: 'Keep your two free starter companions and save up to 3 more' },
  { title: 'AI companion tickets', desc: '3 generation tickets/month for custom art', aiTicketIcon: true },
  { emoji: '🎮', title: 'All break games', desc: 'Unlock Memory Cards, Word Puzzle, and future games' },
  { emoji: '🛍️', title: 'Plus shop discount', desc: '20% off all shop items' },
];

export default function PlusUpgradeScreen() {
  const { isPlus, setIsPlus } = useApp();

  const handleMockUpgrade = () => {
    Alert.alert(
      'Mock Upgrade',
      'This activates DeskMate Plus in demo mode. No real payment is processed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate Plus (Mock)',
          onPress: () => {
            setIsPlus(true);
            router.back();
          },
        },
      ],
    );
  };

  const handleRestore = () => {
    Alert.alert(
      'Restore Purchases',
      'Real payment restoration will be connected in a future update.',
    );
  };

  const handleDeactivate = () => {
    Alert.alert('Deactivate Plus?', 'This will return you to the free tier.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: () => {
          setIsPlus(false);
          router.back();
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          {/* Hero */}
          <ThemedView style={styles.hero}>
            <ThemedText style={styles.heroEmoji}>✨</ThemedText>
            <ThemedText type="subtitle" style={styles.heroTitle}>
              DeskMate Plus
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.heroSub}>
              Premium features for serious students
            </ThemedText>
          </ThemedView>

          {/* Status banner (if already Plus) */}
          {isPlus && (
            <ThemedView type="backgroundElement" style={styles.activeBanner}>
              <ThemedText style={styles.activeEmoji}>🎉</ThemedText>
              <ThemedText type="smallBold">You're a Plus member!</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                All features unlocked. Keep studying!
              </ThemedText>
            </ThemedView>
          )}

          {/* Feature list */}
          <ThemedView style={styles.featureList}>
            {FEATURES.map((f) => (
              <ThemedView key={f.title} style={styles.featureRow}>
                {'streakFreezeIcon' in f && f.streakFreezeIcon ? (
                  <StreakFreezeIcon size={56} style={styles.featureCustomIcon} />
                ) : 'aiTicketIcon' in f && f.aiTicketIcon ? (
                  <AiTicketIcon size={56} style={styles.featureCustomIcon} />
                ) : (
                  <ThemedText style={styles.featureEmoji}>{'emoji' in f ? f.emoji : ''}</ThemedText>
                )}
                <ThemedView style={styles.featureText}>
                  <ThemedText type="smallBold">{f.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {f.desc}
                  </ThemedText>
                </ThemedView>
                <ThemedText style={styles.checkmark}>✓</ThemedText>
              </ThemedView>
            ))}
          </ThemedView>

          {/* Pricing */}
          {!isPlus && (
            <ThemedView type="backgroundElement" style={styles.priceCard}>
              <ThemedView style={styles.priceRow}>
                <ThemedView>
                  <ThemedText type="smallBold" style={styles.priceTitle}>
                    Monthly
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Flexible, cancel anytime
                  </ThemedText>
                </ThemedView>
                <ThemedText style={styles.priceValue}>$8.00</ThemedText>
              </ThemedView>
              <ThemedView style={styles.divider} />
              <ThemedView style={styles.priceRow}>
                <ThemedView>
                  <ThemedText type="smallBold" style={styles.priceTitle}>
                    Yearly{' '}
                    <ThemedText style={styles.saveBadge}>Save 48%</ThemedText>
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    $49.99/year · Best value
                  </ThemedText>
                </ThemedView>
                <ThemedText style={styles.priceValue}>$4.17/mo</ThemedText>
              </ThemedView>
            </ThemedView>
          )}

          {/* Free features reminder */}
          {!isPlus && (
            <ThemedView type="backgroundElement" style={styles.freeCard}>
              <ThemedText type="smallBold" style={styles.freeTitle}>
                Free plan stays free forever
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.freeText}>
                Two starter companions · Sessions · Focus Coins · Coin Shop · Mood tracker ·
                Streaks · Basic tasks · Subject manager · 3 exam countdowns · Break timer · Free
                presets
              </ThemedText>
            </ThemedView>
          )}

          {/* CTA buttons */}
          {!isPlus ? (
            <>
              <Pressable
                style={({ pressed }) => [styles.upgradeBtn, pressed && styles.pressed]}
                onPress={handleMockUpgrade}>
                <ThemedText type="smallBold" style={styles.upgradeBtnText}>
                  Start Plus (Mock — no real payment)
                </ThemedText>
              </Pressable>

              <Pressable onPress={handleRestore} style={styles.restoreBtn}>
                <ThemedText type="small" themeColor="textSecondary">
                  Restore Purchases
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={handleDeactivate} style={styles.deactivateBtn}>
              <ThemedText type="small" themeColor="textSecondary">
                Deactivate Plus (demo)
              </ThemedText>
            </Pressable>
          )}

          <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>
            🛠 Real payment processing will be connected in a future update. This is a mock
            subscription for testing.
          </ThemedText>
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: 40,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
  },
  hero: { alignItems: 'center', gap: Spacing.one },
  heroEmoji: { fontSize: 48, lineHeight: 56 },
  heroTitle: { fontSize: 28, lineHeight: 34 },
  heroSub: { textAlign: 'center' },
  activeBanner: {
    borderRadius: 16,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderColor: '#81C784',
  },
  activeEmoji: { fontSize: 32, lineHeight: 40 },
  featureList: { gap: Spacing.two },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  featureEmoji: { fontSize: 22, lineHeight: 28, width: 30 },
  featureCustomIcon: { width: 60, height: 60 },
  featureText: { flex: 1, gap: 2 },
  checkmark: { fontSize: 16, color: '#81C784', fontWeight: '700' },
  priceCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceTitle: { fontSize: 15 },
  priceValue: { fontSize: 22, fontWeight: '700', color: '#7C6F5A' },
  saveBadge: { fontSize: 11, color: '#81C784', fontWeight: '700' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  freeCard: { borderRadius: 16, padding: Spacing.three, gap: Spacing.one },
  freeTitle: { fontSize: 14 },
  freeText: { lineHeight: 20 },
  upgradeBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  upgradeBtnText: { color: '#FFF', fontSize: 16 },
  pressed: { opacity: 0.85 },
  restoreBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  deactivateBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  disclaimer: { textAlign: 'center', lineHeight: 18, fontSize: 11 },
});
