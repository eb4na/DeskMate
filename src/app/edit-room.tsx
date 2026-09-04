import { Image } from 'expo-image';
import { formatCoins } from '@/constants/placeholder-data';
import { router } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinAmount, CoinIcon } from '@/components/coin-icon';
import { LockOverlay } from '@/components/lock-badge';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { showPopup } from '@/lib/popup';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { useTranslation } from '@/i18n';
import {
  ROOM_PAIRS,
  backgroundOwned,
  deskOwned,
  isPairOwned,
  roomHasPair,
  type RoomPair,
} from '@/constants/room-data';
import { SHOP_ITEMS } from '@/constants/shop-data';
import { localizeShopItemName, localizeShopItemDescription } from '@/lib/companion-utils';
import { Fonts, MIN_POPUP_WIDTH, Spacing } from '@/constants/theme';
import { useReportModalTransition } from '@/lib/modal-traffic';

type BuyTarget = { room: RoomPair; kind: 'background' | 'desk' | 'pair' };

const getShopItem = (id: string) => SHOP_ITEMS.find((s) => s.id === id);

const P = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F7A7B8',
  pinkSoft: '#FBD9E0',
  peach: '#F4C5A8',
  brown: '#5B3A2E',
  mutedBrown: '#9A7B6D',
  jam: '#E48A9A',
  button: '#8A7A60',
} as const;

