// The companion speaks first on Home: once per "open" (a cold start, or coming back
// from the background) it may say ONE thing about the player's real life (exam
// tomorrow, a streak, a late night...), optionally with tap replies, or hand over a
// paper note it left on the desk while the player was away. Remounting is NOT an
// open: Home unmounts this host during a study session, and finishing a session in
// the same foreground stretch must not produce a new moment.
//
// Mounted in Home's high-zIndex character layer (beside PetCloudHost). Like
// PetCloudHost it owns all of its own state, so showing / answering / dismissing a
// moment never re-renders the (very large) Home component. Everything it draws stays
// inside the layer's box (Android drops touches outside a parent's bounds) and only
// exists while a moment or note is showing, so idle Home taps pass straight through.
//
// WHAT to say is decided by the pure engine in companion-moments.ts; the words come
// from companion-voice.ts. Every engine call is wrapped: a malformed persisted value
// (e.g. a bad ISO date) must make the companion stay quiet, never crash Home.
import { useIsFocused } from 'expo-router';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, AppState, Easing, Modal, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { FitText } from '@/components/fit-text';
import { KeepsakeOverlay } from '@/components/keepsake-overlay';
import { Envelope } from '@/components/paper-note';
import { ThemedText } from '@/components/themed-text';
import { BakeryColors } from '@/constants/theme';
import { accountDateOf, isStudySessionLive, nowMinutesInAccountTz, todayISO, useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { track } from '@/lib/analytics';
import { companionLevelInfo } from '@/lib/companion-level';
import {
  awayNoteDue,
  followUpFor,
  missingBondLetters,
  nextAwayNoteId,
  pickMoment,
  sampleMoment,
  type Keepsake,
  type Moment,
  type MomentKind,
  type PersonaKey,
  type ReplyAnswer,
} from '@/lib/companion-moments';
import { localizeCompanionName, resolveActiveCompanion } from '@/lib/companion-utils';
import { awayEntry, awayPoolIds, momentLine, personaKeyForName, reactionLine, replyLabel } from '@/lib/companion-voice';
import { isLoadingActive, subscribeLoadingDone, subscribeLoadingScreen } from '@/lib/loading-signal';
import { useModalSafeVisible } from '@/lib/modal-traffic';
import { rewardChainBusy } from '@/lib/reward-chain';

type AppSnapshot = ReturnType<typeof useApp>;

/** A moment on screen. Persona + display name are frozen when it is said. */
type Shown = {
  key: number;
  moment: Moment;
  persona: PersonaKey;
  name: string;
  line: string;
  answer: ReplyAnswer | null;
  reaction: string;
  dev: boolean;
};

/** The paper note left on the desk (held here so it stays stable once marked seen). */
type DeskNote = { keepsake: Keepsake; name: string };

// Beat between the gates clearing (e.g. the last reward popup fading out) and the
// companion speaking, so the bubble never lands in the same instant a modal closes.
const SETTLE_MS = 700;

// Fraction of the character layer's height at which the desk's top edge (the "lip")
// sits above the layer bottom (the companion's feet). Phone: CHAR_HIDE_FRAC·300·phW
// over a 280·phW layer (Home's ph memo) = 87.44/280. Tablet reference (834×1210):
// table edge 567pt vs layer bottom 444pt above the scene bottom, layer 280pt tall.
const LIP_FRAC_PHONE = 87.44 / 280;
const LIP_FRAC_TABLET = 123 / 280;

let shownSeq = 0;

// ── Opens: module-level tokens, so a remount (e.g. after a study session) is never
// an open. The module loading = the cold start = open #1; each background -> active
// return bumps the token — wherever the player is (Shop, a DM...): the open is then
// spoken when Home is next visible. NOT opens:
//  - a bare inactive -> active (Control Center, Face ID, a system sheet) — it would
//    burn one of the two daily moments;
//  - coming back to a study session that is still running (a quick app switch
//    mid-session): the session is the open's context, not a new arrival. If the
//    session was auto-stopped because the player stayed away (lock-in, 60s+), the
//    return IS an open.
// MomentHost reads + stamps the away gap as soon as it sees a new token (state
// loaded), but CONSUMES the token only when it decides, after every gate is clear.
let openToken = 1;
let stampedToken = 0;
let consumedToken = 0;
// The oldest still-undecided open's away gap: lastActiveAt as it was BEFORE that
// open stamped it, and when it was read. If a second open lands while one is still
// waiting (reward popups up), the first one's gap is kept: the player did come back
// after that long.
// `prevVisitDate` is streak.lastStudyDate as it was at the open, BEFORE the daily
// reward claim stamps it to today — welcome_back measures the time away from it.
type OpenGap = { prevActiveAt: number; at: number; prevVisitDate: string | null };
let openGap: OpenGap | null = null;
const openListeners = new Set<() => void>();
let wentBackground = false;
// Fast Refresh re-runs this module: drop the previous run's listener first.
const appStateHolder = globalThis as { __momentHostAppState?: { remove: () => void } };
appStateHolder.__momentHostAppState?.remove();
appStateHolder.__momentHostAppState = AppState.addEventListener('change', (state) => {
  if (state === 'background') {
    wentBackground = true;
  } else if (state === 'active' && wentBackground) {
    wentBackground = false;
    // Check the session only after EVERY listener has handled this 'active' event:
    // the study room's own listener (registered later) auto-stops a lock-in session
    // in this same dispatch, and the session mirror is written synchronously when it
    // does. A microtask runs once the dispatch has returned.
    void Promise.resolve().then(() => {
      if (isStudySessionLive()) return; // back to a running session: not an open
      openToken += 1;
      openListeners.forEach((fn) => fn());
    });
  }
});

function speakerOf(a: AppSnapshot): { persona: PersonaKey; rawName: string } {
  const resolved = resolveActiveCompanion(
    a.activeCompanionId,
    a.defaultCompanionId,
    a.companionSlots,
    a.bunSkinId,
    a.companionSkins,
  );
  return { persona: personaKeyForName(resolved.name), rawName: resolved.name };
}

/** Back-file any bond letter (levels 2..15) a companion has reached but not received. */
function fileBondLetters(a: AppSnapshot) {
  try {
    const best = new Map<PersonaKey, number>();
    for (const [id, minutes] of Object.entries(a.companionMinutes ?? {})) {
      const name = resolveActiveCompanion(id, a.defaultCompanionId, a.companionSlots, a.bunSkinId, a.companionSkins).name;
      const persona = personaKeyForName(name);
      const level = companionLevelInfo(minutes).level;
      best.set(persona, Math.max(best.get(persona) ?? 0, level));
    }
    const missing = missingBondLetters({
      companions: [...best].map(([persona, level]) => ({ persona, level })),
      have: a.keepsakes,
      today: todayISO(),
    });
    if (missing.length > 0) a.addKeepsakes(missing);
  } catch (e) {
    if (__DEV__) console.warn('[moments] bond letter filing skipped', e);
  }
}

/**
 * Once per open, as soon as saved state is loaded: read the away gap FIRST (the
 * background stamp), then stamp now — or the gap could never reach 8h — and back-file
 * bond letters. Waiting for `loaded` matters: before it, lastActiveAt reads as the
 * default 0 and the stamp would be overwritten by the load.
 */
function takeOpenGap(a: AppSnapshot) {
  if (!a.loaded || stampedToken === openToken) return;
  stampedToken = openToken;
  const prevActiveAt = a.lastActiveAt;
  a.stampLastActive();
  fileBondLetters(a);
  // `at` pins the gap's end to the open itself, not to a decision that may come
  // much later (reward popups, another tab).
  if (openGap === null) openGap = { prevActiveAt, at: Date.now(), prevVisitDate: a.streak.lastStudyDate };
}

/**
 * The moment for this open, or null. `gap` is this open's away gap: lastActiveAt as
 * it was BEFORE the open stamped it, and when the open happened (null = no away
 * check, e.g. a dev trigger).
 */
function chooseMoment(
  a: AppSnapshot,
  persona: PersonaKey,
  dev: MomentKind | null,
  gap: OpenGap | null,
): Moment | null {
  const today = todayISO();
  if (dev) {
    const sample = sampleMoment(dev);
    if (sample.kind !== 'away_note') return sample;
    // A dev note needs a real id: the first of this persona's pool not yet given.
    const pool = awayPoolIds(persona);
    const given = new Set(a.awayLifeGiven[persona] ?? []);
    const noteId = pool.find((id) => !given.has(id)) ?? pool[0];
    return noteId ? { ...sample, noteId } : null;
  }

  let awayNoteId: string | null = null;
  if (
    gap !== null &&
    awayNoteDue({ now: gap.at, lastActiveAt: gap.prevActiveAt, today, lastKeepsakeISO: a.lastKeepsakeISO, roll: Math.random() })
  ) {
    awayNoteId = nextAwayNoteId({
      poolIds: awayPoolIds(persona),
      given: a.awayLifeGiven[persona] ?? [],
      seed: a.friendCode + persona,
    });
    if (awayNoteId === null) track('away_pool_exhausted', { persona });
  }

  return pickMoment({
    today,
    nowMinutes: nowMinutesInAccountTz(),
    momentsSeen: a.momentsSeen,
    momentDayCount: a.momentDayCount,
    pendingFollowUp: a.pendingFollowUp,
    profileBirthday: a.profileBirthday,
    exams: a.examCountdowns,
    lastStudyDate: a.streak.lastStudyDate,
    previousVisitDate: gap ? gap.prevVisitDate : a.streak.lastStudyDate,
    currentStreak: a.streak.currentStreak,
    firstStudyDate: a.firstStudyDate,
    lastSession: a.sessionHistory[0] ?? null,
    tasks: a.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      isDeadline: t.isDeadline,
      dueDate: t.dueDate,
      status: t.status,
      completedDateISO: t.completedAt ? accountDateOf(t.completedAt) : null,
      repeatDays: t.repeatDays,
    })),
    sessionsCompleted: a.sessionsCompleted,
    totalMinutes: a.totalMinutes,
    subjects: a.subjects,
    sessionHistory: a.sessionHistory,
    awayNoteId,
  });
}

