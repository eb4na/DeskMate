import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useApp } from '@/context/app-context';
import { BUN_SKINS, getBunSkinImage, getCompanionSkinImage, getCompanionSkins, getStarterActiveId, SHOP_COMPANIONS } from '@/lib/companion-utils';
import { SHOP_ITEMS } from '@/constants/shop-data';

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

// Per-companion taglines shown under each name in the gallery.
const TAGLINES: Record<string, string> = {
  Bun: '"Bun study with you forever."',
  Cocoa: '"Work hard now, treat later."',
  Bunny: '"bunny know bunny the cutest thing ever"',
  Miel: '"Nap now, study after…"',
  Tira: '"Tira dropped out, you should study though."',
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
};

function GalleryContent() {
  const {
    activeCompanionId,
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
  } = useApp();

  const [wardrobeFor, setWardrobeFor] = useState<{ id: string; name: string } | null>(null);
  // In-place unlock popup for a coin-priced item (a locked companion or skin).
  const [buyItem, setBuyItem] = useState<{ id: string; name: string; image: number | null; price: number } | null>(null);
  const buyDiscount = isPlus ? 0.8 : 1;
  const buyPrice = buyItem ? Math.floor(buyItem.price * buyDiscount) : 0;
  const canAffordBuy = coins >= buyPrice;
  const confirmBuy = () => {
    if (!buyItem || !canAffordBuy) return;
    purchaseShopItem(buyItem.id, buyPrice);
    setBuyItem(null);
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

  const handleUseSlot = (slotId: string, hasRenderableImage: boolean) => {
    if (!hasRenderableImage) {
      Alert.alert(
        'No art to show yet',
        'This custom slot does not have character art yet. Generate a companion to use it across Home and study screens.',
      );
      return;
    }
    setActiveCompanion(slotId);
  };

  const confirmDelete = (slotId: string, name: string) => {
    Alert.alert('Remove companion?', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteCompanionSlot(slotId) },
    ]);
  };

  // Owned characters — Bun (starter) plus saved slots. Grid grows with each one.
  const obtainedCharacters: ObtainedCharacter[] = [
    {
      id: getStarterActiveId('girl'),
      name: 'Bun',
      image: getBunSkinImage(bunSkinId),
      emoji: null,
      isActive: activeCompanionId === getStarterActiveId('girl'),
      isGenerated: false,
      deletable: false,
      onSelect: () => setDefaultCompanion('girl'),
    },
    // Purchased shop companions you own.
    ...SHOP_COMPANIONS.filter((item) => ownedShopItems.includes(item.id)).map((item) => ({
      id: `shop:${item.id}`,
      name: item.name,
      image: getCompanionSkinImage(`shop:${item.id}`, companionSkins[`shop:${item.id}`]) ?? (item.image as number),
      emoji: item.emoji,
      isActive: activeCompanionId === `shop:${item.id}`,
      isGenerated: false,
      deletable: false,
      onSelect: () => setActiveCompanion(`shop:${item.id}`),
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

  // Shop companions you don't own yet — shown locked so you can preview them
  // (and their wardrobes) and unlock right here instead of going to the Shop.
  const lockedCharacters = SHOP_COMPANIONS
    .filter((item) => !ownedShopItems.includes(item.id))
    .map((item) => ({
      id: `shop:${item.id}`,
      itemId: item.id,
      name: item.name,
      image: getCompanionSkinImage(`shop:${item.id}`, 'classic') ?? (item.image as number),
      emoji: item.emoji,
      price: item.price,
      plusOnly: !!item.plusOnly,
    }));

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: P.cream }}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header panel */}
        <View style={styles.headerPanel}>
          <Text style={styles.headerTitle}>🍓 Companion Bakery</Text>
          <Text style={styles.headerSubtitle}>Choose who studies with you today</Text>
        </View>

        {/* My Companions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Companions</Text>
          <View style={styles.companionGrid}>
            {obtainedCharacters.map((char) => (
              <View
                key={char.id}
                style={[styles.companionCard, char.isActive && styles.companionCardActive]}>
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
                  onPress={() => setWardrobeFor({ id: char.id, name: char.name })}
                  hitSlop={8}>
                  <HangerIcon color="#FFFFFF" size={22} />
                </Pressable>
                <View style={styles.companionImageWrap}>
                  {char.image ? (
                    <Image source={char.image} style={styles.companionImage} contentFit="contain" />
                  ) : (
                    <Text style={styles.companionEmoji}>{char.emoji ?? '🐾'}</Text>
                  )}
                </View>
                <Text style={styles.companionName} numberOfLines={1}>
                  {char.name}
                  {char.isGenerated ? ' 🎨' : ''}
                </Text>
                <Text style={styles.companionSubtitle} numberOfLines={2}>{TAGLINES[char.name] ?? 'Your study buddy'}</Text>
                {char.isActive ? (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>✦ Active</Text>
                  </View>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.setActiveBtn, pressed && styles.pressed]}
                    onPress={char.onSelect}>
                    <Text style={styles.setActiveBtnText}>Set Active</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Locked companions — preview & unlock */}
        {lockedCharacters.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>More Companions</Text>
            <View style={styles.companionGrid}>
              {lockedCharacters.map((char) => (
                <View key={char.id} style={[styles.companionCard, styles.companionCardLocked]}>
                  <Pressable
                    style={({ pressed }) => [styles.hangerBtn, pressed && styles.pressed]}
                    onPress={() => setWardrobeFor({ id: char.id, name: char.name })}
                    hitSlop={8}>
                    <HangerIcon color="#FFFFFF" size={22} />
                  </Pressable>
                  <View style={styles.companionImageWrap}>
                    {char.image ? (
                      <Image source={char.image} style={[styles.companionImage, styles.companionImageLocked]} contentFit="contain" />
                    ) : (
                      <Text style={styles.companionEmoji}>{char.emoji ?? '🐾'}</Text>
                    )}
                    <View style={styles.cardLockBadge}>
                      <Text style={styles.cardLockBadgeText}>🔒</Text>
                    </View>
                  </View>
                  <Text style={styles.companionName} numberOfLines={1}>{char.name}</Text>
                  <Text style={styles.companionSubtitle} numberOfLines={2}>{TAGLINES[char.name] ?? 'Your study buddy'}</Text>
                  {char.plusOnly ? (
                    <Pressable
                      style={({ pressed }) => [styles.unlockBtn, styles.plusBtn, pressed && styles.pressed]}
                      onPress={() => router.push('/plus-upgrade')}>
                      <Text style={styles.plusBtnText}>✨ Plus exclusive</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={({ pressed }) => [styles.unlockBtn, pressed && styles.pressed]}
                      onPress={() => setBuyItem({ id: char.itemId, name: char.name, image: char.image, price: char.price })}>
                      <Text style={styles.unlockBtnText}>🔓 {Math.floor(char.price * buyDiscount)} coins</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Info note */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            🧁 Your active companion appears across Home, sessions, breaks, and completion screens.
          </Text>
        </View>

        {/* Done */}
        <Pressable
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </SafeAreaView>

      {/* Wardrobe — per-companion outfit picker */}
      <Modal
        visible={!!wardrobeFor}
        animationType="slide"
        transparent
        onRequestClose={() => setWardrobeFor(null)}>
        <View style={styles.wardrobeBackdrop}>
          <View style={styles.wardrobeSheet}>
            <Text style={styles.wardrobeTitle}>👗 {wardrobeFor?.name}&apos;s Wardrobe</Text>
            {wardrobeSkins.length > 0 ? (
              <>
                <Text style={styles.wardrobeSubtitle}>Pick an outfit — {wardrobeFor?.name} wears it everywhere</Text>
                <View style={styles.skinGrid}>
                  {wardrobeSkins.map((skin) => {
                    const equipped = wardrobeEquipped === skin.id;
                    const locked = !!skin.shopItemId && !ownedShopItems.includes(skin.shopItemId);
                    return (
                      <Pressable
                        key={skin.id}
                        style={[styles.skinCard, equipped && styles.skinCardActive, locked && styles.skinCardLocked]}
                        onPress={() => {
                          if (locked) {
                            const item = skin.shopItemId ? getShopItem(skin.shopItemId) : null;
                            if (item) setBuyItem({ id: item.id, name: item.name, image: skin.image, price: item.price });
                          } else {
                            equipWardrobeSkin(skin.id);
                          }
                        }}>
                        <View style={styles.skinImageWrap}>
                          <Image
                            source={skin.image}
                            style={[styles.skinImage, locked && styles.skinImageLocked]}
                            contentFit="contain"
                          />
                          {locked && (
                            <View style={styles.lockBadge}>
                              <Text style={styles.lockBadgeText}>🔒</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.skinName} numberOfLines={1}>
                          {skin.emoji} {skin.name}
                        </Text>
                        {locked ? (
                          <Text style={styles.skinLockedText}>🔓 Tap to unlock</Text>
                        ) : equipped ? (
                          <View style={styles.skinPill}>
                            <Text style={styles.skinPillText}>✦ Wearing</Text>
                          </View>
                        ) : (
                          <Text style={styles.skinTap}>Tap to wear</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={styles.wardrobeEmpty}>
                <Text style={styles.wardrobeEmptyEmoji}>🧥</Text>
                <Text style={styles.wardrobeEmptyTitle}>No outfits yet</Text>
                <Text style={styles.wardrobeEmptyText}>
                  {wardrobeFor?.name}&apos;s wardrobe is empty for now — more outfits coming soon!
                </Text>
              </View>
            )}
            <Pressable
              style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
              onPress={() => setWardrobeFor(null)}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </View>
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
                <Text style={styles.buyTitle}>Unlock {buyItem.name}</Text>
                {buyItem.image && (
                  <Image source={buyItem.image} style={styles.buyImage} contentFit="contain" />
                )}
                <View style={styles.buyBalanceRow}>
                  <Text style={styles.buyBalanceLabel}>Your balance</Text>
                  <Text style={styles.buyBalanceNum}>🪙 {coins}</Text>
                </View>
                {!canAffordBuy && (
                  <Text style={styles.buyShortfall}>
                    You need {buyPrice - coins} more coins. Earn coins by studying!
                  </Text>
                )}
                <Pressable
                  disabled={!canAffordBuy}
                  style={({ pressed }) => [
                    styles.buyBtn,
                    !canAffordBuy && styles.buyBtnDisabled,
                    pressed && canAffordBuy && styles.pressed,
                  ]}
                  onPress={confirmBuy}>
                  <Text style={styles.buyBtnText}>
                    {canAffordBuy ? `Unlock for ${buyPrice} coins` : 'Not enough coins'}
                  </Text>
                </Pressable>
                <Pressable style={styles.buyCancel} onPress={() => setBuyItem(null)}>
                  <Text style={styles.buyCancelText}>Maybe later</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

export default function CompanionGalleryScreen() {
  return (
    <ThemedView style={[styles.container, { backgroundColor: P.cream }]}>
      <GalleryContent />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
    backgroundColor: P.cream,
  },

  // Header
  headerPanel: {
    backgroundColor: P.card,
    borderRadius: 26,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    borderWidth: 1.5,
    borderColor: P.peach,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#C9A18A',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: P.brown,
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: P.mutedBrown,
    fontWeight: '500',
  },

  // Sections
  section: { gap: Spacing.two },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: P.brown,
  },
  slotCount: { fontSize: 13, color: P.mutedBrown, fontWeight: '600' },
  // Hanger button on each companion card — white hanger on a pink chip
  hangerBtn: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  wardrobeTitle: { fontSize: 20, fontWeight: '800', color: P.brown, textAlign: 'center' },
  wardrobeSubtitle: { fontSize: 13, color: P.mutedBrown, fontWeight: '500', textAlign: 'center', marginTop: -6 },
  wardrobeEmpty: { alignItems: 'center', gap: 6, paddingVertical: Spacing.four },
  wardrobeEmptyEmoji: { fontSize: 44 },
  wardrobeEmptyTitle: { fontSize: 16, fontWeight: '800', color: P.brown },
  wardrobeEmptyText: { fontSize: 13, color: P.mutedBrown, textAlign: 'center', lineHeight: 18, paddingHorizontal: Spacing.three },
  skinGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'center' },
  skinCard: {
    width: '47%',
    backgroundColor: P.card,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    padding: Spacing.three,
    alignItems: 'center',
    gap: 4,
  },
  skinCardActive: {
    borderColor: P.pink,
    backgroundColor: '#FFF4F6',
  },
  skinCardLocked: {
    borderColor: P.pinkSoft,
    backgroundColor: '#FBF6F2',
  },
  skinImageWrap: { width: '85%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  skinImage: { width: '100%', height: '100%' },
  skinImageLocked: { opacity: 0.45 },
  lockBadge: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1.5,
    borderColor: P.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadgeText: { fontSize: 15 },
  skinLockedText: { fontSize: 11.5, color: P.pink, fontWeight: '800', marginTop: 6 },
  skinName: { fontSize: 14, fontWeight: '800', color: P.brown, textAlign: 'center' },
  skinPill: {
    marginTop: 4,
    backgroundColor: P.pinkActiveSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1.5,
    borderColor: P.pinkActive,
  },
  skinPillText: { fontSize: 11, color: P.pinkActiveText, fontWeight: '800' },
  skinTap: { fontSize: 11, color: P.mutedBrown, fontWeight: '600', marginTop: 6 },

  // Companion grid
  companionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  companionCard: {
    width: '47%',
    backgroundColor: P.card,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    padding: Spacing.three,
    alignItems: 'center',
    gap: 4,
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
    top: 8,
    right: 10,
    zIndex: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: P.pinkSoft,
  },
  cardDeleteText: { fontSize: 11, color: P.brown, fontWeight: '700' },
  companionImageWrap: {
    width: '80%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  companionImage: { width: '100%', height: '100%' },
  companionEmoji: { fontSize: 56 },
  companionName: {
    fontSize: 15,
    fontWeight: '800',
    color: P.brown,
    textAlign: 'center',
  },
  companionSubtitle: {
    fontSize: 11,
    color: P.mutedBrown,
    fontWeight: '500',
  },
  activePill: {
    marginTop: 6,
    backgroundColor: P.pinkActiveSoft,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: P.pinkActive,
  },
  activePillText: { fontSize: 12, color: P.pinkActiveText, fontWeight: '800' },
  setActiveBtn: {
    marginTop: 6,
    backgroundColor: P.pink,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  setActiveBtnText: { fontSize: 12, color: '#FFF', fontWeight: '800' },

  // Locked companion cards
  companionCardLocked: { borderColor: P.pinkSoft, backgroundColor: '#FBF6F2' },
  companionImageLocked: { opacity: 0.5 },
  cardLockBadge: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: P.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLockBadgeText: { fontSize: 16 },
  unlockBtn: {
    marginTop: 6,
    backgroundColor: P.pink,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  unlockBtnText: { fontSize: 12, color: '#FFF', fontWeight: '800' },
  plusBtn: { backgroundColor: P.pinkActiveSoft, borderWidth: 1.5, borderColor: P.pinkActive },
  plusBtnText: { fontSize: 12, color: P.pinkActiveText, fontWeight: '800' },

  // Unlock popup
  buyBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(91,58,46,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  buyCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: P.card,
    borderRadius: 26,
    padding: Spacing.four,
    gap: Spacing.three,
    borderWidth: 1.5,
    borderColor: P.peach,
    alignItems: 'center',
  },
  buyTitle: { fontSize: 19, fontWeight: '800', color: P.brown, textAlign: 'center' },
  buyImage: { width: 120, height: 120 },
  buyBalanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  buyBalanceLabel: { fontSize: 13, fontWeight: '600', color: P.mutedBrown },
  buyBalanceNum: { fontSize: 15, fontWeight: '800', color: P.brown },
  buyShortfall: { fontSize: 12.5, color: P.pinkActiveText, fontWeight: '700', textAlign: 'center' },
  buyBtn: { alignSelf: 'stretch', backgroundColor: P.pink, borderRadius: 18, paddingVertical: Spacing.three, alignItems: 'center' },
  buyBtnDisabled: { backgroundColor: P.pinkSoft },
  buyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  buyCancel: { alignItems: 'center', paddingVertical: 2 },
  buyCancelText: { fontSize: 13.5, color: P.mutedBrown, fontWeight: '700' },

  // Receipt card
  receiptCard: {
    backgroundColor: P.card,
    borderRadius: 20,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: P.peach,
    gap: Spacing.two,
    overflow: 'hidden',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  receiptNotchLeft: {
    position: 'absolute',
    left: -10,
    top: '46%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: P.cream,
  },
  receiptNotchRight: {
    position: 'absolute',
    right: -10,
    top: '46%',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: P.cream,
  },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  receiptEmoji: { fontSize: 34 },
  receiptInfo: { flex: 1, gap: 2 },
  receiptTitle: { fontSize: 15, fontWeight: '800', color: P.brown },
  receiptCount: { fontSize: 13, color: P.mutedBrown, fontWeight: '600' },
  generateBtn: {
    backgroundColor: P.pink,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  generateBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  receiptDivider: {
    height: 1.5,
    borderRadius: 1,
    borderWidth: 1,
    borderColor: P.pinkSoft,
    borderStyle: 'dashed',
    marginVertical: 2,
  },
  receiptDesc: { fontSize: 12, color: P.mutedBrown, lineHeight: 17 },
  receiptLinks: { flexDirection: 'row', justifyContent: 'space-between' },
  linkText: { fontSize: 13, color: P.pink, fontWeight: '700' },

  // Forms
  formCard: {
    backgroundColor: P.card,
    borderRadius: 20,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: P.peach,
    gap: Spacing.two,
  },
  formTitle: { fontSize: 15, fontWeight: '800', color: P.brown },
  promptInput: { minHeight: 80, textAlignVertical: 'top' },
  formSubmitBtn: {
    backgroundColor: P.button,
    borderRadius: 14,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: 2,
  },
  formSubmitText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  disabledBtn: { opacity: 0.6 },

  // Extra slots
  slotsHint: { fontSize: 12, color: P.mutedBrown, fontWeight: '500', lineHeight: 17 },
  slotsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  addSlotCard: {
    flex: 1,
    minWidth: 92,
    aspectRatio: 0.95,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: P.pink,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(247,167,184,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addSlotPlus: { fontSize: 30, color: P.pink, fontWeight: '700', lineHeight: 34 },
  addSlotText: { fontSize: 12, color: P.mutedBrown, fontWeight: '600' },
  slotsFullNote: {
    flex: 1,
    fontSize: 12,
    color: P.mutedBrown,
    textAlign: 'center',
    lineHeight: 18,
    paddingVertical: Spacing.two,
  },

  // Info
  infoCard: {
    backgroundColor: P.pinkSoft,
    borderRadius: 18,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: P.pink,
  },
  infoText: {
    fontSize: 12.5,
    color: P.brown,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },

  // Done
  doneButton: {
    backgroundColor: P.button,
    borderRadius: 18,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  doneButtonText: { color: '#FFF', fontSize: 17, fontWeight: '800' },

  pressed: { opacity: 0.85 },
});
