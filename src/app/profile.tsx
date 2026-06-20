/**
 * Profile ID card — a shareable "study buddy" card.
 * Left: a little scene (chosen app background + the active companion/outfit).
 * Right: display name, streaks, hours studied, birthday, description.
 * Bottom: friend code + a share button that screenshots the card.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { showPopup } from '@/lib/popup';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

const STREAK_ICON = require('@/assets/images/profile/streak-cupcake.png');
const BEST_STREAK_ICON = require('@/assets/images/profile/best-streak-cupcake.png');
const STUDIED_ICON = require('@/assets/images/profile/studied-book.png');
const BIRTHDAY_ICON = require('@/assets/images/profile/birthday-candle.png');
import { DateWheelPicker } from '@/components/date-wheel-picker';
import { useApp } from '@/context/app-context';
import i18n, { useTranslation } from '@/i18n';
import { ROOM_PAIRS, backgroundOwned } from '@/constants/room-data';
import { cardColors, CARD_COLORS, type CardColorKey } from '@/constants/card-colors';
import { ColorWheelPicker, hslToHex } from '@/components/color-wheel-picker';
import { LockBadge } from '@/components/lock-badge';
import {
  BUN_SKINS,
  type BunSkin,
  getBunSkinImage,
  getCompanionSkinImage,
  getCompanionSkins,
  getStarterActiveId,
  isBunSkinUnlocked,
  localizeCompanionName,
  resolveActiveCompanion,
  SHOP_COMPANIONS,
} from '@/lib/companion-utils';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTabletScale } from '@/hooks/use-tablet-scale';

const P = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F7A7B8',
  pinkSoft: '#FBD9E0',
  peach: '#F4C5A8',
  brown: '#5B3A2E',
  cocoa: '#7A5240',
  muted: '#9A7B6D',
  honey: '#F0B44A',
} as const;

function formatBirthday(iso: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(i18n.language || 'en-US', { month: 'long', day: 'numeric' });
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const {
    profileDisplayName,
    profileDescription,
    profileBirthday,
    profileBackgroundId,
    profileCardColor,
    profileCompanionId,
    profileSkinId,
    profileAvatarFrame,
    isPlus,
    updateProfile,
    friendCode,
    streak,
    totalMinutes,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
    ownedShopItems,
  } = useApp();
  const activeCardColor = profileCardColor || 'pink';
  const cc = cardColors(activeCardColor);
  const pinkStrip = cardColors('pink').strip;
  const cardRef = useRef<View>(null);
  // Birthday is set-once: a saved birthday renders locked (read-only). Editing is
  // only entered via the "Add birthday" flow, and committed through a confirm popup.
  const [editingBirthday, setEditingBirthday] = useState(false);
  const [birthdayDraft, setBirthdayDraft] = useState('2008-01-01');
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Cloud profile sync (name + current character + stats) runs app-wide in
  // app-context now, so friends see my character even without opening this screen.

  // Characters the player can put on their card: Bun + any owned shop companions.
  const starterId = getStarterActiveId(defaultCompanionId);
  const characters: { id: string; name: string }[] = [
    { id: starterId, name: 'Bun' },
    ...SHOP_COMPANIONS.filter((i) => ownedShopItems.includes(i.id)).map((i) => ({
      id: `shop:${i.id}`,
      name: i.name,
    })),
  ];

  // Which character/outfit the card shows (falls back to the active companion).
  const selectedCharId = profileCompanionId || activeCompanionId || starterId;
  const isBun = !selectedCharId.startsWith('shop:');
  const ownedSkins: BunSkin[] = isBun
    ? BUN_SKINS.filter((s) => isBunSkinUnlocked(s, ownedShopItems))
    : getCompanionSkins(selectedCharId).filter((s) => !s.shopItemId || ownedShopItems.includes(s.shopItemId));
  const skinId = ownedSkins.some((s) => s.id === profileSkinId) ? profileSkinId : 'classic';

  // Figure image for the card.
  const figureSource = profileCompanionId
    ? isBun
      ? getBunSkinImage(skinId)
      : getCompanionSkinImage(selectedCharId, skinId) ?? getBunSkinImage('classic')
    : resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins)
        .imageSource;

  const bgRoom = ROOM_PAIRS.find((r) => r.id === profileBackgroundId) ?? ROOM_PAIRS[0];
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const hoursLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  const name = profileDisplayName.trim() || t('profileCard.studyBuddy');

  const shareCard = async () => {
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('profileCard.shareDialogTitle') });
      } else {
        await Share.share({ url: uri });
      }
    } catch {
      showPopup(t('profileCard.shareFailTitle'), t('profileCard.shareFailMsg'));
    }
  };

  // Save the card to Photos via the system share sheet ("Save Image"). We go
  // through the sheet rather than a one-tap MediaLibrary save because
  // expo-media-library's current release is binary-incompatible with this
  // project's expo-modules-core, so the native module can't be linked.
  const saveToAlbum = async () => {
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: t('profileCard.saveToAlbum') });
      } else {
        await Share.share({ url: uri });
      }
    } catch {
      showPopup(t('profileCard.saveFailTitle'), t('profileCard.saveFailMsg'));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: P.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.screenTitle}>{t('profileCard.myCard')}</Text>

          {/* ── The ID card (captured for sharing) ───────────────────────── */}
          <View ref={cardRef} collapsable={false} style={[styles.card, { borderColor: cc.strip }]}>
            <View style={styles.cardInner}>
              {/* Left: scene */}
              <View style={styles.figurePanel}>
                <Image source={bgRoom.backgroundImage} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={styles.figureScrim} />
                <Image source={figureSource} style={styles.figureImg} contentFit="contain" />
              </View>

              {/* Right: info */}
              <View style={styles.infoPanel}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={2}>{name}</Text>
                </View>

                <View style={styles.statRow}>
                  <Image source={STREAK_ICON} style={styles.statIcon} contentFit="contain" />
                  <Text style={styles.statLabel}>{t('profileCard.currentStreak')}</Text>
                  <Text style={styles.statValue}>{streak.currentStreak}d</Text>
                </View>
                <View style={styles.statRow}>
                  <Image source={BEST_STREAK_ICON} style={styles.statIcon} contentFit="contain" />
                  <Text style={styles.statLabel}>{t('profileCard.bestStreak')}</Text>
                  <Text style={styles.statValue}>{streak.longestStreak}d</Text>
                </View>
                <View style={styles.statRow}>
                  <Image source={STUDIED_ICON} style={styles.statIcon} contentFit="contain" />
                  <Text style={styles.statLabel}>{t('profileCard.studied')}</Text>
                  <Text style={styles.statValue}>{hoursLabel}</Text>
                </View>
                <View style={styles.statRow}>
                  <Image source={BIRTHDAY_ICON} style={styles.statIcon} contentFit="contain" />
                  <Text style={styles.statLabel}>{t('profileCard.birthday')}</Text>
                  <Text style={styles.statValue}>{formatBirthday(profileBirthday)}</Text>
                </View>

                {profileDescription.trim() ? (
                  <Text style={styles.desc} numberOfLines={3}>“{profileDescription.trim()}”</Text>
                ) : null}
              </View>
            </View>

            {/* Bottom: friend code — a plain background bar; the chosen colour only
                drives the card outline + the buttons, NOT this strip. */}
            <View style={[styles.codeStrip, { backgroundColor: cc.strip }]}>
              <Text style={styles.codeStripLabel}>{t('friendCard.friendCodeLabel')}</Text>
              <Text style={styles.codeStripValue}>{friendCode}</Text>
            </View>
          </View>

          {/* Share button always pink; save button follows the chosen card colour. */}
          <Pressable style={({ pressed }) => [styles.shareBtn, { backgroundColor: pinkStrip }, pressed && styles.pressed]} onPress={shareCard}>
            <Text style={styles.shareBtnText}>{t('profileCard.shareMyCard')}</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.saveBtn, pressed && styles.pressed]} onPress={saveToAlbum}>
            <Text style={styles.saveBtnText}>{t('profileCard.saveToAlbum')}</Text>
          </Pressable>

          {/* ── Editor ────────────────────────────────────────────────────── */}
          <Text style={styles.editTitle}>{t('profileCard.editProfile')}</Text>

          {/* Card colour */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {t('profileCard.cardColor', { defaultValue: 'Card color' })}
            </Text>
            <View style={styles.colorRow}>
              <View style={[styles.colorDot, { backgroundColor: cc.strip, borderColor: cc.outline }]} />
              <Pressable
                style={({ pressed }) => [styles.changeColorBtn, pressed && styles.pressed]}
                onPress={() => isPlus ? setShowColorPicker(true) : router.push('/plus-upgrade')}>
                {!isPlus && <LockBadge size={16 * scale} />}
                <Text style={styles.changeColorText}>
                  {t('profileCard.changeColor', { defaultValue: 'Change color' })}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Colour wheel modal */}
          <Modal visible={showColorPicker} transparent animationType="fade" onRequestClose={() => setShowColorPicker(false)}>
            <Pressable style={styles.modalOverlay} onPress={() => setShowColorPicker(false)}>
              <Pressable style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  {t('profileCard.cardColor', { defaultValue: 'Card color' })}
                </Text>
                <ColorWheelPicker
                  size={Math.round(216 * scale)}
                  value={
                    activeCardColor.startsWith('#')
                      ? activeCardColor
                      : (CARD_COLORS[activeCardColor as CardColorKey]?.strip ?? '#F7A7B8')
                  }
                  onChange={(hex) => updateProfile({ cardColor: hex })}
                />
                <View style={[styles.modalPreview, { backgroundColor: cc.strip }]} />
                <Pressable
                  style={({ pressed }) => [styles.modalDoneBtn, pressed && styles.pressed]}
                  onPress={() => setShowColorPicker(false)}>
                  <Text style={styles.modalDoneText}>{t('common.done', { defaultValue: 'Done' })}</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('profileCard.displayName')}</Text>
            <TextInput
              style={styles.input}
              value={profileDisplayName}
              onChangeText={(v) => updateProfile({ displayName: v })}
              placeholder={t('profileCard.yourName')}
              placeholderTextColor={P.muted}
              maxLength={20}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('profileCard.description')}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={profileDescription}
              onChangeText={(v) => updateProfile({ description: v })}
              placeholder={t('profileCard.descPlaceholder')}
              placeholderTextColor={P.muted}
              multiline
              maxLength={120}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('profileCard.birthday')}</Text>
            {profileBirthday ? (
              // Set-once: once saved, the birthday is locked and can't be changed.
              <>
                <Text style={styles.lockedValue}>{formatBirthday(profileBirthday)}</Text>
                <Text style={styles.fieldHint}>{t('profileCard.birthdayLockedNote')}</Text>
              </>
            ) : editingBirthday ? (
              <>
                <DateWheelPicker
                  value={birthdayDraft}
                  onChange={setBirthdayDraft}
                  hideYear
                />
                <Pressable
                  style={({ pressed }) => [styles.bdaySaveBtn, pressed && styles.pressed]}
                  onPress={() =>
                    showPopup(
                      t('profileCard.birthdaySetOnceTitle'),
                      t('profileCard.birthdaySetOnceMsg', { date: formatBirthday(birthdayDraft) }),
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                          text: t('profileCard.birthdaySetOnceConfirm'),
                          onPress: () => {
                            updateProfile({ birthday: birthdayDraft });
                            setEditingBirthday(false);
                          },
                        },
                      ],
                    )
                  }>
                  <Text style={styles.bdaySaveBtnText}>{t('profileCard.birthdaySave')}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                onPress={() => setEditingBirthday(true)}>
                <Text style={styles.addBtnText}>{t('profileCard.addBirthday')}</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('profileCard.character')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bgRow}>
              {characters.map((c) => {
                const selected = c.id === selectedCharId;
                const thumb = c.id.startsWith('shop:')
                  ? getCompanionSkinImage(c.id, 'classic') ?? getBunSkinImage('classic')
                  : getBunSkinImage('classic');
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => updateProfile({ companionId: c.id, skinId: 'classic' })}
                    style={styles.charItem}>
                    <View style={[styles.charThumbWrap, selected && styles.charThumbSelected]}>
                      <Image source={thumb} style={styles.charThumb} contentFit="contain" />
                    </View>
                    <Text style={styles.charName} numberOfLines={1}>{localizeCompanionName(c.name, t)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('profileCard.outfit')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bgRow}>
              {ownedSkins.map((s) => {
                const selected = s.id === skinId;
                const img = isBun ? s.image : getCompanionSkinImage(selectedCharId, s.id) ?? s.image;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => updateProfile({ companionId: selectedCharId, skinId: s.id })}
                    style={styles.charItem}>
                    <View style={[styles.charThumbWrap, selected && styles.charThumbSelected]}>
                      <Image source={img} style={styles.charThumb} contentFit="contain" />
                    </View>
                    <Text style={styles.charName} numberOfLines={1}>{s.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={styles.bgHint}>{t('profileCard.ownedOutfitsHint')}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('profileCard.cardBackground')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bgRow}>
              {ROOM_PAIRS.filter((r) => backgroundOwned(r, ownedShopItems)).map((r) => {
                const selected = r.id === profileBackgroundId;
                return (
                  <Pressable key={r.id} onPress={() => updateProfile({ backgroundId: r.id })}>
                    <Image
                      source={r.backgroundImage}
                      style={[styles.bgThumb, selected && styles.bgThumbSelected]}
                      contentFit="cover"
                    />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <Pressable style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>{t('common.done')}</Text>
          </Pressable>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const CARD_RADIUS = 24;

const makeStyles = (s: number, contentWidth: number) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    padding: Spacing.four * s,
    maxWidth: contentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four * s,
  },
  screenTitle: { fontSize: 24 * s, fontWeight: '900', color: P.brown },

  // Card
  card: {
    backgroundColor: P.card,
    borderRadius: CARD_RADIUS * s,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    overflow: 'hidden',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardInner: { flexDirection: 'row', padding: 12 * s, gap: 12 * s },
  figurePanel: {
    width: 132 * s,
    height: 188 * s,
    borderRadius: 18 * s,
    overflow: 'hidden',
    backgroundColor: P.pinkSoft,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  figureScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.08)' },
  figureImg: { width: '116%', height: '92%', marginBottom: -6 },
  infoPanel: { flex: 1, gap: 7 * s, paddingTop: 2 * s },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 * s },
  name: { fontSize: 20 * s, fontWeight: '900', color: P.brown, lineHeight: 24 * s, flexShrink: 1 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 * s },
  statEmojiFallback: { fontSize: 15 * s, width: 16 * s, textAlign: 'center' },
  statIcon: { width: 20 * s, height: 20 * s },
  statLabel: { fontSize: 12.5 * s, color: P.muted, fontWeight: '600', flex: 1 },
  statValue: { fontSize: 13 * s, color: P.brown, fontWeight: '800' },
  desc: { fontSize: 12.5 * s, color: P.cocoa, fontStyle: 'italic', lineHeight: 17 * s, marginTop: 2 * s },

  codeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8 * s,
    backgroundColor: P.pink,
    paddingVertical: 9 * s,
  },
  codeStripLabel: { fontSize: 11 * s, fontWeight: '800', color: '#fff', letterSpacing: 1, opacity: 0.9 },
  codeStripValue: { fontSize: 16 * s, fontWeight: '900', color: '#fff', letterSpacing: 3 },

  shareBtn: {
    backgroundColor: P.pink,
    borderRadius: 16 * s,
    paddingVertical: 13 * s,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E68299',
  },
  shareBtnText: { color: '#FFFFFF', fontSize: 16 * s, fontWeight: '900' },
  saveBtn: {
    backgroundColor: P.card,
    borderRadius: 16 * s,
    paddingVertical: 12 * s,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: P.pinkSoft,
    marginTop: 8 * s,
  },
  saveBtnText: { color: P.pink, fontSize: 15 * s, fontWeight: '800' },

  // Editor
  editTitle: { fontSize: 17 * s, fontWeight: '800', color: P.brown, marginTop: Spacing.two * s },
  field: { gap: 6 * s },
  fieldLabel: { fontSize: 13 * s, fontWeight: '700', color: P.cocoa },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 * s, marginTop: 2 * s },
  swatch: { width: 38 * s, height: 38 * s, borderRadius: 19 * s, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  swatchSelected: { borderWidth: 3.5 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 * s, marginTop: 4 * s },
  colorDot: { width: 36 * s, height: 36 * s, borderRadius: 18 * s, borderWidth: 3 },
  changeColorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6 * s,
    paddingHorizontal: 16 * s, paddingVertical: 8 * s,
    borderRadius: 20 * s, backgroundColor: P.pinkSoft,
  },
  changeColorText: { fontSize: 13 * s, fontWeight: '700', color: P.brown },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  modalCard: {
    backgroundColor: '#FFF9F5', borderRadius: 24 * s, padding: 28 * s,
    alignItems: 'center', gap: 16 * s,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 8 },
  },
  modalTitle: { fontSize: 17 * s, fontWeight: '900', color: P.brown },
  modalPreview: { width: 52 * s, height: 52 * s, borderRadius: 26 * s, borderWidth: 3, borderColor: '#fff' },
  modalDoneBtn: { paddingHorizontal: 36 * s, paddingVertical: 10 * s, borderRadius: 20 * s, backgroundColor: P.pink },
  modalDoneText: { fontSize: 15 * s, fontWeight: '800', color: '#fff' },
  swatchLock: { fontSize: 13 * s },
  input: {
    borderWidth: 1.5,
    borderColor: P.peach,
    borderRadius: 14 * s,
    paddingHorizontal: 14 * s,
    paddingVertical: 11 * s,
    fontSize: 15 * s,
    color: P.brown,
    backgroundColor: P.card,
  },
  inputMultiline: { minHeight: 64 * s, textAlignVertical: 'top' },
  addBtn: {
    borderWidth: 1.5,
    borderColor: P.peach,
    borderStyle: 'dashed',
    borderRadius: 14 * s,
    paddingVertical: 11 * s,
    alignItems: 'center',
    backgroundColor: P.card,
  },
  addBtnText: { color: P.cocoa, fontWeight: '700' },
  lockedValue: { fontSize: 15 * s, fontWeight: '700', color: P.brown },
  fieldHint: { fontSize: 11 * s, color: P.muted, marginTop: 3 * s },
  bdaySaveBtn: {
    marginTop: 8 * s,
    borderRadius: 14 * s,
    paddingVertical: 11 * s,
    alignItems: 'center',
    backgroundColor: P.pink,
  },
  bdaySaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 * s },
  bgRow: { gap: 10 * s, paddingVertical: 2 * s },
  bgThumb: { width: 84 * s, height: 60 * s, borderRadius: 12 * s, borderWidth: 2, borderColor: '#fff' },
  bgThumbSelected: { borderColor: P.pink, borderWidth: 3 },
  charItem: { alignItems: 'center', gap: 4 * s, width: 72 * s },
  charThumbWrap: {
    width: 64 * s,
    height: 64 * s,
    borderRadius: 16 * s,
    backgroundColor: P.pinkSoft,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  charThumbSelected: { borderColor: P.pink, borderWidth: 3 },
  charThumb: { width: '132%', height: '132%', marginTop: -4 },
  charName: { fontSize: 11 * s, fontWeight: '700', color: P.cocoa },
  bgHint: { fontSize: 11.5 * s, color: P.muted, lineHeight: 16 * s },
  // Frame swatches — paddingTop leaves room for the crown/ears overhang so it
  // isn't clipped by the horizontal scroller.
  frameItem: { alignItems: 'center', gap: 4 * s, width: 72 * s, paddingTop: 16 * s },
  frameCircle: {
    width: 48 * s, height: 48 * s, borderRadius: 24 * s, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  frameCircleSelected: { borderColor: P.pink },
  frameAvatarClip: {
    width: 44 * s, height: 44 * s, borderRadius: 22 * s, overflow: 'hidden',
    backgroundColor: P.pinkSoft, alignItems: 'center', justifyContent: 'flex-start',
  },
  frameAvatarImg: { width: '132%', height: '132%', marginTop: -3 },
  frameLock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },

  doneBtn: {
    backgroundColor: '#F7A7B8',
    borderRadius: 18 * s,
    paddingVertical: 14 * s,
    alignItems: 'center',
    marginTop: Spacing.two * s,
  },
  doneBtnText: { color: '#fff', fontSize: 16 * s, fontWeight: '800' },
  pressed: { opacity: 0.85 },
});
