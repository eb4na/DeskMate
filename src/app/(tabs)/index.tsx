import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, Image as RNImage, ImageBackground, type LayoutChangeEvent, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SoundPressable } from '@/components/sound-pressable';
import { playSwoosh } from '@/lib/sounds';
import { showPopup } from '@/lib/popup';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinIcon } from '@/components/coin-icon';
import { DevKnobs, type Knob } from '@/components/dev-knobs';
import { useIsTablet } from '@/hooks/use-device-class';
import { StudyRoomView } from '@/components/study-room-view';
import { HanjiUnlockModal } from '@/components/hanji-unlock-modal';
import { RecipeBadgeModal } from '@/components/recipe-badge-modal';
import { DailyRewardModal } from '@/components/daily-reward-modal';
import { BirthdayRewardModal } from '@/components/birthday-reward-modal';
import { useStudyRoom } from '@/lib/use-study-room';
import { BakeryGearEmoji } from '@/components/bakery-emoji';
import { CountdownShape } from '@/components/countdown-shapes';
import { CookieChatIcon } from '@/components/settings-icons';
import { getReminderStyleEffect } from '@/constants/shop-effects';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { nextLoginReward, todayISO, useApp } from '@/context/app-context';
import { HomeTutorial } from '@/components/home-tutorial';
import { setTutorialTarget } from '@/lib/tutorial-targets';
import i18n, { useTranslation } from '@/i18n';
import { coinsForMinutes } from '@/constants/placeholder-data';
import { hanjiIsAnimated, resolveActiveCompanion } from '@/lib/companion-utils';
import { HanjiFigure } from '@/components/hanji-figure';
import { useAuth } from '@/context/auth-context';
import { listBlocked, listIncomingRequests } from '@/lib/friend-requests';
import { ROOM_PAIRS } from '@/constants/room-data';
import { takePendingDragSession, setDragActive, type DragSessionData } from '@/lib/drag-session';
import { showLoadingScreen } from '@/lib/loading-signal';
import { preloadStudyAssets } from '@/lib/preload-nav';
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

// Tablet-only layout overrides for the home corner buttons. On phones these are
// never applied (gated on useIsTablet → phones stay byte-identical). The numbers
// below are the *baked* tablet values; defaults equal the phone layout (no shift
// until dialed). Author them live via the 🎛 panel in Tablet mode, "Log values",
// then paste the numbers here. Base coords live in the StyleSheet:
//   switchChar top:210 / food top:292 (both 80px, left:4)
//   editRoom top:376 / settings top:452 (both 72px, left:4)
//   friend top:300 / right:12 (62px)
const HOME_TABLET = {
  // Corner buttons
  leftInset: 10,   // gap from the SCREEN's left edge for the 4 left-column buttons (FIXED → same on every tablet)
  stackTop: 85,    // vertical shift applied to all 4 left-column buttons (raised so the stack sits more centered, not low/empty up top)
  btnScale: 1.3,   // size multiplier for every corner button (kept small enough that the 4 left buttons never overlap)
  btnGap: 60,      // extra vertical spacing between the 4 left buttons (clear distance so they never touch)
  friendTop: 86,   // vertical shift for the friend button
  friendRight: 10, // gap from the SCREEN's right edge for the friend button (FIXED → same on every tablet)
  friendScale: 1.4, // friend button size (independent of the left buttons' btnScale)
  // Character (base 300×300, layer anchored bottom:38%)
  charScale: 1.5,  // character size multiplier
  charY: -6,       // character vertical shift (− = up) — nudged down a tiny bit
  cocoaY: 30,      // EXTRA downward shift applied only to Cocoa (+ all Cocoa skins); she sits higher than the others, so drop her more
  // Desk surface (marble) — height % from the bottom + texture zoom
  deskHeight: 46,
  deskZoom: 1.35,  // scales the desk image so the surface texture reads larger
  deskY: 31,       // desk surface vertical nudge (− = up, + = down); dropped to sit on the hairline
  deskEdgeY: 30,   // table-edge hairline's OWN vertical nudge (independent of deskY); dropped to sit on the desk top
  // Streak & coin chips (top row)
  hudScale: 1.1,   // size of the streak + coin chips on tablet (small + ratio-based; scaled by tsW per device)
  // Top cards (Upcoming Exam / Task)
  cardsWidth: 780, // max width of the card row (centered) — bigger cards
  cardsTop: 24,    // vertical shift of the whole top HUD (streak/coins/cards)
  cardsGapTop: 16, // extra space below the chips so the bigger chips don't overlap the cards
  cardsGap: 28,    // horizontal gap between the exam & task cards
  cardRatio: 2.9,  // card width:height — higher = flatter/shorter (base 1.8); kept flat so the cards don't cover the character
  cardTextScale: 1.4, // multiplies the card text sizes
  examY: 0,        // exam card vertical nudge (kept level with task)
  taskY: 0,        // task card vertical nudge
  // Desk ingredients (berries / eggs / butter) — shared transform + per-item spread
  ingX: 250,        // group X (− = left); nudged left
  ingY: -164,
  ingScale: 1.5,
  ingSpread: 50,    // extra px pushing the outer two apart (idx 0 ← left, idx 2 → right)
  // Mixer — shared transform (preserves per-recipe base position/size)
  mixerX: -105,     // nudged left
  mixerY: -50,
  mixerScale: 1.5,  // bigger mixer
  // Start Session button — on tablet it's centered by LAYOUT (see tStartRow), so it
  // sits dead-center on every tablet width with no hand-tuned X offset. The game icon
  // floats just to its right of center (see tGame).
  startY: -120,    // raised so Start Session + the game icon clear the bottom nav bar
  startScale: 1.5,
};

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
    mixerStyle: { right: 6, bottom: '40%', width: 148, height: 145 },
    ingredients: [
      { id: 'matcha', src: DESK_MATCHA, style: { width: 115, height: 95 } },
      { id: 'milk', src: DESK_MATCHA_MILK, style: { width: 105, height: 88 } },
      { id: 'eggFlour', src: DESK_EGGFLOUR, style: { width: 105, height: 88 } },
    ],
  },
};
const DEFAULT_DESK_FOOD = 'strawberry-shortcake';

type DragId = string;

