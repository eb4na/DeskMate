import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import Svg, { Line } from 'react-native-svg';
import { Animated, AppState, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { cancelComeBackNudge, sendComeBackNudge } from '@/lib/notifications';

import { CoinIcon } from '@/components/coin-icon';
import { RecipePop } from '@/components/recipe-pop';
import { StudyBook } from '@/components/study-book';
import { StudyOven, EYELET_FRAC } from '@/components/study-oven';
import { StudyVinyl } from '@/components/study-vinyl';
import { hasSoundPreview, playStudyMusic, stopStudyMusic } from '@/lib/ambience-audio';
import { getPlayback, spotifyAppRecentlyOpened, spotifyConnected, spotifyPause, spotifyResume, subscribeSpotify, type Playback } from '@/lib/spotify';
import { SHOP_ITEMS } from '@/constants/shop-data';
import { useIsTablet } from '@/hooks/use-device-class';
import { SubjectPickerModal } from '@/components/subject-picker-modal';
import { FOOD_ITEMS } from '@/app/food-gallery';
import { ThemedText } from '@/components/themed-text';
import { useApp } from '@/context/app-context';
import { autoBreakMinutes, coinsForMinutes, SESSION_LENGTHS } from '@/constants/placeholder-data';
import { SoundPickerModal } from '@/components/sound-picker-modal';
import { DevKnobs } from '@/components/dev-knobs';
import { usePosTweaks } from '@/hooks/use-pos-tweaks';
import { getCompanionImage, hanjiIsAnimated, isHanjiActiveId, resolveActiveCompanion } from '@/lib/companion-utils';
import { HanjiFigure } from '@/components/hanji-figure';
import { useStudyRoom, type StudyStatus } from '@/lib/use-study-room';
import { ROOM_PAIRS } from '@/constants/room-data';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, Spacing } from '@/constants/theme';

const BUN_STUDYING = require('@/assets/images/bun/bun-studying.png');
const AVATAR_FRAME = require('@/assets/images/study/avatar-frame.png');
const PPL_ICON = require('@/assets/images/study/ppl-icon.png');
const BREAK_PILL = require('@/assets/images/study/break-pill.png');
const DESK = require('@/assets/images/home/desk-new.png');
const GAME_BTN = require('@/assets/images/study/game-btn.png');

