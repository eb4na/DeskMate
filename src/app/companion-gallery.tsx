import { Image } from 'expo-image';
import { formatCoins } from '@/constants/placeholder-data';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { noteModalTransition, useReportModalTransition } from '@/lib/modal-traffic';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { CoinIcon } from '@/components/coin-icon';
import { DevKnobs, type Knob } from '@/components/dev-knobs';
import { LockOverlay } from '@/components/lock-badge';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { ThemedView } from '@/components/themed-view';
import { CompanionLevel } from '@/components/companion-level';
import { Fonts, MaxContentWidth, MIN_POPUP_WIDTH, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { BUN_SKINS, type BunSkin, getBunSkinImage, getCompanionSkinImage, getCompanionSkins, getStarterActiveId, isCompanionOwned, localizeCompanionName, localizeOutfitName, pickSkinLore, skinLores, SHOP_COMPANIONS } from '@/lib/companion-utils';
import { SHOP_ITEMS } from '@/constants/shop-data';
import { roomById, isPairOwned, type RoomPair } from '@/constants/room-data';


const getShopItem = (id: string) => SHOP_ITEMS.find((s) => s.id === id);

// Patisserie palette — soft strawberry-dessert theme.
const P = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F7A7B8',
  pinkSoft: '#FBD9E0',
  peach: '#F4C5A8',
  brown: '#5B3A2E',
  mutedBrown: '#9A7B6D',
  green: '#8BCF8B',
  greenSoft: '#E3F4E3',
  pinkActive: '#F2A0B5',
  pinkActiveSoft: '#FBDCE4',
  pinkActiveText: '#C75A78',
  button: '#8A7A60',
} as const;

