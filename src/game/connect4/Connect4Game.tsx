import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';

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
  ROWS,
  type Board,
  type Player,
} from '@/game/connect4/logic';

type Screen = 'mode' | 'lobby' | 'play';
type Opp = 'ai' | 'online';
type Result = Player | 'draw' | null;

const CELL = 38;
const GAP = 5;
const P1_COLOR = '#E05C3A'; // red
const P2_COLOR = '#F0B44A'; // yellow

export function Connect4Game() {
  const {
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    friendCode,
    addFriend,
    isPlus,
    ownedShopItems,
  } = useApp();

  const opponent = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId);
  // Entitlement: you need Plus or to own Connect 4 to play the AI or host a game.
  // Joining a friend's game is always allowed — the host's access covers the match.
  const hasAccess = isPlus || ownedShopItems.includes('game_words');

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
    if (result === 'draw') return "It's a draw! 🤝";
    if (result) return result === myPlayer ? 'You win! 🎉' : opp === 'ai' ? `${opponent.name} wins! 😺` : 'Friend wins!';
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
            <ThemedText style={styles.modeEmoji}>{hasAccess ? '🤖' : '🔒'}</ThemedText>
            <ThemedText type="smallBold">vs {opponent.name}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{hasAccess ? 'Play the AI' : 'Needs Plus'}</ThemedText>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.modeCard, pressed && styles.pressed]} onPress={() => { setOpp('online'); setScreen('lobby'); }}>
            <ThemedText style={styles.modeEmoji}>🌐</ThemedText>
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
  const myColor = myPlayer === 1 ? P1_COLOR : P2_COLOR;
  const oppColor = myPlayer === 1 ? P2_COLOR : P1_COLOR;

  return (
    <ThemedView style={styles.container}>
      {/* Players bar */}
      <View style={styles.playersRow}>
        <View style={styles.playerTag}>
          <View style={[styles.disc, styles.tagDisc, { backgroundColor: myColor }]} />
          <ThemedText type="smallBold">You</ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">vs</ThemedText>
        <View style={styles.playerTag}>
          {opp === 'ai' ? (
            <Image source={opponent.imageSource} style={styles.oppAvatar} contentFit="contain" />
          ) : (
            <View style={[styles.disc, styles.tagDisc, { backgroundColor: oppColor }]} />
          )}
          <ThemedText type="smallBold">{opp === 'ai' ? opponent.name : 'Friend'}</ThemedText>
        </View>
      </View>

      <ThemedText type="smallBold" style={styles.status}>
        {oppLeft ? 'Friend left the game 😢' : statusText}
      </ThemedText>

      {/* Board */}
      <View style={styles.board}>
        {Array.from({ length: COLS }).map((_, c) => {
          const canDrop = !result && !oppLeft && turn === myPlayer && board[0][c] === 0 &&
            (opp === 'ai' || opponentPresent);
          return (
            <Pressable
              key={c}
              style={styles.column}
              onPress={() => onColumnPress(c)}
              disabled={!canDrop}>
              {Array.from({ length: ROWS }).map((__, r) => {
                const v = board[r][c];
                return (
                  <View key={r} style={styles.hole}>
                    {v !== 0 && (
                      <View
                        style={[
                          styles.disc,
                          { backgroundColor: v === 1 ? P1_COLOR : P2_COLOR },
                          isWinCell(r, c) && styles.discWin,
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </Pressable>
          );
        })}
      </View>

      {/* Footer actions */}
      {(result || oppLeft) ? (
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
          <Pressable style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]} onPress={backToModes}>
            <ThemedText type="smallBold" style={styles.secondaryBtnText}>Change mode</ThemedText>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={backToModes} style={styles.linkBtn}>
          <ThemedText type="small" themeColor="textSecondary">Change mode</ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.three, width: '100%' },
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
  modeEmoji: { fontSize: 34, lineHeight: 40 },
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
  playersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  playerTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagDisc: { width: 18, height: 18 },
  oppAvatar: { width: 30, height: 30 },
  status: { fontSize: 16 },

  // Board
  board: {
    flexDirection: 'row',
    gap: GAP,
    padding: GAP + 2,
    borderRadius: 16,
    backgroundColor: 'rgba(124,111,90,0.10)',
  },
  column: { gap: GAP },
  hole: {
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: { width: CELL - 6, height: CELL - 6, borderRadius: (CELL - 6) / 2 },
  discWin: { borderWidth: 2.5, borderColor: '#FFFFFF' },

  footerRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
});
