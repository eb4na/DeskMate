// Cake Kitchen mini-game — Wave 0 (Tiny Kitchen Skeleton).
// Mode select + a placeholder top-down kitchen with static station boxes and an
// emoji character. No movement, scoring, timers, or cooking loop yet — those
// arrive in later waves.

import { Image } from 'expo-image';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BakeryCakeEmoji, BakeryHeartEmoji, BakeryReceiptEmoji } from '@/components/bakery-emoji';
import { BaseIcon, CakeBuildIcon, CakeIngredientIcon, type IngredientKind } from '@/components/cake-ingredients';
import { useApp } from '@/context/app-context';
import { joinGameRoom, type GameRoom } from '@/lib/game-net';
import {
  NAV_DEBUG,
  obstaclesPx,
  walkBounds,
  findPath,
  resolveClick,
  stationTarget,
  type NavPt as NavPoint,
  type Obstacle,
} from '@/game/cake/nav';
import { BakeryColors, BakeryRadii, BakeryShadow, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  BASES,
  FILLINGS,
  MODE_META,
  STATIONS,
  TOPPINGS,
  createInitialPlayer,
  findBase,
  findFilling,
  findTopping,
} from '@/game/cake/gameData';
import { cakeMatchesOrder, generateStarterOrder } from '@/game/cake/gameLogic';
import type {
  CakeBase,
  CakeFilling,
  CakeOrder,
  CakeTopping,
  Cooker,
  GameMode,
  HeldItem,
  IngredientDef,
  PlayerState,
  Station,
} from '@/game/cake/gameTypes';

type FeedbackKind = 'ok' | 'warn' | 'bad';
type Feedback = { text: string; kind: FeedbackKind; id: number };
type PickerKind = 'base' | 'filling' | 'topping';
type RoundPhase = 'playing' | 'results';
type Mood = 'idle' | 'happy' | 'excited' | 'sad';

// True once a mixer/oven job has finished and is waiting to be collected.
const cookerReady = (c: Cooker) => Date.now() >= c.startedAt + c.durationMs;
const cookerProgress = (c: Cooker) => Math.min(1, (Date.now() - c.startedAt) / c.durationMs);

// Wait times for the timed stations (tunable).
const MIX_MS = 2500;
const BAKE_MS = 3800;

// Cake Rush tuning.
const ROUND_SECONDS = 430; // "6:70" timed round (6 min + 70 sec)
const FAST_SERVE_MS = 16000; // serve within 16s of the order for a speed bonus
const ACTIVE_ORDERS = 2; // orders on screen at once
const SCORE_CORRECT = 100;
const SCORE_FAST = 25;
const SCORE_COMBO = 50; // every 3rd correct serve in a row
const SCORE_WRONG = -20;

// Customer Line tuning. Generous on purpose: the start is easy and the patience
// floor stays above the time it takes to make a cake, so it's always beatable.
const START_HEARTS = 3;
const PATIENCE_START_MS = 32000; // 32s at the start — very forgiving
const PATIENCE_FLOOR_MS = 20000; // never drops below 20s, so a cake is always makeable
const PATIENCE_DECAY_PER_SEC = 20; // shrinks slowly over the round
const LINE_MAX_ORDERS = 4; // how many customers can wait at once (grows slowly)
// Active customers over time: 2 → 3 (~1min) → 4 (~2min). Eases the player in.
const lineTargetOrders = (elapsedSec: number) => Math.min(LINE_MAX_ORDERS, 2 + Math.floor(elapsedSec / 60));

// Coins awarded per round = score / this (then clamped by the app's daily cap).
const SCORE_PER_COIN = 100;

const KITCHEN_BG = require('@/assets/images/cake/kitchen-bg.png');
const COUNTER_IMG = require('@/assets/images/cake/counter.png');
const COUNTER_ASPECT = 820 / 225;
const LEFT_COUNTER_IMG = require('@/assets/images/cake/left-counter.png');
const LEFT_COUNTER_ASPECT = 520 / 860;
const MIXER_ASPECT = 300 / 422;
const OVEN_TABLE_IMG = require('@/assets/images/cake/oven-table.png');
const OVEN_TABLE_ASPECT = 520 / 213;
const OVEN_APP_ASPECT = 260 / 280;
const STATUS_BAR_IMG = require('@/assets/images/cake/status-bar.png');

// Stations temporarily hidden while their art is redesigned (gameplay code kept).
// 'ingredient' is hidden because the new left-counter art (with its own tap zone)
// covers it.
const HIDDEN_STATION_KINDS = new Set<Station['kind']>([
  'ingredient',
  'oven',
  'mixer',
  'assembly',
  'decoration',
  'trash',
]);
const SHELF_IMG = require('@/assets/images/cake/station-shelf.png');
const CUSTOMER_IMG = require('@/assets/images/bunny/bunny.png');

// ── Kitchen navigation geometry ───────────────────────────────────────────────
// Kitchen geometry: where each table/machine sits and a "stand" point in front of
// each station, so tapping a station walks the cat to its *visible* location. All
// rects/points are PIXELS relative to the kitchen (w × h). Keep these literals in
// sync with the render IIFEs (they consume kitchenLayout too).
type NavRect = { x0: number; y0: number; x1: number; y1: number };
type NavPt = { x: number; y: number };

const WALK_SPEED = 0.2; // px per ms — constant walking pace (so it doesn't zoom)

const pctToPx = (p: NavPt, w: number, h: number): NavPt => ({ x: (p.x / 100) * w, y: (p.y / 100) * h });
const pxToPct = (p: NavPt, w: number, h: number): NavPt => ({ x: (p.x / w) * 100, y: (p.y / h) * 100 });

// Visible tables/machines + a "stand" point in front of each station.
function kitchenLayout(w: number, h: number) {
  // Front serving counter across the top.
  const counterTop = 0.11 * h;
  const counterH = w / COUNTER_ASPECT;
  const counterBottom = counterTop + counterH;

  // Left counter (ingredients + 3 mixers). Container aspect == image aspect, so
  // contentFit="contain" fills the rect exactly (no letterbox).
  const lcLeft = -0.07 * w;
  const lcTop = 0.35 * h;
  const lcW = 0.54 * w;
  const lcH = lcW / LEFT_COUNTER_ASPECT;
  const leftCounter: NavRect = { x0: lcLeft, y0: lcTop, x1: lcLeft + lcW, y1: lcTop + lcH };
  const mixerSlots = [0.24, 0.53, 0.82];
  const mixerSlotY = 0.66;

  // Oven table (right) with 3 ovens.
  const ovenW = 0.6 * w;
  const ovenH = ovenW / OVEN_TABLE_ASPECT;
  const tableLeft = 1.06 * w - ovenW;
  const tableTop = 0.38 * h - ovenH / 2;
  const ovenTable: NavRect = { x0: tableLeft, y0: tableTop, x1: tableLeft + ovenW, y1: tableTop + ovenH };
  const ovenSlots = [0.15, 0.44, 0.73];

  // Right-side stacked tables: assembly / decorate / trash.
  const rightCenterX = 0.87 * w;
  const pieceW = 0.36 * w;
  const rightDefs: Record<string, { cy: number; aspect: number }> = {
    assembly: { cy: 0.55, aspect: 320 / 254 },
    decoration: { cy: 0.71, aspect: 320 / 265 },
    trash: { cy: 0.87, aspect: 320 / 250 },
  };
  const rightRects: Record<string, NavRect> = {};
  for (const k of Object.keys(rightDefs)) {
    const ph = pieceW / rightDefs[k].aspect;
    const cy = rightDefs[k].cy * h;
    rightRects[k] = { x0: rightCenterX - pieceW / 2, y0: cy - ph / 2, x1: rightCenterX + pieceW / 2, y1: cy + ph / 2 };
  }

  // Stand points: approach the left counter from the right, the oven table from
  // Each station's center ON its table. Tapping a station targets this point; the
  // edge-stop logic then walks the cat to the table edge facing its approach, so
  // it ends up standing next to that station without climbing onto the table.
  const rc = (r: NavRect): NavPt => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });
  const centers: Record<string, NavPt> = {
    ingredient: { x: lcLeft + 0.3 * lcW, y: lcTop + 0.21 * lcH },
    mixer1: { x: lcLeft + mixerSlots[0] * lcW, y: lcTop + mixerSlotY * lcH },
    mixer2: { x: lcLeft + mixerSlots[1] * lcW, y: lcTop + mixerSlotY * lcH },
    mixer3: { x: lcLeft + mixerSlots[2] * lcW, y: lcTop + mixerSlotY * lcH },
    oven1: { x: tableLeft + ovenSlots[0] * ovenW, y: tableTop + 0.5 * ovenH },
    oven2: { x: tableLeft + ovenSlots[1] * ovenW, y: tableTop + 0.5 * ovenH },
    oven3: { x: tableLeft + ovenSlots[2] * ovenW, y: tableTop + 0.5 * ovenH },
    assembly: rc(rightRects.assembly),
    decoration: rc(rightRects.decoration),
    trash: rc(rightRects.trash),
  };

  return { counterTop, counterH, counterBottom, leftCounter, ovenTable, rightRects, centers };
}

// How long the cat takes to walk a path (percent waypoints) from a start, at a
// constant pace — used so the station action fires when it actually arrives.
function pathDurationMs(fromPct: NavPt, path: NavPt[], w: number, h: number): number {
  let prev = pctToPx(fromPct, w, h);
  let total = 0;
  for (const wp of path) {
    const p = pctToPx(wp, w, h);
    total += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return Math.max(150, total / WALK_SPEED);
}

// Bunny customers: arrive → greet countdown → (greeted) order countdown → serve
// or leave angry. At most MAX_CUSTOMERS at a time.
type Customer = {
  id: string;
  order: CakeOrder;
  greeted: boolean;
  spawnAt: number; // when the bunny arrived (greet countdown start)
  greetedAt: number; // when the order was taken (order countdown start)
};
const MAX_CUSTOMERS_SOLO = 2;
const MAX_CUSTOMERS_MULTI = 10; // up to 3 players → up to 10 bunnies
const GREET_MS = 18000; // time to greet a newly-arrived bunny before it leaves
const ORDER_PATIENCE_MS = 48000; // time to fill an order before the bunny gets angry
const SPAWN_GAP_MS = 5000; // minimum gap between bunnies arriving
let custCounter = 0;
const makeCustomer = (): Customer => {
  custCounter += 1;
  return { id: `cust-${custCounter}`, order: generateStarterOrder(), greeted: false, spawnAt: Date.now(), greetedAt: 0 };
};
const custGreetLeft = (c: Customer) => Math.max(0, 1 - (Date.now() - c.spawnAt) / GREET_MS);
const custOrderLeft = (c: Customer) => Math.max(0, 1 - (Date.now() - c.greetedAt) / ORDER_PATIENCE_MS);

// Playable characters. `ownedItem` is the shop item the user must own to use it
// (null = always available).
const CHARACTERS: { id: string; name: string; img: number; ownedItem: string | null }[] = [
  { id: 'bun', name: 'Bun', img: require('@/assets/images/cake/bun.png'), ownedItem: null },
  { id: 'cocoa', name: 'Cocoa', img: require('@/assets/images/cake/cocoa.png'), ownedItem: 'companion_cocoa' },
  { id: 'bunny', name: 'Bunny', img: require('@/assets/images/cake/bunny.png'), ownedItem: 'companion_bunny' },
];
const characterImg = (id: string) => (CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]).img;
const PLAYER_AVATAR = require('@/assets/images/cake/player.png');
const TOGETHER_IMG = require('@/assets/images/cake/player-together.png');
const TIMER_ICON = require('@/assets/images/cake/timer-icon.png');
const INFINITY_ICON = require('@/assets/images/cake/infinity-icon.png');
// Offsets for the layered white outline behind the BatterDash logo text.
const LOGO_OUTLINE = [
  [-3, 0],
  [3, 0],
  [0, -3],
  [0, 3],
  [-2.2, -2.2],
  [2.2, -2.2],
  [-2.2, 2.2],
  [2.2, 2.2],
] as const;

