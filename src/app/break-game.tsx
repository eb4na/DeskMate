/**
 * Break game screen — accessible only from session-complete after a study session.
 * Hosts a countdown timer + optional game (Tic-Tac-Toe, Connect 4, BatterDash).
 * No coins are earned here.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { showPopup } from '@/lib/popup';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Companion } from '@/components/companion';
import { DevKnobs } from '@/components/dev-knobs';
import { GameRulesButton } from '@/components/game-rules-button';
import { SimpleHomeIcon } from '@/components/tab-icons';
import { usePosTweaks } from '@/hooks/use-pos-tweaks';
import {
  getCompanionImage,
  localizeCompanionName,
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
import { Game2048 } from '@/game/2048/Game2048';
import { joinGameRoom, type GameRoom, type PlayerMeta } from '@/lib/game-net';
import { playTap } from '@/lib/sounds';
import { showLoadingScreen } from '@/lib/loading-signal';
import { BakeryShadow, MaxContentWidth, Spacing } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────
type GameId = 'tictactoe' | 'connect4' | 'cakekitchen' | '2048';
type Phase = 'select' | 'playing' | 'resting' | 'over';
type TicTacToeMode = 'ai' | 'friend' | 'online';

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
const TTT_X = require('@/assets/images/tictactoe/piece-x.png');
const TTT_O = require('@/assets/images/tictactoe/piece-o.png');
// Shared arrow back button — same art across all break games.
const BACK_ARROW = require('@/assets/images/common/back-arrow.png');
// Tic-Tac-Toe wordmark, shown on the opponent picker.
const TTT_TITLE = require('@/assets/images/tictactoe/title.png');

// Fraction of board.png taken up by the playable 3×3 grid (measured from the
// art: frosting drip adds extra height at the top). Tune here if art changes.
const GRID_INSET = { left: 0.105, right: 0.105, top: 0.135, bottom: 0.105 };

// Per-player accent palette, keyed by the player's piece symbol.
const ACCENT = {
  X: { border: '#F2A6C0', chip: '#FCE4EC', ink: '#D9568A' },
  O: { border: '#E8B04B', chip: '#FBF0D8', ink: '#C98A1E' },
} as const;

// Avatar framing for full-body companion art (head sits near the top of the
// image). The image fills the circle, then a centred scale + downward shift
// brings the head to the middle — filling guarantees perfect horizontal centring.
const AVATAR_ZOOM = 1.6;
const AVATAR_DY = 0.14; // fraction of the avatar diameter to shift the head down

// Head-and-shoulders placeholder used for human players (no companion art).
function Silhouette({ size }: { size: number }) {
  return (
    <View style={[plateStyles.sil, { width: size, height: size }]}>
      <View style={{ width: size * 0.4, height: size * 0.4, borderRadius: 999, backgroundColor: '#F2A0B5' }} />
      <View
        style={{
          width: size * 0.7,
          height: size * 0.38,
          marginTop: size * 0.06,
          borderTopLeftRadius: size * 0.4,
          borderTopRightRadius: size * 0.4,
          backgroundColor: '#F2A0B5',
        }}
      />
    </View>
  );
}

// A compact player card (code-built): a centred avatar circle, the player's
// name, and a chip showing which piece (X / O) they're using.
function PlayerPlate({
  avatar,
  piece,
  label,
  width,
  active,
  isWinner,
  symbol,
}: {
  avatar: CompanionImageSource | null;
  piece: number;
  label: string;
  width: number;
  active: boolean;
  isWinner: boolean;
  symbol: 'X' | 'O';
}) {
  const c = ACCENT[symbol];
  const avatarD = Math.round(width * 0.3);
  const highlight = active || isWinner;
  return (
    <View
      style={[
        plateStyles.card,
        { width, borderColor: c.border, opacity: highlight ? 1 : 0.6 },
        highlight && { borderWidth: 2.5, shadowColor: c.border, shadowOpacity: 0.9, shadowRadius: 8 },
      ]}>
      <View
        style={[
          plateStyles.avatar,
          { width: avatarD, height: avatarD, borderRadius: avatarD / 2, borderColor: c.border },
        ]}>
        {avatar ? (
          <Image
            source={avatar}
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateY: avatarD * AVATAR_DY }, { scale: AVATAR_ZOOM }] },
            ]}
            contentFit="cover"
          />
        ) : (
          <Silhouette size={avatarD} />
        )}
      </View>
      <View style={plateStyles.info}>
        <ThemedText
          type="smallBold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={plateStyles.name}>
          {label}
        </ThemedText>
        <View style={[plateStyles.chip, { backgroundColor: c.chip }]}>
          <Image source={piece} style={plateStyles.chipPiece} contentFit="contain" />
          <ThemedText type="smallBold" style={[plateStyles.chipText, { color: c.ink }]}>
            {symbol}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const plateStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: '#FFF7EE',
    ...BakeryShadow,
  },
  avatar: {
    overflow: 'hidden',
    backgroundColor: '#FEECD4',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sil: { alignItems: 'center', justifyContent: 'flex-end', backgroundColor: '#F3E7DA' },
  info: { flex: 1, minWidth: 0, gap: 5 },
  // No fixed lineHeight here: this label uses adjustsFontSizeToFit, and a pinned
  // lineHeight breaks the auto-shrink (clips instead of shrinking — worst on
  // tablet). ThemedText derives a proportional lineHeight from fontSize.
  name: { color: '#8A5A3B', fontSize: 15 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipPiece: { width: 18, height: 18 },
  chipText: { fontSize: 13, fontWeight: '800' },
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
    profileDisplayName,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
    friendCode,
  } = useApp();
  const { width: winW, height: winH } = useWindowDimensions();
  // Board scales straight off the screen size: big iPads get a big board, while
  // phones keep the familiar 340 floor. Driven by raw dimensions (not the tablet
  // flag) so it still grows even when the dev device-class preview forces phone.
  const boardSize = Math.min(
    winW - 32,
    winH * 0.6,
    Math.max(340, Math.min(winW, winH) * 0.8),
  );
  // Player cards as wide as two fit side-by-side, so the name has real room;
  // they scale up on larger screens to stay proportional to the board.
  const cardW = Math.min((winW - 24) / 2, Math.max(200, Math.min(winW, winH) * 0.28));
  // Large-screen flag (raw dimensions, not the tablet flag) — used to scale the
  // opponent-picker cards up on big iPads.
  const largeScreen = Math.min(winW, winH) >= 600;
  const modeCardBig = largeScreen ? { maxWidth: 250, paddingVertical: 40, borderRadius: 34, gap: 16 } : null;
  const modeIconBig = largeScreen ? { width: 104, height: 104 } : null;
  const modePiecesBig = largeScreen ? { height: 104 } : null;
  const modePieceBig = largeScreen ? { width: 62, height: 62 } : null;
  const modeTitleBig = largeScreen ? { fontSize: 23 } : null;
  const modeSubBig = largeScreen ? { fontSize: 15 } : null;
  const subPillBig = largeScreen ? { paddingHorizontal: 26, paddingVertical: 11 } : null;
  const subPillTextBig = largeScreen ? { fontSize: 18 } : null;

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

  // Whether this game came from an external friend invite (skip the picker; the
  // back button exits straight out instead of returning to it).
  const externalInvite = !!online;

  // Three-way flow like Connect 4: pick the opponent, (online) lobby, then play.
  const [screen, setScreen] = useState<'mode' | 'lobby' | 'play'>(externalInvite ? 'lobby' : 'mode');
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  // Which symbol moves first this game. Online: the host picks it at random and
  // broadcasts so the opener isn't always the host (Hearts/X). Default X.
  const [firstSymbol, setFirstSymbol] = useState<'X' | 'O'>('X');
  const [mode, setMode] = useState<TicTacToeMode>(externalInvite ? 'online' : 'ai');
  const aiMovePending = useRef(false);

  // Online state — host plays Hearts (X, moves first), guest plays Stars (O).
  const [mySymbol, setMySymbol] = useState<'X' | 'O' | null>(online ? (online.isHost ? 'X' : 'O') : null);
  const [opponentPresent, setOpponentPresent] = useState(false);
  const [oppMeta, setOppMeta] = useState<PlayerMeta | null>(null);
  const [connecting, setConnecting] = useState(externalInvite);
  const roomRef = useRef<GameRoom | null>(null);
  const screenRef = useRef<'mode' | 'lobby' | 'play'>(externalInvite ? 'lobby' : 'mode');
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const isOnline = mode === 'online';

  const { winner, line: winLine } = checkWinner(board);
  const gameOver = !!winner;

  const xCount = board.filter((c) => c === 'X').length;
  const oCount = board.filter((c) => c === 'O').length;
  // Moves alternate from `firstSymbol`: even total → first mover, odd → the other.
  const otherSymbol: 'X' | 'O' = firstSymbol === 'X' ? 'O' : 'X';
  const nextSymbol: 'X' | 'O' = (xCount + oCount) % 2 === 0 ? firstSymbol : otherSymbol;
  const myTurnOnline = mySymbol === nextSymbol;

  const applyMove = (idx: number, symbol: 'X' | 'O') => {
    setBoard((prev) => {
      if (prev[idx] || checkWinner(prev).winner) return prev;
      const nb = [...prev];
      nb[idx] = symbol;
      return nb;
    });
  };

  const leaveRoom = () => {
    roomRef.current?.leave();
    roomRef.current = null;
  };
  useEffect(() => () => leaveRoom(), []);

  // Join (or host) an online room. Presence flips the lobby into play once the
  // opponent connects — mirrors Connect 4's lobby flow.
  const connectRoom = (code: string, isHost: boolean) => {
    setMode('online');
    setMySymbol(isHost ? 'X' : 'O');
    setOpponentPresent(false);
    setConnecting(true);
    setBoard(Array(9).fill(null));
    leaveRoom();
    roomRef.current = joinGameRoom(code, isHost, {
      onMessage: (type, data) => {
        if (type === 'move') {
          const d = data as { idx: number; symbol: 'X' | 'O' };
          applyMove(d.idx, d.symbol);
        } else if (type === 'start' || type === 'rematch') {
          // Host told us who opens this game/rematch — apply it so the starter
          // matches on both devices (guest applies, never decides).
          const d = data as { firstSymbol?: 'X' | 'O' };
          if (d?.firstSymbol === 'X' || d?.firstSymbol === 'O') setFirstSymbol(d.firstSymbol);
          setBoard(Array(9).fill(null));
        }
      },
      onPresence: (present) => {
        setOpponentPresent(present);
        if (present) {
          setConnecting(false);
          if (screenRef.current !== 'play') {
            setBoard(Array(9).fill(null));
            // Host randomly picks the opener and broadcasts it (guest waits for it).
            if (isHost) {
              const fs: 'X' | 'O' = Math.random() < 0.5 ? 'X' : 'O';
              setFirstSymbol(fs);
              roomRef.current?.send('start', { firstSymbol: fs });
            }
            setScreen('play');
          }
        }
      },
      onOpponentMeta: (meta) => {
        if (meta) setOppMeta(meta);
      },
    }, {
      code: friendCode,
      // profileCompanionId defaults to '' (empty string, not null) — use || not ??
      // so a non-Bun active companion isn't swallowed by the falsy empty string.
      companionId: profileCompanionId || (activeCompanionId?.startsWith('shop:') ? activeCompanionId : undefined),
      skinId: profileCompanionId
        ? profileSkinId || undefined
        : activeCompanionId?.startsWith('shop:')
          ? (companionSkins[activeCompanionId] ?? 'classic')
          : bunSkinId || undefined,
      name: profileDisplayName || undefined,
    });
    setScreen('lobby');
  };

  // Launched straight from a friend invite — join the room, skip the picker.
  useEffect(() => {
    if (online) connectRoom(online.room, online.isHost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hostGame = () => {
    if (!friendCode) return;
    connectRoom(friendCode, true);
  };

  // Friends-only: open the friend list to invite someone into this hosted room.
  const inviteFriends = () => {
    if (!friendCode) return;
    router.push({ pathname: '/party-invite', params: { room: friendCode, game: 'tictactoe' } });
  };

  const resetBoard = () => {
    aiMovePending.current = false;
    setBoard(Array(9).fill(null));
    // AI / pass-and-play: randomize who moves first (false → opponent/AI opens).
    setIsPlayerTurn(Math.random() < 0.5);
  };

  // Mode select → play (offline modes only).
  const chooseMode = (nextMode: TicTacToeMode) => {
    setMode(nextMode);
    resetBoard();
    setScreen('play');
  };

  const backToModes = () => {
    leaveRoom();
    setMode('ai');
    setMySymbol(null);
    setOpponentPresent(false);
    setConnecting(false);
    resetBoard();
    setScreen('mode');
  };

  // Back from the board: exit (external invite / online) or return to the picker.
  const backFromPlay = () => {
    if (externalInvite) {
      onLeave?.();
      return;
    }
    if (isOnline) {
      backToModes();
      return;
    }
    resetBoard();
    setScreen('mode');
  };

  // Top-left back target depends on the current screen.
  const topBack = () => {
    if (screen === 'mode') {
      onLeave?.();
    } else if (screen === 'lobby') {
      if (externalInvite) onLeave?.();
      else backToModes();
    } else {
      backFromPlay();
    }
  };

  const handlePress = (idx: number) => {
    if (board[idx] || gameOver) return;
    if (isOnline) {
      if (!mySymbol || !myTurnOnline || !opponentPresent) return;
      applyMove(idx, mySymbol);
      playTap();
      roomRef.current?.send('move', { idx, symbol: mySymbol });
      return;
    }
    if (mode === 'ai' && !isPlayerTurn) return;
    const newBoard = [...board];
    newBoard[idx] = isPlayerTurn ? 'X' : 'O';
    setBoard(newBoard);
    playTap();
    setIsPlayerTurn((turn) => !turn);
  };

  useEffect(() => {
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
  }, [board, gameOver, isPlayerTurn, mode]);

  const reset = () => {
    if (isOnline) {
      // Randomize who opens the rematch and tell the opponent, so it's not always
      // the same player going first.
      const fs: 'X' | 'O' = Math.random() < 0.5 ? 'X' : 'O';
      setFirstSymbol(fs);
      setBoard(Array(9).fill(null));
      roomRef.current?.send('rematch', { firstSymbol: fs });
      return;
    }
    resetBoard();
  };

  const statusText = isOnline
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
    : isOnline
      ? nextSymbol
      : isPlayerTurn
        ? 'X'
        : 'O';

  const xLabel = isOnline
    ? mySymbol === 'X'
      ? t('games.you')
      : t('games.friend')
    : mode === 'ai'
      ? t('games.you')
      : t('games.p1');
  const oLabel = isOnline
    ? mySymbol === 'O'
      ? t('games.you')
      : t('games.friend')
    : mode === 'ai'
      ? localizeCompanionName(companion.name, t)
      : t('games.p2');
  // X is "you" except when online and you're playing O.
  const xIsYou = isOnline ? mySymbol === 'X' : true;
  const oIsYou = isOnline ? mySymbol === 'O' : false;
  // Avatars like Connect 4: human players show a silhouette placeholder; only
  // the companion (vs-AI opponent) and your own online card show real art.
  // The opponent's avatar from the companion they broadcast over presence; bundled
  // companions resolve here, custom/AI-generated ones fall back to the placeholder.
  const oppChar = oppMeta?.companionId ? getCompanionImage(oppMeta.companionId, oppMeta.skinId) : null;
  const xAvatar = isOnline ? (xIsYou ? youAvatar : oppChar) : null;
  const oAvatar = isOnline ? (oIsYou ? youAvatar : oppChar) : mode === 'ai' ? oppAvatar : null;

  return (
    <View style={tttStyles.screen}>
      <Image source={TTT_BG} style={StyleSheet.absoluteFill} contentFit="cover" />

      {/* Title — wordmark on the picker; plain text once in a game. */}
      {screen !== 'mode' && (
        <ThemedText style={[tttStyles.title, { top: insets.top + winH * 0.05 }]}>
          {t('friends.game_tictactoe')}
        </ThemedText>
      )}

      {/* Single arrow back button (matches Connect 4 / BatterDash). */}
      <Pressable
        onPress={topBack}
        hitSlop={10}
        style={({ pressed }) => [tttStyles.backBtn, { top: insets.top + 2, left: 8 }, pressed && tttStyles.pressed]}>
        <Image source={BACK_ARROW} style={tttStyles.backImg} contentFit="contain" />
      </Pressable>

      {/* Rules (top-right, only on the board — mirrors the back button) */}
      {screen === 'play' && (
        <GameRulesButton
          title={t('games.howToPlay')}
          body={t('games.rulesTicTacToe')}
          style={{ top: insets.top + 2, right: insets.right + 18 }}
        />
      )}

      <View style={[tttStyles.content, { paddingTop: insets.top + winH * 0.13, paddingBottom: insets.bottom + winH * 0.13 }]}>
        {screen === 'mode' ? (
          /* ── Opponent picker (shown first, like Connect 4) ── */
          <>
            <Image source={TTT_TITLE} style={tttStyles.titleImg} contentFit="contain" />
            <View style={[tttStyles.subPill, subPillBig]}>
              <ThemedText type="smallBold" style={[tttStyles.subPillText, subPillTextBig]}>
                {t('games.chooseOpponent')}
              </ThemedText>
            </View>
            <View style={tttStyles.modeCards}>
              <Pressable
                style={({ pressed }) => [tttStyles.modeCard, modeCardBig, pressed && tttStyles.pressed]}
                onPress={() => chooseMode('ai')}>
                <Image source={oppAvatar} style={[tttStyles.modeIcon, modeIconBig]} contentFit="contain" />
                <ThemedText type="smallBold" style={[tttStyles.modeTitle, modeTitleBig]}>{t('games.vsAI')}</ThemedText>
                <ThemedText type="small" style={[tttStyles.modeSub, modeSubBig]}>{t('games.playCompanion')}</ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [tttStyles.modeCard, modeCardBig, pressed && tttStyles.pressed]}
                onPress={() => chooseMode('friend')}>
                <View style={[tttStyles.modePieces, modePiecesBig]}>
                  <Image source={TTT_X} style={[tttStyles.modePiece, modePieceBig]} contentFit="contain" />
                  <Image source={TTT_O} style={[tttStyles.modePiece, modePieceBig, { marginLeft: -8 }]} contentFit="contain" />
                </View>
                <ThemedText type="smallBold" style={[tttStyles.modeTitle, modeTitleBig]}>{t('games.passAndPlay')}</ThemedText>
                <ThemedText type="small" style={[tttStyles.modeSub, modeSubBig]}>{t('games.sameDevice')}</ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [tttStyles.modeCard, modeCardBig, pressed && tttStyles.pressed]}
                onPress={hostGame}>
                <View style={[tttStyles.modePieces, modePiecesBig]}>
                  <Image source={TTT_X} style={[tttStyles.modePiece, modePieceBig]} contentFit="contain" />
                  <Image source={TTT_O} style={[tttStyles.modePiece, modePieceBig, { marginLeft: 4 }]} contentFit="contain" />
                </View>
                <ThemedText type="smallBold" style={[tttStyles.modeTitle, modeTitleBig]}>{t('connect4.online')}</ThemedText>
                <ThemedText type="small" style={[tttStyles.modeSub, modeSubBig]}>{t('connect4.playFriend')}</ThemedText>
              </Pressable>
            </View>
            {/* Bottom spacer pushes the centered picker group upward. */}
            <View style={{ height: winH * 0.08 }} />
          </>
        ) : screen === 'lobby' ? (
          /* ── Online lobby: host & invite a friend (friends only) ── */
          <View style={tttStyles.lobbyCard}>
            <ThemedText type="smallBold" style={tttStyles.lobbyHeading}>{t('connect4.waitingFriend')}</ThemedText>
            <ThemedText type="small" style={tttStyles.lobbyHint}>{t('party.inviteSubtitle')}</ThemedText>
            <Pressable style={({ pressed }) => [tttStyles.primaryBtn, pressed && tttStyles.pressed]} onPress={inviteFriends}>
              <ThemedText type="smallBold" style={tttStyles.primaryBtnText}>{t('lobby.inviteFriend')}</ThemedText>
            </Pressable>
            <Pressable onPress={backToModes} style={tttStyles.linkBtn}>
              <ThemedText type="small" style={tttStyles.lobbyHint}>{t('common.cancel')}</ThemedText>
            </Pressable>
          </View>
        ) : (
          /* ── Play ── */
          <>
            <View style={tttStyles.cardRow}>
              <PlayerPlate
                avatar={xAvatar}
                piece={TTT_X}
                label={xLabel}
                width={cardW}
                active={activeSymbol === 'X' && !gameOver}
                isWinner={gameOver && winner === 'X'}
                symbol="X"
              />
              <PlayerPlate
                avatar={oAvatar}
                piece={TTT_O}
                label={oLabel}
                width={cardW}
                active={activeSymbol === 'O' && !gameOver}
                isWinner={gameOver && winner === 'O'}
                symbol="O"
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
    lineHeight: 38,
    paddingTop: 4,
    fontWeight: '800',
    color: '#A85A4A',
    letterSpacing: 0.5,
  },
  titleImg: { width: '66%', aspectRatio: 1513 / 724, alignSelf: 'center', marginBottom: Spacing.one },
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
  backBtn: { position: 'absolute', width: 58, height: 58, zIndex: 5 },
  backImg: { width: 58, height: 58 },
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
  modeCards: { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'center', gap: Spacing.two, paddingHorizontal: Spacing.two },
  modeCard: {
    flex: 1,
    minWidth: 0,
    maxWidth: 150,
    borderRadius: 26,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,252,248,0.92)',
    borderWidth: 1.5,
    borderColor: '#F4D7DE',
  },
  modeIcon: { width: 64, height: 64 },
  modePieces: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 64 },
  modePiece: { width: 40, height: 40 },
  modeTitle: { color: '#A85A4A', fontSize: 17, textAlign: 'center' },
  modeSub: { color: '#9A8978', textAlign: 'center', fontSize: 12 },
  // Online lobby
  lobbyCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    padding: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(255,252,248,0.94)',
    borderWidth: 1.5,
    borderColor: '#F4D7DE',
  },
  lobbyHeading: { color: '#A85A4A', fontSize: 15, textAlign: 'center' },
  lobbyHint: { color: '#9A8978', textAlign: 'center' },
  codeBig: { fontSize: 28, fontWeight: '800', letterSpacing: 4, color: '#A85A4A' },
  codeInput: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#E7C9A9',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
    color: '#A85A4A',
  },
  primaryBtn: { backgroundColor: '#F2A0B5', borderRadius: 999, paddingHorizontal: 28, paddingVertical: 11 },
  primaryBtnText: { color: '#FFF' },
  btnDisabled: { opacity: 0.45 },
  linkBtn: { paddingVertical: Spacing.one },
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
const CONNECT4_BG = require('@/assets/images/connect4/background.png');
const TTT_BG = require('@/assets/images/tictactoe/background-clean.png');

