import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { useTranslation } from '@/i18n';
import { getCompanionImage, resolveActiveCompanion, resolveProfileFigure } from '@/lib/companion-utils';
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
// The board PNG is 7 columns × 5 rows. Hole centers (as fractions of the board
// image's width/height) were measured from the art so discs land in the holes.
const BOARD_NATIVE_AR = 1402 / 1122; // height / width of board.png
const SCREEN_W = Dimensions.get('window').width;
const BOARD_W = Math.min(SCREEN_W - 40, 360);
const BOARD_H = BOARD_W * BOARD_NATIVE_AR;
const COL_FX = [0.1556, 0.2687, 0.3823, 0.4944, 0.6076, 0.7234, 0.8358];
const ROW_FY = [0.2942, 0.3779, 0.4624, 0.5460, 0.6295];
const PIECE_D = BOARD_W * 0.085;
const COL_ZONE_W = BOARD_W * 0.11;

const BOARD_IMG = require('@/assets/images/connect4/board.png');
const BACK_IMG = require('@/assets/images/connect4/back.png');
const TITLE_IMG = require('@/assets/images/connect4/title.png');
const BTN_REMATCH = require('@/assets/images/connect4/btn-rematch.png');
const BTN_LEAVE = require('@/assets/images/connect4/btn-leave.png');
const BTN_REMATCH_AR = 1439 / 526; // width / height of the cropped pill art
const BTN_LEAVE_AR = 1191 / 475;
// Cream backing shown through the board's transparent holes (matches board art).
const BOARD_CREAM = '#FDE6CA';
const PIECE_IMG: Record<Player, number> = {
  1: require('@/assets/images/connect4/piece-pink.png'),
  2: require('@/assets/images/connect4/piece-choco.png'),
};
// Circular player frames — pink for player 1, yellow for player 2. The avatar
// "face" sits in each frame's cream center (measured from the art).
const FRAME_IMG: Record<Player, number> = {
  1: require('@/assets/images/connect4/frame-pink.png'),
  2: require('@/assets/images/connect4/frame-yellow.png'),
};
const FRAME_CENTER: Record<Player, { x: number; y: number }> = {
  1: { x: 0.52, y: 0.53 },
  2: { x: 0.5, y: 0.5 },
};
const FRAME_SIZE = 86;
const FACE_D = FRAME_SIZE * 0.66;
const FACE_ZOOM = 1.7; // zoom into the upper half of the companion body

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

// Generic head-and-shoulders placeholder used for "you" in vs-AI games (and any
// online opponent whose character we don't know yet).
function Silhouette({ size }: { size: number }) {
  return (
    <View style={[styles.silWrap, { width: size, height: size }]}>
      <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: 999, backgroundColor: '#C7B2A1' }} />
      <View
        style={{
          width: size * 0.72,
          height: size * 0.4,
          marginTop: size * 0.05,
          borderTopLeftRadius: size * 0.4,
          borderTopRightRadius: size * 0.4,
          backgroundColor: '#C7B2A1',
        }}
      />
    </View>
  );
}

