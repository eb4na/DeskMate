import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { showPopup } from '@/lib/popup';
import { track } from '@/lib/analytics';
import { PRODUCT_IDS, fetchPrices, purchaseProduct, purchasesReady, type PriceMap } from '@/lib/purchases';
import { AD_REWARD_COINS, DAILY_AD_LIMIT, adsReady, showRewardedAd } from '@/lib/ads';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinAmount, CoinIcon } from '@/components/coin-icon';
import { STREAK_FREEZE_ICON } from '@/components/streak-freeze-icon';
import { BakeryStarEmoji, BakeryWrenchEmoji } from '@/components/bakery-emoji';
import { LockBadge } from '@/components/lock-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { DAILY_EARN_CAP, formatCoins } from '@/constants/placeholder-data';
import { BakeryColors, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';
import { useTabletScale } from '@/hooks/use-tablet-scale';

type CoinPack = { id: string; nameKey: string; coins: number; price: string; popular?: boolean };

const COIN_PACKS: CoinPack[] = [
  { id: 'pouch', nameKey: 'coinShop.pack_pouch', coins: 200, price: '$0.99' },
  { id: 'bag', nameKey: 'coinShop.pack_bag', coins: 600, price: '$2.99' },
  { id: 'chest', nameKey: 'coinShop.pack_chest', coins: 1444, price: '$6.70', popular: true },
  { id: 'vault', nameKey: 'coinShop.pack_vault', coins: 5000, price: '$19.99' },
  { id: 'treasury', nameKey: 'coinShop.pack_treasury', coins: 50000, price: '$99.99' },
];

// Coin packs are tiered desserts — bigger pack, bigger cake.
const PACK_IMAGES: Record<string, number> = {
  pouch: require('@/assets/images/shop/coin-cupcake.png'),
  bag: require('@/assets/images/shop/coin-slice.png'),
  chest: require('@/assets/images/shop/coin-cake1.png'),
  vault: require('@/assets/images/shop/coin-cake2.png'),
  treasury: require('@/assets/images/shop/coin-cake3.png'),
};

// Code-drawn play badge (no emoji, per app icon rules): honey rounded square with a
// white triangle. Used on the watch-a-video row.
function PlayIcon({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: BakeryColors.honey,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size * 0.17,
          borderBottomWidth: size * 0.17,
          borderLeftWidth: size * 0.27,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: '#FFFFFF',
          marginLeft: size * 0.08,
        }}
      />
    </View>
  );
}

