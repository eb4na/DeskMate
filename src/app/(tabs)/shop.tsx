import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Image as RNImage, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { SoundPreviewButton } from '@/components/sound-preview-button';
import type { StyleProp, TextStyle } from 'react-native';
import { showPopup } from '@/lib/popup';
import { stopPreview } from '@/lib/ambience-audio';
import { track } from '@/lib/analytics';
import { PRODUCT_IDS, fetchPrices, purchaseProduct, purchasesReady, type PriceMap } from '@/lib/purchases';
import { useIsTablet } from '@/hooks/use-device-class';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinAmount, CoinIcon } from '@/components/coin-icon';
import { STREAK_FREEZE_ICON } from '@/components/streak-freeze-icon';
import { DecoIcon, OutfitIcon, ThemeIcon, PoseIcon, GameIcon, ReminderIcon } from '@/components/category-icons';
import { BakeryStarEmoji } from '@/components/bakery-emoji';
import { LockOverlay } from '@/components/lock-badge';
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
import { pairForItem, isPairOwned, partnerItemId, ROOM_PAIRS } from '@/constants/room-data';
import { SHOP_COMPANIONS, STARTER_COMPANION_IMAGES, getStarterActiveId, isCompanionOwned, localizeCompanionName, localizeOutfitName, BUN_SKINS, getCompanionSkins } from '@/lib/companion-utils';
import { RECIPE_IDS, hasAllRecipeBadges } from '@/app/food-gallery';
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
  companion: '',
  outfits: '',
  background: '',
  desk: '',
  recipe: '',
  sound: '',
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

const _win = Dimensions.get('window');
const _shortest = Math.min(_win.width, _win.height);
const _isTabletDevice = _shortest >= 600;
// Tablet shop scale: anchored so the 11" Pro (shortest side 834) is the design
// reference (= the current look), and larger iPads render the SAME layout
// proportionally bigger. The ×1.15 makes the whole shop a touch larger than the old
// fixed tablet sizes ("so it's bigger"). 1.0 on phone — phone layout is unchanged.
// Dial the 1.15 to taste.
const SHOP_TS = _isTabletDevice ? Math.max(1, _shortest / 834) * 1.15 : 1;
// On tablet the grid/menu may grow past the old 800px phone cap so the shop fills
// more of the screen instead of a narrow centered column (capped at the device).
const WIN_W = Math.min(_win.width, MaxContentWidth * SHOP_TS);
// Outfit preview stage — a scaled phone-shaped pane that reproduces the home
// screen's exact layout (desk fills the bottom 54%, the character's feet sit at
// 38%, the character art is ~35% of the screen height). Sized in explicit px so
// the proportions can't drift with flex/percentage quirks.
const PREVIEW_WIN = Dimensions.get('window');
const PREVIEW_STAGE_H = Math.min(PREVIEW_WIN.height * 0.54, 470);
const PREVIEW_STAGE_W = PREVIEW_STAGE_H * (PREVIEW_WIN.width / PREVIEW_WIN.height);
const PREVIEW_CHAR = PREVIEW_STAGE_H * 0.355; // home: 300px char / ~845px screen
const PREVIEW_CHAR_BOTTOM = PREVIEW_STAGE_H * 0.38; // home: char layer bottom 38%
const PREVIEW_DESK_H = PREVIEW_STAGE_H * 0.54; // home: desk height 54%
const H_PAD = Spacing.three;
const COLS = 2;
const GAP = 8;
const PAGE_W = WIN_W;
const CARD = Math.floor((PAGE_W - H_PAD * 2 - GAP) / COLS);

