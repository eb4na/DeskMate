import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CoinIcon } from '@/components/coin-icon';
import { StudyBook } from '@/components/study-book';
import { SubjectPickerModal } from '@/components/subject-picker-modal';
import { ThemedText } from '@/components/themed-text';
import { useApp } from '@/context/app-context';
import { coinsForMinutes } from '@/constants/placeholder-data';
import { SoundPickerModal } from '@/components/sound-picker-modal';
import { showLoadingScreen } from '@/lib/loading-signal';
import { getCompanionImage, resolveActiveCompanion } from '@/lib/companion-utils';
import { useStudyRoom, type StudyStatus } from '@/lib/use-study-room';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';

const BUN_STUDYING = require('@/assets/images/bun/bun-studying.png');
const TIMER_CARD = require('@/assets/images/study/timer-card.png');
const AVATAR_FRAME = require('@/assets/images/study/avatar-frame.png');
const PPL_ICON = require('@/assets/images/study/ppl-icon.png');
const BREAK_PILL = require('@/assets/images/study/break-pill.png');
const DESK = require('@/assets/images/home/desk-new.png');
const STUDY_RADIO = require('@/assets/images/home/study-radio.png');
const PAUSE_BTN = require('@/assets/images/study/pause-btn.png');
const PLAY_BTN = require('@/assets/images/study/play-btn.png');
const GAME_BTN = require('@/assets/images/study/game-btn.png');