export default function CoinShopScreen() {
  const { t } = useTranslation();
  // Tablet: scale every size by one shared factor so the whole screen grows together
  // (it was fixed-size and far too small on iPad).
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const { coins, earnedToday, addPurchasedCoins, isPlus, addStreakFreeze, streakFreezes, adRewardCount, claimAdReward } = useApp();
  const capRemaining = Math.max(0, DAILY_EARN_CAP - earnedToday);
  const adsLeft = Math.max(0, DAILY_AD_LIMIT - adRewardCount);

  // Live App Store prices (localized currency). Falls back to the hardcoded pack
  // strings when IAP is unavailable / fetch fails. Mirrors (tabs)/shop.tsx.
  const [storePrices, setStorePrices] = useState<PriceMap>({});
  useEffect(() => {
    let alive = true;
    fetchPrices([...COIN_PACKS.map((p) => PRODUCT_IDS[p.id as keyof typeof PRODUCT_IDS]), PRODUCT_IDS.streakFreeze]).then((m) => {
      if (alive) setStorePrices(m);
    });
    return () => { alive = false; };
  }, []);
  const packPrice = (pack: CoinPack) => storePrices[PRODUCT_IDS[pack.id as keyof typeof PRODUCT_IDS]] ?? pack.price;
  const freezePrice = storePrices[PRODUCT_IDS.streakFreeze] ?? '$1.99';

  const handleBuyFreeze = () => {
    const productId = PRODUCT_IDS.streakFreeze;
    const grant = () => {
      addStreakFreeze(1);
      track('shop_purchase', { kind: 'freeze' });
      showPopup(t('shop.freezeAdded'), t('shop.purchaseComplete', { defaultValue: 'Thanks for your purchase!' }));
    };
    // Fail closed: dev mock-grants, production refuses when the store is unavailable.
    if (!purchasesReady()) {
      if (__DEV__) {
        showPopup(t('shop.streakFreezeName'), t('shop.streakFreezeDesc'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('shop.buyForMock', { price: freezePrice }), onPress: grant },
        ]);
      } else {
        showPopup(t('shop.storeUnavailable', { defaultValue: 'Store unavailable' }), t('shop.storeUnavailableMsg', { defaultValue: 'Purchases are temporarily unavailable. Please try again later.' }));
      }
      return;
    }
    purchaseProduct(productId).then((res) => {
      if (res.ok) grant();
      else if (!res.cancelled) showPopup(t('shop.purchaseFailed', { defaultValue: 'Purchase failed' }), t('shop.purchaseFailedMsg', { defaultValue: 'Something went wrong and you were not charged. Please try again.' }));
    });
  };

  const handleCoinPack = (pack: CoinPack) => {
    const name = t(pack.nameKey);
    const price = packPrice(pack);
    const productId = PRODUCT_IDS[pack.id as keyof typeof PRODUCT_IDS];
    const grant = () => {
      addPurchasedCoins(pack.coins);
      track('shop_purchase', { kind: 'coins', pack: pack.id, coins: pack.coins });
      showPopup(t('shop.coinsAdded', { coins: pack.coins }), t('shop.purchaseComplete', { defaultValue: 'Thanks for your purchase!' }));
    };
    // Fail closed: never hand out coins for free in production.
    if (!purchasesReady()) {
      if (__DEV__) {
        showPopup(t('coinShop.buyPackQ', { name }), t('coinShop.packDetail', { coins: pack.coins, price }), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('coinShop.buyForMock', { price }), onPress: grant },
        ]);
      } else {
        showPopup(t('shop.storeUnavailable', { defaultValue: 'Store unavailable' }), t('shop.storeUnavailableMsg', { defaultValue: 'Purchases are temporarily unavailable. Please try again later.' }));
      }
      return;
    }
    purchaseProduct(productId).then((res) => {
      if (res.ok) grant();
      else if (!res.cancelled) showPopup(t('shop.purchaseFailed', { defaultValue: 'Purchase failed' }), t('shop.purchaseFailedMsg', { defaultValue: 'Something went wrong and you were not charged. Please try again.' }));
    });
  };

  // Watch a rewarded video for AD_REWARD_COINS, up to DAILY_AD_LIMIT/day. Coins are
  // granted ONLY after a real ad reward fires (showRewardedAd resolves rewarded:true)
  // — same fail-closed rule as coin packs: dev mock-grants, production refuses when no
  // ad / SDK is available. The 3×/day cap is enforced authoritatively in claimAdReward.
  const handleWatchAd = async () => {
    if (adsLeft <= 0) {
      showPopup(t('coinShop.adLimitReached'), t('coinShop.adLimitReachedMsg', { total: DAILY_AD_LIMIT }));
      return;
    }
    const grant = () => {
      if (claimAdReward()) {
        track('ad_reward', { coins: AD_REWARD_COINS });
        showPopup(t('coinShop.adRewardTitle'), t('coinShop.adRewardMsg', { coins: AD_REWARD_COINS }));
      } else {
        showPopup(t('coinShop.adLimitReached'), t('coinShop.adLimitReachedMsg', { total: DAILY_AD_LIMIT }));
      }
    };
    if (!adsReady()) {
      if (__DEV__) {
        showPopup(t('coinShop.watchAdTitle'), t('coinShop.watchAdMock', { coins: AD_REWARD_COINS }), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('coinShop.watchAdButton'), onPress: grant },
        ]);
      } else {
        showPopup(t('coinShop.adUnavailable'), t('coinShop.adUnavailableMsg'));
      }
      return;
    }
    const res = await showRewardedAd();
    if (res.rewarded) grant();
    else showPopup(t('coinShop.adUnavailable'), t('coinShop.adUnavailableMsg'));
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>

          {/* Balance */}
          <ThemedView type="backgroundElement" style={styles.balanceCard}>
            <ThemedText type="small" themeColor="textSecondary">{t('coinShop.yourBalance')}</ThemedText>
            <View style={styles.balanceRow}>
              <CoinIcon size={40 * scale} />
              <ThemedText style={styles.balanceAmount}>{formatCoins(coins)}</ThemedText>
            </View>
          </ThemedView>

          {/* Daily earn progress */}
          <ThemedView type="backgroundElement" style={styles.capCard}>
            <ThemedView type="transparent" style={styles.capRow}>
              <ThemedText type="small" themeColor="textSecondary">{t('coinShop.dailyFreeEarn')}</ThemedText>
              <View style={styles.capCoins}>
                <ThemedText type="smallBold">{earnedToday}/{DAILY_EARN_CAP}</ThemedText>
                <CoinIcon size={28 * scale} />
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

          {/* Watch a video for coins (rewarded ads) */}
          <View style={styles.adCard}>
            <PlayIcon size={40 * scale} />
            <View style={styles.adBody}>
              <ThemedText type="smallBold">{t('coinShop.watchAdTitle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {adsLeft > 0
                  ? t('coinShop.watchAdDesc', { coins: AD_REWARD_COINS, count: adsLeft })
                  : t('coinShop.watchAdDone')}
              </ThemedText>
            </View>
            <SoundPressable
              sound="confirm"
              disabled={adsLeft <= 0}
              onPress={handleWatchAd}
              style={({ pressed }) => [styles.adBtn, adsLeft <= 0 && styles.adBtnDisabled, pressed && styles.pressed]}>
              <ThemedText style={styles.adBtnText}>{t('coinShop.watchAdButton')}</ThemedText>
            </SoundPressable>
          </View>

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
                      <ThemedText style={styles.menuPrice}>{packPrice(pack)}</ThemedText>
                    </View>
                    <View style={styles.menuSubLine}>
                      <CoinAmount amount={pack.coins} size={18 * scale} textStyle={styles.menuCoinText} />
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
                    <ThemedText style={styles.menuPrice}>{freezePrice}</ThemedText>
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
              <BakeryStarEmoji size={28 * scale} />
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
                <BakeryStarEmoji size={28 * scale} />
                <ThemedView type="transparent" style={styles.plusBannerText}>
                  <ThemedText type="smallBold">{t('coinShop.plusSave20')}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{t('coinShop.tapToUpgrade')}</ThemedText>
                </ThemedView>
                <ThemedView style={styles.plusBadge}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <LockBadge size={16 * scale} />
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
                <CoinAmount amount={row.coins} prefix="+" size={26 * scale} textStyle={styles.tipCoins} />
              </ThemedView>
            ))}
          </ThemedView>

        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const makeStyles = (s: number, cw: number) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    paddingHorizontal: Spacing.four * s,
    paddingTop: Spacing.three * s,
    paddingBottom: Spacing.six * s,
    maxWidth: cw,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three * s,
  },
  balanceCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.four * s,
    alignItems: 'center',
    gap: Spacing.one * s,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s },
  balanceAmount: { fontSize: 32 * s, lineHeight: 40 * s, fontWeight: '800', color: BakeryColors.honey },
  capCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three * s,
    gap: Spacing.one * s,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  capRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // ─── Watch-a-video (rewarded ad) row ─────────────────────────────────────
  adCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  adBody: { flex: 1, gap: 2 * s },
  adBtn: {
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: Spacing.three * s,
    paddingVertical: Spacing.two * s,
  },
  adBtnDisabled: { backgroundColor: BakeryColors.latte, opacity: 0.6 },
  adBtnText: { fontSize: 14 * s, fontWeight: '800', color: '#FFFFFF' },
  capCoins: { flexDirection: 'row', alignItems: 'center', gap: 4 * s },
  progressBar: {
    height: 6 * s,
    borderRadius: 3 * s,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
    marginVertical: 4 * s,
  },
  progressFill: { height: '100%', borderRadius: 3 * s, backgroundColor: BakeryColors.honey },
  capNote: { fontSize: 12 * s },
  // ─── Bakery menu of coin packs ───────────────────────────────────────────
  menuCard: {
    borderRadius: BakeryRadii.card,
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingHorizontal: Spacing.three * s,
    paddingVertical: Spacing.two * s,
    ...BakeryShadow,
  },
  menuHeader: {
    alignItems: 'center',
    gap: 2 * s,
    paddingBottom: Spacing.two * s,
    marginBottom: Spacing.one * s,
    borderBottomWidth: 1.5,
    borderBottomColor: BakeryColors.shortbread,
    borderStyle: 'dashed',
  },
  menuTitle: { fontSize: 18 * s, fontWeight: '800', color: BakeryColors.cocoaDark, letterSpacing: 0.5 },
  menuSubtitle: { fontSize: 12 * s, color: BakeryColors.mocha },
  // In-card section heading ("Coins" / "Items") + its little subtitle.
  sectionLabel: { fontSize: 14 * s, fontWeight: '800', color: BakeryColors.cocoaDark, letterSpacing: 0.3, marginTop: Spacing.one * s },
  sectionSubtitle: { fontSize: 11 * s, color: BakeryColors.mocha, marginBottom: 2 * s },
  // Dashed rule separating the Coins and Items sections.
  sectionRule: { borderBottomWidth: 1.5, borderBottomColor: BakeryColors.shortbread, borderStyle: 'dashed', marginVertical: Spacing.two * s },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s, paddingVertical: Spacing.two * s },
  menuIcon: { width: 54 * s, height: 54 * s },
  menuBody: { flex: 1, gap: 3 * s },
  menuTopLine: { flexDirection: 'row', alignItems: 'flex-end' },
  menuName: { flexShrink: 1, fontSize: 15 * s, fontWeight: '700', color: BakeryColors.cocoaDark },
  menuLeader: {
    flex: 1,
    marginHorizontal: 6 * s,
    marginBottom: 4 * s,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: BakeryColors.latte,
  },
  menuPrice: { fontSize: 15 * s, fontWeight: '800', color: BakeryColors.cocoaDark },
  menuSubLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s },
  menuCoinText: { fontSize: 13 * s, color: BakeryColors.mocha },
  chefBadge: {
    backgroundColor: `${BakeryColors.honey}22`,
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: 7 * s,
    paddingVertical: 2 * s,
  },
  chefText: { fontSize: 10 * s, fontWeight: '700', color: BakeryColors.mocha },
  menuDivider: { height: 1 * s, backgroundColor: `${BakeryColors.shortbread}99` },
  plusBanner: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three * s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
    backgroundColor: BakeryColors.glass,
  },
  plusBannerActive: { borderWidth: 1.5, borderColor: '#F2A0B5' },
  plusBannerEmoji: { fontSize: 22 * s, lineHeight: 28 * s },
  plusBannerText: { flex: 1, gap: 2 * s },
  plusBadge: {
    backgroundColor: `${BakeryColors.rose}22`,
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: 8 * s,
    paddingVertical: 4 * s,
  },
  plusBadgeText: { fontSize: 12 * s, fontWeight: '700', color: BakeryColors.berry },
  tipCard: {
    borderRadius: BakeryRadii.card,
    padding: Spacing.three * s,
    gap: Spacing.two * s,
    backgroundColor: BakeryColors.glass,
    ...BakeryShadow,
  },
  tipTitle: { fontSize: 14 * s, marginBottom: 2 * s },
  tipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipCoins: { color: BakeryColors.honey, fontSize: 13 * s },
  pressed: { opacity: 0.8 },
});
