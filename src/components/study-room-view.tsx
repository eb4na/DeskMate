import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import Svg, { Line } from 'react-native-svg';
import { Animated, AppState, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { DurationWheel } from '@/components/duration-wheel';
import { cancelComeBackNudge, sendComeBackNudge } from '@/lib/notifications';

import { CoinIcon } from '@/components/coin-icon';
import { CompanionLevel } from '@/components/companion-level';
import { RecipePop } from '@/components/recipe-pop';
import { StudyBook } from '@/components/study-book';
import { StudyOven, EYELET_FRAC } from '@/components/study-oven';
import { StudyVinyl } from '@/components/study-vinyl';
import { hasSoundPreview, playStudyMusic, stopStudyMusic } from '@/lib/ambience-audio';
import { playPop } from '@/lib/sounds';
import { getPlayback, spotifyAppRecentlyOpened, spotifyConnected, spotifyPause, spotifyPlay, subscribeSpotify, type Playback } from '@/lib/spotify';
import { SHOP_ITEMS } from '@/constants/shop-data';
import { useIsTablet } from '@/hooks/use-device-class';
import { SubjectPickerModal } from '@/components/subject-picker-modal';
import { FOOD_ITEMS } from '@/app/food-gallery';
import { ThemedText } from '@/components/themed-text';
import { useApp } from '@/context/app-context';
import { autoBreakMinutes, coinsForMinutes, SESSION_LENGTHS, formatCoins } from '@/constants/placeholder-data';
import { SoundPickerModal } from '@/components/sound-picker-modal';
import { DevKnobs } from '@/components/dev-knobs';
import { usePosTweaks } from '@/hooks/use-pos-tweaks';
import { getCompanionImage, hanjiIsAnimated, isHanjiActiveId, resolveActiveCompanion } from '@/lib/companion-utils';
import { FloatingHeart, makeHearts, PetBubble, type Heart } from '@/components/companion-pet';
import { getPetLine } from '@/constants/pet-lines';
import { HanjiFigure } from '@/components/hanji-figure';
import { useStudyRoom, STUDY_ROOM_MAX, type StudyStatus } from '@/lib/use-study-room';
import { joinPresence, setMyPresenceStatus } from '@/lib/game-net';
import { ROOM_PAIRS } from '@/constants/room-data';
import { useTranslation } from '@/i18n';
import { BakeryColors, BakeryRadii, BakeryShadow, MIN_POPUP_WIDTH, Spacing } from '@/constants/theme';

// Active-companion id → pet-line persona key (the i18n `pet.<key>` voice). Tapping
// a character during a session shows one of its lines. Custom/AI slots map to
// undefined → the generic lines.
const PERSONA_BY_COMPANION: Record<string, string> = {
  'starter:girl': 'bun',
  'shop:companion_bun': 'bun',
  'shop:companion_cocoa': 'cocoa',
  'shop:companion_bunny': 'bunny',
  'shop:companion_honey': 'miel',
  'shop:companion_tira': 'tira',
  'shop:companion_hanji': 'hanji',
};

const BUN_STUDYING = require('@/assets/images/bun/bun-studying.png');
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

// The desk book's cover is tinted to each character's signature color, keyed the
// same way as SOLO_BOOK_OFFSET. Custom companions keep the default brown cover.
const BOOK_COVER_COLOR: Record<string, string> = {
  bun: '#ffc9d0',
  companion_cocoa: '#c99a73',
  companion_bunny: '#ffc2df',
  companion_honey: '#ffcd8c',
  companion_tira: '#a3d6ff',
  hanji: '#b7a0e0',
};
const DEFAULT_BOOK_COVER = '#C2925E';

// Tablet-only position knobs (🎛 design panel). Dial these live, hit "Get code",
// and the values bake into TABLET_TWEAKS under `studysession.<name>`.
const TABLET_ELEMENTS = [{ name: 'desk', label: 'Desk' }];

/**
 * The "studying together" screen shown while a session runs. Works solo (one
 * participant) or in a synced study room (up to 3). The session lifecycle
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
  const { width: winW, height: winH } = useWindowDimensions();
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
    markSessionMultiplayer,
    startActiveSession,
    clearActiveSession,
    addCoins,
    recordSession,
    recordQuestSession,
    addSubjectTime,
    updateStreak,
    companionMinutes,
    selectedFoodId,
    equippedShopItems,
    ownedShopItems,
    setEquippedSound,
    vinylColor,
    spotifyBgEnabled,
    spotifyBgColor,
    isPlus,
  } = useApp();
  const room = useStudyRoom();
  // "Spotify background" focus mode: a minimal scene (plain text countdown, no desk or
  // book, character dropped lower and bouncing hard) over the solid bg + big cover vinyl.
  // In a multiplayer room, a GUEST follows the host's broadcast (so the host turning it
  // on gives every player the disco scene, Plus or not); the host + a solo studier use
  // their own setting.
  const followsHostDisco = room.active && !room.isHost;
  const focus = followsHostDisco ? room.hostDiscoOn : spotifyBgEnabled;
  const discoColor: 'black' | 'white' = followsHostDisco ? room.hostDiscoColor : spotifyBgColor;
  const focusFg = discoColor === 'white' ? '#111111' : '#FFFFFF';
  // Tap-to-talk during a session: tapping a character pops one of its pet lines in a
  // cloud above it. `talk.code` is whose bubble is showing (mine = my friendCode).
  const [talk, setTalk] = useState<{ code: string; line: string; id: number } | null>(null);
  const myPersona = PERSONA_BY_COMPANION[activeCompanionId ?? ''];
  const mySkin = activeCompanionId === 'starter:girl' ? bunSkinId : companionSkins?.[activeCompanionId ?? ''] ?? 'classic';
  // Tap reaction (same feel as Home's CompanionPet): a quick squish bounce + a burst of
  // hearts, in addition to the spoken line. Native-driven so the per-second countdown
  // re-render never re-attaches/stutters the animation. Hearts render in whichever
  // character was tapped (matched on `talk.code`); `heartScale` sizes them to it.
  const tapScale = useRef(new Animated.Value(1)).current;
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [heartScale, setHeartScale] = useState(1);
  const talkAs = (code: string, persona: string | undefined, skin: string | undefined, scale = 1) => {
    playPop();
    Animated.sequence([
      Animated.timing(tapScale, { toValue: 1.1, duration: 110, useNativeDriver: true }),
      Animated.spring(tapScale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
    setHeartScale(scale);
    setHearts((h) => [...h, ...makeHearts(scale)]);
    setTalk({ code, line: getPetLine(persona, skin), id: Date.now() });
  };

  // Host radio (bundled study sounds): when a Plus host shares, every guest plays
  // the HOST's equipped study sound instead of their own. Only guests are overridden
  // (the host + solo studiers always use their own sound). `hostSoundId` null while
  // sharing = host turned its sound off, so the guest goes quiet too.
  const hostSharingSound = room.active && !room.isHost && room.hostSoundShared;
  const effectiveSoundItem = hostSharingSound ? room.hostSoundId : equippedShopItems.sound;
  // The effective study sound (a `sound_<id>` shop item) → its ambience id. Music
  // only actually plays for sounds that have an audio file; the vinyl spins to match.
  const equippedAmbId = effectiveSoundItem ? effectiveSoundItem.replace('sound_', '') : null;
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
  const equippedSoundImage = SHOP_ITEMS.find((i) => i.id === effectiveSoundItem)?.image;
  const vinylCenter: number | { uri: string } | undefined =
    spotifyOn && playback?.coverUrl ? { uri: playback.coverUrl } : equippedSoundImage;
  // The big disco vinyl's art: a guest shows the HOST's cover (synced) — or the host's
  // shared bundled-sound icon (effectiveSoundItem already resolves to it) when the host
  // isn't on Spotify; the host + a solo studier use their own vinylCenter.
  const discoVinylCenter: number | { uri: string } | undefined = followsHostDisco
    ? (room.hostCoverUrl ? { uri: room.hostCoverUrl } : equippedSoundImage)
    : vinylCenter;
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
    // A guest hearing the host's shared sound can't change it — the radio just
    // reflects the host's music, so a spin would have no audible effect.
    if (hostSharingSound) return;
    if (spotifyOn) {
      // Pause is a simple toggle; play targets a device explicitly (a bare resume
      // can't wake an idle Spotify) so the music actually starts.
      if (playback?.isPlaying) spotifyPause();
      else spotifyPlay();
      setTimeout(refreshPlayback, 700);
      return;
    }
    if (equippedShopItems.sound) {
      setEquippedSound(null);
    } else {
      const next = lastSoundRef.current ?? SHOP_ITEMS.find((i) => i.category === 'sound' && (isPlus || ownedShopItems.includes(i.id)))?.id ?? null;
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
  // "Someone left" notice: when a fellow studier leaves mid-session we don't
  // interrupt with a popup — a small line of text fades in under the participant
  // row (with a bubble "pop"), then fades itself out a few seconds later. The
  // timer never stops; nothing to dismiss. `null` = hidden, a string = the message.
  const [leftNotice, setLeftNotice] = useState<string | null>(null);
  const leftFade = useRef(new Animated.Value(0)).current;
  const leftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Previous snapshot of the OTHER participants' codes (≠ me) + a code→name lookup,
  // so a leaver's name survives after they're already out of the roster.
  const prevOtherCodesRef = useRef<string[] | null>(null);
  const nameByCodeRef = useRef<Record<string, string>>({});

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

  // Broadcast my study status to friends' online presence while a session is on
  // screen, so they see me as "studying" (red) or "on break" (pink) on the game-invite
  // list — and can only pull me into a break game when I'm on a break. Keep the
  // presence channel up for the session; reset to "free" when the view goes away.
  useEffect(() => {
    const leave = joinPresence(friendCode);
    return () => { setMyPresenceStatus('free'); leave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendCode]);
  useEffect(() => {
    setMyPresenceStatus(onBreak ? 'break' : 'studying');
  }, [onBreak]);

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
  const soloBookColor = BOOK_COVER_COLOR[soloBookKey] ?? DEFAULT_BOOK_COVER;

  // Equipped solo character: a gentle, slow bounce with a tiny squash-and-stretch
  // (same idle motion as the home screen). 0 = resting/lowest, 1 = apex.
  const charBounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Focus mode bounces hard + fast; normal mode is the gentle home-screen idle.
    const dur = focus ? 300 : 900;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(charBounce, { toValue: 1, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(charBounce, { toValue: 0, duration: dur, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [charBounce, focus]);
  const charTranslateY = charBounce.interpolate({ inputRange: [0, 1], outputRange: [0, focus ? -36 : -7] });
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
  const partyCount = Math.min(participants.length, STUDY_ROOM_MAX);
  const PARTY_GAP = 4;
  // Multiplayer characters: bigger than the plain width-fit AND clustered toward the
  // middle so the outer ones do not get cut off at the screen edges. `partyCharSize`
  // is the visible character/image size; `partySlotW` is the (narrower) column width
  // that controls spacing — making it smaller pulls the row inward. Phone enlarges +
  // pulls in MORE; tablet does the same, gentler. Solo (count<=1) is unaffected.
  const baseFit = partyCount <= 1 ? 280 : Math.floor((winW - PARTY_GAP * (partyCount - 1)) / partyCount);
  const MP_SIZE = partyCount <= 1 ? 1 : isTablet ? 1.1 : 1.2;
  const MP_SPREAD = partyCount <= 1 ? 1 : isTablet ? 0.93 : 0.84;
  const partyCharSize = Math.round(baseFit * MP_SIZE);
  const partySlotW = Math.round(baseFit * MP_SPREAD);
  // Book grows with the character; on phone bump the ratio a little more so the
  // book reads bigger on the desk (tablet keeps the original 0.52).
  const partyBookSize = Math.round(partyCharSize * (!isTablet ? 0.58 : 0.52));
  // When you're the only one in the room (others left, or before they begin), the
  // party row would render a single oversized, off-center character/book that floats
  // off the desk — so render the solo scene (big centered character + desk book) instead.
  const soloScene = isSolo || participants.length <= 1;
  // Rooms cap at STUDY_ROOM_MAX — hide the invite button once full.
  const roomFull = participants.length >= STUDY_ROOM_MAX;

  // ── Tablet desk + character geometry ───────────────────────────────────────
  // One shared anchor — `deskTopT`, the desk panel's top edge measured up from the
  // screen bottom — so the desk surface, its front-edge line, the characters and
  // the books all derive from the SAME point and can't drift apart between iPad
  // sizes. Calibrated to the 11" Pro reference and written as pure winH/winW ratios,
  // so a 13" iPad is an exact scale-up instead of a fixed-offset mismatch. (The
  // desk PNGs are full-bleed textures rendered with `cover`, so the panel's visible
  // top == the layout box top == deskTopT — that's why the line locks to it.)
  // Phone keeps its own separate style constants; these only feed `isTablet` styles.
  // The 11" and 13" iPads don't scale linearly for this composition: 0.34 reads
  // right on the 13", but on the (relatively taller) 11" Pro that sits too low, so
  // it gets a higher desk line. Split by the shortest edge (13"/12.9" ≥ 1000pt).
  const isLargeTablet = Math.min(winW, winH) >= 1000;
  const deskTopT = winH * (isLargeTablet ? 0.34 : 0.40); // desk top edge (lower = smaller)
  const deskBottomT = -winH * 0.084; // panel bleeds below the screen
  // The study session renders full-width (the safeArea cap is dropped while a session
  // is active — see index.tsx), so the root already spans the screen. The desk only
  // needs to bleed a little past the root's horizontal padding so it always covers the
  // corners on any device.
  const deskSideT = -(Spacing.three + winW * 0.05); // panel bleeds past the screen sides
  const soloCharSize = Math.round(winW * 0.54);
  const soloBookSizeT = Math.round(winW * 0.21);
  // Characters sit BEHIND the desk with their lower body tucked under the lip: a
  // fixed FRACTION (<0.5) of the square hides below the desk edge, so MORE THAN HALF
  // the body is always visible on ANY screen. Tying the hide amount to the character
  // size (not a fixed pixel offset) is what guarantees it — a fixed offset hid >half
  // once the character shrank (e.g. a small phone in a 3-person room). Phone's desk
  // edge is the fixed 240 (styles.deskEdge / studyDesk top); tablet's is deskTopT.
  const deskEdgeY = isTablet ? deskTopT : 240;
  // Baseline the BOOK row reads (book sits on the desk in front of each studier).
  const partyCharBottom = deskEdgeY - 0.44 * partyCharSize;
  // Characters are lifted higher than that baseline so more of the body shows above
  // the desk — but ONLY the character layer uses this, so the books stay on the desk
  // (don't float up with the characters).
  const partyCharBottomRaised = partyCharBottom + 0.09 * partyCharSize;
  // Hide fraction: how much of the solo character tucks below the desk lip. Lowered
  // from 0.42 so ~75% of the body shows (paired with a lower deskTopT, the desk line
  // drops while the character stays put — revealing more of them).
  const soloCharBottomT = deskTopT - 0.31 * soloCharSize;

  // Solo character content, reused by the phone (in-scene) and tablet (absolute,
  // desk-anchored) layouts so only one ever mounts.
  const soloCharContent = hanjiIsAnimated(activeCompanionId, companionSkins?.[activeCompanionId ?? ''])
    ? <HanjiFigure style={styles.characterFill} />
    : <Image source={bigCharacter} style={styles.characterFill} contentFit="contain" />;
  const soloCharTransform = { transform: [{ translateY: charTranslateY }, { scaleX: charScaleX }, { scaleY: charScaleY }] };

  // Cover color per participant, keyed off the companion id.
  const bookColorFor = (companionId: string | null | undefined) => {
    if (isHanjiActiveId(companionId)) return BOOK_COVER_COLOR.hanji;
    if (companionId?.startsWith('shop:')) return BOOK_COVER_COLOR[companionId.slice(5)] ?? DEFAULT_BOOK_COVER;
    if (companionId === 'starter:girl' || companionId === 'starter:dude' || !companionId) return BOOK_COVER_COLOR.bun;
    return DEFAULT_BOOK_COVER;
  };

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
    if (room.active) {
      // Leaving a multiplayer room ENDS your session automatically — no confirm —
      // since you've left the group (onAway is the no-prompt force-end path)...
      room.leaveRoom();
      onAway();
      // ...and drops you straight back to the Home screen, clearing any routes/modals
      // stacked over the tabs (same dismiss the synced session start uses).
      if (router.canDismiss()) router.dismissAll();
    } else {
      // Solo: keep the normal End-session confirm (early-end forfeit-coins warning).
      onStop();
    }
  };

  const handleAddFriend = () => {
    if (room.active && room.roomId) {
      // Already in a room → invite straight into it.
      router.push({ pathname: '/party-invite', params: { room: room.roomId, game: 'study' } });
    } else if (activeSession) {
      // Solo session → promote it to a hosted room so the friend can join in as a
      // late joiner, then open the same invite list. Mark it multiplayer so it
      // credits "with friend" on completion. The host already chose their subject
      // at solo start, so suppress the multiplayer "pick a subject" prompt.
      markSessionMultiplayer();
      setMpSubjectPicked(true);
      const id = room.hostFromSolo({
        durationMinutes: activeSession.durationMinutes,
        subjectName: activeSession.subjectName ?? null,
        taskId: activeSession.taskId ?? null,
        taskTitle: activeSession.taskTitle ?? null,
      });
      router.push({ pathname: '/party-invite', params: { room: id, game: 'study' } });
    } else {
      router.push('/friends');
    }
  };

  // Multiplayer: prompt each player to pick their own subject at the start — unless
  // they already chose a topic in the lobby (then activeSession.subjectName is set).
  const needStartSubject = !isSolo && room.begun && !mpSubjectPicked && !!activeSession && !activeSession.subjectName;
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
  // Wall-clock fallback: the per-second `secondsLeft` tick (driven from Home) can
  // stall (backgrounding, render lag), which would leave a multiplayer session stuck
  // at 00:00 with NO finish menu and NO Exit button — a hard freeze. This flag is
  // force-set by a timer at the exact end moment so the finish always surfaces.
  const [mpForceFinished, setMpForceFinished] = useState(false);
  const mpFinished = !!activeSession?.isMultiplayer && (secondsLeft <= 0 || mpForceFinished);
  // Post-finish unlimited break: a resting state with a Continue button (no timer,
  // no limit). Separate from `onBreak` (the in-session soft break) on purpose.
  const [finishBreak, setFinishBreak] = useState(false);
  // "Study again" lets the player pick a fresh duration + subject; the chosen
  // duration waits here between the time picker and the subject picker.
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [restartDuration, setRestartDuration] = useState<number | null>(null);
  // Plus-only custom length for "study again": shows the duration wheel inline.
  const [restartCustomOpen, setRestartCustomOpen] = useState(false);
  const [restartCustomMin, setRestartCustomMin] = useState(45);

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

  // Schedule the multiplayer finish for the EXACT end moment, independent of the
  // ticking `secondsLeft`. Mirrors the solo wall-clock finisher in index.tsx so a
  // stalled tick can't freeze the session. Re-arms whenever the session changes.
  useEffect(() => {
    setMpForceFinished(false);
    if (!activeSession?.isMultiplayer) return;
    const endMs = new Date(activeSession.startedAt).getTime() + activeSession.durationMinutes * 60000;
    const remaining = endMs - Date.now();
    if (remaining <= 0) { setMpForceFinished(true); return; }
    const id = setTimeout(() => setMpForceFinished(true), remaining + 50);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession?.id, activeSession?.startedAt, activeSession?.durationMinutes]);

  useEffect(() => {
    if (mpFinished && activeSession && creditedRef.current !== activeSession.id) {
      creditedRef.current = activeSession.id;
      const earned = coinsForMinutes(activeSession.durationMinutes);
      addCoins(earned);
      recordSession(activeSession.durationMinutes);
      // Multiplayer finish → counts toward daily quests/achievements, incl. the
      // "study with a friend" quest + friend-session achievements.
      recordQuestSession({ minutes: activeSession.durationMinutes, withFriend: true });
      addSubjectTime(activeSession.subjectName, activeSession.durationMinutes);
      // Advance the daily streak too, just like a solo finish — otherwise studying
      // only with friends would never tick the streak shown in Progress. updateStreak
      // also credits the streak-bonus coins internally.
      updateStreak();
      setCoinsEarned(earned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpFinished, activeSession?.id]);

  // Flash the fading "someone left" line: pop sound, fade in, then auto fade out.
  const showLeftNotice = useCallback((message: string) => {
    if (leftTimerRef.current) clearTimeout(leftTimerRef.current);
    setLeftNotice(message);
    playPop();
    leftFade.stopAnimation();
    leftFade.setValue(0);
    Animated.timing(leftFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    leftTimerRef.current = setTimeout(() => {
      Animated.timing(leftFade, { toValue: 0, duration: 700, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setLeftNotice(null);
      });
    }, 3200);
  }, [leftFade]);

  // Clear the pending fade-out timeout if the view tears down (e.g. the session
  // ends the instant someone leaves) so it can't setState on an unmounted view.
  useEffect(() => () => { if (leftTimerRef.current) clearTimeout(leftTimerRef.current); }, []);

  // Detect when a fellow studier leaves the room mid-session and flash the fading
  // "someone left" line. Works for host AND guest: the host removes the leaver +
  // rebroadcasts the roster, so every client sees `room.roster` shrink.
  useEffect(() => {
    // Keep a code→name lookup fresh so a leaver's name survives their removal.
    for (const p of room.roster) nameByCodeRef.current[p.code] = p.name;
    // Only watch during a live synced session — never on the lobby, the finish flow,
    // or solo (and reset the snapshot so re-entering a session starts clean).
    if (!(room.active && room.begun && !isSolo && !mpFinished)) {
      prevOtherCodesRef.current = null;
      return;
    }
    const otherCodes = room.roster.filter((p) => p.code !== friendCode).map((p) => p.code);
    const prev = prevOtherCodesRef.current;
    prevOtherCodesRef.current = otherCodes; // advance the snapshot this same tick (idempotent)
    if (prev === null) return; // first run after the session began — nothing to diff yet
    const gone = prev.filter((c) => !otherCodes.includes(c));
    if (gone.length === 0) return;
    const goneNames = gone.map((c) => nameByCodeRef.current[c]).filter(Boolean);
    const name = gone.length === 1 && goneNames[0] ? goneNames[0] : '';
    showLeftNotice(name ? t('studyRoom.friendLeft', { name }) : t('studyRoom.someoneLeft'));
  }, [room.roster, room.active, room.begun, isSolo, mpFinished, friendCode, showLeftNotice, t]);

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
      {/* "Spotify background" mode: a large album-cover vinyl drawn over the solid
          black/white fill (set in index.tsx), behind the desk + character. Decorative
          only — the small radio vinyl below stays the play/stop control. */}
      {focus && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'flex-start', paddingTop: winH * 0.15 }]}>
          <StudyVinyl
            size={Math.round(Math.min(winW, winH) * 0.66)}
            playing={followsHostDisco ? true : musicPlaying}
            discColor={vinylColor}
            centerImage={discoVinylCenter}
            disk
            holeColor={discoColor === 'white' ? '#FFFFFF' : '#000000'}
          />
        </View>
      )}
      {/* Invite-friend button (top right) — shown whenever there's room for more
          studiers (fewer than STUDY_ROOM_MAX, INCLUDING a solo session). Once a
          multiplayer room fills to 3, the button is simply removed (no "Full" chip). */}
      {!roomFull && (
        <Pressable onPress={handleAddFriend} style={({ pressed }) => [styles.addFriendBtn, isTablet && styles.addFriendBtnTablet, focus && styles.btnFocusFlat, pressed && styles.pressed]} hitSlop={8} accessibilityLabel={t('studyRoom.friend')}>
          <Text style={[styles.addFriendIcon, isTablet && styles.addFriendIconTablet, focus && { color: focusFg }]}>＋</Text>
        </Pressable>
      )}

      {/* Timer card */}
      <View ref={timerCardRef} onLayout={measureRopes} style={[styles.timerWrap, soloScene && styles.timerWrapSolo, isTablet && { width: soloScene ? '62%' : '48%' }, focus && { marginTop: isTablet ? 48 : 30 }]}>
        {focus ? (
          /* Focus mode: just the countdown, in the opposite colour to the background. */
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.3} style={[styles.focusTimer, { color: focusFg }]}>{format(displaySecs)}</Text>
        ) : (<>
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
          {/* Phone keeps it minimal — JUST the countdown, centered in the sign. The
              "Now baking" caption + "studying together" line are tablet-only (more
              room there); on phone they only crowded the small sign. */}
          {isTablet && <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.nowBaking, soloScene && styles.nowBakingSolo, styles.nowBakingTablet]}>{t('studyRoom.nowBaking')}</Text>}
          {/* Auto-shrink to fit the sign's width so the timer can never overflow / pop
              out the side on any screen or font size. */}
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.3} style={[styles.timer, { width: '100%', textAlign: 'center' }, soloScene && styles.timerSolo, isTablet && { fontSize: Math.round(winW * 0.081) }]}>{format(displaySecs)}</Text>
          {!soloScene && isTablet && (
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
        </>)}
      </View>

      {/* Status-circle row removed: each studier's break state now reads off their
          desk book, which stops flipping when they're on break. We keep only the
          quiet "someone left" toast, anchored near the top where the row used to be. */}
      {!soloScene && (leftNotice !== null && !mpFinished) && (
        <View style={styles.participantBlock}>
          <Animated.View pointerEvents="none" style={[styles.leftToast, { opacity: leftFade }]}>
            <Text style={styles.leftToastText} numberOfLines={1}>{leftNotice}</Text>
          </Animated.View>
        </View>
      )}

      {/* Characters behind the desk. Solo shows one big like Home; multiplayer
          shows everyone's character — evenly spaced, sized by headcount, each
          with a live status dot (or  on break). */}
      <View style={styles.scene}>
        {soloScene && !isTablet && (
          // Transform lives on an Animated.View (like Home) — applying it to the
          // expo-image directly stutters because the study view re-renders every
          // second (the countdown), which re-attaches the native animation nodes.
          <Pressable style={[styles.character, styles.characterSolo, focus && styles.characterSoloFocus]} onPress={() => talkAs(friendCode, myPersona, mySkin)}>
            {/* Squish layer (center-bottom origin so feet stay tucked behind the desk
                on tap) wraps the idle-bounce layer — mirrors Home's CompanionPet. */}
            <Animated.View style={{ width: '100%', height: '100%', transform: [{ scale: tapScale }], transformOrigin: 'center bottom' }}>
              <Animated.View style={soloCharTransform}>{soloCharContent}</Animated.View>
            </Animated.View>
            {/* Disco lighting wash over the character so it blends into the scene. */}
            {focus && <View pointerEvents="none" style={styles.discoCharTint} />}
            {talk?.code === friendCode && hearts.map((h) => (
              <FloatingHeart key={h.id} heart={h} size={18 * heartScale} onDone={() => setHearts((cur) => cur.filter((x) => x.id !== h.id))} />
            ))}
            {talk && <PetBubble key={talk.id} line={talk.line} onDone={() => setTalk(null)} />}
          </Pressable>
        )}
        {isSolo && onBreak && (
          <View style={styles.breakBadge}>
            <Text style={styles.breakBadgeText}>
              {t('studyRoom.onBreakTimer', { time: format(breakLeft) })}
            </Text>
          </View>
        )}
      </View>

      {/* Tablet solo character — an absolute layer anchored to the desk top (the
          SAME coordinate origin as the desk), so it always sits ON the desk no
          matter the iPad size. Drawn before the desk Image so the lower body tucks
          behind the table. Phone uses the in-scene flex layout above. */}
      {soloScene && isTablet && (
        <Animated.View
          style={[{ position: 'absolute', left: 0, right: 0, bottom: focus ? soloCharBottomT - 120 : soloCharBottomT, alignItems: 'center', zIndex: 1 }, soloCharTransform]}>
          <Pressable style={{ width: soloCharSize, height: soloCharSize }} onPress={() => talkAs(friendCode, myPersona, mySkin, 1.25)}>
            <Animated.View style={{ flex: 1, transform: [{ scale: tapScale }], transformOrigin: 'center bottom' }}>
              {soloCharContent}
            </Animated.View>
            {focus && <View pointerEvents="none" style={styles.discoCharTint} />}
            {talk?.code === friendCode && hearts.map((h) => (
              <FloatingHeart key={h.id} heart={h} size={18 * heartScale} onDone={() => setHearts((cur) => cur.filter((x) => x.id !== h.id))} />
            ))}
            {talk && <PetBubble key={talk.id} line={talk.line} scale={1.25} onDone={() => setTalk(null)} />}
          </Pressable>
        </Animated.View>
      )}

      {/* Multiplayer characters — an absolute row lifted so heads clear the desk
          edge. Sits behind the desk (same zIndex, drawn before) so the lower body
          tucks behind the table, like the solo character. */}
      {!soloScene && (
        <View style={[styles.partyLayer, { bottom: partyCharBottomRaised }]}>
          {participants.slice(0, STUDY_ROOM_MAX).map((p) => {
            const img = p.code === friendCode ? bigCharacter : getCompanionImage(p.companionId, p.skinId);
            const pIsHanji = p.code === friendCode
              ? hanjiIsAnimated(activeCompanionId, companionSkins?.[activeCompanionId ?? ''])
              : hanjiIsAnimated(p.companionId, p.skinId);
            // Tap a character → show one of its (or their) lines. Mine uses my live
            // persona/skin; friends use the companion they're studying as.
            const persona = p.code === friendCode ? myPersona : (p.companionId ? PERSONA_BY_COMPANION[p.companionId] : undefined);
            const skin = p.code === friendCode ? mySkin : p.skinId;
            return (
              <Pressable key={p.code} style={[styles.partyMember, { width: partySlotW }]} onPress={() => talkAs(p.code, persona, skin, 0.72)}>
                {/* No status dot above the character — status already shows on the
                    top participant cards, so the dot here was redundant clutter. */}
                {/* Squish-on-tap layer (only the tapped member uses tapScale) wrapping
                    the same gentle idle bounce as the solo character (transform on an
                    Animated.View, not the image, to avoid per-second re-render stutter). */}
                <Animated.View style={{ transform: [{ scale: talk?.code === p.code ? tapScale : 1 }], transformOrigin: 'center bottom' }}>
                  <Animated.View
                    style={{ transform: [{ translateY: charTranslateY }, { scaleX: charScaleX }, { scaleY: charScaleY }] }}>
                    {pIsHanji ? (
                      <HanjiFigure style={{ width: partyCharSize, height: partyCharSize }} />
                    ) : (
                      <Image source={img} style={{ width: partyCharSize, height: partyCharSize }} contentFit="contain" />
                    )}
                  </Animated.View>
                </Animated.View>
                {talk?.code === p.code && hearts.map((h) => (
                  <FloatingHeart key={h.id} heart={h} size={18 * heartScale} onDone={() => setHearts((cur) => cur.filter((x) => x.id !== h.id))} />
                ))}
                {talk?.code === p.code && (
                  <PetBubble key={talk.id} line={talk.line} scale={0.72} onDone={() => setTalk(null)} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Desk surface — a full-width layer along the bottom. The character sits
          behind it; the book, controls and end-session button lie ON it. */}
      {!focus && <Image source={equippedDeskImage} style={[styles.studyDesk, isTablet && { left: deskSideT, right: deskSideT, bottom: deskBottomT, height: deskTopT - deskBottomT }, deskRoom?.deskTint ? { backgroundColor: deskRoom.deskTint } : null, tw('desk')]} contentFit={deskRoom?.deskFit ?? 'cover'} pointerEvents="none" />}
      {/* The thin front-edge line sits at the desk's top edge AND carries the same
          `tw('desk')` transform as the desk image, so the two can never separate —
          re-dialing the desk knob moves the line with it. */}
      {!focus && <View style={[styles.deskEdge, isTablet && { left: deskSideT, right: deskSideT, bottom: deskTopT }, tw('desk')]} pointerEvents="none" />}
      {!focus && (soloScene ? (
        isTablet ? (
          // HARD CAP: the book can never cross the desk's top edge. This clip box
          // spans the desk region only (bottom of root up to the desk line at
          // deskTopT) with overflow:hidden, so any pixels above the line are cut.
          // The book is then placed to rest just below the line, on the desk in
          // front of the character — the clip is the guarantee, the `bottom` math
          // only positions it. (StudyBook scales its 120×84 art around its centre
          // from a flex-start wrap, so the visual top sits 1.05·size − 42 above the
          // wrap's bottom; we offset for that, then drop it winH·0.012 below the line.)
          <View
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: deskTopT, overflow: 'hidden', zIndex: 2 }}
            pointerEvents="none">
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: deskTopT - 1.05 * soloBookSizeT + 42 - winH * 0.012,
                // Dead-center under the character (which is itself screen-centered).
                alignItems: 'center',
              }}>
              <StudyBook active={!onBreak} size={soloBookSizeT} coverColor={soloBookColor} />
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.bookOnDesk,
              // Dead-center under the character (which is itself screen-centered); only
              // the vertical dy nudge is applied.
              { transform: [{ translateY: SOLO_BOOK_CANVAS * soloBookOffset.dy }] },
            ]}
            pointerEvents="none">
            <StudyBook active={!onBreak} size={118} coverColor={soloBookColor} />
          </View>
        )
      ) : (
        // One book per character, DEAD-CENTERED under its character: the book row and
        // the character row use identical columns (both full-width, center-justified,
        // same `partyCharSize` slots in the same participant order), so simply centering
        // each book in its slot lands it directly under that character. No per-face
        // nudge here — in a row of small characters the face offset read as off-center.
        // On phone, raise the book up toward the character so it sits closer — but
        // keep the lift below the character's raised baseline so the book's base never
        // rides up past/into the body.
        <View style={[styles.partyBookRow, { bottom: partyCharBottom + (!isTablet ? 0.05 * partyCharSize : -4) }]} pointerEvents="none">
          {participants.slice(0, STUDY_ROOM_MAX).map((p) => {
            const cover = p.code === friendCode ? soloBookColor : bookColorFor(p.companionId);
            return (
              <View
                key={p.code}
                style={[styles.partyBookSlot, { width: partySlotW }]}>
                {/* Flip ONLY while that studier is actively studying — a break or a
                    dropped/idle connection holds the pages still. */}
                <StudyBook active={participantStatus(p.code) === 'studying'} size={partyBookSize} coverColor={cover} />
              </View>
            );
          })}
        </View>
      ))}

      {/* Controls */}
      <View style={styles.controls}>
        {/* Game button with the radio (sound picker) stacked directly above it.
            The game slot keeps its space even while studying (button hidden) so the
            radio is already in its final spot and doesn't jump up when break starts. */}
        <View style={[styles.gameCol, isTablet && styles.gameColTablet]}>
          <Pressable onPress={() => { if (!hostSharingSound) setSoundOpen(true); }} style={({ pressed }) => [styles.radioBtn, pressed && !hostSharingSound && styles.pressed]} hitSlop={8}>
            <StudyVinyl size={isTablet ? 92 : 56} playing={musicPlaying} discColor={vinylColor} centerImage={vinylCenter} onSpin={onVinylSpin} />
          </Pressable>
          <Pressable
            onPress={onBreakGame}
            disabled={!onBreak}
            style={({ pressed }) => [styles.gameBtnWrap, isTablet && { width: 64, height: 56 }, pressed && onBreak && styles.pressed]}
            hitSlop={6}>
            {onBreak && <Image source={GAME_BTN} style={[styles.gameBtn, isTablet && { width: 64, height: 56 }, focus && { tintColor: focusFg }]} contentFit="contain" />}
          </Pressable>
        </View>
        {showBreakButton && (
          <SoundPressable
            onPress={handleBreak}
            disabled={breakDisabled}
            style={({ pressed }) => [styles.breakBtn, isTablet && { width: 340, height: 66 }, breakDisabled && styles.breakBtnDisabled, pressed && styles.pressed]}>
            {!focus && <Image source={BREAK_PILL} style={StyleSheet.absoluteFill} contentFit="fill" pointerEvents="none" />}
            <Text style={[styles.breakBtnText, isTablet && { fontSize: 21 }, focus && { color: focusFg }]}>{breakLabel}</Text>
          </SoundPressable>
        )}
      </View>
      <SoundPressable onPress={handleLeave} style={({ pressed }) => [styles.endBtn, isTablet && { paddingHorizontal: 34, paddingVertical: 14, marginBottom: 34 }, focus && styles.btnFocusFlat, pressed && styles.endBtnPressed]} hitSlop={8}>
        <Text style={[styles.endBtnText, isTablet && { fontSize: 18 }, focus && { color: focusFg }]}>{room.active ? t('studyRoom.leaveRoom') : t('session.endSession')}</Text>
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
              <Text style={styles.coinText}>+{formatCoins(coinsEarned)}</Text>
            </View>
            {/* Companion bond — level earned by studying with this companion. */}
            <View style={styles.bondBlock}>
              <Text style={styles.bondLabel}>{t('sessionComplete.bondLabel')}</Text>
              <CompanionLevel minutes={companionMinutes?.[activeCompanionId] ?? 0} scale={1.1} />
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
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setDurationPickerOpen(false); setRestartCustomOpen(false); }} />
          <View style={styles.finishCard}>
            <Text style={styles.finishTitle}>{t('studyRoom.howLong')}</Text>
            {restartCustomOpen ? (
              // Plus: pick any length on the wheel, then start.
              <>
                <DurationWheel
                  minutes={restartCustomMin}
                  onChange={(m) => setRestartCustomMin(Math.max(5, Math.min(300, m)))}
                  picks={SESSION_LENGTHS.map((o) => o.minutes)}
                  scale={isTablet ? 1.25 : 1}
                />
                <SoundPressable
                  sound="confirm"
                  onPress={() => { setRestartCustomOpen(false); pickRestartDuration(restartCustomMin); }}
                  style={({ pressed }) => [styles.finishBtn, pressed && styles.pressed]}>
                  <Text style={styles.finishBtnText}>{t('lobby.startStudying')}</Text>
                </SoundPressable>
              </>
            ) : (
              <>
                {SESSION_LENGTHS.map((opt) => (
                  <Pressable
                    key={opt.minutes}
                    onPress={() => pickRestartDuration(opt.minutes)}
                    style={({ pressed }) => [styles.finishBtn, pressed && styles.pressed]}>
                    <Text style={styles.finishBtnText}>{t('studyRoom.minutesOption', { count: opt.minutes })}</Text>
                  </Pressable>
                ))}
                {/* Custom length is a Plus perk (same as the lobby's custom timer). */}
                {isPlus && (
                  <SoundPressable
                    onPress={() => setRestartCustomOpen(true)}
                    style={({ pressed }) => [styles.finishBtn, pressed && styles.pressed]}>
                    <Text style={styles.finishBtnText}>{t('lobby.customLength')}</Text>
                  </SoundPressable>
                )}
              </>
            )}
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
  // Big background cover-vinyl, centred behind the scene (Spotify background mode).
  spotifyBgVinylWrap: { alignItems: 'center', justifyContent: 'center' },

  // Timer card. The base width/`timer` font below are the phone-MULTIPLAYER values
  // (solo + tablet override both). Widened from 52% so the multiplayer oven sign is
  // bigger; it grows downward (top is pinned by marginTop), so the friend button —
  // up in the rope zone above the sign body — still clears it.
  timerWrap: { alignSelf: 'center', width: '62%', aspectRatio: 1032 / 838, marginTop: -36 },
  timerWrapSolo: { width: '88%' },
  timerText: { position: 'absolute', left: '17%', right: '17%', top: '36%', bottom: '18%', alignItems: 'center', justifyContent: 'center' },
  nowBaking: { fontSize: 9, fontWeight: '800', color: BakeryColors.mocha, letterSpacing: 2, marginBottom: 2 },
  nowBakingSolo: { fontSize: 13 },
  timer: { fontSize: 46, fontWeight: '900', color: BakeryColors.cocoaDark, letterSpacing: 1 },
  timerSolo: { fontSize: 56 },
  // Focus-mode (Spotify background) countdown: big, plain, no sign — colour set inline.
  focusTimer: { fontSize: 64, fontWeight: '900', letterSpacing: 1, textAlign: 'center', width: '100%' },
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
  // Phone multiplayer: drop the avatar circles down off the (now bigger) timer sign.
  // Pure marginTop — the row is in flow, so it only eats scene space and can't
  // overlap the party characters (absolutely anchored near the bottom).
  participantRowPhone: { marginTop: Spacing.three },
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
  // Focus mode drops the character lower (no desk to tuck behind).
  characterSoloFocus: { marginBottom: -42 },
  // Multiplayer party — characters evenly spaced (equal gaps incl. the ends),
  // lifted up so heads clear the desk edge (240) and tuck behind the table.
  partyLayer: {
    position: 'absolute', left: 0, right: 0, bottom: 184,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, zIndex: 1,
  },
  partyMember: { alignItems: 'center' },
  // One book per character, on the desk surface, columns aligned to partyLayer.
  partyBookRow: {
    position: 'absolute', left: 0, right: 0, bottom: 180,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4, zIndex: 2,
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
  deskEdge: { position: 'absolute', left: -Spacing.three, right: -Spacing.three, bottom: 240, height: 1.5, backgroundColor: 'rgba(120, 90, 70, 0.22)', zIndex: 1 },
  // Base position spans root's padded content box (same axis as the character
  // canvas) for a geometric center; a per-character transform (SOLO_BOOK_OFFSET)
  // then nudges it to sit right in front of each companion's visual center.
  bookOnDesk: { position: 'absolute', bottom: 168, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
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
    // Round plus button, tucked up near the top so it clears the timer sign's wide
    // body. Still below the notch — studyRoomWrap pads the view past the safe-area
    // inset. Tablet overrides size/position below.
    position: 'absolute', top: 2, right: 18, zIndex: 30,
    alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34,
    backgroundColor: BakeryColors.glass,
    borderWidth: 1.5, borderColor: BakeryColors.shortbread,
    borderRadius: BakeryRadii.pill,
    ...BakeryShadow,
  },
  addFriendIcon: { fontSize: 18, fontWeight: '900', color: BakeryColors.berry, marginTop: -1 },
  roomFullBadge: { paddingHorizontal: 11, opacity: 0.7 },
  // Tablet: scale the friend button up so it's actually legible on a big iPad.
  addFriendBtnTablet: { top: 22, right: 28, width: 52, height: 52, borderWidth: 2 },
  addFriendIconTablet: { fontSize: 30 },
  // Disco/focus mode: strip a button down to plain text (no fill/border/shadow); its
  // text colour is set inline to focusFg (white or black, opposite the background).
  btnFocusFlat: { backgroundColor: 'transparent', borderWidth: 0, shadowOpacity: 0, shadowColor: 'transparent', elevation: 0 },

  // Radio (sound picker) — stacked above the game button in the controls row.
  radioBtn: { alignItems: 'center', justifyContent: 'center' },
  radioImg: { width: 64, height: 64 },

  // Multiplayer finish menu
  finishOverlay: { ...StyleSheet.absoluteFill, zIndex: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', padding: 28 },
  // Unlimited-break backdrop — full-screen (still covers the live controls) but
  // light enough that the resting characters/desk show through behind the card.
  finishOverlayLight: { ...StyleSheet.absoluteFill, zIndex: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', padding: 28 },
  finishCard: {
    width: '100%', minWidth: MIN_POPUP_WIDTH, maxWidth: 320, backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.panel, borderWidth: 2, borderColor: BakeryColors.shortbread,
    padding: Spacing.four, gap: Spacing.two, alignItems: 'stretch', ...BakeryShadow,
  },
  finishTitle: { fontSize: 18, fontWeight: '900', color: BakeryColors.cocoaDark, textAlign: 'center' },
  coinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: Spacing.one },
  coinText: { fontSize: 22, fontWeight: '900', color: BakeryColors.honey },
  bondBlock: { width: '100%', alignItems: 'center', gap: 5, marginBottom: Spacing.one },
  bondLabel: { fontSize: 13, fontWeight: '800', color: BakeryColors.cocoaDark, textAlign: 'center' },
  finishBtn: { paddingVertical: 13, borderRadius: BakeryRadii.button, alignItems: 'center', backgroundColor: BakeryColors.jam },
  finishBtnText: { fontSize: 15, fontWeight: '900', color: '#fff' },
  finishBtnGhost: { paddingVertical: 11, borderRadius: BakeryRadii.button, alignItems: 'center', backgroundColor: BakeryColors.cream, borderWidth: 1.5, borderColor: BakeryColors.shortbread },
  finishBtnGhostText: { fontSize: 14, fontWeight: '800', color: BakeryColors.mocha },
  // "Someone left" fading notice — anchored just below the participant row.
  participantBlock: { position: 'relative' },
  leftToast: { position: 'absolute', top: '100%', left: 0, right: 0, alignItems: 'center', marginTop: 4 },
  // Light halo so plain mocha text stays legible over dark/busy room backgrounds
  // (Frostbloom, night themes) without needing a card behind it.
  leftToastText: {
    fontSize: 13, fontWeight: '800', color: BakeryColors.mocha, textAlign: 'center',
    textShadowColor: 'rgba(255,250,244,0.95)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4,
  },
  endLinkText: { fontSize: 12, fontWeight: '700', color: BakeryColors.mocha, textDecorationLine: 'underline' },
  pressed: { opacity: 0.85 },
});