// Tablet move/resize targets for the break-game hub (chrome only — never the
// game boards, which hit-test against raw coordinates).
const BREAKGAME_ELEMENTS = [
  { name: 'title', label: 'Title' },
  { name: 'timerBar', label: 'Timer bar' },
  { name: 'featured', label: 'Featured card' },
  { name: 'homeBtn', label: 'Home btn' },
  { name: 'endStudy', label: 'End-study btn' },
];

export default function BreakGameScreen() {
  const { t } = useTranslation();
  const { knobs: twKnobs, onChange: twChange, t: tw } = usePosTweaks('breakgame', BREAKGAME_ELEMENTS);
  const { breakMinutes, fromSession, browse, game, room, role, nextMinutes, nextSubject, nextAutoStarted } = useLocalSearchParams<{
    breakMinutes: string;
    fromSession?: string;
    browse?: string;
    game?: string;
    room?: string;
    role?: string;
    // After a solo study break, hand off to the next-session picker instead of Home.
    nextMinutes?: string;
    nextSubject?: string;
    nextAutoStarted?: string;
  }>();
  const { ownedShopItems, isPlus } = useApp();
  const { width: winW, height: winH } = useWindowDimensions();
  // Large-screen check from raw dimensions (not the tablet flag) so the footer
  // still scales up even if the dev device-class preview is forcing phone.
  const largeScreen = Math.min(winW, winH) >= 600;
  // Phone sizes look lost on a 13" iPad — scale the footer chrome up there.
  const homeBtnSize = largeScreen ? 92 : 66;
  const homeIconSize = largeScreen ? 46 : 34;
  const indicatorH = largeScreen ? 4 : 2.5;
  const backArrowSize = largeScreen ? 56 : 40;

  // Online entry — opened from a friend invite straight into a networked game.
  const onlineSession =
    game && room && role && (game === 'connect4' || game === 'tictactoe')
      ? { game: game as GameId, room, isHost: role === 'host' }
      : null;

  // "browse" = opened from the Home game button (not a real study break): no
  // break timer, no study framing — just pick a game.
  const isBrowse = browse === '1' || !!onlineSession;
  const parsedMinutes = parseInt(breakMinutes ?? '', 10);
  // The break length is now chosen + validated at session SETUP (incl. Plus custom
  // breaks that aren't 5/10/15), so accept any sane positive length here rather than
  // bouncing those sessions to Home and skipping the next-session picker.
  const validEntry =
    !!onlineSession || isBrowse || (fromSession === '1' && parsedMinutes > 0 && parsedMinutes <= 300);

  const returnToTabs = () => {
    if (router.canDismiss()) {
      router.dismissAll();
      return;
    }
    router.replace('/');
  };

  // After a solo study break finishes, go pick the next session (1-minute countdown);
  // a bare break (no next-session handoff) just returns Home.
  const hasNextSession = !!nextMinutes;
  const goNext = () => {
    if (hasNextSession) {
      router.replace({
        pathname: '/next-session',
        params: {
          lastMinutes: nextMinutes!,
          subject: nextSubject ?? '',
          autoStarted: nextAutoStarted ?? '',
        },
      });
      return;
    }
    returnToTabs();
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
    showLoadingScreen(undefined, { quick: true });
    returnToTabs();
  };

  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const pct = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;

  const GAMES: { id: GameId; nameKey: string; emoji: string; free: boolean; shopItemId: string | null; route?: string; icon?: number; tint: string; featured?: boolean; comingSoon?: boolean }[] = [
    // BatterDash is hidden from the app for now. To bring it back, restore this entry:
    // { id: 'cakekitchen', nameKey: 'friends.game_batterdash', emoji: '', free: true, shopItemId: null, route: '/cake-game', icon: require('@/assets/images/cake/batterdash-banner.png'), tint: '#FBE0E6', featured: true, comingSoon: true },
    { id: 'tictactoe', nameKey: 'friends.game_tictactoe', emoji: '', free: true, shopItemId: null, icon: require('@/assets/images/tictactoe/thumbnail.png'), tint: '#FBEAD2' },
    { id: 'connect4', nameKey: 'friends.game_connect4', emoji: '', free: true, shopItemId: null, icon: require('@/assets/images/games/connect4.png'), tint: '#DFEAF4' },
    { id: '2048', nameKey: 'friends.game_2048', emoji: '', free: true, shopItemId: null, icon: require('@/assets/images/2048/thumbnail.png'), tint: '#CFE9F2' },
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
    if (g.comingSoon) {
      showPopup(t('games.comingSoon'), t('games.comingSoonMsg'));
      return;
    }
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
            onPress={goNext}>
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
  const g2048Active = phase === 'playing' && selectedGame === '2048';

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

  // 2048 is single-player and renders its own full-screen scene.
  if (g2048Active) {
    return <Game2048 onLeave={showGames} />;
  }

  return (
    <ThemedView style={styles.container}>
      {connect4Active && (
        <Image source={CONNECT4_BG} style={styles.connect4Bg} contentFit="cover" />
      )}
      <SafeAreaView style={styles.safeArea}>
        {/* Break timer — only during a real study break, not when browsing */}
        {!isBrowse && (
          <ThemedView type="backgroundElement" style={[styles.timerBar, tw('timerBar')]}>
            <ThemedText style={styles.timerEmoji}></ThemedText>
            <ThemedView type="transparent" style={styles.timerContent}>
              <ThemedView type="transparent" style={styles.timerRow}>
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
          // Full-screen game picker.
          <>
            <ScrollView
              style={styles.scrollFlex}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.selectScrollContent}>
              <ThemedView style={styles.selectContent}>
              <ThemedView style={styles.selectHeader}>
                <ThemedText style={[styles.selectTitle, tw('title')]}>
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
                      tw('featured'),
                      (!canOpen || g.comingSoon) && styles.gameCardLocked,
                      pressed && canOpen && !g.comingSoon && styles.pressed,
                    ]}
                    onPress={() => openGame(g, canOpen)}>
                    <Image source={g.icon} style={styles.featuredArt} contentFit="cover" />
                    {g.comingSoon && (
                      <View style={styles.tapeOverlay} pointerEvents="none">
                        {[styles.tapeStripA, styles.tapeStripB].map((strip, si) => (
                          <View key={si} style={[styles.tapeStrip, strip]}>
                            {Array.from({ length: 26 }).map((_, i) => (
                              <View key={i} style={styles.tapeStripe} />
                            ))}
                          </View>
                        ))}
                      </View>
                    )}
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
            {/* During a real study break this returns to the session (back arrow);
                when just browsing from Home it's a home button. */}
            <View style={styles.homeFooter}>
              <View style={[styles.homeIndicator, { height: indicatorH, marginHorizontal: -(Spacing.four + Math.max(0, (winW - MaxContentWidth) / 2)) }]} />
              <Pressable
                style={({ pressed }) => [styles.homeBtn, { width: homeBtnSize, height: homeBtnSize, borderRadius: homeBtnSize / 2 }, tw('homeBtn'), pressed && styles.pressed]}
                onPress={goHome}
                hitSlop={8}
                accessibilityLabel={isBrowse ? t('nav.home') : t('games.backToStudying')}>
                {isBrowse ? (
                  <SimpleHomeIcon color="#D86F9C" size={homeIconSize} />
                ) : (
                  <ThemedText style={[styles.backArrow, { fontSize: backArrowSize, lineHeight: backArrowSize + 4 }]}>‹</ThemedText>
                )}
              </Pressable>
            </View>
          </>
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
            <View style={styles.homeFooter}>
              <View style={[styles.homeIndicator, { height: indicatorH, marginHorizontal: -(Spacing.four + Math.max(0, (winW - MaxContentWidth) / 2)) }]} />
              <Pressable
                style={({ pressed }) => [styles.homeBtn, { width: homeBtnSize, height: homeBtnSize, borderRadius: homeBtnSize / 2 }, tw('homeBtn'), pressed && styles.pressed]}
                onPress={goHome}
                hitSlop={8}
                accessibilityLabel={t('nav.home')}>
                <SimpleHomeIcon color="#D86F9C" size={homeIconSize} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.endStudyBtn, tw('endStudy'), pressed && styles.pressed]}
              onPress={goHome}>
              <ThemedText type="smallBold" style={styles.endStudyBtnText}>
                {t('breakGame.endStudy')}
              </ThemedText>
            </Pressable>
          ))}
      </SafeAreaView>
      {!connect4Active && <DevKnobs screen="breakgame" knobs={twKnobs} onChange={twChange} />}
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
  scrollFlex: { flex: 1, width: '100%' },
  selectScrollContent: { paddingBottom: Spacing.three },
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
  // "Under construction" tape across the parked BatterDash banner.
  tapeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(80,56,44,0.22)', // soft warm dim
    borderRadius: 20,
    overflow: 'hidden', // clip the crossed tape strips to the card
  },
  // Two pastel candy-stripe ribbons crossed into a soft X (cozy take on hazard tape).
  tapeStrip: {
    position: 'absolute',
    left: -60,
    right: -60,
    top: '50%',
    marginTop: -19,
    height: 38,
    backgroundColor: '#FFFFFF', // white ribbon
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F6A9C4', // soft pink edge
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tapeStripA: { transform: [{ rotate: '30deg' }] },
  tapeStripB: { transform: [{ rotate: '-30deg' }] },
  // Soft pink diagonal stripe with rounded ends — reads as a candy slash.
  tapeStripe: {
    width: 15,
    height: 96,
    borderRadius: 8,
    backgroundColor: '#F6A9C4', // soft strawberry pink
    transform: [{ rotate: '42deg' }],
    marginRight: 15,
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
  homeFooter: { alignItems: 'center', gap: 12 },
  // Full-width pink divider spanning edge to edge (phone-screen look). Bleeds
  // past the safeArea's horizontal padding (Spacing.four) to the true screen edges.
  homeIndicator: {
    alignSelf: 'stretch',
    height: 2.5,
    backgroundColor: '#F2A0B5',
    opacity: 0.7,
  },
  homeBtn: {
    alignSelf: 'center',
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#F2A0B5',
    backgroundColor: 'rgba(242,160,181,0.16)',
  },
  backArrow: { fontSize: 40, lineHeight: 44, fontWeight: '800', color: '#D86F9C', marginTop: -4 },
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
