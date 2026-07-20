/**
 * Session checkpoint — shown the instant a solo study block's timer hits zero,
 * in place of the old receipt. The block was ALREADY credited (see
 * finishStudyBlock in app-context), so this is a pure break-then-choose screen:
 *
 *   1. Break — a FULL-SCREEN timer over the room background (not a popup): a short
 *      timed break (autoBreakMinutes: 5 for <1h blocks, 15 for longer) with
 *      "End break" (→ picker) and "End session" (→ receipt). When the timer runs
 *      out it auto-advances to the picker — it never auto-STARTS a session, so
 *      nothing is farmed by walking away (coins/streak only move on genuine study,
 *      see [[memobun-next-session-loop]]).
 *   2. Pick the next length → the SAME run resumes (a continued block, no receipt).
 *      Plus members dial any length on the wheel (pre-set to the last block);
 *      free members pick from the presets with the last one highlighted.
 *
 *   • "End session" / "I'm done for now" → the cumulative receipt
 *     (/session-complete), then Home.
 *
 * The break countdown uses a wall-clock end so backgrounding can't inflate it.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DurationWheel } from '@/components/duration-wheel';
import { SoundPressable } from '@/components/sound-pressable';
import { ThemedText } from '@/components/themed-text';
import { useApp } from '@/context/app-context';
import { SESSION_LENGTHS, autoBreakMinutes } from '@/constants/placeholder-data';
import { DEFAULT_ROOM_BG, roomById } from '@/constants/room-data';
import { roomAccent } from '@/lib/room-accent';
import { showLoadingScreen } from '@/lib/loading-signal';
import { useTranslation } from '@/i18n';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { BakeryColors, BakeryRadii, MIN_POPUP_WIDTH, Spacing } from '@/constants/theme';

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Outlined countdown matching the study room's timer look (a coloured number with a
// white outline so it reads over any room background).
function OutlinedTimer({ value, color, size }: { value: string; color: string; size: number }) {
  const base = { position: 'absolute' as const, fontSize: size, fontWeight: '900' as const, letterSpacing: 1 };
  const off = Math.max(2, Math.round(size * 0.02));
  return (
    <View style={{ height: size * 1.15, justifyContent: 'center' }}>
      {[[-off, 0], [off, 0], [0, -off], [0, off]].map(([dx, dy], i) => (
        <Text key={i} style={[base, { color: '#FFFFFF', transform: [{ translateX: dx }, { translateY: dy }] }]}>{value}</Text>
      ))}
      <Text style={[base, { color, position: 'relative' }]}>{value}</Text>
    </View>
  );
}

export default function SessionCheckpointScreen() {
  const { t } = useTranslation();
  const { scale } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale), [scale]);
  const { startActiveSession, clearActiveSession, isPlus, equippedBackgroundRoomId } = useApp();

  const { lastMinutes, subject, taskId, taskTitle } = useLocalSearchParams<{
    lastMinutes?: string;
    subject?: string;
    taskId?: string;
    taskTitle?: string;
  }>();
  const last = Math.max(5, Math.min(300, parseInt(lastMinutes ?? '30', 10) || 30));
  const subjectName = subject && subject.length > 0 ? subject : null;
  const breakLenMin = autoBreakMinutes(last);
  // Full-screen break matches the room the player studies in.
  const bgImage = roomById(equippedBackgroundRoomId)?.backgroundImage ?? DEFAULT_ROOM_BG;
  const acc = roomAccent(equippedBackgroundRoomId);

  // Two stages: the full-screen timed break, then the length picker.
  const [stage, setStage] = useState<'break' | 'picking'>('break');
  const [secondsLeft, setSecondsLeft] = useState(breakLenMin * 60);
  // Plus: the wheel value (pre-set to the last block's length).
  const [customMin, setCustomMin] = useState(last);
  // One-shot guard: a pick (or "End session") must navigate exactly once.
  const acted = useRef(false);
  // Wall-clock break end so a backgrounded app can't over-run the break.
  const breakEndsAt = useRef(Date.now() + breakLenMin * 60 * 1000);

  // Consume the Android hardware back button for the whole screen's life — the
  // session is still alive underneath (not yet cleared), so dismissing this would
  // strand Home on the 00:00 study view. Force a real choice instead.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // Break countdown: ticks toward the wall-clock end, then auto-advances to the
  // picker (never auto-starts). Stops as soon as we leave the break stage.
  useEffect(() => {
    if (stage !== 'break') return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((breakEndsAt.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0 && !acted.current) setStage('picking');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [stage]);

  // Continue studying → resume the SAME run as a continued block (keeps the run
  // accumulator so the eventual receipt sums every block), and carry a break for
  // the next block-end too.
  const continueSession = (minutes: number) => {
    if (acted.current) return;
    acted.current = true;
    startActiveSession({
      durationMinutes: minutes,
      subjectName,
      taskId: taskId && taskId.length > 0 ? taskId : null,
      taskTitle: taskTitle && taskTitle.length > 0 ? taskTitle : null,
      breakMinutes: autoBreakMinutes(minutes),
      startedAt: new Date().toISOString(),
      continuedRun: true,
    });
    showLoadingScreen(undefined, { quick: true });
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  // "End session" / "I'm done for now" → show the cumulative receipt, then let go of
  // the live session. Identical everywhere so the already-credited block still shows
  // its receipt (never a silent jump Home).
  const endSession = () => {
    if (acted.current) return;
    acted.current = true;
    router.replace('/session-complete');
    // Defer the clear so Home's HUD doesn't flash behind the receipt as it slides in.
    setTimeout(() => clearActiveSession(), 450);
  };

  // ── Stage 1: full-screen break timer (over the room background) ──────────────
  if (stage === 'break') {
    return (
      <View style={styles.breakRoot}>
        <Image source={bgImage} style={StyleSheet.absoluteFill} contentFit="cover" />
        <SafeAreaView style={styles.breakSafe}>
          <View style={styles.breakTop}>
            <Text style={styles.breakLabel}>{t('sessionComplete.breakTitle')}</Text>
            <OutlinedTimer value={fmt(secondsLeft)} color={acc.button} size={Math.round(76 * scale)} />
          </View>
          <View style={styles.breakBtns}>
            <SoundPressable
              sound="confirm"
              onPress={() => { if (!acted.current) setStage('picking'); }}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: acc.button }, pressed && styles.pressed]}>
              <Text style={[styles.primaryBtnText, { color: acc.onButton }]}>{t('studyRoom.endBreak')}</Text>
            </SoundPressable>
            <Pressable onPress={endSession} style={({ pressed }) => [styles.endSessionBtn, pressed && styles.pressed]}>
              <Text style={styles.endSessionText}>{t('session.endSession')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── Stage 2: the length picker (a dimmed card popup) ─────────────────────────
  const doneBtn = (
    <Pressable onPress={endSession} style={({ pressed }) => [styles.restBtn, pressed && styles.pressed]} hitSlop={8}>
      <ThemedText type="small" style={styles.restText}>{t('sessionComplete.nextDone')}</ThemedText>
    </Pressable>
  );

  return (
    <View style={styles.backdrop}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          {isPlus ? (
            <>
              <Text style={styles.title}>{t('studyRoom.howLong')}</Text>
              <DurationWheel
                minutes={customMin}
                onChange={(m) => setCustomMin(Math.max(5, Math.min(300, m)))}
                picks={SESSION_LENGTHS.map((o) => o.minutes)}
                scale={scale}
              />
              <SoundPressable
                sound="confirm"
                onPress={() => continueSession(customMin)}
                style={({ pressed }) => [styles.optBtn, pressed && styles.pressed]}>
                <Text style={styles.optBtnText}>{t('lobby.startStudying')}</Text>
              </SoundPressable>
              {doneBtn}
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('studyRoom.howLong')}</Text>
              {SESSION_LENGTHS.map((opt) => {
                const isLast = opt.minutes === last;
                return (
                  <SoundPressable
                    key={opt.minutes}
                    sound="confirm"
                    onPress={() => continueSession(opt.minutes)}
                    style={({ pressed }) => [styles.optBtn, isLast && styles.optBtnActive, pressed && styles.pressed]}>
                    <Text style={styles.optBtnText}>{t('studyRoom.minutesOption', { count: opt.minutes })}</Text>
                  </SoundPressable>
                );
              })}
              {doneBtn}
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (s: number) => StyleSheet.create({
  // ── Full-screen break timer ──
  breakRoot: { flex: 1, backgroundColor: BakeryColors.frosting },
  breakSafe: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.four * s, paddingVertical: Spacing.six * s },
  breakTop: { alignItems: 'center', gap: Spacing.two * s, marginTop: '14%' },
  breakLabel: { fontSize: 20 * s, fontWeight: '900', color: '#5B3A2E', textAlign: 'center', textShadowColor: '#FFFFFFCC', textShadowRadius: 6 },
  breakBtns: { alignSelf: 'stretch', alignItems: 'center', gap: Spacing.three * s, marginBottom: Spacing.four * s },
  primaryBtn: {
    alignSelf: 'stretch', maxWidth: 340, paddingVertical: 16 * s, borderRadius: BakeryRadii.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 17 * s, fontWeight: '900', letterSpacing: 0.3 },
  endSessionBtn: {
    alignSelf: 'stretch', maxWidth: 340, paddingVertical: 13 * s, borderRadius: BakeryRadii.pill,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFFDD',
  },
  endSessionText: { fontSize: 15 * s, fontWeight: '800', color: '#8A5A3B' },

  // ── Dimmed card picker (stage 2) ──
  backdrop: { flex: 1, backgroundColor: 'rgba(60, 40, 30, 0.45)' },
  safeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four * s },
  card: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: 360 * s, backgroundColor: BakeryColors.cream,
    borderRadius: BakeryRadii.card * s, borderWidth: 2, borderColor: BakeryColors.shortbread,
    padding: Spacing.four * s, alignItems: 'center', gap: Spacing.two * s,
  },
  title: { fontSize: 20 * s, fontWeight: '900', color: BakeryColors.cocoaDark, textAlign: 'center', marginBottom: Spacing.one * s },
  optBtn: {
    alignSelf: 'stretch', paddingVertical: 14 * s, borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.jam, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'transparent',
  },
  // The last-used length is pre-highlighted so it's the obvious default tap.
  optBtnActive: { borderColor: BakeryColors.cocoaDark },
  optBtnText: { color: BakeryColors.cocoaDark, fontWeight: '900', fontSize: 15 * s },
  restBtn: { paddingVertical: 10 * s, alignItems: 'center', marginTop: Spacing.one * s },
  restText: { color: BakeryColors.cocoa, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
