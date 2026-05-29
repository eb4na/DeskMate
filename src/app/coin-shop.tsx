import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinAmount, CoinIcon } from '@/components/coin-icon';
import { BreadPouchIcon, BreadBagIcon, BreadChestIcon, BreadVaultIcon } from '@/components/coin-pack-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { DAILY_EARN_CAP } from '@/constants/placeholder-data';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

type CoinPack = { id: string; name: string; coins: number; price: string; popular?: boolean };

const COIN_PACKS: CoinPack[] = [
  { id: 'pouch', name: 'Small Pouch', coins: 200, price: '$0.99' },
  { id: 'bag', name: 'Study Bag', coins: 600, price: '$2.49' },
  { id: 'chest', name: 'Coin Chest', coins: 1400, price: '$4.99', popular: true },
  { id: 'vault', name: 'Scholar Vault', coins: 3500, price: '$9.99' },
];

function PackIcon({ id }: { id: string }) {
  if (id === 'pouch') return <BreadPouchIcon size={56} />;
  if (id === 'bag') return <BreadBagIcon size={56} />;
  if (id === 'chest') return <BreadChestIcon size={56} />;
  return <BreadVaultIcon size={56} />;
}

export default function CoinShopScreen() {
  const { coins, earnedToday, addPurchasedCoins, isPlus } = useApp();
  const capRemaining = Math.max(0, DAILY_EARN_CAP - earnedToday);

  const handleCoinPack = (pack: CoinPack) => {
    Alert.alert(
      `Buy ${pack.name}?`,
      `${pack.coins} coins for ${pack.price}. Purchased coins never expire and do not count toward the daily free earn cap.\n\n🛠 Real payment processing coming in a future update.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Buy for ${pack.price} (Mock)`,
          onPress: () => {
            addPurchasedCoins(pack.coins);
            Alert.alert(`+${pack.coins} coins added!`, 'Mock purchase complete.');
          },
        },
      ],
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>

          {/* Balance */}
          <ThemedView type="backgroundElement" style={styles.balanceCard}>
            <ThemedText type="small" themeColor="textSecondary">Your balance</ThemedText>
            <View style={styles.balanceRow}>
              <CoinIcon size={40} />
              <ThemedText style={styles.balanceAmount}>{coins}</ThemedText>
            </View>
          </ThemedView>

          {/* Daily earn progress */}
          <ThemedView type="backgroundElement" style={styles.capCard}>
            <ThemedView style={styles.capRow}>
              <ThemedText type="small" themeColor="textSecondary">Daily free earn</ThemedText>
              <View style={styles.capCoins}>
                <ThemedText type="smallBold">{earnedToday}/{DAILY_EARN_CAP}</ThemedText>
                <CoinIcon size={28} />
              </View>
            </ThemedView>
            <ThemedView style={styles.progressBar}>
              <ThemedView
                style={[styles.progressFill, { width: `${Math.min(100, (earnedToday / DAILY_EARN_CAP) * 100)}%` }]}
              />
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary" style={styles.capNote}>
              {capRemaining > 0
                ? `${capRemaining} more free coins available today`
                : 'Daily cap reached — resets tomorrow!'}
            </ThemedText>
          </ThemedView>

          {/* Packs header */}
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>Coin Packs</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">No expiry · Not capped</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.packNote}>
            Purchased coins go straight to your balance and never count toward the daily earn cap.
          </ThemedText>

          {/* Pack cards */}
          {COIN_PACKS.map((pack) => (
            <Pressable
              key={pack.id}
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => handleCoinPack(pack)}>
              <ThemedView
                type="backgroundElement"
                style={[styles.packCard, pack.popular && styles.packCardPopular]}>
                <PackIcon id={pack.id} />
                <ThemedView style={styles.packInfo}>
                  <View style={styles.packNameRow}>
                    <ThemedText type="smallBold" style={styles.packName}>{pack.name}</ThemedText>
                    {pack.popular && (
                      <ThemedView style={styles.popularBadge}>
                        <ThemedText style={styles.popularText}>Popular</ThemedText>
                      </ThemedView>
                    )}
                  </View>
                  <CoinAmount amount={pack.coins} size={22} textStyle={styles.packCoinText} />
                </ThemedView>
                <ThemedView style={styles.packPriceBtn}>
                  <ThemedText style={styles.packPrice}>{pack.price}</ThemedText>
                </ThemedView>
              </ThemedView>
            </Pressable>
          ))}

          {/* Mock disclaimer */}
          <ThemedView type="backgroundElement" style={styles.disclaimerCard}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimerText}>
              🛠 Real payment processing will be connected in a future update. Packs are mock purchases for now.
            </ThemedText>
          </ThemedView>

          {/* Plus discount note */}
          {isPlus ? (
            <ThemedView type="backgroundElement" style={[styles.plusBanner, styles.plusBannerActive]}>
              <ThemedText style={styles.plusBannerEmoji}>🌟</ThemedText>
              <ThemedView style={styles.plusBannerText}>
                <ThemedText type="smallBold">20% Plus discount active</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">Applied to all shop items</ThemedText>
              </ThemedView>
            </ThemedView>
          ) : (
            <Pressable
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => router.push('/plus-upgrade')}>
              <ThemedView type="backgroundElement" style={styles.plusBanner}>
                <ThemedText style={styles.plusBannerEmoji}>🌟</ThemedText>
                <ThemedView style={styles.plusBannerText}>
                  <ThemedText type="smallBold">Plus members save 20% in shop</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Tap to upgrade</ThemedText>
                </ThemedView>
                <ThemedView style={styles.plusBadge}>
                  <ThemedText style={styles.plusBadgeText}>🔒 Plus</ThemedText>
                </ThemedView>
              </ThemedView>
            </Pressable>
          )}

          {/* How to earn */}
          <ThemedView type="backgroundElement" style={styles.tipCard}>
            <ThemedText type="smallBold" style={styles.tipTitle}>How to earn free coins</ThemedText>
            {[
              { label: 'Complete a 10 min session', coins: 5 },
              { label: 'Complete a 25 min session', coins: 15 },
              { label: 'Complete a 50 min session', coins: 35 },
              { label: 'Complete a 90 min session', coins: 70 },
              { label: '3-day streak bonus', coins: 30 },
              { label: '7-day streak bonus', coins: 80 },
            ].map((row) => (
              <ThemedView key={row.label} style={styles.tipRow}>
                <ThemedText type="small" themeColor="textSecondary">{row.label}</ThemedText>
                <CoinAmount amount={row.coins} prefix="+" size={26} textStyle={styles.tipCoins} />
              </ThemedView>
            ))}
          </ThemedView>

        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  balanceCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  balanceAmount: { fontSize: 32, lineHeight: 40, fontWeight: '800', color: BakeryColors.honey },
  capCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    gap: Spacing.one,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  capRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  capCoins: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    marginVertical: 4,
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: BakeryColors.honey },
  capNote: { fontSize: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  sectionTitle: { fontSize: 20 },
  packNote: { lineHeight: 18, marginTop: -Spacing.two },
  packCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  packCardPopular: { borderWidth: 1.5, borderColor: BakeryColors.honey },

  packInfo: { flex: 1, gap: 4 },
  packNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  packName: { fontSize: 15 },
  popularBadge: {
    backgroundColor: `${BakeryColors.honey}22`,
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  popularText: { fontSize: 10, fontWeight: '700', color: BakeryColors.mocha },
  packCoinText: { fontSize: 13, color: BakeryColors.mocha },
  packPriceBtn: {
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  packPrice: { color: BakeryColors.cocoaDark, fontWeight: '700', fontSize: 15 },
  disclaimerCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    backgroundColor: BakeryColors.glass,
  },
  disclaimerText: { textAlign: 'center', lineHeight: 18, fontSize: 12 },
  plusBanner: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BakeryColors.glass,
  },
  plusBannerActive: { borderWidth: 1.5, borderColor: BakeryColors.success },
  plusBannerEmoji: { fontSize: 22, lineHeight: 28 },
  plusBannerText: { flex: 1, gap: 2 },
  plusBadge: {
    backgroundColor: `${BakeryColors.rose}22`,
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  plusBadgeText: { fontSize: 12, fontWeight: '700', color: BakeryColors.berry },
  tipCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    gap: Spacing.two,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  tipTitle: { fontSize: 14, marginBottom: 2 },
  tipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipCoins: { color: BakeryColors.honey, fontSize: 13 },
  pressed: { opacity: 0.8 },
});
