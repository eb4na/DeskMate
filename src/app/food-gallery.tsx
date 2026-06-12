import { router } from 'expo-router';
import { useState } from 'react';
import { Image, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { localizeCompanionName } from '@/lib/companion-utils';
import { MaxContentWidth, Spacing } from '@/constants/theme';

const BAKERY_BG = require('@/assets/images/backgrounds/bakery-menu.png');
const BAKERY_HEADER = require('@/assets/images/backgrounds/bakery-menu-header.png');

// Default "made it" badge (mirrors the finish-studying receipt's fallback).
const BUN_FINISHED = require('@/assets/images/bun/bun-finished.png');

export type FoodItem = {
  id: string;
  image: number;
  // Shop item that must be owned before this recipe can be selected. Undefined =
  // always available (free starter recipe).
  requiresItem?: string;
  price?: number;
  // Optional art shown as a top-right "made it" badge once the player has baked
  // this recipe at least once (e.g. the companion enjoying the finished dish).
  madeBadge?: number;
  // The companion this recipe belongs to (their signature bake). Canonical
  // English name — localize via localizeCompanionName at display time.
  owner: string;
};

export const FOOD_ITEMS: FoodItem[] = [
  {
    id: 'strawberry-shortcake',
    image: require('@/assets/images/cake/strawberry-shortcake.png'),
    madeBadge: require('@/assets/images/cake/strawberry-badge.png'),
    owner: 'Bun',
  },
  {
    id: 'pudding',
    image: require('@/assets/images/cake/pudding.png'),
    requiresItem: 'recipe_pudding',
    price: 400,
    madeBadge: require('@/assets/images/cake/pudding-finished.png'),
    owner: 'Miel',
  },
  {
    id: 'sakura-mochi',
    image: require('@/assets/images/cake/sakura-mochi.png'),
    requiresItem: 'recipe_sakura',
    price: 400,
    madeBadge: require('@/assets/images/cake/sakura-badge.png'),
    owner: 'Bunny',
  },
  {
    id: 'matcha-crepe',
    image: require('@/assets/images/cake/matcha-crepe.png'),
    requiresItem: 'recipe_matcha',
    price: 400,
    madeBadge: require('@/assets/images/cake/matcha-badge.png'),
    owner: 'Tira',
  },
  {
    id: 'berry-croissant',
    image: require('@/assets/images/cake/croissant.png'),
    requiresItem: 'recipe_croissant',
    price: 400,
    madeBadge: require('@/assets/images/cake/croissant-badge.png'),
    owner: 'Cocoa',
  },
];

// The recipe-badge unlock logic lives in a plain constants module so app-context
// can use it without an import cycle. Re-exported here for existing callers.
export { RECIPE_IDS, hasAllRecipeBadges } from '@/constants/recipes';

// Patisserie palette — mirrors the Companion Bakery screen.
const P = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F7A7B8',
  pinkSoft: '#FBD9E0',
  brown: '#5B3A2E',
  mutedBrown: '#9A7B6D',
  green: '#8BCF8B',
  greenSoft: '#E3F4E3',
  pinkActive: '#F2A0B5',
  pinkActiveSoft: '#FBDCE4',
  pinkActiveText: '#C75A78',
  button: '#8A7A60',
} as const;

