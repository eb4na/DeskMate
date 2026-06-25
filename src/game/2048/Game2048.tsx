/**
 * 2048 — single-player sliding-tile break game. Self-contained full-screen scene
 * (matches the Tic-Tac-Toe / Connect 4 pattern): only needs an `onLeave` prop.
 *
 * Tiles are tracked by stable id (see src/game/2048/logic.ts); each one owns an
 * Animated position + scale so a swipe visually slides every tile to its new cell,
 * then merges pop and a fresh tile pops in.
 *
 * ART: the scene is code-drawn for now (watery background, "2048" wordmark, tiles,
 * panels) so it works before art lands. To swap in the supplied PNGs later, see the
 * clearly-marked slots below and `assets/images/2048/` (background.png, title.png,
 * tile-<value>.png). Tile faces stay asset-driven via TILE_ART with a code-drawn
 * fallback, because tile values are dynamic.
 */
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { FitText } from '@/components/fit-text';
import { ThemedText } from '@/components/themed-text';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { playPop, playSwoosh } from '@/lib/sounds';
import { BakeryShadow, Spacing } from '@/constants/theme';
import { hasMoves, slide, spawnTile, WIN_VALUE, type Dir, type Tile } from '@/game/2048/logic';

// Shared simple arrow back button — same art across all break games.
const BACK_ARROW = require('@/assets/images/common/back-arrow.png');
// Scene art (supplied). BG the water/ramune scene, TITLE the "2048" wordmark,
// BOARD the 4×4 glass grid frame.
const BG = require('@/assets/images/2048/background.png');
const TITLE = require('@/assets/images/2048/title.png');
const BOARD = require('@/assets/images/2048/board.png');

// Cell centres in board.png, as fractions of the (square) board size. Measured
// from the art (see scripts note) — rows/cols are slightly different on purpose.
const CX = [0.2004, 0.3996, 0.5981, 0.7985];
const CY = [0.1946, 0.4074, 0.6169, 0.8252];

// Optional per-value tile art. Add entries as PNGs land, e.g.
//   2: require('@/assets/images/2048/tile-2.png'),
// Any value without art falls back to the code-drawn pastel tile below.
const TILE_ART: Record<number, number> = {};

// Per-value pastel face + text colour (cozy ramune palette from the mockup).
const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  2: { bg: '#FBEAD9', fg: '#9C7B5B' },
  4: { bg: '#FBDCE6', fg: '#B5708A' },
  8: { bg: '#F8C9D7', fg: '#A85A74' },
  16: { bg: '#F8CBB0', fg: '#A56A4A' },
  32: { bg: '#FBE3A8', fg: '#A8842E' },
  64: { bg: '#DCEDBE', fg: '#6E8A3E' },
  128: { bg: '#BFE6D6', fg: '#3E8A6E' },
  256: { bg: '#C5E1F3', fg: '#3E6E8A' },
  512: { bg: '#CCD4F1', fg: '#5A5FA8' },
  1024: { bg: '#E1CDEF', fg: '#7A5AA8' },
  2048: { bg: '#F6C16B', fg: '#FFFFFF' },
};
const BIG_TILE = { bg: '#E48A9A', fg: '#FFFFFF' };
const tileColors = (v: number) => TILE_COLORS[v] ?? BIG_TILE;

type Anim = { pos: Animated.ValueXY; scale: Animated.Value };

function RefreshIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill={color}
        d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
      />
    </Svg>
  );
}

