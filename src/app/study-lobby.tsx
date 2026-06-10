import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { SESSION_LENGTHS } from '@/constants/placeholder-data';
import { getCompanionImage } from '@/lib/companion-utils';
import { useStudyRoom } from '@/lib/use-study-room';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

// Lobby for a synced multiplayer study room: players gather, the host picks a
// duration and starts. The realtime connection lives in StudyRoomProvider, so
// it survives the transition to the home screen once the session begins.
export default function StudyLobbyScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { active, isHost, myCode, roster, presentCodes, netStatus, roomId, start, leaveRoom } = useStudyRoom();
  const [minutes, setMinutes] = useState(25);

  // If we somehow landed here without a room, bail home.
  if (!active) {
    router.replace('/');
    return null;
  }

  const leave = () => {
    leaveRoom();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const connecting = netStatus !== 'SUBSCRIBED';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + Spacing.three }]} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('lobby.studyRoom')}</Text>
            <Text style={styles.subtitle}>
              {connecting
                ? t('lobby.connecting', { status: netStatus || t('lobby.starting') })
                : t('lobby.roomStatus', { inRoom: roster.length, connected: presentCodes.length })}
            </Text>
          </View>

          {/* Roster */}
          <View style={styles.roster}>
            {roster.map((e) => {
              const present = presentCodes.includes(e.code);
              return (
                <View key={e.code} style={styles.row}>
                  <View style={styles.avatarWrap}>
                    {e.companionId !== undefined || e.skinId !== undefined ? (
                      <Image source={getCompanionImage(e.companionId, e.skinId)} style={styles.avatarImg} contentFit="contain" />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarText}>{(e.name[0] ?? '?').toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={[styles.dot, present ? styles.dotOn : styles.dotOff]} />
                  </View>
                  <Text style={styles.name} numberOfLines={1}>
                    {e.name}
                    {e.isHost ? ' 👑' : ''}
                    {e.code === myCode ? t('lobby.you') : ''}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Duration (host picks) */}
          {isHost ? (
            <>
              <Text style={styles.label}>{t('lobby.sessionLength')}</Text>
              <View style={styles.lenGrid}>
                {SESSION_LENGTHS.map((opt) => (
                  <Pressable
                    key={opt.minutes}
                    onPress={() => setMinutes(opt.minutes)}
                    style={[styles.lenCard, minutes === opt.minutes && styles.lenCardActive]}>
                    <Text style={[styles.lenNum, minutes === opt.minutes && styles.lenNumActive]}>{opt.minutes}</Text>
                    <Text style={styles.lenLabel}>{t('lobby.min')}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.hint}>{t('lobby.hostPicks')}</Text>
          )}
        </ScrollView>

        <View style={styles.actions}>
          {isHost ? (
            <>
              <Pressable
                onPress={() => router.push({ pathname: '/party-invite', params: { room: roomId ?? '', game: 'study' } })}
                style={({ pressed }) => [styles.inviteBtn, pressed && styles.pressed]}>
                <Text style={styles.inviteText}>{t('lobby.inviteFriend')}</Text>
              </Pressable>
              <Pressable
                onPress={() => start({ durationMinutes: minutes, subjectName: t('lobby.studyRoomName'), taskId: null, taskTitle: null })}
                style={({ pressed }) => [styles.startBtn, pressed && styles.pressed]}>
                <Text style={styles.startText}>{t('lobby.startStudying')}</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.hint}>{t('lobby.waitingHost')}</Text>
          )}
          <Pressable onPress={leave} style={styles.cancel}>
            <Text style={styles.cancelText}>{t('lobby.leave')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BakeryColors.frosting },
  safe: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.four },
  scroll: { paddingTop: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.three },
  header: { gap: 4, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '900', color: BakeryColors.cocoaDark },
  subtitle: { fontSize: 13, color: BakeryColors.mocha },
  roster: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: BakeryColors.glass,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    padding: Spacing.two,
  },
  avatarWrap: { width: 44, height: 44 },
  avatarImg: { width: 44, height: 44, borderRadius: 22, backgroundColor: BakeryColors.cream },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: BakeryColors.shortbread, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '900', color: BakeryColors.cocoaDark },
  dot: { position: 'absolute', right: -1, bottom: -1, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: BakeryColors.frosting },
  dotOn: { backgroundColor: '#5BC47B' },
  dotOff: { backgroundColor: BakeryColors.latte },
  name: { flex: 1, fontSize: 15, fontWeight: '800', color: BakeryColors.cocoaDark },
  label: { fontSize: 14, fontWeight: '800', color: BakeryColors.cocoaDark },
  lenGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  lenCard: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.three,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    backgroundColor: BakeryColors.glass,
  },
  lenCardActive: { borderColor: BakeryColors.honey, backgroundColor: BakeryColors.cream },
  lenNum: { fontSize: 22, fontWeight: '900', color: BakeryColors.mocha },
  lenNumActive: { color: BakeryColors.cocoaDark },
  lenLabel: { fontSize: 12, color: BakeryColors.mocha },
  hint: { fontSize: 12, color: BakeryColors.mocha, textAlign: 'center' },
  actions: { gap: Spacing.two, paddingVertical: Spacing.two },
  inviteBtn: { paddingVertical: 11, borderRadius: BakeryRadii.button, alignItems: 'center', backgroundColor: BakeryColors.glass, borderWidth: 1.5, borderColor: BakeryColors.shortbread },
  inviteText: { fontSize: 15, fontWeight: '800', color: BakeryColors.mocha },
  startBtn: { paddingVertical: 14, borderRadius: BakeryRadii.button, alignItems: 'center', backgroundColor: BakeryColors.honey },
  startText: { fontSize: 16, fontWeight: '900', color: BakeryColors.cocoaDark },
  cancel: { alignItems: 'center', paddingVertical: Spacing.one },
  cancelText: { fontSize: 13, fontWeight: '700', color: BakeryColors.mocha },
  pressed: { opacity: 0.85 },
});
