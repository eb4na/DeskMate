import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinAmount, CoinIcon } from '@/components/coin-icon';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
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
import { MaxContentWidth, Spacing } from '@/constants/theme';

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
  const discount = isPlus ? 0.8 : 1;

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
    if (!buyTarget || !canAffordTarget) return;
    for (const it of targetItems) purchaseShopItem(it.id, Math.floor(it.price * discount));
    // They tapped it to use it — so equip the half (or both) right away.
    if (buyTarget.kind !== 'desk') setEquippedBackground(buyTarget.room.id);
    if (buyTarget.kind !== 'background') setEquippedDesk(buyTarget.room.id);
    setBuyTarget(null);
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

  const Card = ({
    room,
    image,
    owned,
    active,
    onPress,
    onLocked,
  }: {
    room: RoomPair;
    image: number;
    owned: boolean;
    active: boolean;
    onPress: () => void;
    onLocked: () => void;
  }) => (
    <Pressable
      style={[styles.thumbCard, active && styles.thumbCardActive, !owned && styles.thumbCardLocked]}
      onPress={owned ? onPress : onLocked}>
      <PairButton room={room} />
      <Image source={image} style={styles.thumbImg} contentFit="cover" />
      {!owned && <View style={styles.lockBadge}><Text style={styles.lockText}></Text></View>}
      <Text style={styles.thumbName} numberOfLines={1}>{room.name}</Text>
      {active ? (
        <View style={styles.activePill}><Text style={styles.activePillText}>{t('editRoom.inUse')}</Text></View>
      ) : owned ? (
        <Text style={styles.tapText}>{t('editRoom.tapToUse')}</Text>
      ) : (
        <Text style={styles.lockedText}>{t('editRoom.tapToUnlock')}</Text>
      )}
    </Pressable>
  );

  // Only rooms with a distinct desk show in the Desk list (others share the default).
  // Only show rooms the player owns — locked items live in the Shop, not here.
  const backgroundRooms = ROOM_PAIRS.filter((r) => backgroundOwned(r, ownedShopItems));
  const deskRooms = ROOM_PAIRS.filter((r) => (r.id === 'cozy' || r.deskId) && deskOwned(r, ownedShopItems));

  return (
    <ThemedView style={[styles.container, { backgroundColor: P.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('editRoom.editRoom')}</Text>
            {/* Render the subtitle with the actual pair button glyph spliced in
                where the {link} marker sits (instead of a link emoji). */}
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

          <Text style={styles.sectionTitle}>{t('editRoom.background')}</Text>
          <View style={styles.row}>
            {backgroundRooms.map((room) => (
              <Card
                key={room.id}
                room={room}
                image={room.backgroundImage}
                owned={backgroundOwned(room, ownedShopItems)}
                active={equippedBackgroundRoomId === room.id}
                onPress={() => setEquippedBackground(room.id)}
                onLocked={() => setBuyTarget({ room, kind: 'background' })}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>{t('editRoom.desk')}</Text>
          <View style={styles.row}>
            {deskRooms.map((room) => (
              <Card
                key={room.id}
                room={room}
                image={room.deskImage}
                owned={deskOwned(room, ownedShopItems)}
                active={equippedDeskRoomId === room.id}
                onPress={() => setEquippedDesk(room.id)}
                onLocked={() => setBuyTarget({ room, kind: 'desk' })}
              />
            ))}
          </View>

          <Text style={styles.sectionTitle}>{t('editRoom.effect')}</Text>
          <View style={styles.comingSoon}>
            <Text style={styles.comingSoonEmoji}></Text>
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
                    ? t('editRoom.unlockPair', { name: buyTarget.room.name })
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
                        <Text style={styles.modalItemName} numberOfLines={1}>{it.name}</Text>
                        {!!it.description && (
                          <Text style={styles.modalItemDesc} numberOfLines={2}>{it.description}</Text>
                        )}
                      </View>
                      <CoinAmount amount={Math.floor(it.price * discount)} size={20} textStyle={styles.modalItemPrice} />
                    </View>
                  ))}
                </View>

                <View style={styles.modalBalanceRow}>
                  <Text style={styles.modalBalanceLabel}>{t('editRoom.yourBalance')}</Text>
                  <View style={styles.modalBalance}>
                    <CoinIcon size={20} />
                    <Text style={styles.modalBalanceNum}>{coins}</Text>
                  </View>
                </View>

                {!canAffordTarget && (
                  <Text style={styles.modalShortfall}>
                    {t('gallery.shortfall', { count: targetTotal - coins })}
                  </Text>
                )}

                <Pressable
                  disabled={!canAffordTarget}
                  style={({ pressed }) => [
                    styles.buyBtn,
                    !canAffordTarget && styles.buyBtnDisabled,
                    pressed && canAffordTarget && { opacity: 0.85 },
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  header: {
    backgroundColor: P.card,
    borderRadius: 22,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: P.peach,
    alignItems: 'center',
    gap: 4,
  },
  title: { fontSize: 22, fontWeight: '800', color: P.brown },
  subtitle: { fontSize: 12.5, color: P.mutedBrown, fontWeight: '500', textAlign: 'center', lineHeight: 17 },
  // Subtitle laid out as a wrapping row so the real pair button can sit inline.
  subtitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  // A mini copy of `pairBtn` rendered inline within the subtitle text.
  subtitleBtn: {
    width: 26, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1.5, borderColor: P.jam,
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 3,
  },
  subtitleGlyph: { width: 16, height: 9, justifyContent: 'center' },
  subtitleRing: {
    position: 'absolute', width: 9, height: 9, borderRadius: 5,
    borderWidth: 1.6, borderColor: P.jam, left: 0,
  },
  subtitleRing2: { left: 7 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: P.brown, marginTop: Spacing.one },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  thumbCard: {
    width: '47%',
    backgroundColor: P.card,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    padding: Spacing.two,
    alignItems: 'center',
    gap: 4,
  },
  thumbCardActive: { borderColor: P.pink, backgroundColor: '#FFF4F6' },
  thumbCardLocked: { opacity: 0.92 },
  thumbImg: { width: '100%', height: 96, borderRadius: 12, backgroundColor: P.pinkSoft },
  lockBadge: {
    position: 'absolute', top: 14, right: 14,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1.5, borderColor: P.pink,
    alignItems: 'center', justifyContent: 'center',
  },
  lockText: { fontSize: 14 },
  // Pair button — top-left of a card that has a matching desk+background.
  pairBtn: {
    position: 'absolute', top: 12, left: 12, zIndex: 2,
    width: 30, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1.5, borderColor: P.jam,
    alignItems: 'center', justifyContent: 'center',
  },
  pairGlyph: { width: 20, height: 12, justifyContent: 'center' },
  pairRing: {
    position: 'absolute', width: 11, height: 11, borderRadius: 6,
    borderWidth: 2, borderColor: P.jam, left: 0,
  },
  pairRing2: { left: 8 },
  thumbName: { fontSize: 13, fontWeight: '800', color: P.brown },
  activePill: {
    backgroundColor: '#DCF3EF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1.5, borderColor: '#7FCFC4',
  },
  activePillText: { fontSize: 11, color: '#2E9C8E', fontWeight: '800' },
  tapText: { fontSize: 11.5, color: P.mutedBrown, fontWeight: '600' },
  lockedText: { fontSize: 11.5, color: P.pink, fontWeight: '800' },
  comingSoon: {
    backgroundColor: P.card, borderRadius: 18, borderWidth: 1.5, borderColor: P.pinkSoft,
    padding: Spacing.four, alignItems: 'center', gap: 4,
  },
  comingSoonEmoji: { fontSize: 36 },
  comingSoonTitle: { fontSize: 15, fontWeight: '800', color: P.brown },
  comingSoonText: { fontSize: 12.5, color: P.mutedBrown, textAlign: 'center' },
  doneBtn: {
    backgroundColor: '#F7A7B8', borderRadius: 18, paddingVertical: Spacing.three,
    alignItems: 'center', marginTop: Spacing.two,
  },
  doneText: { color: '#FFF', fontSize: 17, fontWeight: '800' },

  // Purchase sheet
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(60,40,30,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', maxWidth: 360, backgroundColor: P.card, borderRadius: 26,
    padding: Spacing.four, gap: Spacing.three, borderWidth: 1.5, borderColor: P.peach,
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: P.brown, textAlign: 'center' },
  modalItems: { gap: Spacing.two },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
    backgroundColor: P.cream, borderRadius: 16, padding: Spacing.two,
    borderWidth: 1.5, borderColor: P.pinkSoft,
  },
  modalItemImg: { width: 52, height: 52, borderRadius: 10, backgroundColor: P.pinkSoft },
  modalItemEmoji: { fontSize: 40, width: 52, textAlign: 'center' },
  modalItemInfo: { flex: 1, gap: 2 },
  modalItemName: { fontSize: 14.5, fontWeight: '800', color: P.brown },
  modalItemDesc: { fontSize: 11.5, color: P.mutedBrown, lineHeight: 15 },
  modalItemPrice: { fontSize: 15, fontWeight: '800', color: P.brown },
  modalBalanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalBalanceLabel: { fontSize: 13, fontWeight: '600', color: P.mutedBrown },
  modalBalance: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modalBalanceNum: { fontSize: 15, fontWeight: '800', color: P.brown },
  modalShortfall: { fontSize: 12.5, color: P.jam, fontWeight: '700', textAlign: 'center' },
  buyBtn: {
    backgroundColor: P.pink, borderRadius: 18, paddingVertical: Spacing.three, alignItems: 'center',
  },
  buyBtnDisabled: { backgroundColor: P.pinkSoft },
  buyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', paddingVertical: 4 },
  cancelText: { fontSize: 13.5, color: P.mutedBrown, fontWeight: '700' },
});
