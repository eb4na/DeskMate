import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { bunAvatarNudge, getCompanionImage } from '@/lib/companion-utils';
import { joinPresence, sendInvite, type OnlineGameId } from '@/lib/game-net';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

// Dedicated screen for inviting friends into a BatterDash party lobby. Opened
// from the lobby's "Invite friend" button with the room id, so every invite
// drops the friend into the same room.
export default function PartyInviteScreen() {
  const { t } = useTranslation();
  const { room, game } = useLocalSearchParams<{ room?: string; game?: string }>();
  const inviteGame = (game as OnlineGameId) || 'batterdash';
  const { friends, friendCode, profileDisplayName } = useApp();
  const [onlineCodes, setOnlineCodes] = useState<Set<string>>(new Set());
  const [invited, setInvited] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!friendCode) return;
    return joinPresence(friendCode, setOnlineCodes);
  }, [friendCode]);

  const invite = (code: string) => {
    if (!room) return;
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
                    <Text style={styles.code}>{online ? t('party.onlineNow') : f.code}</Text>
                  </View>
                  <Pressable
                    onPress={() => invite(f.code)}
                    style={({ pressed }) => [
                      styles.inviteBtn,
                      isInvited && styles.inviteBtnDone,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.inviteText, isInvited && styles.inviteTextDone]}>
                      {isInvited ? t('party.invited') : t('party.invite')}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BakeryColors.frosting },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.three },
  header: { gap: 4 },
  title: { fontSize: 22, fontWeight: '900', color: BakeryColors.cocoaDark },
  subtitle: { fontSize: 13, color: BakeryColors.mocha },
  list: { gap: Spacing.two, paddingBottom: Spacing.four },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BakeryColors.glass,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    padding: Spacing.two,
    ...BakeryShadow,
  },
  avatarWrap: { width: 44, height: 44 },
  avatarImg: { width: 44, height: 44, borderRadius: 22, backgroundColor: BakeryColors.cream },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: BakeryColors.shortbread, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '900', color: BakeryColors.cocoaDark },
  statusDot: { position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: BakeryColors.frosting },
  statusOnline: { backgroundColor: '#5BC47B' },
  statusOffline: { backgroundColor: BakeryColors.latte },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '800', color: BakeryColors.cocoaDark },
  code: { fontSize: 12, color: BakeryColors.mocha },
  inviteBtn: { backgroundColor: BakeryColors.honey, borderRadius: BakeryRadii.button, paddingHorizontal: Spacing.three, paddingVertical: 9 },
  inviteBtnDone: { backgroundColor: BakeryColors.cream, borderWidth: 1.5, borderColor: BakeryColors.success },
  inviteText: { fontSize: 14, fontWeight: '900', color: BakeryColors.cocoaDark },
  inviteTextDone: { color: BakeryColors.success },
  emptyCard: { backgroundColor: BakeryColors.glass, borderRadius: BakeryRadii.card, padding: Spacing.four, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: BakeryColors.cocoaDark },
  emptyText: { fontSize: 13, color: BakeryColors.mocha, textAlign: 'center', lineHeight: 18 },
  doneBtn: { backgroundColor: '#F7A7B8', borderRadius: BakeryRadii.button, paddingVertical: 13, alignItems: 'center', marginBottom: Spacing.two },
  doneText: { fontSize: 16, fontWeight: '900', color: BakeryColors.cocoaDark },
  pressed: { opacity: 0.85 },
});
