import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Dimensions, Image as RNImage, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinAmount, CoinIcon } from '@/components/coin-icon';
import { DecoIcon, OutfitIcon, ThemeIcon, PoseIcon, GameIcon, ReminderIcon } from '@/components/category-icons';
import { BakeryStarEmoji, BakeryLockEmoji, BakeryWrenchEmoji } from '@/components/bakery-emoji';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { isEquipableCategory } from '@/constants/shop-effects';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import {
  SHOP_ITEMS,
  CATEGORIES,
  type ShopCategory,
} from '@/constants/shop-data';
import { outfitsForCharacter } from '@/constants/outfit-data';
import { partnerItemId } from '@/constants/room-data';
import { SHOP_COMPANIONS, STARTER_COMPANION_IMAGES, getStarterActiveId } from '@/lib/companion-utils';
import { DAILY_EARN_CAP } from '@/constants/placeholder-data';
import {
  BakeryColors,
  BakeryRadii,
  BakeryShadow,
  BottomTabClearance,
  MaxContentWidth,
  Spacing,
} from '@/constants/theme';

const CATEGORY_EMOJI: Partial<Record<ShopCategory, string>> = {
  companion: '🐾',
  outfits: '👗',
  background: '🖼️',
  desk: '🪵',
  recipe: '🍰',
  sound: '🎧',
};

const CAT_ICON_IMG: Partial<Record<ShopCategory, number>> = {
  companion: require('@/assets/images/shop/icon-buddy.png'),
  outfits: require('@/assets/images/shop/icon-outfits.png'),
  recipe: require('@/assets/images/shop/icon-recipe.png'),
  background: require('@/assets/images/shop/icon-room.png'),
  desk: require('@/assets/images/shop/icon-desk.png'),
  sound: require('@/assets/images/shop/icon-sound.png'),
  game: require('@/assets/images/shop/icon-game.png'),
  reminder: require('@/assets/images/shop/icon-reminder.png'),
};

function CategoryIcon({ id, size }: { id: ShopCategory; size?: number }) {
  const img = CAT_ICON_IMG[id];
  if (img) {
    const s = (size ?? 56) * 1.05;
    return <RNImage source={img} style={{ width: s, height: s }} resizeMode="contain" />;
  }
  if (id === 'game') return <GameIcon size={size} />;
  if (id === 'reminder') return <ReminderIcon size={size} />;
  const emoji = CATEGORY_EMOJI[id];
  if (emoji) return <ThemedText style={{ fontSize: (size ?? 56) * 0.46 }}>{emoji}</ThemedText>;
  if (id === 'decoration') return <DecoIcon size={size} />;
  if (id === 'outfit') return <OutfitIcon size={size} />;
  if (id === 'theme') return <ThemeIcon size={size} />;
  return <PoseIcon size={size} />;
}

const MAGNIFIER_ICON = require('@/assets/images/shop/magnifier.png');

const WIN_W = Math.min(Dimensions.get('window').width, MaxContentWidth);
const H_PAD = Spacing.three;
const COLS = 2;
const GAP = 8;
const PAGE_W = WIN_W;
const CARD = Math.floor((PAGE_W - H_PAD * 2 - GAP) / COLS);