export default function EditRoomScreen() {
  const { t } = useTranslation();
  // Tablet: scale text + cards up, and widen the centered column so the 2-up room
  // grid spreads out instead of sitting tiny in the middle of a 13" iPad.
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const {
    equippedBackgroundRoomId,
    equippedDeskRoomId,
    setEquippedBackground,
    setEquippedDesk,
    ownedShopItems,
    coins,
    isPlus,
    purchaseShopItem,
  } = useApp();

  // When the player taps something they don't own yet, we pop a little purchase
  // sheet for that exact item instead of sending them off to the Shop.
  const [buyTarget, setBuyTarget] = useState<BuyTarget | null>(null);
  useReportModalTransition(buyTarget !== null);
  // Info-badge popup. A plain in-screen overlay (NOT a native <Modal> and NOT the
  // root showPopup host): this screen is itself a natively-presented modal, so a
  // root-hosted popup can fail to present above it. Same pattern as the gallery's
  // lore popup.
  const [infoPop, setInfoPop] = useState<{ title: string; message: string } | null>(null);
  const discount = isPlus ? 0.75 : 1;

  // Picking the pair applies BOTH halves at once.
  const usePair = (room: RoomPair) => {
    if (isPairOwned(room, ownedShopItems)) {
      setEquippedBackground(room.id);
      setEquippedDesk(room.id);
    } else {
      setBuyTarget({ room, kind: 'pair' });
    }
  };

  // The locked, purchasable shop items the current target still needs.
  const targetItems = (() => {
    if (!buyTarget) return [];
    const { room, kind } = buyTarget;
    const ids =
      kind === 'background' ? [room.backgroundId]
      : kind === 'desk' ? [room.deskId]
      : [room.backgroundId, room.deskId];
    return ids
      .filter((id): id is string => !!id && !ownedShopItems.includes(id))
      .map(getShopItem)
      .filter((it): it is NonNullable<typeof it> => !!it);
  })();
  const targetTotal = targetItems.reduce((sum, it) => sum + Math.floor(it.price * discount), 0);
  const canAffordTarget = coins >= targetTotal;

  const confirmBuy = () => {
    if (!buyTarget) return;
    if (!canAffordTarget) {
      showPopup(t('gallery.notEnoughCoins'), t('gallery.notEnoughCoinsMsg', { price: targetTotal, coins }));
      return;
    }
    for (const it of targetItems) purchaseShopItem(it.id, Math.floor(it.price * discount));
    // They tapped it to use it — so equip the half (or both) right away.
    if (buyTarget.kind !== 'desk') setEquippedBackground(buyTarget.room.id);
    if (buyTarget.kind !== 'background') setEquippedDesk(buyTarget.room.id);
    setBuyTarget(null);
  };

  // Localized display name for a room's half. Shop-backed halves are named by their
  // shop item (shopNames.<id>, translated in all langs); the default Cozy Bakery has
  // no item, so it falls back to its room-level name (roomNames.<id>). Pass the
  // background id when a whole pair needs one label.
  const roomLabel = (room: RoomPair, itemId: string | null) => {
    const item = itemId ? getShopItem(itemId) : undefined;
    return item ? localizeShopItemName(item, t) : t(`roomNames.${room.id}`, { defaultValue: room.name });
  };

  const PairButton = ({ room }: { room: RoomPair }) =>
    roomHasPair(room) ? (
      <Pressable
        style={styles.pairBtn}
        hitSlop={8}
        onPress={(e) => { e.stopPropagation?.(); usePair(room); }}>
        <View style={styles.pairGlyph}>
          <View style={styles.pairRing} />
          <View style={[styles.pairRing, styles.pairRing2]} />
        </View>
      </Pressable>
    ) : null;

  // Info badge — top-right of a card; shows the item's shop description (same
  // little "i" badge as the wardrobe lore badge in the gallery).
  const InfoButton = ({ room, itemId }: { room: RoomPair; itemId: string | null }) => {
    const item = itemId ? getShopItem(itemId) : undefined;
    // Shop-backed rooms describe themselves through their item; the default Cozy
    // Bakery has no item, so it falls back to its own room-level description.
    const title = roomLabel(room, itemId);
    const desc = item
      ? localizeShopItemDescription(item, t)
      : room.description ? t(`roomDescs.${room.id}`, { defaultValue: room.description }) : '';
    if (!desc) return null;
    return (
      <Pressable
        style={styles.infoBtn}
        hitSlop={8}
        onPress={(e) => {
          e.stopPropagation?.();
          setInfoPop({ title, message: desc });
        }}>
        <Text style={styles.infoBtnText}>i</Text>
      </Pressable>
    );
  };

  const Card = ({
    room,
    itemId,
    image,
    owned,
    active,
    onPress,
    onLocked,
  }: {
    room: RoomPair;
    itemId: string | null;
    image: number;
    owned: boolean;
    active: boolean;
    onPress: () => void;
    onLocked: () => void;
  }) => (
    <Pressable
      style={[styles.thumb, active && styles.thumbActive, !owned && styles.thumbLocked]}
      onPress={owned ? onPress : onLocked}>
      <Image source={image} style={styles.thumbImg} contentFit="cover" />
      {!owned && <LockOverlay size={Math.round(20 * scale)} radius={Math.round(10 * scale)} />}
    </Pressable>
  );

  // What the preview shows: the equipped pair.
  const previewBg = ROOM_PAIRS.find((r) => r.id === equippedBackgroundRoomId) ?? ROOM_PAIRS[0];
  const previewDesk = ROOM_PAIRS.find((r) => r.id === equippedDeskRoomId) ?? null;

  // Only rooms with a distinct desk show in the Desk list (others share the default).
  // Only show rooms the player owns — locked items live in the Shop, not here.
  const backgroundRooms = ROOM_PAIRS.filter((r) => backgroundOwned(r, ownedShopItems));
  const deskRooms = ROOM_PAIRS.filter((r) => (r.id === 'cozy' || r.deskId) && deskOwned(r, ownedShopItems));

  return (
    <ThemedView style={[styles.container, { backgroundColor: P.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safe}>
          {/* Header — big bubbly title + subtitle on the plain cream background. */}
          <View style={styles.headerRow}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>{t('editRoom.editRoom')}</Text>
              {/* Render the subtitle with the actual pair button glyph spliced
                  in where the {link} marker sits (instead of a link emoji). */}
              <View style={styles.subtitleRow}>
                {t('editRoom.subtitle').split('{link}').map((part, i) => (
                  <Fragment key={i}>
                    {i > 0 && (
                      <View style={styles.subtitleBtn}>
                        <View style={styles.subtitleGlyph}>
                          <View style={styles.subtitleRing} />
                          <View style={[styles.subtitleRing, styles.subtitleRing2]} />
                        </View>
                      </View>
                    )}
                    {part !== '' && <Text style={styles.subtitle}>{part}</Text>}
                  </Fragment>
                ))}
              </View>
            </View>
          </View>

          {/* The room as it will actually look — background with the chosen desk
              across the bottom. The old screen showed the two as separate cards,
              so you never saw the pair you were assembling. */}
          {previewBg && (
            <View style={styles.preview}>
              <Image source={previewBg.backgroundImage} style={styles.previewImg} contentFit="cover" />
              {previewDesk?.deskImage && (
                <Image source={previewDesk.deskImage} style={styles.previewDesk} contentFit="cover" />
              )}
              <View style={styles.previewName}>
                <Text style={styles.previewNameText} numberOfLines={1}>
                  {roomLabel(previewBg, previewBg.backgroundId)}
                </Text>
              </View>
              {/* Both badges act on the previewed room, so they only need to exist
                  once here rather than on every thumbnail. */}
              <PairButton room={previewBg} />
              <InfoButton room={previewBg} itemId={previewBg.backgroundId} />
            </View>
          )}

          <Text style={styles.sectionTitle}>{t('editRoom.background')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {backgroundRooms.map((room) => (
              <Card
                key={room.id}
                room={room}
                itemId={room.backgroundId}
                image={room.backgroundImage}
                owned={backgroundOwned(room, ownedShopItems)}
                active={equippedBackgroundRoomId === room.id}
                onPress={() => setEquippedBackground(room.id)}
                onLocked={() => setBuyTarget({ room, kind: 'background' })}
              />
            ))}
          </ScrollView>

          <Text style={styles.sectionTitle}>{t('editRoom.desk')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {deskRooms.map((room) => (
              <Card
                key={room.id}
                room={room}
                itemId={room.deskId}
                image={room.deskImage!/* deskRooms filter excludes deskless rooms */}
                owned={deskOwned(room, ownedShopItems)}
                active={equippedDeskRoomId === room.id}
                onPress={() => setEquippedDesk(room.id)}
                onLocked={() => setBuyTarget({ room, kind: 'desk' })}
              />
            ))}
          </ScrollView>

          <Text style={styles.sectionTitle}>{t('editRoom.effect')}</Text>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonTitle}>{t('editRoom.noEffects')}</Text>
            <Text style={styles.comingSoonText}>{t('editRoom.effectsSoon')}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Text style={styles.doneText}>{t('common.done')}</Text>
          </Pressable>
        </SafeAreaView>
      </ScrollView>

      {/* In-place purchase sheet for the exact item the player tapped. */}
      <Modal
        visible={buyTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setBuyTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBuyTarget(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation?.()}>
            {buyTarget && (
              <>
                <Text style={styles.modalTitle}>
                  {buyTarget.kind === 'pair'
                    ? t('editRoom.unlockPair', { name: roomLabel(buyTarget.room, buyTarget.room.backgroundId) })
                    : buyTarget.kind === 'desk' ? t('editRoom.unlockDesk') : t('editRoom.unlockBackground')}
                </Text>

                <View style={styles.modalItems}>
                  {targetItems.map((it) => (
                    <View key={it.id} style={styles.modalItem}>
                      {it.image ? (
                        <Image source={it.image} style={styles.modalItemImg} contentFit="cover" />
                      ) : (
                        <Text style={styles.modalItemEmoji}>{it.emoji}</Text>
                      )}
                      <View style={styles.modalItemInfo}>
                        <Text style={styles.modalItemName} numberOfLines={1}>{localizeShopItemName(it, t)}</Text>
                        {!!it.description && (
                          <Text style={styles.modalItemDesc} numberOfLines={2}>{localizeShopItemDescription(it, t)}</Text>
                        )}
                      </View>
                      <CoinAmount amount={Math.floor(it.price * discount)} size={Math.round(20 * scale)} textStyle={styles.modalItemPrice} />
                    </View>
                  ))}
                </View>

                <View style={styles.modalBalanceRow}>
                  <Text style={styles.modalBalanceLabel}>{t('editRoom.yourBalance')}</Text>
                  <View style={styles.modalBalance}>
                    <CoinIcon size={Math.round(20 * scale)} />
                    <Text style={styles.modalBalanceNum}>{formatCoins(coins)}</Text>
                  </View>
                </View>

                {!canAffordTarget && (
                  <Text style={styles.modalShortfall}>
                    {t('gallery.shortfall', { count: targetTotal - coins })}
                  </Text>
                )}

                <Pressable
                  style={({ pressed }) => [
                    styles.buyBtn,
                    !canAffordTarget && styles.buyBtnDisabled,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={confirmBuy}>
                  <Text style={styles.buyBtnText}>
                    {canAffordTarget ? t('gallery.unlockForCoins', { price: targetTotal }) : t('gallery.notEnoughCoins')}
                  </Text>
                </Pressable>
                <Pressable style={styles.cancelBtn} onPress={() => setBuyTarget(null)}>
                  <Text style={styles.cancelText}>{t('gallery.maybeLater')}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Info popup — in-screen overlay (see infoPop note above). */}
      {infoPop && (
        <Pressable style={styles.infoOverlay} onPress={() => setInfoPop(null)}>
          <Pressable style={styles.infoCard} onPress={(e) => e.stopPropagation?.()}>
            <Text style={styles.infoTitle}>{infoPop.title}</Text>
            <Text style={styles.infoMessage}>{infoPop.message}</Text>
            <Pressable
              style={({ pressed }) => [styles.infoOkBtn, pressed && { opacity: 0.85 }]}
              onPress={() => setInfoPop(null)}>
              <Text style={styles.infoOkText}>{t('common.ok')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
    </ThemedView>
  );
}

// `s` = shared tablet scale (1 on phone). Every font/card/image/spacing literal × s,
// and the centered column uses the wider tablet `contentWidth`, so the 2-up room
// grid + text scale up instead of sitting tiny on a 13" iPad.
const makeStyles = (s: number, contentWidth: number) => StyleSheet.create({
  container: { flex: 1 },
  safe: {
    padding: Spacing.four * s,
    maxWidth: contentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three * s,
  },
  // Header — big bubbly title + subtitle on the plain cream background.
  headerRow: { width: '100%', alignItems: 'center' },
  headerTextWrap: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: Spacing.three * s,
    paddingBottom: Spacing.two * s,
    paddingHorizontal: '8%',
    gap: 6 * s,
  },
  title: {
    fontFamily: Fonts.rounded,
    fontSize: 38 * s,
    fontWeight: '900',
    color: P.brown,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  subtitle: { fontSize: 12.5 * s, color: P.mutedBrown, fontWeight: '500', textAlign: 'center', lineHeight: 17 * s },
  // Subtitle laid out as a wrapping row so the real pair button can sit inline.
  subtitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  // A mini copy of `pairBtn` rendered inline within the subtitle text.
  subtitleBtn: {
    width: 26 * s, height: 20 * s, borderRadius: 10 * s,
    backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1.5, borderColor: P.jam,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 3 * s,
  },
  subtitleGlyph: { width: 16 * s, height: 9 * s, justifyContent: 'center' },
  subtitleRing: {
    position: 'absolute', width: 9 * s, height: 9 * s, borderRadius: 5 * s,
    borderWidth: 1.6, borderColor: P.jam, left: 0,
  },
  subtitleRing2: { left: 7 * s },
  sectionTitle: { fontSize: 16 * s, fontWeight: '800', color: P.brown, marginTop: Spacing.one * s },
  // A strip, not a wrapping grid: the thumbnails scroll sideways under the preview.
  row: { flexDirection: 'row', gap: Spacing.two * s, paddingRight: Spacing.three * s },

  // ── The composed preview ────────────────────────────────────────────────
  preview: {
    width: '100%', aspectRatio: 16 / 11, borderRadius: 18 * s, overflow: 'hidden',
    borderWidth: 2, borderColor: P.pinkSoft, backgroundColor: P.pinkSoft,
  },
  previewImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // The desk sits across the bottom the way it does in the room itself.
  previewDesk: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '32%' },
  previewName: {
    position: 'absolute', left: 10 * s, bottom: 10 * s,
    backgroundColor: 'rgba(255,253,251,0.94)', borderRadius: 10 * s,
    paddingHorizontal: 10 * s, paddingVertical: 4 * s, maxWidth: '70%',
  },
  previewNameText: { fontSize: 13 * s, fontWeight: '800', color: P.brown },

  // ── Strip thumbnails ────────────────────────────────────────────────────
  thumb: {
    width: 56 * s, height: 56 * s, borderRadius: 12 * s, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent', backgroundColor: P.pinkSoft,
  },
  thumbActive: { borderColor: P.pink },
  thumbLocked: { opacity: 0.5 },
  thumbCard: {
    width: '47%',
    backgroundColor: P.card,
    borderRadius: 18 * s,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    padding: Spacing.two * s,
    alignItems: 'center',
    gap: 4 * s,
  },
  thumbCardActive: { borderColor: P.pink, backgroundColor: '#FFF4F6' },
  thumbCardLocked: { opacity: 0.92 },
  thumbImgWrap: { width: '100%', height: 96 * s, borderRadius: 12 * s, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%', backgroundColor: P.pinkSoft },
  // Pair button — top-left of a card that has a matching desk+background.
  pairBtn: {
    position: 'absolute', top: 12 * s, left: 12 * s, zIndex: 2,
    width: 30 * s, height: 28 * s, borderRadius: 14 * s,
    backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1.5, borderColor: P.jam,
    alignItems: 'center', justifyContent: 'center',
  },
  pairGlyph: { width: 20 * s, height: 12 * s, justifyContent: 'center' },
  pairRing: {
    position: 'absolute', width: 11 * s, height: 11 * s, borderRadius: 6 * s,
    borderWidth: 2, borderColor: P.jam, left: 0,
  },
  pairRing2: { left: 8 * s },
  // Info badge — top-right of a card; same look as the gallery's wardrobe lore badge.
  infoBtn: {
    position: 'absolute', top: 12 * s, right: 12 * s, zIndex: 2,
    width: 22 * s, height: 22 * s, borderRadius: 11 * s,
    backgroundColor: P.pink,
    alignItems: 'center', justifyContent: 'center',
  },
  infoBtnText: { color: '#fff', fontSize: 11 * s, fontWeight: '800', lineHeight: 14 * s },
  // Info popup overlay — covers the whole (modally presented) screen.
  infoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
    backgroundColor: 'rgba(91,58,46,0.18)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  infoCard: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: 340 * s, backgroundColor: P.card,
    borderRadius: 26 * s, padding: Spacing.four * s, gap: Spacing.three * s,
    borderWidth: 1.5, borderColor: P.peach,
    shadowColor: '#5B3A2E', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  infoTitle: { fontSize: 19 * s, fontWeight: '800', color: P.brown, textAlign: 'center' },
  infoMessage: { fontSize: 14 * s, fontWeight: '600', color: P.mutedBrown, textAlign: 'center', lineHeight: 20 * s },
  infoOkBtn: { backgroundColor: P.pink, borderRadius: 18 * s, paddingVertical: Spacing.three * s, alignItems: 'center' },
  infoOkText: { color: '#FFF', fontSize: 16 * s, fontWeight: '800' },
  thumbName: { fontSize: 13 * s, fontWeight: '800', color: P.brown },
  activePill: {
    backgroundColor: '#DCF3EF', borderRadius: 999, paddingHorizontal: 12 * s, paddingVertical: 4 * s,
    borderWidth: 1.5, borderColor: '#7FCFC4',
  },
  activePillText: { fontSize: 11 * s, color: '#2E9C8E', fontWeight: '800' },
  tapText: { fontSize: 11.5 * s, color: P.mutedBrown, fontWeight: '600' },
  lockedText: { fontSize: 11.5 * s, color: P.pink, fontWeight: '800' },
  comingSoon: {
    backgroundColor: P.card, borderRadius: 18 * s, borderWidth: 1.5, borderColor: P.pinkSoft,
    padding: Spacing.four * s, alignItems: 'center', gap: 4 * s,
  },
  comingSoonTitle: { fontSize: 15 * s, fontWeight: '800', color: P.brown },
  comingSoonText: { fontSize: 12.5 * s, color: P.mutedBrown, textAlign: 'center' },
  doneBtn: {
    backgroundColor: '#F7A7B8', borderRadius: 18 * s, paddingVertical: Spacing.three * s,
    alignItems: 'center', marginTop: Spacing.two * s,
  },
  doneText: { color: '#FFF', fontSize: 17 * s, fontWeight: '800' },

  // Purchase sheet
  modalBackdrop: {
    flex: 1, backgroundColor: 'transparent',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: 360 * s, backgroundColor: P.card, borderRadius: 26 * s,
    padding: Spacing.four * s, gap: Spacing.three * s, borderWidth: 1.5, borderColor: P.peach,
  },
  modalTitle: { fontSize: 19 * s, fontWeight: '800', color: P.brown, textAlign: 'center' },
  modalItems: { gap: Spacing.two * s },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two * s,
    backgroundColor: P.cream, borderRadius: 16 * s, padding: Spacing.two * s,
    borderWidth: 1.5, borderColor: P.pinkSoft,
  },
  modalItemImg: { width: 52 * s, height: 52 * s, borderRadius: 10 * s, backgroundColor: P.pinkSoft },
  modalItemEmoji: { fontSize: 40 * s, width: 52 * s, textAlign: 'center' },
  modalItemInfo: { flex: 1, gap: 2 * s },
  modalItemName: { fontSize: 14.5 * s, fontWeight: '800', color: P.brown },
  modalItemDesc: { fontSize: 11.5 * s, color: P.mutedBrown, lineHeight: 15 * s },
  modalItemPrice: { fontSize: 15 * s, fontWeight: '800', color: P.brown },
  modalBalanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalBalanceLabel: { fontSize: 13 * s, fontWeight: '600', color: P.mutedBrown },
  modalBalance: { flexDirection: 'row', alignItems: 'center', gap: 4 * s },
  modalBalanceNum: { fontSize: 15 * s, fontWeight: '800', color: P.brown },
  modalShortfall: { fontSize: 12.5 * s, color: P.jam, fontWeight: '700', textAlign: 'center' },
  buyBtn: {
    backgroundColor: P.pink, borderRadius: 18 * s, paddingVertical: Spacing.three * s, alignItems: 'center',
  },
  buyBtnDisabled: { backgroundColor: P.pinkSoft },
  buyBtnText: { color: '#FFF', fontSize: 16 * s, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: 4 * s },
  cancelText: { fontSize: 13.5 * s, color: P.mutedBrown, fontWeight: '700' },
});
