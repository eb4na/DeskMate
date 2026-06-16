import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinAmount, CoinIcon } from '@/components/coin-icon';
import { STREAK_FREEZE_ICON } from '@/components/streak-freeze-icon';
import { BakeryStarEmoji, BakeryWrenchEmoji } from '@/components/bakery-emoji';
import { LockBadge } from '@/components/lock-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { DAILY_EARN_CAP } from '@/constants/placeholder-data';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

type CoinPack = { id: string; nameKey: string; coins: number; price: string; popular?: boolean };

const COIN_PACKS: CoinPack[] = [
  { id: 'pouch', nameKey: 'coinShop.pack_pouch', coins: 200, price: '$1.00' },
  { id: 'bag', nameKey: 'coinShop.pack_bag', coins: 600, price: '$3.00' },
  { id: 'chest', nameKey: 'coinShop.pack_chest', coins: 1444, price: '$6.70', popular: true },
  { id: 'vault', nameKey: 'coinShop.pack_vault', coins: 5000, price: '$20.00' },
  { id: 'treasury', nameKey: 'coinShop.pack_treasury', coins: 50000, price: '$100.00' },
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
  const { t } = useTranslation();
  const { coins, earnedToday, addPurchasedCoins, isPlus, addStreakFreeze, streakFreezes } = useApp();
  const capRemaining = Math.max(0, DAILY_EARN_CAP - earnedToday);

  const handleBuyFreeze = () => {
    showPopup(
      t('shop.streakFreezeName'),
      t('shop.streakFreezeDesc'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('shop.buyForMock', { price: '$2.00' }),
          onPress: () => {
            addStreakFreeze(1);
            showPopup(t('shop.freezeAdded'), t('shop.mockComplete'));
          },
        },
      ],
    );
  };

  const handleCoinPack = (pack: CoinPack) => {
    const name = t(pack.nameKey);
    showPopup(
      t('coinShop.buyPackQ', { name }),
      t('coinShop.packDetail', { coins: pack.coins, price: pack.price }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('coinShop.buyForMock', { price: pack.price }),
          onPress: () => {
            addPurchasedCoins(pack.coins);
            showPopup(t('shop.coinsAdded', { coins: pack.coins }), t('shop.mockComplete'));
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
            <ThemedText type="small" themeColor="textSecondary">{t('coinShop.yourBalance')}</ThemedText>
            <View style={styles.balanceRow}>
              <CoinIcon size={40} />
              <ThemedText style={styles.balanceAmount}>{coins}</ThemedText>
            </View>
          </ThemedView>

          {/* Daily earn progress */}
          <ThemedView type="backgroundElement" style={styles.capCard}>
            <ThemedView type="transparent" style={styles.capRow}>
              <ThemedText type="small" themeColor="textSecondary">{t('coinShop.dailyFreeEarn')}</ThemedText>
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
                ? t('coinShop.moreFreeCoins', { count: capRemaining })
                : t('coinShop.dailyCapReached')}
            </ThemedText>
          </ThemedView>

          {/* ── Bakery Menu — Coins + Items on one paper, split by a rule ── */}
          <View style={styles.menuCard}>
            <View style={styles.menuHeader}>
              <ThemedText style={styles.menuTitle}>{t('shop.bakeryMenu')}</ThemedText>
            </View>

            <ThemedText style={styles.sectionLabel}>{t('shop.sectionCoins')}</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>{t('shop.coinsNeverExpire')}</ThemedText>
            {COIN_PACKS.map((pack, i) => (
              <SoundPressable
                key={pack.id}
                sound="confirm"
                style={({ pressed }) => [pressed && styles.pressed]}
                onPress={() => handleCoinPack(pack)}>
                <View style={styles.menuRow}>
                  <Image source={PACK_IMAGES[pack.id] ?? PACK_IMAGES.pouch} style={styles.menuIcon} resizeMode="contain" />
                  <View style={styles.menuBody}>
                    <View style={styles.menuTopLine}>
                      <ThemedText style={styles.menuName} numberOfLines={1}>{t(pack.nameKey)}</ThemedText>
                      <View style={styles.menuLeader} />
                      <ThemedText style={styles.menuPrice}>{pack.price}</ThemedText>
                    </View>
                    <View style={styles.menuSubLine}>
                      <CoinAmount amount={pack.coins} size={18} textStyle={styles.menuCoinText} />
                      {pack.popular && (
                        <View style={styles.chefBadge}>
                          <ThemedText style={styles.chefText}>{t('shop.chefsPick')}</ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
                {i < COIN_PACKS.length - 1 && <View style={styles.menuDivider} />}
              </SoundPressable>
            ))}

            <View style={styles.sectionRule} />

            <ThemedText style={styles.sectionLabel}>{t('shop.sectionItems')}</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>{t('shop.freezeOwned', { count: streakFreezes })}</ThemedText>
            <Pressable onPress={handleBuyFreeze} style={({ pressed }) => [pressed && styles.pressed]}>
              <View style={styles.menuRow}>
                <Image source={STREAK_FREEZE_ICON} style={styles.menuIcon} resizeMode="contain" />
                <View style={styles.menuBody}>
                  <View style={styles.menuTopLine}>
                    <ThemedText style={styles.menuName} numberOfLines={1}>{t('shop.streakFreezeName')}</ThemedText>
                    <View style={styles.menuLeader} />
                    <ThemedText style={styles.menuPrice}>$2.00</ThemedText>
                  </View>
                  <View style={styles.menuSubLine}>
                    <ThemedText style={styles.menuCoinText}>{t('shop.streakFreezeDesc')}</ThemedText>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>

          {/* Plus discount note */}
          {isPlus ? (
            <ThemedView type="backgroundElement" style={[styles.plusBanner, styles.plusBannerActive]}>
              <BakeryStarEmoji size={28} />
              <ThemedView type="transparent" style={styles.plusBannerText}>
                <ThemedText type="smallBold">{t('coinShop.discountActive')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{t('coinShop.appliedAllItems')}</ThemedText>
              </ThemedView>
            </ThemedView>
          ) : (
            <Pressable
              style={({ pressed }) => [pressed && styles.pressed]}
              onPress={() => router.push('/plus-upgrade')}>
              <ThemedView type="backgroundElement" style={styles.plusBanner}>
                <BakeryStarEmoji size={28} />
                <ThemedView type="transparent" style={styles.plusBannerText}>
                  <ThemedText type="smallBold">{t('coinShop.plusSave20')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{t('coinShop.tapToUpgrade')}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.plusBadge}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <LockBadge size={16} />
                    <ThemedText style={styles.plusBadgeText}>Plus</ThemedText>
                  </View>
                </ThemedView>
              </ThemedView>
            </Pressable>
          )}

          {/* How to earn */}
          <ThemedView type="backgroundElement" style={styles.tipCard}>
            <ThemedText type="smallBold" style={styles.tipTitle}>{t('coinShop.howToEarn')}</ThemedText>
            {[
              { labelKey: 'coinShop.earn_10min', coins: 5 },
              { labelKey: 'coinShop.earn_25min', coins: 15 },
              { labelKey: 'coinShop.earn_50min', coins: 35 },
              { labelKey: 'coinShop.earn_90min', coins: 70 },
              { labelKey: 'coinShop.earn_3day', coins: 30 },
              { labelKey: 'coinShop.earn_7day', coins: 80 },
            ].map((row) => (
              <ThemedView key={row.labelKey} type="transparent" style={styles.tipRow}>
                <ThemedText type="small" themeColor="textSecondary">{t(row.labelKey)}</ThemedText>
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
  // In-card section heading ("Coins" / "Items") + its little subtitle.
  sectionLabel: { fontSize: 14, fontWeight: '800', color: BakeryColors.cocoaDark, letterSpacing: 0.3, marginTop: Spacing.one },
  sectionSubtitle: { fontSize: 11, color: BakeryColors.mocha, marginBottom: 2 },
  // Dashed rule separating the Coins and Items sections.
  sectionRule: { borderBottomWidth: 1.5, borderBottomColor: BakeryColors.shortbread, borderStyle: 'dashed', marginVertical: Spacing.two },
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
