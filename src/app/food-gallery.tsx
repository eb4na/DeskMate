import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/app-context';
import { useIsTablet } from '@/hooks/use-device-class';
import { useTranslation } from '@/i18n';
import { localizeCompanionName } from '@/lib/companion-utils';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useReportModalTransition } from '@/lib/modal-traffic';

const BAKERY_BG = require('@/assets/images/backgrounds/bakery-menu.png');

// Default "made it" badge (mirrors the finish-studying receipt's fallback).
const BUN_FINISHED = require('@/assets/images/bun/bun-finished.png');

export type FoodItem = {
  id: string;
  image: number;
  // Optional alternate art shown ONLY as the desk dish while studying (a plated
  // serving of the bake). Everywhere else — the menu, finish receipt, home desk —
  // uses `image`. Falls back to `image` when undefined.
  studyImage?: number;
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
    price: 5000,
    madeBadge: require('@/assets/images/cake/pudding-badge.png'),
    owner: 'Miel',
  },
  {
    id: 'sakura-mochi',
    image: require('@/assets/images/cake/sakura-mochi.png'),
    requiresItem: 'recipe_sakura',
    price: 5000,
    madeBadge: require('@/assets/images/cake/sakura-badge.png'),
    owner: 'Cocoa',
  },
  {
    id: 'matcha-crepe',
    image: require('@/assets/images/cake/matcha-crepe.png'),
    requiresItem: 'recipe_matcha',
    price: 5000,
    madeBadge: require('@/assets/images/cake/matcha-badge.png'),
    owner: 'Tira',
  },
  {
    id: 'berry-croissant',
    image: require('@/assets/images/cake/croissant.png'),
    requiresItem: 'recipe_croissant',
    price: 5000,
    madeBadge: require('@/assets/images/cake/croissant-badge.png'),
    owner: 'Bunny',
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
  // Tablet: the art and type read tiny on a 13" iPad, so the preview scales up.
  const isTablet = useIsTablet();
  const { selectedFoodId, madeFoods, setSelectedFood, ownedShopItems } = useApp();
  // Badge image currently shown enlarged in the zoom modal (null = closed).
  const [zoomBadge, setZoomBadge] = useState<number | null>(null);
  useReportModalTransition(zoomBadge !== null);

  // What the big preview is showing. Tapping a thumbnail only previews; the
  // button under it is what actually commits (and leaves the screen), so you can
  // look through the menu without picking.
  const [previewId, setPreviewId] = useState<string>(selectedFoodId);
  const preview =
    FOOD_ITEMS.find((f) => f.id === previewId) ??
    FOOD_ITEMS.find((f) => f.id === selectedFoodId) ??
    FOOD_ITEMS[0];

  const previewLocked = !!preview?.requiresItem && !ownedShopItems.includes(preview.requiresItem);
  const previewIsSelected = !!preview && !previewLocked && selectedFoodId === preview.id;
  const previewMade = !!preview && madeFoods.includes(preview.id);

  return (
    <View style={styles.container}>
      <Image source={BAKERY_BG} style={StyleSheet.absoluteFill} contentFit="cover" pointerEvents="none" />
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header — a big bubbly title (no banner frame). */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, isTablet && { fontSize: 40, letterSpacing: 0.4 }]}>{t('foodGallery.bakeryMenu')}</Text>
          </View>

          {/* The bake you're looking at, shown big. The old screen split five
              recipes into small side-by-side cards, so the art — the thing you're
              actually choosing between — was the smallest part of each one. */}
          {preview && (
            <View style={[styles.preview, isTablet && styles.previewTablet, previewIsSelected && styles.previewActive]}>
              {/* Top-right: an empty circle on every recipe; once baked it fills
                  with the badge from the finish-studying receipt. Tappable here
                  (the thumbnails carry a read-only copy). */}
              {previewMade ? (
                <Pressable
                  style={[styles.madeBadgeBtn, isTablet && styles.madeBadgeBtnTablet]}
                  hitSlop={6}
                  onPress={() => setZoomBadge(preview.madeBadge ?? BUN_FINISHED)}>
                  <Image source={preview.madeBadge ?? BUN_FINISHED} style={styles.madeBadgeImg} contentFit="cover" />
                </Pressable>
              ) : (
                <View style={[styles.badgeSlotEmpty, isTablet && styles.madeBadgeBtnTablet]} />
              )}

              <View style={[styles.previewImgWrap, isTablet && styles.previewImgWrapTablet]}>
                <Image
                  source={preview.image}
                  style={[styles.previewImg, previewLocked && styles.lockedImg]}
                  contentFit="contain"
                />
              </View>

              <Text style={[styles.foodName, isTablet && styles.foodNameTablet]} numberOfLines={2}>
                {t(`foodGallery.food_${preview.id}`)}
              </Text>
              <Text style={[styles.foodOwner, isTablet && styles.foodOwnerTablet]} numberOfLines={1}>
                {t('foodGallery.ownerTag', { name: localizeCompanionName(preview.owner, t) })}
              </Text>
              <Text style={[styles.foodDesc, isTablet && styles.foodDescTablet]}>
                {t(`foodGallery.food_${preview.id}_desc`)}
              </Text>

              {previewLocked ? (
                <Pressable
                  style={({ pressed }) => [styles.lockedBtn, isTablet && styles.btnTablet, pressed && styles.pressed]}
                  onPress={() => router.replace({ pathname: '/shop', params: { buyItem: preview.requiresItem } })}>
                  <Text style={[styles.lockedBtnText, isTablet && styles.btnTextTablet]} numberOfLines={1}>
                    {t('foodGallery.lockedBuy', { price: preview.price ?? 0 })}
                  </Text>
                </Pressable>
              ) : previewIsSelected ? (
                <View style={[styles.activePill, isTablet && styles.btnTablet]}>
                  <Text style={[styles.activePillText, isTablet && styles.btnTextTablet]}>{t('foodGallery.baking')}</Text>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.selectBtn, isTablet && styles.btnTablet, pressed && styles.pressed]}
                  onPress={() => { setSelectedFood(preview.id); if (router.canGoBack()) router.back(); else router.replace('/'); }}>
                  <Text style={[styles.selectBtnText, isTablet && styles.btnTextTablet]}>{t('foodGallery.bakeThis')}</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* My Recipes — one swipeable row under the preview. All five fit on a
              phone without scrolling, so the strip doubles as the badge shelf for
              the collect-them-all reward. */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isTablet && { fontSize: 22 }]}>{t('foodGallery.myRecipes')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
              {FOOD_ITEMS.map((food) => {
                const locked = !!food.requiresItem && !ownedShopItems.includes(food.requiresItem);
                const isPreviewed = preview?.id === food.id;
                const isMade = madeFoods.includes(food.id);
                return (
                  <Pressable
                    key={food.id}
                    style={[
                      styles.thumb,
                      isTablet && styles.thumbTablet,
                      isPreviewed && styles.thumbActive,
                      locked && styles.thumbLocked,
                    ]}
                    onPress={() => setPreviewId(food.id)}>
                    <Image
                      source={food.image}
                      style={[styles.thumbImg, locked && styles.lockedImg]}
                      contentFit="contain"
                    />
                    {/* Read-only badge slot — zooming stays on the preview so the
                        thumbnail keeps one tap target. */}
                    <View style={[styles.thumbBadge, isTablet && styles.thumbBadgeTablet]} pointerEvents="none">
                      {isMade && (
                        <Image source={food.madeBadge ?? BUN_FINISHED} style={styles.madeBadgeImg} contentFit="cover" />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Done */}
          <Pressable
            style={({ pressed }) => [styles.doneButton, isTablet && styles.doneButtonTablet, pressed && styles.pressed]}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Text style={[styles.doneButtonText, isTablet && styles.doneButtonTextTablet]}>{t('common.done')}</Text>
          </Pressable>
        </SafeAreaView>
      </ScrollView>

      {/* Tap the preview's badge to see it enlarged. */}
      <Modal visible={zoomBadge !== null} transparent animationType="fade" onRequestClose={() => setZoomBadge(null)}>
        <Pressable style={styles.zoomBackdrop} onPress={() => setZoomBadge(null)}>
          {zoomBadge !== null && (
            <View style={styles.zoomCard}>
              <Image source={zoomBadge} style={[styles.zoomBadgeImg, isTablet && styles.zoomBadgeImgTablet]} contentFit="contain" />
              <Text style={[styles.zoomHint, isTablet && styles.zoomHintTablet]}>{t('shop.tapToClose')}</Text>
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F1' },
  scroll: { backgroundColor: 'transparent' },
  safeArea: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
    backgroundColor: 'transparent',
  },

  headerRow: { width: '100%', alignItems: 'center', marginTop: Spacing.five },
  headerTitle: { fontFamily: Fonts.rounded, fontSize: 32, fontWeight: '900', color: P.brown, letterSpacing: 0.3, textAlign: 'center' },

  section: { gap: Spacing.two },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: P.brown },

  // ── The preview ─────────────────────────────────────────────────────────
  preview: {
    width: '100%',
    backgroundColor: P.card,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    padding: Spacing.four,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#C9A18A',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  previewTablet: { borderRadius: 32, padding: Spacing.five, gap: 8 },
  // The recipe you're already baking gets the same pink halo the old card had.
  previewActive: {
    borderColor: P.pink,
    backgroundColor: '#FFF4F6',
    shadowColor: P.pink,
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  previewImgWrap: { width: 176, height: 176, alignItems: 'center', justifyContent: 'center' },
  previewImgWrapTablet: { width: 280, height: 280 },
  previewImg: { width: '100%', height: '100%' },
  lockedImg: { opacity: 0.45 },

  // ── The strip ───────────────────────────────────────────────────────────
  strip: { flexDirection: 'row', gap: Spacing.two, paddingRight: Spacing.three, paddingTop: 4 },
  thumb: {
    width: 76, height: 76, borderRadius: 18,
    borderWidth: 2, borderColor: P.pinkSoft,
    backgroundColor: P.card,
    alignItems: 'center', justifyContent: 'center',
    padding: 6,
  },
  thumbTablet: { width: 112, height: 112, borderRadius: 24, padding: 10 },
  thumbActive: { borderColor: P.pink, backgroundColor: '#FFF4F6' },
  thumbLocked: { backgroundColor: '#FBF6F2' },
  thumbImg: { width: '100%', height: '100%' },
  // Same empty-circle / filled-badge language as the preview, at strip scale.
  thumbBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#FFFFFF',
    backgroundColor: P.pinkSoft,
    overflow: 'hidden',
  },
  thumbBadgeTablet: { width: 34, height: 34, borderRadius: 17, top: -6, right: -6 },

  lockedBtn: {
    marginTop: 6,
    backgroundColor: P.button,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  lockedBtnText: { fontSize: 11, color: '#fff', fontWeight: '800' },
  madeBadgeBtn: {
    position: 'absolute', top: 10, right: 10, zIndex: 2,
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: '#fff',
    backgroundColor: '#FBD9E0',
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  madeBadgeImg: { width: '100%', height: '100%' },
  // Zoomed-in badge viewer
  zoomBackdrop: {
    flex: 1, backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.four,
  },
  zoomCard: {
    backgroundColor: P.card, borderRadius: 28, padding: Spacing.four,
    alignItems: 'center', gap: Spacing.two,
    borderWidth: 1.5, borderColor: '#F4C5A8',
  },
  zoomBadgeImg: { width: 170, height: 170, borderRadius: 20 },
  // The 13" iPad has tons of room — the 170px preview reads tiny there, so blow it up.
  zoomBadgeImgTablet: { width: 360, height: 360, borderRadius: 36 },
  zoomHint: { fontSize: 12.5, color: P.mutedBrown, fontWeight: '600' },
  zoomHintTablet: { fontSize: 18 },
  // Empty placeholder circle shown top-right until the recipe is baked.
  badgeSlotEmpty: {
    position: 'absolute', top: 10, right: 10, zIndex: 2,
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2, borderColor: P.pinkSoft,
    backgroundColor: 'rgba(255,255,255,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  foodName: { fontSize: 21, fontWeight: '800', color: P.brown, textAlign: 'center' },
  foodOwner: { fontSize: 12, fontWeight: '700', color: P.pinkActiveText, textAlign: 'center', marginTop: 1 },
  foodDesc: { fontSize: 13, color: P.mutedBrown, textAlign: 'center', lineHeight: 18, marginTop: 2 },
  activePill: {
    marginTop: 10,
    backgroundColor: P.pinkActiveSoft,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: P.pinkActive,
  },
  activePillText: { fontSize: 13, color: P.pinkActiveText, fontWeight: '800' },
  selectBtn: {
    marginTop: 10,
    backgroundColor: P.pink,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 9,
  },
  selectBtnText: { fontSize: 13, color: '#fff', fontWeight: '800' },

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

  // Tablet: bump the preview's type and buttons up for the 13" canvas.
  madeBadgeBtnTablet: { width: 64, height: 64, borderRadius: 32, top: 14, right: 14 },
  foodNameTablet: { fontSize: 30 },
  foodOwnerTablet: { fontSize: 16, marginTop: 2 },
  foodDescTablet: { fontSize: 18, lineHeight: 25 },
  btnTablet: { marginTop: 14, paddingHorizontal: 30, paddingVertical: 13 },
  btnTextTablet: { fontSize: 17 },
  doneButtonTablet: { borderRadius: 24, paddingVertical: Spacing.four },
  doneButtonTextTablet: { fontSize: 22 },

  pressed: { opacity: 0.85 },
});
