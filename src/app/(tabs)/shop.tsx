import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import {
  SHOP_ITEMS,
  CATEGORIES,
  CATEGORY_LABELS,
  type ShopCategory,
} from '@/constants/shop-data';
import { DAILY_EARN_CAP } from '@/constants/placeholder-data';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

type CoinPack = { id: string; name: string; emoji: string; coins: number; price: string; popular?: boolean };
const COIN_PACKS: CoinPack[] = [
  { id: 'pouch', name: 'Small Pouch', emoji: '👛', coins: 200, price: '$0.99' },
  { id: 'bag', name: 'Study Bag', emoji: '🎒', coins: 600, price: '$2.49' },
  { id: 'chest', name: 'Coin Chest', emoji: '🪙', coins: 1400, price: '$4.99', popular: true },
  { id: 'vault', name: 'Scholar Vault', emoji: '🏛️', coins: 3500, price: '$9.99' },
];

export default function ShopScreen() {
  const { coins, earnedToday, ownedShopItems, purchaseShopItem, isPlus, addPurchasedCoins } =
    useApp();
  const [activeCategory, setActiveCategory] = useState<ShopCategory>('decoration');
  const capRemaining = Math.max(0, DAILY_EARN_CAP - earnedToday);

  const discount = isPlus ? 0.8 : 1;
  const items = SHOP_ITEMS.filter((i) => i.category === activeCategory);

  const handleCoinPack = (packName: string, packCoins: number, packPrice: string) => {
    Alert.alert(
      `Buy ${packName}?`,
      `${packCoins} coins for ${packPrice}. Purchased coins never expire and don't count toward the daily free earn cap.\n\n🛠 Real payment processing coming in a future update.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Buy for ${packPrice} (Mock)`,
          onPress: () => {
            addPurchasedCoins(packCoins);
            Alert.alert(`+${packCoins} coins added! 🪙`, 'Mock purchase complete.');
          },
        },
      ],
    );
  };

  const handleBuy = (itemId: string, name: string, basePrice: number) => {
    const price = Math.floor(basePrice * discount);
    if (ownedShopItems.includes(itemId)) return;
    if (coins < price) {
      Alert.alert(
        'Not enough coins',
        `You need ${price} 🪙 but only have ${coins}. Keep studying to earn more!`,
      );
      return;
    }
    const discountNote = isPlus ? ` (20% Plus discount applied)` : '';
    Alert.alert(`Buy "${name}"?`, `Spend ${price} 🪙 to unlock this item.${discountNote}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Buy for ${price} 🪙`,
        onPress: () => {
          const ok = purchaseShopItem(itemId, price);
          if (!ok) {
            Alert.alert('Purchase failed', 'Something went wrong. Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header balance */}
          <ThemedView style={styles.balanceRow}>
            <ThemedText type="subtitle" style={styles.title}>Shop</ThemedText>
            <ThemedView type="backgroundElement" style={styles.balancePill}>
              <ThemedText style={styles.coinEmoji}>🪙</ThemedText>
              <ThemedText style={styles.balanceAmount}>{coins}</ThemedText>
            </ThemedView>
          </ThemedView>

          {/* Daily earn progress */}
          <ThemedView type="backgroundElement" style={styles.capCard}>
            <ThemedView style={styles.capRow}>
              <ThemedText type="small" themeColor="textSecondary">Daily earn</ThemedText>
              <ThemedText type="smallBold">
                {earnedToday}/{DAILY_EARN_CAP} 🪙
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.progressBar}>
              <ThemedView
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, (earnedToday / DAILY_EARN_CAP) * 100)}%` },
                ]}
              />
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary" style={styles.capNote}>
              {capRemaining > 0
                ? `${capRemaining} more coins available today`
                : 'Daily cap reached — resets tomorrow!'}
            </ThemedText>
          </ThemedView>

          {/* Plus discount banner */}
          {isPlus ? (
            <ThemedView type="backgroundElement" style={[styles.plusBanner, styles.plusBannerActive]}>
              <ThemedText style={styles.plusBannerEmoji}>🌟</ThemedText>
              <ThemedView style={styles.plusBannerText}>
                <ThemedText type="smallBold">20% Plus discount active</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Applied automatically to all shop items
                </ThemedText>
              </ThemedView>
            </ThemedView>
          ) : (
            <Pressable
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => router.push('/plus-upgrade')}>
              <ThemedView type="backgroundElement" style={styles.plusBanner}>
                <ThemedText style={styles.plusBannerEmoji}>🌟</ThemedText>
                <ThemedView style={styles.plusBannerText}>
                  <ThemedText type="smallBold">Plus members save 20%</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Discount on all shop items — tap to upgrade
                  </ThemedText>
                </ThemedView>
                <ThemedView style={styles.plusBadge}>
                  <ThemedText style={styles.plusBadgeText}>🔒 Plus</ThemedText>
                </ThemedView>
              </ThemedView>
            </Pressable>
          )}

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat}
                style={({ pressed }) => [pressed && styles.pressed]}
                onPress={() => setActiveCategory(cat)}>
                <ThemedView
                  type={activeCategory === cat ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.categoryChip}>
                  <ThemedText type="small" style={activeCategory === cat ? styles.categoryActive : undefined}>
                    {CATEGORY_LABELS[cat]}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ScrollView>

          {activeCategory === 'outfit' && (
            <ThemedView type="backgroundElement" style={styles.outfitNoteCard}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.outfitNoteText}>
                Outfits in v1 are made for the free default girl and default dude only.
              </ThemedText>
            </ThemedView>
          )}

          {/* Items grid */}
          <ThemedView style={styles.grid}>
            {items.map((item) => {
              const owned = ownedShopItems.includes(item.id);
              const discountedPrice = Math.floor(item.price * discount);
              const canAfford = coins >= discountedPrice;
              return (
                <ThemedView
                  key={item.id}
                  type="backgroundElement"
                  style={[styles.itemCard, owned && styles.itemCardOwned]}>
                  <ThemedText style={styles.itemEmoji}>{item.emoji}</ThemedText>
                  <ThemedText type="smallBold" style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.itemDesc} numberOfLines={2}>
                    {item.description}
                  </ThemedText>

                  {owned ? (
                    <ThemedView style={styles.ownedBadge}>
                      <ThemedText style={styles.ownedText}>✓ Owned</ThemedText>
                    </ThemedView>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [
                        styles.buyBtn,
                        !canAfford && styles.buyBtnDisabled,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => handleBuy(item.id, item.name, item.price)}>
                      <ThemedText
                        style={[styles.buyBtnText, !canAfford && styles.buyBtnTextDisabled]}>
                        🪙 {discountedPrice}
                        {isPlus && discountedPrice < item.price && (
                          <ThemedText style={styles.originalPrice}> {item.price}</ThemedText>
                        )}
                      </ThemedText>
                    </Pressable>
                  )}
                </ThemedView>
              );
            })}
          </ThemedView>

          {/* ── Coin Packs ─────────────────────────────────────────────────── */}
          <ThemedView style={styles.section}>
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="smallBold">Coin Packs</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                No expiry · Not capped
              </ThemedText>
            </ThemedView>
            <ThemedText type="small" themeColor="textSecondary" style={styles.packNote}>
              Purchased coins are added directly to your balance and don't count toward the daily
              free earn cap.
            </ThemedText>
            {COIN_PACKS.map((pack) => (
              <Pressable
                key={pack.id}
                style={({ pressed }) => [pressed && styles.pressed]}
                onPress={() => handleCoinPack(pack.name, pack.coins, pack.price)}>
                <ThemedView
                  type="backgroundElement"
                  style={[styles.packCard, pack.popular && styles.packCardPopular]}>
                  <ThemedText style={styles.packEmoji}>{pack.emoji}</ThemedText>
                  <ThemedView style={styles.packInfo}>
                    <ThemedView style={styles.packNameRow}>
                      <ThemedText type="smallBold">{pack.name}</ThemedText>
                      {pack.popular && (
                        <ThemedView style={styles.popularBadge}>
                          <ThemedText style={styles.popularText}>Popular</ThemedText>
                        </ThemedView>
                      )}
                    </ThemedView>
                    <ThemedText type="small" themeColor="textSecondary">
                      {pack.coins} 🪙
                    </ThemedText>
                  </ThemedView>
                  <ThemedView style={styles.packPriceBtn}>
                    <ThemedText style={styles.packPrice}>{pack.price}</ThemedText>
                  </ThemedView>
                </ThemedView>
              </Pressable>
            ))}
            <ThemedView type="backgroundElement" style={styles.packDisclaimerCard}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.packDisclaimer}>
                🛠 Real payment processing will be connected in a future update. Packs are mock
                purchases for now.
              </ThemedText>
            </ThemedView>
          </ThemedView>

          {/* How to earn */}
          <ThemedView type="backgroundElement" style={styles.tipCard}>
            <ThemedText type="smallBold" style={styles.tipTitle}>How to earn coins</ThemedText>
            {[
              { label: 'Complete a 10 min session', coins: 5 },
              { label: 'Complete a 25 min session', coins: 15 },
              { label: 'Complete a 50 min session', coins: 35 },
              { label: 'Complete a 90 min session', coins: 70 },
              { label: 'Complete a task', coins: 10 },
              { label: '3-day streak bonus', coins: 30 },
              { label: '7-day streak bonus', coins: 80 },
            ].map((row) => (
              <ThemedView key={row.label} style={styles.tipRow}>
                <ThemedText type="small" themeColor="textSecondary">{row.label}</ThemedText>
                <ThemedText type="smallBold" style={styles.tipCoins}>+{row.coins} 🪙</ThemedText>
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
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, lineHeight: 34 },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 20,
  },
  coinEmoji: { fontSize: 18, lineHeight: 22 },
  balanceAmount: { fontSize: 22, fontWeight: '700', color: '#F5A623' },
  capCard: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  capRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    marginVertical: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#F5A623',
  },
  capNote: { fontSize: 12 },
  categoryRow: { gap: Spacing.two, paddingVertical: 2 },
  categoryChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: 20,
  },
  outfitNoteCard: {
    borderRadius: 12,
    padding: Spacing.three,
  },
  outfitNoteText: { textAlign: 'center', lineHeight: 18, fontSize: 12 },
  categoryActive: { fontWeight: '700' },
  pressed: { opacity: 0.8 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  itemCard: {
    width: '47%',
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
    alignItems: 'center',
  },
  itemCardOwned: { borderWidth: 1.5, borderColor: '#81C784' },
  itemEmoji: { fontSize: 36, lineHeight: 44 },
  itemName: { textAlign: 'center', fontSize: 14 },
  itemDesc: { textAlign: 'center', lineHeight: 18, fontSize: 12 },
  ownedBadge: {
    marginTop: 4,
    backgroundColor: '#81C78430',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  ownedText: { fontSize: 12, color: '#4CAF50', fontWeight: '600' },
  buyBtn: {
    marginTop: 4,
    backgroundColor: '#7C6F5A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  buyBtnDisabled: { backgroundColor: '#CCC' },
  buyBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  buyBtnTextDisabled: { color: '#888' },
  tipCard: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  tipTitle: { fontSize: 14, marginBottom: 2 },
  tipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipCoins: { color: '#F5A623', fontSize: 13 },
  section: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  packNote: { lineHeight: 18 },
  packCard: {
    borderRadius: 14,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  packCardPopular: { borderWidth: 1.5, borderColor: '#F5A623' },
  packEmoji: { fontSize: 28, lineHeight: 34, width: 36 },
  packInfo: { flex: 1, gap: 2 },
  packNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  popularBadge: {
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  popularText: { fontSize: 10, fontWeight: '700', color: '#F5A623' },
  packPriceBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  packPrice: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  packDisclaimerCard: { borderRadius: 12, padding: Spacing.three },
  packDisclaimer: { textAlign: 'center', lineHeight: 18, fontSize: 12 },
  originalPrice: { textDecorationLine: 'line-through', color: '#999', fontSize: 11 },
  plusBanner: {
    borderRadius: 14,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    opacity: 0.8,
  },
  plusBannerEmoji: { fontSize: 22, lineHeight: 28 },
  plusBannerText: { flex: 1, gap: 2 },
  plusBadge: {
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  plusBadgeText: { fontSize: 12, fontWeight: '700', color: '#F5A623' },
  plusBannerActive: { borderWidth: 1.5, borderColor: '#81C784', opacity: 1 },
});
