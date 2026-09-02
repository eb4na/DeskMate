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
 *   2. Pick the next SUBJECT and length → the SAME run resumes (a continued block,
 *      no receipt). The subject carries over from the block that just ended, so the
 *      default path is still one tap; the pill at the top of the card opens an
 *      inline subject list for anyone who wants to switch.
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
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DurationWheel } from '@/components/duration-wheel';
import { SoundPressable } from '@/components/sound-pressable';
import { useApp } from '@/context/app-context';
import { SESSION_LENGTHS, autoBreakMinutes } from '@/constants/placeholder-data';
import { DEFAULT_ROOM_BG, roomById } from '@/constants/room-data';
import { roomAccent } from '@/lib/room-accent';
import { localizeSubjectName } from '@/lib/subject-utils';
import { isHanjiActiveId, resolveActiveCompanion } from '@/lib/companion-utils';
import { breakNudgeDelay, cancelComeBackNudge, sendBreakEndingNudge } from '@/lib/notifications';
import { showLoadingScreen } from '@/lib/loading-signal';
import { playFinishDing } from '@/lib/sounds';
import { useTranslation } from '@/i18n';
import { useTabletScale } from '@/hooks/use-tablet-scale';
import { BakeryColors, BakeryRadii, MIN_POPUP_WIDTH, Spacing } from '@/constants/theme';

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Crisp text outline: every copy (outline + fill) is absolutely anchored to the SAME
// top-left over a transparent in-flow copy that sizes the box, so the outline sits
// perfectly centred around the fill (no vertical drift from flow/justify centring).
const OUTLINE_DIRS: [number, number][] = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const OUTLINE_ABS = { position: 'absolute' as const, top: 0, left: 0 };

function OutlinedText({ value, textStyle, outline = '#FFFFFF', stroke }: { value: string; textStyle: any; outline?: string; stroke: number }) {
  return (
    <View style={{ position: 'relative' }}>
      <Text style={[textStyle, { color: 'transparent' }]}>{value}</Text>
      {OUTLINE_DIRS.map(([dx, dy], i) => (
        <Text key={i} style={[textStyle, OUTLINE_ABS, { color: outline, transform: [{ translateX: dx * stroke }, { translateY: dy * stroke }] }]}>{value}</Text>
      ))}
      <Text style={[textStyle, OUTLINE_ABS]}>{value}</Text>
    </View>
  );
}

// Outlined countdown matching the study room's timer look (a coloured number with a
// white outline so it reads over any room background).
function OutlinedTimer({ value, color, size }: { value: string; color: string; size: number }) {
  const stroke = Math.max(2, Math.round(size * 0.02));
  return <OutlinedText value={value} textStyle={{ fontSize: size, fontWeight: '900' as const, letterSpacing: 1, color }} stroke={stroke} />;
}

