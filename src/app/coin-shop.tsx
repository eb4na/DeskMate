import { router } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinAmount, CoinIcon } from '@/components/coin-icon';
import { BakeryStarEmoji, BakeryLockEmoji, BakeryWrenchEmoji } from '@/components/bakery-emoji';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { DAILY_EARN_CAP } from '@/constants/placeholder-data';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

type CoinPack = { id: string; name: string; coins: number; price: string; popular?: boolean };

const COIN_PACKS: CoinPack[] = [
  { id: 'pouch', name: 'Strawberry Cupcake', coins: 200, price: '$1.00' },
  { id: 'bag', name: 'Lemon Slice', coins: 600, price: '$3.00' },
  { id: 'chest', name: 'Chocolate Cake', coins: 1444, price: '$6.70', popular: true },
  { id: 'vault', name: 'Red Velvet', coins: 5000, price: '$20.00' },
  { id: 'treasury', name: 'Together With You', coins: 50000, price: '$100.00' },
];

// Coin packs are tiered desserts — bigger pack, bigger cake.
const PACK_IMAGES: Record<string, number> = {
  pouch: require('@/assets/images/shop/coin-cupcake.png'),
  bag: require('@/assets/images/shop/coin-slice.png'),
  chest: require('@/assets/images/shop/coin-cake1.png'),
  vault: require('@/assets/images/shop/coin-cake2.png'),
  treasury: require('@/assets/images/shop/coin-cake3.png'),
};

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
          {/* Bakery menu of coin packs */}
          <View style={styles.menuCard}>
            <View style={styles.menuHeader}>
              <ThemedText style={styles.menuTitle}>♡ Bakery Menu ♡</ThemedText>
              <ThemedText style={styles.menuSubtitle}>Coins never expire · not capped</ThemedText>
            </View>
            {COIN_PACKS.map((pack, i) => (
              <Pressable
                key={pack.id}
                style={({ pressed }) => [pressed && styles.pressed]}
                onPress={() => handleCoinPack(pack)}>
                <View style={styles.menuRow}>
                  <Image source={PACK_IMAGES[pack.id] ?? PACK_IMAGES.pouch} style={styles.menuIcon} resizeMode="contain" />
                  <View style={styles.menuBody}>
                    <View style={styles.menuTopLine}>
                      <ThemedText style={styles.menuName} numberOfLines={1}>{pack.name}</ThemedText>
                      <View style={styles.menuLeader} />
                      <ThemedText style={styles.menuPrice}>{pack.price}</ThemedText>
                    </View>
                    <View style={styles.menuSubLine}>
                      <CoinAmount amount={pack.coins} size={18} textStyle={styles.menuCoinText} />
                      {pack.popular && (
                        <View style={styles.chefBadge}>
                          <ThemedText style={styles.chefText}>Chef's pick</ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                {i < COIN_PACKS.length - 1 && <View style={styles.menuDivider} />}
              </Pressable>
            ))}
          </View>

          {/* Mock disclaimer */}
          <ThemedView type="backgroundElement" style={styles.disclaimerCard}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimerText}>
              🛠 Real payment processing will be connected in a future update. Packs are mock purchases for now.
            </ThemedText>
          </ThemedView>

          {/* Plus discount note */}
          {isPlus ? (
            <ThemedView type="backgroundElement" style={[styles.plusBanner, styles.plusBannerActive]}>
              <BakeryStarEmoji size={28} />
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
                <BakeryStarEmoji size={28} />
                <ThemedView style={styles.plusBannerText}>
                  <ThemedText type="smallBold">Plus members save 20% in shop</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">Tap to upgrade</ThemedText>
                </ThemedView>
                <ThemedView style={styles.plusBadge}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <BakeryLockEmoji size={14} />
                    <ThemedText style={styles.plusBadgeText}>Plus</ThemedText>
                  </View>
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
  // ─── Bakery menu of coin packs ───────────────────────────────────────────
  menuCard: {
    borderRadius: BakeryRadii.card,
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    ...BakeryShadow,
  },
  menuHeader: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: Spacing.two,
    marginBottom: Spacing.one,
    borderBottomWidth: 1.5,
    borderBottomColor: BakeryColors.shortbread,
    borderStyle: 'dashed',
  },
  menuTitle: { fontSize: 18, fontWeight: '800', color: BakeryColors.cocoaDark, letterSpacing: 0.5 },
  menuSubtitle: { fontSize: 12, color: BakeryColors.mocha },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  menuIcon: { width: 54, height: 54 },
  menuBody: { flex: 1, gap: 3 },
  menuTopLine: { flexDirection: 'row', alignItems: 'flex-end' },
  menuName: { fontSize: 15, fontWeight: '700', color: BakeryColors.cocoaDark },
  menuLeader: {
    flex: 1,
    marginHorizontal: 6,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: BakeryColors.latte,
  },
  menuPrice: { fontSize: 15, fontWeight: '800', color: BakeryColors.cocoaDark },
  menuSubLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  menuCoinText: { fontSize: 13, color: BakeryColors.mocha },
  chefBadge: {
    backgroundColor: `${BakeryColors.honey}22`,
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chefText: { fontSize: 10, fontWeight: '700', color: BakeryColors.mocha },
  menuDivider: { height: 1, backgroundColor: `${BakeryColors.shortbread}99` },
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
  plusBannerActive: { borderWidth: 1.5, borderColor: '#F2A0B5' },
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
