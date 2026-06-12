import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, Easing, Image as RNImage, ImageBackground, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { StudyRoomView } from '@/components/study-room-view';
import { HanjiUnlockModal } from '@/components/hanji-unlock-modal';
import { useStudyRoom } from '@/lib/use-study-room';
import { BakeryGearEmoji } from '@/components/bakery-emoji';
import { CookieChatIcon } from '@/components/settings-icons';
import { getReminderStyleEffect } from '@/constants/shop-effects';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import i18n, { useTranslation } from '@/i18n';
import { coinsForMinutes } from '@/constants/placeholder-data';
import { isHanjiActiveId, resolveActiveCompanion } from '@/lib/companion-utils';
import { HanjiFigure } from '@/components/hanji-figure';
import { useAuth } from '@/context/auth-context';
import { listIncomingRequests } from '@/lib/friend-requests';
import { ROOM_PAIRS } from '@/constants/room-data';
import { takePendingDragSession, setDragActive, type DragSessionData } from '@/lib/drag-session';
import { showLoadingScreen } from '@/lib/loading-signal';
import { getAmbienceEmoji, getAmbienceName } from '@/app/ambience-picker';
import {
  BakeryColors,
  BakeryRadii,
  BakeryShadow,
  BottomTabInset,
  MaxContentWidth,
  Spacing,
  TabBarBottomOffset,
  TabBarTotalHeight,
} from '@/constants/theme';

const MIN_MINUTES_FOR_COINS = 10;
const DEFAULT_BREAK_MINUTES = 5;

