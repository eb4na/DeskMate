import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinAmount, CoinIcon } from '@/components/coin-icon';
import { BreadPouchIcon, BreadBagIcon, BreadChestIcon, BreadVaultIcon } from '@/components/coin-pack-icons';
import { DecoIcon, OutfitIcon, ThemeIcon, PoseIcon, GameIcon, ReminderIcon } from '@/components/category-icons';
import { BakeryStarEmoji, BakeryToastStarEmoji, BakeryLockEmoji, BakeryWrenchEmoji } from '@/components/bakery-emoji';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { isEquipableCategory } from '@/constants/shop-effects';
import { useApp } from '@/context/app-context';
import {
  SHOP_ITEMS,
  CATEGORIES,
  type ShopCategory,
} from '@/constants/shop-data';
import { DAILY_EARN_CAP } from '@/constants/placeholder-data';
import {
  BakeryColors,
  BakeryRadii,
  BakeryShadow,
  BottomTabInset,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';

function CategoryIcon({ id, size }: { id: ShopCategory; size?: number }) {
  if (id === 'decoration') return <DecoIcon size={size} />;
  if (id === 'outfit') return <OutfitIcon size={size} />;
  if (id === 'theme') return <ThemeIcon size={size} />;
  if (id === 'pose') return <PoseIcon size={size} />;
  if (id === 'game') return <GameIcon size={size} />;
  return <ReminderIcon size={size} />;
}

const CATEGORY_SHORT: Record<ShopCategory, string> = {
  decoration: 'Deco',
  outfit: 'Outfit',
  theme: 'Theme',
  pose: 'Pose',
  game: 'Game',
  reminder: 'Alert',
};

const WIN_W = Math.min(Dimensions.get('window').width, MaxContentWidth);
const H_PAD = Spacing.three;
const COLS = 2;
const GAP = 8;
const PAGE_W = WIN_W;
const CARD = Math.floor((PAGE_W - H_PAD * 2 - GAP) / COLS);

type CoinPack = { id: string; name: string; coins: number; price: string; popular?: boolean };
const COIN_PACKS: CoinPack[] = [
  { id: 'pouch', name: 'Small Pouch', coins: 200, price: '$0.99' },
  { id: 'bag', name: 'Study Bag', coins: 600, price: '$2.49' },
  { id: 'chest', name: 'Coin Chest', coins: 1400, price: '$4.99', popular: true },
  { id: 'vault', name: 'Scholar Vault', coins: 3500, price: '$9.99' },
];

const INDICATOR_TRACK = 100;

function HScrollIndicator({ scrollX, contentW, viewW }: { scrollX: number; contentW: number; viewW: number }) {
  if (contentW <= viewW) return null;
  const scrollable = contentW - viewW;
  const pillW = Math.max(16, (viewW / contentW) * INDICATOR_TRACK);
  const pillLeft = (scrollX / scrollable) * (INDICATOR_TRACK - pillW);
  return (
    <View style={indStyles.wrap}>
      <View style={indStyles.track}>
        <View style={[indStyles.pill, { width: pillW, left: pillLeft }]} />
      </View>
    </View>
  );
}

const indStyles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 6 },
  track: { width: INDICATOR_TRACK, height: 4, borderRadius: 2, backgroundColor: BakeryColors.shortbread },
  pill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: BakeryColors.honey },
});

function PackIcon({ id }: { id: string }) {
  if (id === 'pouch') return <BreadPouchIcon size={52} />;
  if (id === 'bag') return <BreadBagIcon size={52} />;
  if (id === 'chest') return <BreadChestIcon size={52} />;
  return <BreadVaultIcon size={52} />;
}

const ITEMS_PER_PAGE = 6;