function format(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const DOT_COLOR: Record<StudyStatus, string> = {
  studying: '#5BC47B',
  break: '#F0B44A',
  idle: BakeryColors.latte,
};

/**
 * The "studying together" screen shown while a session runs. Works solo (one
 * participant) or in a synced study room (up to 4). The session lifecycle
 * (completion → /session-complete) stays in the Home screen; this is the view.
 */
export function StudyRoomView({
  secondsLeft,
  onStop,
  onBreakGame,
}: {
  secondsLeft: number;
  onStop: () => void;
  onBreakGame: () => void;
}) {
  const { t } = useTranslation();
  const {
    activeSession,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
    profileDisplayName,
    friendCode,
    shiftSessionStart,
    startActiveSession,
    clearActiveSession,
    addCoins,
    recordSession,
    addSubjectTime,
  } = useApp();
  const room = useStudyRoom();

  // My status (studying/break), toggled by the Break button in a room.
  const [onBreak, setOnBreak] = useState(false);
  // Single-player: one timed break of floor(total/12) min, then auto-resume.
  const [breakUsed, setBreakUsed] = useState(false);
  const [breakLeft, setBreakLeft] = useState(0); // seconds remaining in the break
  const [frozenSecs, setFrozenSecs] = useState<number | null>(null); // study time frozen during break
  // Multiplayer: each player picks their own subject when the session begins.
  const [mpSubjectPicked, setMpSubjectPicked] = useState(false);
  // Radio: pick a bought sound to play while studying.
  const [soundOpen, setSoundOpen] = useState(false);

  // Make sure I'm marked studying when a synced session begins.
  useEffect(() => {
    if (room.active && room.begun) {
      room.setStatus(onBreak ? 'break' : 'studying');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.active, room.begun]);

  // Leave the room when the session view goes away (session ended).
  useEffect(() => {
    return () => {
      if (room.active) room.leaveRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins);
  // Use the companion's original art (not a reading pose) while studying.
  const bigCharacter = me.imageSource ?? BUN_STUDYING;

  // Solo (no synced room) vs multiplayer changes what's shown.
  const isSolo = !room.active;
  const breakMinutes = activeSession?.breakMinutes && activeSession.breakMinutes > 0
    ? activeSession.breakMinutes
    : Math.max(1, Math.floor((activeSession?.durationMinutes ?? 25) / 12));

  // Single-player break: tick the countdown, then auto-resume at zero.
  useEffect(() => {
    if (!(isSolo && onBreak)) return;
    const id = setInterval(() => setBreakLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [isSolo, onBreak]);
  useEffect(() => {
    if (isSolo && onBreak && breakLeft === 0) {
      setOnBreak(false);
      setFrozenSecs(null);
    }
  }, [isSolo, onBreak, breakLeft]);

  // Participants: the synced roster, or just me when solo. The local user
  // (active companion) is always shown first.
  const rawParticipants =
    room.roster.length > 0
      ? room.roster
      : [{ code: friendCode, name: profileDisplayName || t('studyRoom.defaultName'), isHost: true, companionId: undefined, skinId: undefined }];
  const participants = [...rawParticipants].sort((a, b) =>
    a.code === friendCode ? -1 : b.code === friendCode ? 1 : 0,
  );
  const studyingCount = participants.length;

  // Multiplayer scene: everyone's character is shown, evenly spaced, and sized by
  // headcount — one person is biggest, more people shrink to share the row.
  const partyCount = Math.min(participants.length, 4);
  const partyCharSize = partyCount <= 1 ? 280 : partyCount === 2 ? 172 : partyCount === 3 ? 124 : 96;

  // Resolve a participant's live status (studying / break / idle).
  const participantStatus = (code: string | undefined): StudyStatus => {
    const present = code === friendCode || room.presentCodes.includes(code ?? '');
    if (!present) return 'idle';
    if (code === friendCode) return onBreak ? 'break' : 'studying';
    return room.statusMap[code ?? ''] ?? 'studying';
  };

  const handleBreak = () => {
    if (isSolo) {
      // One timed break per session; not interruptible (auto-resumes).
      if (breakUsed || onBreak) return;
      setBreakUsed(true);
      setFrozenSecs(secondsLeft); // freeze the study display
      shiftSessionStart(breakMinutes * 60); // pause the study timer
      setBreakLeft(breakMinutes * 60);
      setOnBreak(true);
    } else {
      // Multiplayer: soft break anytime, broadcast status.
      const next = !onBreak;
      setOnBreak(next);
      room.setStatus(next ? 'break' : 'studying');
    }
  };

  const breakDisabled = isSolo && (breakUsed || onBreak);
  const breakLabel = isSolo ? (onBreak ? t('studyRoom.breakOnBreak') : t('studyRoom.break')) : onBreak ? t('studyRoom.resume') : t('studyRoom.break');
  const breakIconSrc = !isSolo && onBreak ? PLAY_BTN : PAUSE_BTN;
  const displaySecs = isSolo && onBreak && frozenSecs != null ? frozenSecs : secondsLeft;

  const handleLeave = () => {
    if (room.active) room.leaveRoom();
    onStop();
  };

  const handleAddFriend = () => {
    if (room.active && room.roomId) {
      router.push({ pathname: '/party-invite', params: { room: room.roomId, game: 'study' } });
    } else {
      router.push('/friends');
    }
  };

  // Multiplayer: prompt each player to pick their own subject at the start.
  const needStartSubject = !isSolo && room.begun && !mpSubjectPicked && !!activeSession;
  const pickStartSubject = (subjectName: string | null) => {
    setMpSubjectPicked(true);
    if (activeSession) {
      startActiveSession({
        durationMinutes: activeSession.durationMinutes,
        subjectName,
        taskId: activeSession.taskId,
        taskTitle: activeSession.taskTitle,
        startedAt: activeSession.startedAt,
        isMultiplayer: true,
      });
    }
  };

  // Multiplayer finish (no cake): credit coins once, then offer continue/break/exit.
  const [finishPickerOpen, setFinishPickerOpen] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const creditedRef = useRef<string | null>(null);
  const mpFinished = !!activeSession?.isMultiplayer && secondsLeft <= 0;

  useEffect(() => {
    if (mpFinished && activeSession && creditedRef.current !== activeSession.id) {
      creditedRef.current = activeSession.id;
      const earned = coinsForMinutes(activeSession.durationMinutes);
      addCoins(earned);
      recordSession(activeSession.durationMinutes);
      addSubjectTime(activeSession.subjectName, activeSession.durationMinutes);
      setCoinsEarned(earned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpFinished, activeSession?.id]);

  const restartWithSubject = (subjectName: string | null) => {
    if (!activeSession) return;
    startActiveSession({
      durationMinutes: activeSession.durationMinutes,
      subjectName,
      taskId: null,
      taskTitle: null,
      startedAt: new Date().toISOString(),
      isMultiplayer: true,
    });
    setFinishPickerOpen(false);
    setMpSubjectPicked(true);
    setOnBreak(false);
  };

  const handleFinishExit = () => {
    room.leaveRoom();
    clearActiveSession();
    showLoadingScreen();
  };

  return (
    <View style={styles.root}>
      {/* Radio — pick a bought sound (top left) */}
      <Pressable onPress={() => setSoundOpen(true)} style={({ pressed }) => [styles.radioBtn, pressed && styles.pressed]} hitSlop={8}>
        <Image source={STUDY_RADIO} style={styles.radioImg} contentFit="contain" />
      </Pressable>

      {/* Add-friend button (top right) — multiplayer only */}
      {!isSolo && (
        <Pressable onPress={handleAddFriend} style={({ pressed }) => [styles.addFriendBtn, pressed && styles.pressed]} hitSlop={8}>
          <Text style={styles.addFriendIcon}>＋</Text>
          <Text style={styles.addFriendLabel}>{t('studyRoom.friend')}</Text>
        </Pressable>
      )}

      {/* Timer card */}
      <View style={[styles.timerWrap, isSolo && styles.timerWrapSolo]}>
        <Image source={TIMER_CARD} style={StyleSheet.absoluteFill} contentFit="contain" pointerEvents="none" />
        <View style={styles.timerText}>
          <Text style={[styles.timer, isSolo && styles.timerSolo]}>{format(displaySecs)}</Text>
          <Text style={styles.bakeLabel}>{t('studyRoom.cakeBaking')}</Text>
          {!isSolo && (
            <View style={styles.studyingRow}>
              <Image source={PPL_ICON} style={styles.pplIcon} contentFit="contain" />
              <Text style={styles.bakeSub}>
                {studyingCount === 1 ? t('studyRoom.oneStudying') : t('studyRoom.studyingTogether', { count: studyingCount })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Participant row (multiplayer only) */}
      {!isSolo && (
      <View style={styles.participantRow}>
        {participants.slice(0, 4).map((p) => {
          const present = p.code === friendCode || room.presentCodes.includes(p.code);
          const status: StudyStatus = !present ? 'idle' : p.code === friendCode ? (onBreak ? 'break' : 'studying') : room.statusMap[p.code] ?? 'studying';
          const img = p.code === friendCode ? bigCharacter : getCompanionImage(p.companionId, p.skinId);
          return (
            <View key={p.code} style={styles.participant}>
              {/* Frame first; the face circle sits on top of the frame's solid
                  interior so the ring shows around it. */}
              <Image source={AVATAR_FRAME} style={styles.partFrame} contentFit="fill" pointerEvents="none" />
              <View style={styles.partFace}>
                <Image source={img} style={styles.partFaceImg} contentFit="cover" contentPosition="top" />
              </View>
              <View style={[styles.partDot, { backgroundColor: DOT_COLOR[status] }]} />
              <Text style={styles.partName} numberOfLines={1}>{p.code === friendCode ? t('studyRoom.you') : p.name}</Text>
            </View>
          );
        })}
      </View>
      )}

      {/* Characters behind the desk. Solo shows one big like Home; multiplayer
          shows everyone's character — evenly spaced, sized by headcount, each
          with a live status dot (or 💤 on break). */}
      <View style={styles.scene}>
        {isSolo ? (
          <Image source={bigCharacter} style={[styles.character, styles.characterSolo]} contentFit="contain" />
        ) : (
          <View style={styles.partyRow}>
            {participants.slice(0, 4).map((p) => {
              const status = participantStatus(p.code);
              const img = p.code === friendCode ? bigCharacter : getCompanionImage(p.companionId, p.skinId);
              return (
                <View key={p.code} style={[styles.partyMember, { width: partyCharSize }]}>
                  {status === 'break' ? (
                    <View style={styles.partyStatusPill}><Text style={styles.partyStatusEmoji}>💤</Text></View>
                  ) : (
                    <View style={[styles.partyDot, { backgroundColor: DOT_COLOR[status] }]} />
                  )}
                  <Image source={img} style={{ width: partyCharSize, height: partyCharSize }} contentFit="contain" />
                </View>
              );
            })}
          </View>
        )}
        <Image source={DESK} style={styles.deskStrip} contentFit="cover" pointerEvents="none" />
        <View style={styles.deskEdge} pointerEvents="none" />
        {/* Open book on the desk — pages flip while studying, freeze on break. */}
        <View style={styles.bookOnDesk} pointerEvents="none">
          <StudyBook active={!onBreak} size={104} />
        </View>
        {isSolo && onBreak && (
          <View style={styles.breakBadge}>
            <Text style={styles.breakBadgeText}>
              {t('studyRoom.onBreakTimer', { time: format(breakLeft) })}
            </Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable onPress={onBreakGame} style={({ pressed }) => [styles.gameBtnWrap, pressed && styles.pressed]} hitSlop={6}>
          <Image source={GAME_BTN} style={styles.gameBtn} contentFit="contain" />
        </Pressable>
        <Pressable
          onPress={handleBreak}
          disabled={breakDisabled}
          style={({ pressed }) => [styles.breakBtn, breakDisabled && styles.breakBtnDisabled, pressed && styles.pressed]}>
          <Image source={BREAK_PILL} style={StyleSheet.absoluteFill} contentFit="fill" pointerEvents="none" />
          <Text style={styles.breakBtnText}>{breakLabel}</Text>
          <Image source={breakIconSrc} style={styles.breakIcon} contentFit="contain" pointerEvents="none" />
        </Pressable>
      </View>
      <Pressable onPress={handleLeave} style={({ pressed }) => [styles.endBtn, pressed && styles.endBtnPressed]} hitSlop={8}>
        <Text style={styles.endBtnText}>{room.active ? t('studyRoom.leaveRoom') : t('session.endSession')}</Text>
      </Pressable>

      {/* Multiplayer: pick your own subject at the start */}
      <SubjectPickerModal
        visible={needStartSubject}
        title={t('studyRoom.whatStudying')}
        onPick={pickStartSubject}
        onClose={() => pickStartSubject(null)}
      />

      {/* Multiplayer finish menu (no cake) */}
      {mpFinished && (
        <View style={styles.finishOverlay}>
          <View style={styles.finishCard}>
            <Text style={styles.finishTitle}>{t('studyRoom.sessionComplete')}</Text>
            <View style={styles.coinRow}>
              <CoinIcon size={24} />
              <Text style={styles.coinText}>+{coinsEarned}</Text>
            </View>
            <Pressable onPress={() => setFinishPickerOpen(true)} style={({ pressed }) => [styles.finishBtn, pressed && styles.pressed]}>
              <Text style={styles.finishBtnText}>{t('studyRoom.differentSubject')}</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/study-desk')} style={({ pressed }) => [styles.finishBtn, pressed && styles.pressed]}>
              <Text style={styles.finishBtnText}>{t('studyRoom.takeBreak')}</Text>
            </Pressable>
            <Pressable onPress={handleFinishExit} style={({ pressed }) => [styles.finishBtnGhost, pressed && styles.pressed]}>
              <Text style={styles.finishBtnGhostText}>{t('studyRoom.exit')}</Text>
            </Pressable>
          </View>
        </View>
      )}
      <SubjectPickerModal
        visible={finishPickerOpen}
        title={t('studyRoom.studyDifferent')}
        onPick={restartWithSubject}
        onClose={() => setFinishPickerOpen(false)}
      />

      {/* Radio: pick a bought sound to play while studying */}
      <SoundPickerModal visible={soundOpen} onClose={() => setSoundOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.one, gap: Spacing.two },

  // Timer card
  timerWrap: { alignSelf: 'center', width: '52%', aspectRatio: 1032 / 838 },
  timerWrapSolo: { width: '72%' },
  timerText: { position: 'absolute', left: '11%', right: '11%', top: '30%', bottom: '12%', alignItems: 'center', justifyContent: 'center' },
  timer: { fontSize: 32, fontWeight: '900', color: BakeryColors.cocoaDark, letterSpacing: 1 },
  timerSolo: { fontSize: 46 },
  bakeLabel: { fontSize: 11, fontWeight: '700', color: BakeryColors.mocha, marginTop: 1 },
  studyingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  pplIcon: { width: 13, height: 13 },
  bakeSub: { fontSize: 10, color: BakeryColors.mocha },

  // Participant frames (frame art is 814×969; face circle, status dot and
  // nameplate positions are measured from it)
  participantRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  participant: { width: 72, height: 86, position: 'relative' },
  partFrame: { position: 'absolute', left: 0, top: 0, width: 72, height: 86 },
  partFace: { position: 'absolute', left: '8.8%', top: '7.4%', width: '82.2%', aspectRatio: 1, borderRadius: 999, overflow: 'hidden', backgroundColor: BakeryColors.cream },
  partFaceImg: { width: '116%', height: '116%', marginLeft: '-8%' },
  partDot: { position: 'absolute', left: '75.4%', top: '62.3%', width: '17%', aspectRatio: 1, borderRadius: 999, borderWidth: 2.5, borderColor: '#fff' },
  partName: { position: 'absolute', bottom: '4%', left: '8%', right: '8%', textAlign: 'center', fontSize: 10, fontWeight: '800', color: BakeryColors.cocoaDark },

  scene: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 150, position: 'relative' },
  character: { width: 172, height: 200, zIndex: 1, marginBottom: 0 },
  // Solo: match the Home-screen companion size (300×300) so it feels prominent.
  characterSolo: { width: 300, height: 300 },
  // Multiplayer party row — characters evenly spaced (equal gaps incl. the ends),
  // sitting behind the desk. Each member is bottom-aligned with a status marker.
  partyRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-evenly', zIndex: 1 },
  partyMember: { alignItems: 'center' },
  partyDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff', marginBottom: 3 },
  partyStatusPill: { backgroundColor: 'rgba(78,53,40,0.85)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, marginBottom: 3 },
  partyStatusEmoji: { fontSize: 13 },
  deskStrip: { position: 'absolute', left: -Spacing.three, right: -Spacing.three, bottom: 0, height: 64, zIndex: 2 },
  bookOnDesk: { position: 'absolute', bottom: 6, left: 0, right: 0, alignItems: 'center', zIndex: 6 },
  deskEdge: { position: 'absolute', left: -Spacing.three, right: -Spacing.three, bottom: 64, height: 1.5, backgroundColor: 'rgba(120, 90, 70, 0.22)', zIndex: 3 },
  breakBadge: { position: 'absolute', top: 6, zIndex: 4, backgroundColor: 'rgba(78,53,40,0.85)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  breakBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  planCard: {
    backgroundColor: BakeryColors.glass,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    padding: Spacing.two,
    gap: 4,
    ...BakeryShadow,
  },
  planTitle: { fontSize: 14 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  taskBox: { width: 18, height: 18, borderRadius: 6, borderWidth: 2, borderColor: BakeryColors.latte, alignItems: 'center', justifyContent: 'center' },
  taskBoxDone: { backgroundColor: BakeryColors.success, borderColor: BakeryColors.success },
  taskCheck: { color: '#fff', fontSize: 12, fontWeight: '900' },
  taskText: { flex: 1, fontSize: 13, color: BakeryColors.cocoaDark },
  taskTextDone: { color: BakeryColors.latte, textDecorationLine: 'line-through' },

  // Controls
  controls: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center', marginTop: Spacing.one },
  gameBtnWrap: {},
  gameBtn: { width: 44, height: 38 },
  breakBtn: { flex: 1, height: 46, position: 'relative', alignItems: 'center', justifyContent: 'center', paddingRight: 40 },
  breakBtnDisabled: { opacity: 0.5 },
  breakBtnText: { color: BakeryColors.cocoaDark, fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  breakIcon: { position: 'absolute', right: -2, top: -1, width: 46, height: 46, zIndex: 2 },
  endBtn: {
    alignSelf: 'center', marginTop: Spacing.two,
    paddingHorizontal: 22, paddingVertical: 9,
    borderRadius: BakeryRadii.pill,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1.5, borderColor: BakeryColors.shortbread,
    ...BakeryShadow,
  },
  endBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  endBtnText: { fontSize: 13, fontWeight: '800', color: BakeryColors.mocha },

  // Add-friend (top right)
  addFriendBtn: {
    position: 'absolute', top: 4, right: 4, zIndex: 30,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5, borderColor: BakeryColors.shortbread,
    borderRadius: BakeryRadii.pill,
    paddingLeft: 8, paddingRight: 11, paddingVertical: 5,
    ...BakeryShadow,
  },
  addFriendIcon: { fontSize: 16, fontWeight: '900', color: BakeryColors.berry, marginTop: -1 },
  addFriendLabel: { fontSize: 12, fontWeight: '800', color: BakeryColors.cocoaDark },

  // Radio (top left)
  radioBtn: { position: 'absolute', top: 2, left: 2, zIndex: 30 },
  radioImg: { width: 46, height: 46 },

  // Multiplayer finish menu
  finishOverlay: { ...StyleSheet.absoluteFill, zIndex: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(48,32,24,0.45)', padding: 28 },
  finishCard: {
    width: '100%', maxWidth: 320, backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.panel, borderWidth: 2, borderColor: BakeryColors.shortbread,
    padding: Spacing.four, gap: Spacing.two, alignItems: 'stretch', ...BakeryShadow,
  },
  finishTitle: { fontSize: 18, fontWeight: '900', color: BakeryColors.cocoaDark, textAlign: 'center' },
  coinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: Spacing.one },
  coinText: { fontSize: 22, fontWeight: '900', color: BakeryColors.honey },
  finishBtn: { paddingVertical: 13, borderRadius: BakeryRadii.button, alignItems: 'center', backgroundColor: BakeryColors.jam },
  finishBtnText: { fontSize: 15, fontWeight: '900', color: '#fff' },
  finishBtnGhost: { paddingVertical: 11, borderRadius: BakeryRadii.button, alignItems: 'center', backgroundColor: BakeryColors.cream, borderWidth: 1.5, borderColor: BakeryColors.shortbread },
  finishBtnGhostText: { fontSize: 14, fontWeight: '800', color: BakeryColors.mocha },
  endLinkText: { fontSize: 12, fontWeight: '700', color: BakeryColors.mocha, textDecorationLine: 'underline' },
  pressed: { opacity: 0.85 },
});