function DraggableIngredient({
  id, src, style, onDropped, mixerCenterX, mixerCenterY, baseX = 0, baseY = 0, baseScale = 1, dropRadius = 100,
}: {
  id: DragId; src: any; style: any;
  onDropped: () => void;
  mixerCenterX: number; mixerCenterY: number;
  baseX?: number; baseY?: number; baseScale?: number; dropRadius?: number;
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
      if (dist < dropRadius) {
        dropped.current = true;
        playSwoosh(); // ingredient lands in the mixer
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
      style={[style, { transform: [{ translateX: baseX }, { translateY: baseY }, { translateX: pan.x }, { translateY: pan.y }, { scale: baseScale }, { scale }], opacity, zIndex: 20 }]}
      {...pr.panHandlers}
    >
      <RNImage source={src} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Tablet corner-button overrides (see HOME_TABLET). `ht` only ever changes via
  // the dev knob panel; in production it stays at the baked HOME_TABLET values.
  const isTablet = useIsTablet();
  const { width: winW, height: winH } = useWindowDimensions();
  // Dev-knob overrides only (empty in production). `ht` is recomputed from
  // HOME_TABLET every render rather than trapped in useState, so edits to
  // HOME_TABLET take effect on Fast Refresh — otherwise a hot-reload preserves the
  // old state and layout tweaks appear to "do nothing" until a full cold restart.
  const [dialed, setDialed] = useState<Partial<typeof HOME_TABLET>>({});
  const ht = { ...HOME_TABLET, ...dialed };

  // 11-inch iPad Pro (834 × 1194 pt portrait) is the tablet layout reference.
  // We use SEPARATE horizontal (tsW) and vertical (tsH) factors because 11-inch
  // and 13-inch iPads have slightly different aspect ratios — a single factor
  // based on the shorter side would over-scale Y positions on the 13-inch.
  // Corner pins (leftInset, friendRight) stay fixed regardless of screen size.
  const TABLET_REF_W = 834;
  const TABLET_REF_H = 1194;
  const tsW = isTablet ? winW / TABLET_REF_W : 1; // horizontal: widths + X positions
  const tsH = isTablet ? winH / TABLET_REF_H : 1; // vertical:   heights + Y positions
  // Y-axis knob keys (scale by tsH); all other scalable keys use tsW.
  const Y_KEYS = new Set([
    'stackTop', 'btnGap', 'friendTop', 'charY', 'cocoaY',
    'deskY', 'deskEdgeY', 'cardsTop', 'cardsGapTop',
    'ingY', 'mixerY', 'startY', 'examY', 'taskY',
  ]);
  // These are ratios/percentages/corner-pins — never scaled.
  const FIXED_KEYS = new Set(['leftInset', 'friendRight', 'deskHeight', 'deskZoom', 'cardRatio']);
  const htScaled = useMemo(
    () => Object.fromEntries(
      Object.entries(ht).map(([k, v]) => {
        if (FIXED_KEYS.has(k) || typeof v !== 'number') return [k, v];
        const factor = Y_KEYS.has(k) ? tsH : tsW;
        return [k, Math.round(v * factor * 10) / 10];
      }),
    ) as typeof ht,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ht, tsW, tsH],
  );

  // iPhone 17 Pro (≈393×852pt) is the phone layout reference. On any other phone
  // size we compute linear scale factors and apply them to all pixel positions and
  // sizes — except corner pins (left: 4, right: 12) which stay fixed so buttons
  // always sit at the same distance from the screen edges.
  // On tablet phW/phH are 1.0 (identity) so tBtn/tFriend take over as usual.
  const PHONE_REF_W = 393;
  const PHONE_REF_H = 852;
  const phW = isTablet ? 1 : winW / PHONE_REF_W;
  const phH = isTablet ? 1 : winH / PHONE_REF_H;
  const ph = useMemo(() => {
    const rnd = Math.round;
    return {
      // Left-column button tops (same corner-pin left: 4 stays in StyleSheet)
      btnTops: [210, 292, 376, 452].map((t) => rnd(t * phH)),
      // Sizes: large (80), medium (72), friend (62)
      szLg: rnd(80 * phW),
      szMd: rnd(72 * phW),
      szFr: rnd(62 * phW),
      // Friend button (corner-pin right: 12 stays in StyleSheet)
      friendTop: rnd(300 * phH),
      // Mixer — corner-pin right: -48 and bottom: '30%' stay in StyleSheet
      mixerW: rnd(285 * phW),
      mixerH: rnd(235 * phW),
      // Ingredients
      ingBottom: rnd(250 * phH),
      berryLeft: rnd(96 * phW), berryW: rnd(92 * phW), berryH: rnd(76 * phW),
      eggsLeft:  rnd(194 * phW), eggsW:  rnd(82 * phW), eggsH:  rnd(69 * phW),
      butLeft:   rnd(284 * phW), butW:   rnd(82 * phW), butH:   rnd(69 * phW),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phW, phH]);

  const homeKnobs: Knob[] = [
    { key: 'leftInset', label: 'Left buttons X', value: ht.leftInset, min: -20, max: 120, step: 1 },
    { key: 'stackTop', label: 'Left buttons Y', value: ht.stackTop, min: -120, max: 200, step: 1 },
    { key: 'btnScale', label: 'Button size ×', value: ht.btnScale, min: 0.5, max: 2, step: 0.05 },
    { key: 'btnGap', label: 'Button spacing', value: ht.btnGap, min: -40, max: 160, step: 1 },
    { key: 'friendTop', label: 'Friend Y', value: ht.friendTop, min: -120, max: 200, step: 1 },
    { key: 'friendRight', label: 'Friend X', value: ht.friendRight, min: -20, max: 120, step: 1 },
    { key: 'friendScale', label: 'Friend size', value: ht.friendScale ?? 1.4, min: 0.5, max: 2.5, step: 0.05 },
    { key: 'charScale', label: 'Character size', value: ht.charScale, min: 0.6, max: 3, step: 0.05 },
    { key: 'charY', label: 'Character Y', value: ht.charY, min: -300, max: 300, step: 2 },
    { key: 'cocoaY', label: 'Cocoa extra Y', value: ht.cocoaY ?? 0, min: -100, max: 100, step: 2 },
    { key: 'deskHeight', label: 'Desk height %', value: ht.deskHeight, min: 30, max: 80, step: 1 },
    { key: 'deskZoom', label: 'Desk texture zoom', value: ht.deskZoom, min: 0.6, max: 3, step: 0.05 },
    { key: 'deskY', label: 'Desk Y (down+)', value: ht.deskY ?? 0, min: -120, max: 120, step: 1 },
    { key: 'deskEdgeY', label: 'Edge line Y', value: ht.deskEdgeY ?? 0, min: -120, max: 120, step: 1 },
    { key: 'hudScale', label: 'Streak/coin size', value: ht.hudScale ?? 1.3, min: 0.8, max: 2, step: 0.05 },
    { key: 'cardsWidth', label: 'Cards width', value: ht.cardsWidth, min: 280, max: 820, step: 4 },
    { key: 'cardsTop', label: 'Cards Y', value: ht.cardsTop, min: -80, max: 300, step: 2 },
    { key: 'cardsGapTop', label: 'Cards gap-top', value: ht.cardsGapTop ?? 0, min: 0, max: 120, step: 2 },
    { key: 'cardsGap', label: 'Cards gap', value: ht.cardsGap ?? 28, min: 0, max: 120, step: 2 },
    { key: 'cardRatio', label: 'Card flatness', value: ht.cardRatio ?? 2.6, min: 1.2, max: 4, step: 0.1 },
    { key: 'cardTextScale', label: 'Card text size', value: ht.cardTextScale ?? 1.3, min: 0.8, max: 2, step: 0.05 },
    { key: 'examY', label: 'Exam card Y', value: ht.examY ?? 0, min: -200, max: 200, step: 2 },
    { key: 'taskY', label: 'Task card Y', value: ht.taskY ?? 0, min: -200, max: 200, step: 2 },
    { key: 'ingX', label: 'Ingredients X', value: ht.ingX, min: -200, max: 300, step: 2 },
    { key: 'ingY', label: 'Ingredients Y', value: ht.ingY, min: -200, max: 300, step: 2 },
    { key: 'ingScale', label: 'Ingredients size', value: ht.ingScale, min: 0.5, max: 3, step: 0.05 },
    { key: 'ingSpread', label: 'Ingredients spread', value: ht.ingSpread, min: 0, max: 200, step: 2 },
    { key: 'mixerX', label: 'Mixer X', value: ht.mixerX, min: -300, max: 200, step: 2 },
    { key: 'mixerY', label: 'Mixer Y', value: ht.mixerY, min: -300, max: 300, step: 2 },
    { key: 'mixerScale', label: 'Mixer size', value: ht.mixerScale, min: 0.5, max: 3, step: 0.05 },
    { key: 'startY', label: 'Start btn Y', value: ht.startY, min: -200, max: 300, step: 2 },
    { key: 'startScale', label: 'Start btn size', value: ht.startScale, min: 0.6, max: 2, step: 0.05 },
  ];
  // Tablet-gated style overrides. htScaled values are already axis-scaled (X by
  // tsW, Y by tsH). baseTop and the 300 in tFriend are phone-reference Y values
  // that must also be scaled by tsH so the full top position stays proportional.
  // The home content is centered and capped at MaxContentWidth (safeArea), so on a
  // wide tablet there's an empty side margin. Subtract it from the corner buttons so
  // they pin to the REAL screen edge — `leftInset`/`friendRight` then read as the gap
  // from the screen edge, not from the centered column (which left them stuck mid-screen).
  const sideMargin = isTablet ? Math.max(0, (winW - MaxContentWidth) / 2) : 0;
  const tBtn = (baseTop: number, index: number, base: number) =>
    isTablet && { left: htScaled.leftInset - sideMargin, top: Math.round(baseTop * tsH) + htScaled.stackTop + index * htScaled.btnGap, width: base * htScaled.btnScale, height: base * htScaled.btnScale };
  const tImg = (base: number) => (isTablet ? { width: base * htScaled.btnScale, height: base * htScaled.btnScale } : null);
  const fScale = htScaled.friendScale ?? 1.4;
  const tFriend = isTablet && { right: htScaled.friendRight - sideMargin, top: Math.round(300 * tsH) + htScaled.friendTop, width: 62 * fScale, height: 62 * fScale };
  const tFriendImg = isTablet ? { width: 62 * fScale, height: 62 * fScale } : null;
  // Desk-scene tablet overrides (identity defaults compose cleanly with base styles).
  const tCharImg = isTablet && { width: 300 * htScaled.charScale, height: 300 * htScaled.charScale };
  // tCharLayer is built lower down (it needs the resolved companion so Cocoa can
  // take an extra downward nudge — see `tCharLayer` near the character render).
  const tDesk = isTablet && { height: `${htScaled.deskHeight}%`, transform: [{ translateY: htScaled.deskY ?? 0 }, { scale: htScaled.deskZoom }] };
  // Hairline (table edge). It gets its OWN vertical nudge (deskEdgeY) so the desk
  // can be dropped independently to meet it, and is scaled out horizontally by the
  // same deskZoom as the desk so the line spans the full (zoomed) desk width — on
  // tablet the desk is scaled wider, so an un-scaled line would stop short.
  const tDeskEdge =
    isTablet && { transform: [{ translateY: htScaled.deskEdgeY ?? 0 }, { scaleX: htScaled.deskZoom }] };
  const tCards = isTablet && { maxWidth: htScaled.cardsWidth, alignSelf: 'center' as const, gap: htScaled.cardsGap ?? 28, marginTop: htScaled.cardsGapTop ?? 0 };
  const tChip = isTablet && { transform: [{ scale: htScaled.hudScale ?? 1 }] };
  const tTopHud = isTablet && { transform: [{ translateY: htScaled.cardsTop }] };
  const tExam = isTablet && { transform: [{ translateY: htScaled.examY ?? 0 }] };
  const tTask = isTablet && { transform: [{ translateY: htScaled.taskY ?? 0 }] };
  const tCardBox = isTablet && { aspectRatio: htScaled.cardRatio ?? 2.6 };
  const cardFont = (sz: number, lh: number) =>
    isTablet ? { fontSize: sz * (htScaled.cardTextScale ?? 1.3), lineHeight: lh * (htScaled.cardTextScale ?? 1.3) } : null;
  // Per-ingredient: shared group shift/scale plus a spread that pushes the outer
  // two apart (idx 0 left, idx 1 centre, idx 2 right) so they don't bunch up.
  const tIngFor = (idx: number) =>
    isTablet && { transform: [{ translateX: htScaled.ingX + (idx - 1) * htScaled.ingSpread }, { translateY: htScaled.ingY }, { scale: htScaled.ingScale }] };
  const tMixer = isTablet && { transform: [{ translateX: htScaled.mixerX }, { translateY: htScaled.mixerY }, { scale: htScaled.mixerScale }] };
  // Tablet: the start button is centered by LAYOUT (full-width row, justified center)
  // so it lands consistently on EVERY tablet width — not a fixed offset that only works
  // on one size. `tStart` keeps just the vertical nudge + scale (no translateX).
  const tStart = isTablet && { transform: [{ translateY: htScaled.startY }, { scale: htScaled.startScale }] };
  // Sit slightly LEFT of center on every tablet: insetting the row's right edge by
  // 2×LEFT_OF_CENTER makes `justifyContent:center` settle the content LEFT_OF_CENTER
  // points left of true center — a constant shift on any width (no scale/size
  // dependence), and the game icon (anchored to this row's 50%) follows along.
  const LEFT_OF_CENTER = 40;
  const tStartRow = isTablet && { left: 0, right: LEFT_OF_CENTER * 2, justifyContent: 'center' as const };
  const tStartInner = isTablet && { marginRight: 0 }; // remove the phone gap so the centered child is truly centered
  // Game icon: anchored to screen center and pushed just past the start button's right
  // edge (the button is 232 wide; half = 116). GAME_GAP keeps it close ("not too far").
  const GAME_GAP = 18;
  const tGame = isTablet && {
    position: 'absolute' as const,
    left: '50%' as const,
    marginLeft: 116 + GAME_GAP,
    top: '50%' as const,
    marginTop: -36, // vertically center the 72-tall icon on the row
  };

  const {
    coins,
    reminderEnabled,
    reminderTime,
    streak,
    todayStreakDay,
    isPlus,
    streakFreezes,
    loginRewardDate,
    starterChosen,
    legalAccepted,
    tutorialSeen,
    markTutorialSeen,
    ambienceId,
    equippedShopItems,
    examCountdowns,
    tasks,
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
    shiftSessionStart,
    selectedFoodId,
    recordSession,
    addSubjectTime,
    dmUnread,
  } = useApp();
  // Any unread friend DM → a red dot on the Home friend button.
  const hasUnreadDM = Object.values(dmUnread ?? {}).some((n) => n > 0);
  const { user } = useAuth();

  // Count of pending friend requests → red badge on the friend button.
  // Refreshed whenever Home regains focus (e.g. after accepting/declining).
  const [pendingRequests, setPendingRequests] = useState(0);

  // Desk mixer + ingredients follow the equipped dessert. The 3 ingredients
  // drop into these 3 fixed desk-slot positions, by index.
  const deskKit = DESK_KITS[selectedFoodId] ?? DESK_KITS[DEFAULT_DESK_FOOD];
  // Phone-scaled ingredient slot styles; tIngFor(idx) overrides on tablet.
  const DESK_SLOT_STYLES = [
    [styles.deskStrawberries, { left: ph.berryLeft, bottom: ph.ingBottom, width: ph.berryW, height: ph.berryH }],
    [styles.deskEggs,         { left: ph.eggsLeft,  bottom: ph.ingBottom, width: ph.eggsW,  height: ph.eggsH  }],
    [styles.deskButter,       { left: ph.butLeft,   bottom: ph.ingBottom, width: ph.butW,   height: ph.butH   }],
  ];
  const studyRoom = useStudyRoom();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [didHomeImageFail, setDidHomeImageFail] = useState(false);
  const handledCompletionId = useRef<string | null>(null);
  // While true, the just-finished session plays its recipe-pop in the study view
  // before we hand off to the finish screen.
  const [finishingSession, setFinishingSession] = useState(false);
  const finishParamsRef = useRef<Record<string, string> | null>(null);
  const [homeFocused, setHomeFocused] = useState(false);
  const [dragSession, setDragSession] = useState<DragSessionData | null>(null);
  // The streak + coin pills are two separate buttons that should always be the same
  // width. Each reports its natural (content-sized) width; we take the larger and
  // force both to it — so they match without stretching full-width, and it adapts to
  // the coin count or translated label. Grow-only, so re-measuring the forced width
  // never feeds back into a loop.
  const [hudChipW, setHudChipW] = useState<number | undefined>(undefined);
  const onHudChipLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setHudChipW((prev) => (prev !== undefined && prev >= w ? prev : w));
  };
  const [droppedIds, setDroppedIds] = useState<Set<DragId>>(new Set());

  // Celebrate the streak ticking up: a quick pop on the chip + flame, and a
  // floating "+1". Driven purely by currentStreak rising (no date math) — fires on
  // increase only, never on reset or the initial mount.
  const streakPop = useRef(new Animated.Value(0)).current;
  const streakPlusY = useRef(new Animated.Value(0)).current;
  const streakPlusOpacity = useRef(new Animated.Value(0)).current;
  const prevStreakRef = useRef(streak.currentStreak);
  useEffect(() => {
    const prev = prevStreakRef.current;
    prevStreakRef.current = streak.currentStreak;
    if (streak.currentStreak <= prev) return;
    streakPop.setValue(0);
    streakPlusY.setValue(0);
    streakPlusOpacity.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(streakPop, { toValue: 1, duration: 240, easing: Easing.out(Easing.back(2.4)), useNativeDriver: true }),
        Animated.timing(streakPop, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(streakPlusOpacity, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.delay(300),
        Animated.timing(streakPlusOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
      Animated.timing(streakPlusY, { toValue: 1, duration: 780, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [streak.currentStreak, streakPop, streakPlusY, streakPlusOpacity]);

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
    // Only run while the idle companion is actually on screen (it unmounts during
    // an active session). Restart whenever it reappears — the native loop doesn't
    // survive the unmount, so without this the bounce is gone after a session.
    if (!activeSession) startBounce();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !activeSession) startBounce();
    });
    return () => {
      sub.remove();
      bounceLoopRef.current?.stop();
    };
  }, [startBounce, activeSession]);
  const charTranslateY = charBounce.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const charScaleY = charBounce.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.02] });
  const charScaleX = charBounce.interpolate({ inputRange: [0, 1], outputRange: [1.02, 0.99] });

  // Mixer bowl centre (approx) — right:-30, bottom:30%, size 285×235. Uses the
  // REAL screen size (not a hardcoded iPhone 393×852) and, on tablet, follows the
  // mixer's dialed offset so the drop zone lands where the mixer actually appears.
  // The scene is capped at MaxContentWidth and centered (safeArea), so on a tablet
  // the desk/mixer sit in a narrower centered column — anchor the drop X to that
  // column's right edge, not the full window, or the target is off by hundreds of
  // px and ingredients never register as dropped. (On phones sceneRight === winW,
  // so this is byte-identical to before.)
  const sceneRight = (winW + Math.min(winW, MaxContentWidth)) / 2;
  const MIXER_CX = sceneRight - 30 - 285 / 2 + 285 * 0.35 + (isTablet ? htScaled.mixerX : 0);
  const MIXER_CY_FROM_TOP = winH * (1 - 0.30) - 235 * 0.55 + (isTablet ? htScaled.mixerY : 0);

  useFocusEffect(useCallback(() => {
    // Track Home focus so the recipe-badge popup waits until the player is back on
    // Home (not over the session-complete screen right after studying).
    setHomeFocused(true);
    // Make sure the idle bounce is running each time Home regains focus.
    startBounce();
    const session = takePendingDragSession();
    if (session) {
      setDragSession(session);
      setDroppedIds(new Set());
    }
    // Refresh the pending friend-request count for the badge.
    let cancelled = false;
    if (user?.id) {
      // Exclude blocked senders from the request badge.
      Promise.all([listIncomingRequests(user.id), listBlocked(user.id)])
        .then(([reqs, blk]) => { if (!cancelled) setPendingRequests(reqs.filter((r) => !blk.includes(r.fromCode)).length); })
        .catch(() => {});
    } else {
      setPendingRequests(0);
    }
    return () => { cancelled = true; setHomeFocused(false); };
  }, [startBounce, user?.id]));


  const handleIngredientDropped = (id: DragId) => {
    setDroppedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      if (next.size === 3) {
        const ds = dragSession;
        setTimeout(() => {
          // Show the loading overlay, then START the session behind it (instead of
          // in onDone). Previously the session only started once the overlay had
          // lifted, so the studying view mounted onto a bare screen and its art
          // popped in. Now the scene mounts and fully renders/decodes its art while
          // the overlay still covers it, so it's ready the instant the loader ends.
          //
          // The session starts with a far-future start time so the timer stays
          // frozen at full duration while the loader plays (getSessionSecondsLeft
          // clamps via sessionNowMs — nothing ticks down behind the overlay). When
          // the overlay lifts (onDone), we snap the start to *now* so the user gets
          // the full duration from the moment they actually see the screen.
          const FROZEN_START = new Date(Date.now() + 3_600_000).toISOString();
          showLoadingScreen(() => {
            if (ds) shiftSessionStart((Date.now() - new Date(FROZEN_START).getTime()) / 1000);
            setDragSession(null);
            setDroppedIds(new Set());
          }, { until: preloadStudyAssets(studyCharacterSource) });
          if (ds) {
            if (ds.moodValue && ds.moodLabel) {
              addMoodEntry({ value: ds.moodValue, label: ds.moodLabel, type: 'before', sessionMinutes: ds.durationMinutes, timestamp: new Date().toISOString() });
            }
            startActiveSession({ durationMinutes: ds.durationMinutes, subjectName: ds.subjectName, taskId: ds.taskId, taskTitle: ds.taskTitle, breakMinutes: ds.breakMinutes, startedAt: FROZEN_START });
          }
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
  // Some companion art reads a touch small next to the others — nudge it up a bit,
  // anchored at the feet so it stays planted on the desk. (Hanji's scale only hits
  // her flat outfit skins; her default animated figure renders down a separate path.)
  const companionScale =
    activeCompanion.type === 'shop' && activeCompanion.id === 'companion_cocoa' ? 1.08
    : activeCompanion.type === 'shop' && activeCompanion.id === 'companion_hanji' ? 1.02
    : activeCompanion.type === 'shop' && activeCompanion.id === 'companion_tira' && companionSkins?.['shop:companion_tira'] === 'afternoontrain' ? 0.92
    : 1;
  // Tablet character layer. Cocoa (every Cocoa skin keeps id `companion_cocoa`)
  // sits higher in her art than the others, so drop her by an extra `cocoaY`.
  const isCocoaCompanion = activeCompanion.type === 'shop' && activeCompanion.id === 'companion_cocoa';
  // Cocoa's art reads tall — nudge every Cocoa skin down a little on phones too
  // (the tablet has its own cocoaY knob above).
  const companionTranslateY = isCocoaCompanion ? 30 : 0;
  const tCharLayer =
    isTablet && { transform: [{ translateY: htScaled.charY + (isCocoaCompanion ? (htScaled.cocoaY ?? 0) : 0) }] };
  const reminderStyle = getReminderStyleEffect(equippedShopItems);
  // Home shows only the soonest still-upcoming exam (today or later). Passed
  // exams are never featured here — if none are upcoming, the card shows its
  // empty "add exam" state rather than a past-due one.
  const featuredExam = [...examCountdowns]
    .filter((exam) => daysUntil(exam.dateISO) >= 0)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO))[0] ?? null;
  // Soonest still-pending task (by due date + time), shown on the home card.
  const nextTask =
    [...tasks]
      .filter((tk) => tk.status !== 'done' && tk.dueDate)
      .sort((a, b) =>
        (a.dueDate! + (a.dueTime ?? '99:99')).localeCompare(b.dueDate! + (b.dueTime ?? '99:99')),
      )[0] ?? null;
  const nextTaskColor =
    (nextTask?.subjectId ? subjects.find((s) => s.id === nextTask.subjectId)?.color : null) ?? '#C9A18A';
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

  // Start Session. Plus members who haven't linked Spotify get a one-tap offer to
  // connect it first (so they can play their own music while studying); everyone
  // else — and anyone already connected — goes straight to the picker.
  const handleStartSession = () => {
    // No Spotify prompt here — Spotify is only offered from the study-room radio
    // while a session is in progress.
    router.push('/session-picker');
  };

  const handleStopSession = () => {
    if (!activeSession) return;

    // Ending early earns NO coins — only finishing a full session does. Warn first.
    showPopup(t('home.stopSessionQ'), t('home.endEarlyNoCoins'), [
      { text: t('home.keepStudying'), style: 'cancel' },
      {
        text: t('common.stop'),
        style: 'destructive',
        onPress: () => {
          const endedSession = activeSession;
          // Play the loading overlay over the study→home transition.
          showLoadingScreen(undefined, { quick: true });
          clearActiveSession();

          // No coins for an early end, but still log the time studied toward
          // streak/stats if they put in a meaningful chunk.
          if (sessionElapsedMinutes >= MIN_MINUTES_FOR_COINS) {
            recordSession(sessionElapsedMinutes);
            addSubjectTime(endedSession.subjectName, sessionElapsedMinutes);
          }
        },
      },
    ]);
  };

  // Force-stop with no confirmation — used when the player leaves the app mid-
  // session and doesn't return within a minute (see StudyRoomView's away timer).
  // Credits the partial time studied, same as a confirmed stop.
  const handleAutoStopAway = () => {
    if (!activeSession) return;
    const endedSession = activeSession;
    showLoadingScreen(undefined, { quick: true });
    clearActiveSession();
    // Leaving mid-session ends it early → no coins (same rule as a manual end),
    // but still log the study time toward streak/stats.
    if (sessionElapsedMinutes >= MIN_MINUTES_FOR_COINS) {
      recordSession(sessionElapsedMinutes);
      addSubjectTime(endedSession.subjectName, sessionElapsedMinutes);
    }
  };

  const handleBreakGame = () => {
    if (!activeSession) return;

    showPopup(t('home.openBreakGameQ'), t('home.openBreakGameMsg'), [
      { text: t('home.keepStudying'), style: 'cancel' },
      {
        text: t('home.breakGameBtn'),
        onPress: () => {
          // Keep the session active (don't clearActiveSession) so the break game is
          // pushed ON TOP of the still-mounted study room. Exiting the game dismisses
          // back to the live session instead of dropping to an ended home screen.
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
      {/* Full-screen room background (behind the safe area) so it bleeds edge to
          edge — under the status bar and down to the bottom. */}
      <Image
        source={bgRoom.backgroundImage}
        style={styles.roomBackground}
        contentFit="cover"
        contentPosition="center"
        pointerEvents="none"
      />
      {/* Soft sunlight shining from the top — kept gentle so the room stays clear */}
      <Image source={SUNLIGHT} style={styles.sunlight} contentFit="cover" pointerEvents="none" />

      {/* The study session is a full-bleed immersive scene (desk + room fill the
          screen), so it must NOT sit inside the 800px centered content column — on a
          wide iPad that column left the desk unable to reach the edges. Drop the cap
          while a session is active; the normal home content keeps it. */}
      <SafeAreaView style={[styles.safeArea, activeSession && { maxWidth: 9999 }]}>
        <View style={styles.scene}>

          {activeSession ? (
            // SafeAreaView (above) already insets the bottom — only add a small gap
            // here, never the full inset again, or the desk gets lifted off the screen
            // edge and the room background shows through underneath it.
            <View style={[styles.studyRoomWrap, { paddingTop: insets.top + 4, paddingBottom: 8 }]}>
              <StudyRoomView
                secondsLeft={sessionSecondsLeft}
                onStop={handleStopSession}
                onAway={handleAutoStopAway}
                onBreakGame={handleBreakGame}
                finishing={finishingSession}
              />
            </View>
          ) : (
            <>
              {!dragSession && <View style={[styles.topHud, tTopHud]}>
                <View style={styles.statusRow}>
                  <View style={styles.streakChipWrap} ref={(n) => setTutorialTarget('streak', n)}>
                    <Animated.View
                      onLayout={onHudChipLayout}
                      style={[styles.statusChip, hudChipW ? { width: hudChipW } : null, { transform: [{ scale: isTablet ? (htScaled.hudScale ?? 1) : 1 }, { scale: streakPop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] }) }] }]}>
                      <Animated.View style={{ transform: [
                        { scale: streakPop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] }) },
                        { rotate: streakPop.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', '-14deg', '8deg'] }) },
                      ] }}>
                        <Image source={STREAK_FIRE_ICON} style={styles.statusStreakIcon} contentFit="contain" accessibilityLabel="" />
                      </Animated.View>
                      <ThemedText type="smallBold" style={styles.statusChipText}>
                        {todayStreakDay} day streak
                      </ThemedText>
                    </Animated.View>
                    <Animated.Text
                      pointerEvents="none"
                      style={[styles.streakPlusOne, {
                        opacity: streakPlusOpacity,
                        transform: [{ translateY: streakPlusY.interpolate({ inputRange: [0, 1], outputRange: [-2, -30] }) }],
                      }]}>
                      +1
                    </Animated.Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/coin-shop')}
                    style={({ pressed }) => pressed && styles.cardPressed}
                    accessibilityLabel={t('home.a11yAddCoins')}>
                    <View onLayout={onHudChipLayout} style={[styles.statusChip, styles.coinChip, hudChipW ? { width: hudChipW } : null, tChip]} ref={(n) => setTutorialTarget('coins', n)}>
                      <CoinIcon size={22} />
                      <ThemedText type="smallBold" style={[styles.statusChipText, styles.coinChipText]}>
                        {coins}
                      </ThemedText>
                      <View style={styles.coinAddBtn}>
                        <ThemedText style={styles.coinAddText}>+</ThemedText>
                      </View>
                    </View>
                  </Pressable>
                </View>

                <View style={[styles.metaRow, tCards]}>
                  <Pressable
                    style={({ pressed }) => [styles.metaCardPressable, tCardBox, tExam, pressed && styles.cardPressed]}
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
                          <ThemedText style={[styles.metaCardTitle, cardFont(15, 19)]}>{t('home.upcomingExam')}</ThemedText>
                        </View>
                      </View>
                      <View style={styles.metaCardContent}>
                        <View style={styles.metaCardTextBlock}>
                          {featuredExam ? (
                            <>
                              <View style={styles.examHeadlineRow}>
                                <CountdownShape shape={featuredExam.shape} size={15} />
                                <ThemedText style={[styles.metaHeadline, styles.examHeadlineText, cardFont(12.5, 14)]} numberOfLines={1}>
                                  {featuredExam.name}
                                </ThemedText>
                              </View>
                              <ThemedText style={[styles.metaSubline, cardFont(10.5, 13)]} numberOfLines={1}>{formatExamDate(featuredExam.dateISO)}</ThemedText>
                              <View style={styles.examCountdownRow}>
                                <ThemedText
                                  style={[
                                    styles.metaAccentText,
                                    examIsUrgent && styles.metaAccentTextUrgent,
                                    examIsPast && styles.metaAccentTextPast,
                                    cardFont(10.5, 13),
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
                              <ThemedText style={[styles.metaHeadline, cardFont(12.5, 14)]}>{t('home.noExamYet')}</ThemedText>
                              <ThemedText style={[styles.metaSubline, cardFont(10.5, 13)]}>{t('home.tapToAdd')}</ThemedText>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.metaCardPressable, tCardBox, tTask, pressed && styles.cardPressed]}
                    onPress={() => router.push(nextTask ? '/tasks' : '/add-task')}>
                    <View style={styles.metaCard}>
                      <View style={styles.metaCardHeader}>
                        <View style={styles.reminderTitleRow}>
                          <Image source={REMINDER_BELL_ICON} style={styles.reminderBellIcon} contentFit="contain" accessibilityLabel="" />
                          <ThemedText style={[styles.metaCardTitle, cardFont(15, 19)]}>{t('home.upcomingTask')}</ThemedText>
                        </View>
                      </View>
                      <View style={styles.metaCardContent}>
                        <View style={styles.metaCardTextBlock}>
                          {nextTask ? (
                            <>
                              <ThemedText style={[styles.metaHeadline, cardFont(12.5, 14)]} numberOfLines={1}>{nextTask.title}</ThemedText>
                              <ThemedText style={[styles.metaSubline, cardFont(10.5, 13)]} numberOfLines={1}>{formatExamDate(nextTask.dueDate!)}</ThemedText>
                              {nextTask.subjectId ? (
                                <View style={styles.examSubjectChip}>
                                  <View style={[styles.examSubjectDot, { backgroundColor: nextTaskColor }]} />
                                  <ThemedText style={styles.examSubjectText} numberOfLines={1}>
                                    {subjects.find((s) => s.id === nextTask.subjectId)?.name}
                                  </ThemedText>
                                </View>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <ThemedText style={[styles.metaHeadline, cardFont(12.5, 14)]}>{t('home.noTaskYet')}</ThemedText>
                              <ThemedText style={[styles.metaSubline, cardFont(10.5, 13)]}>{t('home.tapToAdd')}</ThemedText>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </View>
              </View>}

              {/* Switch character button — top left, below exam card */}
              {!dragSession && (
                <Pressable
                  style={({ pressed }) => [styles.switchCharBtn, { top: ph.btnTops[0], width: ph.szLg, height: ph.szLg }, tBtn(210, 0, 80), pressed && styles.startButtonPressed]}
                  onPress={() => router.push('/companion-gallery')}
                  accessibilityLabel={t('home.a11ySwitchCharacter')}>
                  <Image source={SWITCH_CHARACTER_BTN} style={[styles.switchCharImg, { width: ph.szLg, height: ph.szLg }, tImg(80)]} contentFit="contain" />
                </Pressable>
              )}

              {/* Food menu button — top left, below switch character */}
              {!dragSession && (
                <Pressable
                  style={({ pressed }) => [styles.foodMenuBtn, { top: ph.btnTops[1], width: ph.szLg, height: ph.szLg }, tBtn(292, 1, 80), pressed && styles.startButtonPressed]}
                  onPress={() => router.push('/food-gallery')}
                  accessibilityLabel={t('home.a11yFoodMenu')}>
                  <Image source={FOOD_MENU_BTN} style={[styles.foodMenuImg, { width: ph.szLg, height: ph.szLg }, tImg(80)]} contentFit="contain" />
                </Pressable>
              )}

              {/* Edit Room button — top left, above settings */}
              {!dragSession && (
                <Pressable
                  style={({ pressed }) => [styles.editRoomBtn, { top: ph.btnTops[2], width: ph.szMd, height: ph.szMd }, tBtn(376, 2, 72), pressed && styles.startButtonPressed]}
                  onPress={() => router.push('/edit-room')}
                  accessibilityLabel={t('home.a11yEditRoom')}>
                  <Image source={EDIT_ROOM_BTN} style={[styles.editRoomImg, { width: ph.szMd, height: ph.szMd }, tImg(72)]} contentFit="contain" />
                </Pressable>
              )}

              {/* Settings button — top left, below food menu */}
              {!dragSession && (
                <Pressable
                  style={({ pressed }) => [styles.topSettingsBtn, { top: ph.btnTops[3], width: ph.szMd, height: ph.szMd }, tBtn(452, 3, 72), pressed && styles.startButtonPressed]}
                  onPress={() => router.push('/settings')}
                  accessibilityLabel={t('home.a11yOpenSettings')}>
                  <Image source={SETTINGS_BTN} style={[styles.topSettingsImg, { width: ph.szMd, height: ph.szMd }, tImg(72)]} contentFit="contain" />
                </Pressable>
              )}

              {/* Friend button — right side */}
              {!dragSession && (
                <Pressable
                  style={({ pressed }) => [styles.friendBtn, { top: ph.friendTop, width: ph.szFr, height: ph.szFr }, tFriend, pressed && styles.startButtonPressed]}
                  onPress={() => router.push('/friends')}
                  accessibilityLabel={t('home.a11yFriends')}>
                  <Image source={FRIEND_BTN} style={[styles.friendBtnImg, { width: ph.szFr, height: ph.szFr }, tFriendImg]} contentFit="contain" />
                  {pendingRequests > 0 ? (
                    <View style={[styles.friendReqBadge, isTablet && styles.friendReqBadgeTablet]} pointerEvents="none">
                      <ThemedText style={styles.friendReqBadgeText}>
                        {pendingRequests > 9 ? '9+' : pendingRequests}
                      </ThemedText>
                    </View>
                  ) : hasUnreadDM ? (
                    <View style={[styles.friendDmDot, isTablet && styles.friendDmDotTablet]} pointerEvents="none" />
                  ) : null}
                </Pressable>
              )}

              <View style={[styles.homeCharacterLayer, tCharLayer]} pointerEvents="none">
                <Animated.View
                  style={{ transform: [{ translateY: charTranslateY }, { scaleX: charScaleX }, { scaleY: charScaleY }] }}>
                  {hanjiIsAnimated(activeCompanionId, companionSkins?.[activeCompanionId ?? '']) ? (
                    <HanjiFigure style={[styles.homeCharacterImage, tCharImg]} />
                  ) : (
                    <RNImage
                      source={homeCompanionSource}
                      style={[styles.homeCharacterImage, tCharImg, (companionScale !== 1 || companionTranslateY !== 0) && { transform: [{ translateY: companionTranslateY }, { scale: companionScale }], transformOrigin: 'center bottom' }]}
                      resizeMode="contain"
                    />
                  )}
                </Animated.View>
              </View>

              {/* Desk surface — top edge fixed at 53%; bleeds past the bottom safe-area
                  inset so the desk (not the room background) fills the very bottom strip. */}
              <RNImage
                source={deskRoom.deskImage}
                style={[styles.deskNewLayer, tDesk, { bottom: -insets.bottom }, deskRoom.deskTint ? { backgroundColor: deskRoom.deskTint } : null]}
                resizeMode={deskRoom.deskFit ?? 'cover'}
                pointerEvents="none"
              />
              {/* A hairline along the desk's top edge so it reads as a table edge
                  instead of a hard cut. Shares the desk's exact geometry (same
                  height + bottom inset) so its top border sits right on the edge. */}
              <View style={[styles.deskTopEdge, { bottom: -insets.bottom }, tDeskEdge]} pointerEvents="none" />
              {/* Mixer on desk — matches the equipped dessert */}
              <RNImage source={deskKit.mixer} style={[styles.deskMixer, { width: ph.mixerW, height: ph.mixerH }, deskKit.mixerStyle, tMixer]} resizeMode="contain" pointerEvents="none" />

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
                        style={[...DESK_SLOT_STYLES[idx], ing.style]}
                        baseX={isTablet ? htScaled.ingX + (idx - 1) * htScaled.ingSpread : 0}
                        baseY={isTablet ? htScaled.ingY : 0}
                        baseScale={isTablet ? htScaled.ingScale : 1}
                        dropRadius={isTablet ? 160 : 100}
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
                </>
              ) : (
                <>
                  {deskKit.ingredients.map((ing, idx) => (
                    <RNImage key={ing.id} source={ing.src} style={[...DESK_SLOT_STYLES[idx], ing.style, tIngFor(idx)]} resizeMode="contain" />
                  ))}
                </>
              )}

              {!dragSession && <View style={[styles.startSessionPressable, { bottom: 155 }, tStart, tStartRow]}>
                <View ref={(n) => setTutorialTarget('start', n)}>
                  <SoundPressable
                    style={({ pressed }) => [styles.startSessionInner, tStartInner, pressed && styles.startButtonPressed]}
                    onPress={handleStartSession}
                    accessibilityLabel={t('home.a11yStartSession')}>
                    <Image source={START_SESSION_BTN} style={styles.startSessionBg} contentFit="fill" />
                    <ThemedText style={styles.startSessionLabel}>{t('home.startSession')}</ThemedText>
                  </SoundPressable>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.settingsFloating, styles.gameFloating, tGame, pressed && styles.startButtonPressed]}
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
      {homeFocused && <RecipeBadgeModal />}
      {homeFocused && <DailyRewardModal />}
      {homeFocused && <BirthdayRewardModal />}
      {/* First-launch coachmark tour — only after onboarding, and only once the
          daily-reward popup is out of the way (so the two never stack). Replaying
          it from Settings just flips tutorialSeen back off. */}
      {homeFocused && legalAccepted && starterChosen && !tutorialSeen &&
        !nextLoginReward({ loginRewardDate, streak, isPlus, streakFreezes }, todayISO()).available && (
          <HomeTutorial onDone={markTutorialSeen} />
        )}
      <DevKnobs screen="home" knobs={homeKnobs} onChange={(key, value) => setDialed((p) => ({ ...p, [key]: value }))} />
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
    zIndex: 5,
  },
  switchCharImg: {},
  foodMenuBtn: {
    position: 'absolute',
    left: 4,
    zIndex: 5,
  },
  foodMenuImg: {},
  topSettingsBtn: {
    position: 'absolute',
    left: 4,
    zIndex: 5,
  },
  topSettingsImg: {},
  editRoomBtn: {
    position: 'absolute',
    left: 4,
    zIndex: 5,
  },
  editRoomImg: {},
  friendBtn: {
    position: 'absolute',
    right: 12,
    zIndex: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendBtnImg: {},
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
  // Plain red dot (no count) for unread friend DMs.
  friendDmDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FF4D5E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  friendReqBadgeTablet: { right: 16, bottom: 4 },
  friendDmDotTablet: { right: 16, bottom: 4 },
  friendReqBadgeText: { color: '#FFFFFF', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  gameFloating: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
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
    // overflow stays visible so the desk surface can bleed past the bottom
    // safe-area inset down to the screen edge (see deskNewLayer).
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
  },
  deskMixer: {
    position: 'absolute',
    right: -48,
    bottom: '30%',
    zIndex: 3,
  },
  deskStrawberries: {
    position: 'absolute', zIndex: 10,
  },
  deskEggs: {
    position: 'absolute', zIndex: 10,
  },
  deskButter: {
    position: 'absolute', zIndex: 10,
  },
  deskNewLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '54%',
    zIndex: 2,
  },
  // Hairline on the desk's top edge. Must mirror deskNewLayer's height so its top
  // border lands exactly on the desk's top edge (keep the height in sync).
  deskTopEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: '54%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(120, 90, 70, 0.45)',
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
  // Wrapper holds the streak chip + the floating "+1" (which must sit OUTSIDE the
  // chip's `overflow: hidden`). No clipping here so the +1 can rise above the chip.
  streakChipWrap: { position: 'relative' },
  streakPlusOne: {
    position: 'absolute',
    top: -6,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '900',
    color: '#F2683C',
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  examHeadlineRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  examHeadlineText: { flexShrink: 1 },
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
    left: 60,
    right: Spacing.two,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  startSessionInner: {
    marginRight: 10,
    // 232 / 66 ≈ 3.51 — matches the button image's native ratio so 'fill' doesn't squish it.
    width: 232,
    height: 66,
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
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
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
