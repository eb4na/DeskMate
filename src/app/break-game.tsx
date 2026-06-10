/**
 * Break game screen — accessible only from session-complete after a study session.
 * Hosts a countdown timer + optional game (Tic-Tac-Toe, Connect 4, BatterDash).
 * No coins are earned here.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Companion } from '@/components/companion';
import { HomeTabIcon } from '@/components/tab-icons';
import {
  resolveActiveCompanion,
  resolveProfileFigure,
  type CompanionImageSource,
} from '@/lib/companion-utils';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { getCompanionLine } from '@/constants/companion-lines';
import { Connect4Game } from '@/game/connect4/Connect4Game';
import { joinGameRoom, type GameRoom } from '@/lib/game-net';
import { MaxContentWidth, Spacing } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────
type GameId = 'tictactoe' | 'connect4' | 'cakekitchen';
type Phase = 'select' | 'playing' | 'resting' | 'over';
type TicTacToeMode = 'ai' | 'friend';

// ─── Tic-Tac-Toe ─────────────────────────────────────────────────────────────
type Cell = 'X' | 'O' | null;

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: Cell[]): { winner: Cell | 'draw'; line: number[] | null } {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c])
      return { winner: board[a], line };
  }
  if (board.every((c) => c !== null)) return { winner: 'draw', line: null };
  return { winner: null, line: null };
}

function getAIMove(board: Cell[]): number {
  // Win if possible
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] === 'O' && board[b] === 'O' && !board[c]) return c;
    if (board[a] === 'O' && !board[b] && board[c] === 'O') return b;
    if (!board[a] && board[b] === 'O' && board[c] === 'O') return a;
  }
  // Block player
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] === 'X' && board[b] === 'X' && !board[c]) return c;
    if (board[a] === 'X' && !board[b] && board[c] === 'X') return b;
    if (!board[a] && board[b] === 'X' && board[c] === 'X') return a;
  }
  if (!board[4]) return 4;
  const empty = board.map((c, i) => (c === null ? i : -1)).filter((i) => i !== -1);
  return empty[Math.floor(Math.random() * empty.length)];
}

// ─── Tic-Tac-Toe art ──────────────────────────────────────────────────────────
const TTT_BOARD = require('@/assets/images/tictactoe/board.png');
const TTT_PLATE_PINK = require('@/assets/images/tictactoe/nameplate-pink.png');
const TTT_PLATE_GOLD = require('@/assets/images/tictactoe/nameplate-gold.png');
const TTT_X = require('@/assets/images/tictactoe/piece-x.png');
const TTT_O = require('@/assets/images/tictactoe/piece-o.png');

// Fraction of board.png taken up by the playable 3×3 grid (measured from the
// art: frosting drip adds extra height at the top). Tune here if art changes.
const GRID_INSET = { left: 0.105, right: 0.105, top: 0.135, bottom: 0.105 };
const PLATE_RATIO = 1086 / 1448; // height / width of the nameplate art

// Round window baked into each plate art (centre + diameter as fractions of the
// plate width, measured from the art).
const PINK_FACE = { x: 0.297, y: 0.488, d: 0.225 };
const GOLD_FACE = { x: 0.279, y: 0.529, d: 0.27 };
// Name banner area (fractions of plate width): text + piece live between these.
const BANNER_LEFT = 0.4;
const BANNER_RIGHT = 0.12;

// Head focus in the companion art: face at ~(0.49, 0.21). Framed so the head
// sits near the top of the window and the torso fills the rest — no empty gap.
const HEAD_FX = 0.49;
const HEAD_FY = 0.38;
const HEAD_ZOOM = 1.7;

// Head-and-shoulders placeholder used for human players (no companion art),
// mirroring Connect 4's "you" avatar.
function Silhouette({ size }: { size: number }) {
  return (
    <View style={[plateStyles.sil, { width: size, height: size }]}>
      <View style={{ width: size * 0.4, height: size * 0.4, borderRadius: 999, backgroundColor: '#D8C3B0' }} />
      <View
        style={{
          width: size * 0.7,
          height: size * 0.38,
          marginTop: size * 0.06,
          borderTopLeftRadius: size * 0.4,
          borderTopRightRadius: size * 0.4,
          backgroundColor: '#D8C3B0',
        }}
      />
    </View>
  );
}

// A small player card: companion face in the round window, the player's piece,
// and a name — built on the bakery nameplate art.
function PlayerPlate({
  plate,
  avatar,
  piece,
  label,
  width,
  active,
  isWinner,
  faceCenter,
}: {
  plate: number;
  avatar: CompanionImageSource | null;
  piece: number;
  label: string;
  width: number;
  active: boolean;
  isWinner: boolean;
  faceCenter: { x: number; y: number; d: number };
}) {
  const height = width * PLATE_RATIO;
  const faceD = width * faceCenter.d; // matches the plate's baked round window
  return (
    <View style={[plateStyles.wrap, { width, height, opacity: active || isWinner ? 1 : 0.55 }]}>
      <Image source={plate} style={StyleSheet.absoluteFill} contentFit="contain" />
      <View
        style={[
          plateStyles.face,
          {
            width: faceD,
            height: faceD,
            borderRadius: faceD / 2,
            left: width * faceCenter.x - faceD / 2,
            top: height * faceCenter.y - faceD / 2,
          },
        ]}>
        {avatar ? (
          <Image
            source={avatar}
            style={{
              position: 'absolute',
              width: faceD * HEAD_ZOOM,
              height: faceD * HEAD_ZOOM,
              left: faceD / 2 - HEAD_FX * faceD * HEAD_ZOOM,
              top: faceD / 2 - HEAD_FY * faceD * HEAD_ZOOM,
            }}
            contentFit="cover"
          />
        ) : (
          <Silhouette size={faceD} />
        )}
      </View>
      <View style={[plateStyles.banner, { left: width * BANNER_LEFT, right: width * BANNER_RIGHT }]}>
        <Image source={piece} style={{ width: width * 0.13, height: width * 0.13 }} contentFit="contain" />
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={[plateStyles.label, { fontSize: width * 0.12 }]}>
          {label}
        </ThemedText>
      </View>
      {active && !isWinner && <View style={[plateStyles.turnDot, { left: width * faceCenter.x - 4 }]} />}
    </View>
  );
}

const plateStyles = StyleSheet.create({
  wrap: { position: 'relative' },
  face: { position: 'absolute', overflow: 'hidden', backgroundColor: '#FEECD4' },
  sil: { alignItems: 'center', justifyContent: 'flex-end', backgroundColor: '#F3E7DA' },
  banner: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: { color: '#8A5A3B', flexShrink: 1 },
  turnDot: {
    position: 'absolute',
    bottom: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5BC47A',
  },
});

function TicTacToeGame({
  online,
  onLeave,
}: {
  online?: { room: string; isHost: boolean };
  onLeave?: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    profileCompanionId,
    profileSkinId,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
  } = useApp();
  const { width: winW, height: winH } = useWindowDimensions();
  const boardSize = Math.min(winW - 32, winH * 0.38, 340);
  // Player cards as wide as two fit side-by-side, so the name has real room.
  const cardW = Math.min((winW - 24) / 2, 200);

  // Avatars: "you" use your profile figure; your active companion is the
  // opponent in vs-AI (and the other card in pass-and-play).
  const youAvatar = resolveProfileFigure({
    profileCompanionId,
    profileSkinId,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
  });
  const companion = resolveActiveCompanion(
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
  );
  const oppAvatar = companion.imageSource;

  // Two-step flow like Connect 4: pick the opponent first, then play.
  const [screen, setScreen] = useState<'mode' | 'play'>(online ? 'play' : 'mode');
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [mode, setMode] = useState<TicTacToeMode>('ai');
  const aiMovePending = useRef(false);

  // Online: host plays Hearts (X, moves first), guest plays Stars (O).
  const mySymbol: 'X' | 'O' | null = online ? (online.isHost ? 'X' : 'O') : null;
  const roomRef = useRef<GameRoom | null>(null);
  const [opponentPresent, setOpponentPresent] = useState(false);

  const { winner, line: winLine } = checkWinner(board);
  const gameOver = !!winner;

  const xCount = board.filter((c) => c === 'X').length;
  const oCount = board.filter((c) => c === 'O').length;
  const nextSymbol: 'X' | 'O' = xCount === oCount ? 'X' : 'O';
  const myTurnOnline = mySymbol === nextSymbol;

  const applyMove = (idx: number, symbol: 'X' | 'O') => {
    setBoard((prev) => {
      if (prev[idx] || checkWinner(prev).winner) return prev;
      const nb = [...prev];
      nb[idx] = symbol;
      return nb;
    });
  };

  useEffect(() => {
    if (!online) return;
    roomRef.current = joinGameRoom(online.room, online.isHost, {
      onMessage: (type, data) => {
        if (type === 'move') {
          const d = data as { idx: number; symbol: 'X' | 'O' };
          applyMove(d.idx, d.symbol);
        } else if (type === 'rematch') {
          setBoard(Array(9).fill(null));
        }
      },
      onPresence: setOpponentPresent,
    });
    return () => roomRef.current?.leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetBoard = () => {
    aiMovePending.current = false;
    setBoard(Array(9).fill(null));
    setIsPlayerTurn(true);
  };

  // Mode select → play.
  const chooseMode = (nextMode: TicTacToeMode) => {
    setMode(nextMode);
    resetBoard();
    setScreen('play');
  };

  // Back from the board: return to mode select (offline) or exit (online).
  const backFromPlay = () => {
    if (online) {
      onLeave?.();
      return;
    }
    resetBoard();
    setScreen('mode');
  };

  const handlePress = (idx: number) => {
    if (board[idx] || gameOver) return;
    if (online) {
      if (!mySymbol || !myTurnOnline || !opponentPresent) return;
      applyMove(idx, mySymbol);
      roomRef.current?.send('move', { idx, symbol: mySymbol });
      return;
    }
    if (mode === 'ai' && !isPlayerTurn) return;
    const newBoard = [...board];
    newBoard[idx] = isPlayerTurn ? 'X' : 'O';
    setBoard(newBoard);
    setIsPlayerTurn((turn) => !turn);
  };

  useEffect(() => {
    if (online) return;
    if (mode !== 'ai') return;
    if (isPlayerTurn || gameOver) return;
    const { winner: w } = checkWinner(board);
    if (w) return;
    aiMovePending.current = true;
    const t = setTimeout(() => {
      if (!aiMovePending.current) return;
      const move = getAIMove(board);
      if (move === undefined || move < 0) return;
      const newBoard = [...board];
      newBoard[move] = 'O';
      setBoard(newBoard);
      setIsPlayerTurn(true);
      aiMovePending.current = false;
    }, 400);
    return () => {
      clearTimeout(t);
      aiMovePending.current = false;
    };
  }, [board, gameOver, isPlayerTurn, mode, online]);

  const reset = () => {
    if (online) {
      setBoard(Array(9).fill(null));
      roomRef.current?.send('rematch');
      return;
    }
    resetBoard();
  };

  const statusText = online
    ? gameOver
      ? winner === 'draw'
        ? t('games.draw')
        : winner === mySymbol
          ? t('games.youWinEmoji')
          : t('games.friendWins')
      : !opponentPresent
        ? t('games.waitingFriend')
        : myTurnOnline
          ? t('games.yourTurn')
          : t('games.friendsTurn')
    : gameOver
      ? winner === 'draw'
        ? t('games.draw')
        : mode === 'ai'
          ? winner === 'X'
            ? t('games.youWin')
            : t('games.companionWins')
          : winner === 'X'
            ? t('games.p1Wins')
            : t('games.p2Wins')
      : mode === 'ai'
        ? isPlayerTurn
          ? t('games.yourTurn')
          : t('games.companionThinking')
        : isPlayerTurn
          ? t('games.p1Turn')
          : t('games.p2Turn');

  // Which symbol's plate is highlighted as "to move" (or the winner on game over).
  const activeSymbol: 'X' | 'O' | null = gameOver
    ? winner === 'X' || winner === 'O'
      ? winner
      : null
    : online
      ? nextSymbol
      : isPlayerTurn
        ? 'X'
        : 'O';

  const xLabel = online
    ? mySymbol === 'X'
      ? t('games.you')
      : t('games.friend')
    : mode === 'ai'
      ? t('games.you')
      : t('games.p1');
  const oLabel = online
    ? mySymbol === 'O'
      ? t('games.you')
      : t('games.friend')
    : mode === 'ai'
      ? companion.name
      : t('games.p2');
  // X is "you" except when online and you're playing O.
  const xIsYou = online ? mySymbol === 'X' : true;
  const oIsYou = online ? mySymbol === 'O' : false;
  // Avatars like Connect 4: human players show a silhouette placeholder; only
  // the companion (vs-AI opponent) and your own online card show real art.
  const xAvatar = online ? (xIsYou ? youAvatar : null) : null;
  const oAvatar = online ? (oIsYou ? youAvatar : null) : mode === 'ai' ? oppAvatar : null;

  return (
    <View style={tttStyles.screen}>
      <Image source={TTT_BG} style={StyleSheet.absoluteFill} contentFit="cover" />

      {/* Title */}
      <ThemedText style={[tttStyles.title, { top: insets.top + winH * 0.045 }]}>
        {t('friends.game_tictactoe')}
      </ThemedText>

      {/* Back (to mode select / out) + close */}
      <Pressable
        onPress={screen === 'mode' ? onLeave : backFromPlay}
        hitSlop={10}
        style={({ pressed }) => [tttStyles.circleBtn, { top: insets.top + 6, left: 16 }, pressed && tttStyles.pressed]}>
        <ThemedText style={tttStyles.circleBtnText}>‹</ThemedText>
      </Pressable>
      <Pressable
        onPress={onLeave}
        hitSlop={10}
        style={({ pressed }) => [tttStyles.circleBtn, { top: insets.top + 6, right: 16 }, pressed && tttStyles.pressed]}>
        <ThemedText style={[tttStyles.circleBtnText, { fontSize: 18 }]}>✕</ThemedText>
      </Pressable>

      <View style={[tttStyles.content, { paddingTop: insets.top + winH * 0.12, paddingBottom: insets.bottom + winH * 0.13 }]}>
        {screen === 'mode' ? (
          /* ── Opponent picker (shown first, like Connect 4) ── */
          <>
            <View style={tttStyles.subPill}>
              <ThemedText type="smallBold" style={tttStyles.subPillText}>
                {t('games.chooseOpponent')}
              </ThemedText>
            </View>
            <View style={tttStyles.modeCards}>
              <Pressable
                style={({ pressed }) => [tttStyles.modeCard, pressed && tttStyles.pressed]}
                onPress={() => chooseMode('ai')}>
                <Image source={oppAvatar} style={tttStyles.modeIcon} contentFit="contain" />
                <ThemedText type="smallBold" style={tttStyles.modeTitle}>{t('games.vsAI')}</ThemedText>
                <ThemedText type="small" style={tttStyles.modeSub}>{t('games.playCompanion')}</ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [tttStyles.modeCard, pressed && tttStyles.pressed]}
                onPress={() => chooseMode('friend')}>
                <View style={tttStyles.modePieces}>
                  <Image source={TTT_X} style={tttStyles.modePiece} contentFit="contain" />
                  <Image source={TTT_O} style={[tttStyles.modePiece, { marginLeft: -8 }]} contentFit="contain" />
                </View>
                <ThemedText type="smallBold" style={tttStyles.modeTitle}>{t('games.vsFriend')}</ThemedText>
                <ThemedText type="small" style={tttStyles.modeSub}>{t('games.passAndPlay')}</ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          /* ── Play ── */
          <>
            <View style={tttStyles.cardRow}>
              <PlayerPlate
                plate={TTT_PLATE_PINK}
                avatar={xAvatar}
                piece={TTT_X}
                label={xLabel}
                width={cardW}
                active={activeSymbol === 'X' && !gameOver}
                isWinner={gameOver && winner === 'X'}
                faceCenter={PINK_FACE}
              />
              <PlayerPlate
                plate={TTT_PLATE_GOLD}
                avatar={oAvatar}
                piece={TTT_O}
                label={oLabel}
                width={cardW}
                active={activeSymbol === 'O' && !gameOver}
                isWinner={gameOver && winner === 'O'}
                faceCenter={GOLD_FACE}
              />
            </View>

            {/* Status pill */}
            <View style={tttStyles.statusPill}>
              <ThemedText type="smallBold" style={tttStyles.statusText}>
                {statusText}
              </ThemedText>
            </View>

            {/* Board with overlaid tap grid */}
            <View style={{ width: boardSize, height: boardSize }}>
              <Image source={TTT_BOARD} style={StyleSheet.absoluteFill} contentFit="contain" />
              <View
                style={[
                  tttStyles.grid,
                  {
                    left: boardSize * GRID_INSET.left,
                    right: boardSize * GRID_INSET.right,
                    top: boardSize * GRID_INSET.top,
                    bottom: boardSize * GRID_INSET.bottom,
                  },
                ]}>
                {board.map((cell, i) => {
                  const isWinCell = winLine?.includes(i) ?? false;
                  return (
                    <Pressable
                      key={i}
                      style={({ pressed }) => [tttStyles.cell, pressed && !cell && tttStyles.cellPressed]}
                      onPress={() => handlePress(i)}>
                      {isWinCell && <View style={tttStyles.cellWin} />}
                      {cell === 'X' ? (
                        <Image source={TTT_X} style={tttStyles.piece} contentFit="contain" />
                      ) : cell === 'O' ? (
                        <Image source={TTT_O} style={tttStyles.piece} contentFit="contain" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {gameOver && (
              <Pressable style={tttStyles.resetBtn} onPress={reset}>
                <ThemedText type="smallBold" style={tttStyles.resetBtnText}>
                  {t('games.playAgain')}
                </ThemedText>
              </Pressable>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const tttStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FBE3D0' },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  title: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 26,
    fontWeight: '800',
    color: '#A85A4A',
    letterSpacing: 0.5,
  },
  circleBtn: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  circleBtnText: { fontSize: 24, lineHeight: 28, color: '#C75A78', fontWeight: '700' },
  pressed: { opacity: 0.6 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  // Opponent picker
  subPill: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 7,
  },
  subPillText: { color: '#A85A4A', fontSize: 14 },
  modeCards: { flexDirection: 'row', gap: Spacing.three },
  modeCard: {
    width: 138,
    borderRadius: 22,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,252,248,0.92)',
    borderWidth: 1.5,
    borderColor: '#F4D7DE',
  },
  modeIcon: { width: 76, height: 76 },
  modePieces: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 76 },
  modePiece: { width: 48, height: 48 },
  modeTitle: { color: '#A85A4A', fontSize: 16, textAlign: 'center' },
  modeSub: { color: '#9A8978', textAlign: 'center' },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  statusText: { fontSize: 15, color: '#8A5A3B' },
  grid: {
    position: 'absolute',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '33.333%',
    height: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellPressed: { opacity: 0.5 },
  cellWin: {
    position: 'absolute',
    top: '7%',
    left: '7%',
    right: '7%',
    bottom: '7%',
    borderRadius: 16,
    backgroundColor: 'rgba(255,209,102,0.35)',
  },
  piece: { width: '82%', height: '82%' },
  resetBtn: {
    backgroundColor: '#F2A0B5',
    borderRadius: 999,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  resetBtnText: { color: '#FFF' },
});

const { height: SCREEN_H } = Dimensions.get('window');

// ─── Main Screen ──────────────────────────────────────────────────────────────
const ALLOWED_BREAK_MINUTES = [5, 10, 15];
const CONNECT4_BG = require('@/assets/images/connect4/background.png');
const TTT_BG = require('@/assets/images/tictactoe/background-clean.png');

export default function BreakGameScreen() {
  const { t } = useTranslation();
  const { breakMinutes, fromSession, browse, game, room, role } = useLocalSearchParams<{
    breakMinutes: string;
    fromSession?: string;
    browse?: string;
    game?: string;
    room?: string;
    role?: string;
  }>();
  const { ownedShopItems, isPlus } = useApp();

  // Online entry — opened from a friend invite straight into a networked game.
  const onlineSession =
    game && room && role && (game === 'connect4' || game === 'tictactoe')
      ? { game: game as GameId, room, isHost: role === 'host' }
      : null;

  // "browse" = opened from the Home game button (not a real study break): no
  // break timer, no study framing — just pick a game.
  const isBrowse = browse === '1' || !!onlineSession;
  const parsedMinutes = parseInt(breakMinutes ?? '', 10);
  const validEntry =
    !!onlineSession || isBrowse || (fromSession === '1' && ALLOWED_BREAK_MINUTES.includes(parsedMinutes));

  const returnToTabs = () => {
    if (router.canDismiss()) {
      router.dismissAll();
      return;
    }
    router.replace('/');
  };

  useEffect(() => {
    if (!validEntry) returnToTabs();
  }, [validEntry]);

  const totalSeconds = validEntry ? parsedMinutes * 60 : 0;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [phase, setPhase] = useState<Phase>(onlineSession ? 'playing' : 'select');
  const [selectedGame, setSelectedGame] = useState<GameId | null>(onlineSession?.game ?? null);
  const breakOverLine = useMemo(() => getCompanionLine('breakOver'), []);

  const startResting = () => {
    setSelectedGame(null);
    setPhase('resting');
  };

  const showGames = () => {
    setSelectedGame(null);
    setPhase('select');
  };

  useEffect(() => {
    if (!validEntry || isBrowse || phase === 'over') return;
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          setPhase('over');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, validEntry]);

  const goHome = () => {
    returnToTabs();
  };

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const pct = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;

  const GAMES: { id: GameId; nameKey: string; emoji: string; free: boolean; shopItemId: string | null; route?: string; icon?: number; tint: string; featured?: boolean }[] = [
    { id: 'cakekitchen', nameKey: 'friends.game_batterdash', emoji: '🎂', free: true, shopItemId: null, route: '/cake-game', icon: require('@/assets/images/cake/batterdash-banner.png'), tint: '#FBE0E6', featured: true },
    { id: 'tictactoe', nameKey: 'friends.game_tictactoe', emoji: '⭕', free: true, shopItemId: null, icon: require('@/assets/images/tictactoe/thumbnail.png'), tint: '#FBEAD2' },
    { id: 'connect4', nameKey: 'friends.game_connect4', emoji: '🔴', free: true, shopItemId: null, icon: require('@/assets/images/games/connect4.png'), tint: '#DFEAF4' },
  ];
  const featuredGame = GAMES.find((g) => g.featured);
  const gridGames = GAMES.filter((g) => !g.featured);

  // Connect 4 can always be opened — a friend who owns it (or has Plus) can host
  // you online even if you don't own it yourself.
  const gameState = (g: (typeof GAMES)[number]) => {
    const unlocked = g.free || isPlus || (g.shopItemId ? ownedShopItems.includes(g.shopItemId) : false);
    return { unlocked, canOpen: unlocked || g.id === 'connect4' };
  };
  const openGame = (g: (typeof GAMES)[number], canOpen: boolean) => {
    if (!canOpen) return;
    if (g.route) {
      router.push(g.route as never);
      return;
    }
    setSelectedGame(g.id);
    setPhase('playing');
  };
  const subtitleFor = (g: (typeof GAMES)[number], unlocked: boolean) =>
    unlocked
      ? g.free
        ? t('games.freeToPlay')
        : isPlus
          ? t('games.includedPlus')
          : t('games.unlocked')
      : g.id === 'connect4'
        ? t('games.playFriendFree')
        : t('games.getPlusUnlock');

  if (!validEntry) return null;

  if (phase === 'over') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Companion pose="cheering" size="full" />
          <ThemedView style={styles.overBlock}>
            <ThemedText type="subtitle" style={styles.overTitle}>
              {t('games.breakTimeUp')}
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.bubbleCard}>
              <ThemedText type="small" style={styles.bubbleText}>{breakOverLine}</ThemedText>
            </ThemedView>
          </ThemedView>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={goHome}>
            <ThemedText type="smallBold" style={styles.primaryBtnText}>
              {t('games.backToStudying')}
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const connect4Active = phase === 'playing' && selectedGame === 'connect4';
  const tictactoeActive = phase === 'playing' && selectedGame === 'tictactoe';

  // Tic-Tac-Toe takes over the whole screen with its own bakery scene.
  if (tictactoeActive) {
    return (
      <TicTacToeGame
        online={
          onlineSession?.game === 'tictactoe'
            ? { room: onlineSession.room, isHost: onlineSession.isHost }
            : undefined
        }
        onLeave={onlineSession ? goHome : showGames}
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      {connect4Active && (
        <Image source={CONNECT4_BG} style={styles.connect4Bg} contentFit="cover" />
      )}
      <SafeAreaView style={styles.safeArea}>
        {/* Break timer — only during a real study break, not when browsing */}
        {!isBrowse && (
          <ThemedView type="backgroundElement" style={styles.timerBar}>
            <ThemedText style={styles.timerEmoji}>🕐</ThemedText>
            <ThemedView style={styles.timerContent}>
              <ThemedView style={styles.timerRow}>
                <ThemedText type="smallBold">{t('games.breakEndsIn')}</ThemedText>
                <ThemedText type="smallBold" style={styles.timerCount}>
                  {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.progressTrack}>
                <ThemedView style={[styles.progressFill, { width: `${pct}%` as unknown as number }]} />
              </ThemedView>
            </ThemedView>
          </ThemedView>
        )}

        {phase === 'select' ? (
          // The game picker is styled like a little phone, with the home button
          // sitting on the "chin" below the screen.
          <View style={styles.phoneFrame}>
            <View style={styles.phoneNotch} />
            <View style={styles.phoneScreen}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.phoneScreenContent}>
                <ThemedView style={styles.selectContent}>
              <ThemedView style={styles.selectHeader}>
                <ThemedText style={styles.selectTitle}>
                  {t('games.chooseGame')}
                </ThemedText>
                {!isBrowse && (
                  <ThemedText type="small" style={styles.selectSubtitle}>
                    {t('games.noCoinsBreaks')}
                  </ThemedText>
                )}
              </ThemedView>

              {/* Featured game — large hero banner */}
              {featuredGame && (() => {
                const g = featuredGame;
                const { canOpen } = gameState(g);
                return (
                  <Pressable
                    style={({ pressed }) => [
                      styles.featuredCard,
                      !canOpen && styles.gameCardLocked,
                      pressed && canOpen && styles.pressed,
                    ]}
                    onPress={() => openGame(g, canOpen)}>
                    <Image source={g.icon} style={styles.featuredArt} contentFit="cover" />
                  </Pressable>
                );
              })()}

              {/* Other games — card grid */}
              <ThemedView style={styles.gameGrid}>
                {gridGames.map((g) => {
                  const { unlocked, canOpen } = gameState(g);
                  return (
                    <Pressable
                      key={g.id}
                      style={({ pressed }) => [
                        styles.gridCard,
                        !canOpen && styles.gameCardLocked,
                        pressed && canOpen && styles.pressed,
                      ]}
                      onPress={() => openGame(g, canOpen)}>
                      <View style={styles.gridImageWrap}>
                        {g.icon ? (
                          <Image source={g.icon} style={styles.gridImage} contentFit="cover" />
                        ) : (
                          <ThemedText style={styles.gridEmoji}>{g.emoji}</ThemedText>
                        )}
                        {!g.free && (
                          <ThemedView style={styles.plusBadge}>
                            <ThemedText style={styles.plusBadgeText}>{t('games.plus')}</ThemedText>
                          </ThemedView>
                        )}
                      </View>
                      <ThemedText type="smallBold" numberOfLines={1}>{t(g.nameKey)}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {subtitleFor(g, unlocked)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ThemedView>

              {!isBrowse && (
                <Pressable onPress={startResting} style={styles.restBtn}>
                  <ThemedText type="linkPrimary">{t('games.justRest')}</ThemedText>
                </Pressable>
              )}
                </ThemedView>
              </ScrollView>
            </View>
            {/* Phone "chin" with the home button */}
            <View style={styles.phoneChin}>
              <Pressable
                style={({ pressed }) => [styles.homeBtn, pressed && styles.pressed]}
                onPress={goHome}
                hitSlop={8}
                accessibilityLabel={t('nav.home')}>
                <HomeTabIcon color="#D86F9C" size={26} />
              </Pressable>
            </View>
          </View>
        ) : phase === 'resting' ? (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollFlex}>
            <ThemedView style={styles.restContent}>
              <Companion pose="idle" size="full" />
              <ThemedView type="backgroundElement" style={styles.restCard}>
                <ThemedText type="subtitle" style={styles.restTitle}>
                  {t('games.restALittle')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.restText}>
                  {t('games.restText')}
                </ThemedText>
              </ThemedView>

              <Pressable onPress={showGames} style={styles.backGameBtn}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('games.chooseGameInstead')}
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ScrollView>
        ) : selectedGame === 'connect4' ? (
          // Connect 4 fills the screen so its footer can pin to the bottom.
          <View style={styles.connect4Fill}>
            <Connect4Game
              online={onlineSession?.game === 'connect4' ? { room: onlineSession.room, isHost: onlineSession.isHost } : undefined}
              onLeave={showGames}
            />
          </View>
        ) : null}

        {phase !== 'playing' && phase !== 'select' &&
          (isBrowse ? (
            <Pressable
              style={({ pressed }) => [styles.homeBtn, pressed && styles.pressed]}
              onPress={goHome}
              hitSlop={8}
              accessibilityLabel={t('nav.home')}>
              <HomeTabIcon color="#D86F9C" size={26} />
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.endStudyBtn, pressed && styles.pressed]}
              onPress={goHome}>
              <ThemedText type="smallBold" style={styles.endStudyBtnText}>
                End study
              </ThemedText>
            </Pressable>
          ))}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  connect4Bg: { position: 'absolute', top: -SCREEN_H * 0.06, left: 0, right: 0, height: SCREEN_H * 1.06 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  scrollFlex: { flex: 1 },
  // "Phone" frame around the game picker
  phoneFrame: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#F2C6D6',
    paddingTop: 14,
    paddingHorizontal: 10,
    paddingBottom: 6,
    alignItems: 'center',
    shadowColor: '#C98AA0',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  phoneNotch: {
    width: 56,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F2C6D6',
    marginBottom: 8,
  },
  phoneScreen: {
    flex: 1,
    width: '100%',
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#FFFDFB',
    borderWidth: 1.5,
    borderColor: '#F6DDE7',
  },
  phoneScreenContent: { padding: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.three },
  phoneChin: { height: 58, alignItems: 'center', justifyContent: 'center' },
  timerBar: {
    borderRadius: 16,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  timerEmoji: { fontSize: 24, lineHeight: 30 },
  timerContent: { flex: 1, gap: 6 },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timerCount: { color: '#F5A623', fontSize: 16 },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#7C6F5A' },
  selectContent: { gap: Spacing.three, paddingBottom: Spacing.four },
  selectHeader: { alignItems: 'center', gap: 4, paddingTop: Spacing.one, backgroundColor: 'transparent' },
  selectTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    color: '#D86F9C',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  selectSubtitle: { textAlign: 'center', color: '#A98C86' },
  gameCardLocked: { opacity: 0.5 },
  // Featured hero banner (BatterDash)
  featuredCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  featuredArt: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 20,
  },
  // Card grid for the remaining games
  gameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  gridCard: {
    width: '48%',
    gap: 4,
  },
  gridImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridImage: { width: '100%', height: '100%' },
  gridEmoji: { fontSize: 64, lineHeight: 72 },
  plusBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    backgroundColor: 'rgba(242,160,181,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    zIndex: 1,
  },
  plusBadgeText: {
    color: '#C75A78',
    fontSize: 11,
    fontWeight: '700',
  },
  restBtn: { alignItems: 'center', paddingVertical: Spacing.two },
  restContent: {
    gap: Spacing.three,
    alignItems: 'center',
    paddingBottom: Spacing.four,
  },
  restCard: {
    width: '100%',
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
    alignItems: 'center',
  },
  restTitle: { fontSize: 22, lineHeight: 28 },
  restText: { textAlign: 'center', lineHeight: 22 },
  gameContainer: {
    gap: Spacing.three,
    alignItems: 'center',
    paddingBottom: Spacing.four,
    backgroundColor: 'transparent',
  },
  connect4Fill: { flex: 1, width: '100%' },
  backGameBtn: { alignSelf: 'flex-start' },
  closeBtn: {
    alignSelf: 'flex-start',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 252, 248, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 18, fontWeight: '700', color: '#7C6F5A', lineHeight: 22 },
  endStudyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    borderWidth: 1.5,
    borderColor: '#7C6F5A',
    backgroundColor: 'rgba(124,111,90,0.12)',
  },
  endStudyBtnText: {
    color: '#7C6F5A',
    fontSize: 16,
  },
  homeBtn: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F2A0B5',
    backgroundColor: 'rgba(242,160,181,0.16)',
  },
  pressed: { opacity: 0.8 },
  // Over phase
  overBlock: { alignItems: 'center', gap: Spacing.three },
  overTitle: { fontSize: 24, lineHeight: 30 },
  bubbleCard: {
    borderRadius: 16,
    padding: Spacing.three,
    alignItems: 'center',
    width: '100%',
  },
  bubbleText: { textAlign: 'center', lineHeight: 22, fontStyle: 'italic' },
  primaryBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 16,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFF', fontSize: 16 },
});