function format(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Pausing a Spotify track can make the device report as idle (a poll with no item),
// which would blank the now-playing song + cover. Keep showing the last known track
// when that happens — only its play state changes — so a paused song stays on screen.
// A truly disconnected/empty result (`next` null) still clears it.
function mergePlayback(prev: Playback | null, next: Playback | null): Playback | null {
  if (!next) return null;
  if (!next.track && prev?.track) {
    return {
      ...prev,
      isPlaying: next.isPlaying,
      hasDevice: next.hasDevice || prev.hasDevice,
      progressMs: next.progressMs ?? prev.progressMs,
    };
  }
  return next;
}

const DOT_COLOR: Record<StudyStatus, string> = {
  studying: '#5BC47B',
  break: '#F0B44A',
  idle: BakeryColors.latte,
};

// Per-character placement for the desk book (dx = fraction of the 300px canvas,
// negative = left). The book sits centered on the character's column, then shifts
// by dx so it lands under that character's FACE — needed because each studying art
// isn't perfectly face-centered in its canvas (hats/paws/tails pull the art off the
// face). dx = a systematic book-placement bias (~-0.024, common to all) + the
// character's measured face center. These values are MEASURED, not eyeballed —
// regenerate with `python3 scripts/measure-book-offsets.py` and paste the output
// (re-run when art changes or a companion is added).
const SOLO_BOOK_CANVAS = 300; // characterSolo width/height
const SOLO_BOOK_OFFSET: Record<string, { dx: number; dy: number }> = {
  bun: { dx: -0.035, dy: 0 },
  companion_cocoa: { dx: -0.032, dy: 0 },
  companion_tira: { dx: -0.026, dy: 0 },
  companion_honey: { dx: -0.026, dy: 0 },
  companion_bunny: { dx: -0.032, dy: 0 },
  hanji: { dx: -0.018, dy: 0 },
};
const DEFAULT_SOLO_BOOK_OFFSET = { dx: -0.026, dy: 0 };

// Resolve any companion id to its SOLO_BOOK_OFFSET key so the book can sit under
// that character's face in multiplayer too (shop ids keep their bare name).
function bookOffsetFor(companionId: string | null | undefined): { dx: number; dy: number } {
  const key = isHanjiActiveId(companionId ?? '')
    ? 'hanji'
    : companionId?.startsWith('shop:')
      ? companionId.slice(5)
      : 'bun';
  return SOLO_BOOK_OFFSET[key] ?? DEFAULT_SOLO_BOOK_OFFSET;
}

// Tablet-only position knobs (🎛 design panel). Dial these live, hit "Get code",
// and the values bake into TABLET_TWEAKS under `studysession.<name>`.
const TABLET_ELEMENTS = [{ name: 'desk', label: 'Desk' }];

/**
 * The "studying together" screen shown while a session runs. Works solo (one
 * participant) or in a synced study room (up to 4). The session lifecycle
 * (completion → /session-complete) stays in the Home screen; this is the view.
 */
export function StudyRoomView({
  secondsLeft,
  onStop,
  onAway,
  onBreakGame,
  finishing = false,
}: {
  secondsLeft: number;
  onStop: () => void;
  // Force-stop (no confirm) when the player leaves the app mid-session and doesn't
  // return within a minute.
  onAway: () => void;
  onBreakGame: () => void;
  // True for the brief moment the session has just ended — plays the recipe-pop
  // out of the timer before the Home screen navigates to the finish screen.
  finishing?: boolean;
}) {
  const { t } = useTranslation();
  // Tablet: shrink the timer ("oven") and enlarge the character / desk / book /
  // bottom buttons. Sizes only (no transforms) so the character's bounce animation
  // isn't disturbed.
  const isTablet = useIsTablet();
  const { height: winH } = useWindowDimensions();
  // Tablet-only live position tweaks; `tw('desk')` is a transform (identity until
  // dialed + baked). Phone is unaffected.
  const { knobs: twKnobs, onChange: twChange, t: tw } = usePosTweaks('studysession', TABLET_ELEMENTS);
  // The "NOW BAKING" sign hangs from two ropes that reach the real top of the screen.
  // The sign's own SVG is only as tall as the card, so the ropes are drawn separately
  // as a full-height overlay: we measure the card's on-screen rect, then run a rope
  // from the screen top (y=0) straight down to each eyelet. Re-measured on layout so it
  // tracks solo↔multiplayer and tablet size changes.
  const timerCardRef = useRef<View>(null);
  const [ropes, setRopes] = useState<{ top: number; width: number; eyeY: number } | null>(null);
  const measureRopes = useCallback(() => {
    timerCardRef.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && y > 0) setRopes({ top: -y, width: w, eyeY: y + h * EYELET_FRAC.y });
    });
  }, []);
  const {
    activeSession,
    equippedDeskRoomId,
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
    selectedFoodId,
    equippedShopItems,
    ownedShopItems,
    setEquippedSound,
    vinylColor,
  } = useApp();
  // The equipped study sound (a `sound_<id>` shop item) → its ambience id. Music
  // only actually plays for sounds that have an audio file; the vinyl spins to match.
  const equippedAmbId = equippedShopItems.sound ? equippedShopItems.sound.replace('sound_', '') : null;
  // When Spotify is connected it takes over the radio (the user controls it in the
  // sound popup); otherwise the bundled study sound loops. The vinyl spins for either.
  const [spotifyOn, setSpotifyOn] = useState(spotifyConnected());
  useEffect(() => subscribeSpotify(() => setSpotifyOn(spotifyConnected())), []);
  // Live Spotify now-playing, polled below. Lifted here (not just inside the popup)
  // so the radio vinyl on the study screen keeps showing the cover after the popup
  // closes, and so the popup opens already in sync. `null` = nothing/loading.
  const [playback, setPlayback] = useState<Playback | null>(null);
  // On-demand refresh handed to the popup (called after its control taps).
  const refreshPlayback = async () => {
    const pb = spotifyConnected() ? await getPlayback() : null;
    setPlayback((prev) => mergePlayback(prev, pb));
  };
  // What the vinyl's label shows: the Spotify cover when connected & it has art,
  // otherwise the equipped study sound's icon (or nothing).
  const equippedSoundImage = SHOP_ITEMS.find((i) => i.id === equippedShopItems.sound)?.image;
  const vinylCenter: number | { uri: string } | undefined =
    spotifyOn && playback?.coverUrl ? { uri: playback.coverUrl } : equippedSoundImage;
  // Spin only while something is actually playing: Spotify's reported state when
  // connected, else the looping study sound.
  const musicPlaying = (spotifyOn && !!playback?.isPlaying) || (!!equippedAmbId && hasSoundPreview(equippedAmbId));
  // Play/stop the bundled study music. An equipped sound always plays — being
  // merely *connected* to Spotify no longer silences it (set the sound to "Off" to
  // hand the radio back to Spotify).
  useEffect(() => { playStudyMusic(equippedAmbId); }, [equippedAmbId]);
  useEffect(() => () => stopStudyMusic(), []);

  // Spin the radio's record to toggle play/stop (spin once = start, spin again =
  // stop). Spotify: pause/resume. Study sound: flip the equipped sound on/off (the
  // effect above plays or stops it), remembering the last one so it resumes.
  const lastSoundRef = useRef(equippedShopItems.sound);
  useEffect(() => { if (equippedShopItems.sound) lastSoundRef.current = equippedShopItems.sound; }, [equippedShopItems.sound]);
  const onVinylSpin = () => {
    if (spotifyOn) {
      (playback?.isPlaying ? spotifyPause : spotifyResume)();
      setTimeout(refreshPlayback, 700);
      return;
    }
    if (equippedShopItems.sound) {
      setEquippedSound(null);
    } else {
      const next = lastSoundRef.current ?? SHOP_ITEMS.find((i) => i.category === 'sound' && ownedShopItems.includes(i.id))?.id ?? null;
      if (next) setEquippedSound(next);
    }
  };

  // Focus enforcement: leaving the app mid-session fires a "come back" notification,
  // and the session auto-stops if the player doesn't return within a minute. iOS
  // suspends JS in the background, so the 60s timer is best-effort — the reliable
  // check is the elapsed time measured when the app returns to the foreground.
  // (refs keep this effect mounted once even though onAway/t change each render.)
  const onAwayRef = useRef(onAway);
  onAwayRef.current = onAway;
  const tRef = useRef(t);
  tRef.current = t;
  // The come-back notification body, in the active companion's voice. Set further
  // down once soloBookKey is known; defaults to the generic warning.
  const awayBodyKeyRef = useRef('session.awayBody');
  useEffect(() => {
    const AWAY_MS = 60_000;
    let awayAt: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let nudgeId: string | null = null;
    let stopped = false;
    const stop = () => { if (!stopped) { stopped = true; onAwayRef.current(); } };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        if (awayAt != null) return; // already away
        awayAt = Date.now();
        // If they just tapped "open in Spotify", hold the nudge ~10s so it doesn't
        // scold them for deliberately stepping out to start music.
        const nudgeDelay = spotifyAppRecentlyOpened() ? 10 : 1;
        sendComeBackNudge(tRef.current('session.awayTitle'), tRef.current(awayBodyKeyRef.current), nudgeDelay).then((id) => { nudgeId = id; });
        timer = setTimeout(stop, AWAY_MS);
      } else if (state === 'active') {
        const since = awayAt;
        awayAt = null;
        if (timer) { clearTimeout(timer); timer = null; }
        cancelComeBackNudge(nudgeId);
        nudgeId = null;
        if (since != null && Date.now() - since >= AWAY_MS) stop();
      }
    });
    return () => { sub.remove(); if (timer) clearTimeout(timer); cancelComeBackNudge(nudgeId); };
  }, []);

  // The baked recipe's dish art (springs out of the timer when the session ends).
  const dishImage = (FOOD_ITEMS.find((f) => f.id === selectedFoodId) ?? FOOD_ITEMS[0]).image;
  const room = useStudyRoom();
  // In a room everyone studies on the host's desk; solo uses my equipped desk.
  const deskRoomId = room.active && room.hostDeskId ? room.hostDeskId : equippedDeskRoomId;
  const deskRoom = ROOM_PAIRS.find((r) => r.id === deskRoomId);
  const equippedDeskImage = deskRoom?.deskImage ?? DESK;

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

  // Poll Spotify's now-playing so the radio vinyl shows the live cover even with the
  // popup closed; a faster cadence while the popup is open keeps controls/scrub fresh.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const pb = spotifyConnected() ? await getPlayback() : null;
      if (alive) setPlayback((prev) => mergePlayback(prev, pb));
    };
    tick(); // immediate so the popup opens / vinyl shows already in sync
    if (!spotifyOn) return () => { alive = false; };
    const id = setInterval(tick, soundOpen ? 3500 : 8000);
    return () => { alive = false; clearInterval(id); };
  }, [spotifyOn, soundOpen]);

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

  // Where the desk book sits in front of THIS character (see SOLO_BOOK_OFFSET).
  // Hanji renders as a layered figure, so key it explicitly; shop companions key
  // by item id ('companion_cocoa', …); the starter is Bun; custom slots default.
  const soloBookKey = isHanjiActiveId(activeCompanionId)
    ? 'hanji'
    : me.type === 'shop'
      ? me.id
      : me.type === 'starter'
        ? 'bun'
        : 'custom';
  // Pick the companion-flavored come-back line (custom characters keep the generic
  // warning). en.json holds the English copy; other locales fall back to it.
  awayBodyKeyRef.current = soloBookKey === 'custom' ? 'session.awayBody' : `session.awayBody_${soloBookKey}`;
  const soloBookOffset = SOLO_BOOK_OFFSET[soloBookKey] ?? DEFAULT_SOLO_BOOK_OFFSET;

  // Equipped solo character: a gentle, slow bounce with a tiny squash-and-stretch
  // (same idle motion as the home screen). 0 = resting/lowest, 1 = apex.
  const charBounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(charBounce, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(charBounce, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [charBounce]);
  const charTranslateY = charBounce.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const charScaleY = charBounce.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] });
  const charScaleX = charBounce.interpolate({ inputRange: [0, 1], outputRange: [1.02, 0.99] });

  // Solo (no synced room) vs multiplayer changes what's shown.
  const isSolo = !room.active;
  const breakMinutes = activeSession?.breakMinutes && activeSession.breakMinutes > 0
    ? activeSession.breakMinutes
    : autoBreakMinutes(activeSession?.durationMinutes ?? 25);
  // A solo session with no break (short warm-up) hides the Break control entirely.
  // Multiplayer breaks are a free soft-toggle, so they always stay available.
  const showBreakButton = !isSolo || breakMinutes > 0;

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
  const partyCharSize = partyCount <= 1 ? 280 : partyCount === 2 ? 188 : partyCount === 3 ? 150 : 120;
  const partyBookSize = Math.round(partyCharSize * 0.52);
  // When you're the only one in the room (others left, or before they begin), the
  // party row would render a single oversized, off-center character/book that floats
  // off the desk — so render the solo scene (big centered character + desk book) instead.
  const soloScene = isSolo || participants.length <= 1;
  // Rooms cap at 4 people — hide the invite button once full.
  const roomFull = participants.length >= 4;

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

  // Multiplayer finish (no cake): credit coins once, then offer study-again/break/exit.
  const [finishPickerOpen, setFinishPickerOpen] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const creditedRef = useRef<string | null>(null);
  const mpFinished = !!activeSession?.isMultiplayer && secondsLeft <= 0;
  // Post-finish unlimited break: a resting state with a Continue button (no timer,
  // no limit). Separate from `onBreak` (the in-session soft break) on purpose.
  const [finishBreak, setFinishBreak] = useState(false);
  // "Study again" lets the player pick a fresh duration + subject; the chosen
  // duration waits here between the time picker and the subject picker.
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [restartDuration, setRestartDuration] = useState<number | null>(null);

  const startFinishBreak = () => {
    setFinishBreak(true);
    if (room.active) room.setStatus('break');
  };
  const endFinishBreak = () => {
    setFinishBreak(false);
    if (room.active) room.setStatus('idle');
  };
  const pickRestartDuration = (minutes: number) => {
    setRestartDuration(minutes);
    setDurationPickerOpen(false);
    setFinishPickerOpen(true);
  };

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
      durationMinutes: restartDuration ?? activeSession.durationMinutes,
      subjectName,
      taskId: null,
      taskTitle: null,
      startedAt: new Date().toISOString(),
      isMultiplayer: true,
    });
    setFinishPickerOpen(false);
    setRestartDuration(null);
    setMpSubjectPicked(true);
    setOnBreak(false);
    setFinishBreak(false);
  };

  const handleFinishExit = () => {
    room.leaveRoom();
    clearActiveSession();
  };

  return (
    <View style={styles.root}>
      {/* Invite-to-room button (top right) — multiplayer only, hidden once the
          room is full at 4 (shows a "Full" chip instead). */}
      {!isSolo && (
        roomFull ? (
          <View style={[styles.addFriendBtn, styles.roomFullBadge]}>
            <Text style={styles.addFriendLabel}>{t('studyRoom.full')}</Text>
          </View>
        ) : (
          <Pressable onPress={handleAddFriend} style={({ pressed }) => [styles.addFriendBtn, pressed && styles.pressed]} hitSlop={8}>
            <Text style={styles.addFriendIcon}>＋</Text>
            <Text style={styles.addFriendLabel}>{t('studyRoom.friend')}</Text>
          </Pressable>
        )
      )}

      {/* Timer card */}
      <View ref={timerCardRef} onLayout={measureRopes} style={[styles.timerWrap, isSolo && styles.timerWrapSolo, isTablet && { width: isSolo ? '62%' : '48%' }]}>
        {/* Ropes from the real top of the screen down to the sign's eyelets. Rendered
            behind StudyOven so the sign body + eyelet circles cover the rope ends. */}
        {ropes && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: ropes.top, width: ropes.width, height: ropes.eyeY }}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${ropes.width} ${ropes.eyeY}`}>
              {[EYELET_FRAC.left, EYELET_FRAC.right].map((f) => (
                <Line key={`rope${f}`} x1={ropes.width * f} y1={0} x2={ropes.width * f} y2={ropes.eyeY} stroke="#B98E5E" strokeWidth={(10 * ropes.width) / 1032} strokeLinecap="round" />
              ))}
              {[EYELET_FRAC.left, EYELET_FRAC.right].map((f) => (
                <Line key={`ropehi${f}`} x1={ropes.width * f} y1={0} x2={ropes.width * f} y2={ropes.eyeY} stroke="#D8B589" strokeWidth={(3.5 * ropes.width) / 1032} strokeLinecap="round" />
              ))}
            </Svg>
          </View>
        )}
        <StudyOven style={StyleSheet.absoluteFill} />
        <View style={styles.timerText}>
          <Text style={[styles.nowBaking, isSolo && styles.nowBakingSolo, isTablet && styles.nowBakingTablet]}>{t('studyRoom.nowBaking')}</Text>
          <Text style={[styles.timer, isSolo && styles.timerSolo, isTablet && styles.timerTablet]}>{format(displaySecs)}</Text>
          {!isSolo && (
            <View style={styles.studyingRow}>
              <Image source={PPL_ICON} style={styles.pplIcon} contentFit="contain" />
              <Text style={styles.bakeSub}>
                {studyingCount === 1 ? t('studyRoom.oneStudying') : t('studyRoom.studyingTogether', { count: studyingCount })}
              </Text>
            </View>
          )}
        </View>
        {/* When the session ends, the baked recipe springs up out of the timer. */}
        {isSolo && <RecipePop dish={dishImage} playing={finishing} />}
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
          with a live status dot (or  on break). */}
      <View style={styles.scene}>
        {soloScene && (
          // Transform lives on an Animated.View (like Home) — applying it to the
          // expo-image directly stutters because the study view re-renders every
          // second (the countdown), which re-attaches the native animation nodes.
          <Animated.View
            style={[
              styles.character,
              styles.characterSolo,
              isTablet && styles.characterSoloTablet,
              { transform: [{ translateY: charTranslateY }, { scaleX: charScaleX }, { scaleY: charScaleY }] },
            ]}>
            {hanjiIsAnimated(activeCompanionId, companionSkins?.[activeCompanionId ?? '']) ? (
              <HanjiFigure style={styles.characterFill} />
            ) : (
              <Image source={bigCharacter} style={styles.characterFill} contentFit="contain" />
            )}
          </Animated.View>
        )}
        {isSolo && onBreak && (
          <View style={styles.breakBadge}>
            <Text style={styles.breakBadgeText}>
              {t('studyRoom.onBreakTimer', { time: format(breakLeft) })}
            </Text>
          </View>
        )}
      </View>

      {/* Multiplayer characters — an absolute row lifted so heads clear the desk
          edge. Sits behind the desk (same zIndex, drawn before) so the lower body
          tucks behind the table, like the solo character. */}
      {!soloScene && (
        <View style={styles.partyLayer} pointerEvents="none">
          {participants.slice(0, 4).map((p) => {
            const status = participantStatus(p.code);
            const img = p.code === friendCode ? bigCharacter : getCompanionImage(p.companionId, p.skinId);
            const pIsHanji = p.code === friendCode
              ? hanjiIsAnimated(activeCompanionId, companionSkins?.[activeCompanionId ?? ''])
              : hanjiIsAnimated(p.companionId, p.skinId);
            return (
              <View key={p.code} style={[styles.partyMember, { width: partyCharSize }]}>
                {status === 'break' ? (
                  <View style={styles.partyStatusPill}><Text style={styles.partyStatusEmoji}></Text></View>
                ) : (
                  <View style={[styles.partyDot, { backgroundColor: DOT_COLOR[status] }]} />
                )}
                {/* Same gentle idle bounce as the solo character (transform on an
                    Animated.View, not the image, to avoid per-second re-render stutter). */}
                <Animated.View
                  style={{ transform: [{ translateY: charTranslateY }, { scaleX: charScaleX }, { scaleY: charScaleY }] }}>
                  {pIsHanji ? (
                    <HanjiFigure style={{ width: partyCharSize, height: partyCharSize }} />
                  ) : (
                    <Image source={img} style={{ width: partyCharSize, height: partyCharSize }} contentFit="contain" />
                  )}
                </Animated.View>
              </View>
            );
          })}
        </View>
      )}

      {/* Desk surface — a full-width layer along the bottom. The character sits
          behind it; the book, controls and end-session button lie ON it. */}
      <Image source={equippedDeskImage} style={[styles.studyDesk, isTablet && styles.studyDeskTablet, deskRoom?.deskTint ? { backgroundColor: deskRoom.deskTint } : null, tw('desk')]} contentFit={deskRoom?.deskFit ?? 'cover'} pointerEvents="none" />
      <View style={[styles.deskEdge, isTablet && { bottom: winH * 0.43 - 100 }]} pointerEvents="none" />
      {soloScene ? (
        <View
          style={[
            styles.bookOnDesk,
            isTablet && styles.bookOnDeskTablet,
            // Sit dead-center on screen — no per-character horizontal nudge. (Only
            // the vertical dy is applied; dx is intentionally dropped so the book
            // reads as centered rather than shifted under each face.)
            { transform: [{ translateY: SOLO_BOOK_CANVAS * soloBookOffset.dy }] },
          ]}
          pointerEvents="none">
          <StudyBook active={!onBreak} size={isTablet ? 176 : 118} />
        </View>
      ) : (
        // One book per character. Book and character share identical columns (same
        // row layout + partyCharSize slots); each book then gets ITS character's
        // face offset (same measured values as solo, scaled to partyCharSize) so it
        // sits under that character's face — book + character move as one object.
        <View style={styles.partyBookRow} pointerEvents="none">
          {participants.slice(0, 4).map((p) => {
            const off = bookOffsetFor(p.code === friendCode ? activeCompanionId : p.companionId);
            return (
              <View
                key={p.code}
                style={[
                  styles.partyBookSlot,
                  { width: partyCharSize, transform: [{ translateX: partyCharSize * off.dx }, { translateY: partyCharSize * off.dy }] },
                ]}>
                <StudyBook active={participantStatus(p.code) !== 'break'} size={partyBookSize} />
              </View>
            );
          })}
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {/* Game button with the radio (sound picker) stacked directly above it.
            The game slot keeps its space even while studying (button hidden) so the
            radio is already in its final spot and doesn't jump up when break starts. */}
        <View style={[styles.gameCol, isTablet && styles.gameColTablet]}>
          <Pressable onPress={() => setSoundOpen(true)} style={({ pressed }) => [styles.radioBtn, pressed && styles.pressed]} hitSlop={8}>
            <StudyVinyl size={isTablet ? 92 : 64} playing={musicPlaying} discColor={vinylColor} centerImage={vinylCenter} onSpin={onVinylSpin} />
          </Pressable>
          <Pressable
            onPress={onBreakGame}
            disabled={!onBreak}
            style={({ pressed }) => [styles.gameBtnWrap, isTablet && { width: 64, height: 56 }, pressed && onBreak && styles.pressed]}
            hitSlop={6}>
            {onBreak && <Image source={GAME_BTN} style={[styles.gameBtn, isTablet && { width: 64, height: 56 }]} contentFit="contain" />}
          </Pressable>
        </View>
        {showBreakButton && (
          <SoundPressable
            onPress={handleBreak}
            disabled={breakDisabled}
            style={({ pressed }) => [styles.breakBtn, isTablet && { width: 340, height: 66 }, breakDisabled && styles.breakBtnDisabled, pressed && styles.pressed]}>
            <Image source={BREAK_PILL} style={StyleSheet.absoluteFill} contentFit="fill" pointerEvents="none" />
            <Text style={[styles.breakBtnText, isTablet && { fontSize: 21 }]}>{breakLabel}</Text>
          </SoundPressable>
        )}
      </View>
      <SoundPressable onPress={handleLeave} style={({ pressed }) => [styles.endBtn, isTablet && { paddingHorizontal: 34, paddingVertical: 14 }, pressed && styles.endBtnPressed]} hitSlop={8}>
        <Text style={[styles.endBtnText, isTablet && { fontSize: 18 }]}>{room.active ? t('studyRoom.leaveRoom') : t('session.endSession')}</Text>
      </SoundPressable>

      {/* Multiplayer: pick your own subject at the start */}
      <SubjectPickerModal
        visible={needStartSubject}
        title={t('studyRoom.whatStudying')}
        onPick={pickStartSubject}
        onClose={() => pickStartSubject(null)}
      />

      {/* Multiplayer finish — either the unlimited break (Continue, no limit) or
          the finish menu. Both sit on the same full-screen layer so the live
          session controls underneath stay covered. */}
      {mpFinished && (finishBreak ? (
        // Lighter backdrop so the resting characters/desk show through behind the card.
        <View style={styles.finishOverlayLight}>
          <View style={styles.finishCard}>
            <Text style={styles.finishTitle}>{t('studyRoom.onBreakBadge')}</Text>
            <SoundPressable sound="confirm" onPress={endFinishBreak} style={({ pressed }) => [styles.finishBtn, pressed && styles.pressed]}>
              <Text style={styles.finishBtnText}>{t('sessionComplete.continue')}</Text>
            </SoundPressable>
          </View>
        </View>
      ) : (
        <View style={styles.finishOverlay}>
          <View style={styles.finishCard}>
            <Text style={styles.finishTitle}>{t('studyRoom.sessionComplete')}</Text>
            <View style={styles.coinRow}>
              <CoinIcon size={24} />
              <Text style={styles.coinText}>+{coinsEarned}</Text>
            </View>
            <SoundPressable onPress={() => setDurationPickerOpen(true)} style={({ pressed }) => [styles.finishBtn, pressed && styles.pressed]}>
              <Text style={styles.finishBtnText}>{t('studyRoom.studyAgain')}</Text>
            </SoundPressable>
            <SoundPressable onPress={startFinishBreak} style={({ pressed }) => [styles.finishBtn, pressed && styles.pressed]}>
              <Text style={styles.finishBtnText}>{t('studyRoom.takeBreak')}</Text>
            </SoundPressable>
            <Pressable onPress={handleFinishExit} style={({ pressed }) => [styles.finishBtnGhost, pressed && styles.pressed]}>
              <Text style={styles.finishBtnGhostText}>{t('studyRoom.exit')}</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* Study-again step 1: pick a fresh session length. */}
      {durationPickerOpen && (
        <View style={styles.finishOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDurationPickerOpen(false)} />
          <View style={styles.finishCard}>
            <Text style={styles.finishTitle}>{t('studyRoom.howLong')}</Text>
            {SESSION_LENGTHS.map((opt) => (
              <Pressable
                key={opt.minutes}
                onPress={() => pickRestartDuration(opt.minutes)}
                style={({ pressed }) => [styles.finishBtn, pressed && styles.pressed]}>
                <Text style={styles.finishBtnText}>{t('studyRoom.minutesOption', { count: opt.minutes })}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Study-again step 2: pick the subject, then restart with the chosen length. */}
      <SubjectPickerModal
        visible={finishPickerOpen}
        title={t('studyRoom.studyDifferent')}
        onPick={restartWithSubject}
        onClose={() => setFinishPickerOpen(false)}
      />

      {/* Radio: pick a bought sound to play while studying */}
      <SoundPickerModal visible={soundOpen} onClose={() => setSoundOpen(false)} playback={playback} onRefresh={refreshPlayback} />
      <DevKnobs screen="studysession" knobs={twKnobs} onChange={twChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.one, gap: Spacing.two },

  // Timer card
  timerWrap: { alignSelf: 'center', width: '52%', aspectRatio: 1032 / 838, marginTop: -36 },
  timerWrapSolo: { width: '88%' },
  timerText: { position: 'absolute', left: '17%', right: '17%', top: '36%', bottom: '18%', alignItems: 'center', justifyContent: 'center' },
  nowBaking: { fontSize: 9, fontWeight: '800', color: BakeryColors.mocha, letterSpacing: 2, marginBottom: 2 },
  nowBakingSolo: { fontSize: 13 },
  timer: { fontSize: 32, fontWeight: '900', color: BakeryColors.cocoaDark, letterSpacing: 1 },
  timerSolo: { fontSize: 56 },
  // Tablet: bigger timer to fill the wider sign.
  timerTablet: { fontSize: 84 },
  nowBakingTablet: { fontSize: 18, marginBottom: 4 },
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
  characterFill: { width: '100%', height: '100%' },
  // Solo: match the Home-screen companion size (300×300) so it feels prominent.
  characterSolo: { width: 300, height: 300, marginBottom: 40 },
  // Tablet: much bigger character, lifted more so it still sits on the desk.
  characterSoloTablet: { width: 450, height: 450, marginBottom: 140 },
  // Multiplayer party — characters evenly spaced (equal gaps incl. the ends),
  // lifted up so heads clear the desk edge (240) and tuck behind the table.
  partyLayer: {
    position: 'absolute', left: 0, right: 0, bottom: 184,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-evenly', zIndex: 1,
  },
  partyMember: { alignItems: 'center' },
  // One book per character, on the desk surface, columns aligned to partyLayer.
  partyBookRow: {
    position: 'absolute', left: 0, right: 0, bottom: 180,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-evenly', zIndex: 2,
  },
  partyBookSlot: { alignItems: 'center' },
  partyDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff', marginBottom: 3 },
  partyStatusPill: { backgroundColor: 'rgba(78,53,40,0.85)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, marginBottom: 3 },
  partyStatusEmoji: { fontSize: 13 },
  // Desk surface sits low across the base (like Home) so the character shows above it.
  // Full desk surface filling the bottom, like Home. Character sits behind it
  // (lifted up via characterSolo.marginBottom) and the book/buttons sit on top.
  // Desk surface layer along the bottom (behind character, under book/controls).
  studyDesk: { position: 'absolute', left: -Spacing.three, right: -Spacing.three, bottom: -60, height: 300, zIndex: 1 },
  // Tablet: taller desk surface that rises higher so the flat desk meets the room's
  // own desk/furniture line instead of cutting across it on the sides. (Dial via the
  // 🎛 desk knob in a live session if the seam needs nudging per room.)
  studyDeskTablet: { height: '50%', left: -60, right: -60, bottom: -100 },
  deskEdge: { position: 'absolute', left: -Spacing.three, right: -Spacing.three, bottom: 240, height: 1.5, backgroundColor: 'rgba(120, 90, 70, 0.22)', zIndex: 1 },
  // Base position spans root's padded content box (same axis as the character
  // canvas) for a geometric center; a per-character transform (SOLO_BOOK_OFFSET)
  // then nudges it to sit right in front of each companion's visual center.
  bookOnDesk: { position: 'absolute', bottom: 150, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  // Tablet: book sits in front of the bigger/lifted character (lowered a bit).
  bookOnDeskTablet: { bottom: 205 },
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
  controls: { position: 'relative', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginTop: Spacing.one, zIndex: 2 },
  // Radio sits directly above the game button so the two line up. Floated to the
  // left so the Break pill stays centered on screen.
  gameCol: { position: 'absolute', left: 0, bottom: -68, alignItems: 'center', gap: 6 },
  // Tablet: nudge the radio/game column right a bit and higher up.
  gameColTablet: { left: 16, bottom: -44 },
  // Fixed size so the slot reserves the game button's space even when it's hidden
  // (studying) — keeps the radio above it from shifting when break reveals it.
  gameBtnWrap: { width: 44, height: 38, alignItems: 'center', justifyContent: 'center' },
  gameBtn: { width: 44, height: 38 },
  breakBtn: { width: 240, height: 46, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  breakBtnDisabled: { opacity: 0.5 },
  breakBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  endBtn: {
    alignSelf: 'center', marginTop: Spacing.two,
    paddingHorizontal: 22, paddingVertical: 9,
    borderRadius: BakeryRadii.pill,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1.5, borderColor: BakeryColors.shortbread,
    zIndex: 2,
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
  roomFullBadge: { paddingHorizontal: 11, opacity: 0.7 },

  // Radio (sound picker) — stacked above the game button in the controls row.
  radioBtn: { alignItems: 'center', justifyContent: 'center' },
  radioImg: { width: 64, height: 64 },

  // Multiplayer finish menu
  finishOverlay: { ...StyleSheet.absoluteFill, zIndex: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(48,32,24,0.45)', padding: 28 },
  // Unlimited-break backdrop — full-screen (still covers the live controls) but
  // light enough that the resting characters/desk show through behind the card.
  finishOverlayLight: { ...StyleSheet.absoluteFill, zIndex: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(48,32,24,0.18)', padding: 28 },
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
