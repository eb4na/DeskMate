/**
 * Session checkpoint — shown the instant a solo study block's timer hits zero,
 * in place of the old receipt. The block was ALREADY credited (see
 * finishStudyBlock in app-context), so this is a pure choice screen:
 *
 *   • Continue studying → pick the next length → the SAME run resumes (a continued
 *     block, no receipt). See [[memobun-next-session-loop]] for the prior loop this
 *     replaces.
 *   • Rest for now → the cumulative receipt (/session-complete), then Home.
 *
 * No countdown: ignoring the screen just leaves you here (matching the multiplayer
 * finish overlay). Nothing is farmed because coins/streak are already banked and
 * only advance on genuine study.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DurationWheel } from '@/components/duration-wheel';
import { SoundPressable } from '@/components/sound-pressable';
import { ThemedText } from '@/components/themed-text';
import { useApp } from '@/context/app-context';
import { SESSION_LENGTHS, autoBreakMinutes } from '@/constants/placeholder-data';
import { showLoadingScreen } from '@/lib/loading-signal';
import { useTranslation } from '@/i18n';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { BakeryColors, BakeryRadii, MIN_POPUP_WIDTH, Spacing } from '@/constants/theme';

export default function SessionCheckpointScreen() {
  const { t } = useTranslation();
  const { scale } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale), [scale]);
  const { startActiveSession, clearActiveSession, isPlus } = useApp();

  const { lastMinutes, subject, taskId, taskTitle } = useLocalSearchParams<{
    lastMinutes?: string;
    subject?: string;
    taskId?: string;
    taskTitle?: string;
  }>();
  const last = Math.max(5, Math.min(300, parseInt(lastMinutes ?? '30', 10) || 30));
  const subjectName = subject && subject.length > 0 ? subject : null;

  // Two stages: the Continue/Rest choice, then (on Continue) the length picker.
  const [picking, setPicking] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMin, setCustomMin] = useState(last);
  // One-shot guard: a pick (or Rest) must navigate exactly once.
  const acted = useRef(false);

  // Consume the Android hardware back button — the session is still alive underneath
  // (not yet cleared), so dismissing the checkpoint would strand Home on the 00:00
  // study view. Force the user to pick Continue or Rest instead.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // Continue studying → resume the SAME run as a continued block (keeps the run
  // accumulator so the eventual receipt sums every block).
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

  // Rest for now → show the cumulative receipt, then let go of the live session.
  const rest = () => {
    if (acted.current) return;
    acted.current = true;
    router.replace('/session-complete');
    // Defer the clear so Home's HUD doesn't flash behind the receipt as it slides in.
    setTimeout(() => clearActiveSession(), 450);
  };

  return (
    <View style={styles.backdrop}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          {!picking ? (
            <>
              <Text style={styles.title}>{t('sessionComplete.keepStudyingTitle')}</Text>
              <SoundPressable
                sound="confirm"
                onPress={() => setPicking(true)}
                style={({ pressed }) => [styles.optBtn, pressed && styles.pressed]}>
                <Text style={styles.optBtnText}>{t('sessionComplete.continueStudying')}</Text>
              </SoundPressable>
              <Pressable onPress={rest} style={({ pressed }) => [styles.restBtn, pressed && styles.pressed]} hitSlop={8}>
                <ThemedText type="small" style={styles.restText}>{t('sessionComplete.restForNow')}</ThemedText>
              </Pressable>
            </>
          ) : customOpen ? (
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
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('studyRoom.howLong')}</Text>
              {SESSION_LENGTHS.map((opt) => (
                <SoundPressable
                  key={opt.minutes}
                  sound="confirm"
                  onPress={() => continueSession(opt.minutes)}
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
              <Pressable onPress={rest} style={({ pressed }) => [styles.restBtn, pressed && styles.pressed]} hitSlop={8}>
                <ThemedText type="small" style={styles.restText}>{t('sessionComplete.restForNow')}</ThemedText>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (s: number) => StyleSheet.create({
  // Dimmed popup backdrop — the study room shows through behind the card.
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
  },
  optBtnText: { color: BakeryColors.cocoaDark, fontWeight: '900', fontSize: 15 * s },
  restBtn: { paddingVertical: 10 * s, alignItems: 'center', marginTop: Spacing.one * s },
  restText: { color: BakeryColors.cocoa, fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