type CoinPack = { id: string; name: string; coins: number; price: string; popular?: boolean };
const COIN_PACKS: CoinPack[] = [
  { id: 'pouch', name: 'Strawberry Cupcake', coins: 200, price: '$1.00' },
  { id: 'bag', name: 'Lemon Slice', coins: 600, price: '$3.00' },
  { id: 'chest', name: 'Chocolate Cake', coins: 1444, price: '$6.70', popular: true },
  { id: 'vault', name: 'Red Velvet', coins: 5000, price: '$20.00' },
  { id: 'treasury', name: 'Together With You', coins: 50000, price: '$100.00' },
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

// Coin packs are tiered desserts — bigger pack, bigger cake.
const PACK_IMAGES: Record<string, number> = {
  pouch: require('@/assets/images/shop/coin-cupcake.png'),
  bag: require('@/assets/images/shop/coin-slice.png'),
  chest: require('@/assets/images/shop/coin-cake1.png'),
  vault: require('@/assets/images/shop/coin-cake2.png'),
  treasury: require('@/assets/images/shop/coin-cake3.png'),
};

// Where each kind of item is actually used, shown under the shop card so players
// know where to go after buying.
const USE_HINTS: Partial<Record<ShopCategory, string>> = {
  companion: 'Set active in Gallery',
};

const ITEMS_PER_PAGE = 6;

export default function ShopScreen() {
  const { t } = useTranslation();
  const {
    coins,
    earnedToday,
    ownedShopItems,
    equippedShopItems,
    purchaseShopItem,
    equipShopItem,
    isPlus,
    addPurchasedCoins,
    companionSlots,
  } = useApp();
  const [activeCategory, setActiveCategory] = useState<ShopCategory>('companion');
  const [zoomImage, setZoomImage] = useState<number | null>(null);
  const [outfitCharId, setOutfitCharId] = useState<string | null>(null);
  const [itemPage, setItemPage] = useState(0);

  // Characters the user owns (for the Outfits tab).
  const ownedCharacters: { id: string; name: string; image: number | { uri: string } | null; emoji: string }[] = [
    { id: getStarterActiveId('girl'), name: 'Bun', image: STARTER_COMPANION_IMAGES.girl, emoji: '🐱' },
    ...SHOP_COMPANIONS.filter((c) => ownedShopItems.includes(c.id)).map((c) => ({
      id: `shop:${c.id}`,
      name: c.name,
      image: (c.image as number) ?? null,
      emoji: c.emoji,
    })),
    ...companionSlots
      .filter((s) => !!s.imageUri)
      .map((s) => ({ id: s.id, name: s.name, image: { uri: s.imageUri as string }, emoji: s.emoji })),
  ];
  // Every dressable character (owned or not) — so the Outfits tab can show which
  // characters you still need to unlock.
  const allOutfitCharacters: { id: string; name: string; image: number | { uri: string } | null; emoji: string; owned: boolean }[] = [
    { id: getStarterActiveId('girl'), name: 'Bun', image: STARTER_COMPANION_IMAGES.girl, emoji: '🐱', owned: true },
    ...SHOP_COMPANIONS.map((c) => ({
      id: `shop:${c.id}`,
      name: c.name,
      image: (c.image as number) ?? null,
      emoji: c.emoji,
      owned: ownedShopItems.includes(c.id),
    })),
    ...companionSlots
      .filter((s) => !!s.imageUri)
      .map((s) => ({ id: s.id, name: s.name, image: { uri: s.imageUri as string }, emoji: s.emoji, owned: true })),
  ];
  const outfitChar = ownedCharacters.find((c) => c.id === outfitCharId) ?? null;
  const itemScrollRef = useRef<ScrollView>(null);

  const [catScrollX, setCatScrollX] = useState(0);
  const [catContentW, setCatContentW] = useState(0);
  const [catViewW, setCatViewW] = useState(0);



  const discount = isPlus ? 0.8 : 1;
  // Plus-exclusive items (e.g. Tira) are not sold in the shop — they're granted
  // with Plus — but their data stays in SHOP_ITEMS for the gallery & wardrobe.
  const items = SHOP_ITEMS.filter((i) => i.category === activeCategory && !i.plusOnly);
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const pages = Array.from({ length: totalPages }, (_, i) => items.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE));
  const capRemaining = Math.max(0, DAILY_EARN_CAP - earnedToday);

  const handleCoinPack = (pack: CoinPack) => {
    Alert.alert(
      t('shop.buyPackQ', { name: pack.name }),
      t('shop.packDetail', { coins: pack.coins, price: pack.price }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('shop.buyForMock', { price: pack.price }),
          onPress: () => {
            addPurchasedCoins(pack.coins);
            Alert.alert(t('shop.coinsAdded', { coins: pack.coins }), t('shop.mockComplete'));
          },
        },
      ],
    );
  };


  const handleBuy = (itemId: string, name: string, basePrice: number) => {
    const price = Math.floor(basePrice * discount);
    if (ownedShopItems.includes(itemId)) return;
    if (coins < price) {
      Alert.alert(t('shop.notEnoughCoins'), t('shop.notEnoughCoinsMsg', { price, coins }));
      return;
    }
    Alert.alert(t('shop.buyItemQ', { name }), isPlus ? t('shop.spendCoinsPlus', { price }) : t('shop.spendCoins', { price }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('shop.buyForCoins', { price }),
        onPress: () => {
          if (!purchaseShopItem(itemId, price))
            Alert.alert(t('shop.purchaseFailed'), t('errors.generic'));
        },
      },
    ]);
  };

  const goToPartner = (itemId: string) => {
    const partner = partnerItemId(itemId);
    if (!partner) return;
    const pItem = SHOP_ITEMS.find((i) => i.id === partner);
    if (pItem) setActiveCategory(pItem.category);
  };

  const handleEquip = (itemId: string, name: string) => {
    const ok = equipShopItem(itemId);
    if (!ok) { Alert.alert(t('shop.cantEquip'), t('shop.unlockFirst')); return; }
    Alert.alert(t('shop.equippedTitle'), t('shop.nowActive', { name }));
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]} style={styles.scrollBox}>

        {/* ── Sticky header: balance + daily cap ── */}
        <ThemedView style={styles.header}>
          <ThemedView style={styles.headerInner}>
            <ThemedText type="subtitle" style={styles.title}>{t('shop.title')}</ThemedText>
            <View style={styles.headerRight}>
              {!isPlus && (
                <Pressable onPress={() => router.push('/plus-upgrade')}>
                  <ThemedView style={styles.plusPill}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <BakeryStarEmoji size={14} />
                      <ThemedText style={styles.plusPillText}>{t('shop.plusDiscount')}</ThemedText>
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
            <ThemedText style={styles.capLabel}>{t('shop.dailyEarn', { earned: earnedToday, cap: DAILY_EARN_CAP })}</ThemedText>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, (earnedToday / DAILY_EARN_CAP) * 100)}%` }]} />
            </View>
            <ThemedText style={styles.capLabel}>
              {capRemaining > 0 ? t('shop.leftAmount', { count: capRemaining }) : t('shop.full')}
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
                      {t(`shop.cat_${cat}`)}
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
                {t('shop.outfitsV1Note')}
              </ThemedText>
            </View>
          )}

          {/* ── Outfits: owned characters → their costumes ── */}
          {activeCategory === 'outfits' && (
            <View style={styles.outfitsWrap}>
              {!outfitChar ? (
                <>
                  <ThemedText style={styles.outfitsHint}>{t('shop.pickCharacter')}</ThemedText>
                  <View style={styles.outfitCharGrid}>
                    {allOutfitCharacters.map((c) => (
                      <Pressable
                        key={c.id}
                        style={styles.outfitCharCard}
                        onPress={() => {
                          if (c.owned) setOutfitCharId(c.id);
                          else Alert.alert(t('shop.charLocked', { name: c.name }), t('shop.charLockedMsg', { name: c.name }));
                        }}>
                        {c.image ? (
                          <RNImage source={c.image} style={[styles.outfitCharImg, !c.owned && styles.lockedImg]} resizeMode="contain" />
                        ) : (
                          <ThemedText style={[styles.itemEmoji, !c.owned && styles.lockedImg]}>{c.emoji}</ThemedText>
                        )}
                        <ThemedText style={styles.itemName} numberOfLines={1}>{c.name}</ThemedText>
                        <View style={[styles.charBadge, c.owned ? styles.badgeOwned : styles.charLockedBadge]}>
                          <ThemedText style={c.owned ? styles.badgeText : styles.charLockedText}>
                            {c.owned ? t('shop.ownedBadge') : t('shop.lockedBadge')}
                          </ThemedText>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <Pressable style={styles.outfitBack} onPress={() => setOutfitCharId(null)}>
                    <ThemedText style={styles.outfitBackText}>{t('shop.charOutfits', { name: outfitChar.name })}</ThemedText>
                  </Pressable>
                  {outfitsForCharacter(outfitChar.id).length === 0 && (
                    <View style={styles.emptyCard}>
                      <ThemedText style={styles.emptyEmoji}>👗</ThemedText>
                      <ThemedText style={styles.emptyTitle}>{t('shop.noOutfitsYet')}</ThemedText>
                      <ThemedText style={styles.emptyText}>{t('shop.wardrobeEmpty', { name: outfitChar.name })}</ThemedText>
                    </View>
                  )}
                  <View style={styles.outfitGrid}>
                    {outfitsForCharacter(outfitChar.id).map((o) => {
                      const owned = o.price === 0 || ownedShopItems.includes(o.id);
                      const canAfford = coins >= o.price;
                      return (
                        <Pressable
                          key={o.id}
                          disabled={owned || !canAfford}
                          onPress={() => {
                            if (purchaseShopItem(o.id, o.price)) {
                              Alert.alert(t('shop.outfitUnlocked'), t('shop.outfitUnlockedMsg', { name: o.name, char: outfitChar.name }));
                            } else {
                              Alert.alert(t('shop.notEnoughCoins'), t('shop.needCoinsFor', { price: o.price, name: o.name }));
                            }
                          }}>
                          <View style={[styles.itemCard, owned && styles.itemOwned, !owned && !canAfford && styles.itemDim]}>
                            {o.image ? (
                              <>
                                <RNImage source={o.image} style={styles.outfitItemImg} resizeMode="contain" />
                                <Pressable
                                  style={styles.zoomBtn}
                                  hitSlop={8}
                                  onPress={(e) => {
                                    e.stopPropagation?.();
                                    setZoomImage(o.image ?? null);
                                  }}>
                                  <RNImage source={MAGNIFIER_ICON} style={styles.zoomIcon} resizeMode="contain" />
                                </Pressable>
                              </>
                            ) : (
                              <ThemedText style={styles.itemEmoji}>{o.emoji}</ThemedText>
                            )}
                            {owned ? (
                              <View style={[styles.priceBadge, styles.badgeOwned]}>
                                <ThemedText style={styles.badgeText}>{o.price === 0 ? t('shop.defaultBadge') : t('shop.ownedBadge')}</ThemedText>
                              </View>
                            ) : (
                              <CoinAmount amount={o.price} size={22} textStyle={[styles.priceText, !canAfford && styles.priceTextDim]} />
                            )}
                            <ThemedText style={styles.itemName} numberOfLines={1}>{o.name}</ThemedText>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}

          {/* ── Empty category ── */}
          {activeCategory !== 'outfits' && items.length === 0 && (
            <View style={styles.emptyCard}>
              <ThemedText style={styles.emptyEmoji}>🧁</ThemedText>
              <ThemedText style={styles.emptyTitle}>{t('shop.nothingHereYet')}</ThemedText>
              <ThemedText style={styles.emptyText}>{t('shop.newTreatsSoon')}</ThemedText>
            </View>
          )}

          {/* ── Items paged grid ── */}
          {activeCategory !== 'outfits' && items.length > 0 && (
          <><ScrollView
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
                          // Owned companions are set active from the Companion gallery,
                          // not by tapping them here.
                          if (item.category === 'companion') return;
                          if (equipable && !isEquipped) handleEquip(item.id, item.name);
                        } else if (item.plusOnly) {
                          Alert.alert(
                            t('shop.plusExclusive', { name: item.name }),
                            t('shop.plusExclusiveMsg', { name: item.name }),
                          );
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
                        {item.image ? (
                          <>
                            <RNImage source={item.image} style={styles.itemImage} resizeMode="contain" />
                            <Pressable
                              style={styles.zoomBtn}
                              hitSlop={8}
                              onPress={(e) => {
                                e.stopPropagation?.();
                                setZoomImage(item.image ?? null);
                              }}>
                              <RNImage source={MAGNIFIER_ICON} style={styles.zoomIcon} resizeMode="contain" />
                            </Pressable>
                            {partnerItemId(item.id) && (
                              <Pressable
                                style={styles.pairBtn}
                                hitSlop={8}
                                onPress={(e) => { e.stopPropagation?.(); goToPartner(item.id); }}>
                                <View style={styles.pairGlyph}>
                                  <View style={styles.pairRing} />
                                  <View style={[styles.pairRing, styles.pairRing2]} />
                                </View>
                              </Pressable>
                            )}
                          </>
                        ) : (
                          <ThemedText style={styles.itemEmoji}>{item.emoji}</ThemedText>
                        )}
                        {owned ? (
                          <View style={[styles.priceBadge, isEquipped ? styles.badgeEquipped : styles.badgeOwned]}>
                            <ThemedText style={styles.badgeText}>{isEquipped ? t('shop.equippedBadge') : t('shop.ownedBadge')}</ThemedText>
                          </View>
                        ) : item.plusOnly ? (
                          <View style={[styles.priceBadge, styles.badgePlus]}>
                            <ThemedText style={styles.badgePlusText}>{t('shop.plusBadge')}</ThemedText>
                          </View>
                        ) : (
                          <CoinAmount
                            amount={discountedPrice}
                            size={22}
                            textStyle={[styles.priceText, !canAfford && styles.priceTextDim]}
                          />
                        )}
                        <ThemedText style={styles.itemName} numberOfLines={1}>{item.name}</ThemedText>
                        {USE_HINTS[item.category] && (
                          <ThemedText style={styles.useHint} numberOfLines={1}>{t('shop.setActiveInGallery')}</ThemedText>
                        )}
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
                {t('shop.pageIndicator', { page: itemPage + 1, total: totalPages, count: items.length })}
              </ThemedText>
            </View>
          )}
          </>
          )}

          {/* ── Coin Packs (bakery menu) ── */}
          <View style={styles.menuCard}>
            <View style={styles.menuHeader}>
              <ThemedText style={styles.menuTitle}>{t('shop.bakeryMenu')}</ThemedText>
              <ThemedText style={styles.menuSubtitle}>{t('shop.coinsNeverExpire')}</ThemedText>
            </View>
            {COIN_PACKS.map((pack, i) => (
              <Pressable key={pack.id} onPress={() => handleCoinPack(pack)} style={({ pressed }) => pressed && styles.pressed}>
                <View style={styles.menuRow}>
                  <RNImage source={PACK_IMAGES[pack.id] ?? PACK_IMAGES.pouch} style={styles.menuIcon} resizeMode="contain" />
                  <View style={styles.menuBody}>
                    <View style={styles.menuTopLine}>
                      <ThemedText style={styles.menuName} numberOfLines={1}>{pack.name}</ThemedText>
                      <View style={styles.menuLeader} />
                      <ThemedText style={styles.menuPrice}>{pack.price}</ThemedText>
                    </View>
                    <View style={styles.menuSubLine}>
                      <CoinAmount amount={pack.coins} size={20} textStyle={styles.menuCoinText} />
                      {pack.popular && (
                        <View style={styles.chefBadge}><ThemedText style={styles.chefText}>{t('shop.chefsPick')}</ThemedText></View>
                      )}
                    </View>
                  </View>
                </View>
                {i < COIN_PACKS.length - 1 && <View style={styles.menuDivider} />}
              </Pressable>
            ))}
          </View>

          <View style={styles.disclaimerCard}>
            <View style={styles.disclaimerRow}>
              <BakeryWrenchEmoji size={16} />
              <ThemedText style={styles.disclaimerText}>
                {t('shop.realPaymentNote')}
              </ThemedText>
            </View>
          </View>


        </SafeAreaView>
      </ScrollView>

      {/* Zoom-in viewer for companion art */}
      <Modal visible={zoomImage !== null} transparent animationType="fade" onRequestClose={() => setZoomImage(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomImage(null)}>
          {zoomImage !== null && (
            <View style={styles.zoomCard}>
              <RNImage source={zoomImage} style={styles.zoomImage} resizeMode="contain" />
              <ThemedText style={styles.zoomHint}>{t('shop.tapToClose')}</ThemedText>
            </View>
          )}
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Keep the whole shop scroll just above the floating menu bar (its top sits
  // ~144px from the screen bottom; reserve a touch more so nothing is clipped).
  scrollBox: { flex: 1, marginBottom: BottomTabClearance },
  zoomBtn: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: { fontSize: 13 },
  zoomIcon: { width: 30, height: 30 },
  pairBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 30,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: BakeryColors.jam,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairGlyph: { width: 20, height: 12, justifyContent: 'center' },
  pairRing: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BakeryColors.jam,
    left: 0,
  },
  pairRing2: { left: 8 },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(60,40,30,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  zoomCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 28,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    width: '86%',
    maxWidth: 360,
  },
  zoomImage: { width: '100%', height: 300 },
  zoomHint: { fontSize: 12, color: '#9A7B6D' },

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
    paddingBottom: Spacing.four,
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
  itemOwned: { borderColor: '#F2A0B5' },
  itemEquipped: { borderColor: BakeryColors.honey, backgroundColor: `${BakeryColors.honey}12` },
  itemDim: { opacity: 0.55 },
  itemEmoji: { fontSize: 52, lineHeight: 62 },
  itemImage: { width: 62, height: 62 },
  outfitsWrap: { gap: 10, paddingVertical: 4 },
  outfitsHint: { fontSize: 13, color: '#9A7B6D', fontWeight: '600', paddingHorizontal: 4 },
  outfitCharGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' },
  outfitCharCard: {
    width: '30%',
    aspectRatio: 0.82,
    backgroundColor: '#FFFDF8',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FBD9E0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 4,
  },
  outfitCharImg: { width: '78%', height: '64%' },
  outfitItemImg: { width: 62, height: 62 },
  outfitBack: { paddingVertical: 4 },
  outfitBackText: { fontSize: 14, fontWeight: '800', color: '#C4607A' },
  outfitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  emptyCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#FBD9E0',
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#5B3A2E' },
  emptyText: { fontSize: 13, color: '#9A7B6D', textAlign: 'center' },
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
  badgeOwned: { backgroundColor: '#F2A0B525' },
  badgeEquipped: { backgroundColor: `${BakeryColors.honey}25` },
  useHint: { fontSize: 10, color: BakeryColors.latte, textAlign: 'center', lineHeight: 13, marginTop: 1 },
  charBadge: { marginTop: 4, borderRadius: BakeryRadii.chip, paddingHorizontal: 8, paddingVertical: 2 },
  charLockedBadge: { backgroundColor: 'rgba(124,111,90,0.14)' },
  charLockedText: { fontSize: 11, fontWeight: '700', color: BakeryColors.mocha },
  lockedImg: { opacity: 0.4 },
  badgePlus: { backgroundColor: '#C75A7820' },
  badgePlusText: { fontSize: 12, fontWeight: '700', color: '#C75A78', lineHeight: 16 },
  badgeText: { fontSize: 12, fontWeight: '700', color: BakeryColors.mocha, lineHeight: 16 },
  priceText: { fontSize: 14, fontWeight: '700', color: BakeryColors.cocoaDark, lineHeight: 18 },
  priceTextDim: { color: BakeryColors.latte },

  // Coin packs horizontal scroll
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
  packIconImg: { width: 56, height: 56 },
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
