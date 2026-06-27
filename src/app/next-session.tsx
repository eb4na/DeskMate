/**
 * Next-session picker — shown right after a solo study break (or straight after the
 * session when no break was taken). Pick the next session's length, with a 1-minute
 * countdown. If the minute runs out, we AUTO-START a session with the same length as
 * the last one — but only once in a row: if THIS picker was itself reached from an
 * auto-started session (the user ignored the previous one too), we go Home instead of
 * chaining (no passive-farming a study streak by leaving the app open). See
 * [[memobun-early-end-no-coins]] for the "only genuine study pays" principle.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DurationWheel } from '@/components/duration-wheel';
import { SoundPressable } from '@/components/sound-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { SESSION_LENGTHS, autoBreakMinutes } from '@/constants/placeholder-data';
import { showLoadingScreen } from '@/lib/loading-signal';
import { useTranslation } from '@/i18n';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { BakeryColors, BakeryRadii, MIN_POPUP_WIDTH, Spacing } from '@/constants/theme';

const COUNTDOWN_SECONDS = 60;

export default function NextSessionScreen() {
  const { t } = useTranslation();
  const { scale } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale), [scale]);
  const { startActiveSession, isPlus } = useApp();

  const { lastMinutes, subject, autoStarted } = useLocalSearchParams<{
    lastMinutes?: string;
    subject?: string;
    autoStarted?: string;
  }>();
  const last = Math.max(5, Math.min(300, parseInt(lastMinutes ?? '30', 10) || 30));
  const subjectName = subject && subject.length > 0 ? subject : null;
  // This picker was reached from an already-auto-started session → don't chain another
  // auto-start (the user ignored the last picker too). Let the countdown drop to Home.
  const cameFromAutoStart = autoStarted === '1';

  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMin, setCustomMin] = useState(last);
  // One-shot guard: a pick (or the countdown) must navigate exactly once.
  const acted = useRef(false);

  const leaveHome = () => {
    if (acted.current) return;
    acted.current = true;
    showLoadingScreen(undefined, { quick: true });
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  const startSession = (minutes: number, auto: boolean) => {
    if (acted.current) return;
    acted.current = true;
    startActiveSession({
      durationMinutes: minutes,
      subjectName,
      taskId: null,
      taskTitle: null,
      breakMinutes: autoBreakMinutes(minutes),
      startedAt: new Date().toISOString(),
      autoStarted: auto,
    });
    showLoadingScreen(undefined, { quick: true });
    if (router.canDismiss()) router.dismissAll();
    else router.replace('/');
  };

  // Countdown: a display tick + a single expiry action (kept separate so the action
  // fires once, not inside the per-second state updater).
  useEffect(() => {
    const tick = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    const expire = setTimeout(() => {
      if (cameFromAutoStart) leaveHome();
      else startSession(last, true);
    }, COUNTDOWN_SECONDS * 1000);
    return () => { clearInterval(tick); clearTimeout(expire); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <Text style={styles.countdown}>
            {cameFromAutoStart
              ? t('sessionComplete.nextClosingIn', { count: secondsLeft })
              : t('sessionComplete.nextAutoStartIn', { count: secondsLeft })}
          </Text>
          <Text style={styles.title}>{t('studyRoom.howLong')}</Text>

          {customOpen ? (
            <>
              <DurationWheel
                minutes={customMin}
                onChange={(m) => setCustomMin(Math.max(5, Math.min(300, m)))}
                picks={SESSION_LENGTHS.map((o) => o.minutes)}
                scale={scale}
              />
              <SoundPressable
                sound="confirm"
                onPress={() => startSession(customMin, false)}
                style={({ pressed }) => [styles.optBtn, pressed && styles.pressed]}>
                <Text style={styles.optBtnText}>{t('lobby.startStudying')}</Text>
              </SoundPressable>
            </>
          ) : (
            <>
              {SESSION_LENGTHS.map((opt) => (
                <SoundPressable
                  key={opt.minutes}
                  sound="confirm"
                  onPress={() => startSession(opt.minutes, false)}
                  style={({ pressed }) => [styles.optBtn, pressed && styles.pressed]}>
                  <Text style={styles.optBtnText}>{t('studyRoom.minutesOption', { count: opt.minutes })}</Text>
                </SoundPressable>
              ))}
              {/* Custom length is a Plus perk (same as the lobby's custom timer). */}
              {isPlus && (
                <SoundPressable
                  onPress={() => setCustomOpen(true)}
                  style={({ pressed }) => [styles.optBtn, pressed && styles.pressed]}>
                  <Text style={styles.optBtnText}>{t('lobby.customLength')}</Text>
                </SoundPressable>
              )}
            </>
          )}

          <Pressable onPress={leaveHome} style={({ pressed }) => [styles.doneBtn, pressed && styles.pressed]} hitSlop={8}>
            <ThemedText type="small" style={styles.doneText}>{t('sessionComplete.nextDone')}</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const makeStyles = (s: number) => StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four * s },
  card: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: 360 * s, backgroundColor: BakeryColors.cream,
    borderRadius: BakeryRadii.card * s, borderWidth: 2, borderColor: BakeryColors.shortbread,
    padding: Spacing.four * s, alignItems: 'center', gap: Spacing.two * s,
  },
  countdown: { fontSize: 14 * s, fontWeight: '800', color: BakeryColors.jam, textAlign: 'center' },
  title: { fontSize: 20 * s, fontWeight: '900', color: BakeryColors.cocoaDark, textAlign: 'center', marginBottom: Spacing.one * s },
  optBtn: {
    alignSelf: 'stretch', paddingVertical: 14 * s, borderRadius: BakeryRadii.pill,
    backgroundColor: BakeryColors.jam, alignItems: 'center', justifyContent: 'center',
  },
  optBtnText: { color: BakeryColors.cocoaDark, fontWeight: '900', fontSize: 15 * s },
  doneBtn: { paddingVertical: 10 * s, alignItems: 'center', marginTop: Spacing.one * s },
  doneText: { color: BakeryColors.cocoa, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