function daysUntil(dateISO: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Parse as local midnight so the day count doesn't shift in zones behind UTC.
  const target = new Date(`${dateISO}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function formatExamDate(dateISO: string): string {
  // Parse as local midnight (not UTC) so the displayed day doesn't shift back
  // a day in timezones behind UTC.
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString(i18n.language || 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getExamDay(dateISO: string): number {
  return new Date(dateISO).getDate();
}

function getExamCountdownLabel(days: number): string {
  if (days < 0) return 'Past due';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

/** Exact moment the exam starts, from its date + optional "HH:MM" time. */
function getExamTargetMs(dateISO: string, time?: string): number {
  const [h, m] = (time ?? '09:00').split(':').map(Number);
  const d = new Date(`${dateISO}T00:00:00`);
  d.setHours(h || 0, m || 0, 0, 0);
  return d.getTime();
}

/** Live countdown like "4d 03:21:45" (or "03:21:45" under a day). */
function formatLiveCountdown(targetMs: number, nowMs: number): string {
  let diff = Math.floor((targetMs - nowMs) / 1000);
  if (diff <= 0) return i18n.t('home.pastDue');
  const days = Math.floor(diff / 86400);
  diff -= days * 86400;
  const h = Math.floor(diff / 3600);
  diff -= h * 3600;
  const min = Math.floor(diff / 60);
  const sec = diff - min * 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(h)}:${pad(min)}:${pad(sec)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

function getSessionSecondsLeft(startedAt: string, durationMinutes: number, nowMs: number): number {
  const endMs = new Date(startedAt).getTime() + durationMinutes * 60000;
  return Math.max(0, Math.ceil((endMs - nowMs) / 1000));
}

function getSessionElapsedMinutes(startedAt: string, durationMinutes: number, nowMs: number): number {
  const elapsedMs = Math.max(0, nowMs - new Date(startedAt).getTime());
  return Math.min(durationMinutes, Math.floor(elapsedMs / 60000));
}

function formatTimerLabel(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const HOME_ROOM_IMAGE = require('@/assets/images/home/home-room-bg.png');
const DESK_OVERLAY = require('@/assets/images/home/desk-overlay.png');
const DESK_HANDS = require('@/assets/images/home/desk-hands.png');
const DESK_NEW = require('@/assets/images/home/desk-new.png');
const DESK_MIXER = require('@/assets/images/home/desk-mixer.png');
const SUNLIGHT = require('@/assets/images/home/sunlight.png');
const DESK_STRAWBERRIES = require('@/assets/images/home/desk-strawberries.png');
const DESK_EGGS = require('@/assets/images/home/desk-eggs.png');
const DESK_BUTTER = require('@/assets/images/home/desk-butter.png');
// Pudding desk art (swap these placeholder PNGs for desk-style versions).
const DESK_MIXER_PUDDING = require('@/assets/images/home/desk-mixer-pudding.png');
const DESK_MILK = require('@/assets/images/home/desk-milk.png');
const DESK_SUGAR = require('@/assets/images/home/desk-sugar.png');
const DESK_CORNSTARCH = require('@/assets/images/home/desk-cornstarch.png');
// Berry croissant desk art (reuses the kitchen ingredient PNGs).
const DESK_MIXER_CROISSANT = require('@/assets/images/cake/mixer-croissant.png');
const DESK_FLOUR = require('@/assets/images/cake/base-flour.png');
const DESK_CR_BUTTER = require('@/assets/images/cake/filling-butter.png');
const DESK_BERRIES = require('@/assets/images/cake/topping-berries.png');
// Sakura mochi + matcha crepe desk art (reuses the kitchen ingredient PNGs).
const DESK_MIXER_SAKURA = require('@/assets/images/cake/mixer-sakura.png');
const DESK_RICEFLOUR = require('@/assets/images/cake/base-riceFlour.png');
const DESK_REDBEAN = require('@/assets/images/cake/filling-redBean.png');
const DESK_SAKURALEAF = require('@/assets/images/cake/topping-sakuraLeaf.png');
const DESK_MIXER_MATCHA = require('@/assets/images/cake/mixer-matcha.png');
const DESK_MATCHA = require('@/assets/images/cake/base-matcha.png');
const DESK_MATCHA_MILK = require('@/assets/images/cake/filling-milk.png');
const DESK_EGGFLOUR = require('@/assets/images/cake/topping-eggFlour.png');
const HOME_CAT = require('@/assets/images/bun/bun-home.png');
const BUN_STUDYING = require('@/assets/images/bun/bun-studying.png');
const STUDY_OVEN = require('@/assets/images/cake/oven.png');
const STUDY_FRAME = require('@/assets/images/home/study-frame.png');
const STUDY_RADIO = require('@/assets/images/home/study-radio.png');
const STOP_STUDYING_BTN = require('@/assets/images/home/stop-studying-btn.png');
const BREAK_GAME_BTN = require('@/assets/images/home/break-game-btn.png');
const FRIEND_BTN = require('@/assets/images/home/friend-btn.png');
const GAME_BTN = require('@/assets/images/home/game-btn.png');
const START_SESSION_BTN = require('@/assets/images/home/start-session-btn.png');
const SWITCH_CHARACTER_BTN = require('@/assets/images/home/switch-character-btn.png');
const FOOD_MENU_BTN = require('@/assets/images/home/food-menu-btn.png');
const SETTINGS_BTN = require('@/assets/images/home/settings-scallop-btn.png');
const EDIT_ROOM_BTN = require('@/assets/images/home/edit-room-btn.png');
const STREAK_FIRE_ICON = require('@/assets/images/home/streak-fire-icon.png');
const EXAM_BOOK_ICON = require('@/assets/images/home/exam-book-icon.png');
const EXAM_CALENDAR_ICON = require('@/assets/images/home/exam-calendar-icon.png');
const REMINDER_BELL_ICON = require('@/assets/images/home/reminder-bell-icon.png');
const REMINDER_BREAD_ICON = require('@/assets/images/home/reminder-sundae-icon.png');

// Each equipped dessert puts its own mixer + 3 ingredients on the desk. The
// three ingredients fill the same three desk slots (positions in the
// `deskStrawberries` / `deskEggs` / `deskButter` styles, by index).
type DeskIngredient = { id: string; src: number; style?: object };
// `mixerStyle` overrides the default mixer box (size/position) per dessert, since
// each mixer art has its own proportions.
type DeskKit = {
  mixer: number;
  mixerStyle?: object;
  ingredients: [DeskIngredient, DeskIngredient, DeskIngredient];
};

const DESK_KITS: Record<string, DeskKit> = {
  'strawberry-shortcake': {
    mixer: DESK_MIXER,
    ingredients: [
      { id: 'strawberries', src: DESK_STRAWBERRIES },
      { id: 'eggs', src: DESK_EGGS },
      { id: 'butter', src: DESK_BUTTER },
    ],
  },
  pudding: {
    mixer: DESK_MIXER_PUDDING,
    // Pudding mixer art has a tall rounded top — give the box the art's aspect
    // (~0.914 w/h) so the motor head isn't letterboxed/cut, and keep it on-desk.
    mixerStyle: { right: 6, bottom: '40%', width: 112, height: 123 },
    ingredients: [
      { id: 'milk', src: DESK_MILK },
      { id: 'sugar', src: DESK_SUGAR },
      { id: 'cornstarch', src: DESK_CORNSTARCH },
    ],
  },
  'berry-croissant': {
    mixer: DESK_MIXER_CROISSANT,
    // Croissant mixer art is roughly square — match pudding's compact on-desk box.
    mixerStyle: { right: 6, bottom: '40%', width: 116, height: 110 },
    ingredients: [
      { id: 'flour', src: DESK_FLOUR },
      { id: 'butter', src: DESK_CR_BUTTER },
      { id: 'berries', src: DESK_BERRIES },
    ],
  },
  'sakura-mochi': {
    mixer: DESK_MIXER_SAKURA,
    // Sakura "mixer" art is a mixing bowl — keep it small so it doesn't dominate.
    mixerStyle: { right: 10, bottom: '40%', width: 92, height: 88 },
    ingredients: [
      { id: 'riceFlour', src: DESK_RICEFLOUR },
      { id: 'redBean', src: DESK_REDBEAN },
      { id: 'sakuraLeaf', src: DESK_SAKURALEAF },
    ],
  },
  'matcha-crepe': {
    mixer: DESK_MIXER_MATCHA,
    mixerStyle: { right: 6, bottom: '40%', width: 116, height: 114 },
    ingredients: [
      { id: 'matcha', src: DESK_MATCHA },
      { id: 'milk', src: DESK_MATCHA_MILK },
      { id: 'eggFlour', src: DESK_EGGFLOUR },
    ],
  },
};
const DEFAULT_DESK_FOOD = 'strawberry-shortcake';

type DragId = string;

function DraggableIngredient({
  id, src, style, onDropped, mixerCenterX, mixerCenterY,
}: {
  id: DragId; src: any; style: any;
  onDropped: () => void;
  mixerCenterX: number; mixerCenterY: number;
}) {
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const dropped = useRef(false);

  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !dropped.current,
    onMoveShouldSetPanResponder: () => !dropped.current,
    onPanResponderGrant: () => {
      pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
      pan.setValue({ x: 0, y: 0 });
      // All animations here must share the JS driver, because `pan` is driven by
      // Animated.event with useNativeDriver:false. Mixing native + JS on the same
      // view promotes `pan` to native and crashes the spring-back on release.
      Animated.spring(scale, { toValue: 1.2, useNativeDriver: false }).start();
    },
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, g) => {
      pan.flattenOffset();
      Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
      const dist = Math.hypot(g.moveX - mixerCenterX, g.moveY - mixerCenterY);
      if (dist < 100) {
        dropped.current = true;
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: false }),
          Animated.spring(scale, { toValue: 0.5, useNativeDriver: false }),
        ]).start(onDropped);
      } else {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      }
    },
  })).current;

  return (
    <Animated.View
      style={[style, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }], opacity, zIndex: 20 }]}
      {...pr.panHandlers}
    >
      <RNImage source={src} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    coins,
    reminderEnabled,
    reminderTime,
    streak,
    isPlus,
    ambienceId,
    equippedShopItems,
    examCountdowns,
    subjects,
    activeSession,
    activeCompanionId,
    clearActiveSession,
    companionSlots,
    defaultCompanionId,
    bunSkinId,
    companionSkins,
    equippedBackgroundRoomId,
    equippedDeskRoomId,
    addMoodEntry,
    startActiveSession,
    selectedFoodId,
    addCoins,
    recordSession,
    addSubjectTime,
  } = useApp();
  const { user } = useAuth();

  // Count of pending friend requests → red badge on the friend button.
  // Refreshed whenever Home regains focus (e.g. after accepting/declining).
  const [pendingRequests, setPendingRequests] = useState(0);

  // Desk mixer + ingredients follow the equipped dessert. The 3 ingredients
  // drop into these 3 fixed desk-slot positions, by index.
  const deskKit = DESK_KITS[selectedFoodId] ?? DESK_KITS[DEFAULT_DESK_FOOD];
  const DESK_SLOT_STYLES = [styles.deskStrawberries, styles.deskEggs, styles.deskButter];
  const studyRoom = useStudyRoom();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [didHomeImageFail, setDidHomeImageFail] = useState(false);
  const handledCompletionId = useRef<string | null>(null);
  // While true, the just-finished session plays its recipe-pop in the study view
  // before we hand off to the finish screen.
  const [finishingSession, setFinishingSession] = useState(false);
  const finishParamsRef = useRef<Record<string, string> | null>(null);
  const [dragSession, setDragSession] = useState<DragSessionData | null>(null);
  const [droppedIds, setDroppedIds] = useState<Set<DragId>>(new Set());
  const fadeOverlay = useRef(new Animated.Value(0)).current;

  // Idle home companion: a gentle, slow bounce with a tiny squash-and-stretch.
  // 0 = resting/lowest (slightly squished), 1 = apex (slightly stretched).
  const charBounce = useRef(new Animated.Value(0)).current;
  const bounceLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  // (Re)start the idle loop from scratch. Native-driven loops can get paused by
  // the OS (e.g. when the app is backgrounded) and not auto-resume, so we keep a
  // handle and restart it whenever Home becomes active/focused.
  const startBounce = useCallback(() => {
    bounceLoopRef.current?.stop();
    charBounce.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(charBounce, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(charBounce, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    bounceLoopRef.current = loop;
    loop.start();
  }, [charBounce]);
  useEffect(() => {
    startBounce();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') startBounce();
    });
    return () => {
      sub.remove();
      bounceLoopRef.current?.stop();
    };
  }, [startBounce]);
  const charTranslateY = charBounce.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const charScaleY = charBounce.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] });
  const charScaleX = charBounce.interpolate({ inputRange: [0, 1], outputRange: [1.02, 0.99] });

  // Mixer bowl centre (approx) — right:-30, bottom:30%, size 285×235
  // These are rough screen coords; close enough for the drop zone
  const MIXER_CX = 393 - 30 - 285 / 2 + 285 * 0.35;
  const MIXER_CY_FROM_TOP = 852 * (1 - 0.30) - 235 * 0.55;

  useFocusEffect(useCallback(() => {
    // Make sure the idle bounce is running each time Home regains focus.
    startBounce();
    const session = takePendingDragSession();
    if (session) {
      setDragSession(session);
      setDroppedIds(new Set());
      fadeOverlay.setValue(0);
    }
    // Refresh the pending friend-request count for the badge.
    let cancelled = false;
    if (user?.id) {
      listIncomingRequests(user.id)
        .then((reqs) => { if (!cancelled) setPendingRequests(reqs.length); })
        .catch(() => {});
    } else {
      setPendingRequests(0);
    }
    return () => { cancelled = true; };
  }, [startBounce, user?.id]));


  const handleIngredientDropped = (id: DragId) => {
    setDroppedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      if (next.size === 3) {
        setTimeout(() => {
          Animated.timing(fadeOverlay, { toValue: 1, duration: 800, useNativeDriver: true }).start(() => {
            if (dragSession) {
              if (dragSession.moodValue && dragSession.moodLabel) {
                addMoodEntry({ value: dragSession.moodValue, label: dragSession.moodLabel, type: 'before', sessionMinutes: dragSession.durationMinutes, timestamp: new Date().toISOString() });
              }
              startActiveSession({ durationMinutes: dragSession.durationMinutes, subjectName: dragSession.subjectName, taskId: dragSession.taskId, taskTitle: dragSession.taskTitle, breakMinutes: dragSession.breakMinutes });
            }
            setDragSession(null);
          });
        }, 300);
      }
      return next;
    });
  };
  const activeSessionId = activeSession?.id ?? null;
  const myBgRoom = ROOM_PAIRS.find((r) => r.id === equippedBackgroundRoomId) ?? ROOM_PAIRS[0];
  // In a multiplayer study session, everyone studies in the host's room.
  const hostBgRoom = studyRoom.hostBackgroundId ? ROOM_PAIRS.find((r) => r.id === studyRoom.hostBackgroundId) : undefined;
  const bgRoom = activeSession?.isMultiplayer && hostBgRoom ? hostBgRoom : myBgRoom;
  const deskRoom = ROOM_PAIRS.find((r) => r.id === equippedDeskRoomId) ?? ROOM_PAIRS[0];
  const activeCompanion = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins);
  const homeCompanionSource =
    didHomeImageFail && activeCompanion.type === 'slot'
      ? resolveActiveCompanion(`starter:${defaultCompanionId}`, defaultCompanionId, companionSlots, bunSkinId, companionSkins)
          .imageSource
      : activeCompanion.imageSource;
  // Studying: Bun has a reading animation; other companions just stand for now.
  const studyCharacterSource = activeCompanion.type === 'starter' ? BUN_STUDYING : homeCompanionSource;
  const reminderStyle = getReminderStyleEffect(equippedShopItems);
  const nextUpcomingExam = [...examCountdowns]
    .filter((exam) => daysUntil(exam.dateISO) >= 0)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))[0];
  const latestExam = [...examCountdowns].sort((a, b) => b.dateISO.localeCompare(a.dateISO))[0];
  const featuredExam = nextUpcomingExam ?? latestExam ?? null;
  const examDays = featuredExam ? daysUntil(featuredExam.dateISO) : null;
  const examIsUrgent = examDays !== null && examDays >= 0 && examDays <= 7;
  const examIsPast = examDays !== null && examDays < 0;
  const examTargetMs = featuredExam ? getExamTargetMs(featuredExam.dateISO, featuredExam.time) : null;
  const examCountdownText =
    examTargetMs === null ? '--' : formatLiveCountdown(examTargetMs, nowMs);
  const examSubjectColor =
    (featuredExam?.subject ? subjects.find((s) => s.name === featuredExam.subject)?.color : null) ?? '#C9A18A';
  const sessionNowMs = activeSession
    ? Math.max(nowMs, new Date(activeSession.startedAt).getTime())
    : nowMs;
  const sessionSecondsLeft = activeSession
    ? getSessionSecondsLeft(activeSession.startedAt, activeSession.durationMinutes, sessionNowMs)
    : 0;
  const sessionElapsedMinutes = activeSession
    ? getSessionElapsedMinutes(activeSession.startedAt, activeSession.durationMinutes, sessionNowMs)
    : 0;

  // Hide the bottom tab bar while dragging ingredients or studying.
  useEffect(() => {
    setDragActive(!!dragSession || !!activeSession);
    return () => setDragActive(false);
  }, [dragSession, activeSession]);

  useEffect(() => {
    setDidHomeImageFail(false);
  }, [activeCompanionId]);

  useEffect(() => {
    if (!activeSessionId) {
      handledCompletionId.current = null;
      return;
    }

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeSessionId]);

  // Tick every second for the live exam countdown (when not already ticking
  // for an active session).
  useEffect(() => {
    if (activeSessionId || examTargetMs === null) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeSessionId, examTargetMs]);

  useEffect(() => {
    if (!activeSession) return;
    if (handledCompletionId.current === activeSession.id) return;

    // Only finish when the real wall-clock time has truly elapsed — never on a
    // mere app focus / re-render. Compare against Date.now() directly.
    const endMs = new Date(activeSession.startedAt).getTime() + activeSession.durationMinutes * 60000;
    if (Date.now() < endMs) return;

    // Multiplayer sessions don't show the cake completion screen — the studying
    // view shows a coins-earned + continue/break/exit menu instead.
    if (activeSession.isMultiplayer) return;

    handledCompletionId.current = activeSession.id;
    // Stash the finish params, then let the study view play the recipe-pop out of
    // the timer for a beat before we navigate (see the effect below).
    finishParamsRef.current = {
      sessionLength: String(activeSession.durationMinutes),
      subject: activeSession.subjectName ?? '',
      coinsEarned: String(coinsForMinutes(activeSession.durationMinutes)),
      taskId: activeSession.taskId ?? '',
      taskTitle: activeSession.taskTitle ?? '',
    };
    setFinishingSession(true);
  }, [activeSession, sessionSecondsLeft]);

  // After the recipe pops out of the timer, hand off to the finish screen.
  useEffect(() => {
    if (!finishingSession) return;
    const id = setTimeout(() => {
      clearActiveSession();
      setFinishingSession(false);
      if (finishParamsRef.current) {
        router.push({ pathname: '/session-complete', params: finishParamsRef.current });
        finishParamsRef.current = null;
      }
    }, 1700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishingSession]);

  const handleExamPress = () => {
    if (featuredExam) {
      router.push('/progress');
      return;
    }
    router.push('/add-exam');
  };

  const handleStopSession = () => {
    if (!activeSession) return;

    // 1 coin per minute actually studied (no coins under the minimum).
    const cancelCoins =
      sessionElapsedMinutes >= MIN_MINUTES_FOR_COINS ? coinsForMinutes(sessionElapsedMinutes) : 0;
    const message =
      cancelCoins > 0
        ? t('home.studiedEarn', { minutes: sessionElapsedMinutes, coins: cancelCoins })
        : t('home.lessThanMin', { min: MIN_MINUTES_FOR_COINS });

    Alert.alert(t('home.stopSessionQ'), message, [
      { text: t('home.keepStudying'), style: 'cancel' },
      {
        text: t('common.stop'),
        style: 'destructive',
        onPress: () => {
          const endedSession = activeSession;
          clearActiveSession();

          // Ending midway skips the finish screen. Credit any earned coins and
          // record the partial session here, then go straight back to home.
          if (cancelCoins > 0) {
            addCoins(cancelCoins);
            recordSession(sessionElapsedMinutes);
            addSubjectTime(endedSession.subjectName, sessionElapsedMinutes);
          }
          showLoadingScreen();
        },
      },
    ]);
  };

  const handleBreakGame = () => {
    if (!activeSession) return;

    Alert.alert(t('home.openBreakGameQ'), t('home.openBreakGameMsg'), [
      { text: t('home.keepStudying'), style: 'cancel' },
      {
        text: t('home.breakGameBtn'),
        onPress: () => {
          clearActiveSession();
          router.push({
            pathname: '/break-game',
            params: {
              breakMinutes: String(DEFAULT_BREAK_MINUTES),
              fromSession: '1',
            },
          });
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.scene}>
          <Image
            source={bgRoom.backgroundImage}
            style={styles.roomBackground}
            contentFit="cover"
            contentPosition="center"
          />

          {/* Soft sunlight shining from the top — kept gentle so the room stays clear */}
          <Image source={SUNLIGHT} style={styles.sunlight} contentFit="cover" pointerEvents="none" />

          {activeSession ? (
            <View style={[styles.studyRoomWrap, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 8 }]}>
              <StudyRoomView
                secondsLeft={sessionSecondsLeft}
                onStop={handleStopSession}
                onBreakGame={handleBreakGame}
                finishing={finishingSession}
              />
            </View>
          ) : (
            <>
              {!dragSession && <View style={styles.topHud}>
                <View style={styles.statusRow}>
                  <View style={styles.statusChip}>
                    <Image source={STREAK_FIRE_ICON} style={styles.statusStreakIcon} contentFit="contain" accessibilityLabel="" />
                    <ThemedText type="smallBold" style={styles.statusChipText}>
                      {streak.currentStreak} day streak
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={() => router.push('/coin-shop')}
                    style={({ pressed }) => pressed && styles.cardPressed}
                    accessibilityLabel={t('home.a11yAddCoins')}>
                    <View style={[styles.statusChip, styles.coinChip]}>
                      <CoinIcon size={26} />
                      <ThemedText type="smallBold" style={styles.coinChipText}>
                        {coins}
                      </ThemedText>
                      <View style={styles.coinAddBtn}>
                        <ThemedText style={styles.coinAddText}>+</ThemedText>
                      </View>
                    </View>
                  </Pressable>
                </View>

                <View style={styles.metaRow}>
                  <Pressable
                    style={({ pressed }) => [styles.metaCardPressable, pressed && styles.cardPressed]}
                    onPress={handleExamPress}>
                    <View
                      style={[
                        styles.metaCard,
                        examIsUrgent && styles.metaCardUrgent,
                        examIsPast && styles.metaCardPast,
                      ]}>
                      <View style={styles.metaCardHeader}>
                        <View style={styles.examTitleRow}>
                          <Image source={EXAM_BOOK_ICON} style={styles.examBookIcon} contentFit="contain" accessibilityLabel="" />
                          <ThemedText style={styles.metaCardTitle}>{t('home.upcomingExam')}</ThemedText>
                        </View>
                      </View>
                      <View style={styles.metaCardContent}>
                        <View style={styles.metaCardTextBlock}>
                          {featuredExam ? (
                            <>
                              <ThemedText style={styles.metaHeadline} numberOfLines={1}>
                                {featuredExam.name}
                              </ThemedText>
                              <ThemedText style={styles.metaSubline} numberOfLines={1}>{formatExamDate(featuredExam.dateISO)}</ThemedText>
                              <View style={styles.examCountdownRow}>
                                <ThemedText
                                  style={[
                                    styles.metaAccentText,
                                    examIsUrgent && styles.metaAccentTextUrgent,
                                    examIsPast && styles.metaAccentTextPast,
                                  ]}
                                  numberOfLines={1}>
                                  {examCountdownText}
                                </ThemedText>
                                {featuredExam.subject ? (
                                  <View style={styles.examSubjectChip}>
                                    <View style={[styles.examSubjectDot, { backgroundColor: examSubjectColor }]} />
                                    <ThemedText style={styles.examSubjectText} numberOfLines={1}>
                                      {featuredExam.subject}
                                    </ThemedText>
                                  </View>
                                ) : null}
                              </View>
                            </>
                          ) : (
                            <>
                              <ThemedText style={styles.metaHeadline}>{t('home.noExamYet')}</ThemedText>
                              <ThemedText style={styles.metaSubline}>{t('home.tapToAdd')}</ThemedText>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.metaCardPressable, pressed && styles.cardPressed]}
                    onPress={() => router.push('/reminder-settings')}>
                    <View style={styles.metaCard}>
                      <View style={styles.metaCardHeader}>
                        <View style={styles.reminderTitleRow}>
                          <Image source={REMINDER_BELL_ICON} style={styles.reminderBellIcon} contentFit="contain" accessibilityLabel="" />
                          <ThemedText style={styles.metaCardTitle}>{t('home.reminder')}</ThemedText>
                        </View>
                      </View>
                      <View style={styles.metaCardContent}>
                        <View style={styles.metaCardTextBlock}>
                          <ThemedText style={styles.reminderCopy}>
                            {reminderEnabled
                              ? `${t('home.dailyPing', { time: reminderTime })} ${
                                  isPlus && ambienceId
                                    ? `${getAmbienceEmoji(ambienceId)} ${getAmbienceName(ambienceId)}`
                                    : t('home.youGotThis')
                                }`
                              : t('home.tapToSetReminders')}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </View>
              </View>}

              {/* Switch character button — top left, below exam card */}
              {!dragSession && (
                <Pressable
                  style={({ pressed }) => [styles.switchCharBtn, pressed && styles.startButtonPressed]}
                  onPress={() => router.push('/companion-gallery')}
                  accessibilityLabel={t('home.a11ySwitchCharacter')}>
                  <Image source={SWITCH_CHARACTER_BTN} style={styles.switchCharImg} contentFit="contain" />
                </Pressable>
              )}

              {/* Food menu button — top left, below switch character */}
              {!dragSession && (
                <Pressable
                  style={({ pressed }) => [styles.foodMenuBtn, pressed && styles.startButtonPressed]}
                  onPress={() => router.push('/food-gallery')}
                  accessibilityLabel={t('home.a11yFoodMenu')}>
                  <Image source={FOOD_MENU_BTN} style={styles.foodMenuImg} contentFit="contain" />
                </Pressable>
              )}

              {/* Edit Room button — top left, above settings */}
              {!dragSession && (
                <Pressable
                  style={({ pressed }) => [styles.editRoomBtn, pressed && styles.startButtonPressed]}
                  onPress={() => router.push('/edit-room')}
                  accessibilityLabel={t('home.a11yEditRoom')}>
                  <Image source={EDIT_ROOM_BTN} style={styles.editRoomImg} contentFit="contain" />
                </Pressable>
              )}

              {/* Settings button — top left, below food menu */}
              {!dragSession && (
                <Pressable
                  style={({ pressed }) => [styles.topSettingsBtn, pressed && styles.startButtonPressed]}
                  onPress={() => router.push('/settings')}
                  accessibilityLabel={t('home.a11yOpenSettings')}>
                  <Image source={SETTINGS_BTN} style={styles.topSettingsImg} contentFit="contain" />
                </Pressable>
              )}

              {/* Friend button — right side */}
              {!dragSession && (
                <Pressable
                  style={({ pressed }) => [styles.friendBtn, pressed && styles.startButtonPressed]}
                  onPress={() => router.push('/friends')}
                  accessibilityLabel={t('home.a11yFriends')}>
                  <Image source={FRIEND_BTN} style={styles.friendBtnImg} contentFit="contain" />
                  {pendingRequests > 0 && (
                    <View style={styles.friendReqBadge} pointerEvents="none">
                      <ThemedText style={styles.friendReqBadgeText}>
                        {pendingRequests > 9 ? '9+' : pendingRequests}
                      </ThemedText>
                    </View>
                  )}
                </Pressable>
              )}

              <View style={styles.homeCharacterLayer} pointerEvents="none">
                <Animated.View
                  style={{ transform: [{ translateY: charTranslateY }, { scaleX: charScaleX }, { scaleY: charScaleY }] }}>
                  {isHanjiActiveId(activeCompanionId) ? (
                    <HanjiFigure style={styles.homeCharacterImage} />
                  ) : (
                    <RNImage
                      source={homeCompanionSource}
                      style={styles.homeCharacterImage}
                      resizeMode="contain"
                    />
                  )}
                </Animated.View>
              </View>

              {/* Desk surface */}
              <RNImage
                source={deskRoom.deskImage}
                style={[styles.deskNewLayer, deskRoom.deskTint ? { backgroundColor: deskRoom.deskTint } : null]}
                resizeMode={deskRoom.deskFit ?? 'cover'}
                pointerEvents="none"
              />
              {/* Thin line marking the table's front edge */}
              <View style={styles.tableEdgeLine} pointerEvents="none" />
              {/* Mixer on desk — matches the equipped dessert */}
              <RNImage source={deskKit.mixer} style={[styles.deskMixer, deskKit.mixerStyle]} resizeMode="contain" pointerEvents="none" />

              {/* Ingredients — draggable in drag mode, static otherwise. The 3
                  ingredients fill the 3 fixed desk slots, by index. */}
              {dragSession ? (
                <>
                  {deskKit.ingredients.map((ing, idx) => (
                    droppedIds.has(ing.id) ? null : (
                      <DraggableIngredient
                        key={ing.id}
                        id={ing.id}
                        src={ing.src}
                        style={[DESK_SLOT_STYLES[idx], ing.style]}
                        onDropped={() => handleIngredientDropped(ing.id)}
                        mixerCenterX={MIXER_CX}
                        mixerCenterY={MIXER_CY_FROM_TOP}
                      />
                    )
                  ))}
                  {/* Drag prompt */}
                  <View style={[styles.dragPrompt, { top: insets.top + 16 }]}>
                    <View style={styles.dragPromptBubble}>
                      <ThemedText style={styles.dragPromptText}>
                        {droppedIds.size === 3 ? t('home.letsStudy') : t('home.dragAllIngredients')}
                      </ThemedText>
                    </View>
                  </View>
                  {/* Fade to black */}
                  <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: fadeOverlay, zIndex: 99 }]} />
                </>
              ) : (
                <>
                  {deskKit.ingredients.map((ing, idx) => (
                    <RNImage key={ing.id} source={ing.src} style={[DESK_SLOT_STYLES[idx], ing.style]} resizeMode="contain" />
                  ))}
                </>
              )}

              {!dragSession && <View style={[styles.startSessionPressable, { bottom: 155 }]}>
                <Pressable
                  style={({ pressed }) => [styles.startSessionInner, pressed && styles.startButtonPressed]}
                  onPress={() => router.push('/session-picker')}
                  accessibilityLabel={t('home.a11yStartSession')}>
                  <Image source={START_SESSION_BTN} style={styles.startSessionBg} contentFit="fill" />
                  <ThemedText style={styles.startSessionLabel}>{t('home.startSession')}</ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.settingsFloating, styles.gameFloating, pressed && styles.startButtonPressed]}
                  onPress={() => router.push({ pathname: '/break-game', params: { browse: '1' } })}
                  accessibilityLabel={t('home.a11yPlayGame')}>
                  <Image source={GAME_BTN} style={styles.gameFloatingImg} contentFit="contain" />
                </Pressable>
              </View>}
            </>
          )}
        </View>
      </SafeAreaView>
      <HanjiUnlockModal />
    </ThemedView>
  );
}

const META_CARD_RATIO = 1.8;
const META_ROW_INSET = 18;
const META_ROW_GAP = 6;

const metaCardShadow = {
  shadowColor: '#8B6B57',
  shadowOpacity: 0.1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
} as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBEDDA',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
  switchCharBtn: {
    position: 'absolute',
    left: 4,
    top: 210,
    zIndex: 5,
    width: 80,
    height: 80,
  },
  switchCharImg: {
    width: 80,
    height: 80,
  },
  foodMenuBtn: {
    position: 'absolute',
    left: 4,
    top: 292,
    zIndex: 5,
    width: 80,
    height: 80,
  },
  foodMenuImg: {
    width: 80,
    height: 80,
  },
  topSettingsBtn: {
    position: 'absolute',
    left: 4,
    top: 452,
    zIndex: 5,
    width: 72,
    height: 72,
  },
  topSettingsImg: { width: 72, height: 72 },
  editRoomBtn: {
    position: 'absolute',
    left: 4,
    top: 376,
    zIndex: 5,
    width: 72,
    height: 72,
  },
  editRoomImg: { width: 72, height: 72 },
  friendBtn: {
    position: 'absolute',
    right: 12,
    top: 300,
    zIndex: 5,
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendBtnImg: { width: 62, height: 62 },
  friendReqBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF4D5E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  friendReqBadgeText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  gameFloating: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -18,
  },
  gameFloatingImg: { width: 72, height: 72 },
  dragPrompt: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 30,
  },
  dragPromptBubble: {
    backgroundColor: 'rgba(255,248,240,0.96)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#F4C2C8',
  },
  dragPromptText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#C4607A',
    textAlign: 'center',
  },
  scene: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  studyRoomWrap: { flex: 1, zIndex: 2 },
  roomBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  sunlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    opacity: 0.8,
    zIndex: 1,
  },
  deskMixer: {
    position: 'absolute',
    right: -48,
    bottom: '30%',
    width: 285,
    height: 235,
    zIndex: 3,
  },
  deskStrawberries: {
    position: 'absolute', left: 96, bottom: 250,
    width: 92, height: 76, zIndex: 10,
  },
  deskEggs: {
    position: 'absolute', left: 194, bottom: 250,
    width: 82, height: 69, zIndex: 10,
  },
  deskButter: {
    position: 'absolute', left: 284, bottom: 250,
    width: 82, height: 69, zIndex: 10,
  },
  deskNewLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '47%',
    zIndex: 2,
  },
  tableEdgeLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '47%',
    height: 1,
    backgroundColor: 'rgba(120, 90, 70, 0.22)',
    zIndex: 3,
  },
  deskOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '33%',
    zIndex: 2,
  },
  deskHands: {
    position: 'absolute',
    left: -60,
    right: 60,
    bottom: '29%',
    height: 120,
    zIndex: 3,
  },
  focusTopArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 6,
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  studyFrame: {
    width: 320,
    aspectRatio: 1266 / 924,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studyFrameInner: {
    alignItems: 'center',
    paddingTop: '12%',
    gap: 2,
  },
  studyFrameSubject: {
    fontSize: 13,
    fontWeight: '600',
    color: '#A46F56',
  },
  studyFrameTimer: {
    fontSize: 56,
    lineHeight: 62,
    fontWeight: '800',
    letterSpacing: -1,
    color: '#5D3C2E',
  },
  studyFrameMeta: {
    fontSize: 12,
    color: '#A46F56',
    opacity: 0.85,
  },
  focusBadge: {
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 249, 241, 0.94)',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  focusBadgeText: {
    color: BakeryColors.mocha,
  },
  focusTimerCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BakeryRadii.panel,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: 'rgba(255, 249, 241, 0.95)',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  focusMeta: {
    textAlign: 'center',
    lineHeight: 20,
  },
  focusTimerText: {
    fontSize: 72,
    lineHeight: 80,
    fontWeight: '700',
    letterSpacing: -2,
    color: BakeryColors.cocoaDark,
  },
  studyCharacterLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '38%',
    height: 300,
    zIndex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingRight: 36,
  },
  studyCharacterImage: {
    width: 260,
    height: 300,
  },
  deskOven: {
    position: 'absolute',
    left: 10,
    bottom: '30%',
    width: 150,
    aspectRatio: 821 / 1099,
    zIndex: 3,
  },
  deskRadio: {
    position: 'absolute',
    right: 16,
    bottom: '31%',
    width: 110,
    height: 110,
    zIndex: 3,
  },
  imgButton: {
    alignSelf: 'center',
  },
  stopBtnImg: {
    width: 230,
    aspectRatio: 1787 / 473,
  },
  breakBtnImg: {
    width: 230,
    aspectRatio: 1882 / 562,
  },
  focusActions: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    zIndex: 6,
    gap: Spacing.two,
  },
  settingsButton: {
    position: 'absolute',
    top: 220,
    right: Spacing.three,
    zIndex: 5,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { width: 52, height: 52 },
  chatButton: {
    position: 'absolute',
    left: Spacing.three,
    bottom: BottomTabInset + 22 + 104,
    zIndex: 5,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF6E6',
    borderWidth: 2,
    borderColor: '#E2C9A6',
    ...metaCardShadow,
  },
  topHud: {
    gap: Spacing.two,
    zIndex: 3,
    paddingHorizontal: 0,
    paddingTop: Spacing.two,
    width: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: META_ROW_INSET,
    width: '100%',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 52,
    overflow: 'hidden',
    borderRadius: BakeryRadii.pill,
    backgroundColor: '#FFF3EC',
    borderWidth: 1.5,
    borderColor: '#E8A870',
    ...metaCardShadow,
  },
  coinChip: {
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  coinChipText: {
    color: BakeryColors.cocoaDark,
  },
  coinAddBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F4A0A8',
    borderWidth: 1.5,
    borderColor: '#E8B87A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinAddText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  statusChipText: {
    fontSize: 13,
    lineHeight: 16,
    color: BakeryColors.cocoaDark,
  },
  heroImageClip: {
    flex: 1,
    width: '96%',
    maxWidth: 372,
    height: 420,
    overflow: 'hidden',
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  homeCharacterLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '38%',
    height: 280,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  homeCharacterImage: {
    width: 300,
    height: 300,
  },
  homeBreadButtonWrap: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
    paddingTop: 20,
  },
  homeBreadTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 44,
  },
  homeBreadBump: {
    position: 'absolute',
    top: 0,
    height: 42,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: '#D29649',
    backgroundColor: '#F6C979',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  homeBreadBumpLeft: {
    left: '5%',
    width: '34%',
  },
  homeBreadBumpCenter: {
    left: '33%',
    width: '34%',
  },
  homeBreadBumpRight: {
    right: '5%',
    width: '34%',
  },
  homeBreadButton: {
    minHeight: 66,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    backgroundColor: BakeryColors.honey,
    borderRadius: 26,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1.5,
    borderColor: '#D29649',
    overflow: 'hidden',
    ...BakeryShadow,
  },
  homeBreadScores: {
    position: 'absolute',
    top: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  homeBreadScore: {
    width: 22,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 248, 241, 0.42)',
  },
  homeBreadScoreLeft: {
    transform: [{ rotate: '-24deg' }],
  },
  homeBreadScoreCenter: {
    transform: [{ rotate: '-12deg' }],
  },
  homeBreadScoreRight: {
    transform: [{ rotate: '16deg' }],
  },
  cardPressed: { opacity: 0.85 },
  bubbleCard: {
    borderRadius: BakeryRadii.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 249, 241, 0.95)',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    ...BakeryShadow,
  },
  bubbleText: {
    textAlign: 'center',
    lineHeight: 20,
    color: BakeryColors.cocoaDark,
  },
  metaRow: {
    flexDirection: 'row',
    gap: META_ROW_GAP,
    alignItems: 'flex-start',
    paddingHorizontal: META_ROW_INSET,
    width: '100%',
    backgroundColor: 'transparent',
  },
  metaCardPressable: {
    flex: 1,
    minWidth: 0,
    aspectRatio: META_CARD_RATIO,
  },
  metaCard: {
    width: '100%',
    height: '100%',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 4,
    borderRadius: 20,
    backgroundColor: '#FFF8F6',
    borderWidth: 1.5,
    borderColor: '#EAB0B0',
    overflow: 'hidden',
    ...metaCardShadow,
  },
  metaCardTitle: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
    color: BakeryColors.cocoaDark,
  },
  metaSubline: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '500',
    color: BakeryColors.mocha,
  },
  metaCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  metaCardTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
    paddingBottom: 2,
    gap: 2,
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  metaCardArt: {
    width: 62,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginRight: -2,
    backgroundColor: 'transparent',
  },
  examTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  reminderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  examCalendarDay: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    color: BakeryColors.cocoaDark,
  },
  metaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  reminderCopy: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: '500',
    color: BakeryColors.cocoa,
  },
  metaCardUrgent: {
    shadowColor: BakeryColors.danger,
  },
  metaCardPast: {
    opacity: 0.92,
  },
  metaHeadline: {
    fontSize: 12.5,
    lineHeight: 14,
    fontWeight: '700',
    color: BakeryColors.cocoaDark,
  },
  metaAccentText: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '700',
    color: '#B87A5A',
  },
  examCountdownRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  examSubjectChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  examSubjectDot: { width: 8, height: 8, borderRadius: 4 },
  examSubjectText: { fontSize: 10.5, lineHeight: 13, fontWeight: '700', color: BakeryColors.mocha, flexShrink: 1 },
  metaAccentTextUrgent: {
    color: '#C45E4A',
  },
  metaAccentTextPast: {
    color: '#999',
  },
  startButton: {
    backgroundColor: BakeryColors.honey,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D29649',
    ...BakeryShadow,
  },
  startSessionPressable: {
    position: 'absolute',
    left: 40,
    right: Spacing.two,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  startSessionInner: {
    marginRight: 10,
    width: 262,
    height: 87,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startSessionBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  startSessionLabel: {
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textShadowColor: '#C97A12',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    transform: [{ translateY: -2 }],
  },
  settingsFloating: {
    width: 72,
    height: 72,
  },
  settingsFloatingIcon: {
    width: 72,
    height: 72,
  },
  startButtonPressed: { opacity: 0.88 },
  statusStreakIcon: { width: 22, height: 22 },
  examBookIcon: { width: 22, height: 22 },
  reminderBellIcon: { width: 24, height: 28 },
  examCalendarIcon: { width: 44, height: 48 },
  reminderBreadIcon: { width: 34, height: 44 },
  startButtonText: { color: BakeryColors.cocoaDark, fontSize: 17 },
  breakButton: {
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BakeryColors.border,
    backgroundColor: 'rgba(255, 249, 241, 0.95)',
    ...BakeryShadow,
  },
  breakButtonText: {
    color: BakeryColors.mocha,
    fontSize: 16,
  },
});
