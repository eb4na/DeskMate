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
import { autoBreakMinutes, SESSION_LENGTHS } from '@/constants/placeholder-data';
import { bunAvatarNudge, getCompanionImage } from '@/lib/companion-utils';
import { useApp, MAX_TIMER_PRESETS } from '@/context/app-context';
import { formatMinutesShort } from '@/lib/format-duration';
import { showPopup } from '@/lib/popup';
import { useStudyRoom, STUDY_ROOM_MAX } from '@/lib/use-study-room';
import { localizeSubjectName } from '@/lib/subject-utils';
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
  const { active, isHost, canStartSelf, myCode, roster, presentCodes, netStatus, roomId, start, startSelf, leaveRoom, setMyPrefs, setMyBreak } = useStudyRoom();
  const { subjects, isPlus, savedTimerPresets, saveTimerPreset, deleteTimerPreset } = useApp();
  // Custom-length matrix (per player):
  //  - own Plus (host or guest)            → wheel + saved presets (+ add)
  //  - no Plus, but the HOST has Plus      → wheel only (shared perk, no presets)
  //  - no Plus and a non-Plus host         → the standard default lengths
  const hostIsPlus = !!roster.find((e) => e.isHost)?.isPlus;
  const canCustom = isPlus || hostIsPlus;
  const clampCustom = (m: number) => Math.max(5, Math.min(300, m));
  const activeSubjects = subjects.filter((s) => !s.archived).sort((a, b) => a.order - b.order);

  // A length may be passed in from the Start Session screen; use it as the default
  // but still show the pickers here so this player can change it.
  const { minutes: minutesParam } = useLocalSearchParams<{ minutes?: string }>();
  const parsedPreset = Number(minutesParam);
  const presetMinutes = Number.isFinite(parsedPreset) && parsedPreset > 0 ? parsedPreset : null;
  const [minutes, setMinutes] = useState(presetMinutes ?? 30);
  // This player's chosen topic (subject name), or null = not chosen yet.
  const [topic, setTopic] = useState<string | null>(null);

  // Everyone picks their own length + topic up front; broadcast the choice so every
  // member's avatar shows it, and so this player's session runs with their picks.
  const applyPrefs = (nextMinutes: number, nextTopic: string | null) => {
    setMinutes(nextMinutes);
    setTopic(nextTopic);
    setMyPrefs(nextMinutes, nextTopic);
  };
  const pickMinutes = (m: number) => applyPrefs(m, topic);
  // Save the currently dialed length as a preset — same session-length-only
  // presets as the Custom Timer screen. At the cap, the replace picker below
  // makes the player delete one to make room.
  const [showReplace, setShowReplace] = useState(false);
  const savePresetNow = (mins: number) => {
    saveTimerPreset({ label: formatMinutesShort(mins, t), minutes: mins });
    showPopup(t('customTimer.presetSaved'));
  };
  const handleAddPreset = () => {
    if (savedTimerPresets.length >= MAX_TIMER_PRESETS) { setShowReplace(true); return; }
    savePresetNow(minutes);
  };
  const replaceWith = (id: string) => {
    deleteTimerPreset(id);
    savePresetNow(minutes);
    setShowReplace(false);
  };
  // Tapping the selected topic again clears it (back to "not chosen").
  const pickTopic = (name: string) => applyPrefs(minutes, topic === name ? null : name);
  useEffect(() => {
    // Run once on mount so the default length is recorded/broadcast even if untouched.
    setMyPrefs(minutes, topic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Break length is no longer pickable — every player just gets the SINGLE-PLAYER
  // default break for their chosen duration (autoBreakMinutes: 5m under an hour, 15m
  // at/over), kept in sync as they change the length.
  useEffect(() => {
    setMyBreak(autoBreakMinutes(minutes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes]);

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
              const topicLabel = e.topic ? localizeSubjectName(e.topic, t) : null;
              const pref = minsLabel && topicLabel ? `${minsLabel} · ${topicLabel}` : minsLabel ?? topicLabel ?? '—';
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

          {/* Session length — each player picks their own. Plus members get the full
              hr/min wheel (same as the solo custom timer); everyone else — host
              included — gets the preset cards. Either way the chosen value rides the
              same per-player prefs sync. */}
          <Text style={styles.label}>{t('lobby.sessionLength')}</Text>
          {canCustom ? (
            <>
              <DurationWheel
                minutes={minutes}
                onChange={(m) => pickMinutes(clampCustom(m))}
                scale={scale}
              />
              {/* Saved presets — like the wheel, gated on this player's own Plus.
                  Tapping one applies its session length (broadcast) and its saved
                  break (personal). */}
              {isPlus && (
                <>
                  <Text style={styles.presetHeader}>{t('sessionPicker.presetsHeader')}</Text>
                  <View style={styles.topicRow}>
                    {savedTimerPresets.map((p) => {
                      // Presets are session-length only — applying one never touches
                      // this player's break choice.
                      const isActive = minutes === clampCustom(p.minutes);
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => pickMinutes(clampCustom(p.minutes))}
                          style={[styles.topicChip, styles.presetChip, isActive && styles.topicChipActive]}>
                          <Text style={[styles.topicText, isActive && styles.topicTextActive]} numberOfLines={1}>
                            {p.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                    {/* ＋ saves the currently dialed wheel length as a new preset. */}
                    <SoundPressable
                      sound="confirm"
                      onPress={handleAddPreset}
                      style={({ pressed }) => [styles.topicChip, styles.presetChip, styles.presetAdd, pressed && styles.pressed]}>
                      <Text style={[styles.topicText, styles.presetAddText]}>{t('common.addChip')}</Text>
                    </SoundPressable>
                  </View>
                </>
              )}
            </>
          ) : (
            // No custom-timer perk here → pick from the standard preset lengths (the
            // same set as the solo Start Session screen), so the length isn't frozen to
            // whatever was chosen before entering multiplayer. The arbitrary hr/min
            // wheel stays a Plus perk. Each player's pick rides the same per-player sync.
            <View style={styles.topicRow}>
              {SESSION_LENGTHS.map((opt) => (
                <Pressable
                  key={opt.minutes}
                  onPress={() => pickMinutes(opt.minutes)}
                  style={[styles.topicChip, minutes === opt.minutes && styles.topicChipActive]}>
                  <Text style={[styles.topicText, minutes === opt.minutes && styles.topicTextActive]}>
                    {t('lobby.minShort', { n: opt.minutes })}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Topic — pick a subject to study; shows on your avatar. */}
          <Text style={styles.label}>{t('lobby.topic')}</Text>
          <View style={styles.topicRow}>
            {activeSubjects.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => pickTopic(s.name)}
                style={[styles.topicChip, topic === s.name && styles.topicChipActive]}>
                {s.emoji ? <Text style={styles.topicEmoji}>{s.emoji}</Text> : null}
                <Text style={[styles.topicText, topic === s.name && styles.topicTextActive]} numberOfLines={1}>{localizeSubjectName(s.name, t)}</Text>
              </Pressable>
            ))}
            {/* ＋ adds a subject without leaving the room: Manage Subjects opens as a
                sheet over this screen (the same push the solo picker uses), and the
                realtime room lives in StudyRoomProvider, so nobody drops out. */}
            <SoundPressable
              sound="confirm"
              onPress={() => router.push('/manage-subjects')}
              style={({ pressed }) => [styles.topicChip, styles.presetAdd, pressed && styles.pressed]}>
              <Text style={[styles.topicText, styles.presetAddText]}>{t('common.addChip')}</Text>
            </SoundPressable>
          </View>

          {/* Break time is no longer pickable in multiplayer — every player just gets
              the same default timed break as single player (see the setMyBreak effect
              above), so the wheel was removed. */}
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
                onPress={() => start({ durationMinutes: minutes, subjectName: topic, taskId: null, taskTitle: null, breakMinutes: autoBreakMinutes(minutes) })}
                style={({ pressed }) => [styles.startBtn, tw('startBtn'), pressed && styles.pressed]}>
                <Text style={styles.startText}>{t('lobby.startStudying')}</Text>
              </SoundPressable>
            </>
          ) : canStartSelf ? (
            // The room is already running — this is a late joiner. They start their
            // own session (their own clock + chosen length) whenever ready.
            <SoundPressable
              sound="confirm"
              onPress={() => startSelf({ durationMinutes: minutes, subjectName: topic, taskId: null, taskTitle: null, breakMinutes: autoBreakMinutes(minutes) })}
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

      {/* Replace-a-preset picker — in-tree overlay (NOT a native Modal, so it can't
          stack-freeze). Shown when ＋ is tapped at the preset cap: the player picks
          which saved preset the new length replaces. */}
      {showReplace && (
        <View style={styles.replaceOverlay}>
          <View style={styles.replaceCard}>
            <Text style={styles.replaceTitle}>{t('customTimer.presetLimitTitle')}</Text>
            <Text style={styles.replaceSub}>{t('customTimer.presetLimitSub', { max: MAX_TIMER_PRESETS })}</Text>
            {savedTimerPresets.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [styles.replaceRow, pressed && styles.pressed]}
                onPress={() => replaceWith(p.id)}>
                <Text style={styles.replaceRowName} numberOfLines={1}>{p.label}</Text>
                <Text style={styles.replaceRowAction}>{t('customTimer.replaceAction')}</Text>
              </Pressable>
            ))}
            <Pressable style={({ pressed }) => [styles.replaceCancel, pressed && styles.pressed]} onPress={() => setShowReplace(false)}>
              <Text style={styles.replaceCancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      )}
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
  // Saved-preset chips lay out as a tidy 3-per-row grid (unlike the free-flowing
  // topic chips): 3 × 31% + 2 gaps fits the row on phone and tablet alike.
  presetChip: { width: '31%', alignItems: 'center' },
  // Dashed "add a preset" chip at the end of the grid.
  presetAdd: { borderColor: BakeryColors.jam, borderStyle: 'dashed', backgroundColor: 'transparent' },
  presetAddText: { color: BakeryColors.berry },
  // Replace-a-preset overlay (at the preset cap).
  replaceOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(74,49,42,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.four,
  },
  replaceCard: {
    width: '100%', maxWidth: 420 * s,
    backgroundColor: BakeryColors.frosting, borderRadius: BakeryRadii.card * s,
    borderWidth: 1.5, borderColor: BakeryColors.shortbread,
    padding: Spacing.four * s, gap: Spacing.two * s,
  },
  replaceTitle: { fontSize: 18 * s, fontWeight: '900', color: BakeryColors.cocoaDark, textAlign: 'center' },
  replaceSub: { fontSize: 13 * s, color: BakeryColors.mocha, textAlign: 'center', fontWeight: '600', marginBottom: Spacing.one * s },
  replaceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two * s,
    backgroundColor: '#fff', borderRadius: BakeryRadii.button,
    borderWidth: 1.5, borderColor: BakeryColors.shortbread,
    paddingHorizontal: 14 * s, paddingVertical: 12 * s,
  },
  replaceRowName: { flex: 1, fontSize: 14.5 * s, fontWeight: '800', color: BakeryColors.cocoaDark },
  replaceRowAction: { fontSize: 13 * s, fontWeight: '900', color: BakeryColors.berry },
  replaceCancel: { alignItems: 'center', paddingVertical: 8 * s },
  replaceCancelText: { fontSize: 14 * s, fontWeight: '800', color: BakeryColors.mocha },
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
  // Read-only length shown when this player can't customize (no Plus, non-Plus host).
  fixedLenCard: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 4 * s,
    paddingVertical: Spacing.four * s, borderRadius: BakeryRadii.card,
    borderWidth: 1.5, borderColor: BakeryColors.shortbread, backgroundColor: BakeryColors.glass,
  },
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
  presetHeader: { fontSize: 11 * s, fontWeight: '800', color: BakeryColors.latte, letterSpacing: 1, marginTop: Spacing.one },
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
