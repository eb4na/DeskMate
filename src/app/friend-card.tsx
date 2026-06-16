/**
 * Read-only view of a friend's profile card (their chosen character/outfit on a
 * background, plus streaks, hours studied, birthday and description). Opened by
 * tapping a friend in the Friends list.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/context/app-context';
import { PlusCrown, isPlusFrame } from '@/components/avatar-frame';
import { getCompanionImage } from '@/lib/companion-utils';
import { fetchProfileByCode } from '@/lib/profile-sync';
import { ROOM_PAIRS } from '@/constants/room-data';
import i18n, { useTranslation } from '@/i18n';
import { MaxContentWidth, Spacing } from '@/constants/theme';

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
  return d.toLocaleDateString(i18n.language || 'en-US', { month: 'long', day: 'numeric' });
}

export default function FriendCardScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { friends, setFriendProfile } = useApp();
  const friend = friends.find((f) => f.code === code);
  const [, force] = useState(0);

  // Refresh from the cloud so the card is current.
  useEffect(() => {
    if (!code) return;
    fetchProfileByCode(code).then((p) => {
      if (p) {
        setFriendProfile(code, {
          displayName: p.displayName || undefined,
          companionId: p.companionId,
          skinId: p.skinId,
          backgroundId: p.backgroundId,
          avatarFrame: p.avatarFrame,
          description: p.description,
          birthday: p.birthday,
          currentStreak: p.currentStreak,
          longestStreak: p.longestStreak,
          totalMinutes: p.totalMinutes,
        });
        force((n) => n + 1);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const name = friend?.displayName || friend?.name || t('friendCard.friendFallback', { code });
  const bgRoom = ROOM_PAIRS.find((r) => r.id === friend?.backgroundId) ?? ROOM_PAIRS[0];
  const figure = getCompanionImage(friend?.companionId, friend?.skinId);
  const totalMinutes = friend?.totalMinutes ?? 0;
  const hours = Math.floor(totalMinutes / 60);
  const hoursLabel = hours > 0 ? `${hours}h ${totalMinutes % 60}m` : `${totalMinutes}m`;

  return (
    <View style={[styles.container, { backgroundColor: P.cream }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SafeAreaView style={styles.safeArea}>
          <Text style={styles.screenTitle}>{t('friendCard.cardTitle', { name })}</Text>

          <View style={styles.card}>
            <View style={styles.cardInner}>
              <View style={styles.figurePanel}>
                <Image source={bgRoom.backgroundImage} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Image source={figure} style={styles.figureImg} contentFit="contain" />
              </View>
              <View style={styles.infoPanel}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={2}>{name}</Text>
                  {isPlusFrame(friend?.avatarFrame) && <PlusCrown size={18} />}
                </View>
                <Row label={t('friendCard.currentStreak')} value={`${friend?.currentStreak ?? 0}d`} />
                <Row label={t('friendCard.bestStreak')} value={`${friend?.longestStreak ?? 0}d`} />
                <Row label={t('friendCard.studied')} value={hoursLabel} />
                <Row label={t('friendCard.birthday')} value={formatBirthday(friend?.birthday)} />
                {friend?.description ? (
                  <Text style={styles.desc} numberOfLines={3}>“{friend.description}”</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.codeStrip}>
              <Text style={styles.codeStripLabel}>{t('friendCard.friendCodeLabel')}</Text>
              <Text style={styles.codeStripValue}>{code}</Text>
            </View>
          </View>

          <Pressable style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>{t('common.close')}</Text>
          </Pressable>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
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
  statRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  statLabel: { fontSize: 12.5, color: P.muted, fontWeight: '600', flex: 1 },
  statValue: { fontSize: 13, color: P.brown, fontWeight: '800' },
  desc: { fontSize: 12.5, color: P.cocoa, fontStyle: 'italic', lineHeight: 17, marginTop: 2 },
  codeStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: P.pink, paddingVertical: 9,
  },
  codeStripLabel: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1, opacity: 0.9 },
  codeStripValue: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 3 },
  doneBtn: { backgroundColor: '#F7A7B8', borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.85 },
});