export default function SessionCheckpointScreen() {
  const { t } = useTranslation();
  const { scale } = useTabletScale();
  const styles = useMemo(() => makeStyles(scale), [scale]);
  const {
    startActiveSession, clearActiveSession, isPlus, equippedBackgroundRoomId, subjects,
    activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins,
  } = useApp();

  // Break-nudge copy in the active companion's voice (custom characters keep the
  // generic line), keyed exactly like the study room's away/break nudges.
  const companion = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins);
  const voiceKey = isHanjiActiveId(activeCompanionId)
    ? 'hanji'
    : companion.type === 'shop'
      ? companion.id
      : companion.type === 'starter'
        ? 'bun'
        : 'custom';
  const breakNudgeTitleKey = voiceKey === 'custom' ? 'session.breakEndTitle' : `session.breakEndTitle_${voiceKey}`;
  const breakNudgeBodyKey = voiceKey === 'custom' ? 'session.breakEndBody' : `session.breakEndBody_${voiceKey}`;

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
  // The subject the NEXT block will be logged under. Defaults to the one that just
  // ended so continuing is unchanged for anyone who doesn't touch it.
  const [chosenSubject, setChosenSubject] = useState<string | null>(subjectName);
  // While true the card shows the subject list in place of the length options —
  // an inline swap, NOT a native <Modal>: this route is already presented as a
  // transparentModal, and stacking natives over it is what wedges iOS.
  const [subjectOpen, setSubjectOpen] = useState(false);
  const pickableSubjects = subjects.filter((sub) => !sub.archived).sort((a, b) => a.order - b.order);
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

  // Break-ending notification, scheduled the moment the break starts — NOT when the
  // app is backgrounded. A break is exactly when people put the phone down, and iOS
  // suspends JS in the background, so only a scheduled local notification reliably
  // tells them the break is nearly over. It fires whether the app is open or not
  // (the notification handler shows banners in the foreground too), and is cancelled
  // if they end the break early or leave this screen.
  const breakNudgeId = useRef<string | null>(null);
  useEffect(() => {
    if (stage !== 'break') return;
    let cancelled = false;
    const secs = Math.max(0, Math.round((breakEndsAt.current - Date.now()) / 1000));
    if (secs > 0) {
      // defaultValue keeps a companion without its own line from putting the raw
      // i18n key in the notification.
      const title = t(breakNudgeTitleKey, { defaultValue: t('session.breakEndTitle') });
      const body = t(breakNudgeBodyKey, { defaultValue: t('session.breakEndBody') });
      sendBreakEndingNudge(title, body, breakNudgeDelay(secs)).then((id) => {
        // Raced with an early "End break" → drop the notification we just made.
        if (cancelled) void cancelComeBackNudge(id);
        else breakNudgeId.current = id;
      });
    }
    return () => {
      cancelled = true;
      void cancelComeBackNudge(breakNudgeId.current);
      breakNudgeId.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- copy keys are stable for this screen's life
  }, [stage]);

  // One-shot: the break-over ding must fire exactly once. `tick` runs immediately
  // AND on an interval, so the `remaining <= 0` branch can be entered again before
  // the stage change flushes — don't rely on React batching for this.
  const dinged = useRef(false);

  // Break countdown: ticks toward the wall-clock end, then auto-advances to the
  // picker (never auto-starts). Stops as soon as we leave the break stage.
  useEffect(() => {
    if (stage !== 'break') return;
    const tick = () => {
      const remaining = Math.max(0, Math.round((breakEndsAt.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0 && !acted.current) {
        // Oven-timer ding the moment the break is actually over — the same chime a
        // finished study block plays. Foreground only (iOS suspends JS in the
        // background); the scheduled notification above covers the phone-down case.
        if (!dinged.current) { dinged.current = true; playFinishDing(); }
        setStage('picking');
      }
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
    // A carried-over task belongs to the subject that just ended. If the player
    // switched subjects, that task no longer matches what they're about to study,
    // so drop it rather than logging the next block against the wrong task.
    const keepTask = chosenSubject === subjectName;
    startActiveSession({
      durationMinutes: minutes,
      subjectName: chosenSubject,
      taskId: keepTask && taskId && taskId.length > 0 ? taskId : null,
      taskTitle: keepTask && taskTitle && taskTitle.length > 0 ? taskTitle : null,
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
            <OutlinedText value={t('sessionComplete.breakTitle')} textStyle={styles.breakLabel} stroke={Math.max(1.5, 2 * scale)} />
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
  // No "I'm done for now" here — reaching this stage means the player already chose
  // to keep going (ended the break). The break screen keeps the "End session" exit.
  // Inline subject list — swaps the card's contents so no native <Modal> is stacked
  // over this transparentModal route. Mirrors SubjectPickerModal's options (active
  // subjects in order, plus "Just focus"), reusing the same copy.
  if (subjectOpen) {
    const choose = (name: string | null) => { setChosenSubject(name); setSubjectOpen(false); };
    return (
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.card}>
            <Text style={styles.title}>{t('studyRoom.whatStudying')}</Text>
            <ScrollView style={styles.subjectScroll} contentContainerStyle={styles.subjectWrap} showsVerticalScrollIndicator={false}>
              {pickableSubjects.map((sub) => (
                <SoundPressable
                  key={sub.id}
                  sound="confirm"
                  onPress={() => choose(sub.name)}
                  style={({ pressed }) => [
                    styles.subjectChip,
                    { borderColor: sub.color, backgroundColor: sub.color + '22' },
                    sub.name === chosenSubject && styles.subjectChipActive,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.subjectChipText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {sub.emoji ? `${sub.emoji} ` : ''}{localizeSubjectName(sub.name, t)}
                  </Text>
                </SoundPressable>
              ))}
            </ScrollView>
            <SoundPressable
              sound="confirm"
              onPress={() => choose(null)}
              style={({ pressed }) => [styles.focusBtn, pressed && styles.pressed]}>
              <Text style={styles.focusBtnText}>{t('studyRoom.justFocus')}</Text>
            </SoundPressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // `chosen` is only for the pill's colour/emoji — it can be undefined when the
  // carried-over subject has since been archived or deleted. The LABEL still comes
  // from chosenSubject in that case, so the pill can never read "Just focus" while
  // continueSession is quietly logging the old subject.
  const chosen = chosenSubject ? pickableSubjects.find((sub) => sub.name === chosenSubject) : undefined;

  return (
    <View style={styles.backdrop}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          {/* What the next block gets logged under. Sits ABOVE "How long?" so it's
              seen before a length tap continues the session. Hidden when there are
              no subjects to choose from — then there's nothing to switch to. */}
          {pickableSubjects.length > 0 && (
            <Pressable
              onPress={() => setSubjectOpen(true)}
              accessibilityLabel={t('studyRoom.whatStudying')}
              style={({ pressed }) => [
                styles.subjectPill,
                chosen ? { borderColor: chosen.color, backgroundColor: chosen.color + '22' } : null,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.subjectPillText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {chosenSubject
                  ? `${chosen?.emoji ? `${chosen.emoji} ` : ''}${localizeSubjectName(chosenSubject, t)}`
                  : t('studyRoom.justFocus')}
              </Text>
              <Text style={styles.subjectPillChevron}>{'\u25BE'}</Text>
            </Pressable>
          )}
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
  // Break content is centered as one group in the middle of the screen (timer +
  // the End break / End session buttons together), not split top-and-bottom.
  breakSafe: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.six * s, paddingHorizontal: Spacing.four * s, paddingVertical: Spacing.six * s },
  breakTop: { alignItems: 'center', gap: Spacing.two * s },
  breakLabel: { fontSize: 20 * s, fontWeight: '900', color: '#5B3A2E', textAlign: 'center' },
  breakBtns: { alignSelf: 'stretch', alignItems: 'center', gap: Spacing.three * s },
  // width + maxWidth (NOT alignSelf:'stretch') so the parent's alignItems:'center'
  // still applies — a stretched child clamped by maxWidth stays pinned left, which
  // reads as broken on the wide iPad break screen.
  primaryBtn: {
    width: '100%', maxWidth: 340 * s, paddingVertical: 16 * s, borderRadius: BakeryRadii.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 17 * s, fontWeight: '900', letterSpacing: 0.3 },
  endSessionBtn: {
    width: '100%', maxWidth: 340 * s, paddingVertical: 13 * s, borderRadius: BakeryRadii.pill,
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

  // ── Subject pill + inline subject list (stage 2) ──
  // The pill shows what the next block will be logged under and opens the list.
  subjectPill: {
    alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.one * s, paddingVertical: 10 * s, paddingHorizontal: Spacing.three * s,
    borderRadius: BakeryRadii.pill, borderWidth: 2, borderColor: BakeryColors.shortbread,
    backgroundColor: '#FFFFFF',
  },
  subjectPillText: { flexShrink: 1, color: BakeryColors.cocoaDark, fontWeight: '800', fontSize: 14 * s },
  subjectPillChevron: { color: BakeryColors.cocoa, fontWeight: '900', fontSize: 12 * s },
  // Cap the list so a long subject list can't push the card off a small screen.
  subjectScroll: { alignSelf: 'stretch', maxHeight: 260 * s },
  subjectWrap: { gap: Spacing.two * s, paddingVertical: Spacing.one * s },
  subjectChip: {
    alignSelf: 'stretch', paddingVertical: 12 * s, paddingHorizontal: Spacing.three * s,
    borderRadius: BakeryRadii.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  subjectChipActive: { borderWidth: 3, borderColor: BakeryColors.cocoaDark },
  subjectChipText: { color: BakeryColors.cocoaDark, fontWeight: '800', fontSize: 15 * s },
  focusBtn: {
    alignSelf: 'stretch', paddingVertical: 12 * s, borderRadius: BakeryRadii.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  focusBtnText: { color: BakeryColors.cocoa, fontWeight: '800', fontSize: 14 * s },
  pressed: { opacity: 0.85 },
});
