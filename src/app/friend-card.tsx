/**
 * Read-only view of a profile card (the person's chosen character/outfit on a
 * background, plus streaks, hours studied, birthday and description). Opened by
 * tapping a friend in the Friends list — or by tapping another member's character
 * in a multiplayer study room, where the person may NOT be a friend yet. For a
 * non-friend the card renders off a freshly-fetched profile and shows an
 * "Add friend" button (sends a friend request).
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STREAK_ICON = require('@/assets/images/profile/streak-cupcake.png');
const BEST_STREAK_ICON = require('@/assets/images/profile/best-streak-cupcake.png');
const STUDIED_ICON = require('@/assets/images/profile/studied-book.png');
const BIRTHDAY_ICON = require('@/assets/images/profile/birthday-candle.png');

import { useApp } from '@/context/app-context';
import { useAuth } from '@/context/auth-context';
import { getCompanionImage } from '@/lib/companion-utils';
import { fetchProfileByCode, type SyncedProfile } from '@/lib/profile-sync';
import { sendFriendRequest } from '@/lib/friend-requests';
import { reportUser, REPORT_REASONS, type ReportReason } from '@/lib/moderation';
import { ROOM_PAIRS } from '@/constants/room-data';
import { cardColors } from '@/constants/card-colors';
import { isPlusFrame } from '@/components/avatar-frame';
import i18n, { useTranslation } from '@/i18n';
import { formatDuration } from '@/lib/format-duration';
import { MaxContentWidth, MIN_POPUP_WIDTH, popupMaxWidth, Spacing } from '@/constants/theme';
import { useReportModalTransition } from '@/lib/modal-traffic';

const P = {
  cream: '#FFF8EF',
  card: '#FFFDF8',
  pink: '#F7A7B8',
  pinkSoft: '#FBD9E0',
  brown: '#5B3A2E',
  cocoa: '#7A5240',
  muted: '#9A7B6D',
} as const;

function formatBirthday(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return '—';
  // Abbreviated month ("Nov 13") — same narrow card layout as the profile card, so
  // a full month name would wrap the "Birthday" label onto a second line.
  return d.toLocaleDateString(i18n.language || 'en-US', { month: 'short', day: 'numeric' });
}

export default function FriendCardScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { friends, setFriendProfile, blockUser, friendCode } = useApp();
  const { user } = useAuth();
  const friend = friends.find((f) => f.code === code);
  const isFriend = !!friend;
  const [, force] = useState(0);
  // For a non-friend (opened from a study room) we have no entry in `friends`, so
  // render off this freshly-fetched cloud profile instead.
  const [fetched, setFetched] = useState<SyncedProfile | null>(null);

  // Refresh from the cloud so the card is current.
  useEffect(() => {
    if (!code) return;
    fetchProfileByCode(code).then((p) => {
      if (p) {
        setFetched(p);
        // Only cache into the friend store when they actually are a friend — caching
        // a stranger's profile there would be meaningless (nothing reads it).
        if (isFriend) {
          setFriendProfile(code, {
            displayName: p.displayName || undefined,
            companionId: p.companionId,
            skinId: p.skinId,
            backgroundId: p.backgroundId,
            avatarFrame: p.avatarFrame,
            cardColor: p.cardColor,
            description: p.description,
            birthday: p.birthday,
            currentStreak: p.currentStreak,
            longestStreak: p.longestStreak,
            totalMinutes: p.totalMinutes,
          });
        }
        force((n) => n + 1);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // Prefer the friend-store entry (kept in sync), else the freshly-fetched profile.
  const name = friend?.displayName || friend?.name || fetched?.displayName || t('friendCard.friendFallback', { code });
  const backgroundId = friend?.backgroundId ?? fetched?.backgroundId;
  const bgRoom = ROOM_PAIRS.find((r) => r.id === backgroundId) ?? ROOM_PAIRS[0];
  const figure = getCompanionImage(friend?.companionId ?? fetched?.companionId, friend?.skinId ?? fetched?.skinId);
  const totalMinutes = friend?.totalMinutes ?? fetched?.totalMinutes ?? 0;
  const hoursLabel = formatDuration(totalMinutes, t);
  const currentStreak = friend?.currentStreak ?? fetched?.currentStreak ?? 0;
  const longestStreak = friend?.longestStreak ?? fetched?.longestStreak ?? 0;
  const birthday = friend?.birthday ?? fetched?.birthday;
  const description = friend?.description ?? fetched?.description;
  const avatarFrame = friend?.avatarFrame ?? fetched?.avatarFrame;
  // Show the friend's chosen card colour — but only while they're Plus (custom
  // colours lapse with Plus, like the avatar frame); everyone else stays pink.
  const cc = cardColors(isPlusFrame(avatarFrame) ? ((friend?.cardColor ?? fetched?.cardColor) || 'pink') : 'pink');
  // "Add friend" only when this is someone else and not already a friend.
  const canAddFriend = !!code && code !== friendCode && !isFriend;

  // friend-card is presented as a native modal, so confirmations use a LOCAL modal —
  // the root showPopup renders BEHIND the native sheet and the tap just looks dead.
  const [mod, setMod] = useState<null | 'report' | 'block' | 'sent' | 'error' | 'reqSent' | 'reqFail'>(null);
  useReportModalTransition(mod !== null);
  const [adding, setAdding] = useState(false);
  // Add friend: send a friend request (recipient must accept), mirroring the
  // Friends-tab flow. Show the result in the LOCAL modal (root popups render behind
  // this native sheet).
  const handleAdd = async () => {
    if (!code || !user?.id) return;
    setAdding(true);
    try {
      const res = await sendFriendRequest({ fromUser: user.id, fromCode: friendCode, toCode: code });
      setMod(res.ok ? 'reqSent' : 'reqFail');
    } catch {
      setMod('reqFail');
    } finally {
      setAdding(false);
    }
  };
  // Report: file the chosen reason to Supabase (founder reviews in the dashboard).
  // Await the insert so a failure (e.g. table not migrated) shows an error instead
  // of a false "sent" — the report would otherwise be silently lost.
  const doReport = async (reason: ReportReason) => {
    if (!code) return;
    const ok = await reportUser(code, reason, friendCode);
    setMod(ok ? 'sent' : 'error');
  };
  // Block: drop the friendship + hide them, then close the card.
  const confirmBlock = () => {
    if (code) blockUser(code);
    setMod(null);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: P.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.screenTitle}>{t('friendCard.cardTitle', { name })}</Text>

          <View style={[styles.card, { borderColor: cc.strip }]}>
            <View style={styles.cardInner}>
              <View style={styles.figurePanel}>
                <Image source={bgRoom.backgroundImage} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Image source={figure} style={styles.figureImg} contentFit="contain" />
              </View>
              <View style={styles.infoPanel}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={2}>{name}</Text>
                </View>
                <Row icon={STREAK_ICON} label={t('friendCard.currentStreak')} value={`${currentStreak}d`} />
                <Row icon={BEST_STREAK_ICON} label={t('friendCard.bestStreak')} value={`${longestStreak}d`} />
                <Row icon={STUDIED_ICON} label={t('friendCard.studied')} value={hoursLabel} />
                <Row icon={BIRTHDAY_ICON} label={t('friendCard.birthday')} value={formatBirthday(birthday)} />
                {description ? (
                  <Text style={styles.desc} numberOfLines={3}>“{description}”</Text>
                ) : null}
              </View>
            </View>
            <View style={[styles.codeStrip, { backgroundColor: cc.strip }]}>
              <Text style={styles.codeStripLabel}>{t('friendCard.friendCodeLabel')}</Text>
              <Text style={styles.codeStripValue}>{code}</Text>
            </View>
          </View>

          {canAddFriend && (
            <Pressable style={({ pressed }) => [styles.addBtn, (pressed || adding) && styles.pressed]} onPress={handleAdd} disabled={adding}>
              <Text style={styles.addBtnText}>{adding ? t('friendCard.addingFriend') : t('friendCard.addFriend')}</Text>
            </Pressable>
          )}

          <Pressable style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>{t('common.close')}</Text>
          </Pressable>

          {/* Moderation — report files to Supabase; block removes + hides them. */}
          <View style={styles.modRow}>
            <Pressable style={({ pressed }) => [styles.modBtn, pressed && styles.pressed]} onPress={() => setMod('report')} hitSlop={6}>
              <Text style={styles.modText}>{t('report.report')}</Text>
            </Pressable>
            <Text style={styles.modDivider}>·</Text>
            <Pressable style={({ pressed }) => [styles.modBtn, pressed && styles.pressed]} onPress={() => setMod('block')} hitSlop={6}>
              <Text style={[styles.modText, styles.modBlock]}>{t('report.block')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </ScrollView>

      {/* LOCAL modal (renders over this native sheet, unlike the root showPopup). */}
      {mod !== null && (
        <Modal transparent animationType="fade" visible onRequestClose={() => setMod(null)}>
          <Pressable style={styles.popBackdrop} onPress={() => setMod(null)}>
            <Pressable style={styles.popCard} onPress={() => {}}>
              {mod === 'report' && (
                <>
                  <Text style={styles.popTitle}>{t('report.title', { name })}</Text>
                  <Text style={styles.popSub}>{t('report.subtitle')}</Text>
                  {REPORT_REASONS.map((r) => (
                    <Pressable key={r} style={({ pressed }) => [styles.popReason, pressed && styles.pressed]} onPress={() => doReport(r)}>
                      <Text style={styles.popReasonText}>{t(`report.reason_${r}`)}</Text>
                    </Pressable>
                  ))}
                  <Pressable style={styles.popCancel} onPress={() => setMod(null)}>
                    <Text style={styles.popCancelText}>{t('common.cancel')}</Text>
                  </Pressable>
                </>
              )}
              {mod === 'block' && (
                <>
                  <Text style={styles.popTitle}>{t('report.blockTitle', { name })}</Text>
                  <Text style={styles.popSub}>{t('report.blockMsg')}</Text>
                  <Pressable style={({ pressed }) => [styles.popDanger, pressed && styles.pressed]} onPress={confirmBlock}>
                    <Text style={styles.popDangerText}>{t('report.blockConfirm')}</Text>
                  </Pressable>
                  <Pressable style={styles.popCancel} onPress={() => setMod(null)}>
                    <Text style={styles.popCancelText}>{t('common.cancel')}</Text>
                  </Pressable>
                </>
              )}
              {(mod === 'sent' || mod === 'error') && (
                <>
                  <Text style={styles.popTitle}>{t(mod === 'sent' ? 'report.sentTitle' : 'report.failedTitle')}</Text>
                  <Text style={styles.popSub}>{t(mod === 'sent' ? 'report.sentMsg' : 'report.failedMsg')}</Text>
                  <Pressable style={({ pressed }) => [styles.popPrimary, pressed && styles.pressed]} onPress={() => setMod(null)}>
                    <Text style={styles.popPrimaryText}>{t('common.close')}</Text>
                  </Pressable>
                </>
              )}
              {(mod === 'reqSent' || mod === 'reqFail') && (
                <>
                  <Text style={styles.popTitle}>{t(mod === 'reqSent' ? 'friendCard.requestSentTitle' : 'friendCard.requestFailedTitle')}</Text>
                  <Text style={styles.popSub}>{t(mod === 'reqSent' ? 'friendCard.requestSentMsg' : 'friendCard.requestFailedMsg', { name })}</Text>
                  <Pressable style={({ pressed }) => [styles.popPrimary, pressed && styles.pressed]} onPress={() => setMod(null)}>
                    <Text style={styles.popPrimaryText}>{t('common.close')}</Text>
                  </Pressable>
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

function Row({ icon, label, value }: { icon: ImageSourcePropType; label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Image source={icon} style={styles.statIcon} contentFit="contain" />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { padding: Spacing.four, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center', gap: Spacing.four },
  screenTitle: { fontSize: 22, fontWeight: '900', color: P.brown },
  card: {
    backgroundColor: P.card,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: P.pinkSoft,
    overflow: 'hidden',
  },
  cardInner: { flexDirection: 'row', padding: 12, gap: 12 },
  figurePanel: {
    width: 132, height: 188, borderRadius: 18, overflow: 'hidden',
    backgroundColor: P.pinkSoft, borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'flex-end',
  },
  figureImg: { width: '116%', height: '92%', marginBottom: -6 },
  infoPanel: { flex: 1, gap: 8, paddingTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 20, fontWeight: '900', color: P.brown, lineHeight: 24, flexShrink: 1 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statIcon: { width: 20, height: 20 },
  statLabel: { fontSize: 12.5, color: P.muted, fontWeight: '600', flex: 1 },
  statValue: { fontSize: 13, color: P.brown, fontWeight: '800' },
  desc: { fontSize: 12.5, color: P.cocoa, fontStyle: 'italic', lineHeight: 17, marginTop: 2 },
  codeStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: P.pink, paddingVertical: 9,
  },
  codeStripLabel: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1, opacity: 0.9 },
  codeStripValue: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 3 },
  addBtn: { backgroundColor: P.pink, borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  doneBtn: { backgroundColor: '#F7A7B8', borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 14, paddingVertical: 6 },
  modBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  modText: { fontSize: 13, fontWeight: '700', color: P.muted },
  modBlock: { color: '#C0463E' },
  modDivider: { color: P.muted, fontSize: 13 },
  // Local report/block popup (transparent backdrop — matches the app's no-dim modals).
  popBackdrop: { flex: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', padding: 28 },
  popCard: { width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: popupMaxWidth(340), backgroundColor: P.card, borderRadius: 24, padding: 22, gap: 10, borderWidth: 1.5, borderColor: P.pinkSoft, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  popTitle: { fontSize: 18, fontWeight: '900', color: P.brown, textAlign: 'center' },
  popSub: { fontSize: 13, color: P.muted, textAlign: 'center', marginBottom: 4, lineHeight: 18 },
  popReason: { paddingVertical: 12, borderRadius: 14, backgroundColor: P.cream, borderWidth: 1.5, borderColor: P.pinkSoft, alignItems: 'center' },
  popReasonText: { fontSize: 14, fontWeight: '700', color: P.brown },
  popDanger: { paddingVertical: 13, borderRadius: 14, backgroundColor: '#E0574E', alignItems: 'center' },
  popDangerText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  popPrimary: { paddingVertical: 13, borderRadius: 14, backgroundColor: P.pink, alignItems: 'center' },
  popPrimaryText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  popCancel: { paddingVertical: 10, alignItems: 'center' },
  popCancelText: { fontSize: 14, fontWeight: '700', color: P.muted },
  pressed: { opacity: 0.85 },
});