function MomentHostImpl({ isTablet, scale }: { isTablet: boolean; scale: number }) {
  const app = useApp();
  const { t } = useTranslation();
  const { t: tc } = useTranslation('companion');
  const focused = useIsFocused();

  // Latest values for timers / listeners (the context value is rebuilt every render).
  const appRef = useRef(app);
  appRef.current = app;
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const tRef = useRef(t);
  tRef.current = t;

  const [shown, setShown] = useState<Shown | null>(null);
  const [deskNote, setDeskNote] = useState<DeskNote | null>(null);
  const [openNote, setOpenNote] = useState<DeskNote | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  // ── Opens (see the module-level tokens) ───────────────────────────────────
  // Re-render on a background -> active return so the effects below see the token.
  const [, setOpenTick] = useState(0);
  useEffect(() => {
    const onOpen = () => setOpenTick((n) => n + 1);
    openListeners.add(onOpen);
    return () => {
      openListeners.delete(onOpen);
    };
  }, []);
  const token = openToken;
  useEffect(() => {
    takeOpenGap(appRef.current);
  }, [app.loaded, token]);

  // Re-check the gates whenever the loading overlay shows or lifts (it is not React
  // state, so nothing else re-renders this host when it changes).
  const [loadingTick, setLoadingTick] = useState(0);
  useEffect(() => {
    const offShow = subscribeLoadingScreen(() => setLoadingTick((n) => n + 1));
    const offDone = subscribeLoadingDone(() => setLoadingTick((n) => n + 1));
    return () => {
      offShow();
      offDone();
    };
  }, []);

  const gatesOpen = (a: AppSnapshot, isFocused: boolean) =>
    isFocused &&
    a.loaded &&
    !a.activeSession &&
    a.legalAccepted &&
    a.starterChosen &&
    a.tutorialSeen &&
    !isLoadingActive() &&
    !rewardChainBusy(a);

  // ── Decide (once per open, or for a dev trigger) ──────────────────────────
  const decide = () => {
    const a = appRef.current;
    if (!gatesOpen(a, focusedRef.current)) return;
    const dev = a.devMoment;
    const hasOpen = openToken > consumedToken;
    if (!dev && !hasOpen) return;
    // Consume BEFORE any action: each action re-renders the whole app.
    let gap: OpenGap | null = null;
    if (hasOpen) {
      takeOpenGap(a); // no-op unless this open's gap wasn't read yet
      consumedToken = openToken;
      gap = openGap;
      openGap = null;
    }
    if (dev) a.setDevMoment(null);

    try {
      const today = todayISO();
      const { persona, rawName } = speakerOf(a);
      const moment = chooseMoment(a, persona, dev, dev ? null : gap);
      if (!moment) return;
      const line = momentLine(persona, moment);
      if (!line) return; // no words for it: stay quiet, and don't retire it

      let note: Keepsake | null = null;
      if (moment.kind === 'away_note') {
        const entry = moment.noteId ? awayEntry(persona, moment.noteId) : null;
        if (!moment.noteId || !entry?.text) return;
        note = {
          id: `note:${persona}:${moment.noteId}`,
          persona,
          kind: entry.kind,
          contentId: moment.noteId,
          dateISO: today,
          seen: false,
        };
      }

      const name = localizeCompanionName(rawName, tRef.current);
      // Dev samples don't count toward the 2-a-day cap and don't reach analytics.
      if (!dev) {
        a.recordMomentShown(moment.id, moment.retire);
        track('companion_moment_shown', { kind: moment.kind });
      }
      if (note) {
        a.addKeepsakes([note]);
        a.recordAwayNoteGiven(persona, note.contentId);
        if (!dev) track('companion_note_given', { kind: note.kind, persona });
        setDeskNote({ keepsake: note, name });
      }
      setShown({ key: ++shownSeq, moment, persona, name, line, answer: null, reaction: '', dev: !!dev });
    } catch (e) {
      if (__DEV__) console.warn('[moments] skipped a moment', e);
    }
  };
  const decideRef = useRef(decide);
  decideRef.current = decide;

  const ready = gatesOpen(app, focused);
  useEffect(() => {
    if (!ready) return;
    if (!(openToken > consumedToken) && !app.devMoment) return;
    const timer = setTimeout(() => decideRef.current(), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [ready, token, app.devMoment, loadingTick]);

  // Leaving Home dismisses the bubble (it still counts as said). A note on the desk
  // stays there until it is opened.
  useEffect(() => {
    if (!focused) setShown(null);
  }, [focused]);

  // ── Interactions ──────────────────────────────────────────────────────────
  const dismiss = () => setShown(null);

  const reply = (answer: ReplyAnswer) => {
    const cur = shown;
    if (!cur || cur.answer) return;
    let reaction = '';
    try {
      reaction = reactionLine(cur.persona, cur.moment.kind, answer);
      const followUp = followUpFor(cur.moment, answer, todayISO());
      if (followUp) app.setMomentFollowUp(followUp);
    } catch (e) {
      if (__DEV__) console.warn('[moments] reply handling failed', e);
    }
    if (!cur.dev) track('companion_moment_reply', { kind: cur.moment.kind, answer });
    setShown(reaction ? { ...cur, answer, reaction } : null);
  };

  const openDeskNote = () => {
    if (!deskNote) return;
    setShown(null);
    setOpenNote(deskNote);
  };
  // Done, Android back, or the overlay closing itself because the note text can't be
  // resolved: either way this note leaves the desk and is never offered again here.
  const closedNoteIds = useRef(new Set<string>());
  const closeNote = () => {
    if (deskNote) closedNoteIds.current.add(deskNote.keepsake.id);
    setOpenNote(null);
    setDeskNote(null);
  };

  // A note left on the desk survives Home unmounting (e.g. the player starts studying
  // right after "I wrote you something~"): the newest unopened note or story from today
  // goes back on the desk until it is opened. Notes closed here are never re-offered.
  useEffect(() => {
    if (deskNote || openNote || !app.loaded) return;
    try {
      const { persona, rawName } = speakerOf(app);
      const today = todayISO();
      const k = [...app.keepsakes]
        .reverse()
        .find((x) => x.kind !== 'letter' && !x.seen && x.dateISO === today && x.persona === persona && !closedNoteIds.current.has(x.id));
      if (k) setDeskNote({ keepsake: k, name: localizeCompanionName(rawName, tRef.current) });
    } catch (e) {
      if (__DEV__) console.warn('[moments] desk note restore skipped', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.loaded, app.keepsakes, app.activeCompanionId, deskNote, openNote]);

  const noteModalVisible = useModalSafeVisible(!!openNote && focused);

  // ── Animations ────────────────────────────────────────────────────────────
  const pop = useRef(new Animated.Value(0)).current;
  const shownKey = shown?.key ?? 0;
  useEffect(() => {
    if (!shownKey) return;
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 140, useNativeDriver: true }).start();
  }, [shownKey, pop]);

  const wiggle = useRef(new Animated.Value(0)).current;
  const hasDeskNote = !!deskNote;
  useEffect(() => {
    if (!hasDeskNote) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1100),
        Animated.timing(wiggle, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 170, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0.55, duration: 150, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 130, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      wiggle.setValue(0);
    };
  }, [hasDeskNote, wiggle]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
  };

  // ── Layout (all inside the layer's box: feet at its bottom, desk lip above) ──
  let scene: ReactNode = null;
  if (box && box.h > 0 && (shown || deskNote)) {
    const phW = box.h / 280; // the layer is 280·phW tall on phones, 280·u on tablet
    const k = isTablet ? scale / 1.2 : phW; // size factor for text + chrome
    const lip = box.h * (isTablet ? LIP_FRAC_TABLET : LIP_FRAC_PHONE);
    const rowH = Math.max(44, 44 * k); // reply chips / desk note row (≥ 44pt targets)
    const rowBottom = lip + 10 * k - rowH; // straddles the desk lip, clear of the ingredients
    // Founder call (2026-11-20): the bubble sits ABOVE the companion's head, never over
    // her face. The layer's top edge is where the head ends, so the bubble's bottom
    // edge rests just above it and longer lines grow upward (over the exam/order cards
    // if they must — accepted).
    const bubbleBottom = box.h + 6 * k;
    const bubbleMaxW = Math.min(box.w - 32, 290 * k);
    const hitW = 150 * (isTablet ? scale : phW); // same width as CompanionPet's hitbox
    const envW = 54 * k;
    const showChips = !!shown && !shown.answer && shown.moment.replies.length > 0;
    const text = shown ? (shown.answer ? shown.reaction : shown.line) : '';

    scene = (
      <>
        {shown ? (
          <>
            {/* Tapping the companion (above the desk lip only — never over the
                ingredients) dismisses, like tapping the bubble. */}
            <Pressable
              onPress={dismiss}
              accessible={false}
              importantForAccessibility="no"
              style={{ position: 'absolute', bottom: lip, height: Math.max(0, box.h - lip), width: hitW, left: (box.w - hitW) / 2 }}
            />
            <View pointerEvents="box-none" style={[styles.center, { bottom: bubbleBottom }]}>
              <Animated.View
                style={{
                  opacity: pop.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
                  transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }],
                  transformOrigin: 'center bottom',
                }}>
                <Pressable
                  onPress={dismiss}
                  accessibilityRole="button"
                  accessibilityLabel={`${shown.name}: ${text}`}
                  accessibilityHint={tc('ui.dismissHint')}
                  style={[
                    styles.bubble,
                    {
                      maxWidth: bubbleMaxW,
                      minWidth: Math.min(bubbleMaxW, 150 * k),
                      borderRadius: 18 * k,
                      paddingTop: 15 * k,
                      paddingBottom: 11 * k,
                      paddingHorizontal: 15 * k,
                    },
                  ]}>
                  {/* Tail: points down toward the companion's head. */}
                  <View
                    style={[
                      styles.tail,
                      { width: 14 * k, height: 14 * k, bottom: -6 * k, marginLeft: -7 * k },
                    ]}
                  />
                  <View style={[styles.namePill, { top: -11 * k, left: 14 * k, height: 22 * k, borderRadius: 11 * k, paddingHorizontal: 10 * k, maxWidth: bubbleMaxW - 28 * k }]}>
                    <FitText numberOfLines={1} minScale={0.6} style={[styles.nameText, { fontSize: 12 * k }]}>
                      {shown.name}
                    </FitText>
                  </View>
                  <ThemedText style={[styles.line, { fontSize: 14.5 * k, lineHeight: 19.5 * k }]}>{text}</ThemedText>
                </Pressable>
              </Animated.View>
            </View>
            {showChips ? (
              <View pointerEvents="box-none" style={[styles.row, { bottom: rowBottom, height: rowH, gap: 8 * k }]}>
                {shown.moment.replies.map((answer) => (
                  <Pressable
                    key={answer}
                    onPress={() => reply(answer)}
                    accessibilityRole="button"
                    accessibilityLabel={replyLabel(answer)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        height: rowH,
                        borderRadius: rowH / 2,
                        paddingHorizontal: 14 * k,
                        maxWidth: (box.w - 32 - 8 * k * (shown.moment.replies.length - 1)) / shown.moment.replies.length,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <FitText numberOfLines={1} minScale={0.6} style={[styles.chipText, { fontSize: 14.5 * k }]}>
                      {replyLabel(answer)}
                    </FitText>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {/* The paper note left on the desk: a small sealed envelope that wiggles. */}
        {deskNote && !showChips ? (
          <View pointerEvents="box-none" style={[styles.row, { bottom: rowBottom, height: rowH }]}>
            <Pressable
              onPress={openDeskNote}
              accessibilityRole="button"
              accessibilityLabel={tc('ui.tapToOpen')}
              hitSlop={6}
              style={({ pressed }) => [styles.noteBtn, { height: rowH, gap: 6 * k }, pressed && styles.pressed]}>
              <Animated.View
                style={{
                  transform: [{ rotate: wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] }) }],
                }}>
                <View style={styles.envShadow}>
                  <Envelope width={envW} sealed />
                </View>
              </Animated.View>
              <View style={[styles.notePill, { height: 26 * k, borderRadius: 13 * k, paddingHorizontal: 10 * k, maxWidth: box.w / 2 }]}>
                <FitText numberOfLines={1} minScale={0.6} style={[styles.notePillText, { fontSize: 12.5 * k }]}>
                  {tc('ui.tapToOpen')}
                </FitText>
              </View>
            </Pressable>
          </View>
        ) : null}
      </>
    );
  }

  return (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
        {scene}
      </View>
      {/* The note opens in ONE transparent Modal: the reward chain is clear by the
          time a moment shows, so no other native modal is up to stack on. */}
      <Modal visible={noteModalVisible} transparent animationType="fade" onRequestClose={closeNote}>
        {openNote ? (
          <KeepsakeOverlay keepsake={openNote.keepsake} companionName={openNote.name} onClose={closeNote} />
        ) : null}
      </Modal>
    </>
  );
}

/** Home's speak-first companion. Memoized: Home re-renders every second. */
export const MomentHost = memo(MomentHostImpl);

const INK = BakeryColors.cocoaDark;

const styles = StyleSheet.create({
  center: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  bubble: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#5D3C2E',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  tail: {
    position: 'absolute',
    left: '50%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  namePill: {
    position: 'absolute',
    backgroundColor: BakeryColors.buttonPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameText: { color: '#FFFFFF', fontWeight: '800' },
  line: { color: INK, fontWeight: '700', textAlign: 'center' },
  row: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexShrink: 1,
    backgroundColor: '#FFFDF8',
    borderWidth: 2,
    borderColor: BakeryColors.buttonPink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5D3C2E',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  chipText: { color: BakeryColors.berry, fontWeight: '800' },
  noteBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 44 },
  envShadow: {
    shadowColor: '#281812',
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  notePill: {
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F1BDCC',
  },
  notePillText: { color: INK, fontWeight: '800' },
  pressed: { opacity: 0.75 },
});