// Station artwork. Mixer/oven have an "empty" and a "full" (something inside) look.
const STATION_IMG = {
  ingredient: require('@/assets/images/cake/ingredients.png'),
  assembly: require('@/assets/images/cake/assembly.png'),
  decoration: require('@/assets/images/cake/decorate.png'),
  mixerEmpty: require('@/assets/images/cake/mixer-empty.png'),
  mixerFull: require('@/assets/images/cake/mixer-full.png'),
  ovenEmpty: require('@/assets/images/cake/oven-empty.png'),
  ovenFull: require('@/assets/images/cake/oven-full.png'),
  trash: require('@/assets/images/cake/trash.png'),
} as const;

function stationImage(kind: Station['kind'], hasContent: boolean) {
  switch (kind) {
    case 'ingredient':
      return STATION_IMG.ingredient;
    case 'assembly':
      return STATION_IMG.assembly;
    case 'decoration':
      return STATION_IMG.decoration;
    case 'trash':
      return STATION_IMG.trash;
    case 'mixer':
      return hasContent ? STATION_IMG.mixerFull : STATION_IMG.mixerEmpty;
    case 'oven':
      return hasContent ? STATION_IMG.ovenFull : STATION_IMG.ovenEmpty;
    default:
      return null;
  }
}

const makeOrder = (): CakeOrder => ({ ...generateStarterOrder(), createdAt: Date.now() });

// Fake helper characters (local-only, for testing the multiplayer-ready render).
// Real players would come from a synced array later; the rendering already
// supports any number of players.
// Multiplayer is up to 3 players → two helper bakers.
const HELPER_DEFS = [
  { id: 'h1', name: 'Mochi', color: '#7FA7E6', face: '🐻', x: 32, y: 50 },
  { id: 'h2', name: 'Pudding', color: '#86C28B', face: '🐰', x: 68, y: 50 },
] as const;

function makeHelpers(): PlayerState[] {
  return HELPER_DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    x: d.x,
    y: d.y,
    targetX: d.x,
    targetY: d.y,
    currentStation: null,
    heldItem: null,
    currentAction: null,
    color: d.color,
  }));
}

// A Customer Line order whose patience shortens the longer the round runs.
const makeLineOrder = (elapsedSec: number): CakeOrder => ({
  ...generateStarterOrder(),
  createdAt: Date.now(),
  patienceMs: Math.max(PATIENCE_FLOOR_MS, PATIENCE_START_MS - elapsedSec * PATIENCE_DECAY_PER_SEC),
});

export default function CakeGameScreen() {
  const params = useLocalSearchParams<{ mode?: string; room?: string; role?: string; netmode?: string }>();
  const initialMode: GameMode | null = params.mode === 'rush' || params.mode === 'line' ? params.mode : null;
  const navigation = useNavigation();

  // Friend race — auto-start a timed match synced to the friend's game.
  const online = params.netmode === 'race' && params.room
    ? { room: params.room, isHost: params.role === 'host' }
    : null;

  const [started, setStarted] = useState(!!online);
  const [crew, setCrew] = useState<'solo' | 'multi'>('solo');
  const [timed, setTimed] = useState(true);

  // Exit all the way back to Home, no matter how the game was reached
  // (Home → break-game → cake-game, or a direct deep link). First clear any
  // pushed game screens (no-op if there are none), then guarantee Home is shown.
  const goHome = () => {
    const nav = navigation as unknown as { popToTop?: () => void };
    try {
      nav.popToTop?.();
    } catch {}
    router.replace('/');
  };

  // Flow: one setup screen (players + timed/untimed) → play.
  if (started) {
    return (
      <KitchenView
        mode={online ? 'rush' : timed ? 'rush' : 'line'}
        multiplayer={crew === 'multi'}
        online={online ?? undefined}
        onBack={() => (online ? goHome() : setStarted(false))}
        onHome={goHome}
      />
    );
  }

  return (
    <SetupScreen
      crew={crew}
      setCrew={setCrew}
      timed={timed}
      setTimed={setTimed}
      onStart={() => setStarted(true)}
      onHome={goHome}
    />
  );
}

function SetupScreen({
  crew,
  setCrew,
  timed,
  setTimed,
  onStart,
  onHome,
}: {
  crew: 'solo' | 'multi';
  setCrew: (c: 'solo' | 'multi') => void;
  timed: boolean;
  setTimed: (t: boolean) => void;
  onStart: () => void;
  onHome: () => void;
}) {
  const { friendCode, cakeCharacter, setCakeCharacter, ownedShopItems } = useApp();
  const myCharacters = CHARACTERS.filter((c) => c.ownedItem === null || ownedShopItems.includes(c.ownedItem));

  // Back to the game list if possible, otherwise straight home.
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else onHome();
  };

  const invite = async () => {
    try {
      await Share.share({
        message: `Come bake with me on Memobun! 🎂 Add me with friend code ${friendCode} and join my Cake Kitchen.`,
      });
    } catch {
      Alert.alert('Your friend code', friendCode);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.setupSafeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.setupScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.setupTopBar}>
          <Pressable
            hitSlop={14}
            onPress={goBack}
            style={({ pressed }) => [styles.setupBackBtn, pressed && styles.pressed]}>
            <Text style={styles.setupBackText}>‹ Back</Text>
          </Pressable>
        </View>
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            {LOGO_OUTLINE.map((o, i) => (
              <Text key={i} style={[styles.logoStroke, { transform: [{ translateX: o[0] }, { translateY: o[1] }] }]}>
                BatterDash
              </Text>
            ))}
            <Text style={styles.logoFill}>
              <Text style={styles.logoBatter}>Batter</Text>
              <Text style={styles.logoDash}>Dash</Text>
            </Text>
          </View>
          <Text style={styles.subtitle}>Set up your game</Text>
        </View>

        {/* Character */}
        <Text style={styles.setupLabel}>Character</Text>
        <View style={styles.charRow}>
          {myCharacters.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCakeCharacter(c.id)}
              style={({ pressed }) => [styles.charCard, cakeCharacter === c.id && styles.choiceCardActive, pressed && styles.pressed]}>
              <Image source={c.img} style={styles.charImg} contentFit="contain" />
              <Text style={styles.choiceTitle}>{c.name}</Text>
            </Pressable>
          ))}
        </View>

        {/* Players */}
        <Text style={styles.setupLabel}>Players</Text>
        <View style={styles.choiceRow}>
          <ChoiceCard imgs={[PLAYER_AVATAR]} title="Solo" sub="Just you" active={crew === 'solo'} onPress={() => setCrew('solo')} />
          <ChoiceCard imgs={[TOGETHER_IMG]} wideImg title="Together" sub="With a friend" active={crew === 'multi'} onPress={() => setCrew('multi')} />
        </View>
        {crew === 'multi' && (
          <Pressable style={({ pressed }) => [styles.inviteBtn, pressed && styles.pressed]} onPress={invite}>
            <Text style={styles.inviteBtnText}>＋ Invite a friend</Text>
          </Pressable>
        )}

        {/* Mode */}
        <Text style={styles.setupLabel}>Mode</Text>
        <View style={styles.choiceRow}>
          <ChoiceCard imgs={[TIMER_ICON]} iconFit title="Timed" sub="6:70 · instant cook" active={timed} onPress={() => setTimed(true)} />
          <ChoiceCard imgs={[INFINITY_ICON]} iconFit title="Untimed" sub="Endless · 3 hearts" active={!timed} onPress={() => setTimed(false)} />
        </View>

        <Pressable style={({ pressed }) => [styles.doneBtn, styles.secondaryBtnWide, pressed && styles.pressed]} onPress={onStart}>
          <Text style={styles.doneBtnText}>Start baking 🎂</Text>
        </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ChoiceCard({
  emoji,
  imgs,
  iconFit,
  wideImg,
  title,
  sub,
  active,
  onPress,
}: {
  emoji?: string;
  imgs?: number[];
  iconFit?: boolean;
  wideImg?: boolean;
  title: string;
  sub: string;
  active: boolean;
  onPress: () => void;
}) {
  const imgStyle = iconFit ? styles.choiceIcon : wideImg ? styles.choiceImgWide : styles.choiceImg;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.choiceCard, active && styles.choiceCardActive, pressed && styles.pressed]}>
      {imgs ? (
        <View style={styles.choiceImgRow}>
          {imgs.map((im, i) => (
            <Image key={i} source={im} style={imgStyle} contentFit="contain" />
          ))}
        </View>
      ) : (
        <Text style={styles.choiceEmoji}>{emoji}</Text>
      )}
      <Text style={styles.choiceTitle}>{title}</Text>
      <Text style={styles.choiceSub}>{sub}</Text>
    </Pressable>
  );
}