export function Game2048({ onLeave }: { onLeave?: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { game2048Best, recordGame2048Best } = useApp();
  const { width: winW, height: winH } = useWindowDimensions();

  // Board sizing straight off the screen (no tablet flag) so a big iPad gets a big
  // board while phones keep a sensible floor.
  const geo = useMemo(() => {
    const size = Math.min(winW - 32, winH * 0.5, Math.max(300, Math.min(winW, winH) * 0.82));
    const tileSize = size * 0.184; // ≈ a cell's interior; tiles sit on the art's cells
    const tx = (col: number) => CX[col] * size - tileSize / 2; // tile top-left x
    const ty = (row: number) => CY[row] * size - tileSize / 2; // tile top-left y
    return { size, tileSize, tx, ty };
  }, [winW, winH]);

  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [won, setWon] = useState(false);
  const [keepGoing, setKeepGoing] = useState(false);
  const [over, setOver] = useState(false);

  const animRef = useRef<Map<number, Anim>>(new Map());
  const nextId = useRef(1);
  const animatingRef = useRef(false);

  const ensureAnim = (tile: Tile): Anim => {
    let a = animRef.current.get(tile.id);
    if (!a) {
      a = {
        pos: new Animated.ValueXY({ x: geo.tx(tile.col), y: geo.ty(tile.row) }),
        scale: new Animated.Value(1),
      };
      animRef.current.set(tile.id, a);
    }
    return a;
  };

  const popIn = (a: Anim) => {
    a.scale.setValue(0);
    Animated.spring(a.scale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
  };
  const popMerge = (a: Anim) => {
    Animated.sequence([
      Animated.timing(a.scale, { toValue: 1.16, duration: 80, useNativeDriver: true }),
      Animated.timing(a.scale, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start();
  };

  const startGame = () => {
    animRef.current.clear();
    let id = 1;
    const first = spawnTile([], id++)!;
    const second = spawnTile([first], id++)!;
    nextId.current = id;
    setTiles([first, second]);
    setScore(0);
    setWon(false);
    setKeepGoing(false);
    setOver(false);
    [first, second].forEach((tile) => popIn(ensureAnim(tile)));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => startGame(), []);

  // Re-snap tiles to their cells if the board is resized (e.g. rotation).
  useEffect(() => {
    tiles.forEach((tile) => {
      const a = animRef.current.get(tile.id);
      if (a) a.pos.setValue({ x: geo.tx(tile.col), y: geo.ty(tile.row) });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.size]);

  const onMove = (dir: Dir) => {
    if (animatingRef.current || over) return;
    if (won && !keepGoing) return; // win overlay open — block play until they choose
    const res = slide(tiles, dir);
    if (!res.moved) return;

    animatingRef.current = true;
    playSwoosh();

    const anims: Animated.CompositeAnimation[] = [];
    const toCell = (a: Anim, row: number, col: number) =>
      Animated.timing(a.pos, {
        toValue: { x: geo.tx(col), y: geo.ty(row) },
        duration: 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
    res.tiles.forEach((tile) => anims.push(toCell(ensureAnim(tile), tile.row, tile.col)));
    res.removed.forEach((r) => {
      const a = animRef.current.get(r.id);
      if (a) anims.push(toCell(a, r.row, r.col));
    });

    Animated.parallel(anims).start(() => {
      res.removed.forEach((r) => animRef.current.delete(r.id));
      if (res.mergedIds.length) playPop();
      res.mergedIds.forEach((id) => {
        const a = animRef.current.get(id);
        if (a) popMerge(a);
      });

      const spawned = spawnTile(res.tiles, nextId.current++);
      const finalTiles = spawned ? [...res.tiles, spawned] : res.tiles;
      if (spawned) popIn(ensureAnim(spawned));

      setTiles(finalTiles);
      const newScore = score + res.gained;
      setScore(newScore);
      recordGame2048Best(newScore);

      if (!won && res.tiles.some((tile) => tile.value >= WIN_VALUE)) setWon(true);
      else if (!hasMoves(finalTiles)) setOver(true);

      animatingRef.current = false;
    });
  };

  // PanResponder is created once, so route through a ref to avoid stale closures.
  const moveRef = useRef(onMove);
  moveRef.current = onMove;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 || Math.abs(g.dy) > 12,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 24 && Math.abs(g.dy) < 24) return;
        if (Math.abs(g.dx) > Math.abs(g.dy)) moveRef.current(g.dx > 0 ? 'right' : 'left');
        else moveRef.current(g.dy > 0 ? 'down' : 'up');
      },
    }),
  ).current;

  const best = Math.max(game2048Best, score);

  return (
    <View style={styles.screen}>
      {/* Watery ramune background scene */}
      <Image source={BG} style={StyleSheet.absoluteFill} contentFit="cover" />

      <SafeAreaView style={styles.safe}>
        {/* Back button */}
        <Pressable
          onPress={() => onLeave?.()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, { top: insets.top + 2, left: 8 }, pressed && styles.pressed]}>
          <Image source={BACK_ARROW} style={styles.backImg} contentFit="contain" />
        </Pressable>

        {/* Wordmark + subtitle (art includes "~ Join the numbers! ~") */}
        <Image source={TITLE} style={styles.title} contentFit="contain" />

        {/* Chat bubble */}
        <View style={styles.chatBubble}>
          <ThemedText type="small" style={styles.chatText}>
            {t('games.g2048Bubble')}
          </ThemedText>
        </View>

        {/* Score / Best / Restart */}
        <View style={styles.panelRow}>
          <View style={styles.statPanel}>
            <ThemedText style={styles.statLabel}>{t('games.score')}</ThemedText>
            <FitText style={styles.statValue} numberOfLines={1} minScale={0.4}>
              {String(score)}
            </FitText>
          </View>
          <View style={styles.statPanel}>
            <ThemedText style={styles.statLabel}>{t('games.best')}</ThemedText>
            <FitText style={styles.statValue} numberOfLines={1} minScale={0.4}>
              {String(best)}
            </FitText>
          </View>
          <Pressable
            onPress={startGame}
            style={({ pressed }) => [styles.restartBtn, pressed && styles.pressed]}
            accessibilityLabel={t('games.restart')}>
            <RefreshIcon size={26} color="#5A8FB0" />
            <ThemedText style={styles.restartText}>{t('games.restart')}</ThemedText>
          </Pressable>
        </View>

        {/* Board — the grid frame is the supplied art; tiles sit on its cells. */}
        <View {...pan.panHandlers} style={[styles.board, { width: geo.size, height: geo.size }]}>
          <Image source={BOARD} style={StyleSheet.absoluteFill} contentFit="contain" />

          {/* Tiles */}
          {tiles.map((tile) => {
            const a = animRef.current.get(tile.id) ?? ensureAnim(tile);
            const colors = tileColors(tile.value);
            const art = TILE_ART[tile.value];
            return (
              <Animated.View
                key={tile.id}
                style={[
                  styles.tile,
                  {
                    width: geo.tileSize,
                    height: geo.tileSize,
                    transform: [...a.pos.getTranslateTransform(), { scale: a.scale }],
                  },
                ]}>
                {art ? (
                  <Image source={art} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                ) : (
                  <View
                    style={[
                      styles.tileFace,
                      { backgroundColor: colors.bg, borderRadius: geo.tileSize * 0.2 },
                    ]}>
                    <FitText
                      style={[styles.tileNum, { color: colors.fg, fontSize: geo.tileSize * 0.42 }]}
                      numberOfLines={1}
                      minScale={0.4}>
                      {String(tile.value)}
                    </FitText>
                  </View>
                )}
              </Animated.View>
            );
          })}
        </View>

        {/* Win / Game-over overlays */}
        {(won && !keepGoing) || over ? (
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.overlayCard}>
              <ThemedText type="subtitle" style={styles.overlayTitle}>
                {over ? t('games.noMoves') : t('games.made2048')}
              </ThemedText>
              <ThemedText type="small" style={styles.overlayScore}>
                {t('games.score')}: {score}
              </ThemedText>
              <View style={styles.overlayBtns}>
                {won && !over && (
                  <Pressable
                    onPress={() => setKeepGoing(true)}
                    style={({ pressed }) => [styles.overlayBtn, pressed && styles.pressed]}>
                    <ThemedText type="smallBold" style={styles.overlayBtnText}>
                      {t('games.keepGoing')}
                    </ThemedText>
                  </Pressable>
                )}
                <Pressable
                  onPress={startGame}
                  style={({ pressed }) => [styles.overlayBtn, styles.overlayBtnAlt, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={styles.overlayBtnAltText}>
                    {over ? t('games.tryAgain') : t('games.restart')}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const PANEL_BG = 'rgba(255,255,255,0.72)';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#C9E9F4' },
  safe: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.three, gap: Spacing.two, justifyContent: 'center' },
  backBtn: { position: 'absolute', width: 58, height: 58, zIndex: 5 },
  backImg: { width: 58, height: 58 },
  pressed: { opacity: 0.7 },
  title: { width: '72%', aspectRatio: 1224 / 430, alignSelf: 'center' },
  chatBubble: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    ...BakeryShadow,
  },
  chatText: { color: '#7A8FA0' },
  panelRow: { flexDirection: 'row', alignItems: 'stretch', gap: Spacing.two, marginTop: Spacing.one },
  statPanel: {
    minWidth: 92,
    borderRadius: 16,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    backgroundColor: PANEL_BG,
    ...BakeryShadow,
  },
  statLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, color: '#8FB4C6' },
  statValue: { fontSize: 24, lineHeight: 30, fontWeight: '800', color: '#4E7E96' },
  restartBtn: {
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: PANEL_BG,
    ...BakeryShadow,
  },
  restartText: { fontSize: 11, fontWeight: '700', color: '#5A8FB0' },
  board: { position: 'relative', marginTop: Spacing.two },
  tile: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  tileFace: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    ...BakeryShadow,
  },
  tileNum: { fontWeight: '800', textAlign: 'center', paddingHorizontal: 2 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(120,180,205,0.35)' },
  overlayCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 22,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    gap: Spacing.two,
    ...BakeryShadow,
  },
  // Bubbly treatment of the system rounded font to echo the puffy "2048" wordmark.
  overlayTitle: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '900',
    color: '#5BA9CE',
    letterSpacing: 0.6,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  overlayScore: { color: '#7A8FA0' },
  overlayBtns: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  overlayBtn: { backgroundColor: '#69B7D6', borderRadius: 999, paddingHorizontal: Spacing.four, paddingVertical: 10 },
  overlayBtnText: { color: '#FFF' },
  overlayBtnAlt: { backgroundColor: 'rgba(105,183,214,0.15)' },
  overlayBtnAltText: { color: '#4E7E96' },
});