export default function FoodGalleryScreen() {
  const { t } = useTranslation();
  const { selectedFoodId, madeFoods, setSelectedFood, ownedShopItems } = useApp();
  // Badge image currently shown enlarged in the zoom modal (null = closed).
  const [zoomBadge, setZoomBadge] = useState<number | null>(null);
  // Explicit banner width (≈8px side margins) so centering is deterministic and
  // the header image's width:'100%' resolves against a concrete number.
  const { width } = useWindowDimensions();
  // Centered banner — a fraction of the content width rather than full-bleed.
  const bannerWidth = Math.round(Math.min(width, MaxContentWidth) * 0.92);
  const bannerHeight = Math.round((bannerWidth * 287) / 891);

  return (
    <ImageBackground source={BAKERY_BG} resizeMode="cover" style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header — the scalloped banner art (compact) with the title/subtitle
              overlaid, centered via a full-width row wrapper. */}
          <View style={styles.headerRow}>
            <View style={styles.headerPanel}>
              <Image source={BAKERY_HEADER} style={{ width: bannerWidth, height: bannerHeight }} resizeMode="stretch" />
              <View style={styles.headerTextWrap}>
                <Text style={styles.headerTitle}>{t('foodGallery.bakeryMenu')}</Text>
                <Text style={styles.headerSubtitle}>{t('foodGallery.chooseBunBakes')}</Text>
              </View>
            </View>
          </View>

          {/* My Recipes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('foodGallery.myRecipes')}</Text>
            <View style={styles.grid}>
              {FOOD_ITEMS.map((food) => {
                const locked = !!food.requiresItem && !ownedShopItems.includes(food.requiresItem);
                const isSelected = !locked && selectedFoodId === food.id;
                const isMade = madeFoods.includes(food.id);
                return (
                  <View
                    key={food.id}
                    style={[styles.foodCard, isSelected && styles.foodCardActive, locked && styles.foodCardLocked]}>
                    {/* Top-right: an empty circle slot on every recipe; once baked
                        it fills with the same badge shown on the finish-studying
                        receipt. Locked recipes show a lock in the slot. */}
                    {isMade ? (
                      <Pressable
                        style={styles.madeBadgeBtn}
                        hitSlop={6}
                        onPress={() => setZoomBadge(food.madeBadge ?? BUN_FINISHED)}>
                        <Image source={food.madeBadge ?? BUN_FINISHED} style={styles.madeBadgeImg} resizeMode="cover" />
                      </Pressable>
                    ) : (
                      <View style={styles.badgeSlotEmpty} />
                    )}
                    <View style={styles.imageWrap}>
                      <Image
                        source={food.image}
                        style={[styles.foodImg, locked && styles.lockedImg]}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={styles.foodName} numberOfLines={1}>{t(`foodGallery.food_${food.id}`)}</Text>
                    <Text style={styles.foodOwner} numberOfLines={1}>{t('foodGallery.ownerTag', { name: localizeCompanionName(food.owner, t) })}</Text>
                    <Text style={styles.foodDesc} numberOfLines={2}>{t(`foodGallery.food_${food.id}_desc`)}</Text>
                    {locked ? (
                      <Pressable
                        style={({ pressed }) => [styles.lockedBtn, pressed && styles.pressed]}
                        onPress={() => router.replace({ pathname: '/shop', params: { category: 'recipe' } })}>
                        <Text style={styles.lockedBtnText} numberOfLines={1}>
                          {t('foodGallery.lockedBuy', { price: food.price ?? 0 })}
                        </Text>
                      </Pressable>
                    ) : isSelected ? (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>{t('foodGallery.baking')}</Text>
                      </View>
                    ) : (
                      <Pressable
                        style={({ pressed }) => [styles.selectBtn, pressed && styles.pressed]}
                        onPress={() => { setSelectedFood(food.id); if (router.canGoBack()) router.back(); else router.replace('/'); }}>
                        <Text style={styles.selectBtnText}>{t('foodGallery.bakeThis')}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Info note */}
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              {t('foodGallery.infoNote')}
            </Text>
          </View>

          {/* Done */}
          <Pressable
            style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Text style={styles.doneButtonText}>{t('common.done')}</Text>
          </Pressable>
        </SafeAreaView>
      </ScrollView>

      {/* Tap a recipe's badge to see it enlarged. */}
      <Modal visible={zoomBadge !== null} transparent animationType="fade" onRequestClose={() => setZoomBadge(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomBadge(null)}>
          {zoomBadge !== null && (
            <View style={styles.zoomCard}>
              <Image source={zoomBadge} style={styles.zoomBadgeImg} resizeMode="contain" />
              <Text style={styles.zoomHint}>{t('shop.tapToClose')}</Text>
            </View>
          )}
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { backgroundColor: 'transparent' },
  safeArea: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
    backgroundColor: 'transparent',
  },

  // Header banner: the scalloped art (BAKERY_HEADER) is an absolute layer behind
  // the title/subtitle. The panel matches the art's aspect ratio and centers the
  // text, with a little extra top padding so it clears the awning scallops.
  // Pull out past the screen padding so the banner reads bigger; symmetric, so it
  // stays centered. The image (width 100% + aspectRatio) drives the panel size —
  // putting aspectRatio on the image, not the flex container, avoids the Yoga
  // quirk where stretch+aspectRatio collapses the width and left-aligns it.
  headerRow: { width: '100%', alignItems: 'center', marginTop: Spacing.five },
  headerPanel: {},
  headerImg: { width: '100%', aspectRatio: 891 / 287 },
  // Text overlay, centered in the card's flat area (below the scalloped awning).
  headerTextWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: '6%',
    gap: 4,
  },
  headerTitle: { fontSize: 19, fontWeight: '800', color: P.brown, letterSpacing: 0.2, textAlign: 'center' },
  headerSubtitle: { fontSize: 11, color: P.mutedBrown, fontWeight: '500', textAlign: 'center' },

  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: P.brown },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  foodCard: {
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
  foodCardActive: {
    borderColor: P.pink,
    backgroundColor: '#FFF4F6',
    shadowColor: P.pink,
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  foodCardLocked: {
    borderColor: P.pinkSoft,
    backgroundColor: '#FBF6F2',
  },
  lockedImg: { opacity: 0.45 },
  lockedBtn: {
    marginTop: 6,
    backgroundColor: P.button,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  lockedBtnText: { fontSize: 11, color: '#fff', fontWeight: '800' },
  imageWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  foodImg: { width: 96, height: 96 },
  madeBadge: {
    position: 'absolute', top: 6, right: 6, zIndex: 2,
    backgroundColor: '#E88AA0', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
  },
  madeBadgeText: { fontSize: 10, color: '#fff', fontWeight: '700' },
  madeBadgeBtn: {
    position: 'absolute', top: 4, right: 4, zIndex: 2,
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: '#fff',
    backgroundColor: '#FBD9E0',
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  madeBadgeImg: { width: '100%', height: '100%' },
  // Zoomed-in badge viewer
  zoomBackdrop: {
    flex: 1, backgroundColor: 'rgba(60,40,30,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.four,
  },
  zoomCard: {
    backgroundColor: P.card, borderRadius: 28, padding: Spacing.four,
    alignItems: 'center', gap: Spacing.two,
    borderWidth: 1.5, borderColor: '#F4C5A8',
  },
  zoomBadgeImg: { width: 170, height: 170, borderRadius: 20 },
  zoomHint: { fontSize: 12.5, color: P.mutedBrown, fontWeight: '600' },
  // Empty placeholder circle shown top-right until the recipe is baked.
  badgeSlotEmpty: {
    position: 'absolute', top: 4, right: 4, zIndex: 2,
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: P.pinkSoft,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  foodName: { fontSize: 15, fontWeight: '800', color: P.brown, textAlign: 'center' },
  foodOwner: { fontSize: 10, fontWeight: '700', color: P.pinkActiveText, textAlign: 'center', marginTop: 1 },
  foodDesc: { fontSize: 11, color: P.mutedBrown, textAlign: 'center', lineHeight: 15 },
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
  selectBtn: {
    marginTop: 6,
    backgroundColor: P.pink,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  selectBtnText: { fontSize: 12, color: '#fff', fontWeight: '800' },

  infoCard: {
    backgroundColor: P.pinkSoft,
    borderRadius: 18,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: P.pink,
  },
  infoText: { fontSize: 12.5, color: P.brown, textAlign: 'center', lineHeight: 18, fontWeight: '500' },

  doneButton: {
    backgroundColor: P.pink,
    borderRadius: 18,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  doneButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },

  pressed: { opacity: 0.85 },
});
