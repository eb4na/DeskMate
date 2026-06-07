/**
 * Profile ID card — a shareable "study buddy" card.
 * Left: a little scene (chosen app background + the active companion/outfit).
 * Right: display name, streaks, hours studied, birthday, description.
 * Bottom: friend code + a share button that screenshots the card.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import {
  BakeryBellEmoji,
  BakeryCakeEmoji,
  BakeryFlameEmoji,
} from '@/components/bakery-emoji';
import { DateWheelPicker } from '@/components/date-wheel-picker';
import { useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { uploadProfile } from '@/lib/profile-sync';
import { ROOM_PAIRS } from '@/constants/room-data';
import {
  BUN_SKINS,
  type BunSkin,
  getBunSkinImage,
  getCompanionSkinImage,
  getCompanionSkins,
  getStarterActiveId,
  isBunSkinUnlocked,
  resolveActiveCompanion,
  SHOP_COMPANIONS,
} from '@/lib/companion-utils';
import { MaxContentWidth, Spacing } from '@/constants/theme';

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
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export default function ProfileScreen() {
  const {
    profileDisplayName,
    profileDescription,
    profileBirthday,
    profileBackgroundId,
    profileCompanionId,
    profileSkinId,
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

  const { user } = useAuth();
  const cardRef = useRef<View>(null);
  const [editingBirthday, setEditingBirthday] = useState(!!profileBirthday);

  // Sync this card to the cloud (debounced) so friends see the real character.
  useEffect(() => {
    if (!user?.id || !friendCode) return;
    const t = setTimeout(() => {
      uploadProfile(user.id, {
        friendCode,
        displayName: profileDisplayName,
        description: profileDescription,
        birthday: profileBirthday,
        companionId: profileCompanionId,
        skinId: profileSkinId,
        backgroundId: profileBackgroundId,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        totalMinutes,
      });
    }, 700);
    return () => clearTimeout(t);
  }, [
    user?.id,
    friendCode,
    profileDisplayName,
    profileDescription,
    profileBirthday,
    profileCompanionId,
    profileSkinId,
    profileBackgroundId,
    streak.currentStreak,
    streak.longestStreak,
    totalMinutes,
  ]);

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
  const name = profileDisplayName.trim() || 'Study Buddy';

  const shareCard = async () => {
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your card' });
      } else {
        await Share.share({ url: uri });
      }
    } catch {
      Alert.alert('Share', "Couldn't capture the card. If you just added sharing, the app needs a rebuild first.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: P.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.screenTitle}>My Card</Text>

          {/* ── The ID card (captured for sharing) ───────────────────────── */}
          <View ref={cardRef} collapsable={false} style={styles.card}>
            <View style={styles.cardInner}>
              {/* Left: scene */}
              <View style={styles.figurePanel}>
                <Image source={bgRoom.backgroundImage} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={styles.figureScrim} />
                <Image source={figureSource} style={styles.figureImg} contentFit="contain" />
              </View>

              {/* Right: info */}
              <View style={styles.infoPanel}>
                <Text style={styles.name} numberOfLines={2}>{name}</Text>

                <View style={styles.statRow}>
                  <BakeryFlameEmoji size={16} />
                  <Text style={styles.statLabel}>Current streak</Text>
                  <Text style={styles.statValue}>{streak.currentStreak}d</Text>
                </View>
                <View style={styles.statRow}>
                  <BakeryCakeEmoji size={16} />
                  <Text style={styles.statLabel}>Best streak</Text>
                  <Text style={styles.statValue}>{streak.longestStreak}d</Text>
                </View>
                <View style={styles.statRow}>
                  <BakeryBellEmoji size={16} />
                  <Text style={styles.statLabel}>Studied</Text>
                  <Text style={styles.statValue}>{hoursLabel}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={styles.statEmojiFallback}>🎂</Text>
                  <Text style={styles.statLabel}>Birthday</Text>
                  <Text style={styles.statValue}>{formatBirthday(profileBirthday)}</Text>
                </View>

                {profileDescription.trim() ? (
                  <Text style={styles.desc} numberOfLines={3}>“{profileDescription.trim()}”</Text>
                ) : null}
              </View>
            </View>

            {/* Bottom: friend code */}
            <View style={styles.codeStrip}>
              <Text style={styles.codeStripLabel}>FRIEND CODE</Text>
              <Text style={styles.codeStripValue}>{friendCode}</Text>
            </View>
          </View>

          {/* Share */}
          <Pressable style={({ pressed }) => [styles.shareBtn, pressed && styles.pressed]} onPress={shareCard}>
            <Text style={styles.shareBtnText}>Share my card</Text>
          </Pressable>

          {/* ── Editor ────────────────────────────────────────────────────── */}
          <Text style={styles.editTitle}>Edit profile</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              style={styles.input}
              value={profileDisplayName}
              onChangeText={(v) => updateProfile({ displayName: v })}
              placeholder="Your name"
              placeholderTextColor={P.muted}
              maxLength={20}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={profileDescription}
              onChangeText={(v) => updateProfile({ description: v })}
              placeholder="Say something about you…"
              placeholderTextColor={P.muted}
              multiline
              maxLength={120}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Birthday</Text>
            {editingBirthday ? (
              <DateWheelPicker
                value={profileBirthday || '2008-01-01'}
                onChange={(v) => updateProfile({ birthday: v })}
                minYear={1950}
              />
            ) : (
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                onPress={() => setEditingBirthday(true)}>
                <Text style={styles.addBtnText}>+ Add birthday</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Character</Text>
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
                    <Text style={styles.charName} numberOfLines={1}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Outfit</Text>
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
            <Text style={styles.bgHint}>Only outfits you own show here. Get more in the Shop.</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Card background</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bgRow}>
              {ROOM_PAIRS.map((r) => {
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
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const CARD_RADIUS = 24;

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.four,
  },
  screenTitle: { fontSize: 24, fontWeight: '900', color: P.brown },

  // Card
  card: {
    backgroundColor: P.card,
    borderRadius: CARD_RADIUS,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    overflow: 'hidden',
    shadowColor: '#C9A18A',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardInner: { flexDirection: 'row', padding: 12, gap: 12 },
  figurePanel: {
    width: 132,
    height: 188,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: P.pinkSoft,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  figureScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.08)' },
  figureImg: { width: '116%', height: '92%', marginBottom: -6 },
  infoPanel: { flex: 1, gap: 7, paddingTop: 2 },
  name: { fontSize: 20, fontWeight: '900', color: P.brown, lineHeight: 24 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statEmojiFallback: { fontSize: 15, width: 16, textAlign: 'center' },
  statLabel: { fontSize: 12.5, color: P.muted, fontWeight: '600', flex: 1 },
  statValue: { fontSize: 13, color: P.brown, fontWeight: '800' },
  desc: { fontSize: 12.5, color: P.cocoa, fontStyle: 'italic', lineHeight: 17, marginTop: 2 },

  codeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: P.pink,
    paddingVertical: 9,
  },
  codeStripLabel: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1, opacity: 0.9 },
  codeStripValue: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 3 },

  shareBtn: {
    backgroundColor: P.honey,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0A33C',
  },
  shareBtnText: { color: P.brown, fontSize: 16, fontWeight: '900' },

  // Editor
  editTitle: { fontSize: 17, fontWeight: '800', color: P.brown, marginTop: Spacing.two },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: P.cocoa },
  input: {
    borderWidth: 1.5,
    borderColor: P.peach,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: P.brown,
    backgroundColor: P.card,
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top' },
  addBtn: {
    borderWidth: 1.5,
    borderColor: P.peach,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: P.card,
  },
  addBtnText: { color: P.cocoa, fontWeight: '700' },
  bgRow: { gap: 10, paddingVertical: 2 },
  bgThumb: { width: 84, height: 60, borderRadius: 12, borderWidth: 2, borderColor: '#fff' },
  bgThumbSelected: { borderColor: P.pink, borderWidth: 3 },
  charItem: { alignItems: 'center', gap: 4, width: 72 },
  charThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: P.pinkSoft,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  charThumbSelected: { borderColor: P.pink, borderWidth: 3 },
  charThumb: { width: '132%', height: '132%', marginTop: -4 },
  charName: { fontSize: 11, fontWeight: '700', color: P.cocoa },
  bgHint: { fontSize: 11.5, color: P.muted, lineHeight: 16 },

  doneBtn: {
    backgroundColor: P.cocoa,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.85 },
});
