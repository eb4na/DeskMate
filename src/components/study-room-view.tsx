import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useApp } from '@/context/app-context';
import { getCompanionImage, resolveActiveCompanion } from '@/lib/companion-utils';
import { useStudyRoom, type StudyStatus } from '@/lib/use-study-room';
import { BakeryColors, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';

const BUN_STUDYING = require('@/assets/images/bun/bun-studying.png');
const TIMER_CARD = require('@/assets/images/study/timer-card.png');
const AVATAR_FRAME = require('@/assets/images/study/avatar-frame.png');
const PPL_ICON = require('@/assets/images/study/ppl-icon.png');
const BREAK_BTN = require('@/assets/images/study/break-btn.png');
const PAUSE_BTN = require('@/assets/images/study/pause-btn.png');
const PLAY_BTN = require('@/assets/images/study/play-btn.png');
const GAME_BTN = require('@/assets/images/study/game-btn.png');

function format(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function isToday(dateISO: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${dateISO}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  return d.getTime() === today.getTime();
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
  const {
    activeSession,
    tasks,
    completeTask,
    updateTask,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
    profileDisplayName,
    friendCode,
  } = useApp();
  const room = useStudyRoom();

  // My status (studying/break), toggled by the Break button in a room.
  const [onBreak, setOnBreak] = useState(false);

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
  const bigCharacter = me.type === 'starter' ? BUN_STUDYING : me.imageSource;

  // Participants: the synced roster, or just me when solo.
  const participants =
    room.roster.length > 0
      ? room.roster
      : [{ code: friendCode, name: profileDisplayName || 'You', isHost: true, companionId: undefined, skinId: undefined }];
  const studyingCount = participants.length;

  // Today's plan: tasks due today (or in progress), not yet done.
  const todays = tasks
    .filter((t) => t.status !== 'done' && ((t.dueDate && isToday(t.dueDate)) || t.status === 'in_progress'))
    .slice(0, 4);

  const toggleTask = (id: string, status: string) => {
    if (status === 'done') updateTask(id, { status: 'not_started' });
    else completeTask(id);
  };

  const handleBreak = () => {
    if (room.active) {
      const next = !onBreak;
      setOnBreak(next);
      room.setStatus(next ? 'break' : 'studying');
    } else {
      onBreakGame();
    }
  };

  const handleLeave = () => {
    if (room.active) room.leaveRoom();
    onStop();
  };

  return (
    <View style={styles.root}>
      {/* Timer card */}
      <View style={styles.timerWrap}>
        <Image source={TIMER_CARD} style={StyleSheet.absoluteFill} contentFit="contain" pointerEvents="none" />
        <View style={styles.timerText}>
          <Text style={styles.timer}>{format(secondsLeft)}</Text>
          <Text style={styles.bakeLabel}>Cake is baking…</Text>
          <View style={styles.studyingRow}>
            <Image source={PPL_ICON} style={styles.pplIcon} contentFit="contain" />
            <Text style={styles.bakeSub}>{studyingCount} studying together</Text>
          </View>
        </View>
      </View>

      {/* Participant row */}
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
              <Text style={styles.partName} numberOfLines={1}>{p.code === friendCode ? 'You' : p.name}</Text>
            </View>
          );
        })}
      </View>

      {/* Main character */}
      <View style={styles.scene}>
        <Image source={bigCharacter} style={styles.character} contentFit="contain" />
        {onBreak && (
          <View style={styles.breakBadge}>
            <Text style={styles.breakBadgeText}>On a break ☕</Text>
          </View>
        )}
      </View>

      {/* Today's plan */}
      <View style={styles.planCard}>
        <ThemedText type="smallBold" style={styles.planTitle}>Today's Plan</ThemedText>
        {todays.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">No tasks for today — just focus 💪</ThemedText>
        ) : (
          todays.map((t) => (
            <Pressable key={t.id} style={styles.taskRow} onPress={() => toggleTask(t.id, t.status)}>
              <View style={[styles.taskBox, t.status === 'done' && styles.taskBoxDone]}>
                {t.status === 'done' && <Text style={styles.taskCheck}>✓</Text>}
              </View>
              <Text style={[styles.taskText, t.status === 'done' && styles.taskTextDone]} numberOfLines={1}>{t.title}</Text>
            </Pressable>
          ))
        )}
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable onPress={onBreakGame} style={({ pressed }) => [styles.gameBtnWrap, pressed && styles.pressed]} hitSlop={6}>
          <Image source={GAME_BTN} style={styles.gameBtn} contentFit="contain" />
        </Pressable>
        <Pressable onPress={handleBreak} style={({ pressed }) => [styles.breakBtnWrap, pressed && styles.pressed]}>
          <Image source={BREAK_BTN} style={styles.breakImg} contentFit="contain" />
        </Pressable>
        <Pressable onPress={handleBreak} style={({ pressed }) => [styles.pauseBtnWrap, pressed && styles.pressed]} hitSlop={6}>
          <Image source={onBreak ? PLAY_BTN : PAUSE_BTN} style={styles.pauseBtn} contentFit="contain" />
        </Pressable>
      </View>
      <Pressable onPress={handleLeave} style={styles.endLink} hitSlop={8}>
        <Text style={styles.endLinkText}>{room.active ? 'Leave room' : 'End session'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.one },

  // Timer card
  timerWrap: { alignSelf: 'center', width: '70%', aspectRatio: 1032 / 838 },
  timerText: { position: 'absolute', left: '11%', right: '11%', top: '30%', bottom: '12%', alignItems: 'center', justifyContent: 'center' },
  timer: { fontSize: 40, fontWeight: '900', color: BakeryColors.cocoaDark, letterSpacing: 1 },
  bakeLabel: { fontSize: 13, fontWeight: '700', color: BakeryColors.mocha, marginTop: 1 },
  studyingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  pplIcon: { width: 15, height: 15 },
  bakeSub: { fontSize: 11, color: BakeryColors.mocha },

  // Participant frames (frame art is 814×969; face circle, status dot and
  // nameplate positions are measured from it)
  participantRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  participant: { width: 76, height: 90, position: 'relative' },
  partFrame: { position: 'absolute', left: 0, top: 0, width: 76, height: 90 },
  partFace: { position: 'absolute', left: '8.8%', top: '7.4%', width: '82.2%', aspectRatio: 1, borderRadius: 999, overflow: 'hidden', backgroundColor: BakeryColors.cream },
  partFaceImg: { width: '116%', height: '116%', marginLeft: '-8%' },
  partDot: { position: 'absolute', left: '75.4%', top: '62.3%', width: '17%', aspectRatio: 1, borderRadius: 999, borderWidth: 2.5, borderColor: '#fff' },
  partName: { position: 'absolute', bottom: '4%', left: '8%', right: '8%', textAlign: 'center', fontSize: 10, fontWeight: '800', color: BakeryColors.cocoaDark },

  scene: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', minHeight: 150 },
  character: { width: 210, height: 250 },
  breakBadge: { position: 'absolute', top: 6, backgroundColor: 'rgba(78,53,40,0.85)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  breakBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  planCard: {
    backgroundColor: BakeryColors.glass,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    padding: Spacing.two,
    gap: 6,
    ...BakeryShadow,
  },
  planTitle: { fontSize: 14 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  taskBox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: BakeryColors.latte, alignItems: 'center', justifyContent: 'center' },
  taskBoxDone: { backgroundColor: BakeryColors.success, borderColor: BakeryColors.success },
  taskCheck: { color: '#fff', fontSize: 12, fontWeight: '900' },
  taskText: { flex: 1, fontSize: 14, color: BakeryColors.cocoaDark },
  taskTextDone: { color: BakeryColors.latte, textDecorationLine: 'line-through' },

  // Controls
  controls: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  gameBtnWrap: {},
  gameBtn: { width: 52, height: 44 },
  breakBtnWrap: { flex: 1 },
  breakImg: { width: '100%', aspectRatio: 1832 / 519 },
  pauseBtnWrap: {},
  pauseBtn: { width: 46, height: 46 },
  endLink: { alignSelf: 'center', paddingVertical: 4 },
  endLinkText: { fontSize: 12, fontWeight: '700', color: BakeryColors.mocha, textDecorationLine: 'underline' },
  pressed: { opacity: 0.85 },
});