type CoinPack = { id: string; name: string; coins: number; price: string; popular?: boolean };
const COIN_PACKS: CoinPack[] = [
  { id: 'pouch', name: 'Strawberry Cupcake', coins: 200, price: '$0.99' },
  { id: 'bag', name: 'Lemon Slice', coins: 600, price: '$2.99' },
  { id: 'chest', name: 'Chocolate Cake', coins: 1444, price: '$6.70', popular: true },
  { id: 'vault', name: 'Red Velvet', coins: 5000, price: '$19.99' },
  { id: 'treasury', name: 'Together With You', coins: 50000, price: '$99.99' },
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

type ShopItemT = (typeof SHOP_ITEMS)[number];
// A pending purchase shown in the white confirm popup. `items` are the (unowned)
// items to buy; `equip` runs after a successful purchase so the thing shows up.
type BuyReq = { title: string; items: ShopItemT[]; total: number; equip?: () => void; equipName?: string };

// Price display. When a discount applies (Plus members get 25% off), show the
// original price struck through next to the discounted price; otherwise just the
// price. `discount` is the multiplier (1 = no discount, 0.75 = Plus).
function PriceTag({ price, discount, size = 22, textStyle }: {
  price: number;
  discount: number;
  size?: number;
  textStyle?: StyleProp<TextStyle>;
}) {
  const discounted = Math.floor(price * discount);
  if (discount >= 1 || price <= 0) {
    return <CoinAmount amount={discounted} size={size} textStyle={textStyle} />;
  }
  return (
    <View style={styles.priceTagRow}>
      <ThemedText style={styles.priceOrig}>{price}</ThemedText>
      <CoinAmount amount={discounted} size={size} textStyle={textStyle} />
    </View>
  );
}

export default function ShopScreen() {
  const { t } = useTranslation();
  // Tablet: bigger item pictures + cards so the wide cards aren't mostly white space.
  const isTablet = useIsTablet();
  const insets = useSafeAreaInsets();
  // Stop any sound preview when the shop tab loses focus (tabs don't unmount).
  useFocusEffect(useCallback(() => () => stopPreview(), []));
  // All tablet sizes scale by SHOP_TS (1.0 at the 11" reference, larger on bigger
  // iPads) so the whole shop stays proportional across devices.
  const tImgWrap = isTablet && { height: 130 * SHOP_TS };
  const tImg = isTablet && { width: 110 * SHOP_TS, height: 110 * SHOP_TS };
  const tEmoji = isTablet && { fontSize: 80 * SHOP_TS, lineHeight: 92 * SHOP_TS };
  const tName = isTablet && { fontSize: 14 * SHOP_TS };
  // Tablet: the Bakery Menu coin packs read tiny on a wide screen — scale the card,
  // pack art, names, prices and coin amounts up so coin purchases are easy to tap.
  const tMenuCard = isTablet && { paddingHorizontal: Spacing.four * SHOP_TS, paddingTop: 48 * SHOP_TS, paddingBottom: Spacing.three * SHOP_TS };
  const tMenuTitle = isTablet && { fontSize: 28 * SHOP_TS };
  const tSectionLabel = isTablet && { fontSize: 22 * SHOP_TS };
  const tSectionSub = isTablet && { fontSize: 16 * SHOP_TS };
  const tMenuRow = isTablet && { paddingVertical: Spacing.three * SHOP_TS, gap: Spacing.three * SHOP_TS };
  const tMenuIcon = isTablet && { width: 100 * SHOP_TS, height: 100 * SHOP_TS };
  const tMenuName = isTablet && { fontSize: 25 * SHOP_TS, lineHeight: 30 * SHOP_TS };
  const tMenuPrice = isTablet && { fontSize: 25 * SHOP_TS };
  const tMenuCoin = isTablet && { fontSize: 20 * SHOP_TS };
  const {
    coins,
    earnedToday,
    ownedShopItems,
    starterCompanionId,
    equippedShopItems,
    purchaseShopItem,
    equipShopItem,
    setActiveCompanion,
    setBunSkin,
    setCompanionSkin,
    equippedBackgroundRoomId,
    equippedDeskRoomId,
    setEquippedBackground,
    setEquippedDesk,
    setAmbience,
    ambienceId,
    isPlus,
    addPurchasedCoins,
    addStreakFreeze,
    streakFreezes,
    companionSlots,
    madeFoods,
  } = useApp();
  const allRecipesDone = hasAllRecipeBadges(madeFoods);
  const recipesDoneCount = RECIPE_IDS.filter((id) => madeFoods.includes(id)).length;
  const [activeCategory, setActiveCategory] = useState<ShopCategory>('companion');
  const [zoomImage, setZoomImage] = useState<number | null>(null);
  // Desk-setup preview for an outfit on a character the player doesn't own yet
  // (view-only). Shows the costume art on the player's current room + desk.
  const [outfitPreview, setOutfitPreview] = useState<{ image: number | null; name: string; charName: string } | null>(null);

  // Open straight to a category when navigated with a `category` param (e.g. from
  // a locked recipe in the Bakery Menu). Consumed once so it doesn't stick.
  const { category: categoryParam, buyPair: buyPairParam, buyOutfit: buyOutfitParam } = useLocalSearchParams<{ category?: string; buyPair?: string; buyOutfit?: string }>();
  useEffect(() => {
    if (categoryParam && CATEGORIES.includes(categoryParam as ShopCategory)) {
      setActiveCategory(categoryParam as ShopCategory);
      router.setParams({ category: undefined });
    }
  }, [categoryParam]);
  const [outfitCharId, setOutfitCharId] = useState<string | null>(null);
  const [itemPage, setItemPage] = useState(0);
  const [lorePop, setLorePop] = useState<{ name: string; text: string } | null>(null);
  // The purchase the white confirm popup is currently asking about.
  const [buyReq, setBuyReq] = useState<BuyReq | null>(null);
  // After a successful buy, ask whether to equip the new item now.
  const [equipPrompt, setEquipPrompt] = useState<{ name: string; equip: () => void } | null>(null);

  // Live App Store prices keyed by product id (localized currency). Falls back to
  // the hardcoded pack.price strings when IAP is unavailable / fetch fails.
  const [storePrices, setStorePrices] = useState<PriceMap>({});
  useEffect(() => {
    let alive = true;
    fetchPrices([...COIN_PACKS.map((p) => PRODUCT_IDS[p.id as keyof typeof PRODUCT_IDS]), PRODUCT_IDS.streakFreeze]).then((m) => {
      if (alive) setStorePrices(m);
    });
    return () => { alive = false; };
  }, []);
  // The price to show for a pack: the store's localized price if we have it.
  const packPrice = (pack: CoinPack) => storePrices[PRODUCT_IDS[pack.id as keyof typeof PRODUCT_IDS]] ?? pack.price;

  // Characters the user owns (for the Outfits tab). Bun is only owned when it's
  // the chosen starter or was bought from the shop.
  const ownsBun = isCompanionOwned('companion_bun', starterCompanionId, ownedShopItems);
  // Every dressable character (owned or not) — so the Outfits tab can show which
  // characters you still need to unlock.
  const allOutfitCharacters: { id: string; name: string; image: number | { uri: string } | null; emoji: string; owned: boolean }[] = [
    { id: getStarterActiveId('girl'), name: 'Bun', image: STARTER_COMPANION_IMAGES.girl, emoji: '', owned: ownsBun },
    ...SHOP_COMPANIONS.map((c) => ({
      id: `shop:${c.id}`,
      name: c.name,
      image: (c.image as number) ?? null,
      emoji: c.emoji,
      owned: isCompanionOwned(c.id, starterCompanionId, ownedShopItems),
    })),
    ...companionSlots
      .filter((s) => !!s.imageUri)
      .map((s) => ({ id: s.id, name: s.name, image: { uri: s.imageUri as string }, emoji: s.emoji, owned: true })),
  ];
  // Resolve from the full list so an unowned character's wardrobe can still be
  // browsed (view-only). `owned` decides buy vs. preview-only downstream.
  const outfitChar = allOutfitCharacters.find((c) => c.id === outfitCharId) ?? null;
  const itemScrollRef = useRef<ScrollView>(null);

  const [catScrollX, setCatScrollX] = useState(0);
  const [catContentW, setCatContentW] = useState(0);
  const [catViewW, setCatViewW] = useState(0);



  const discount = isPlus ? 0.75 : 1;
  // Some companions aren't sold: Plus-exclusive (Tira) are granted with Plus, and
  // badge-reward ones (Hanji, requiresAllRecipes) are granted by collecting every
  // recipe badge. Their data stays in SHOP_ITEMS for the gallery & wardrobe.
  const items = SHOP_ITEMS.filter((i) => i.category === activeCategory && !i.plusOnly && !i.requiresAllRecipes);
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const pages = Array.from({ length: totalPages }, (_, i) => items.slice(i * ITEMS_PER_PAGE, (i + 1) * ITEMS_PER_PAGE));
  const capRemaining = Math.max(0, DAILY_EARN_CAP - earnedToday);
  // The player's current room + desk, used to stage the outfit preview.
  const previewBgRoom = ROOM_PAIRS.find((r) => r.id === equippedBackgroundRoomId) ?? ROOM_PAIRS[0];
  const previewDeskRoom = ROOM_PAIRS.find((r) => r.id === equippedDeskRoomId) ?? ROOM_PAIRS[0];

  const handleBuyFreeze = () => {
    const productId = PRODUCT_IDS.streakFreeze;
    const price = storePrices[productId] ?? '$1.99';
    const grant = () => {
      addStreakFreeze(1);
      track('shop_purchase', { kind: 'freeze' });
      showPopup(t('shop.freezeAdded'), t('shop.purchaseComplete', { defaultValue: 'Thanks for your purchase!' }));
    };
    // Same fail-closed rule as coin packs: dev mock-grants, production refuses when
    // the store is unavailable so a freeze is never handed out for free.
    if (!purchasesReady()) {
      if (__DEV__) {
        showPopup(t('shop.streakFreezeName'), t('shop.streakFreezeDesc'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('shop.buyForMock', { price }), onPress: grant },
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
    const price = packPrice(pack);
    const productId = PRODUCT_IDS[pack.id as keyof typeof PRODUCT_IDS];
    const grant = () => {
      addPurchasedCoins(pack.coins);
      track('shop_purchase', { kind: 'coins', pack: pack.id, coins: pack.coins });
      showPopup(t('shop.coinsAdded', { coins: pack.coins }), t('shop.purchaseComplete', { defaultValue: 'Thanks for your purchase!' }));
    };
    // No real store available. In dev we mock-grant so the app stays testable; in a
    // production build we MUST refuse — never hand out coins for free.
    if (!purchasesReady()) {
      if (__DEV__) {
        showPopup(t('shop.buyPackQ', { name: pack.name }), t('shop.packDetail', { coins: pack.coins, price }), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('shop.buyForMock', { price }), onPress: grant },
        ]);
      } else {
        showPopup(t('shop.storeUnavailable', { defaultValue: 'Store unavailable' }), t('shop.storeUnavailableMsg', { defaultValue: 'Purchases are temporarily unavailable. Please try again later.' }));
      }
      return;
    }
    // Real purchase: StoreKit shows its own confirmation sheet, so go straight to it.
    purchaseProduct(productId).then((res) => {
      if (res.ok) grant();
      else if (!res.cancelled) showPopup(t('shop.purchaseFailed', { defaultValue: 'Purchase failed' }), t('shop.purchaseFailedMsg', { defaultValue: 'Something went wrong and you were not charged. Please try again.' }));
    });
  };


  // Open the white confirm popup for a single item the player tapped to buy.
  const openBuy = (item: ShopItemT) => {
    if (ownedShopItems.includes(item.id)) return;
    if (item.requiresAllRecipes && !allRecipesDone) {
      showPopup(
        t('shop.recipeLockTitle', { name: localizeCompanionName(item.name, t) }),
        t('shop.recipeLockMsg', { name: localizeCompanionName(item.name, t), done: recipesDoneCount, total: RECIPE_IDS.length }),
      );
      return;
    }
    const pair = pairForItem(item.id);
    // Attach an equip action by category so the post-purchase "Equip now?" prompt
    // knows what to do. Recipes aren't equipped (picked in the Bakery Menu) → none.
    const equip =
      item.category === 'desk' && pair ? () => setEquippedDesk(pair.id)
      : item.category === 'background' && pair ? () => setEquippedBackground(pair.id)
      : item.category === 'companion' ? () => setActiveCompanion(`shop:${item.id}` as never)
      // Sounds map to an ambience id (sound_<id>); equipping sets it as the active ambience.
      : item.category === 'sound' ? () => setAmbience(item.id.replace('sound_', ''))
      : isEquipableCategory(item.category) ? () => { equipShopItem(item.id); }
      : undefined;
    setBuyReq({
      title: t('shop.buyItemQ', { name: localizeCompanionName(item.name, t) }),
      items: [item],
      total: Math.floor(item.price * discount),
      equip,
      equipName: localizeCompanionName(item.name, t),
    });
  };

  // The pair button buys + equips the WHOLE matched set (background + desk) so the
  // finished room shows up at once. If both halves are already owned, just equip.
  // `outfitId` (optional) is the paid outfit that triggered this pair-buy from the
  // wardrobe chain link — it's listed in the popup + worn on equip, so the popup
  // shows EVERYTHING the look needs (outfit + background + desk), not just the room.
  const openPairBuy = (item: ShopItemT, outfitId?: string) => {
    const pair = pairForItem(item.id);
    if (!pair) return;
    const outfitNeeded = !!outfitId && !ownedShopItems.includes(outfitId);
    // Fully owned (room + outfit) → just equip the whole look.
    if (isPairOwned(pair, ownedShopItems) && !outfitNeeded) {
      setEquippedBackground(pair.id);
      setEquippedDesk(pair.id);
      if (outfitId) equipShopItem(outfitId);
      showPopup(t('shop.equippedTitle'), t('shop.nowActive', { name: pair.name }));
      return;
    }
    const need = [pair.backgroundId, pair.deskId, outfitId]
      .filter((id): id is string => !!id && !ownedShopItems.includes(id))
      .map((id) => SHOP_ITEMS.find((s) => s.id === id))
      .filter((it): it is ShopItemT => !!it);
    setBuyReq({
      title: t('editRoom.unlockPair', { name: pair.name }),
      items: need,
      total: need.reduce((sum, it) => sum + Math.floor(it.price * discount), 0),
      equip: () => { setEquippedBackground(pair.id); setEquippedDesk(pair.id); if (outfitId) equipShopItem(outfitId); },
      equipName: pair.name,
    });
  };

  // Arriving with a `buyPair` param (e.g. from an outfit's chain link) opens the
  // matched room's buy popup straight away, on the right category tab.
  useEffect(() => {
    if (!buyPairParam) return;
    const item = SHOP_ITEMS.find((s) => s.id === buyPairParam);
    if (item) {
      setActiveCategory(item.category as ShopCategory);
      openPairBuy(item, buyOutfitParam || undefined);
    }
    router.setParams({ buyPair: undefined, buyOutfit: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyPairParam]);

  // Confirm the popup: buy everything it lists, then ask whether to equip it now.
  const confirmBuy = () => {
    if (!buyReq || coins < buyReq.total) return;
    for (const it of buyReq.items) purchaseShopItem(it.id, Math.floor(it.price * discount));
    track('shop_purchase', {
      itemIds: buyReq.items.map((it) => it.id),
      count: buyReq.items.length,
      total: buyReq.total,
    });
    const { equip, equipName, items } = buyReq;
    setBuyReq(null);
    // Companions get the full-screen "character obtained" celebration (mounted at
    // the app root, fired from purchaseShopItem) instead of the small equip prompt —
    // its "Meet" button sets the companion active in the gallery.
    const boughtCompanion = items.some((it) => it.category === 'companion');
    if (boughtCompanion) {
      // handled by CharacterObtainedModal
    } else if (equip) {
      setEquipPrompt({ name: equipName ?? '', equip });
    } else if (items.some((it) => it.category === 'recipe')) {
      // Recipes aren't equipped — they're baked from the Bakery Menu. Confirm the
      // purchase and point the player there instead of showing a do-nothing prompt.
      showPopup(
        t('shop.recipeBoughtTitle'),
        t('shop.recipeBoughtMsg', { name: equipName ?? localizeCompanionName(items[0].name, t) }),
      );
    }
  };

  const handleEquip = (itemId: string, name: string) => {
    const ok = equipShopItem(itemId);
    if (!ok) { showPopup(t('shop.cantEquip'), t('shop.unlockFirst')); return; }
    showPopup(t('shop.equippedTitle'), t('shop.nowActive', { name }));
  };

  // Equip an owned background/desk straight into the room (not equipShopItem,
  // which the home screen ignores for room art).
  const equipRoomHalf = (item: ShopItemT) => {
    const pair = pairForItem(item.id);
    if (!pair) return;
    if (item.category === 'background') setEquippedBackground(pair.id);
    else setEquippedDesk(pair.id);
    showPopup(t('shop.equippedTitle'), t('shop.nowActive', { name: localizeCompanionName(item.name, t) }));
  };

  return (
    <ThemedView style={styles.container}>
      {/* ── Fixed header: balance + daily cap ── */}
      <ThemedView style={[styles.header, { paddingTop: (styles.header.paddingTop as number) + insets.top }]}>
        <ThemedView style={styles.headerInner}>
          <ThemedText type="subtitle" style={styles.title}>{t('shop.title')}</ThemedText>
          <View style={styles.headerRight}>
            {/* Old "★ Plus −25%" star pill hidden — the new Plus asset is the
                chocolate box. Restore by switching `false` back to `!isPlus`. */}
            {false && (
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

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollBox}>
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
                  <View style={[styles.catSquare, isTablet && { width: 96 * SHOP_TS, height: 104 * SHOP_TS }, active && styles.catSquareActive]}>
                    <CategoryIcon id={cat} size={isTablet ? 60 * SHOP_TS : 36} />
                    <ThemedText style={[styles.catLabel, isTablet && { fontSize: 15 * SHOP_TS, lineHeight: 19 * SHOP_TS }, active && styles.catLabelActive]}>
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
                    {allOutfitCharacters.map((c) => {
                      // Hanji is a secret badge reward — keep her a mystery "?"
                      // (art + name hidden) until the player earns her.
                      const mystery = c.id === 'shop:companion_hanji' && !c.owned;
                      return (
                      <Pressable
                        key={c.id}
                        style={styles.outfitCharCard}
                        onPress={() => {
                          // Hanji stays a secret until earned. Every other character's
                          // wardrobe opens even when unowned — browsable (view-only).
                          if (mystery) { showPopup(t('shop.charLocked', { name: '???' }), t('shop.hanjiOutfitHint')); return; }
                          setOutfitCharId(c.id);
                        }}>
                        {mystery ? (
                          <View style={styles.mysteryImg}><ThemedText style={styles.mysteryMark}>?</ThemedText></View>
                        ) : (
                          <View style={styles.outfitArtWrap}>
                            {c.image ? (
                              <RNImage source={c.image} style={styles.outfitArtImg} resizeMode="contain" />
                            ) : (
                              <ThemedText style={[styles.itemEmoji, tEmoji]}>{c.emoji}</ThemedText>
                            )}
                            {!c.owned && <LockOverlay size={28} radius={12} />}
                          </View>
                        )}
                        {!mystery && (
                          <>
                            <ThemedText style={[styles.itemName, tName]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{localizeCompanionName(c.name, t)}</ThemedText>
                            <View style={[styles.charBadge, c.owned ? styles.badgeOwned : styles.charLockedBadge]}>
                              <ThemedText style={c.owned ? styles.badgeText : styles.charLockedText}>
                                {c.owned ? t('shop.ownedBadge') : t('shop.lockedBadge')}
                              </ThemedText>
                            </View>
                          </>
                        )}
                      </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  <Pressable style={styles.outfitBack} onPress={() => setOutfitCharId(null)}>
                    <ThemedText style={styles.outfitBackText}>{t('shop.charOutfits', { name: outfitChar.name })}</ThemedText>
                  </Pressable>
                  {/* Unowned character → wardrobe is view-only. Tapping a costume
                      previews it on the player's current desk; buying needs the
                      character first. */}
                  {!outfitChar.owned && (
                    <View style={styles.viewOnlyNote}>
                      <ThemedText style={styles.viewOnlyNoteText}>{t('shop.charLockedMsg', { name: localizeCompanionName(outfitChar.name, t) })}</ThemedText>
                    </View>
                  )}
                  {outfitsForCharacter(outfitChar.id).length === 0 && (
                    <View style={styles.emptyCard}>
                      <ThemedText style={styles.emptyTitle}>{t('shop.noOutfitsYet')}</ThemedText>
                      <ThemedText style={styles.emptyText}>{t('shop.wardrobeEmpty', { name: outfitChar.name })}</ThemedText>
                    </View>
                  )}
                  <View style={styles.outfitGrid}>
                    {outfitsForCharacter(outfitChar.id).map((o) => {
                      const charOwned = outfitChar.owned;
                      const owned = o.price === 0 || ownedShopItems.includes(o.id);
                      const canAfford = coins >= o.price;
                      const isBun = outfitChar.id === getStarterActiveId('girl');
                      const skin = (isBun ? BUN_SKINS : getCompanionSkins(outfitChar.id)).find((s) => s.shopItemId === o.id);
                      return (
                        <View key={o.id} style={styles.outfitSlot}>
                          <Pressable
                            disabled={charOwned && (owned || !canAfford)}
                            onPress={() => {
                              if (!charOwned) {
                                setOutfitPreview({ image: o.image ?? null, name: o.name, charName: outfitChar.name });
                                return;
                              }
                              const equip = skin
                                ? () => { if (isBun) setBunSkin(skin.id); else setCompanionSkin(outfitChar.id, skin.id); }
                                : undefined;
                              setBuyReq({
                                title: t('shop.buyItemQ', { name: localizeOutfitName(o.name, t) }),
                                items: [{ id: o.id, name: o.name, emoji: o.emoji, description: '', price: o.price, category: 'outfits', image: o.image }],
                                total: Math.floor(o.price * discount),
                                equip,
                                equipName: localizeOutfitName(o.name, t),
                              });
                            }}>
                            <View style={[styles.itemCard, charOwned && owned && styles.itemOwned, charOwned && !owned && !canAfford && styles.itemDim]}>
                              {o.image ? (
                                <>
                                  <RNImage source={o.image} style={[styles.outfitItemImg, tImg]} resizeMode="contain" />
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
                                <ThemedText style={[styles.itemEmoji, tEmoji]}>{o.emoji}</ThemedText>
                              )}
                              {!charOwned ? (
                                <View style={[styles.priceBadge, styles.charLockedBadge]}>
                                  <ThemedText style={styles.charLockedText}>{t('shop.lockedBadge')}</ThemedText>
                                </View>
                              ) : owned ? (
                                <View style={[styles.priceBadge, styles.badgeOwned]}>
                                  <ThemedText style={styles.badgeText}>{o.price === 0 ? t('shop.defaultBadge') : t('shop.ownedBadge')}</ThemedText>
                                </View>
                              ) : (
                                <PriceTag price={o.price} discount={discount} size={22} textStyle={[styles.priceText, !canAfford && styles.priceTextDim]} />
                              )}
                              <ThemedText style={[styles.itemName, tName]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>{localizeOutfitName(o.name, t)}</ThemedText>
                            </View>
                          </Pressable>
                          {skin?.lore && (
                            <Pressable
                              style={({ pressed }) => [styles.outfitLoreBadge, pressed && { opacity: 0.7 }]}
                              hitSlop={8}
                              onPress={() => setLorePop({ name: localizeOutfitName(o.name, t), text: skin.lore! })}>
                              <ThemedText style={styles.outfitLoreBadgeText}>i</ThemedText>
                            </Pressable>
                          )}
                        </View>
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
                  // Companions: the chosen free starter counts as owned (even
                  // grandfathered Bun, which has no SKU in ownedShopItems).
                  const owned = item.category === 'companion'
                    ? isCompanionOwned(item.id, starterCompanionId, ownedShopItems)
                    : ownedShopItems.includes(item.id);
                  const recipeLocked = !!item.requiresAllRecipes && !owned && !allRecipesDone;
                  const discountedPrice = Math.floor(item.price * discount);
                  const canAfford = coins >= discountedPrice;
                  const equipable = isEquipableCategory(item.category);
                  const roomPair = (item.category === 'background' || item.category === 'desk') ? pairForItem(item.id) : undefined;
                  // Backgrounds/desks track the room-equip system; everything else uses equippedShopItems.
                  const isEquipped = !!owned && (
                    item.category === 'background' ? !!roomPair && equippedBackgroundRoomId === roomPair.id
                    : item.category === 'desk' ? !!roomPair && equippedDeskRoomId === roomPair.id
                    // Sounds are "active" when they're the selected ambience.
                    : item.category === 'sound' ? ambienceId === item.id.replace('sound_', '')
                    : equipable && equippedShopItems[item.category as keyof typeof equippedShopItems] === item.id
                  );

                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => pressed && styles.pressed}
                      onPress={() => {
                        if (owned) {
                          // Owned companions are set active from the Companion gallery,
                          // and recipes are chosen in the Bakery Menu — not by tapping here.
                          if (item.category === 'companion' || item.category === 'recipe') return;
                          if (item.category === 'background' || item.category === 'desk') {
                            if (!isEquipped) equipRoomHalf(item);
                          } else if (item.category === 'sound') {
                            // Toggle this sound as the active ambience.
                            setAmbience(isEquipped ? null : item.id.replace('sound_', ''));
                            if (!isEquipped) showPopup(t('shop.equippedTitle'), t('shop.nowActive', { name: localizeCompanionName(item.name, t) }));
                          } else if (equipable && !isEquipped) {
                            handleEquip(item.id, item.name);
                          }
                        } else if (item.plusOnly) {
                          showPopup(
                            t('shop.plusExclusive', { name: localizeCompanionName(item.name, t) }),
                            t('shop.plusExclusiveMsg', { name: localizeCompanionName(item.name, t) }),
                          );
                        } else {
                          openBuy(item);
                        }
                      }}>
                      <View style={[
                        styles.itemCard,
                        owned && styles.itemOwned,
                        isEquipped && styles.itemEquipped,
                        ((!owned && !canAfford) || recipeLocked) && styles.itemDim,
                      ]}>
                        <View style={[styles.itemImageWrap, tImgWrap]}>
                          {item.image ? (
                            <RNImage source={item.image} style={[styles.itemImage, tImg]} resizeMode="contain" />
                          ) : (
                            <ThemedText style={[styles.itemEmoji, tEmoji]}>{item.emoji}</ThemedText>
                          )}
                        </View>
                        {item.image && (
                          <>
                            {item.category === 'sound' ? (
                              // Sounds preview their 10s loop instead of zooming the (generic) icon.
                              <SoundPreviewButton id={item.id.replace('sound_', '')} style={styles.soundPreviewBtn} />
                            ) : (
                              <Pressable
                                style={styles.zoomBtn}
                                hitSlop={8}
                                onPress={(e) => {
                                  e.stopPropagation?.();
                                  setZoomImage(item.image ?? null);
                                }}>
                                <RNImage source={MAGNIFIER_ICON} style={styles.zoomIcon} resizeMode="contain" />
                              </Pressable>
                            )}
                            {partnerItemId(item.id) && (
                              <Pressable
                                style={styles.pairBtn}
                                hitSlop={8}
                                onPress={(e) => { e.stopPropagation?.(); openPairBuy(item); }}>
                                <View style={styles.pairGlyph}>
                                  <View style={styles.pairRing} />
                                  <View style={[styles.pairRing, styles.pairRing2]} />
                                </View>
                              </Pressable>
                            )}
                          </>
                        )}
                        {owned ? (
                          <View style={[styles.priceBadge, isEquipped ? styles.badgeEquipped : styles.badgeOwned]}>
                            <ThemedText style={styles.badgeText}>{isEquipped ? t('shop.equippedBadge') : t('shop.ownedBadge')}</ThemedText>
                          </View>
                        ) : recipeLocked ? (
                          <View style={[styles.priceBadge, styles.badgeRecipeLock]}>
                            <ThemedText style={styles.badgeRecipeLockText}> {recipesDoneCount}/{RECIPE_IDS.length}</ThemedText>
                          </View>
                        ) : item.plusOnly ? (
                          <View style={[styles.priceBadge, styles.badgePlus]}>
                            <ThemedText style={styles.badgePlusText}>{t('shop.plusBadge')}</ThemedText>
                          </View>
                        ) : (
                          <PriceTag
                            price={item.price}
                            discount={discount}
                            size={22}
                            textStyle={[styles.priceText, !canAfford && styles.priceTextDim]}
                          />
                        )}
                        <ThemedText style={[styles.itemName, tName]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>{localizeCompanionName(item.name, t)}</ThemedText>
                        {item.category === 'recipe' && item.owner && (
                          <ThemedText style={styles.useHint} numberOfLines={1}>{t('foodGallery.ownerTag', { name: localizeCompanionName(item.owner, t) })}</ThemedText>
                        )}
                        {USE_HINTS[item.category] && (
                          <ThemedText style={styles.useHint} numberOfLines={1}>{t('shop.setActiveInGallery')}</ThemedText>
                        )}
                        {/* Locked: frost the whole card. */}
                        {!owned && <LockOverlay size={36} radius={BakeryRadii.card} />}
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

          {/* ── Bakery Menu — Coins + Items on one paper, split by a rule ── */}
          <View style={[styles.menuCard, tMenuCard, isTablet && { marginTop: Spacing.three * SHOP_TS }]}>
            <View style={styles.menuHeader}>
              <ThemedText style={[styles.menuTitle, tMenuTitle]}>{t('shop.bakeryMenu')}</ThemedText>
            </View>

            <ThemedText style={[styles.sectionLabel, tSectionLabel]}>{t('shop.sectionCoins')}</ThemedText>
            <ThemedText style={[styles.sectionSubtitle, tSectionSub]}>{t('shop.coinsNeverExpire')}</ThemedText>
            {COIN_PACKS.map((pack, i) => (
              <Pressable key={pack.id} onPress={() => handleCoinPack(pack)} style={({ pressed }) => pressed && styles.pressed}>
                <View style={[styles.menuRow, tMenuRow]}>
                  <RNImage source={PACK_IMAGES[pack.id] ?? PACK_IMAGES.pouch} style={[styles.menuIcon, tMenuIcon]} resizeMode="contain" />
                  <View style={styles.menuBody}>
                    <View style={styles.menuTopLine}>
                      <ThemedText style={[styles.menuName, tMenuName]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{pack.name}</ThemedText>
                      <View style={styles.menuLeader} />
                      <ThemedText style={[styles.menuPrice, tMenuPrice]}>{packPrice(pack)}</ThemedText>
                    </View>
                    <View style={styles.menuSubLine}>
                      <CoinAmount amount={pack.coins} size={isTablet ? 28 * SHOP_TS : 20} textStyle={[styles.menuCoinText, tMenuCoin]} />
                      {pack.popular && (
                        <View style={styles.chefBadge}><ThemedText style={styles.chefText}>{t('shop.chefsPick')}</ThemedText></View>
                      )}
                    </View>
                  </View>
                </View>
                {i < COIN_PACKS.length - 1 && <View style={styles.menuDivider} />}
              </Pressable>
            ))}

            <View style={styles.sectionRule} />

            <ThemedText style={[styles.sectionLabel, tSectionLabel]}>{t('shop.sectionItems')}</ThemedText>
            <ThemedText style={[styles.sectionSubtitle, tSectionSub]}>{t('shop.freezeOwned', { count: streakFreezes })}</ThemedText>
            <Pressable onPress={handleBuyFreeze} style={({ pressed }) => pressed && styles.pressed}>
              <View style={[styles.menuRow, tMenuRow]}>
                <RNImage source={STREAK_FREEZE_ICON} style={[styles.menuIcon, tMenuIcon]} resizeMode="contain" />
                <View style={styles.menuBody}>
                  <View style={styles.menuTopLine}>
                    <ThemedText style={[styles.menuName, tMenuName]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('shop.streakFreezeName')}</ThemedText>
                    <View style={styles.menuLeader} />
                    <ThemedText style={[styles.menuPrice, tMenuPrice]}>{storePrices[PRODUCT_IDS.streakFreeze] ?? '$1.99'}</ThemedText>
                  </View>
                  <View style={styles.menuSubLine}>
                    <ThemedText style={[styles.menuCoinText, tMenuCoin]}>{t('shop.streakFreezeDesc')}</ThemedText>
                  </View>
                </View>
              </View>
            </Pressable>
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

      {/* Desk-setup preview — stages an outfit on the player's current room + desk
          for a character they don't own yet (view-only). */}
      <Modal visible={outfitPreview !== null} transparent animationType="fade" onRequestClose={() => setOutfitPreview(null)}>
        <Pressable style={styles.buyBackdrop} onPress={() => setOutfitPreview(null)}>
          <Pressable style={styles.previewCard} onPress={(e) => e.stopPropagation?.()}>
            {outfitPreview && (
              <>
                <ThemedText style={styles.buyTitle}>{localizeOutfitName(outfitPreview.name, t)}</ThemedText>
                <View style={styles.previewStage}>
                  <RNImage source={previewBgRoom.backgroundImage} style={styles.previewBg} resizeMode="cover" />
                  {outfitPreview.image && (
                    <View style={styles.previewCharLayer} pointerEvents="none">
                      <RNImage source={outfitPreview.image} style={styles.previewCharImg} resizeMode="contain" />
                    </View>
                  )}
                  <RNImage
                    source={previewDeskRoom.deskImage}
                    style={[styles.previewDesk, previewDeskRoom.deskTint ? { backgroundColor: previewDeskRoom.deskTint } : null]}
                    resizeMode={previewDeskRoom.deskFit ?? 'cover'}
                  />
                </View>
                <ThemedText style={styles.previewNote}>{t('shop.charLockedMsg', { name: localizeCompanionName(outfitPreview.charName, t) })}</ThemedText>
                <Pressable style={styles.previewClose} onPress={() => setOutfitPreview(null)}>
                  <ThemedText style={styles.previewCloseText}>{t('common.close')}</ThemedText>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* White confirm popup — shows the item picture + Buy / Cancel. */}
      <Modal visible={buyReq !== null} transparent animationType="fade" onRequestClose={() => setBuyReq(null)}>
        <Pressable style={styles.buyBackdrop} onPress={() => setBuyReq(null)}>
          <Pressable style={styles.buyCard} onPress={(e) => e.stopPropagation?.()}>
            {buyReq && (
              <>
                <ThemedText style={styles.buyTitle}>{buyReq.title}</ThemedText>

                {buyReq.items.length === 1 ? (
                  // Single item: show a big zoomed-in preview.
                  <View style={styles.buyHero}>
                    {buyReq.items[0].image ? (
                      <RNImage source={buyReq.items[0].image} style={styles.buyHeroImg} resizeMode="contain" />
                    ) : (
                      <ThemedText style={styles.buyHeroEmoji}>{buyReq.items[0].emoji}</ThemedText>
                    )}
                    <ThemedText style={styles.buyItemName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{localizeCompanionName(buyReq.items[0].name, t)}</ThemedText>
                    {!!buyReq.items[0].description && (
                      <ThemedText style={styles.buyHeroDesc} numberOfLines={3}>{buyReq.items[0].description}</ThemedText>
                    )}
                    <PriceTag price={buyReq.items[0].price} discount={discount} size={20} textStyle={styles.buyItemPrice} />
                  </View>
                ) : (
                  <View style={styles.buyItems}>
                    {buyReq.items.map((it) => (
                      <View key={it.id} style={styles.buyItemRow}>
                        {it.image ? (
                          <RNImage source={it.image} style={styles.buyItemImg} resizeMode="cover" />
                        ) : (
                          <ThemedText style={styles.buyItemEmoji}>{it.emoji}</ThemedText>
                        )}
                        <View style={styles.buyItemInfo}>
                          <ThemedText style={styles.buyItemName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{localizeCompanionName(it.name, t)}</ThemedText>
                          {!!it.description && (
                            <ThemedText style={styles.buyItemDesc} numberOfLines={2}>{it.description}</ThemedText>
                          )}
                        </View>
                        <PriceTag price={it.price} discount={discount} size={20} textStyle={styles.buyItemPrice} />
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.buyBalanceRow}>
                  <ThemedText style={styles.buyBalanceLabel}>{t('editRoom.yourBalance')}</ThemedText>
                  <View style={styles.buyBalance}>
                    <CoinIcon size={20} />
                    <ThemedText style={styles.buyBalanceNum}>{coins}</ThemedText>
                  </View>
                </View>

                {coins < buyReq.total && (
                  <ThemedText style={styles.buyShortfall}>{t('gallery.shortfall', { count: buyReq.total - coins })}</ThemedText>
                )}

                <SoundPressable
                  sound="confirm"
                  disabled={coins < buyReq.total}
                  style={({ pressed }) => [
                    styles.buyConfirmBtn,
                    coins < buyReq.total && styles.buyConfirmDisabled,
                    pressed && coins >= buyReq.total && { opacity: 0.85 },
                  ]}
                  onPress={confirmBuy}>
                  <ThemedText style={styles.buyConfirmText}>
                    {coins >= buyReq.total ? t('gallery.unlockForCoins', { price: buyReq.total }) : t('gallery.notEnoughCoins')}
                  </ThemedText>
                </SoundPressable>
                <Pressable style={styles.buyCancelBtn} onPress={() => setBuyReq(null)}>
                  <ThemedText style={styles.buyCancelText}>{t('gallery.maybeLater')}</ThemedText>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* After a successful buy: ask whether to equip the new item now. */}
      <Modal visible={equipPrompt !== null} transparent animationType="fade" onRequestClose={() => setEquipPrompt(null)}>
        <Pressable style={styles.buyBackdrop} onPress={() => setEquipPrompt(null)}>
          <Pressable style={styles.buyCard} onPress={(e) => e.stopPropagation?.()}>
            {equipPrompt && (
              <>
                <ThemedText style={styles.buyTitle}>{t('shop.equipNowQ', { name: equipPrompt.name })}</ThemedText>
                <SoundPressable
                  sound="confirm"
                  style={({ pressed }) => [styles.buyConfirmBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => { equipPrompt.equip(); setEquipPrompt(null); }}>
                  <ThemedText style={styles.buyConfirmText}>{t('shop.equipNow')}</ThemedText>
                </SoundPressable>
                <Pressable style={styles.buyCancelBtn} onPress={() => setEquipPrompt(null)}>
                  <ThemedText style={styles.buyCancelText}>{t('shop.notNow')}</ThemedText>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Outfit lore popup */}
      <Modal visible={lorePop !== null} transparent animationType="fade" onRequestClose={() => setLorePop(null)}>
        <Pressable style={styles.loreBackdrop} onPress={() => setLorePop(null)}>
          <Pressable style={styles.loreCard} onPress={() => {}}>
            <ThemedText style={styles.loreTitle}>{lorePop?.name}</ThemedText>
            <ThemedText style={styles.loreText}>{lorePop?.text}</ThemedText>
            <Pressable style={({ pressed }) => [styles.loreClose, pressed && { opacity: 0.75 }]} onPress={() => setLorePop(null)}>
              <ThemedText style={styles.loreCloseText}>{t('common.close')}</ThemedText>
            </Pressable>
          </Pressable>
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
    // Sit above the locked frosted veil so the magnifier stays crisp.
    zIndex: 5,
  },
  zoomBtnText: { fontSize: 13 },
  zoomIcon: { width: 30, height: 30 },
  // Sound preview play/pause button — nudged in from the card corner (right + down).
  soundPreviewBtn: { position: 'absolute', top: 8, left: 8, width: 32, height: 32, zIndex: 6 },
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
    zIndex: 5,
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

  // White buy-confirmation popup
  buyBackdrop: {
    flex: 1, backgroundColor: 'rgba(60,40,30,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  buyCard: {
    width: '100%', maxWidth: 360, backgroundColor: '#FFFDF8', borderRadius: 26,
    padding: Spacing.four, gap: Spacing.three, borderWidth: 1.5, borderColor: BakeryColors.shortbread,
    ...BakeryShadow,
  },
  buyTitle: { fontSize: 19, fontWeight: '800', color: BakeryColors.cocoaDark, textAlign: 'center' },
  buyItems: { gap: Spacing.two },
  buyItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    backgroundColor: BakeryColors.frosting, borderRadius: 16, padding: Spacing.two,
    borderWidth: 1.5, borderColor: BakeryColors.shortbread,
  },
  buyItemImg: { width: 52, height: 52, borderRadius: 10, backgroundColor: BakeryColors.cream },
  buyItemEmoji: { fontSize: 40, width: 52, textAlign: 'center' },
  buyHero: { alignItems: 'center', gap: 6, paddingVertical: Spacing.one },
  buyHeroImg: { width: 150, height: 150 },
  buyHeroEmoji: { fontSize: 96 },
  buyHeroDesc: { fontSize: 13, color: BakeryColors.mocha, textAlign: 'center', lineHeight: 18, paddingHorizontal: Spacing.two },
  buyItemInfo: { flex: 1, gap: 2 },
  buyItemName: { fontSize: 14.5, fontWeight: '800', color: BakeryColors.cocoaDark },
  buyItemDesc: { fontSize: 11.5, color: BakeryColors.mocha, lineHeight: 15 },
  buyItemPrice: { fontSize: 15, fontWeight: '800', color: BakeryColors.cocoaDark },
  buyBalanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  buyBalanceLabel: { fontSize: 13, fontWeight: '600', color: BakeryColors.mocha },
  buyBalance: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  buyBalanceNum: { fontSize: 15, fontWeight: '800', color: BakeryColors.cocoaDark },
  buyShortfall: { fontSize: 12.5, color: BakeryColors.berry, fontWeight: '700', textAlign: 'center' },
  buyConfirmBtn: {
    backgroundColor: BakeryColors.honey, borderRadius: 18, paddingVertical: Spacing.three, alignItems: 'center',
  },
  buyConfirmDisabled: { backgroundColor: BakeryColors.shortbread },
  buyConfirmText: { color: BakeryColors.cocoaDark, fontSize: 16, fontWeight: '800' },
  buyCancelBtn: { alignItems: 'center', paddingVertical: 4 },
  buyCancelText: { fontSize: 13.5, color: BakeryColors.mocha, fontWeight: '700' },

  // Outfit desk-setup preview popup
  previewCard: {
    width: '100%', maxWidth: 360, backgroundColor: '#FFFDF8', borderRadius: 26,
    padding: Spacing.four, gap: Spacing.three, borderWidth: 1.5, borderColor: BakeryColors.shortbread,
    ...BakeryShadow,
  },
  // Staged room: background fills, character sits at the desk, desk paints in
  // front of the character's lower body — mirrors the home screen's layering.
  previewStage: {
    alignSelf: 'center', width: PREVIEW_STAGE_W, height: PREVIEW_STAGE_H,
    borderRadius: 18, overflow: 'hidden', backgroundColor: BakeryColors.cream, position: 'relative',
  },
  previewBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
  previewCharLayer: {
    position: 'absolute', left: 0, right: 0, bottom: PREVIEW_CHAR_BOTTOM,
    alignItems: 'center', justifyContent: 'flex-end', backgroundColor: 'transparent', zIndex: 1,
  },
  previewCharImg: { width: PREVIEW_CHAR, height: PREVIEW_CHAR, backgroundColor: 'transparent' },
  previewDesk: { position: 'absolute', left: 0, right: 0, bottom: 0, height: PREVIEW_DESK_H, zIndex: 2 },
  previewNote: { fontSize: 13, color: BakeryColors.mocha, textAlign: 'center', lineHeight: 18 },
  previewClose: {
    backgroundColor: BakeryColors.honey, borderRadius: 18, paddingVertical: Spacing.three, alignItems: 'center',
  },
  previewCloseText: { color: BakeryColors.cocoaDark, fontSize: 16, fontWeight: '800' },

  viewOnlyNote: {
    backgroundColor: `${BakeryColors.honey}18`, borderRadius: 14, paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  viewOnlyNoteText: { fontSize: 13, color: BakeryColors.mocha, fontWeight: '600', textAlign: 'center' },

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
  itemImageWrap: { width: '100%', height: 84, alignItems: 'center', justifyContent: 'center' },
  outfitArtWrap: { width: '78%', height: '64%', alignItems: 'center', justifyContent: 'center' },
  outfitArtImg: { width: '100%', height: '100%' },
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
  mysteryImg: {
    width: '78%',
    height: '64%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mysteryMark: { fontSize: 48, lineHeight: 56, fontWeight: '800', color: '#B7A4E3', textAlign: 'center' },
  outfitItemImg: { width: 62, height: 62 },
  outfitBack: { paddingVertical: 4 },
  outfitBackText: { fontSize: 14, fontWeight: '800', color: '#C4607A' },
  outfitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
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
  badgeRecipeLock: { backgroundColor: '#8A7A6022' },
  badgeRecipeLockText: { fontSize: 12, fontWeight: '700', color: '#8A7A60', lineHeight: 16 },
  badgeText: { fontSize: 12, fontWeight: '700', color: BakeryColors.mocha, lineHeight: 16 },
  priceText: { fontSize: 14, fontWeight: '700', color: BakeryColors.cocoaDark, lineHeight: 18 },
  priceTextDim: { color: BakeryColors.latte },
  // Plus discount: original price struck through, shown before the discounted one.
  priceTagRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priceOrig: { fontSize: 12, fontWeight: '600', color: BakeryColors.latte, textDecorationLine: 'line-through' },

  // Coin packs horizontal scroll
  // ─── Bakery menu of coin packs ───────────────────────────────────────────
  menuCard: {
    borderRadius: BakeryRadii.card,
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
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

  outfitSlot: { width: CARD, position: 'relative' },
  outfitLoreBadge: {
    position: 'absolute', top: 8, right: 8, zIndex: 10,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(91,58,46,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  outfitLoreBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', lineHeight: 14 },

  loreBackdrop: {
    flex: 1, backgroundColor: 'rgba(48,32,24,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  loreCard: {
    backgroundColor: '#FFFDF8', borderRadius: 24,
    padding: 24, gap: 12, alignItems: 'center',
    maxWidth: 320, width: '100%',
    shadowColor: '#5B3A2E', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  loreTitle: { fontSize: 17, fontWeight: '900', textAlign: 'center' },
  loreText: { fontSize: 14, lineHeight: 21, textAlign: 'center', fontStyle: 'italic' },
  loreClose: { marginTop: 4, backgroundColor: '#F0739A', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 28 },
  loreCloseText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
