/**
 * Break game screen — accessible only from session-complete after a study session.
 * Hosts a countdown timer + optional game (Tic-Tac-Toe free; Memory Cards / Word Puzzle unlocked via shop).
 * No coins are earned here.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Companion } from '@/components/companion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { getCompanionLine } from '@/constants/companion-lines';
import { Connect4Game } from '@/game/connect4/Connect4Game';
import { joinGameRoom, type GameRoom } from '@/lib/game-net';
import { HeartToken, StarToken, MemoryIcon, MEMORY_ICON_COUNT } from '@/game/cute-icons';
import { MaxContentWidth, Spacing } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────
type GameId = 'tictactoe' | 'memory' | 'connect4' | 'cakekitchen';
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

function TicTacToeGame({ online }: { online?: { room: string; isHost: boolean } } = {}) {
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

  const handleModeChange = (nextMode: TicTacToeMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    resetBoard();
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
        ? "It's a draw!"
        : winner === mySymbol
          ? 'You win! 🎉'
          : 'Friend wins!'
      : !opponentPresent
        ? 'Waiting for friend…'
        : myTurnOnline
          ? 'Your turn'
          : "Friend's turn"
    : gameOver
      ? winner === 'draw'
        ? "It's a draw!"
        : mode === 'ai'
          ? winner === 'X'
            ? 'You win!'
            : 'Companion wins!'
          : winner === 'X'
            ? 'Player 1 wins!'
            : 'Player 2 wins!'
      : mode === 'ai'
        ? isPlayerTurn
          ? 'Your turn'
          : 'Companion thinking...'
        : isPlayerTurn
          ? 'Player 1 turn'
          : 'Player 2 turn';

  return (
    <ThemedView style={tttStyles.container}>
      {online ? (
        <ThemedText type="smallBold" style={tttStyles.subtitle}>
          You are {mySymbol === 'X' ? '💗 Hearts' : '⭐ Stars'}
        </ThemedText>
      ) : (
        <ThemedView style={tttStyles.modeRow}>
          <Pressable onPress={() => handleModeChange('ai')}>
            <ThemedView
              style={[tttStyles.modeChip, mode === 'ai' && tttStyles.modeChipActive]}>
              <ThemedText
                type="smallBold"
                style={[tttStyles.modeChipText, mode === 'ai' && tttStyles.modeChipTextActive]}>
                vs AI
              </ThemedText>
            </ThemedView>
          </Pressable>
          <Pressable onPress={() => handleModeChange('friend')}>
            <ThemedView
              style={[tttStyles.modeChip, mode === 'friend' && tttStyles.modeChipActive]}>
              <ThemedText
                type="smallBold"
                style={[tttStyles.modeChipText, mode === 'friend' && tttStyles.modeChipTextActive]}>
                vs Friend
              </ThemedText>
            </ThemedView>
          </Pressable>
        </ThemedView>
      )}
      <ThemedText type="smallBold" style={tttStyles.subtitle}>
        {statusText}
      </ThemedText>
      <ThemedView style={tttStyles.grid}>
        {board.map((cell, i) => {
          const isWinCell = winLine?.includes(i) ?? false;
          return (
            <Pressable
              key={i}
              style={({ pressed }) => [tttStyles.cell, isWinCell && tttStyles.cellWin, pressed && tttStyles.cellPressed]}
              onPress={() => handlePress(i)}>
              {cell === 'X' ? <HeartToken size={48} /> : cell === 'O' ? <StarToken size={48} /> : null}
            </Pressable>
          );
        })}
      </ThemedView>
      {gameOver && (
        <Pressable style={tttStyles.resetBtn} onPress={reset}>
          <ThemedText type="smallBold" style={tttStyles.resetBtnText}>
            Play again
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

const tttStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.three },
  modeRow: { flexDirection: 'row', gap: Spacing.two },
  modeChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(124,111,90,0.12)',
  },
  modeChipActive: {
    backgroundColor: '#7C6F5A',
  },
  modeChipText: {
    color: '#7C6F5A',
  },
  modeChipTextActive: {
    color: '#FFF',
  },
  subtitle: { fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 240, gap: 4 },
  cell: {
    width: 76,
    height: 76,
    borderRadius: 14,
    backgroundColor: 'rgba(124,111,90,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellWin: { backgroundColor: 'rgba(245,166,35,0.2)' },
  cellPressed: { opacity: 0.8 },
  cellText: { fontSize: 36, fontWeight: '700', lineHeight: 44 },
  cellX: { color: '#7C6F5A' },
  cellO: { color: '#E05C3A' },
  resetBtn: {
    backgroundColor: '#7C6F5A',
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  resetBtnText: { color: '#FFF' },
});

// ─── Memory Cards ─────────────────────────────────────────────────────────────
// Each value is a cute-icon index (rendered with <MemoryIcon/>); 8 pairs.
const EMOJI_PAIRS = Array.from({ length: MEMORY_ICON_COUNT }, (_, i) => String(i));
type MemoryMode = 'ai' | 'friend';
type MemoryPlayer = 'one' | 'two';

type MemCard = { id: number; emoji: string; flipped: boolean; matched: boolean };

function initCards(): MemCard[] {
  return [...EMOJI_PAIRS, ...EMOJI_PAIRS]
    .sort(() => Math.random() - 0.5)
    .map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_SIZE = Math.max(60, Math.floor((Math.min(SCREEN_W, 400) - 48 - 18) / 4));

function pickRandomCardId(ids: number[]): number | null {
  if (ids.length === 0) return null;
  return ids[Math.floor(Math.random() * ids.length)];
}

function getAiMemoryChoices(cards: MemCard[], seenCards: Record<string, number[]>): [number, number] | null {
  const availableIds = cards.filter((card) => !card.matched && !card.flipped).map((card) => card.id);
  if (availableIds.length < 2) return null;

  for (const ids of Object.values(seenCards)) {
    const known = Array.from(new Set(ids)).filter((id) => availableIds.includes(id));
    if (known.length >= 2) return [known[0], known[1]];
  }

  const seenIdSet = new Set(Object.values(seenCards).flat());
  const unseenIds = availableIds.filter((id) => !seenIdSet.has(id));
  const firstId = pickRandomCardId(unseenIds.length > 0 ? unseenIds : availableIds);
  if (firstId === null) return null;

  const firstCard = cards.find((card) => card.id === firstId);
  if (!firstCard) return null;

  const knownMateIds = Array.from(new Set(seenCards[firstCard.emoji] ?? [])).filter(
    (id) => id !== firstId && availableIds.includes(id),
  );
  const remainingIds = availableIds.filter((id) => id !== firstId);
  const remainingSeenIdSet = new Set(
    Object.values(seenCards)
      .flat()
      .filter((id) => id !== firstId),
  );
  const remainingUnseenIds = remainingIds.filter((id) => !remainingSeenIdSet.has(id));
  const secondId =
    knownMateIds[0] ??
    pickRandomCardId(remainingUnseenIds.length > 0 ? remainingUnseenIds : remainingIds);

  return secondId === null ? null : [firstId, secondId];
}

function MemoryCardsGame({ online }: { online?: { room: string; isHost: boolean } } = {}) {
  const [cards, setCards] = useState<MemCard[]>(() => initCards());
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [mode, setMode] = useState<MemoryMode>('ai');
  const [currentPlayer, setCurrentPlayer] = useState<MemoryPlayer>('one');
  const [scores, setScores] = useState<Record<MemoryPlayer, number>>({ one: 0, two: 0 });
  const [seenCards, setSeenCards] = useState<Record<string, number[]>>({});
  const checking = useRef(false);
  const timeoutIds = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const aiPlannedSecondId = useRef<number | null>(null);

  // Online: host = player 'one' (goes first) and owns the shuffle.
  const myPlayer: MemoryPlayer | null = online ? (online.isHost ? 'one' : 'two') : null;
  const roomRef = useRef<GameRoom | null>(null);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const [opponentPresent, setOpponentPresent] = useState(false);
  const deckSent = useRef(false);
  const handleRef = useRef<(id: number, fromAi?: boolean, fromRemote?: boolean) => void>(() => {});

  const matchedCount = cards.filter((c) => c.matched).length;
  const isComplete = matchedCount === 16;
  const pairCount = matchedCount / 2;
  const playerOneLabel = online ? (myPlayer === 'one' ? 'You' : 'Friend') : mode === 'ai' ? 'You' : 'Player 1';
  const playerTwoLabel = online ? (myPlayer === 'two' ? 'You' : 'Friend') : mode === 'ai' ? 'Companion' : 'Player 2';

  const applyDeck = (order: string[]) => {
    clearPendingTimeouts();
    checking.current = false;
    setCards(order.map((emoji, id) => ({ id, emoji, flipped: false, matched: false })));
    setFlippedIds([]);
    setMoves(0);
    setCurrentPlayer('one');
    setScores({ one: 0, two: 0 });
    setSeenCards({});
  };

  const clearPendingTimeouts = () => {
    timeoutIds.current.forEach((id) => clearTimeout(id));
    timeoutIds.current = [];
  };

  const rememberCard = (id: number, emoji: string) => {
    setSeenCards((prev) => ({
      ...prev,
      [emoji]: Array.from(new Set([...(prev[emoji] ?? []), id])),
    }));
  };

  const forgetEmoji = (emoji: string) => {
    setSeenCards((prev) => {
      const next = { ...prev };
      delete next[emoji];
      return next;
    });
  };

  const reset = () => {
    if (online) {
      if (online.isHost) {
        const order = initCards().map((c) => c.emoji);
        applyDeck(order);
        roomRef.current?.send('deck', { order });
      } else {
        roomRef.current?.send('rematch');
      }
      return;
    }
    clearPendingTimeouts();
    checking.current = false;
    aiPlannedSecondId.current = null;
    setCards(initCards());
    setFlippedIds([]);
    setMoves(0);
    setCurrentPlayer('one');
    setScores({ one: 0, two: 0 });
    setSeenCards({});
  };

  const handleModeChange = (nextMode: MemoryMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    reset();
  };

  const handleCardPress = (id: number, fromAi = false, fromRemote = false) => {
    if (online) {
      if (!fromRemote && (currentPlayer !== myPlayer || !opponentPresent)) return;
    } else if (mode === 'ai' && currentPlayer === 'two' && !fromAi) {
      return;
    }
    if (checking.current) return;
    const card = cards[id];
    if (card.flipped || card.matched || flippedIds.length >= 2) return;

    if (online && !fromRemote) roomRef.current?.send('flip', { id });

    rememberCard(id, card.emoji);
    const newFlipped = [...flippedIds, id];
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, flipped: true } : c)));
    setFlippedIds(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      checking.current = true;
      const [a, b] = newFlipped;
      const emoA = cards[a].emoji;
      const emoB = id === b ? card.emoji : cards[b].emoji;
      const matched = emoA === (id === b ? card.emoji : cards[b].emoji);
      const activePlayer = currentPlayer;

      const timeoutId = setTimeout(() => {
        if (matched) {
          setCards((prev) =>
            prev.map((c) => (c.id === a || c.id === b ? { ...c, matched: true, flipped: true } : c)),
          );
          forgetEmoji(emoA);
          setScores((prev) => ({
            ...prev,
            [activePlayer]: prev[activePlayer] + 1,
          }));
        } else {
          setCards((prev) =>
            prev.map((c) => (c.id === a || c.id === b ? { ...c, flipped: false } : c)),
          );
          setCurrentPlayer((prev) => (prev === 'one' ? 'two' : 'one'));
        }
        setFlippedIds([]);
        checking.current = false;
      }, 900);
      timeoutIds.current.push(timeoutId);
    }
  };

  handleRef.current = handleCardPress;

  useEffect(() => {
    return () => {
      clearPendingTimeouts();
    };
  }, []);

  // Online room: shared shuffle (host owns it) + synced flips.
  useEffect(() => {
    if (!online) return;
    roomRef.current = joinGameRoom(online.room, online.isHost, {
      onMessage: (type, data) => {
        if (type === 'flip') {
          handleRef.current((data as { id: number }).id, false, true);
        } else if (type === 'deck') {
          applyDeck((data as { order: string[] }).order);
        } else if (type === 'rematch' && online.isHost) {
          const order = initCards().map((c) => c.emoji);
          applyDeck(order);
          roomRef.current?.send('deck', { order });
        }
      },
      onPresence: (present) => {
        setOpponentPresent(present);
        if (present && online.isHost && !deckSent.current) {
          deckSent.current = true;
          roomRef.current?.send('deck', { order: cardsRef.current.map((c) => c.emoji) });
        }
      },
    });
    return () => roomRef.current?.leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (online) return;
    if (mode !== 'ai' || currentPlayer !== 'two' || checking.current || flippedIds.length > 0 || isComplete) {
      return;
    }

    const choices = getAiMemoryChoices(cards, seenCards);
    if (!choices) return;
    const [firstId, secondId] = choices;
    aiPlannedSecondId.current = secondId;

    const firstTimeout = setTimeout(() => {
      handleCardPress(firstId, true);
    }, 450);

    timeoutIds.current.push(firstTimeout);

    return () => {
      clearTimeout(firstTimeout);
    };
  }, [cards, currentPlayer, flippedIds.length, isComplete, mode, seenCards]);

  useEffect(() => {
    if (online) return;
    if (mode !== 'ai' || currentPlayer !== 'two' || checking.current || flippedIds.length !== 1 || isComplete) {
      return;
    }

    const secondId = aiPlannedSecondId.current;
    if (secondId === null) return;

    const secondTimeout = setTimeout(() => {
      handleCardPress(secondId, true);
      aiPlannedSecondId.current = null;
    }, 550);

    timeoutIds.current.push(secondTimeout);

    return () => {
      clearTimeout(secondTimeout);
    };
  }, [currentPlayer, flippedIds.length, isComplete, mode]);

  const myScore = myPlayer ? scores[myPlayer] : 0;
  const oppScore = myPlayer ? scores[myPlayer === 'one' ? 'two' : 'one'] : 0;
  const statusText = online
    ? !opponentPresent
      ? 'Waiting for friend…'
      : isComplete
        ? myScore === oppScore
          ? "It's a tie!"
          : myScore > oppScore
            ? 'You win! 🎉'
            : 'Friend wins!'
        : currentPlayer === myPlayer
          ? 'Your turn'
          : "Friend's turn"
    : isComplete
      ? scores.one === scores.two
        ? "It's a tie!"
        : mode === 'ai'
          ? scores.one > scores.two
            ? 'You win!'
            : 'Companion wins!'
          : scores.one > scores.two
            ? 'Player 1 wins!'
            : 'Player 2 wins!'
      : mode === 'ai'
        ? currentPlayer === 'one'
          ? 'Your turn'
          : 'Companion turn'
        : currentPlayer === 'one'
          ? 'Player 1 turn'
          : 'Player 2 turn';

  return (
    <ThemedView style={memStyles.container}>
      {!online && (
        <ThemedView style={tttStyles.modeRow}>
          <Pressable onPress={() => handleModeChange('ai')}>
            <ThemedView style={[tttStyles.modeChip, mode === 'ai' && tttStyles.modeChipActive]}>
              <ThemedText
                type="smallBold"
                style={[tttStyles.modeChipText, mode === 'ai' && tttStyles.modeChipTextActive]}>
                vs AI
              </ThemedText>
            </ThemedView>
          </Pressable>
          <Pressable onPress={() => handleModeChange('friend')}>
            <ThemedView style={[tttStyles.modeChip, mode === 'friend' && tttStyles.modeChipActive]}>
              <ThemedText
                type="smallBold"
                style={[tttStyles.modeChipText, mode === 'friend' && tttStyles.modeChipTextActive]}>
                vs Friend
              </ThemedText>
            </ThemedView>
          </Pressable>
        </ThemedView>
      )}
      <ThemedText type="smallBold" style={memStyles.statusText}>
        {statusText}
      </ThemedText>
      <ThemedView style={memStyles.meta}>
        <ThemedText type="small" themeColor="textSecondary">
          Pairs: {pairCount}/8
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Moves: {moves}
        </ThemedText>
      </ThemedView>
      <ThemedView style={memStyles.scoreRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {playerOneLabel}: {scores.one}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {playerTwoLabel}: {scores.two}
        </ThemedText>
      </ThemedView>
      <ThemedView style={memStyles.grid}>
        {cards.map((card) => (
          <Pressable
            key={card.id}
            style={({ pressed }) => [
              memStyles.card,
              (card.flipped || card.matched) && memStyles.cardFlipped,
              card.matched && memStyles.cardMatched,
              pressed && memStyles.cardPressed,
            ]}
            onPress={() => handleCardPress(card.id)}>
            {card.flipped || card.matched ? (
              <MemoryIcon index={Number(card.emoji)} size={CARD_SIZE * 0.62} />
            ) : (
              <View style={memStyles.cardCover} />
            )}
          </Pressable>
        ))}
      </ThemedView>
      {isComplete && (
        <ThemedView style={memStyles.completeRow}>
          <ThemedText type="smallBold">{statusText}</ThemedText>
          <Pressable style={tttStyles.resetBtn} onPress={reset}>
            <ThemedText type="smallBold" style={tttStyles.resetBtnText}>Play again</ThemedText>
          </Pressable>
        </ThemedView>
      )}
    </ThemedView>
  );
}

const memStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.two },
  statusText: { fontSize: 15 },
  meta: { flexDirection: 'row', gap: Spacing.four },
  scoreRow: { flexDirection: 'row', gap: Spacing.four },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'center' },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: 10,
    backgroundColor: 'rgba(124,111,90,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFlipped: { backgroundColor: 'rgba(100,181,246,0.2)' },
  cardMatched: { backgroundColor: 'rgba(129,199,132,0.3)' },
  cardPressed: { opacity: 0.8 },
  cardText: { fontSize: CARD_SIZE * 0.45 },
  cardCover: {
    width: '60%', height: '60%', borderRadius: 999,
    backgroundColor: '#F6C8C2', borderWidth: 2, borderColor: '#F2A0B5',
  },
  completeRow: { alignItems: 'center', gap: Spacing.two },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
const ALLOWED_BREAK_MINUTES = [5, 10, 15];
const CONNECT4_BG = require('@/assets/images/connect4/background.png');

export default function BreakGameScreen() {
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
    game && room && role && (game === 'connect4' || game === 'tictactoe' || game === 'memory')
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

  const GAMES: { id: GameId; name: string; emoji: string; free: boolean; shopItemId: string | null; route?: string; icon?: number; tint: string; featured?: boolean }[] = [
    { id: 'cakekitchen', name: 'BatterDash', emoji: '🎂', free: true, shopItemId: null, route: '/cake-game', icon: require('@/assets/images/cake/batterdash-banner.png'), tint: '#FBE0E6', featured: true },
    { id: 'tictactoe', name: 'Tic-Tac-Toe', emoji: '⭕', free: true, shopItemId: null, icon: require('@/assets/images/games/placeholder.png'), tint: '#FBEAD2' },
    { id: 'memory', name: 'Memory Cards', emoji: '🃏', free: true, shopItemId: null, icon: require('@/assets/images/games/placeholder.png'), tint: '#F6DCE4' },
    { id: 'connect4', name: 'Connect 4', emoji: '🔴', free: true, shopItemId: null, icon: require('@/assets/images/games/connect4.png'), tint: '#DFEAF4' },
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
        ? 'Free to play'
        : isPlus
          ? 'Included with Plus'
          : 'Unlocked'
      : g.id === 'connect4'
        ? 'Play a friend free'
        : 'Get Plus to unlock';

  if (!validEntry) return null;

  if (phase === 'over') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <Companion pose="cheering" size="full" />
          <ThemedView style={styles.overBlock}>
            <ThemedText type="subtitle" style={styles.overTitle}>
              Break time is up!
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.bubbleCard}>
              <ThemedText type="small" style={styles.bubbleText}>{breakOverLine}</ThemedText>
            </ThemedView>
          </ThemedView>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={goHome}>
            <ThemedText type="smallBold" style={styles.primaryBtnText}>
              Back to studying!
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const connect4Active = phase === 'playing' && selectedGame === 'connect4';

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
                <ThemedText type="smallBold">Break ends in</ThemedText>
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
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollFlex}>
            <ThemedView style={styles.selectContent}>
              <ThemedText type="subtitle" style={styles.selectTitle}>
                Choose a game
              </ThemedText>
              {!isBrowse && (
                <ThemedText type="small" themeColor="textSecondary">
                  No coins are earned during breaks
                </ThemedText>
              )}

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
                            <ThemedText style={styles.plusBadgeText}>Plus</ThemedText>
                          </ThemedView>
                        )}
                      </View>
                      <ThemedText type="smallBold" numberOfLines={1}>{g.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {subtitleFor(g, unlocked)}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ThemedView>

              {!isBrowse && (
                <Pressable onPress={startResting} style={styles.restBtn}>
                  <ThemedText type="linkPrimary">Just rest →</ThemedText>
                </Pressable>
              )}
            </ThemedView>
          </ScrollView>
        ) : phase === 'resting' ? (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollFlex}>
            <ThemedView style={styles.restContent}>
              <Companion pose="idle" size="full" />
              <ThemedView type="backgroundElement" style={styles.restCard}>
                <ThemedText type="subtitle" style={styles.restTitle}>
                  Rest a little
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.restText}>
                  Your break timer is still running. Sit back until you are ready to study again.
                </ThemedText>
              </ThemedView>

              <Pressable onPress={showGames} style={styles.backGameBtn}>
                <ThemedText type="small" themeColor="textSecondary">
                  ← Choose a game instead
                </ThemedText>
              </Pressable>
            </ThemedView>
          </ScrollView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollFlex}>
            <ThemedView style={styles.gameContainer}>
              <Pressable onPress={showGames} style={styles.closeBtn} hitSlop={8}>
                <ThemedText style={styles.closeBtnText}>✕</ThemedText>
              </Pressable>
              {selectedGame === 'tictactoe' && (
                <TicTacToeGame
                  online={onlineSession?.game === 'tictactoe' ? { room: onlineSession.room, isHost: onlineSession.isHost } : undefined}
                />
              )}
              {selectedGame === 'memory' && (
                <MemoryCardsGame
                  online={onlineSession?.game === 'memory' ? { room: onlineSession.room, isHost: onlineSession.isHost } : undefined}
                />
              )}
              {selectedGame === 'connect4' && (
                <Connect4Game
                  online={onlineSession?.game === 'connect4' ? { room: onlineSession.room, isHost: onlineSession.isHost } : undefined}
                />
              )}
            </ThemedView>
          </ScrollView>
        )}

        {phase !== 'playing' && (
          <Pressable
            style={({ pressed }) => [styles.endStudyBtn, pressed && styles.pressed]}
            onPress={goHome}>
            <ThemedText type="smallBold" style={styles.endStudyBtnText}>
              {isBrowse ? '🏠 Home' : 'End study'}
            </ThemedText>
          </Pressable>
        )}
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
  selectTitle: { fontSize: 22, lineHeight: 28 },
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
