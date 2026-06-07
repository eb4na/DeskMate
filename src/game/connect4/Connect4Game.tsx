import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { resolveActiveCompanion } from '@/lib/companion-utils';
import { joinConnect4Room, type Connect4Room } from '@/lib/connect4-room';
import { BakeryColors, Spacing } from '@/constants/theme';
import {
  applyMove,
  checkWin,
  COLS,
  createBoard,
  getAIMove,
  isFull,
  type Board,
  type Player,
} from '@/game/connect4/logic';

type Screen = 'mode' | 'lobby' | 'play';
type Opp = 'ai' | 'online';
type Result = Player | 'draw' | null;

// ── Board art geometry ──────────────────────────────────────────────────────
// The board PNG is 8 columns × 6 rows. Hole centers (as fractions of the board
// image's width/height) were measured from the art so discs land in the holes.
const BOARD_NATIVE_AR = 683 / 812; // height / width of board.png
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const BOARD_W = Math.min(SCREEN_W - 40, 360);
const BOARD_H = BOARD_W * BOARD_NATIVE_AR;
const COL_FX = [0.1808, 0.2772, 0.3733, 0.4697, 0.5664, 0.6634, 0.7606, 0.8579];
const ROW_FY = [0.1968, 0.3103, 0.4231, 0.5361, 0.6486, 0.7605];
const PIECE_D = BOARD_W * 0.08;
const COL_ZONE_W = BOARD_W * 0.096;

const BOARD_IMG = require('@/assets/images/connect4/board.png');
const PIECE_IMG: Record<Player, number> = {
  1: require('@/assets/images/connect4/piece-pink.png'),
  2: require('@/assets/images/connect4/piece-choco.png'),
};

// A piece that drops in from above the board when it first appears, so both
// players can see exactly where it is being placed.
function FallingPiece({ player, left, top, row, win }: { player: Player; left: number; top: number; row: number; win: boolean }) {
  const ty = useSharedValue(-(top + PIECE_D));
  useEffect(() => {
    ty.value = withTiming(0, { duration: 230 + row * 55, easing: Easing.bounce });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));
  return (
    <Animated.View style={[styles.piece, { left, top }, animStyle]}>
      <Image source={PIECE_IMG[player]} style={[styles.pieceImg, win && styles.pieceWin]} contentFit="contain" />
    </Animated.View>
  );
}

