import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { bunAvatarNudge, getCompanionImage } from '@/lib/companion-utils';
import { useStudyRoom } from '@/lib/use-study-room';
import { joinPresence, sendInvite, type OnlineGameId } from '@/lib/game-net';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';

// Dedicated screen for inviting friends into a BatterDash party lobby. Opened
// from the lobby's "Invite friend" button with the room id, so every invite
// drops the friend into the same room.
export default function PartyInviteScreen() {
  const { t } = useTranslation();
  // Scale text/cards/avatars proportionally so the list isn't tiny on big screens.
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const { room, game } = useLocalSearchParams<{ room?: string; game?: string }>();
  const inviteGame = (game as OnlineGameId) || 'batterdash';
  const { friends, friendCode, profileDisplayName } = useApp();
  const [onlineCodes, setOnlineCodes] = useState<Set<string>>(new Set());
  const [invited, setInvited] = useState<Set<string>>(new Set());

  // Friends already in this study room (synced roster) — they don't need an invite.
  // Only meaningful for the study room; batterdash uses a separate roster, so we skip.
  const { roster } = useStudyRoom();
  const inRoomCodes = useMemo(
    () => new Set(inviteGame === 'study' ? roster.map((e) => e.code) : []),
    [roster, inviteGame],
  );

  useEffect(() => {
    if (!friendCode) return;
    return joinPresence(friendCode, setOnlineCodes);
  }, [friendCode]);

  const invite = (code: string, online: boolean) => {
    if (!room || !online) return;
    sendInvite(code, {
      game: inviteGame,
      room,
      fromCode: friendCode,
      fromName: profileDisplayName || t('party.playerName', { code: friendCode }),
    });
    setInvited((prev) => new Set(prev).add(code));
  };

  // Online friends first, then by name.
  const sorted = [...friends].sort((a, b) => {
    const ao = onlineCodes.has(a.code) ? 0 : 1;
    const bo = onlineCodes.has(b.code) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return (a.displayName || a.name).localeCompare(b.displayName || b.name);
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{inviteGame === 'study' ? t('party.inviteToStudy') : t('party.inviteToParty')}</Text>
          <Text style={styles.subtitle}>{t('party.inviteSubtitle')}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {sorted.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('party.noFriendsYet')}</Text>
              <Text style={styles.emptyText}>{t('party.noFriendsHint')}</Text>
            </View>
          ) : (
            sorted.map((f) => {
              const online = onlineCodes.has(f.code);
              const isInvited = invited.has(f.code);
              const inRoom = inRoomCodes.has(f.code);
              return (
                <View key={f.code} style={styles.row}>
                  <View style={styles.avatarWrap}>
                    {f.companionId !== undefined ? (
                      <Image source={getCompanionImage(f.companionId, f.skinId)} style={[styles.avatarImg, bunAvatarNudge(f.companionId)]} contentFit="contain" />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarText}>{(f.code[0] ?? '?').toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={[styles.statusDot, online ? styles.statusOnline : styles.statusOffline]} />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name} numberOfLines={1}>{f.displayName || f.name}</Text>
                    <Text style={[styles.status, online ? styles.statusTextOnline : styles.statusTextOffline]}>
                      {online ? t('party.onlineNow') : t('party.offline')}
                    </Text>
                  </View>
                  <Pressable
                    disabled={inRoom || !online}
                    onPress={() => invite(f.code, online)}
                    style={({ pressed }) => [
                      styles.inviteBtn,
                      (inRoom || isInvited) && styles.inviteBtnDone,
                      !inRoom && !online && styles.inviteBtnDisabled,
                      pressed && online && !inRoom && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        styles.inviteText,
                        (inRoom || isInvited) && styles.inviteTextDone,
                        !inRoom && !online && styles.inviteTextDisabled,
                      ]}>
                      {inRoom
                        ? t('party.alreadyIn')
                        : isInvited
                          ? t('party.invited')
                          : online
                            ? t('party.invite')
                            : t('party.offline')}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>

        <Pressable style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]} onPress={() => router.back()}>
          <Text style={styles.doneText}>{t('party.backToLobby')}</Text>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

// Sizes multiplied by `s` (tablet scale) so text, cards, and avatars grow with the
// screen; `s` is 1 on phones (no-op). Mirrors study-lobby's responsive pattern.
const makeStyles = (s: number, contentWidth: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: BakeryColors.frosting },
  safe: { flex: 1, width: '100%', maxWidth: contentWidth, alignSelf: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.three },
  header: { gap: 4 * s },
  title: { fontSize: 22 * s, fontWeight: '900', color: BakeryColors.cocoaDark },
  subtitle: { fontSize: 13 * s, color: BakeryColors.mocha },
  list: { gap: Spacing.two * s, paddingBottom: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two * s,
    backgroundColor: BakeryColors.glass,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    padding: Spacing.two * s,
    ...BakeryShadow,
  },
  avatarWrap: { width: 44 * s, height: 44 * s },
  avatarImg: { width: 44 * s, height: 44 * s, borderRadius: 22 * s, backgroundColor: BakeryColors.cream },
  avatarFallback: { width: 44 * s, height: 44 * s, borderRadius: 22 * s, backgroundColor: BakeryColors.shortbread, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18 * s, fontWeight: '900', color: BakeryColors.cocoaDark },
  statusDot: { position: 'absolute', right: -1, bottom: -1, width: 13 * s, height: 13 * s, borderRadius: 7 * s, borderWidth: 2, borderColor: BakeryColors.frosting },
  statusOnline: { backgroundColor: '#5BC47B' },
  statusOffline: { backgroundColor: BakeryColors.latte },
  info: { flex: 1, gap: 3 * s },
  name: { fontSize: 15 * s, fontWeight: '800', color: BakeryColors.cocoaDark },
  status: { fontSize: 12 * s, fontWeight: '800' },
  statusTextOnline: { color: '#3DA55F' },
  statusTextOffline: { color: BakeryColors.latte },
  inviteBtn: { backgroundColor: '#F7A7B8', borderRadius: BakeryRadii.button, paddingHorizontal: Spacing.three * s, paddingVertical: 9 * s },
  inviteBtnDone: { backgroundColor: BakeryColors.cream, borderWidth: 1.5, borderColor: BakeryColors.success },
  inviteBtnDisabled: { backgroundColor: BakeryColors.cream, borderWidth: 1.5, borderColor: BakeryColors.shortbread },
  inviteText: { fontSize: 14 * s, fontWeight: '900', color: BakeryColors.cocoaDark },
  inviteTextDone: { color: BakeryColors.success },
  inviteTextDisabled: { color: BakeryColors.latte },
  emptyCard: { backgroundColor: BakeryColors.glass, borderRadius: BakeryRadii.card, padding: Spacing.four, alignItems: 'center', gap: 6 * s },
  emptyTitle: { fontSize: 16 * s, fontWeight: '800', color: BakeryColors.cocoaDark },
  emptyText: { fontSize: 13 * s, color: BakeryColors.mocha, textAlign: 'center', lineHeight: 18 * s },
  doneBtn: { backgroundColor: '#F7A7B8', borderRadius: BakeryRadii.button, paddingVertical: 13 * s, alignItems: 'center', marginBottom: Spacing.two },
  doneText: { fontSize: 16 * s, fontWeight: '900', color: BakeryColors.cocoaDark },
  pressed: { opacity: 0.85 },
});