function HangerIcon({ color = '#B06A50', size = 18 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* hook */}
      <Path
        d="M12 8c0-1.4 1-2.3 2.1-1.9.9.3 1 1.4.1 2"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
      {/* triangle bar */}
      <Path
        d="M12 8 L3.5 13.5 H20.5 L12 8 Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

// Interlocking chain-link — marks an outfit that has a matched room (background
// + desk). Tapping it sets that room so the look comes together.
function ChainLinkIcon({ color = '#FFFFFF', size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Per-companion taglines shown under each name in the gallery (i18n keys).
const TAGLINE_KEYS: Record<string, string> = {
  Bun: 'gallery.tagline_Bun',
  Cocoa: 'gallery.tagline_Cocoa',
  Bunny: 'gallery.tagline_Bunny',
  Miel: 'gallery.tagline_Miel',
  Tira: 'gallery.tagline_Tira',
  Hanji: 'gallery.tagline_Hanji',
};

type ObtainedCharacter = {
  id: string;
  name: string;
  image: number | { uri: string } | null;
  emoji: string | null;
  isActive: boolean;
  isGenerated: boolean;
  deletable: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  // The skin the card is currently showing — used for the matched-room (pairing)
  // chain button. null for generated slots (no wardrobe).
  currentSkin?: BunSkin | null;
};

function GalleryContent() {
  const { t } = useTranslation();
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const { height: winH } = useWindowDimensions();
  const {
    activeCompanionId,
    starterCompanionId,
    companionSlots,
    deleteCompanionSlot,
    setDefaultCompanion,
    setActiveCompanion,
    ownedShopItems,
    bunSkinId,
    setBunSkin,
    companionSkins,
    setCompanionSkin,
    coins,
    isPlus,
    purchaseShopItem,
    setEquippedBackground,
    setEquippedDesk,
    companionMinutes,
  } = useApp();

  // Dev "design knobs" — live overrides for the companion grid's spacing/sizes.
  // Defaults below match the StyleSheet; dial them in on-device, hit "Log
  // values", then bake the numbers into the styles. No effect in production.
  const [tweak, setTweak] = useState({
    cardWidth: 47,    // companionCard width %
    gridGap: 16,      // companionGrid gap
    cardPad: 16,      // companionCard padding
    cardRadius: 22,   // companionCard borderRadius
    imgSize: 80,      // companionImageWrap width %
    nameSize: 15,     // companionName fontSize
    subSize: 11,      // companionSubtitle fontSize
  });
  const knobs: Knob[] = [
    { key: 'cardWidth', label: 'Card width %', value: tweak.cardWidth, min: 30, max: 100, step: 1 },
    { key: 'gridGap', label: 'Grid gap', value: tweak.gridGap, min: 0, max: 40, step: 1 },
    { key: 'cardPad', label: 'Card padding', value: tweak.cardPad, min: 0, max: 32, step: 1 },
    { key: 'cardRadius', label: 'Card radius', value: tweak.cardRadius, min: 0, max: 40, step: 1 },
    { key: 'imgSize', label: 'Image size %', value: tweak.imgSize, min: 40, max: 100, step: 1 },
    { key: 'nameSize', label: 'Name font', value: tweak.nameSize, min: 10, max: 24, step: 0.5 },
    { key: 'subSize', label: 'Tagline font', value: tweak.subSize, min: 8, max: 18, step: 0.5 },
  ];

  const [wardrobeFor, setWardrobeFor] = useState<{ id: string; name: string } | null>(null);
  // In-place unlock popup for a coin-priced item (a locked companion or skin).
  const [buyItem, setBuyItem] = useState<{ id: string; name: string; image: number | null; price: number } | null>(null);
  // Plus-exclusive outfit popup (custom — replaces the native alert).
  const [plusAlertName, setPlusAlertName] = useState<string | null>(null);
  // Generic IN-FILE alert/confirm. Replaces root showPopup, which cannot present over
  // this `presentation:'modal'` screen — doing so freezes iOS (confirmed via trace).
  // In-file modals (presented by this screen's own VC) show fine, like plusAlert.
  const [galleryAlert, setGalleryAlert] = useState<{ title: string; msg: string; confirmText?: string; onConfirm?: () => void } | null>(null);
  // Matched-room buy popup: purchase an outfit's paired room (background + desk,
  // plus the outfit itself if it's still locked) right here, instead of jumping
  // to the Shop. All chain-link-reachable rooms are plain coin items.
  const [pairBuy, setPairBuy] = useState<{ pair: RoomPair; skin: BunSkin } | null>(null);
  // Confirm-before-equip for an already-owned matched room: preview the room
  // (background + desk if it has one) and let the player confirm.
  const [pairConfirm, setPairConfirm] = useState<{ pair: RoomPair; skin: BunSkin } | null>(null);
  // Outfit lore popup.
  const [lorePopup, setLorePopup] = useState<{ name: string; text: string } | null>(null);
  // Report this screen's native <Modal>s (buy / pair-buy / pair-confirm / lore / Plus
  // alert) to the global anti-freeze signal so popups never present mid-transition.
  useReportModalTransition(
    wardrobeFor !== null || buyItem !== null || plusAlertName !== null || pairBuy !== null || pairConfirm !== null || lorePopup !== null || galleryAlert !== null,
  );
  const buyDiscount = isPlus ? 0.75 : 1;
  const buyPrice = buyItem ? Math.floor(buyItem.price * buyDiscount) : 0;
  const canAffordBuy = coins >= buyPrice;
  // Show an in-file alert AFTER the current buy/preview <Modal> has dismissed — two
  // in-file modals can't co-present either, so wait out the ~300ms fade first.
  const alertAfterDismiss = (title: string, msg: string) =>
    setTimeout(() => setGalleryAlert({ title, msg }), 350);
  const confirmBuy = () => {
    if (!buyItem) return;
    if (!canAffordBuy) {
      setBuyItem(null);
      alertAfterDismiss(t('gallery.notEnoughCoins'), t('gallery.notEnoughCoinsMsg', { price: buyPrice, coins }));
      return;
    }
    purchaseShopItem(buyItem.id, buyPrice);
    setBuyItem(null);
  };

  // Items still needed to complete the matched look: the room's background +
  // desk, plus the outfit itself if it's locked. Owned halves drop out.
  const pairNeedItems = pairBuy
    ? [pairBuy.pair.backgroundId, pairBuy.pair.deskId, pairBuy.skin.shopItemId]
        .filter((id): id is string => !!id && !ownedShopItems.includes(id))
        .map((id) => getShopItem(id))
        .filter((it): it is NonNullable<ReturnType<typeof getShopItem>> => !!it)
    : [];
  const pairTotal = pairNeedItems.reduce((sum, it) => sum + Math.floor(it.price * buyDiscount), 0);
  const canAffordPair = coins >= pairTotal;

  const confirmPairBuy = () => {
    if (!pairBuy) return;
    if (!canAffordPair) {
      setPairBuy(null);
      alertAfterDismiss(t('gallery.notEnoughCoins'), t('gallery.notEnoughCoinsMsg', { price: pairTotal, coins }));
      return;
    }
    for (const it of pairNeedItems) purchaseShopItem(it.id, Math.floor(it.price * buyDiscount));
    const { pair, skin } = pairBuy;
    setEquippedBackground(pair.id);
    // Deskless scene rooms keep the player's current desk (see equipMatchedRoom).
    if (pair.deskId) setEquippedDesk(pair.id);
    equipWardrobeSkin(skin.id);
    // Drop back home so the new room + outfit are visible (matches character-equip).
    // The buy modal sits on TOP of the still-open wardrobe sheet (itself atop the gallery
    // native modal); finishMatchedRoomEquip tears all three down deterministically so the
    // gallery never dismisses while the wardrobe is still transitioning (iOS freeze).
    finishMatchedRoomEquip(() => setPairBuy(null));
  };
  const wardrobeIsBun = wardrobeFor?.id === getStarterActiveId('girl');
  // Skins for the open wardrobe (Bun uses its own list; shop companions use COMPANION_SKINS).
  const wardrobeSkins = wardrobeFor ? (wardrobeIsBun ? BUN_SKINS : getCompanionSkins(wardrobeFor.id)) : [];
  const wardrobeEquipped = wardrobeIsBun
    ? (bunSkinId ?? 'classic')
    : (wardrobeFor ? (companionSkins[wardrobeFor.id] ?? 'classic') : 'classic');
  const equipWardrobeSkin = (skinId: string) => {
    if (wardrobeIsBun) setBunSkin(skinId);
    else if (wardrobeFor) setCompanionSkin(wardrobeFor.id, skinId);
  };

  // Leave for the Shop with the buy popup pre-opened (a locked outfit, or a chain-link
  // look that still needs buying). The wardrobe is a native <Modal>; navigating while
  // it's still on screen risks the iOS stacked-modal freeze, so on iOS we close it
  // first and navigate on its REAL onDismiss (see handleWardrobeDismissed).
  const shopRoute = useRef<Record<string, string> | null>(null);
  const leaveToShop = (params: Record<string, string>) => {
    const go = () => {
      // Stamp the route dismiss so the Shop's buy popup waits it out before it
      // presents (else it collides with this modal screen sliding away → freeze).
      noteModalTransition();
      router.replace({ pathname: '/shop', params });
    };
    if (Platform.OS !== 'ios') {
      if (wardrobeFor) { setWardrobeFor(null); setTimeout(go, 350); } else go();
      return;
    }
    if (wardrobeFor) { shopRoute.current = params; setWardrobeFor(null); }
    else go();
  };

  // The chain icon: set the outfit's matched room (background + desk) and wear the
  // outfit so the whole look comes together. If the room isn't owned, open an
  // in-place buy popup (an in-file <Modal>, which presents fine over this native-
  // modal screen) so the player can purchase the whole look without leaving for
  // the Shop.
  const equipMatchedRoom = (skin: BunSkin) => {
    const pair = roomById(skin.roomId);
    if (!pair) return;
    // The whole look is owned only when the room AND the outfit are owned.
    const lookOwned = isPairOwned(pair, ownedShopItems) && (!skin.shopItemId || ownedShopItems.includes(skin.shopItemId));
    if (!lookOwned) {
      // Send them to the Shop with the matched look's buy popup open (room + outfit).
      const params: Record<string, string> = { buyPair: (pair.backgroundId ?? pair.deskId) as string };
      if (skin.shopItemId) params.buyOutfit = skin.shopItemId;
      leaveToShop(params);
      return;
    }
    // Fully owned — preview the room (and its desk, if any) and confirm before applying.
    setPairConfirm({ pair, skin });
  };

  // Apply the previewed matched room after the player confirms.
  const confirmPairEquip = () => {
    if (!pairConfirm) return;
    const { pair, skin } = pairConfirm;
    setEquippedBackground(pair.id);
    // Some matched rooms (e.g. Bluebell Lagoon) are a full scene with no desk
    // surface. Don't switch the player onto a deskless room — keep whatever desk
    // they're currently using; only swap the desk when the room actually has one.
    if (pair.deskId) setEquippedDesk(pair.id);
    // Wear the outfit too — but only if it's unlocked (a locked skin can't be worn).
    const skinLocked = !!skin.shopItemId && !ownedShopItems.includes(skin.shopItemId);
    // Must run before the closes below — equipWardrobeSkin reads the current-render
    // `wardrobeFor`, and the deferred setWardrobeFor(null) would otherwise starve it.
    if (!skinLocked) equipWardrobeSkin(skin.id);
    // Deterministic teardown of confirm → wardrobe → navigate (see finishMatchedRoomEquip).
    finishMatchedRoomEquip(() => setPairConfirm(null));
  };

  // Equipping a character drops you straight back to the home screen.
  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Matched-room equip tears down THREE stacked native modals in a row: the confirm/buy
  // popup (top) → the wardrobe sheet → the gallery screen itself (goHome dismisses it).
  // Dismissing two at once — or on fixed setTimeouts that under load outlast the slide
  // animation — collides two native-modal transitions and freezes iOS (every tap, incl.
  // the pink Done, goes dead). On iOS we chain off each modal's REAL onDismiss so the next
  // close only begins once the previous modal is fully gone. Android has neither onDismiss
  // nor the double-present freeze, so the old fixed stagger is kept there.
  // Tracks the next teardown step, keyed off each modal's REAL onDismiss (a ref, so the
  // native async callbacks never read a stale render's state). null = no teardown in
  // flight (normal cancels/closes must not navigate). equipMatchedRoom can fire with the
  // wardrobe open (chain link) OR closed (card button), so we decide the path up front.
  const teardownStage = useRef<null | 'closeWardrobe' | 'goHome'>(null);
  const finishMatchedRoomEquip = (closeTopModal: () => void) => {
    if (Platform.OS === 'ios') {
      // If the wardrobe is open it must dismiss before we navigate; otherwise go straight
      // home once the pair popup is gone. Either way the gallery only dismisses (goHome)
      // after the modal above it has fully transitioned — no double-present freeze.
      teardownStage.current = wardrobeFor ? 'closeWardrobe' : 'goHome';
      closeTopModal();
    } else {
      // Android has neither onDismiss nor the double-present freeze — old stagger is fine.
      closeTopModal();
      setTimeout(() => setWardrobeFor(null), 350);
      setTimeout(goHome, 700);
    }
  };
  // onDismiss of the pair buy/confirm popup: close the wardrobe next (its onDismiss then
  // navigates), or navigate now if the wardrobe was never open.
  const handlePairModalDismissed = () => {
    if (teardownStage.current === 'closeWardrobe') {
      teardownStage.current = 'goHome';
      setWardrobeFor(null);
    } else if (teardownStage.current === 'goHome') {
      teardownStage.current = null;
      goHome();
    }
  };
  // onDismiss of the wardrobe sheet: once it's fully gone, leave for home (only when a
  // teardown is in flight — a plain wardrobe close must stay put).
  const handleWardrobeDismissed = () => {
    // A pending shop route (locked outfit / chain-link buy) leaves for the Shop once
    // the wardrobe is fully gone — no navigation while the modal is still transitioning.
    if (shopRoute.current) {
      const params = shopRoute.current;
      shopRoute.current = null;
      // Stamp the route dismiss so the Shop's buy popup waits it out before it
      // presents (else it collides with this modal screen sliding away → freeze).
      noteModalTransition();
      router.replace({ pathname: '/shop', params });
      return;
    }
    if (teardownStage.current === 'goHome') {
      teardownStage.current = null;
      goHome();
    }
  };

  const handleUseSlot = (slotId: string, hasRenderableImage: boolean) => {
    if (!hasRenderableImage) {
      setGalleryAlert({ title: t('gallery.noArtTitle'), msg: t('gallery.noArtMsg') });
      return;
    }
    setActiveCompanion(slotId);
    goHome();
  };

  const confirmDelete = (slotId: string, name: string) => {
    setGalleryAlert({
      title: t('gallery.removeCompanionQ'),
      msg: t('gallery.removeCompanionMsg', { name }),
      confirmText: t('gallery.remove'),
      onConfirm: () => deleteCompanionSlot(slotId),
    });
  };

  // Owned characters — the free starter + any companions bought (one of the five
  // is the free starter; the rest are unlocked by purchase). Grid grows with each.
  const ownsBun = isCompanionOwned('companion_bun', starterCompanionId, ownedShopItems);
  const obtainedCharacters: ObtainedCharacter[] = [
    // Bun appears only when owned (the chosen starter, or bought from the shop).
    ...(ownsBun
      ? [{
          id: getStarterActiveId('girl'),
          name: 'Bun',
          image: getBunSkinImage(bunSkinId),
          emoji: null,
          isActive: activeCompanionId === getStarterActiveId('girl'),
          isGenerated: false,
          deletable: false,
          onSelect: () => { setDefaultCompanion('girl'); goHome(); },
          currentSkin: BUN_SKINS.find((s) => s.id === (bunSkinId ?? 'classic')) ?? null,
        }]
      : []),
    // Shop companions you own — bought, or granted free as your starter pick.
    ...SHOP_COMPANIONS.filter((item) => isCompanionOwned(item.id, starterCompanionId, ownedShopItems)).map((item) => ({
      id: `shop:${item.id}`,
      name: item.name,
      image: getCompanionSkinImage(`shop:${item.id}`, companionSkins[`shop:${item.id}`]) ?? (item.image as number),
      emoji: item.emoji,
      isActive: activeCompanionId === `shop:${item.id}`,
      isGenerated: false,
      deletable: false,
      onSelect: () => { setActiveCompanion(`shop:${item.id}`); goHome(); },
      currentSkin: getCompanionSkins(`shop:${item.id}`).find((s) => s.id === (companionSkins[`shop:${item.id}`] ?? 'classic')) ?? null,
    })),
    ...companionSlots.map((slot) => ({
      id: slot.id,
      name: slot.name,
      image: slot.imageUri ? { uri: slot.imageUri } : null,
      emoji: slot.emoji,
      isActive: activeCompanionId === slot.id,
      isGenerated: slot.isGenerated,
      deletable: true,
      onSelect: () => handleUseSlot(slot.id, !!slot.imageUri),
      onDelete: () => confirmDelete(slot.id, slot.name),
    })),
  ];

  return (
    <>
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: P.cream }}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header — a big bubbly title + subtitle (no banner frame). */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t('gallery.companionBakery')}</Text>
          <Text style={styles.headerSubtitle}>{t('gallery.chooseToday')}</Text>
        </View>

        {/* My Companions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('gallery.myCompanions')}</Text>
          <View style={[styles.companionGrid, { gap: tweak.gridGap }]}>
            {obtainedCharacters.map((char) => (
              <View
                key={char.id}
                style={[
                  styles.companionCard,
                  { width: `${tweak.cardWidth}%`, padding: tweak.cardPad, borderRadius: tweak.cardRadius },
                  char.isActive && styles.companionCardActive,
                ]}>
                {char.deletable && (
                  <Pressable
                    style={styles.cardDelete}
                    onPress={char.onDelete}
                    hitSlop={8}>
                    <Text style={styles.cardDeleteText}>✕</Text>
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [styles.hangerBtn, pressed && styles.pressed]}
                  onPress={() => setWardrobeFor({ id: char.id, name: localizeCompanionName(char.name, t) })}
                  hitSlop={8}>
                  <HangerIcon color="#FFFFFF" size={22 * scale} />
                </Pressable>
                {/* Pairing button — set the matched room when the worn outfit has one. */}
                {char.currentSkin && roomById(char.currentSkin.roomId) && (
                  <Pressable
                    style={({ pressed }) => [styles.linkBadge, pressed && styles.pressed]}
                    onPress={() => equipMatchedRoom(char.currentSkin!)}
                    hitSlop={8}>
                    <ChainLinkIcon color="#FFFFFF" size={15 * scale} />
                  </Pressable>
                )}
                <View style={[styles.companionImageWrap, { width: `${tweak.imgSize}%` }]}>
                  {char.image ? (
                    <Image source={char.image} style={styles.companionImage} contentFit="contain" />
                  ) : (
                    <View style={styles.companionImagePlaceholder} />
                  )}
                </View>
                <Text style={[styles.companionName, { fontSize: tweak.nameSize * scale }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {localizeCompanionName(char.name, t)}
                </Text>
                <Text style={[styles.companionSubtitle, { fontSize: tweak.subSize * scale }]} numberOfLines={2}>{TAGLINE_KEYS[char.name] ? t(TAGLINE_KEYS[char.name]) : t('gallery.defaultTagline')}</Text>
                <CompanionLevel minutes={companionMinutes?.[char.id] ?? 0} scale={scale} />
                {char.isActive ? (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>{t('gallery.active')}</Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.setActiveBtn, pressed && styles.pressed]}
                    onPress={char.onSelect}>
                    <Text style={styles.setActiveBtnText}>{t('gallery.setActive')}</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Done */}
        <Pressable
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Text style={styles.doneButtonText}>{t('common.done')}</Text>
        </Pressable>
      </SafeAreaView>


      {/* Wardrobe — per-companion outfit picker */}
      <Modal
        visible={!!wardrobeFor}
        animationType="slide"
        transparent
        onDismiss={handleWardrobeDismissed}
        onRequestClose={() => { if (lorePopup) { setLorePopup(null); } else { setWardrobeFor(null); } }}>
        <View style={styles.wardrobeBackdrop}>
          <View style={styles.wardrobeSheet}>
            <Text style={styles.wardrobeTitle}>{t('gallery.wardrobeTitle', { name: wardrobeFor?.name ?? '' })}</Text>
            {wardrobeSkins.length > 0 ? (
              <>
                <Text style={styles.wardrobeSubtitle}>{t('gallery.pickOutfit', { name: wardrobeFor?.name ?? '' })}</Text>
                <View style={styles.skinGrid}>
                  {wardrobeSkins.map((skin) => {
                    const equipped = wardrobeEquipped === skin.id;
                    const locked = !!skin.shopItemId && !ownedShopItems.includes(skin.shopItemId);
                    const hasMatchedRoom = !!roomById(skin.roomId);
                    return (
                      <View key={skin.id} style={styles.skinSlot}>
                        <Pressable
                          style={[styles.skinCard, equipped && styles.skinCardActive, locked && styles.skinCardLocked]}
                          onPress={() => {
                            if (locked) {
                              const item = skin.shopItemId ? getShopItem(skin.shopItemId) : null;
                              if (item?.plusOnly) {
                                setPlusAlertName(localizeOutfitName(skin.name, t));
                              } else if (item && wardrobeFor) {
                                // Send them to the Shop with this outfit's buy popup open.
                                leaveToShop({ outfitItem: item.id, outfitChar: wardrobeFor.id });
                              }
                            } else {
                              equipWardrobeSkin(skin.id);
                            }
                          }}>
                          {hasMatchedRoom && (
                            <Pressable
                              style={({ pressed }) => [styles.linkBadge, pressed && styles.pressed]}
                              onPress={() => equipMatchedRoom(skin)}
                              hitSlop={8}>
                              <ChainLinkIcon color="#FFFFFF" size={15 * scale} />
                            </Pressable>
                          )}
                          <View style={styles.skinImageWrap}>
                            <Image
                              source={skin.image}
                              style={styles.skinImage}
                              contentFit="contain"
                            />
                            {locked && <LockOverlay size={34 * scale} radius={18 * scale} />}
                          </View>
                          <Text style={styles.skinName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
                            {localizeOutfitName(skin.name, t)}
                          </Text>
                          {locked ? (
                            <Text style={styles.skinTap}>
                              {skin.shopItemId && getShopItem(skin.shopItemId)?.plusOnly
                                ? t('gallery.plusOnlyHint')
                                : t('gallery.buyInShop')}
                            </Text>
                          ) : equipped ? (
                            <View style={styles.skinPill}>
                              <Text style={styles.skinPillText}>{t('gallery.wearing')}</Text>
                            </View>
                          ) : (
                            <Text style={styles.skinTap}>{t('gallery.tapToWear')}</Text>
                          )}
                        </Pressable>
                        {skinLores(skin).length > 0 && (
                          <Pressable
                            style={({ pressed }) => [styles.loreBadge, pressed && styles.pressed]}
                            onPress={() => setLorePopup({ name: localizeOutfitName(skin.name, t), text: pickSkinLore(skin, t) })}
                            hitSlop={8}>
                            <Text style={styles.loreBadgeText}>i</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.wardrobeEmpty}>
                <Text style={styles.wardrobeEmptyTitle}>{t('gallery.noOutfitsYet')}</Text>
                <Text style={styles.wardrobeEmptyText}>
                  {t('gallery.wardrobeEmpty', { name: wardrobeFor?.name ?? '' })}
                </Text>
              </View>
            )}
            <Pressable
              style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
              onPress={() => setWardrobeFor(null)}>
              <Text style={styles.doneButtonText}>{t('common.done')}</Text>
            </Pressable>
          </View>
          {/* Lore popup — on the FULL-SCREEN backdrop (not the bottom sheet) so it
              centers on the whole screen. */}
          {lorePopup && (
            <View style={styles.loreBackdrop}>
              {/* Tap-outside-to-close lives on a layer BEHIND the card so it never
                  wraps (and swallows the scroll gesture of) the ScrollView. */}
              <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setLorePopup(null)} />
              <View style={styles.loreCard}>
                <Text style={styles.loreTitle}>{lorePopup.name}</Text>
                <ScrollView style={[styles.loreScroll, { maxHeight: winH * 0.6 }]} contentContainerStyle={styles.loreScrollContent} showsVerticalScrollIndicator nestedScrollEnabled>
                  <Text style={styles.loreText}>{lorePopup.text}</Text>
                </ScrollView>
                <Pressable style={({ pressed }) => [styles.loreClose, pressed && styles.pressed]} onPress={() => setLorePopup(null)}>
                  <Text style={styles.loreCloseText}>{t('common.close')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* Unlock popup — buy the exact locked companion / skin in place. */}
      <Modal
        visible={buyItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setBuyItem(null)}>
        <Pressable style={styles.buyBackdrop} onPress={() => setBuyItem(null)}>
          <Pressable style={styles.buyCard} onPress={(e) => e.stopPropagation?.()}>
            {buyItem && (
              <>
                <Text style={styles.buyTitle}>{t('gallery.unlockTitle', { name: buyItem.name })}</Text>
                {buyItem.image && (
                  <Image source={buyItem.image} style={styles.buyImage} contentFit="contain" />
                )}
                <View style={styles.buyBalanceRow}>
                  <Text style={styles.buyBalanceLabel}>{t('gallery.yourBalance')}</Text>
                  <View style={styles.buyBalanceValue}>
                    <CoinIcon size={15 * scale} />
                    <Text style={styles.buyBalanceNum}>{formatCoins(coins)}</Text>
                  </View>
                </View>
                {!canAffordBuy && (
                  <Text style={styles.buyShortfall}>
                    {t('gallery.shortfall', { count: buyPrice - coins })}
                  </Text>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.buyBtn,
                    !canAffordBuy && styles.buyBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={confirmBuy}>
                  <Text style={styles.buyBtnText}>
                    {canAffordBuy ? t('gallery.unlockForCoins', { price: buyPrice }) : t('gallery.notEnoughCoins')}
                  </Text>
                </Pressable>
                <Pressable style={styles.buyCancel} onPress={() => setBuyItem(null)}>
                  <Text style={styles.buyCancelText}>{t('gallery.maybeLater')}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Matched-room buy popup — purchase the outfit's paired room (background +
          desk, plus the outfit itself if locked) directly from the wardrobe. */}
      <Modal
        visible={pairBuy !== null}
        transparent
        animationType="fade"
        onDismiss={handlePairModalDismissed}
        onRequestClose={() => setPairBuy(null)}>
        <Pressable style={styles.buyBackdrop} onPress={() => setPairBuy(null)}>
          <Pressable style={styles.buyCard} onPress={(e) => e.stopPropagation?.()}>
            {pairBuy && (
              <>
                <Text style={styles.buyTitle}>{t('editRoom.unlockPair', { name: pairBuy.pair.name })}</Text>
                {/* Preview the whole room — background WITH the paired desk overlaid as a
                    bottom band (mirrors the real study room), since the pair is both. */}
                <View style={styles.pairImage}>
                  <Image source={pairBuy.pair.backgroundImage} style={styles.pairBg} contentFit="cover" />
                  {pairBuy.pair.deskImage != null && (
                    <Image source={pairBuy.pair.deskImage} style={styles.pairDesk} contentFit="cover" />
                  )}
                </View>
                <Text style={styles.plusAlertMsg}>
                  {t('gallery.matchedRoomSub', { outfit: localizeOutfitName(pairBuy.skin.name, t), room: pairBuy.pair.name })}
                </Text>
                <View style={styles.buyBalanceRow}>
                  <Text style={styles.buyBalanceLabel}>{t('gallery.yourBalance')}</Text>
                  <View style={styles.buyBalanceValue}>
                    <CoinIcon size={15 * scale} />
                    <Text style={styles.buyBalanceNum}>{formatCoins(coins)}</Text>
                  </View>
                </View>
                {!canAffordPair && (
                  <Text style={styles.buyShortfall}>
                    {t('gallery.shortfall', { count: pairTotal - coins })}
                  </Text>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.buyBtn,
                    !canAffordPair && styles.buyBtnDisabled,
                    pressed && styles.pressed,
                  ]}
                  onPress={confirmPairBuy}>
                  <Text style={styles.buyBtnText}>
                    {canAffordPair ? t('gallery.unlockForCoins', { price: pairTotal }) : t('gallery.notEnoughCoins')}
                  </Text>
                </Pressable>
                <Pressable style={styles.buyCancel} onPress={() => setPairBuy(null)}>
                  <Text style={styles.buyCancelText}>{t('gallery.maybeLater')}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Confirm-before-equip for an owned matched room: preview background (+ desk
          if it has one) and ask the player to confirm. */}
      <Modal
        visible={pairConfirm !== null}
        transparent
        animationType="fade"
        onDismiss={handlePairModalDismissed}
        onRequestClose={() => setPairConfirm(null)}>
        <Pressable style={styles.buyBackdrop} onPress={() => setPairConfirm(null)}>
          <Pressable style={styles.buyCard} onPress={(e) => e.stopPropagation?.()}>
            {pairConfirm && (
              <>
                <Text style={styles.buyTitle}>{t('gallery.equipLookTitle')}</Text>
                <View style={styles.pairImage}>
                  <Image source={pairConfirm.pair.backgroundImage} style={styles.pairBg} contentFit="cover" />
                  {pairConfirm.pair.deskImage != null && (
                    <Image source={pairConfirm.pair.deskImage} style={styles.pairDesk} contentFit="cover" />
                  )}
                </View>
                <Text style={styles.plusAlertMsg}>
                  {t(pairConfirm.pair.deskId ? 'gallery.equipLookSub' : 'gallery.equipLookSubNoDesk', {
                    outfit: localizeOutfitName(pairConfirm.skin.name, t),
                    room: pairConfirm.pair.name,
                  })}
                </Text>
                <Pressable
                  style={({ pressed }) => [styles.buyBtn, pressed && styles.pressed]}
                  onPress={confirmPairEquip}>
                  <Text style={styles.buyBtnText}>{t('gallery.equipLookBtn')}</Text>
                </Pressable>
                <Pressable style={styles.buyCancel} onPress={() => setPairConfirm(null)}>
                  <Text style={styles.buyCancelText}>{t('gallery.maybeLater')}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Plus-exclusive outfit popup (custom, reddish-pink OK). */}
      <Modal
        visible={plusAlertName !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPlusAlertName(null)}>
        <Pressable style={styles.buyBackdrop} onPress={() => setPlusAlertName(null)}>
          <Pressable style={styles.buyCard} onPress={(e) => e.stopPropagation?.()}>
            {plusAlertName && (
              <>
                <Text style={styles.buyTitle}>{t('shop.plusExclusive', { name: plusAlertName })}</Text>
                <Text style={styles.plusAlertMsg}>{t('shop.plusExclusiveMsg', { name: plusAlertName })}</Text>
                <Pressable
                  style={({ pressed }) => [styles.plusOkBtn, pressed && styles.pressed]}
                  onPress={() => setPlusAlertName(null)}>
                  <Text style={styles.plusOkText}>{t('common.ok')}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Generic in-file alert / confirm — replaces root showPopup (which freezes when
          presented over this modal screen). Presents fine because it's part of this
          screen's own view, like the other in-file modals above. */}
      <Modal
        visible={galleryAlert !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setGalleryAlert(null)}>
        <Pressable style={styles.buyBackdrop} onPress={() => setGalleryAlert(null)}>
          <Pressable style={styles.buyCard} onPress={(e) => e.stopPropagation?.()}>
            {galleryAlert && (
              <>
                <Text style={styles.buyTitle}>{galleryAlert.title}</Text>
                <Text style={styles.plusAlertMsg}>{galleryAlert.msg}</Text>
                {galleryAlert.onConfirm ? (
                  <>
                    <Pressable
                      style={({ pressed }) => [styles.buyBtn, pressed && styles.pressed]}
                      onPress={() => { const fn = galleryAlert.onConfirm; setGalleryAlert(null); fn?.(); }}>
                      <Text style={styles.buyBtnText}>{galleryAlert.confirmText ?? t('common.ok')}</Text>
                    </Pressable>
                    <Pressable style={styles.buyCancel} onPress={() => setGalleryAlert(null)}>
                      <Text style={styles.buyCancelText}>{t('common.cancel')}</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.plusOkBtn, pressed && styles.pressed]}
                    onPress={() => setGalleryAlert(null)}>
                    <Text style={styles.plusOkText}>{t('common.ok')}</Text>
                  </Pressable>
                )}
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

    </ScrollView>
    <DevKnobs screen="companion-gallery" knobs={knobs} onChange={(key, value) => setTweak((p) => ({ ...p, [key]: value }))} />
    </>
  );
}

export default function CompanionGalleryScreen() {
  return (
    <ThemedView style={{ flex: 1, backgroundColor: P.cream }}>
      <GalleryContent />
    </ThemedView>
  );
}

const makeStyles = (s: number, contentWidth: number) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    padding: Spacing.four * s,
    maxWidth: contentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four * s,
    backgroundColor: P.cream,
  },

  // Header — big bubbly title + subtitle (no banner frame).
  headerRow: { width: '100%', alignItems: 'center', gap: 4 * s, marginTop: Spacing.two * s, marginBottom: Spacing.one * s },
  headerTitle: {
    fontFamily: Fonts.rounded,
    fontSize: 32 * s,
    fontWeight: '900',
    color: P.brown,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13 * s,
    color: P.mutedBrown,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Sections
  section: { gap: Spacing.two * s },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16 * s,
    fontWeight: '800',
    color: P.brown,
  },
  slotCount: { fontSize: 13 * s, color: P.mutedBrown, fontWeight: '600' },
  // Hanger button on each companion card — white hanger on a pink chip
  hangerBtn: {
    position: 'absolute',
    top: 8 * s,
    left: 8 * s,
    zIndex: 2,
    width: 34 * s,
    height: 34 * s,
    borderRadius: 17 * s,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.pink,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },

  // Wardrobe modal
  wardrobeBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(91,58,46,0.35)',
    justifyContent: 'flex-end',
  },
  wardrobeSheet: {
    backgroundColor: P.cream,
    borderTopLeftRadius: 28 * s,
    borderTopRightRadius: 28 * s,
    padding: Spacing.four * s,
    gap: Spacing.three * s,
    maxWidth: contentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  wardrobeTitle: { fontSize: 20 * s, fontWeight: '800', color: P.brown, textAlign: 'center' },
  wardrobeSubtitle: { fontSize: 13 * s, color: P.mutedBrown, fontWeight: '500', textAlign: 'center', marginTop: -6 * s },
  wardrobeEmpty: { alignItems: 'center', gap: 6 * s, paddingVertical: Spacing.four * s },
  wardrobeEmptyTitle: { fontSize: 16 * s, fontWeight: '800', color: P.brown },
  wardrobeEmptyText: { fontSize: 13 * s, color: P.mutedBrown, textAlign: 'center', lineHeight: 18 * s, paddingHorizontal: Spacing.three * s },
  skinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three * s, justifyContent: 'center' },
  skinSlot: { width: '47%', position: 'relative' },
  skinCard: {
    width: '100%',
    backgroundColor: P.card,
    borderRadius: 20 * s,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    padding: Spacing.three * s,
    alignItems: 'center',
    gap: 4 * s,
  },
  skinCardActive: {
    borderColor: P.pink,
    backgroundColor: '#FFF4F6',
  },
  skinCardLocked: {
    borderColor: P.pinkSoft,
    backgroundColor: '#FBF6F2',
  },
  // Chain badge — top-right of an outfit card that has a matched room.
  linkBadge: {
    position: 'absolute',
    top: 8 * s,
    right: 8 * s,
    zIndex: 2,
    width: 28 * s,
    height: 28 * s,
    borderRadius: 14 * s,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.pink,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  skinImageWrap: { width: '85%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  skinImage: { width: '100%', height: '100%' },
  skinImageLocked: { opacity: 0.45 },
  lockBadge: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skinName: { fontSize: 14 * s, fontWeight: '800', color: P.brown, textAlign: 'center' },
  skinPill: {
    marginTop: 4 * s,
    backgroundColor: P.pinkActiveSoft,
    borderRadius: 999,
    paddingHorizontal: 14 * s,
    paddingVertical: 5 * s,
    borderWidth: 1.5,
    borderColor: P.pinkActive,
  },
  skinPillText: { fontSize: 11 * s, color: P.pinkActiveText, fontWeight: '800' },
  skinTap: { fontSize: 11 * s, color: P.mutedBrown, fontWeight: '600', marginTop: 6 * s },

  // Companion grid
  companionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three * s,
  },
  companionCard: {
    width: '47%',
    backgroundColor: P.card,
    borderRadius: 22 * s,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    padding: Spacing.three * s,
    alignItems: 'center',
    gap: 4 * s,
    shadowColor: '#C9A18A',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  companionCardActive: {
    borderColor: P.pink,
    backgroundColor: '#FFF4F6',
    shadowColor: P.pink,
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  cardDelete: {
    position: 'absolute',
    top: 8 * s,
    right: 10 * s,
    zIndex: 2,
    width: 22 * s,
    height: 22 * s,
    borderRadius: 11 * s,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.pinkSoft,
  },
  cardDeleteText: { fontSize: 11 * s, color: P.brown, fontWeight: '700' },
  companionImageWrap: {
    width: '80%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2 * s,
  },
  companionImage: { width: '100%', height: '100%' },
  companionImagePlaceholder: { width: '100%', height: '100%' },
  companionName: {
    fontSize: 15 * s,
    fontWeight: '800',
    color: P.brown,
    textAlign: 'center',
  },
  companionSubtitle: {
    fontSize: 11 * s,
    color: P.mutedBrown,
    fontWeight: '500',
  },
  activePill: {
    marginTop: 6 * s,
    backgroundColor: P.pinkActiveSoft,
    borderRadius: 999,
    paddingHorizontal: 16 * s,
    paddingVertical: 6 * s,
    borderWidth: 1.5,
    borderColor: P.pinkActive,
  },
  activePillText: { fontSize: 12 * s, color: P.pinkActiveText, fontWeight: '800' },
  setActiveBtn: {
    marginTop: 6 * s,
    backgroundColor: P.pink,
    borderRadius: 999,
    paddingHorizontal: 18 * s,
    paddingVertical: 7 * s,
  },
  setActiveBtnText: { fontSize: 12 * s, color: '#FFF', fontWeight: '800' },

  // Locked companion cards
  companionCardLocked: { borderColor: P.pinkSoft, backgroundColor: '#FBF6F2' },
  companionImageLocked: { opacity: 0.5 },
  cardLockBadge: {
    position: 'absolute',
    width: 34 * s,
    height: 34 * s,
    borderRadius: 17 * s,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: P.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLockBadgeText: { fontSize: 16 * s },
  unlockBtn: {
    marginTop: 6 * s,
    backgroundColor: P.pink,
    borderRadius: 999,
    paddingHorizontal: 16 * s,
    paddingVertical: 7 * s,
  },
  unlockBtnText: { fontSize: 12 * s, color: '#FFF', fontWeight: '800' },
  plusBtn: { backgroundColor: P.pinkActiveSoft, borderWidth: 1.5, borderColor: P.pinkActive },
  plusBtnText: { fontSize: 12 * s, color: P.pinkActiveText, fontWeight: '800' },

  // Unlock popup
  buyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(91,58,46,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24 * s,
  },
  buyCard: {
    width: '100%',
    minWidth: MIN_POPUP_WIDTH,
    maxWidth: 340 * s,
    backgroundColor: P.card,
    borderRadius: 26 * s,
    padding: Spacing.four * s,
    gap: Spacing.three * s,
    borderWidth: 1.5,
    borderColor: P.peach,
    alignItems: 'center',
  },
  buyTitle: { fontSize: 19 * s, fontWeight: '800', color: P.brown, textAlign: 'center' },
  buyImage: { width: 120 * s, height: 120 * s },
  pairImage: { width: 220 * s, height: 132 * s, borderRadius: 14 * s, overflow: 'hidden' },
  pairBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Desk sits as a full-width band along the bottom, matching the study room.
  pairDesk: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' },
  buyBalanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  buyBalanceValue: { flexDirection: 'row', alignItems: 'center', gap: 4 * s },
  buyBalanceLabel: { fontSize: 13 * s, fontWeight: '600', color: P.mutedBrown },
  buyBalanceNum: { fontSize: 15 * s, fontWeight: '800', color: P.brown },
  buyShortfall: { fontSize: 12.5 * s, color: P.pinkActiveText, fontWeight: '700', textAlign: 'center' },
  buyBtn: { alignSelf: 'stretch', backgroundColor: P.pink, borderRadius: 18 * s, paddingVertical: Spacing.three * s, alignItems: 'center' },
  buyBtnDisabled: { backgroundColor: P.pinkSoft },
  buyBtnText: { color: '#FFF', fontSize: 16 * s, fontWeight: '800' },
  buyCancel: { alignItems: 'center', paddingVertical: 2 * s },
  buyCancelText: { fontSize: 13.5 * s, color: P.mutedBrown, fontWeight: '700' },
  plusAlertMsg: { fontSize: 14 * s, color: P.mutedBrown, fontWeight: '600', textAlign: 'center', lineHeight: 20 * s },
  plusOkBtn: { alignSelf: 'stretch', backgroundColor: '#E85C77', borderRadius: 18 * s, paddingVertical: Spacing.three * s, alignItems: 'center', marginTop: Spacing.one * s },
  plusOkText: { color: '#FFF', fontSize: 16 * s, fontWeight: '900' },

  // Receipt card
  receiptCard: {
    backgroundColor: P.card,
    borderRadius: 20 * s,
    padding: Spacing.three * s,
    borderWidth: 1.5,
    borderColor: P.peach,
    gap: Spacing.two * s,
    overflow: 'hidden',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  receiptNotchLeft: {
    position: 'absolute',
    left: -10 * s,
    top: '46%',
    width: 20 * s,
    height: 20 * s,
    borderRadius: 10 * s,
    backgroundColor: P.cream,
  },
  receiptNotchRight: {
    position: 'absolute',
    right: -10 * s,
    top: '46%',
    width: 20 * s,
    height: 20 * s,
    borderRadius: 10 * s,
    backgroundColor: P.cream,
  },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s },
  receiptEmoji: { fontSize: 34 * s },
  receiptInfo: { flex: 1, gap: 2 * s },
  receiptTitle: { fontSize: 15 * s, fontWeight: '800', color: P.brown },
  receiptCount: { fontSize: 13 * s, color: P.mutedBrown, fontWeight: '600' },
  generateBtn: {
    backgroundColor: P.pink,
    borderRadius: 999,
    paddingHorizontal: 16 * s,
    paddingVertical: 8 * s,
  },
  generateBtnText: { color: '#FFF', fontSize: 13 * s, fontWeight: '800' },
  receiptDivider: {
    height: 1.5,
    borderRadius: 1,
    borderWidth: 1,
    borderColor: P.pinkSoft,
    borderStyle: 'dashed',
    marginVertical: 2 * s,
  },
  receiptDesc: { fontSize: 12 * s, color: P.mutedBrown, lineHeight: 17 * s },
  receiptLinks: { flexDirection: 'row', justifyContent: 'space-between' },
  linkText: { fontSize: 13 * s, color: P.pink, fontWeight: '700' },

  // Forms
  formCard: {
    backgroundColor: P.card,
    borderRadius: 20 * s,
    padding: Spacing.three * s,
    borderWidth: 1.5,
    borderColor: P.peach,
    gap: Spacing.two * s,
  },
  formTitle: { fontSize: 15 * s, fontWeight: '800', color: P.brown },
  promptInput: { minHeight: 80 * s, textAlignVertical: 'top' },
  formSubmitBtn: {
    backgroundColor: P.button,
    borderRadius: 14 * s,
    paddingVertical: Spacing.two * s,
    alignItems: 'center',
    marginTop: 2 * s,
  },
  formSubmitText: { color: '#FFF', fontSize: 15 * s, fontWeight: '700' },
  disabledBtn: { opacity: 0.6 },

  // Extra slots
  slotsHint: { fontSize: 12 * s, color: P.mutedBrown, fontWeight: '500', lineHeight: 17 * s },
  slotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two * s },
  addSlotCard: {
    flex: 1,
    minWidth: 92 * s,
    aspectRatio: 0.95,
    borderRadius: 18 * s,
    borderWidth: 2,
    borderColor: P.pink,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(247,167,184,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4 * s,
  },
  addSlotPlus: { fontSize: 30 * s, color: P.pink, fontWeight: '700', lineHeight: 34 * s },
  addSlotText: { fontSize: 12 * s, color: P.mutedBrown, fontWeight: '600' },
  slotsFullNote: {
    flex: 1,
    fontSize: 12 * s,
    color: P.mutedBrown,
    textAlign: 'center',
    lineHeight: 18 * s,
    paddingVertical: Spacing.two * s,
  },

  // Info
  infoCard: {
    backgroundColor: P.pinkSoft,
    borderRadius: 18 * s,
    padding: Spacing.three * s,
    borderWidth: 1.5,
    borderColor: P.pink,
  },
  infoText: {
    fontSize: 12.5 * s,
    color: P.brown,
    textAlign: 'center',
    lineHeight: 18 * s,
    fontWeight: '500',
  },

  // Done
  doneButton: {
    backgroundColor: P.pink,
    borderRadius: 18 * s,
    paddingVertical: Spacing.three * s,
    alignItems: 'center',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  doneButtonText: { color: '#FFF', fontSize: 17 * s, fontWeight: '800' },

  pressed: { opacity: 0.85 },

  loreBadge: {
    position: 'absolute', top: 8 * s, left: 8 * s, zIndex: 10,
    width: 22 * s, height: 22 * s, borderRadius: 11 * s,
    backgroundColor: P.pink,
    alignItems: 'center', justifyContent: 'center',
  },
  loreBadgeText: { color: '#fff', fontSize: 11 * s, fontWeight: '800', lineHeight: 14 * s },
  loreBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
    backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', padding: 28 * s,
    borderRadius: 28 * s,
  },
  loreCard: {
    backgroundColor: '#FFFDF8', borderRadius: 24 * s,
    paddingHorizontal: 22 * s, paddingTop: 22 * s, paddingBottom: 18 * s, gap: 12 * s, alignItems: 'center',
    // A tall vertical rectangle: narrower width + capped height so the long story
    // scrolls inside rather than overflowing the screen.
    width: '88%', maxWidth: 360 * s, minWidth: MIN_POPUP_WIDTH, maxHeight: '84%',
    shadowColor: '#5B3A2E', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  loreScroll: { alignSelf: 'stretch', flexShrink: 1 },
  loreScrollContent: { paddingVertical: 2 * s },
  loreTitle: { fontSize: 20 * s, fontWeight: '900', color: P.brown, textAlign: 'center' },
  loreText: { fontSize: 13.5 * s, color: P.mutedBrown, lineHeight: 20 * s, textAlign: 'left' },
  loreClose: { marginTop: 4 * s, backgroundColor: P.pink, borderRadius: 18 * s, paddingVertical: 10 * s, paddingHorizontal: 28 * s },
  loreCloseText: { color: '#fff', fontSize: 14 * s, fontWeight: '800' },
});