export function Connect4Game({ online }: { online?: { room: string; isHost: boolean } } = {}) {
  const {
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    friendCode,
    addFriend,
  } = useApp();

  const opponent = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId);
  // All games are free — anyone can play the AI or host a game.
  const hasAccess = true;

  const [screen, setScreen] = useState<Screen>('mode');
  const [opp, setOpp] = useState<Opp>('ai');
  const [board, setBoard] = useState<Board>(createBoard);
  const [turn, setTurn] = useState<Player>(1);
  const [result, setResult] = useState<Result>(null);
  const [winCells, setWinCells] = useState<[number, number][]>([]);

  // Online state
  const [myPlayer, setMyPlayer] = useState<Player>(1);
  const [joinInput, setJoinInput] = useState('');
  const [opponentPresent, setOpponentPresent] = useState(false);
  const [oppLeft, setOppLeft] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Refs for use inside async (AI timer / realtime) callbacks.
  const boardRef = useRef(board);
  const turnRef = useRef(turn);
  const resultRef = useRef<Result>(null);
  const roomRef = useRef<Connect4Room | null>(null);
  const myPlayerRef = useRef<Player>(1);
  const screenRef = useRef<Screen>('mode');

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const leaveRoom = useCallback(() => {
    roomRef.current?.leave();
    roomRef.current = null;
  }, []);

  useEffect(() => () => leaveRoom(), [leaveRoom]);

  const resetGame = useCallback((first: Player = 1) => {
    const fresh = createBoard();
    boardRef.current = fresh;
    turnRef.current = first;
    resultRef.current = null;
    setBoard(fresh);
    setTurn(first);
    setResult(null);
    setWinCells([]);
    setOppLeft(false);
  }, []);

  // Core move application — used by local taps, the AI, and remote moves.
  const doMove = useCallback((col: number, player: Player): boolean => {
    if (resultRef.current) return false;
    const res = applyMove(boardRef.current, col, player);
    if (!res) return false;
    boardRef.current = res.board;
    setBoard(res.board);
    const win = checkWin(res.board, player);
    if (win.won) {
      resultRef.current = player;
      setResult(player);
      setWinCells(win.cells);
    } else if (isFull(res.board)) {
      resultRef.current = 'draw';
      setResult('draw');
    } else {
      const next: Player = player === 1 ? 2 : 1;
      turnRef.current = next;
      setTurn(next);
    }
    return true;
  }, []);

  // AI move when it's player 2's turn in vs-AI mode.
  useEffect(() => {
    if (opp !== 'ai' || screen !== 'play' || result || turn !== 2) return;
    const t = setTimeout(() => {
      const col = getAIMove(boardRef.current, 2, 1);
      if (col >= 0) doMove(col, 2);
    }, 500);
    return () => clearTimeout(t);
  }, [opp, screen, result, turn, doMove]);

  const onColumnPress = (col: number) => {
    if (result || turn !== myPlayer) return;
    if (opp === 'online' && (!roomRef.current || !opponentPresent)) return;
    const applied = doMove(col, myPlayer);
    if (applied && opp === 'online') roomRef.current?.sendMove(col);
  };

  // ── Mode selection ──────────────────────────────────────────────────────
  const startAi = () => {
    leaveRoom();
    setOpp('ai');
    setMyPlayer(1);
    myPlayerRef.current = 1;
    resetGame(1);
    setScreen('play');
  };

  const connectRoom = (code: string, isHost: boolean) => {
    const mine: Player = isHost ? 1 : 2;
    setMyPlayer(mine);
    myPlayerRef.current = mine;
    setOpp('online');
    setOpponentPresent(false);
    setConnecting(true);
    resetGame(1);
    leaveRoom();
    roomRef.current = joinConnect4Room(code, isHost, {
      onMove: (col) => doMove(col, mine === 1 ? 2 : 1),
      onRematch: () => resetGame(1),
      onPresence: ({ opponentPresent: present }) => {
        setOpponentPresent(present);
        if (present) {
          setConnecting(false);
          if (screenRef.current !== 'play') {
            resetGame(1);
            setScreen('play');
          }
        } else if (screenRef.current === 'play') {
          setOppLeft(true);
        }
      },
    });
    setScreen('lobby');
  };

  const hostGame = () => {
    if (!friendCode) return;
    connectRoom(friendCode, true);
  };

  // Launched straight from a friend invite — join the room and skip the lobby UI.
  useEffect(() => {
    if (online) connectRoom(online.room, online.isHost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const joinGame = () => {
    const code = joinInput.trim().toUpperCase();
    if (code.length < 4) return;
    addFriend(code);
    connectRoom(code, false);
  };

  const backToModes = () => {
    leaveRoom();
    setOpp('ai');
    setOpponentPresent(false);
    setConnecting(false);
    resetGame(1);
    setScreen('mode');
  };

  const shareCode = () => {
    Share.share({ message: `Play Connect 4 with me on Memobun! Join with my code: ${friendCode}` });
  };

  // ── Render helpers ──────────────────────────────────────────────────────
  const isWinCell = (r: number, c: number) => winCells.some(([wr, wc]) => wr === r && wc === c);

  const statusText = (() => {
    if (result === 'draw') return "It's a draw!";
    if (result) return result === myPlayer ? 'You win!' : opp === 'ai' ? `${opponent.name} wins!` : 'Friend wins!';
    if (turn === myPlayer) return 'Your turn';
    return opp === 'ai' ? `${opponent.name} is thinking…` : "Friend's turn…";
  })();

  // ── Mode screen ─────────────────────────────────────────────────────────
  if (screen === 'mode') {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.heading}>Connect 4</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Drop discs and get four in a row.
        </ThemedText>
        <View style={styles.modeRow}>
          <Pressable
            style={({ pressed }) => [styles.modeCard, !hasAccess && styles.modeCardLocked, pressed && styles.pressed]}
            onPress={hasAccess ? startAi : () => Alert.alert('Connect 4 locked', 'Unlock Connect 4 in the Shop or with Plus to play the AI — or join a friend who already has it!')}>
            <Image source={opponent.imageSource} style={styles.modeIcon} contentFit="contain" />
            <ThemedText type="smallBold">vs {opponent.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{hasAccess ? 'Play the AI' : 'Needs Plus'}</ThemedText>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.modeCard, pressed && styles.pressed]} onPress={() => { setOpp('online'); setScreen('lobby'); }}>
            <View style={styles.modeDiscPair}>
              <Image source={PIECE_IMG[1]} style={styles.modePiece} contentFit="contain" />
              <View style={{ marginLeft: -10 }}><Image source={PIECE_IMG[2]} style={styles.modePiece} contentFit="contain" /></View>
            </View>
            <ThemedText type="smallBold">Online</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>Play a friend</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  // ── Online lobby ────────────────────────────────────────────────────────
  if (screen === 'lobby') {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.heading}>Play online</ThemedText>

        {connecting && !opponentPresent ? (
          <ThemedView type="backgroundElement" style={styles.lobbyCard}>
            <ThemedText type="smallBold" style={styles.center}>Waiting for a friend…</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Share your code so they can join.
            </ThemedText>
            <ThemedText style={styles.codeBig}>{friendCode}</ThemedText>
            <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={shareCode}>
              <ThemedText type="smallBold" style={styles.primaryBtnText}>Share code</ThemedText>
            </Pressable>
            <Pressable onPress={backToModes} style={styles.linkBtn}>
              <ThemedText type="small" themeColor="textSecondary">Cancel</ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <>
            <ThemedView type="backgroundElement" style={styles.lobbyCard}>
              <ThemedText type="smallBold" style={styles.center}>Your code</ThemedText>
              <ThemedText style={styles.codeBig}>{friendCode || '——'}</ThemedText>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, (!friendCode || !hasAccess) && styles.btnDisabled, pressed && styles.pressed]}
                onPress={hostGame}
                disabled={!friendCode || !hasAccess}>
                <ThemedText type="smallBold" style={styles.primaryBtnText}>Host &amp; wait</ThemedText>
              </Pressable>
              {!hasAccess && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>Hosting needs Plus or unlock</ThemedText>
              )}
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.lobbyCard}>
              <ThemedText type="smallBold" style={styles.center}>Join a friend</ThemedText>
              {!hasAccess && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>Free — play a friend who has Connect 4</ThemedText>
              )}
              <TextInput
                style={styles.codeInput}
                value={joinInput}
                onChangeText={(t) => setJoinInput(t.toUpperCase())}
                placeholder="Enter friend code"
                placeholderTextColor="#B9A78F"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
              />
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, (joinInput.trim().length < 4) && styles.btnDisabled, pressed && styles.pressed]}
                onPress={joinGame}
                disabled={joinInput.trim().length < 4}>
                <ThemedText type="smallBold" style={styles.primaryBtnText}>Join game</ThemedText>
              </Pressable>
            </ThemedView>

            <Pressable onPress={backToModes} style={styles.linkBtn}>
              <ThemedText type="small" themeColor="textSecondary">← Back</ThemedText>
            </Pressable>
          </>
        )}
      </ThemedView>
    );
  }

  // ── Play screen ─────────────────────────────────────────────────────────
  const oppPiece: Player = myPlayer === 1 ? 2 : 1;

  return (
    <ThemedView style={styles.container}>
      {/* Player info bar */}
      <View style={styles.headerCard}>
        <View style={styles.playersRow}>
          <View style={styles.playerTag}>
            <Image source={PIECE_IMG[myPlayer]} style={styles.tagPiece} contentFit="contain" />
            <ThemedText type="smallBold">You</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">vs</ThemedText>
          <View style={styles.playerTag}>
            {opp === 'ai' ? (
              <Image source={opponent.imageSource} style={styles.oppAvatar} contentFit="contain" />
            ) : (
              <Image source={PIECE_IMG[oppPiece]} style={styles.tagPiece} contentFit="contain" />
            )}
            <ThemedText type="smallBold">{opp === 'ai' ? opponent.name : 'Friend'}</ThemedText>
          </View>
        </View>
        <ThemedText type="smallBold" style={styles.status}>
          {oppLeft ? 'Friend left the game 😢' : statusText}
        </ThemedText>
      </View>

      {/* Board */}
      <View style={styles.boardWrap}>
        <Image source={BOARD_IMG} style={styles.boardImg} contentFit="fill" />
        {/* Placed pieces, positioned over the art's holes */}
        {board.map((rowArr, r) =>
          rowArr.map((v, c) =>
            v !== 0 ? (
              <FallingPiece
                key={`${v}-${r}-${c}`}
                player={v as Player}
                left={COL_FX[c] * BOARD_W - PIECE_D / 2}
                top={ROW_FY[r] * BOARD_H - PIECE_D / 2}
                row={r}
                win={isWinCell(r, c)}
              />
            ) : null,
          ),
        )}
        {/* Tap zones — one per column */}
        {Array.from({ length: COLS }).map((_, c) => {
          const canDrop = !result && !oppLeft && turn === myPlayer && board[0][c] === 0 &&
            (opp === 'ai' || opponentPresent);
          return (
            <Pressable
              key={c}
              style={[styles.colZone, { left: COL_FX[c] * BOARD_W - COL_ZONE_W / 2, width: COL_ZONE_W }]}
              onPress={() => onColumnPress(c)}
              disabled={!canDrop}
            />
          );
        })}
      </View>

      {/* Footer actions */}
      {(result || oppLeft) && (
        <View style={styles.footerRow}>
          {opp === 'ai' && !oppLeft && (
            <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={() => resetGame(1)}>
              <ThemedText type="smallBold" style={styles.primaryBtnText}>Play again</ThemedText>
            </Pressable>
          )}
          {opp === 'online' && !oppLeft && (
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={() => { resetGame(1); roomRef.current?.sendRematch(); }}>
              <ThemedText type="smallBold" style={styles.primaryBtnText}>Rematch</ThemedText>
            </Pressable>
          )}
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
    paddingVertical: Spacing.three,
    backgroundColor: 'transparent',
  },
  heading: { fontSize: 20 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.85 },

  // Mode select
  modeRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two },
  modeCard: {
    width: 130,
    borderRadius: 18,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(124,111,90,0.10)',
  },
  modeIcon: { width: 44, height: 44 },
  modeDiscPair: { flexDirection: 'row', alignItems: 'center', height: 44, justifyContent: 'center' },
  modePiece: { width: 30, height: 30 },
  modeCardLocked: { opacity: 0.55 },

  // Lobby
  lobbyCard: { width: '100%', maxWidth: 320, borderRadius: 16, padding: Spacing.three, alignItems: 'center', gap: Spacing.two },
  codeBig: { fontSize: 28, fontWeight: '800', letterSpacing: 4, color: BakeryColors.cocoaDark },
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
    color: BakeryColors.cocoaDark,
  },

  // Buttons
  primaryBtn: { backgroundColor: BakeryColors.jam, borderRadius: 999, paddingHorizontal: 24, paddingVertical: 10 },
  primaryBtnText: { color: '#FFF' },
  secondaryBtn: { backgroundColor: 'rgba(124,111,90,0.14)', borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  secondaryBtnText: { color: '#7C6F5A' },
  btnDisabled: { opacity: 0.45 },
  linkBtn: { paddingVertical: Spacing.two },

  // Players bar
  headerCard: {
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: 'rgba(255, 252, 248, 0.88)',
    borderRadius: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  playersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  playerTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagPiece: { width: 22, height: 22 },
  oppAvatar: { width: 30, height: 30 },
  status: { fontSize: 16 },

  // Board
  boardWrap: { width: BOARD_W, height: BOARD_H, overflow: 'hidden', marginTop: SCREEN_H * 0.12 },
  boardImg: { position: 'absolute', width: BOARD_W, height: BOARD_H },
  piece: { position: 'absolute', width: PIECE_D, height: PIECE_D },
  pieceImg: { width: '100%', height: '100%' },
  pieceWin: { borderRadius: PIECE_D / 2, borderWidth: 3, borderColor: '#FFE08A' },
  colZone: { position: 'absolute', top: 0, height: BOARD_H },

  footerRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
});