export default function ShopScreen() {
  const {
    coins,
    earnedToday,
    ownedShopItems,
    equippedShopItems,
    purchaseShopItem,
    equipShopItem,
    isPlus,
    addPurchasedCoins,
  } = useApp();
  const [activeCategory, setActiveCategory] = useState<ShopCategory>('decoration');
  const [itemPage, setItemPage] = useState(0);
  const itemScrollRef = useRef<ScrollView>(null);

  const [catScrollX, setCatScrollX] = useState(0);
  const [catContentW, setCatContentW] = useState(0);
  const [catViewW, setCatViewW] = useState(0);

  const [packScrollX, setPackScrollX] = useState(0);
  const [packContentW, setPackContentW] = useState(0);
  const [packViewW, setPackViewW] = useState(0);

  const discount = isPlus ? 0.8 : 1;
  const items = SHOP_ITEMS.filter((i) => i.category === activeCategory);
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const pages = Array.from({ length: totalPages }, (_, i) => items.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE));
  const capRemaining = Math.max(0, DAILY_EARN_CAP - earnedToday);

  const handleCoinPack = (pack: CoinPack) => {
    Alert.alert(
      `Buy ${pack.name}?`,
      `${pack.coins} coins for ${pack.price}. Purchased coins never expire.\n\n🛠 Mock purchase — real payments coming soon.`,
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

  const handleBuy = (itemId: string, name: string, basePrice: number) => {
    const price = Math.floor(basePrice * discount);
    if (ownedShopItems.includes(itemId)) return;
    if (coins < price) {
      Alert.alert('Not enough coins', `You need ${price} coins but only have ${coins}.`);
      return;
    }
    Alert.alert(`Buy "${name}"?`, `Spend ${price} coins${isPlus ? ' (20% Plus discount)' : ''}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Buy for ${price} coins`,
        onPress: () => {
          if (!purchaseShopItem(itemId, price))
            Alert.alert('Purchase failed', 'Something went wrong. Please try again.');
        },
      },
    ]);
  };

  const handleEquip = (itemId: string, name: string) => {
    const ok = equipShopItem(itemId);
    if (!ok) { Alert.alert("Can't equip yet", 'Unlock this item first.'); return; }
    Alert.alert('Equipped', `${name} is now active.`);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>

        {/* ── Sticky header: balance + daily cap ── */}
        <ThemedView style={styles.header}>
          <ThemedView style={styles.headerInner}>
            <ThemedText type="subtitle" style={styles.title}>Shop</ThemedText>
            <View style={styles.headerRight}>
              {!isPlus && (
                <Pressable onPress={() => router.push('/plus-upgrade')}>
                  <ThemedView style={styles.plusPill}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <BakeryStarEmoji size={14} />
                      <ThemedText style={styles.plusPillText}>Plus −20%</ThemedText>
                    </View>
                  </ThemedView>
                </Pressable>
              )}
              <ThemedView style={styles.balancePill}>
                <CoinIcon size={32} />
                <ThemedText style={styles.balanceNum}>{coins}</ThemedText>
              </ThemedView>
            </View>
          </ThemedView>

          {/* Earn progress bar */}
          <ThemedView style={styles.capRow}>
            <ThemedText style={styles.capLabel}>Daily earn  {earnedToday}/{DAILY_EARN_CAP}</ThemedText>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, (earnedToday / DAILY_EARN_CAP) * 100)}%` }]} />
            </View>
            <ThemedText style={styles.capLabel}>
              {capRemaining > 0 ? `+${capRemaining} left` : 'Full!'}
            </ThemedText>
          </ThemedView>
        </ThemedView>

        <SafeAreaView edges={['bottom']} style={styles.body}>

          {/* ── Category icon strip ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catStrip}
            scrollEventThrottle={16}
            onScroll={(e) => setCatScrollX(e.nativeEvent.contentOffset.x)}
            onContentSizeChange={(w) => setCatContentW(w)}
            onLayout={(e) => setCatViewW(e.nativeEvent.layout.width)}>
            {CATEGORIES.map((cat) => {
              const active = cat === activeCategory;
              return (
                <Pressable key={cat} onPress={() => setActiveCategory(cat)} style={({ pressed }) => pressed && styles.pressed}>
                  <View style={[styles.catSquare, active && styles.catSquareActive]}>
                    <CategoryIcon id={cat} size={36} />
                    <ThemedText style={[styles.catLabel, active && styles.catLabelActive]}>
                      {CATEGORY_SHORT[cat]}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          {catContentW > catViewW && (
            <HScrollIndicator scrollX={catScrollX} contentW={catContentW} viewW={catViewW} />
          )}

          {activeCategory === 'outfit' && (
            <View style={styles.noteCard}>
              <ThemedText style={styles.noteText}>
                Outfits in v1 are for the free default girl and default dude only.
              </ThemedText>
            </View>
          )}

          {/* ── Items paged grid ── */}
          <ScrollView
            ref={itemScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
              setItemPage(page);
            }}
            style={styles.itemScroll}
          >
            {pages.map((pageItems, pageIdx) => (
              <View key={pageIdx} style={styles.itemPage}>
                {Array.from({ length: ITEMS_PER_PAGE }, (_, slotIdx) => {
                  const item = pageItems[slotIdx];
                  if (!item) {
                    return <View key={`empty-${slotIdx}`} style={[styles.itemCard, styles.itemSlot]} />;
                  }
                  const owned = ownedShopItems.includes(item.id);
                  const discountedPrice = Math.floor(item.price * discount);
                  const canAfford = coins >= discountedPrice;
                  const equipable = isEquipableCategory(item.category);
                  const equippedCat = equipable ? (item.category as keyof typeof equippedShopItems) : null;
                  const isEquipped = owned && equippedCat && equippedShopItems[equippedCat] === item.id;

                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => pressed && styles.pressed}
                      onPress={() => {
                        if (owned) {
                          if (equipable && !isEquipped) handleEquip(item.id, item.name);
                        } else {
                          handleBuy(item.id, item.name, item.price);
                        }
                      }}>
                      <View style={[
                        styles.itemCard,
                        owned && styles.itemOwned,
                        isEquipped && styles.itemEquipped,
                        !owned && !canAfford && styles.itemDim,
                      ]}>
                        <ThemedText style={styles.itemEmoji}>{item.emoji}</ThemedText>
                        {owned ? (
                          <View style={[styles.priceBadge, isEquipped ? styles.badgeEquipped : styles.badgeOwned]}>
                            <ThemedText style={styles.badgeText}>{isEquipped ? '✓ Equipped' : '✓ Owned'}</ThemedText>
                          </View>
                        ) : (
                          <CoinAmount
                            amount={discountedPrice}
                            size={22}
                            textStyle={[styles.priceText, !canAfford && styles.priceTextDim]}
                          />
                        )}
                        <ThemedText style={styles.itemName} numberOfLines={1}>{item.name}</ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          {/* Sliding page indicator */}
          {totalPages > 1 && (
            <View style={styles.indicatorWrap}>
              <View style={styles.indicatorTrack}>
                <View style={[styles.indicatorPill, { left: `${(itemPage / totalPages) * 100}%`, width: `${(1 / totalPages) * 100}%` }]} />
              </View>
              <ThemedText style={styles.indicatorLabel}>
                {itemPage + 1} / {totalPages}  ·  {items.length} items
              </ThemedText>
            </View>
          )}

          {/* ── Coin Packs ── */}
          <View style={styles.sectionHead}>
            <ThemedText type="smallBold" style={styles.sectionTitle}>Coin Packs</ThemedText>
            <ThemedText style={styles.sectionSub}>No expiry · Not capped</ThemedText>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.packStrip}
            scrollEventThrottle={16}
            onScroll={(e) => setPackScrollX(e.nativeEvent.contentOffset.x)}
            onContentSizeChange={(w) => setPackContentW(w)}
            onLayout={(e) => setPackViewW(e.nativeEvent.layout.width)}>
            {COIN_PACKS.map((pack) => (
              <Pressable key={pack.id} onPress={() => handleCoinPack(pack)} style={({ pressed }) => pressed && styles.pressed}>
                <View style={[styles.packCard, pack.popular && styles.packPopular]}>
                  {pack.popular && <View style={styles.popularStar}><BakeryToastStarEmoji size={16} /></View>}
                  <PackIcon id={pack.id} />
                  <ThemedText style={styles.packName} numberOfLines={1}>{pack.name}</ThemedText>
                  <CoinAmount amount={pack.coins} size={20} textStyle={styles.packCoinAmt} />
                  <View style={styles.packPriceBtn}>
                    <ThemedText style={styles.packPriceText}>{pack.price}</ThemedText>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <HScrollIndicator scrollX={packScrollX} contentW={packContentW} viewW={packViewW} />

          <View style={styles.disclaimerCard}>
            <View style={styles.disclaimerRow}>
              <BakeryWrenchEmoji size={16} />
              <ThemedText style={styles.disclaimerText}>
                Real payment processing coming in a future update. Packs are mock purchases for now.
              </ThemedText>
            </View>
          </View>

          {/* ── How to earn ── */}
          <View style={styles.tipCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ThemedText style={styles.tipTitle}>How to earn coins</ThemedText>
              <CoinIcon size={18} />
            </View>
            {[
              { label: '10 min session', coins: 5 },
              { label: '25 min session', coins: 15 },
              { label: '50 min session', coins: 35 },
              { label: '90 min session', coins: 70 },
              { label: '3-day streak', coins: 30 },
              { label: '7-day streak', coins: 80 },
            ].map((row) => (
              <View key={row.label} style={styles.tipRow}>
                <ThemedText style={styles.tipLabel}>{row.label}</ThemedText>
                <CoinAmount amount={row.coins} prefix="+" size={20} textStyle={styles.tipCoins} />
              </View>
            ))}
          </View>

        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Sticky header
  header: {
    paddingHorizontal: H_PAD,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
    backgroundColor: BakeryColors.frosting,
    borderBottomWidth: 1,
    borderBottomColor: BakeryColors.shortbread,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, lineHeight: 30 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  plusPill: {
    backgroundColor: `${BakeryColors.honey}22`,
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: BakeryColors.honey,
  },
  plusPillText: { fontSize: 11, fontWeight: '700', color: BakeryColors.mocha, lineHeight: 16 },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BakeryColors.glass,
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: BakeryColors.border,
  },
  balanceNum: { fontSize: 16, fontWeight: '700', color: BakeryColors.honey, lineHeight: 22 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  capLabel: { fontSize: 11, color: BakeryColors.mocha, fontWeight: '600', lineHeight: 16 },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: BakeryColors.honey },

  body: {
    paddingHorizontal: H_PAD,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },

  // Category strip
  catStrip: { gap: Spacing.two, paddingBottom: 2 },
  catSquare: {
    width: 60,
    height: 64,
    borderRadius: BakeryRadii.card,
    backgroundColor: BakeryColors.glass,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  catSquareActive: {
    borderColor: BakeryColors.honey,
    backgroundColor: `${BakeryColors.honey}18`,
  },

  catLabel: { fontSize: 10, fontWeight: '600', color: BakeryColors.mocha, lineHeight: 13 },
  catLabelActive: { color: BakeryColors.cocoaDark, fontWeight: '700' },

  noteCard: {
    backgroundColor: BakeryColors.glass,
    borderRadius: BakeryRadii.card,
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: BakeryColors.shortbread,
  },
  noteText: { fontSize: 12, color: BakeryColors.mocha, textAlign: 'center', lineHeight: 17 },

  // Items paged scroll
  itemScroll: { marginHorizontal: -H_PAD },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  itemPage: {
    width: PAGE_W,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: H_PAD,
    alignContent: 'flex-start',
    paddingBottom: Spacing.two,
  },
  itemSlot: {
    borderStyle: 'dashed',
    borderColor: BakeryColors.shortbread,
    backgroundColor: `${BakeryColors.shortbread}40`,
    shadowOpacity: 0,
    elevation: 0,
  },

  // Sliding indicator
  indicatorWrap: { alignItems: 'center', gap: 6 },
  indicatorTrack: {
    width: '50%',
    height: 4,
    borderRadius: 2,
    backgroundColor: BakeryColors.shortbread,
    overflow: 'hidden',
    position: 'relative',
  },
  indicatorPill: {
    position: 'absolute',
    top: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: BakeryColors.honey,
  },
  indicatorLabel: { fontSize: 11, color: BakeryColors.mocha, fontWeight: '600', lineHeight: 16 },
  itemCard: {
    width: CARD,
    borderRadius: BakeryRadii.card,
    backgroundColor: BakeryColors.glass,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
    ...BakeryShadow,
  },
  itemOwned: { borderColor: BakeryColors.success },
  itemEquipped: { borderColor: BakeryColors.honey, backgroundColor: `${BakeryColors.honey}12` },
  itemDim: { opacity: 0.55 },
  itemEmoji: { fontSize: 52, lineHeight: 62 },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: BakeryColors.mocha,
    lineHeight: 17,
    textAlign: 'center',
  },

  // Price / status below emoji
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeOwned: { backgroundColor: `${BakeryColors.success}25` },
  badgeEquipped: { backgroundColor: `${BakeryColors.honey}25` },
  badgeText: { fontSize: 12, fontWeight: '700', color: BakeryColors.mocha, lineHeight: 16 },
  priceText: { fontSize: 14, fontWeight: '700', color: BakeryColors.cocoaDark, lineHeight: 18 },
  priceTextDim: { color: BakeryColors.latte },

  // Coin packs horizontal scroll
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 15, lineHeight: 20 },
  sectionSub: { fontSize: 11, color: BakeryColors.mocha, lineHeight: 16 },
  packStrip: { gap: Spacing.two, paddingBottom: 4 },
  packCard: {
    width: 120,
    height: 140,
    borderRadius: BakeryRadii.card,
    backgroundColor: BakeryColors.glass,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.two,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    ...BakeryShadow,
  },
  packPopular: { borderColor: BakeryColors.honey },
  popularStar: { position: 'absolute', top: 6, right: 6, fontSize: 12 },
  packName: { fontSize: 12, fontWeight: '700', color: BakeryColors.mocha, textAlign: 'center', lineHeight: 16 },
  packCoinRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  packCoinAmt: { fontSize: 12, fontWeight: '600', color: BakeryColors.mocha, lineHeight: 16 },
  packPriceBtn: {
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.chip,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  packPriceText: { fontSize: 13, fontWeight: '800', color: BakeryColors.cocoaDark, lineHeight: 18 },

  disclaimerCard: {
    backgroundColor: BakeryColors.glass,
    borderRadius: BakeryRadii.card,
    padding: Spacing.two,
    borderWidth: 1,
    borderColor: BakeryColors.shortbread,
  },
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  disclaimerText: { flex: 1, fontSize: 11, color: BakeryColors.mocha, lineHeight: 16 },

  // Earn tips
  tipCard: {
    backgroundColor: BakeryColors.glass,
    borderRadius: BakeryRadii.card,
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: BakeryColors.shortbread,
  },
  tipTitle: { fontSize: 13, fontWeight: '700', color: BakeryColors.mocha, lineHeight: 18 },
  tipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tipLabel: { fontSize: 12, color: BakeryColors.mocha, lineHeight: 17 },
  tipCoins: { color: BakeryColors.honey, fontSize: 12, lineHeight: 17 },

  pressed: { opacity: 0.75 },
});