function KitchenView({
  mode,
  multiplayer,
  online,
  onBack,
  onHome,
}: {
  mode: GameMode;
  multiplayer: boolean;
  online?: { room: string; isHost: boolean };
  onBack: () => void;
  onHome: () => void;
}) {
  const { cakeBestRush, cakeBestLine, recordCakeBest, addCoins, cakeCharacter } = useApp();
  const raceRoom = useRef<GameRoom | null>(null);
  const [oppScore, setOppScore] = useState(0);
  const [oppFinal, setOppFinal] = useState<number | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [navDebug, setNavDebug] = useState<{ click: NavPoint; dest: NavPoint; path: NavPoint[] } | null>(null);
  // Players are kept in an array even though there is one local player, so
  // multiplayer can be added later without reshaping the render.
  const [players, setPlayers] = useState<PlayerState[]>(() => [createInitialPlayer()]);
  const [helpers, setHelpers] = useState<PlayerState[]>(() => (multiplayer ? makeHelpers() : []));
  const [held, setHeld] = useState<HeldItem | null>(null);
  const isRush = mode === 'rush';
  const isLine = mode === 'line';
  const [customers, setCustomers] = useState<Customer[]>(() => [makeCustomer()]);
  const lastSpawn = useRef(Date.now());
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  // Each mixer/oven instance holds its job (by station id) while it cooks, so
  // the player can drop an item, walk away, and collect it later.
  const [cookers, setCookers] = useState<Record<string, Cooker>>({});
  const [mood, setMood] = useState<Mood>('idle');
  const active = players[0];

  // Round state (shared by both modes)
  const [phase, setPhase] = useState<RoundPhase>('playing');
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS); // Cake Rush
  const [hearts, setHearts] = useState(START_HEARTS); // Customer Line
  const [tick, setTick] = useState(0); // drives patience bars / expiry checks
  const [score, setScore] = useState(0);
  const [cakesMade, setCakesMade] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);

  // Refs let the (timed) arrival handler read the latest state synchronously.
  const heldRef = useRef(held);
  heldRef.current = held;
  const customersRef = useRef(customers);
  customersRef.current = customers;
  const cookersRef = useRef(cookers);
  cookersRef.current = cookers;
  const phaseRef = useRef<RoundPhase>(phase);
  phaseRef.current = phase;
  const comboRef = useRef(combo);
  comboRef.current = combo;
  const scoreRef = useRef(score);
  scoreRef.current = score;

  // ── Friend race sync ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!online) return;
    raceRoom.current = joinGameRoom(online.room, online.isHost, {
      onMessage: (type, data) => {
        if (type === 'score') setOppScore((data as { s: number }).s);
        else if (type === 'final') setOppFinal((data as { s: number }).s);
      },
      onPresence: () => {},
    });
    return () => raceRoom.current?.leave();
  }, [online]);

  useEffect(() => {
    if (online) raceRoom.current?.send('score', { s: score });
  }, [online, score]);

  useEffect(() => {
    if (online && phase === 'results') raceRoom.current?.send('final', { s: scoreRef.current });
  }, [online, phase]);
  const arriveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fbId = useRef(0);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameStart = useRef(Date.now());
  const timedOutIds = useRef<Set<string>>(new Set());
  // Which player (if any) currently holds each station — prevents two players
  // from starting the same mixer/oven job at once (multiplayer-ready).
  const lockedStations = useRef<Record<string, string>>({});
  const elapsedSec = () => (Date.now() - gameStart.current) / 1000;

  // Fake helpers wander between stations (skipping ones a player has locked).
  useEffect(() => {
    if (helpers.length === 0 || phase !== 'playing') return;
    const id = setInterval(() => {
      setHelpers((prev) =>
        prev.map((h) => {
          const open = STATIONS.filter((s) => !lockedStations.current[s.id] || lockedStations.current[s.id] === h.id);
          const s = open[Math.floor(Math.random() * open.length)] ?? STATIONS[0];
          return { ...h, targetX: s.x, targetY: s.y, currentStation: s.id };
        }),
      );
    }, 2200);
    return () => clearInterval(id);
  }, [helpers.length, phase]);

  // End-of-round payout: save the best score and credit coins (the app's
  // addCoins enforces a daily cap, so rounds can't be farmed for infinite coins).
  // Runs once per round because the calling effects flip phase to 'results'.
  const finishRound = (m: 'rush' | 'line') => {
    const sc = scoreRef.current;
    recordCakeBest(m, sc);
    const earned = Math.floor(sc / SCORE_PER_COIN);
    if (earned > 0) addCoins(earned);
  };

  useEffect(() => () => {
    if (arriveTimer.current) clearTimeout(arriveTimer.current);
    if (fbTimer.current) clearTimeout(fbTimer.current);
    if (moodTimer.current) clearTimeout(moodTimer.current);
  }, []);

  // Cake Rush countdown — ticks once per second, ends the round exactly once.
  useEffect(() => {
    if (!isRush || phase !== 'playing') return;
    if (secondsLeft <= 0) {
      finishRound('rush');
      setPhase('results');
      return;
    }
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
    // finishRound is stable enough; omit to avoid re-running the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRush, phase, secondsLeft]);

  // A steady tick drives the customer greet/order countdowns + cooker bars.
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [phase]);

  // Each tick: retire bunnies whose greet/order countdown ran out, and spawn
  // new ones up to MAX_CUSTOMERS.
  useEffect(() => {
    if (phase !== 'playing') return;
    const now = Date.now();
    let leftAngry = 0; // greeted bunnies whose order timed out (a real miss)
    const keep = customersRef.current.filter((c) => {
      if (timedOutIds.current.has(c.id)) return false;
      if (!c.greeted) {
        // not greeted in time → leaves quietly (you missed them)
        if (now - c.spawnAt >= GREET_MS) {
          timedOutIds.current.add(c.id);
          return false;
        }
      } else if (now - c.greetedAt >= ORDER_PATIENCE_MS) {
        // order took too long → bunny gets angry and leaves
        timedOutIds.current.add(c.id);
        leftAngry += 1;
        return false;
      }
      return true;
    });

    let next = keep;
    if (next.length !== customersRef.current.length) {
      // someone left
      if (leftAngry > 0) {
        flashMood('sad');
        popup('Bunny left angry! 😾💔', 'bad');
        if (isLine) setHearts((h) => Math.max(0, h - leftAngry));
        else setCombo(0);
      }
    }
    // Spawn a new bunny if there's room and enough time has passed.
    const maxCustomers = multiplayer ? MAX_CUSTOMERS_MULTI : MAX_CUSTOMERS_SOLO;
    if (next.length < maxCustomers && now - lastSpawn.current >= SPAWN_GAP_MS) {
      lastSpawn.current = now;
      next = [...next, makeCustomer()];
    }
    if (next !== keep || next.length !== customersRef.current.length) {
      setCustomers(next);
    }
    // popup/flashMood are stable; omitted to avoid a TDZ in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, phase, isLine]);

  // Customer Line: game over when hearts run out (exactly once).
  useEffect(() => {
    if (isLine && phase === 'playing' && hearts <= 0) {
      finishRound('line');
      setPhase('results');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearts, isLine, phase]);

  // Greet a newly-arrived bunny → take their order (starts the order countdown).
  const greetCustomer = (id: string) => {
    if (phaseRef.current !== 'playing') return;
    setCustomers((prev) => prev.map((c) => (c.id === id && !c.greeted ? { ...c, greeted: true, greetedAt: Date.now() } : c)));
    popup('Order taken! 📝', 'ok');
    // Slide the cat over to the counter to take the order.
    const counter = STATIONS.find((s) => s.kind === 'counter');
    if (counter) {
      if (arriveTimer.current) clearTimeout(arriveTimer.current);
      setPlayers((prev) =>
        prev.map((p) => (p.id === active.id ? { ...p, targetX: counter.x, targetY: counter.y, currentStation: null } : p)),
      );
    }
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  // A short floating popup (Ready / Correct / Wrong …).
  const popup = useCallback((text: string, kind: FeedbackKind) => {
    fbId.current += 1;
    setFeedback({ text, kind, id: fbId.current });
    if (fbTimer.current) clearTimeout(fbTimer.current);
    fbTimer.current = setTimeout(() => setFeedback(null), 1300);
  }, []);

  // Briefly change the cat's face, then settle back to idle.
  const flashMood = useCallback((m: Mood) => {
    setMood(m);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood('idle'), 1200);
  }, []);

  // Drop an item into the mixer/oven and walk away — it cooks on its own and
  // is collected later. The station "holds" the item (lockedStations) so other
  // players can't use it meanwhile.
  // Drop an item into a specific mixer/oven instance; it cooks on its own.
  const dropIntoCooker = useCallback((stationId: string, base: CakeBase, durationMs: number) => {
    lockedStations.current[stationId] = 'you';
    setCookers((prev) => ({ ...prev, [stationId]: { base, startedAt: Date.now(), durationMs } }));
  }, []);

  const collectFromCooker = useCallback((stationId: string) => {
    delete lockedStations.current[stationId];
    setCookers((prev) => {
      const next = { ...prev };
      delete next[stationId];
      return next;
    });
  }, []);

  const serve = useCallback(() => {
    const h = heldRef.current;
    if (!h || h.kind !== 'cake' || !h.base || !h.filling || !h.topping) {
      popup('Not ready yet!', 'warn');
      return;
    }
    if (h.spoiled) {
      popup('Wrong cake — toss it & redo! 🗑️', 'bad');
      flashMood('sad');
      return;
    }
    const cake = { base: h.base, filling: h.filling, topping: h.topping, stage: 'readyToServe' as const };
    // Among greeted customers wanting this cake, serve the most urgent one
    // (least order time left).
    const matched = customersRef.current
      .filter((c) => c.greeted && cakeMatchesOrder(cake, c.order))
      .sort((a, b) => custOrderLeft(a) - custOrderLeft(b))[0];

    if (matched) {
      timedOutIds.current.add(matched.id); // served — never time it out
      setHeld(null);
      setCustomers((prev) => prev.filter((c) => c.id !== matched.id)); // bunny leaves happy

      const newCombo = comboRef.current + 1;
      let pts = SCORE_CORRECT;
      const tags: string[] = [];
      if (isRush && Date.now() - matched.greetedAt < FAST_SERVE_MS) {
        pts += SCORE_FAST;
        tags.push('Fast');
      }
      if (newCombo % 3 === 0) {
        pts += SCORE_COMBO;
        tags.push(`Combo x${newCombo}`);
      }
      setScore((s) => s + pts);
      setCombo(newCombo);
      setBestCombo((b) => Math.max(b, newCombo));
      setCakesMade((c) => c + 1);
      flashMood(newCombo % 3 === 0 ? 'excited' : 'happy');
      popup(`+${pts}${tags.length ? '  ' + tags.join(' · ') : ''} 🎉`, 'ok');
    } else {
      setHeld(null); // discard the wrong cake
      setCombo(0);
      flashMood('sad');
      if (isRush) {
        setScore((s) => Math.max(0, s + SCORE_WRONG));
        popup(`Wrong order! ${SCORE_WRONG} ❌`, 'bad');
      } else {
        popup('Wrong order! ❌', 'bad');
      }
    }
  }, [popup, flashMood, isRush, isLine]);

  // Runs when the cat arrives at a station (after the walk animation time).
  const handleArrive = useCallback(
    (station: Station) => {
      const h = heldRef.current;
      switch (station.kind) {
        case 'ingredient':
          setPicker('base');
          break;
        case 'mixer':
        case 'oven': {
          const isMix = station.kind === 'mixer';
          const need = isMix ? 'base' : 'batter';
          // Both modes use the drop-in countdown (timed mode no longer instant).
          const cooker = cookersRef.current[station.id];
          if (cooker && cookerReady(cooker)) {
            if (h) { popup('Hands full!', 'warn'); break; }
            setHeld({ kind: isMix ? 'batter' : 'sponge', base: cooker.base });
            collectFromCooker(station.id);
            flashMood('happy');
            popup(isMix ? 'Batter ready! 🥣' : 'Sponge baked! 🍞', 'ok');
          } else if (cooker) {
            popup(isMix ? 'Still mixing… ⏳' : 'Still baking… ⏳', 'warn');
          } else if (h?.kind === need && h.base) {
            setHeld(null);
            dropIntoCooker(station.id, h.base, isMix ? MIX_MS : BAKE_MS);
            popup(isMix ? 'Mixing — you can go! 🥣' : 'Baking — you can go! 🔥', 'ok');
          } else {
            popup(isMix ? 'Bring a base to mix 🧺' : 'Bring batter to bake 🥣', 'warn');
          }
          break;
        }
        case 'assembly':
          if (h?.kind === 'sponge' && !h.filling) setPicker('filling');
          else if (h?.kind === 'sponge' && h.filling) popup('Filling already added', 'warn');
          else popup('Bake a sponge first 🔥', 'warn');
          break;
        case 'decoration':
          if (h?.kind === 'sponge' && h.filling && !h.topping) setPicker('topping');
          else if (!h || h.kind !== 'sponge' || !h.filling) popup('Add a filling first 🍰', 'warn');
          else popup('Already decorated', 'warn');
          break;
        case 'counter':
          serve();
          break;
        case 'trash':
          if (h) {
            setHeld(null);
            popup('Tossed it 🗑️', 'warn');
          } else {
            popup('Nothing to toss', 'warn');
          }
          break;
      }
    },
    [popup, flashMood, serve, dropIntoCooker, collectFromCooker, isRush],
  );

  // Obstacle map + walkable bounds (px) for the current kitchen size.
  const navData = useMemo(
    () => (size.w > 0 ? { obstacles: obstaclesPx(size.w, size.h), bounds: walkBounds(size.w, size.h) } : null),
    [size.w, size.h],
  );

  // Core move: A*-path the active cat's FEET to a destination (px), following the
  // waypoints at a constant pace. If `station` is given, run its action on arrival.
  const goTo = (destPx: NavPoint, station: Station | null, clickPx?: NavPoint) => {
    if (!navData) return;
    const w = size.w;
    const h = size.h;
    const fromPct = { x: active.targetX, y: active.targetY };
    const fromPx = pctToPx(fromPct, w, h);
    const wps = findPath(fromPx, destPx, navData.obstacles, navData.bounds);
    const path = wps.map((p) => pxToPct(p, w, h));
    const dest = path.length ? path[path.length - 1] : pxToPct(destPx, w, h);
    setPicker(null);
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === active.id
          ? { ...p, targetX: dest.x, targetY: dest.y, path, currentStation: station ? station.id : null }
          : p,
      ),
    );
    if (arriveTimer.current) clearTimeout(arriveTimer.current);
    if (station) {
      arriveTimer.current = setTimeout(() => handleArrive(station), pathDurationMs(fromPct, path, w, h));
    }
    if (NAV_DEBUG) {
      setNavDebug({ click: clickPx ?? destPx, dest: destPx, path: wps });
      // eslint-disable-next-line no-console
      console.log('[nav]', { from: fromPx, click: clickPx, dest: destPx, waypoints: wps.length });
    }
  };

  // Tapping a station → walk to its accessible-side interaction point, then act.
  const moveTo = (station: Station) => {
    if (phaseRef.current !== 'playing' || !navData) return;
    const fromPx = pctToPx({ x: active.targetX, y: active.targetY }, size.w, size.h);
    const destPx = stationTarget(station.id, fromPx, navData.obstacles, navData.bounds);
    goTo(destPx, station, destPx);
  };

  // Tap empty floor / a table body → resolve to a walkable spot (exact floor, or
  // the near side of a table) and A*-path there.
  const moveFree = (e: GestureResponderEvent) => {
    if (phaseRef.current !== 'playing' || !navData) return;
    const click = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
    const fromPx = pctToPx({ x: active.targetX, y: active.targetY }, size.w, size.h);
    const { dest } = resolveClick(click, fromPx, navData.obstacles, navData.bounds);
    goTo(dest, null, click);
  };

  // Tap the serving counter → walk to the floor in front of it at the tapped x,
  // then serve. The counter Pressable is full-width (left:0), so locationX == kitchen x.
  const tapCounter = (e: GestureResponderEvent) => {
    if (phaseRef.current !== 'playing' || !navData) return;
    const counter = STATIONS.find((s) => s.kind === 'counter');
    if (!counter) return;
    const click = { x: e.nativeEvent.locationX, y: -10 }; // above the band → counter-front
    const fromPx = pctToPx({ x: active.targetX, y: active.targetY }, size.w, size.h);
    const { dest } = resolveClick(click, fromPx, navData.obstacles, navData.bounds);
    goTo(dest, counter, click);
  };

  const onPick = (id: CakeBase | CakeFilling | CakeTopping) => {
    if (picker === 'base') {
      // Bind this cake to the order being worked on (oldest greeted) and check
      // each ingredient against it. A wrong pick spoils the cake → must be tossed.
      const target = customersRef.current.find((c) => c.greeted);
      const wrong = !!target && (id as CakeBase) !== target.order.base;
      setHeld({ kind: 'base', base: id as CakeBase, orderId: target?.id, spoiled: wrong });
      if (wrong) {
        popup('Wrong base! Toss it & redo 🗑️', 'bad');
        flashMood('sad');
      } else {
        popup('Got a base 🧺', 'ok');
      }
    } else if (picker === 'filling') {
      const h = heldRef.current;
      const target = customersRef.current.find((c) => c.id === h?.orderId);
      const wrong = !!target && (id as CakeFilling) !== target.order.filling;
      setHeld((cur) => (cur ? { ...cur, filling: id as CakeFilling, spoiled: cur.spoiled || wrong } : cur));
      if (wrong) {
        popup('Wrong filling! Toss it 🗑️', 'bad');
        flashMood('sad');
      } else {
        popup('Filling added 🍰', 'ok');
      }
    } else if (picker === 'topping') {
      const h = heldRef.current;
      const target = customersRef.current.find((c) => c.id === h?.orderId);
      const wrong = !!target && (id as CakeTopping) !== target.order.topping;
      setHeld((cur) => (cur ? { ...cur, kind: 'cake', topping: id as CakeTopping, spoiled: cur.spoiled || wrong } : cur));
      if (wrong) {
        popup('Wrong topping! Toss it 🗑️', 'bad');
        flashMood('sad');
      } else {
        popup('Ready! Serve it 🔔', 'ok');
      }
    }
    setPicker(null);
  };

  const restart = () => {
    if (arriveTimer.current) clearTimeout(arriveTimer.current);
    lockedStations.current = {};
    gameStart.current = Date.now();
    timedOutIds.current = new Set();
    setCookers({});
    setHeld(null);
    setPicker(null);
    setFeedback(null);
    setMood('idle');
    lastSpawn.current = Date.now();
    setCustomers([makeCustomer()]);
    setPlayers([createInitialPlayer()]);
    // Reset the round
    setScore(0);
    setCakesMade(0);
    setCombo(0);
    setBestCombo(0);
    setSecondsLeft(ROUND_SECONDS);
    setHearts(START_HEARTS);
    setPhase('playing');
  };

  const pickerOptions: IngredientDef[] =
    picker === 'base' ? BASES : picker === 'filling' ? FILLINGS : picker === 'topping' ? TOPPINGS : [];

  // A cooker that has finished and is waiting to be collected.
  const readyCookerId = (): string | null =>
    STATIONS.find((s) => (s.kind === 'mixer' || s.kind === 'oven') && cookers[s.id] && cookerReady(cookers[s.id]))?.id ??
    null;
  // A free station of a kind (or the first of that kind if all are busy).
  const freeStationId = (kind: 'mixer' | 'oven'): string | null => {
    const ofKind = STATIONS.filter((s) => s.kind === kind);
    return (ofKind.find((s) => !cookers[s.id]) ?? ofKind[0])?.id ?? null;
  };

  // Which station instance to gently highlight next.
  const nextStationId: string | null = (() => {
    if (picker) return null;
    if (held) {
      if (held.kind === 'base') return freeStationId('mixer');
      if (held.kind === 'batter') return freeStationId('oven');
      if (held.kind === 'sponge') return held.filling ? 'decoration' : 'assembly';
      if (held.kind === 'cake') return 'counter';
    }
    const ready = readyCookerId();
    if (ready) return ready;
    if (Object.keys(cookers).length > 0) return null; // something's cooking
    return 'ingredient';
  })();

  const statusText = (() => {
    if (held) {
      switch (held.kind) {
        case 'base':
          return 'Drop it in a Mixer 🥣';
        case 'batter':
          return 'Drop it in an Oven 🔥';
        case 'sponge':
          return held.filling ? 'Decorate at the Decoration table 🎀' : 'Add filling at the Assembly table 🍰';
        case 'cake':
          return 'Serve it at the Counter 🔔';
      }
    }
    if (readyCookerId()) return 'Collect your cooked item ✨';
    if (Object.keys(cookers).length > 0) return 'Cooking… grab a base to get ahead 🧺';
    return 'Tap Ingredients 🧺 to start a cake';
  })();

  return (
    <ThemedView style={styles.container}>
      <Image source={KITCHEN_BG} style={StyleSheet.absoluteFill} contentFit="cover" pointerEvents="none" />
      <SafeAreaView style={styles.kitchenSafe} edges={['top', 'bottom']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable hitSlop={10} style={({ pressed }) => [styles.modesBtn, pressed && styles.pressed]} onPress={onBack}>
            <Text style={styles.modesBtnText}>‹ Modes</Text>
          </Pressable>
          {/* Hearts = lives, Customer Line only. Timed (Cake Rush) has no pill. */}
          {!isRush && (
            <View style={styles.topLife} pointerEvents="none">
              <View style={styles.topLifePill}>
                {Array.from({ length: START_HEARTS }).map((_, i) => (
                  <View key={i} style={{ opacity: i < hearts ? 1 : 0.28 }}>
                    <BakeryHeartEmoji size={22} />
                  </View>
                ))}
              </View>
            </View>
          )}
          <View style={styles.topRight}>
            {isRush && (
              <View style={styles.timerPill}>
                <Text style={styles.timerText}>{formatTime(secondsLeft)}</Text>
              </View>
            )}
          </View>
        </View>


        {/* Top-down kitchen map — tap empty space to walk there */}
        <Pressable style={styles.kitchen} onLayout={onLayout} onPress={moveFree}>
          {/* Score + Highest score down the left */}
          {/* box-only: the badges absorb taps so they don't leak to moveFree */}
          <View style={[styles.leftStats, { top: 0.23 * size.h }]} pointerEvents="box-only">
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>Score {score}</Text>
            </View>
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>
                Highest score {Math.max(score, isRush ? cakeBestRush : cakeBestLine)}
              </Text>
            </View>
            {online && (
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeText}>👥 {oppScore}</Text>
              </View>
            )}
          </View>
          {/* Counters the mixers / ovens sit on (decorative, behind the stations) */}
          {/* Hidden for now — being replaced with new art (keep code). */}
          {false && size.w > 0 && (
            <>
              {/* Vertical shelf behind the left ovens */}
              <Image
                source={SHELF_IMG}
                pointerEvents="none"
                contentFit="fill"
                style={{
                  position: 'absolute',
                  width: 0.46 * size.h,
                  height: SHELF_W,
                  left: 0.14 * size.w - (0.46 * size.h) / 2,
                  top: 0.65 * size.h - SHELF_W / 2,
                  transform: [{ rotate: '90deg' }],
                }}
              />
              {/* Horizontal shelf under the bottom mixers */}
              <Image
                source={SHELF_IMG}
                pointerEvents="none"
                contentFit="fill"
                style={{
                  position: 'absolute',
                  width: 0.56 * size.w,
                  height: SHELF_W * 0.92,
                  left: 0.5 * size.w - (0.56 * size.w) / 2,
                  top: 0.93 * size.h - (SHELF_W * 0.92) / 2,
                }}
              />
            </>
          )}

          {/* Bunny customers — render BEFORE the counter so they sit behind it */}
          <View style={[styles.customerStrip, { top: 0.02 * size.h }]} pointerEvents="box-none">
            {customers.slice(0, ACTIVE_ORDERS).map((c) => (
              <CustomerSprite key={c.id} customer={c} onGreet={() => greetCustomer(c.id)} />
            ))}
          </View>

          {/* Serving counter: full art is decorative; only the UPPER surface is
              tappable to serve, so the strip in front of it stays walkable. */}
          {size.w > 0 &&
            (() => {
              const cW = size.w;
              const { counterTop: cTop, counterH: cH } = kitchenLayout(size.w, size.h);
              return (
                <>
                  <Image
                    source={COUNTER_IMG}
                    pointerEvents="none"
                    contentFit="contain"
                    style={{ position: 'absolute', left: 0, top: cTop, width: cW, height: cH, zIndex: 8 }}
                  />
                  <Pressable
                    hitSlop={6}
                    onPress={tapCounter}
                    style={{ position: 'absolute', left: 0, top: cTop, width: cW, height: 0.55 * cH, alignItems: 'center', zIndex: 8 }}>
                    {nextStationId === 'counter' && <Text style={styles.counterPoint}>👇</Text>}
                  </Pressable>
                </>
              );
            })()}

          {/* Invisible greet layer ON TOP of the counter, mirroring the bunny
              strip so the hit boxes line up. Tapping an un-greeted bunny takes
              its order even though the bunny renders behind the counter. Greeted
              bunnies pass taps through so you can still serve at the counter. */}
          <View style={[styles.customerStrip, { top: 0.02 * size.h, zIndex: 9 }]} pointerEvents="box-none">
            {customers.slice(0, ACTIVE_ORDERS).map((c) =>
              c.greeted ? (
                <View key={c.id} style={styles.greetHit} pointerEvents="none" />
              ) : (
                <Pressable key={c.id} style={styles.greetHit} onPress={() => greetCustomer(c.id)} />
              ),
            )}
          </View>

          {/* Left counter — Ingredients (tappable) + the 3 mixers sitting on its
              slots, positioned relative to the counter frame so they always line
              up. Mixer art swaps empty/full from its cooker state. */}
          {size.w > 0 &&
            (() => {
              const lc = kitchenLayout(size.w, size.h).leftCounter;
              const lcLeft = lc.x0;
              const lcTop = lc.y0;
              const lcW = lc.x1 - lc.x0;
              const lcH = lc.y1 - lc.y0;
              const mixW = 0.28 * lcW;
              const mixH = mixW / MIXER_ASPECT;
              const slotsX = [0.24, 0.53, 0.82]; // fraction of lcW (slot centers)
              const slotY = 0.66; // fraction of lcH (mixer vertical center)
              const mixerStations = STATIONS.filter((s) => s.kind === 'mixer');
              return (
                <View
                  style={{ position: 'absolute', left: lcLeft, top: lcTop, width: lcW, height: lcH }}
                  pointerEvents="box-none">
                  <Image source={LEFT_COUNTER_IMG} style={StyleSheet.absoluteFill} contentFit="contain" pointerEvents="none" />
                  {/* Ingredient hit-area — only the top-left shelf, so the rest of
                      the counter lets you tap-to-walk past it */}
                  <Pressable
                    onPress={() => moveTo(STATIONS.find((s) => s.kind === 'ingredient')!)}
                    style={{ position: 'absolute', left: 0, top: 0, width: 0.6 * lcW, height: 0.42 * lcH }}>
                    {nextStationId === 'ingredient' && <Text style={styles.counterPoint}>👇</Text>}
                  </Pressable>
                  {mixerStations.map((st, i) => {
                    const cooker = cookers[st.id];
                    const ready = cooker && cookerReady(cooker);
                    return (
                      <Pressable
                        key={st.id}
                        onPress={() => moveTo(st)}
                        style={{
                          position: 'absolute',
                          left: (slotsX[i] ?? 0.5) * lcW - mixW / 2,
                          top: slotY * lcH - mixH / 2,
                          width: mixW,
                          height: mixH,
                        }}>
                        <Image
                          source={stationImage('mixer', !!cooker)}
                          style={StyleSheet.absoluteFill}
                          contentFit="contain"
                          pointerEvents="none"
                        />
                        {cooker && !ready && (
                          <View style={styles.cookTrack}>
                            <View style={[styles.cookFill, { width: `${cookerProgress(cooker) * 100}%` }]} />
                          </View>
                        )}
                        {cooker && (
                          <View style={styles.cookInside} pointerEvents="none">
                            <BaseIcon id={cooker.base} size={20} />
                          </View>
                        )}
                        {nextStationId === st.id && <Text style={styles.counterPoint}>👇</Text>}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })()}

          {/* Oven table — wide counter above assembly, with 3 ovens on it that
              swap empty/baking from their cooker state. */}
          {size.w > 0 &&
            (() => {
              const ot = kitchenLayout(size.w, size.h).ovenTable;
              const ovenW = ot.x1 - ot.x0;
              const ovenH = ot.y1 - ot.y0;
              const tableLeft = ot.x0;
              const tableTop = ot.y0;
              const appW = 0.27 * ovenW;
              const appH = appW / OVEN_APP_ASPECT;
              const slotsX = [0.15, 0.44, 0.73]; // fraction of table width
              const ovenCenterY = tableTop + 0.1 * ovenH;
              const ovens = STATIONS.filter((s) => s.kind === 'oven');
              return (
                <>
                  <Image
                    source={OVEN_TABLE_IMG}
                    pointerEvents="none"
                    contentFit="contain"
                    style={{ position: 'absolute', left: tableLeft, top: tableTop, width: ovenW, height: ovenH }}
                  />
                  {ovens.map((st, i) => {
                    const cooker = cookers[st.id];
                    const ready = cooker && cookerReady(cooker);
                    return (
                      <Pressable
                        key={st.id}
                        onPress={() => moveTo(st)}
                        style={{
                          position: 'absolute',
                          left: tableLeft + (slotsX[i] ?? 0.5) * ovenW - appW / 2,
                          top: ovenCenterY - appH / 2,
                          width: appW,
                          height: appH,
                        }}>
                        <Image source={stationImage('oven', !!cooker)} style={StyleSheet.absoluteFill} contentFit="contain" pointerEvents="none" />
                        {cooker && !ready && (
                          <View style={styles.cookTrack}>
                            <View style={[styles.cookFill, { width: `${cookerProgress(cooker) * 100}%` }]} />
                          </View>
                        )}
                        {cooker && (
                          <View style={styles.cookInside} pointerEvents="none">
                            <BaseIcon id={cooker.base} size={20} />
                          </View>
                        )}
                        {nextStationId === st.id && <Text style={styles.counterPoint}>👇</Text>}
                      </Pressable>
                    );
                  })}
                </>
              );
            })()}

          {/* Right side — Assembly / Decorate / Trash stations, stacked. */}
          {size.w > 0 &&
            (() => {
              const rightRects = kitchenLayout(size.w, size.h).rightRects;
              return STATIONS.filter((s) => rightRects[s.kind]).map((s) => {
                const r = rightRects[s.kind];
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => moveTo(s)}
                    style={{
                      position: 'absolute',
                      left: r.x0,
                      top: r.y0,
                      width: r.x1 - r.x0,
                      height: r.y1 - r.y0,
                    }}>
                    <Image source={stationImage(s.kind, false)} style={StyleSheet.absoluteFill} contentFit="contain" pointerEvents="none" />
                    {nextStationId === s.id && <Text style={styles.counterPoint}>👇</Text>}
                  </Pressable>
                );
              });
            })()}

          {size.w > 0 &&
            STATIONS.filter((s) => s.kind !== 'counter')
              // Temporarily hidden — these stations are being replaced with new
              // art. Gameplay/StationBox code stays; just not rendered for now.
              .filter((s) => !HIDDEN_STATION_KINDS.has(s.kind))
              .map((s) => {
              const cooker = cookers[s.id];
              const ready = cooker && cookerReady(cooker);
              return (
                <StationBox
                  key={s.id}
                  station={s}
                  w={size.w}
                  h={size.h}
                  image={stationImage(s.kind, !!cooker)}
                  suggested={nextStationId === s.id}
                  progress={cooker && !ready ? cookerProgress(cooker) : undefined}
                  onPress={() => moveTo(s)}
                />
              );
            })}

          {size.w > 0 &&
            [...players, ...helpers].map((p) => {
              const isMe = p.id === active.id;
              return (
                <PlayerSprite
                  key={p.id}
                  player={p}
                  held={isMe ? held : null}
                  image={isMe ? characterImg(cakeCharacter) : null}
                  face={isMe ? moodFace(mood) : HELPER_DEFS.find((d) => d.id === p.id)?.face ?? '🐱'}
                  kw={size.w}
                  kh={size.h}
                />
              );
            })}

          {/* Debug overlay (NAV_DEBUG): obstacles, bounds, path, click/dest. */}
          {NAV_DEBUG && size.w > 0 && (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              {(() => {
                const b = walkBounds(size.w, size.h);
                return (
                  <View
                    style={{
                      position: 'absolute',
                      left: b.x0,
                      top: b.y0,
                      width: b.x1 - b.x0,
                      height: b.y1 - b.y0,
                      borderWidth: 1,
                      borderColor: 'lime',
                    }}
                  />
                );
              })()}
              {obstaclesPx(size.w, size.h).map((o: Obstacle) => (
                <View
                  key={o.id}
                  style={{
                    position: 'absolute',
                    left: o.rect.x0,
                    top: o.rect.y0,
                    width: o.rect.x1 - o.rect.x0,
                    height: o.rect.y1 - o.rect.y0,
                    borderWidth: 1.5,
                    borderColor: 'red',
                    backgroundColor: 'rgba(255,0,0,0.12)',
                  }}>
                  <Text style={{ fontSize: 8, color: 'red' }}>{o.id}</Text>
                </View>
              ))}
              {navDebug?.path.map((p, i) => (
                <View
                  key={`wp${i}`}
                  style={{ position: 'absolute', left: p.x - 3, top: p.y - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: 'blue' }}
                />
              ))}
              {navDebug && (
                <View style={{ position: 'absolute', left: navDebug.click.x - 4, top: navDebug.click.y - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: 'yellow' }} />
              )}
              {navDebug && (
                <View style={{ position: 'absolute', left: navDebug.dest.x - 5, top: navDebug.dest.y - 5, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: 'magenta' }} />
              )}
            </View>
          )}

          {/* Floating result popup */}
          {feedback && (
            <Animated.View
              key={feedback.id}
              entering={ZoomIn.duration(170)}
              pointerEvents="none"
              style={[styles.popup, POPUP_STYLE[feedback.kind]]}>
              <Text style={styles.popupText}>{feedback.text}</Text>
            </Animated.View>
          )}

          {/* Ingredient picker overlay */}
          {picker && (
            <View style={styles.pickerOverlay}>
              <Text style={styles.pickerTitle}>
                {picker === 'base' ? 'Choose a base' : picker === 'filling' ? 'Choose a filling' : 'Choose a topping'}
              </Text>
              <View style={styles.pickerRow}>
                {pickerOptions.map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={({ pressed }) => [styles.pickChip, pressed && styles.pressed]}
                    onPress={() => onPick(opt.id as CakeBase | CakeFilling | CakeTopping)}>
                    <View style={styles.pickSwatch}>
                      <CakeIngredientIcon
                        kind={picker === 'base' ? 'base' : picker === 'filling' ? 'filling' : 'topping'}
                        id={opt.id as never}
                        size={38}
                      />
                    </View>
                    <Text style={styles.pickLabel} numberOfLines={1}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </Pressable>

        {/* Current orders (max 2) along the bottom — only after greeting */}
        <View style={styles.ordersBar} pointerEvents="box-none">
          {customers
            .filter((c) => c.greeted)
            .slice(0, ACTIVE_ORDERS)
            .map((c) => (
              <OrderCard key={c.id} customer={c} held={held} onGreet={() => greetCustomer(c.id)} />
            ))}
        </View>

        {/* Results */}
        {phase === 'results' && (
          <ResultsModal
            title={
              online
                ? (oppFinal ?? oppScore) < score
                  ? 'You win the race! 🎉'
                  : (oppFinal ?? oppScore) > score
                    ? 'Friend wins the race!'
                    : "It's a tie!"
                : isRush
                  ? "Time's up! ⏰"
                  : 'Out of hearts! 💔'
            }
            rows={
              online
                ? [
                    ['⭐ Your score', `${score}`],
                    ['👥 Friend score', `${oppFinal ?? oppScore}`],
                    ['🎂 Cakes made', `${cakesMade}`],
                    ['🪙 Coins earned', `+${Math.floor(score / SCORE_PER_COIN)}`],
                  ]
                : isRush
                ? [
                    ['🎂 Cakes made', `${cakesMade}`],
                    ['⭐ Score', `${score}`],
                    ['🔥 Best combo', `x${bestCombo}`],
                    ['🪙 Coins earned', `+${Math.floor(score / SCORE_PER_COIN)}`],
                    ['🏆 Best score', `${cakeBestRush}`],
                  ]
                : [
                    ['⭐ Score', `${score}`],
                    ['🍰 Cakes served', `${cakesMade}`],
                    ['🔥 Best combo', `x${bestCombo}`],
                    ['🪙 Coins earned', `+${Math.floor(score / SCORE_PER_COIN)}`],
                    ['🏆 Best score', `${cakeBestLine}`],
                  ]
            }
            onPlayAgain={restart}
            onModes={onBack}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function formatTime(total: number): string {
  // Quirky display: above 6:00 it reads as "6:70" and the 70 counts down; once
  // it reaches 6:00 it continues as a normal clock.
  if (total > 360) return `6:${String(total - 360).padStart(2, '0')}`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function ResultsModal({
  title,
  rows,
  onPlayAgain,
  onModes,
}: {
  title: string;
  rows: [string, string][];
  onPlayAgain: () => void;
  onModes: () => void;
}) {
  return (
    <View style={styles.resultsBackdrop}>
      <Animated.View entering={ZoomIn.duration(200)} style={styles.resultsCard}>
        <Text style={styles.resultsTitle}>{title}</Text>
        <View style={styles.resultsRows}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.resultsRow}>
              <Text style={styles.resultsLabel}>{label}</Text>
              <Text style={styles.resultsValue}>{value}</Text>
            </View>
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [styles.resultsPrimary, pressed && styles.pressed]}
          onPress={onPlayAgain}>
          <Text style={styles.resultsPrimaryText}>Play Again 🎮</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.resultsSecondary, pressed && styles.pressed]}
          onPress={onModes}>
          <Text style={styles.resultsSecondaryText}>Back to Modes</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const POPUP_STYLE: Record<FeedbackKind, object> = {
  ok: { backgroundColor: BakeryColors.success, borderColor: BakeryColors.mint },
  warn: { backgroundColor: BakeryColors.honey, borderColor: BakeryColors.butter },
  bad: { backgroundColor: BakeryColors.danger, borderColor: BakeryColors.rose },
};

const barColorFor = (t: number) =>
  t > 0.5 ? BakeryColors.success : t > 0.25 ? BakeryColors.honey : BakeryColors.danger;

// A bunny customer standing at the counter: order bubble, bunny, countdown bar.
function CustomerSprite({ customer, onGreet }: { customer: Customer; onGreet: () => void }) {
  const { order, greeted } = customer;
  const items = [findBase(order.base), findFilling(order.filling), findTopping(order.topping)];
  const t = greeted ? custOrderLeft(customer) : custGreetLeft(customer);

  return (
    <Animated.View
      entering={FadeIn.duration(450)}
      style={styles.custSprite}
      pointerEvents={greeted ? 'none' : 'box-none'}
    >
      {/* Greet prompt — absolute (over the bunny) so the bunny never shifts on
          greet and it sits below the heart at the top */}
      {!greeted && (
        <View style={styles.custBubbleWrap} pointerEvents="box-none">
          <View style={styles.custReceiptRow} pointerEvents="box-none">
            {/* The receipt IS the take-order button — it sits above the counter
                so the counter never steals the tap (bunny stays behind it). */}
            <Pressable onPress={onGreet} hitSlop={12} style={styles.custReceiptCard}>
              <BakeryReceiptEmoji size={30} />
            </Pressable>
            {/* Vertical countdown to take the order, beside the receipt */}
            <View style={styles.custGreetTrack} pointerEvents="none">
              <View style={[styles.custGreetFill, { height: `${t * 100}%`, backgroundColor: barColorFor(t) }]} />
            </View>
          </View>
        </View>
      )}
      <Pressable onPress={greeted ? undefined : onGreet} hitSlop={6}>
        <Image source={CUSTOMER_IMG} style={styles.custBunny} contentFit="contain" />
      </Pressable>
      {greeted && (
        <View style={styles.custBar}>
          <View style={[styles.custBarFill, { width: `${t * 100}%`, backgroundColor: barColorFor(t) }]} />
        </View>
      )}
    </Animated.View>
  );
}

// One order shown in the top orders bar. Tap an un-taken order to greet it.
function OrderCard({ customer, held, onGreet }: { customer: Customer; held: HeldItem | null; onGreet: () => void }) {
  const { order, greeted } = customer;
  const t = greeted ? custOrderLeft(customer) : custGreetLeft(customer);
  // Live checklist only for the order this cake is being built for.
  const isTarget = !!held && held.orderId === customer.id;
  const slots: { kind: IngredientKind; want: string; got?: string }[] = [
    { kind: 'base', want: order.base, got: isTarget ? held?.base : undefined },
    { kind: 'filling', want: order.filling, got: isTarget ? held?.filling : undefined },
    { kind: 'topping', want: order.topping, got: isTarget ? held?.topping : undefined },
  ];
  return (
    <Pressable onPress={greeted ? undefined : onGreet} style={styles.orderCard}>
      <View style={styles.orderCardIcons}>
        {slots.map((s, i) => {
          const status = s.got == null ? 'pending' : s.got === s.want ? 'ok' : 'bad';
          return (
            <View key={i} style={styles.orderSlot}>
              <CakeIngredientIcon kind={s.kind} id={s.want as never} size={26} />
              {greeted && status !== 'pending' && (
                <View style={[styles.orderTick, status === 'ok' ? styles.orderTickOk : styles.orderTickBad]}>
                  <Text style={styles.orderTickText}>{status === 'ok' ? '✓' : '✕'}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
      {!greeted && <Text style={styles.orderNew}>New! Tap to take</Text>}
      <View style={styles.orderBar}>
        <View style={[styles.orderBarFill, { width: `${t * 100}%`, backgroundColor: barColorFor(t) }]} />
      </View>
    </Pressable>
  );
}

const BOX = 66;
const STATION_W = 60;
const STATION_H = 68;
const SHELF_W = 82; // visual width of the vertical mixer/oven counter
const PLAYER = 52; // fallback emoji-circle diameter
const SPRITE_W = 62; // character sprite art size
const SPRITE_H = 96; // feet sit at the bottom-center of this box

function StationBox({
  station,
  w,
  h,
  image,
  suggested,
  progress,
  onPress,
}: {
  station: Station;
  w: number;
  h: number;
  image: number | null;
  suggested: boolean;
  progress?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={14}
      style={({ pressed }) => [
        styles.stationImgWrap,
        pressed && styles.stationPressed,
        {
          left: (station.x / 100) * w - STATION_W / 2,
          top: (station.y / 100) * h - STATION_H / 2,
        },
      ]}>
      {suggested && <Text style={styles.suggestPoint}>👇</Text>}
      {progress !== undefined && (
        <View style={styles.cookTrack}>
          <View style={[styles.cookFill, { width: `${progress * 100}%` }]} />
        </View>
      )}
      {image != null ? (
        <Image source={image} style={styles.stationImg} contentFit="contain" pointerEvents="none" />
      ) : (
        <>
          <Text style={styles.stationEmoji}>{station.emoji}</Text>
          <Text style={styles.stationLabel} numberOfLines={1}>
            {station.label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// The cat's face for the current mood (static emoji reactions for now).
function moodFace(mood: Mood): string {
  switch (mood) {
    case 'happy':
      return '😸';
    case 'excited':
      return '😻';
    case 'sad':
      return '🙀';
    default:
      return '🐱';
  }
}

function PlayerSprite({
  player,
  held,
  image,
  face,
  kw,
  kh,
}: {
  player: PlayerState;
  held: HeldItem | null;
  image: number | null;
  face: string;
  kw: number;
  kh: number;
}) {
  // Animated pixel position of the player's center.
  const px = useSharedValue(0);
  const py = useSharedValue(0);
  const squish = useSharedValue(0);
  const placed = useRef(false);
  const prevTarget = useRef({ x: player.targetX, y: player.targetY });

  // Placeholder "alive" animation: gently squish/unsquish forever.
  useEffect(() => {
    squish.value = withRepeat(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [squish]);

  useEffect(() => {
    if (kw === 0 || kh === 0) return;
    const tx = (player.targetX / 100) * kw;
    const ty = (player.targetY / 100) * kh;
    const moved = prevTarget.current.x !== player.targetX || prevTarget.current.y !== player.targetY;
    if (!placed.current || !moved) {
      // First layout OR the kitchen resized: snap to the right spot (no animation).
      px.value = tx;
      py.value = ty;
      placed.current = true;
    } else {
      // Walk the waypoints in order at a CONSTANT pace (duration ∝ distance), so
      // short hops and long treks move at the same speed instead of zooming.
      const wps = player.path && player.path.length ? player.path : [{ x: player.targetX, y: player.targetY }];
      let prevX = px.value;
      let prevY = py.value;
      const xs: number[] = [];
      const ys: number[] = [];
      for (const wp of wps) {
        const wx = (wp.x / 100) * kw;
        const wy = (wp.y / 100) * kh;
        const dur = Math.max(80, Math.hypot(wx - prevX, wy - prevY) / WALK_SPEED);
        const opts = { duration: dur, easing: Easing.linear };
        xs.push(withTiming(wx, opts));
        ys.push(withTiming(wy, opts));
        prevX = wx;
        prevY = wy;
      }
      px.value = xs.length === 1 ? xs[0] : (withSequence(...xs) as number);
      py.value = ys.length === 1 ? ys[0] : (withSequence(...ys) as number);
    }
    prevTarget.current = { x: player.targetX, y: player.targetY };
  }, [player.targetX, player.targetY, player.path, kw, kh, px, py]);

  const animatedStyle = useAnimatedStyle(() => ({
    // (px,py) is the FEET point; place the sprite's bottom-center there.
    transform: [
      { translateX: px.value - SPRITE_W / 2 },
      { translateY: py.value - SPRITE_H },
      // Squash/stretch placeholder: oscillate tall-thin ↔ short-wide.
      { scaleX: 0.95 + 0.12 * squish.value },
      { scaleY: 1.05 - 0.12 * squish.value },
    ],
  }));

  return (
    <Animated.View style={[styles.playerWrap, animatedStyle]} pointerEvents="none">
      <View style={styles.nameTag}>
        <Text style={styles.nameTagText}>{player.name}</Text>
      </View>
      {image != null ? (
        <Image source={image} style={styles.playerCharImg} contentFit="contain" pointerEvents="none" />
      ) : (
        <View style={[styles.player, { borderColor: player.color }]}>
          <Text style={styles.playerEmoji}>{face}</Text>
        </View>
      )}
      {held && (
        <View style={[styles.heldBubble, styles.heldBubbleFull]}>
          <HeldIcon held={held} />
          {held.spoiled && (
            <View style={styles.heldSpoiled}>
              <Text style={styles.heldSpoiledText}>✕</Text>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

// The icon shown in the held-item bubble — the cake as it's being built.
function HeldIcon({ held }: { held: HeldItem }) {
  switch (held.kind) {
    case 'base':
      return held.base ? <BaseIcon id={held.base} size={22} /> : <Text style={styles.heldEmoji}>🥚</Text>;
    case 'batter':
      return <Text style={styles.heldEmoji}>🥣</Text>;
    case 'sponge':
      return <CakeBuildIcon base={held.base} filling={held.filling} size={24} />;
    case 'cake':
      return <CakeBuildIcon base={held.base} filling={held.filling} topping={held.topping} size={24} />;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BakeryColors.cream },

  // Mode select
  safe: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  setupSafeArea: { flex: 1 },
  setupScroll: {
    flexGrow: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  setupTopBar: { flexDirection: 'row' },
  setupBackBtn: {
    backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.pill,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  setupBackText: { color: BakeryColors.cocoa, fontWeight: '800', fontSize: 15 },
  header: { alignItems: 'center', gap: Spacing.one, marginTop: Spacing.two },
  logoWrap: { width: 300, height: 64, alignSelf: 'center', marginTop: 4 },
  logoStroke: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#fff',
    fontFamily: Fonts.rounded,
    fontWeight: '900',
    fontStyle: 'italic',
    fontSize: 46,
    letterSpacing: 1,
    lineHeight: 64,
  },
  logoFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontFamily: Fonts.rounded,
    fontWeight: '900',
    fontStyle: 'italic',
    fontSize: 46,
    letterSpacing: 1,
    lineHeight: 64,
    textShadowColor: 'rgba(120, 70, 50, 0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 2,
  },
  logoBatter: { color: '#F36CA0' },
  logoDash: { color: '#F2A93C' },
  title: { fontSize: 28, fontWeight: '900', color: BakeryColors.cocoaDark, letterSpacing: 0.3 },
  subtitle: { fontSize: 14, color: BakeryColors.mocha, fontWeight: '600' },

  modeList: { gap: Spacing.three },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.panel,
    borderWidth: 2,
    borderColor: BakeryColors.shortbread,
    padding: Spacing.three,
    ...BakeryShadow,
  },
  modeEmojiWrap: {
    width: 60,
    height: 60,
    borderRadius: BakeryRadii.card,
    backgroundColor: BakeryColors.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeEmoji: { fontSize: 32 },
  modeInfo: { flex: 1, gap: 2 },
  modeLabel: { fontSize: 18, fontWeight: '800', color: BakeryColors.cocoaDark },
  modeBlurb: { fontSize: 13, color: BakeryColors.mocha, fontWeight: '500', lineHeight: 18 },
  modeArrow: { fontSize: 28, color: BakeryColors.latte, fontWeight: '800' },

  howToCard: {
    backgroundColor: BakeryColors.glass,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    padding: Spacing.three,
  },
  howToText: { fontSize: 13, color: BakeryColors.cocoa, fontWeight: '500', lineHeight: 19, textAlign: 'center' },

  doneBtn: {
    marginTop: 'auto',
    backgroundColor: BakeryColors.jam,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    ...BakeryShadow,
  },
  doneBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  doneBtnFlex: { flex: 1, marginTop: 0 },

  // Setup screen (players + mode)
  setupLabel: { fontSize: 15, fontWeight: '800', color: BakeryColors.cocoaDark, marginTop: Spacing.two },
  choiceRow: { flexDirection: 'row', gap: Spacing.three },
  choiceCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minHeight: 152,
    backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.card,
    borderWidth: 2,
    borderColor: BakeryColors.shortbread,
    paddingVertical: Spacing.three,
    ...BakeryShadow,
  },
  choiceCardActive: { borderColor: BakeryColors.jam, backgroundColor: BakeryColors.rose },
  choiceImgRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: 86 },
  choiceImg: { width: 50, height: 84 },
  choiceImgWide: { width: 104, height: 84 },
  choiceIcon: { width: 72, height: 72 },
  choiceEmoji: { fontSize: 44, height: 86, lineHeight: 84, textAlign: 'center' },
  choiceTitle: { fontSize: 16, fontWeight: '900', color: BakeryColors.cocoaDark },
  choiceSub: { fontSize: 11.5, color: BakeryColors.mocha, fontWeight: '600' },
  secondaryBtnWide: { marginTop: 'auto' },
  charRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  charCard: {
    flexGrow: 1,
    flexBasis: '22%',
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.card,
    borderWidth: 2,
    borderColor: BakeryColors.shortbread,
    paddingVertical: Spacing.two,
  },
  charImg: { width: 48, height: 62 },
  charLocked: { opacity: 0.7 },
  charLockEmoji: { fontSize: 30 },
  inviteBtn: {
    backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.button,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  inviteBtnText: { color: BakeryColors.cocoaDark, fontSize: 15, fontWeight: '800' },
  playerSelectFooter: { flexDirection: 'row', gap: Spacing.two, marginTop: 'auto' },
  secondaryBtn: {
    backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.button,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { color: BakeryColors.cocoa, fontSize: 15, fontWeight: '800' },

  // Kitchen
  kitchenSafe: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modesBtn: {
    backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.pill,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  modesBtnText: { color: BakeryColors.cocoa, fontWeight: '800', fontSize: 14 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
  },
  homeIconBtn: { backgroundColor: BakeryColors.jam, borderColor: BakeryColors.berry },
  iconBtnText: { fontSize: 17 },
  modeName: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '900', color: BakeryColors.cocoaDark },
  timerPill: {
    backgroundColor: 'rgba(255,253,248,0.92)',
    borderRadius: BakeryRadii.pill,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  timerText: { fontSize: 15, fontWeight: '900', color: BakeryColors.cocoaDark },
  topLife: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  topLifePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,253,248,0.92)',
    borderRadius: BakeryRadii.pill,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  topLifeText: { fontSize: 15, fontWeight: '800', color: BakeryColors.cocoaDark },

  // Cake Rush HUD
  hud: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center' },
  hudPill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.pill,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingVertical: 6,
  },
  hudPillHot: { backgroundColor: BakeryColors.butter, borderColor: BakeryColors.honey },
  hudText: { fontSize: 14, fontWeight: '900', color: BakeryColors.cocoaDark },

  // Top orders bar (max 2)
  ordersBar: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center', paddingHorizontal: Spacing.two },
  orderCard: {
    flex: 1,
    maxWidth: 180,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFDF8',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  orderCardIcons: { flexDirection: 'row', gap: 8 },
  orderSlot: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFDF8',
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderTick: {
    position: 'absolute',
    right: -5,
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  orderTickOk: { backgroundColor: BakeryColors.success },
  orderTickBad: { backgroundColor: BakeryColors.danger },
  orderTickText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  orderNew: { fontSize: 10, fontWeight: '800', color: BakeryColors.berry },
  orderBar: { width: '100%', height: 5, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.08)', overflow: 'hidden' },
  orderBarFill: { height: '100%', borderRadius: 3 },

  // Left stat column (life / points / combo)
  leftStats: { position: 'absolute', left: -10, top: 8, gap: 6, zIndex: 30 },
  rightStats: { position: 'absolute', right: 6, top: 8, gap: 6, zIndex: 30, alignItems: 'flex-end' },
  statBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,253,248,0.92)',
    borderRadius: BakeryRadii.pill,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statBadgeHot: { backgroundColor: BakeryColors.butter, borderColor: BakeryColors.honey },
  statBadgeText: { fontSize: 13, fontWeight: '500', color: BakeryColors.cocoaDark },

  ordersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },

  kitchen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  station: {
    position: 'absolute',
    width: BOX,
    height: BOX,
    borderRadius: BakeryRadii.card,
    backgroundColor: BakeryColors.cream,
    borderWidth: 1.5,
    borderColor: BakeryColors.latte,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  stationActive: {
    borderColor: BakeryColors.jam,
    borderWidth: 2.5,
    backgroundColor: BakeryColors.rose,
  },
  stationSuggested: {
    borderColor: BakeryColors.honey,
    borderWidth: 2.5,
    backgroundColor: BakeryColors.butter,
  },
  stationReady: { borderColor: BakeryColors.success, borderWidth: 2.5 },
  stationPressed: { transform: [{ scale: 0.94 }] },
  suggestPoint: { position: 'absolute', top: -18, fontSize: 16 },
  stationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationBadgeText: { fontSize: 13 },
  stationEmoji: { fontSize: 24 },
  stationLabel: { fontSize: 10, fontWeight: '700', color: BakeryColors.cocoa },

  // Image-based station (artwork includes its own pedestal + label)
  stationImgWrap: {
    position: 'absolute',
    width: STATION_W,
    height: STATION_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationImg: { width: '100%', height: '100%' },

  // Mixer/oven cooking progress bar (floats just above the station)
  cookTrack: {
    position: 'absolute',
    bottom: -10,
    alignSelf: 'center',
    width: 56,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FFF6E6',
    borderWidth: 1.5,
    borderColor: BakeryColors.cocoaDark,
    overflow: 'hidden',
    zIndex: 5,
  },
  cookFill: { height: '100%', borderRadius: 4, backgroundColor: BakeryColors.honey },
  cookInside: {
    position: 'absolute',
    top: -22,
    alignSelf: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFDF8',
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },

  // Serving counter banner across the top of the kitchen
  counterBanner: { position: 'absolute', left: 0, top: 0, alignItems: 'center', zIndex: 8 },
  counterImg: { width: '100%', height: '100%' },
  counterPoint: { position: 'absolute', bottom: -14, fontSize: 16 },

  // Fake-helper toggle (top-left of the kitchen)
  helperToggle: {
    position: 'absolute',
    left: 8,
    top: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    zIndex: 5,
  },
  helperToggleOn: { backgroundColor: BakeryColors.mint, borderColor: BakeryColors.success },
  helperToggleText: { fontSize: 18 },
  trashBtn: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    zIndex: 5,
  },
  trashBtnText: { fontSize: 18 },

  // Floating result popup
  popup: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BakeryRadii.pill,
    borderWidth: 2,
    ...BakeryShadow,
  },
  popupText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // Player sprite (absolutely positioned wrapper, moved via reanimated transform).
  playerWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: SPRITE_W,
    height: SPRITE_H,
    alignItems: 'center',
    justifyContent: 'flex-end', // anchor by the FEET (bottom-center)
    zIndex: 20, // character on top of tables/counter; UI text (leftStats z30 +
    // the bottom status bar, which is outside the kitchen) still layers above.
  },
  player: {
    width: PLAYER,
    height: PLAYER,
    borderRadius: PLAYER / 2,
    backgroundColor: BakeryColors.butter,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    ...BakeryShadow,
  },
  playerEmoji: { fontSize: 26 },
  playerCharImg: { width: SPRITE_W, height: SPRITE_H },
  nameTag: {
    position: 'absolute',
    top: -16,
    backgroundColor: BakeryColors.cocoaDark,
    borderRadius: BakeryRadii.pill,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  nameTagText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  heldBubble: {
    position: 'absolute',
    right: -14,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  heldBubbleEmpty: {
    backgroundColor: BakeryColors.glass,
    borderColor: BakeryColors.latte,
    borderStyle: 'dashed',
  },
  heldBubbleFull: {
    backgroundColor: '#FFFDF8',
    borderColor: BakeryColors.jam,
  },
  heldSpoiled: {
    position: 'absolute',
    right: -4,
    top: -4,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: BakeryColors.danger,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heldSpoiledText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  heldEmoji: { fontSize: 15 },

  // Order ticket (compact — 2 across, wraps to a 2nd row when busy)
  orderTicket: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: 4,
    backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.card,
    borderWidth: 1.5,
    borderColor: BakeryColors.shortbread,
    paddingVertical: 6,
    paddingHorizontal: Spacing.two,
  },
  orderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  patienceTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BakeryColors.cream,
    overflow: 'hidden',
  },
  patienceFill: { height: '100%', borderRadius: 3 },
  orderLabel: { fontSize: 14 },
  orderTicketGreet: { borderColor: BakeryColors.jam, borderStyle: 'dashed' },
  custAvatar: { width: 30, height: 30 },
  greetText: { fontSize: 12, fontWeight: '800', color: BakeryColors.berry },

  // Bunny customers standing at the counter
  customerStrip: {
    position: 'absolute',
    top: 0,
    left: 2,
    right: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 12,
    zIndex: 4,
  },
  custSprite: { alignItems: 'center', width: 120 },
  greetHit: { width: 120, height: 142 },
  custBubble: {
    minWidth: 22,
    minHeight: 20,
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: BakeryColors.frosting,
    borderWidth: 1.5,
    borderColor: BakeryColors.jam,
    alignItems: 'center',
    justifyContent: 'center',
  },
  custBubbleIcons: { flexDirection: 'row', gap: 1 },
  custDot: {
    width: 15,
    height: 15,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: BakeryColors.latte,
  },
  custDotEmoji: { fontSize: 9 },
  custGreetMark: { fontSize: 12 },
  custBubbleWrap: { position: 'absolute', top: -16, left: 0, right: 0, alignItems: 'center', zIndex: 3 },
  custReceiptRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  custReceiptCard: {
    padding: 4,
    borderRadius: 10,
    backgroundColor: '#FFFDF8',
    borderWidth: 2,
    borderColor: BakeryColors.jam,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  custGreetTrack: {
    width: 7,
    height: 36,
    borderRadius: 4,
    backgroundColor: BakeryColors.cream,
    borderWidth: 1.5,
    borderColor: '#FFFDF8',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  custGreetFill: { width: '100%', borderRadius: 3 },
  custBunny: { width: 118, height: 142 },
  custBar: {
    width: 52,
    height: 4,
    borderRadius: 2,
    backgroundColor: BakeryColors.cream,
    overflow: 'hidden',
    marginTop: 1,
  },
  custBarFill: { height: '100%', borderRadius: 2 },
  orderIcons: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  orderIconWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  orderSwatch: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BakeryColors.latte,
  },
  orderEmoji: { fontSize: 14 },
  orderPlus: { fontSize: 11, color: BakeryColors.mocha, fontWeight: '800', marginHorizontal: 1 },

  // Ingredient picker overlay (bottom of the kitchen map)
  pickerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BakeryColors.darkGlass,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderBottomLeftRadius: BakeryRadii.panel,
    borderBottomRightRadius: BakeryRadii.panel,
    gap: Spacing.two,
  },
  pickerTitle: { color: '#fff', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two },
  pickChip: { alignItems: 'center', width: 64, gap: 3 },
  pickSwatch: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
    backgroundColor: '#FFFDF8',
  },
  pickEmoji: { fontSize: 22 },
  pickLabel: { color: '#fff', fontSize: 10, fontWeight: '700', textAlign: 'center' },

  // Status / current-step bar
  statusBar: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 36,
    overflow: 'hidden',
  },
  statusText: { fontSize: 13.5, color: BakeryColors.cocoa, fontWeight: '700', textAlign: 'center' },

  // Results modal
  resultsBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(78, 53, 40, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  resultsCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: BakeryColors.frosting,
    borderRadius: BakeryRadii.panel,
    borderWidth: 2,
    borderColor: BakeryColors.shortbread,
    padding: Spacing.four,
    gap: Spacing.three,
    ...BakeryShadow,
  },
  resultsTitle: { fontSize: 24, fontWeight: '900', color: BakeryColors.cocoaDark, textAlign: 'center' },
  resultsRows: { gap: Spacing.two },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BakeryColors.cream,
    borderRadius: BakeryRadii.chip,
    paddingVertical: 8,
    paddingHorizontal: Spacing.three,
  },
  resultsLabel: { fontSize: 14, fontWeight: '700', color: BakeryColors.cocoa },
  resultsValue: { fontSize: 16, fontWeight: '900', color: BakeryColors.cocoaDark },
  resultsPrimary: {
    backgroundColor: BakeryColors.jam,
    borderRadius: BakeryRadii.button,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    ...BakeryShadow,
  },
  resultsPrimaryText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  resultsSecondary: { paddingVertical: Spacing.two, alignItems: 'center' },
  resultsSecondaryText: { color: BakeryColors.mocha, fontSize: 14, fontWeight: '800' },

  pressed: { opacity: 0.85 },
});