export function Connect4Game({
  online,
  onLeave,
}: {
  online?: { room: string; isHost: boolean };
  onLeave?: () => void;
} = {}) {
  const { t } = useTranslation();
  const {
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    companionSkins,
    bunSkinId,
    profileCompanionId,
    profileSkinId,
    friendCode,
    friends,
    addFriend,
  } = useApp();

  const opponent = resolveActiveCompanion(activeCompanionId, defaultCompanionId, companionSlots, bunSkinId, companionSkins);
  // The player's own avatar (their profile bun) for the left-hand player card.
  const playerFigure = resolveProfileFigure({
    profileCompanionId,
    profileSkinId,
    activeCompanionId,
    defaultCompanionId,
    companionSlots,
    bunSkinId,
    companionSkins,
  });
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
    if (result === 'draw') return t('connect4.draw');
    if (result) return result === myPlayer ? t('connect4.youWin') : opp === 'ai' ? t('connect4.nameWins', { name: opponent.name }) : t('connect4.friendWins');
    if (turn === myPlayer) return t('connect4.yourTurn');
    return opp === 'ai' ? t('connect4.nameThinking', { name: opponent.name }) : t('connect4.friendsTurn');
  })();

  // ── Mode screen ─────────────────────────────────────────────────────────
  if (screen === 'mode') {
    return (
      <View style={styles.playRoot}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} onPress={() => onLeave?.()} hitSlop={8}>
          <Image source={BACK_IMG} style={styles.backImg} contentFit="contain" />
        </Pressable>
        <Image source={TITLE_IMG} style={styles.titleImg} contentFit="contain" />
        <View style={styles.subPill}>
          <ThemedText type="smallBold" style={styles.subPillText}>{t('connect4.dropDiscs')}</ThemedText>
        </View>
        <View style={styles.modeRow}>
          <Pressable
            style={({ pressed }) => [styles.modeCard, pressed && styles.pressed]}
            onPress={startAi}>
            <Image source={opponent.imageSource} style={styles.modeIcon} contentFit="contain" />
            <ThemedText type="smallBold" style={styles.modeTitle}>{t('connect4.vsName', { name: opponent.name })}</ThemedText>
            <ThemedText type="small" style={styles.modeSub}>{t('connect4.playTheAI')}</ThemedText>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.modeCard, pressed && styles.pressed]} onPress={() => { setOpp('online'); setScreen('lobby'); }}>
            <View style={styles.modeDiscPair}>
              <Image source={PIECE_IMG[1]} style={styles.modePiece} contentFit="contain" />
              <View style={{ marginLeft: -10 }}><Image source={PIECE_IMG[2]} style={styles.modePiece} contentFit="contain" /></View>
            </View>
            <ThemedText type="smallBold" style={styles.modeTitle}>{t('connect4.online')}</ThemedText>
            <ThemedText type="small" style={styles.modeSub}>{t('connect4.playFriend')}</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Online lobby ────────────────────────────────────────────────────────
  if (screen === 'lobby') {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="subtitle" style={styles.heading}>{t('connect4.playOnline')}</ThemedText>

        {connecting && !opponentPresent ? (
          <ThemedView type="backgroundElement" style={styles.lobbyCard}>
            <ThemedText type="smallBold" style={styles.center}>{t('connect4.waitingFriend')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {t('connect4.shareCodeHint')}
            </ThemedText>
            <ThemedText style={styles.codeBig}>{friendCode}</ThemedText>
            <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={shareCode}>
              <ThemedText type="smallBold" style={styles.primaryBtnText}>{t('connect4.shareCode')}</ThemedText>
            </Pressable>
            <Pressable onPress={backToModes} style={styles.linkBtn}>
              <ThemedText type="small" themeColor="textSecondary">{t('common.cancel')}</ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <>
            <ThemedView type="backgroundElement" style={styles.lobbyCard}>
              <ThemedText type="smallBold" style={styles.center}>{t('connect4.yourCode')}</ThemedText>
              <ThemedText style={styles.codeBig}>{friendCode || '——'}</ThemedText>
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, (!friendCode || !hasAccess) && styles.btnDisabled, pressed && styles.pressed]}
                onPress={hostGame}
                disabled={!friendCode || !hasAccess}>
                <ThemedText type="smallBold" style={styles.primaryBtnText}>{t('connect4.hostWait')}</ThemedText>
              </Pressable>
              {!hasAccess && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{t('connect4.hostNeedsPlus')}</ThemedText>
              )}
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.lobbyCard}>
              <ThemedText type="smallBold" style={styles.center}>{t('connect4.joinFriend')}</ThemedText>
              {!hasAccess && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>{t('connect4.freePlayFriend')}</ThemedText>
              )}
              <TextInput
                style={styles.codeInput}
                value={joinInput}
                onChangeText={(txt) => setJoinInput(txt.toUpperCase())}
                placeholder={t('friends.enterFriendCode')}
                placeholderTextColor="#B9A78F"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
              />
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, (joinInput.trim().length < 4) && styles.btnDisabled, pressed && styles.pressed]}
                onPress={joinGame}
                disabled={joinInput.trim().length < 4}>
                <ThemedText type="smallBold" style={styles.primaryBtnText}>{t('connect4.joinGame')}</ThemedText>
              </Pressable>
            </ThemedView>

            <Pressable onPress={backToModes} style={styles.linkBtn}>
              <ThemedText type="small" themeColor="textSecondary">{t('connect4.back')}</ThemedText>
            </Pressable>
          </>
        )}
      </ThemedView>
    );
  }

  // ── Play screen ─────────────────────────────────────────────────────────
  const oppPiece: Player = myPlayer === 1 ? 2 : 1;
  const myTurn = !result && !oppLeft && turn === myPlayer;
  const gameOver = !!result || oppLeft;
  const rematch = () => {
    resetGame(1);
    if (opp === 'online') roomRef.current?.sendRematch();
  };

  // Avatars:
  //  • vs-AI  → you are a placeholder silhouette; the AI shows the top half of
  //    your active companion.
  //  • online → you show your profile character; the opponent shows their
  //    friend-profile character + skin (looked up by the room/friend code).
  const friendRec = opp === 'online' && online ? friends.find((f) => f.code === online.room) : undefined;
  const friendChar = friendRec?.companionId ? getCompanionImage(friendRec.companionId, friendRec.skinId) : null;
  const leftAvatar = opp === 'ai' ? null : playerFigure;
  const rightAvatar = opp === 'ai' ? opponent.imageSource : friendChar;
  const rightName = opp === 'ai' ? opponent.name : friendRec?.name || t('connect4.friend');

  // One player card: framed avatar (top-half face in the cut-out centre) + name.
  const playerCard = (avatar: number | { uri: string } | null, name: string, piece: Player) => {
    const { x, y } = FRAME_CENTER[piece];
    return (
      <View style={styles.playerCard}>
        <View style={styles.frameWrap}>
          {/* Frame art first; the avatar sits on its cream centre */}
          <Image source={FRAME_IMG[piece]} style={styles.frameImg} contentFit="contain" />
          <View
            style={[styles.faceClip, {
              width: FACE_D,
              height: FACE_D,
              borderRadius: FACE_D / 2,
              left: x * FRAME_SIZE - FACE_D / 2,
              top: y * FRAME_SIZE - FACE_D / 2,
            }]}>
            {avatar ? (
              // Zoomed onto the upper half of the companion's body (head + chest).
              <Image
                source={avatar}
                style={{
                  position: 'absolute',
                  top: -FACE_D * 0.12,
                  left: -FACE_D * (FACE_ZOOM - 1) / 2,
                  width: FACE_D * FACE_ZOOM,
                  height: FACE_D * FACE_ZOOM,
                }}
                contentFit="cover"
                contentPosition="top"
              />
            ) : (
              <Silhouette size={FACE_D} />
            )}
          </View>
        </View>
        <View style={styles.namePill}>
          <Image source={PIECE_IMG[piece]} style={styles.namePiece} contentFit="contain" />
          <ThemedText type="smallBold" numberOfLines={1} style={styles.nameText}>{name}</ThemedText>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.playRoot}>
      {/* Back / leave (top-left) */}
      <Pressable style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} onPress={() => onLeave?.()} hitSlop={8}>
        <Image source={BACK_IMG} style={styles.backImg} contentFit="contain" />
      </Pressable>

      {/* Title logo */}
      <Image source={TITLE_IMG} style={styles.titleImg} contentFit="contain" />

      {/* Players — the "VS" badge is baked into the background between them. */}
      <View style={styles.playersRow}>
        {playerCard(leftAvatar, t('connect4.you'), myPlayer)}
        <View style={styles.vsGap} />
        {playerCard(rightAvatar, rightName, oppPiece)}
      </View>

      {/* Status pill */}
      <View style={styles.statusPill}>
        <ThemedText type="smallBold" style={styles.statusText}>
          ♥ {oppLeft ? t('connect4.friendLeft') : statusText} ♥
        </ThemedText>
      </View>

      {/* Board */}
      <View style={styles.boardWrap}>
        <View style={styles.boardBacking} />
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
          const canDrop = myTurn && board[0][c] === 0 && (opp === 'ai' || opponentPresent);
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

      {/* Disc tray — shows whose disc is in play */}
      <View style={styles.tray}>
        <View style={[styles.trayDisc, !result && turn === 1 && styles.trayActive]}>
          <Image source={PIECE_IMG[1]} style={styles.trayPiece} contentFit="contain" />
        </View>
        <View style={[styles.trayDisc, !result && turn === 2 && styles.trayActive]}>
          <Image source={PIECE_IMG[2]} style={styles.trayPiece} contentFit="contain" />
        </View>
      </View>

      {/* Footer actions — only once the game is over */}
      {gameOver && (
        <View style={styles.footerRow}>
          <Pressable
            style={({ pressed }) => [pressed && styles.pressed]}
            onPress={rematch}
            accessibilityLabel={t('connect4.rematch')}>
            <Image source={BTN_REMATCH} style={[styles.btnImg, { aspectRatio: BTN_REMATCH_AR }]} contentFit="contain" />
          </Pressable>
          <Pressable
            style={({ pressed }) => [pressed && styles.pressed]}
            onPress={() => onLeave?.()}
            accessibilityLabel={t('connect4.leave')}>
            <Image source={BTN_LEAVE} style={[styles.btnImg, { aspectRatio: BTN_LEAVE_AR }]} contentFit="contain" />
          </Pressable>
        </View>
      )}
    </View>
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
  subPill: {
    backgroundColor: '#FFFCF8',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#F4D7DE',
    marginTop: 2,
  },
  subPillText: { color: BakeryColors.cocoaDark, fontSize: 13 },
  modeRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.three },
  modeCard: {
    width: 140,
    borderRadius: 20,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFCF8',
    borderWidth: 1.5,
    borderColor: '#F4D7DE',
  },
  modeIcon: { width: 56, height: 56 },
  modeDiscPair: { flexDirection: 'row', alignItems: 'center', height: 56, justifyContent: 'center' },
  modePiece: { width: 34, height: 34 },
  modeTitle: { color: BakeryColors.cocoaDark, fontSize: 15, textAlign: 'center' },
  modeSub: { color: '#9A8978', textAlign: 'center' },

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

  // ── Play screen ──────────────────────────────────────────────────────────
  playRoot: { flex: 1, width: '100%', alignItems: 'center', gap: Spacing.one, backgroundColor: 'transparent' },
  backBtn: { position: 'absolute', top: -2, left: 2, width: 58, height: 58, zIndex: 5 },
  backImg: { width: 58, height: 58 },
  titleImg: { width: Math.min(BOARD_W, 320), height: Math.min(BOARD_W, 320) / 2.66, marginTop: 2 },

  // Players (VS badge lives in the background art)
  playersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  vsGap: { width: 64 },
  playerCard: { alignItems: 'center', gap: 5, width: 100 },
  frameWrap: { width: FRAME_SIZE, height: FRAME_SIZE, alignItems: 'center', justifyContent: 'center' },
  faceClip: { position: 'absolute', overflow: 'hidden', backgroundColor: '#FEECD4' },
  silWrap: { alignItems: 'center', justifyContent: 'flex-end', backgroundColor: '#F3E7DA' },
  frameImg: { position: 'absolute', width: FRAME_SIZE, height: FRAME_SIZE },
  namePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 96,
    backgroundColor: '#FFFCF8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  namePiece: { width: 16, height: 16 },
  nameText: { flexShrink: 1, color: BakeryColors.cocoaDark },

  // Status pill
  statusPill: {
    backgroundColor: '#FFFCF8',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: '#F4D7DE',
  },
  statusText: { color: BakeryColors.jam, fontSize: 15 },

  // Board
  boardWrap: { width: BOARD_W, height: BOARD_H, overflow: 'hidden', marginTop: 0 },
  boardBacking: {
    position: 'absolute',
    left: BOARD_W * 0.11,
    width: BOARD_W * 0.78,
    top: BOARD_H * 0.25,
    height: BOARD_H * 0.43,
    borderRadius: 18,
    backgroundColor: BOARD_CREAM,
  },
  boardImg: { position: 'absolute', width: BOARD_W, height: BOARD_H },
  piece: { position: 'absolute', width: PIECE_D, height: PIECE_D },
  pieceImg: { width: '100%', height: '100%' },
  pieceWin: { borderRadius: PIECE_D / 2, borderWidth: 3, borderColor: '#FFE08A' },
  colZone: { position: 'absolute', top: 0, height: BOARD_H },

  // Disc tray
  tray: {
    flexDirection: 'row',
    gap: Spacing.three,
    backgroundColor: '#FFFCF8',
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: '#F4D7DE',
  },
  trayDisc: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', opacity: 0.4 },
  trayActive: { opacity: 1 },
  trayPiece: { width: '100%', height: '100%' },

  // Footer buttons (art with baked-in labels) — pinned to the bottom, over the
  // background's white panel, when the game ends.
  footerRow: {
    position: 'absolute',
    bottom: Spacing.three,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnImg: { height: 58 },
});
