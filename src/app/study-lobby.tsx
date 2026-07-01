import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DevKnobs } from '@/components/dev-knobs';
import { DurationWheel } from '@/components/duration-wheel';
import { ThemedView } from '@/components/themed-view';
import { usePosTweaks } from '@/hooks/use-pos-tweaks';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { SESSION_LENGTHS } from '@/constants/placeholder-data';
import { bunAvatarNudge, getCompanionImage } from '@/lib/companion-utils';
import { useApp } from '@/context/app-context';
import { useStudyRoom, STUDY_ROOM_MAX } from '@/lib/use-study-room';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, Spacing } from '@/constants/theme';

// Lobby for a synced multiplayer study room: players gather, the host picks a
// duration and starts. The realtime connection lives in StudyRoomProvider, so
// it survives the transition to the home screen once the session begins.
const LOBBY_ELEMENTS = [
  { name: 'title', label: 'Title' },
  { name: 'inviteBtn', label: 'Invite btn' },
  { name: 'startBtn', label: 'Start btn' },
  { name: 'cancel', label: 'Leave btn' },
];

export default function StudyLobbyScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Scale text + cards proportionally to the device (1× on phones, ~1.1–1.7× on
  // tablets by screen ratio) so nothing renders tiny/clipped on larger screens.
  const { scale, contentWidth } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale, contentWidth), [scale, contentWidth]);
  const { knobs: twKnobs, onChange: twChange, t: tw } = usePosTweaks('studylobby', LOBBY_ELEMENTS);
  const { active, isHost, canStartSelf, myCode, roster, presentCodes, netStatus, roomId, start, startSelf, leaveRoom, setMyPrefs } = useStudyRoom();
  const { subjects, isPlus } = useApp();
  // Custom length is a Plus perk. It's offered to everyone in the room when the
  // HOST has Plus (the host shares their perk with guests) — or to a Plus member
  // for their own session. Guests still can't save presets (the lobby has none).
  const hostIsPlus = !!roster.find((e) => e.isHost)?.isPlus;
  const canCustom = isPlus || hostIsPlus;
  // Show the "thanks to your host" note only when it's unlocked BY the host (not
  // by this player's own Plus).
  const customViaHost = !isPlus && hostIsPlus;
  const clampCustom = (m: number) => Math.max(5, Math.min(300, m));
  const activeSubjects = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);

  // A length may be passed in from the Start Session screen; use it as the default
  // but still show the picker here so this player can change it.
  const { minutes: minutesParam } = useLocalSearchParams<{ minutes?: string }>();
  const parsedPreset = Number(minutesParam);
  const presetMinutes = Number.isFinite(parsedPreset) && parsedPreset > 0 ? parsedPreset : null;
  const [minutes, setMinutes] = useState(presetMinutes ?? 30);
  // This player's chosen topic (subject name), or null = not chosen yet.
  const [topic, setTopic] = useState<string | null>(null);
  // Host-set room break length (minutes) — a Plus HOST perk. 0 = no timed break
  // (the room keeps its free on/off break). Applies to everyone once the host starts.
  const [breakMins, setBreakMins] = useState(0);
  const BREAK_PICKS = [0, 5, 10, 15, 20];
  const canSetBreak = isHost && isPlus;

  // Everyone picks their own length + topic up front; broadcast the choice so every
  // member's avatar shows it, and so this player's session runs with their picks.
  const applyPrefs = (nextMinutes: number, nextTopic: string | null) => {
    setMinutes(nextMinutes);
    setTopic(nextTopic);
    setMyPrefs(nextMinutes, nextTopic);
  };
  const pickMinutes = (m: number) => applyPrefs(m, topic);
  // Tapping the selected topic again clears it (back to "not chosen").
  const pickTopic = (name: string) => applyPrefs(minutes, topic === name ? null : name);
  useEffect(() => {
    // Run once on mount so the default length is recorded/broadcast even if untouched.
    setMyPrefs(minutes, topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <View style={[styles.header, tw('title')]}>
            <Text style={styles.title}>{t('lobby.studyRoom')}</Text>
            <Text style={styles.subtitle}>
              {connecting
                ? t('lobby.connecting', { status: netStatus || t('lobby.starting') })
                : t('lobby.roomStatus', { inRoom: roster.length, max: STUDY_ROOM_MAX, connected: presentCodes.length })}
            </Text>
          </View>

          {/* Roster — a row of circular avatars, each captioned with that member's
              chosen length + topic (synced live from everyone's lobby picks). */}
          <View style={styles.roster}>
            {roster.map((e) => {
              const present = presentCodes.includes(e.code);
              const minsLabel = e.minutes ? t('lobby.minShort', { n: e.minutes }) : null;
              const pref = minsLabel && e.topic ? `${minsLabel} · ${e.topic}` : minsLabel ?? e.topic ?? '—';
              return (
                <View key={e.code} style={styles.member}>
                  <View style={styles.avatarCircle}>
                    {e.companionId !== undefined || e.skinId !== undefined ? (
                      <Image source={getCompanionImage(e.companionId, e.skinId)} style={[styles.avatarImg, bunAvatarNudge(e.companionId)]} contentFit="contain" />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarText}>{(e.name[0] ?? '?').toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={[styles.dot, present ? styles.dotOn : styles.dotOff]} />
                  </View>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {e.name}{e.code === myCode ? ` ${t('lobby.you')}` : ''}
                  </Text>
                  <Text style={styles.memberPref} numberOfLines={2}>{pref}</Text>
                </View>
              );
            })}
          </View>

          {/* Session length — each player picks their own. Plus members (or anyone in
              a Plus host's room) get the full hr/min wheel (same as the solo custom
              timer); everyone else gets the preset cards. Either way the chosen value
              rides the same per-player prefs sync. */}
          <Text style={styles.label}>{t('lobby.sessionLength')}</Text>
          {canCustom ? (
            <>
              <DurationWheel
                minutes={minutes}
                onChange={(m) => pickMinutes(clampCustom(m))}
                picks={SESSION_LENGTHS.map((o) => o.minutes)}
                scale={scale}
              />
              {customViaHost && <Text style={styles.customNote}>{t('lobby.hostPlusCustom')}</Text>}
            </>
          ) : (
            <View style={styles.lenGrid}>
              {SESSION_LENGTHS.map((opt) => (
                <Pressable
                  key={opt.minutes}
                  onPress={() => pickMinutes(opt.minutes)}
                  style={[styles.lenCard, minutes === opt.minutes && styles.lenCardActive]}>
                  <Text style={[styles.lenNum, minutes === opt.minutes && styles.lenNumActive]}>{opt.minutes}</Text>
                  <Text style={styles.lenLabel}>{t('lobby.min')}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Topic — pick a subject to study; shows on your avatar. */}
          <Text style={styles.label}>{t('lobby.topic')}</Text>
          {activeSubjects.length === 0 ? (
            <Text style={styles.hint}>{t('lobby.noSubjectsHint')}</Text>
          ) : (
            <View style={styles.topicRow}>
              {activeSubjects.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => pickTopic(s.name)}
                  style={[styles.topicChip, topic === s.name && styles.topicChipActive]}>
                  {s.emoji ? <Text style={styles.topicEmoji}>{s.emoji}</Text> : null}
                  <Text style={[styles.topicText, topic === s.name && styles.topicTextActive]} numberOfLines={1}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Break time — a Plus HOST perk. The host picks one break length for the
              whole room; everyone then gets a personal timed break of that length
              (freeze + auto-resume). 0 = keep the free on/off break. */}
          {canSetBreak && (
            <>
              <Text style={styles.label}>{t('lobby.breakTime')}</Text>
              <View style={styles.topicRow}>
                {BREAK_PICKS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setBreakMins(m)}
                    style={[styles.topicChip, breakMins === m && styles.topicChipActive]}>
                    <Text style={[styles.topicText, breakMins === m && styles.topicTextActive]}>
                      {m === 0 ? t('lobby.breakOff') : t('lobby.minShort', { n: m })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.actions}>
          {isHost ? (
            <>
              <SoundPressable
                onPress={() => router.push({ pathname: '/party-invite', params: { room: roomId ?? '', game: 'study' } })}
                style={({ pressed }) => [styles.inviteBtn, tw('inviteBtn'), pressed && styles.pressed]}>
                <Text style={styles.inviteText}>{t('lobby.inviteFriend')}</Text>
              </SoundPressable>
              <SoundPressable
                sound="confirm"
                onPress={() => start({ durationMinutes: minutes, subjectName: topic, taskId: null, taskTitle: null, ...(breakMins > 0 ? { breakMinutes: breakMins } : {}) })}
                style={({ pressed }) => [styles.startBtn, tw('startBtn'), pressed && styles.pressed]}>
                <Text style={styles.startText}>{t('lobby.startStudying')}</Text>
              </SoundPressable>
            </>
          ) : canStartSelf ? (
            // The room is already running — this is a late joiner. They start their
            // own session (their own clock + chosen length) whenever ready.
            <SoundPressable
              sound="confirm"
              onPress={() => startSelf({ durationMinutes: minutes, subjectName: topic, taskId: null, taskTitle: null })}
              style={({ pressed }) => [styles.startBtn, tw('startBtn'), pressed && styles.pressed]}>
              <Text style={styles.startText}>{t('lobby.startStudying')}</Text>
            </SoundPressable>
          ) : (
            <Text style={styles.hint}>{t('lobby.waitingHost')}</Text>
          )}
          <Pressable onPress={leave} style={[styles.cancel, tw('cancel')]}>
            <Text style={styles.cancelText}>{t('lobby.leave')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      <DevKnobs screen="studylobby" knobs={twKnobs} onChange={twChange} />
    </ThemedView>
  );
}

// Sizes are multiplied by `s` (the tablet scale) so text + cards grow proportionally
// with the screen and stay legible/visible on any device; `s` is 1 on phones (no-op).
const makeStyles = (s: number, contentWidth: number) => StyleSheet.create({
  container: { flex: 1, backgroundColor: BakeryColors.frosting },
  safe: { flex: 1, width: '100%', maxWidth: contentWidth, alignSelf: 'center', paddingHorizontal: Spacing.four },
  scroll: { paddingTop: Spacing.three, gap: Spacing.three * s, paddingBottom: Spacing.three },
  header: { gap: 4 * s, alignItems: 'center' },
  title: { fontSize: 24 * s, fontWeight: '900', color: BakeryColors.cocoaDark },
  subtitle: { fontSize: 13 * s, color: BakeryColors.mocha },
  roster: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.three * s, paddingVertical: Spacing.two },
  member: { alignItems: 'center', width: 96 * s, gap: 3 * s },
  // The cream ring is just a backing "seat" — it must NOT clip the companion art
  // (no overflow:hidden), so the full bunny/figure shows and isn't cut at the edges.
  avatarCircle: {
    width: 66 * s, height: 66 * s, borderRadius: 33 * s,
    backgroundColor: BakeryColors.cream,
    borderWidth: 2, borderColor: BakeryColors.shortbread,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarImg: { width: 66 * s, height: 66 * s },
  avatarFallback: { width: 66 * s, height: 66 * s, backgroundColor: BakeryColors.shortbread, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24 * s, fontWeight: '900', color: BakeryColors.cocoaDark },
  dot: { position: 'absolute', right: 3 * s, bottom: 3 * s, width: 14 * s, height: 14 * s, borderRadius: 7 * s, borderWidth: 2, borderColor: BakeryColors.frosting },
  dotOn: { backgroundColor: '#5BC47B' },
  dotOff: { backgroundColor: BakeryColors.latte },
  memberName: { fontSize: 13 * s, fontWeight: '800', color: BakeryColors.cocoaDark, maxWidth: 96 * s, textAlign: 'center' },
  memberPref: { fontSize: 11 * s, fontWeight: '700', color: BakeryColors.mocha, maxWidth: 96 * s, textAlign: 'center' },
  label: { fontSize: 14 * s, fontWeight: '800', color: BakeryColors.cocoaDark },
  topicRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  topicChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5 * s,
    paddingHorizontal: Spacing.three * s, paddingVertical: 9 * s,
    borderRadius: BakeryRadii.pill, borderWidth: 1.5,
    borderColor: BakeryColors.shortbread, backgroundColor: BakeryColors.glass,
  },
  topicChipActive: { borderColor: '#F7A7B8', backgroundColor: BakeryColors.rose },
  topicEmoji: { fontSize: 14 * s },
  topicText: { fontSize: 13 * s, fontWeight: '700', color: BakeryColors.mocha },
  topicTextActive: { color: BakeryColors.cocoaDark },
  lenGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  lenCard: {
    width: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4 * s,
    paddingVertical: Spacing.three * s,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    backgroundColor: BakeryColors.glass,
  },
  lenCardActive: { borderColor: '#F7A7B8', backgroundColor: BakeryColors.rose },
  lenNum: { fontSize: 22 * s, fontWeight: '900', color: BakeryColors.mocha },
  lenNumActive: { color: BakeryColors.cocoaDark },
  lenLabel: { fontSize: 12 * s, color: BakeryColors.mocha },
  customRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.three * s },
  stepBtn: {
    width: 44 * s, height: 44 * s, borderRadius: 22 * s,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: BakeryColors.glass, borderWidth: 1.5, borderColor: BakeryColors.shortbread,
  },
  stepText: { fontSize: 24 * s, fontWeight: '900', color: BakeryColors.cocoaDark, marginTop: -2 },
  customDisplay: { flexDirection: 'row', alignItems: 'baseline', gap: 4 * s, minWidth: 92 * s, justifyContent: 'center' },
  customNum: { fontSize: 30 * s, fontWeight: '900', color: BakeryColors.cocoaDark },
  customUnit: { fontSize: 13 * s, fontWeight: '700', color: BakeryColors.mocha },
  customNote: { fontSize: 11.5 * s, fontWeight: '700', color: BakeryColors.mocha, textAlign: 'center' },
  hint: { fontSize: 12 * s, color: BakeryColors.mocha, textAlign: 'center' },
  actions: { gap: Spacing.two, paddingVertical: Spacing.two },
  inviteBtn: { paddingVertical: 11 * s, borderRadius: BakeryRadii.button, alignItems: 'center', backgroundColor: BakeryColors.glass, borderWidth: 1.5, borderColor: BakeryColors.shortbread },
  inviteText: { fontSize: 15 * s, fontWeight: '800', color: BakeryColors.mocha },
  startBtn: { paddingVertical: 14 * s, borderRadius: BakeryRadii.button, alignItems: 'center', backgroundColor: '#F7A7B8' },
  startText: { fontSize: 16 * s, fontWeight: '900', color: BakeryColors.cocoaDark },
  cancel: { alignItems: 'center', paddingVertical: Spacing.one },
  cancelText: { fontSize: 13 * s, fontWeight: '700', color: BakeryColors.mocha },
  pressed: { opacity: 0.85 },
});
