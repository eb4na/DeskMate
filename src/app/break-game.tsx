/**
 * Break game screen — accessible only from session-complete after a study session.
 * Hosts a countdown timer + optional game (Tic-Tac-Toe free; Memory Cards / Word Puzzle unlocked via shop).
 * No coins are earned here.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, TextInput, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Companion } from '@/components/companion';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useApp } from '@/context/app-context';
import { getCompanionLine } from '@/constants/companion-lines';
import { MaxContentWidth, Spacing } from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────
type GameId = 'tictactoe' | 'memory' | 'wordpuzzle';
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

function TicTacToeGame() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [mode, setMode] = useState<TicTacToeMode>('ai');
  const aiMovePending = useRef(false);

  const { winner, line: winLine } = checkWinner(board);
  const gameOver = !!winner;

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
    if (mode === 'ai' && !isPlayerTurn) return;
    const newBoard = [...board];
    newBoard[idx] = isPlayerTurn ? 'X' : 'O';
    setBoard(newBoard);
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
    resetBoard();
  };

  const statusText = gameOver
    ? winner === 'draw'
      ? "It's a draw!"
      : mode === 'ai'
        ? winner === 'X'
          ? 'You win! 🎉'
          : 'Companion wins! 😄'
        : winner === 'X'
          ? 'Player X wins! 🎉'
          : 'Player O wins! 🎉'
    : mode === 'ai'
      ? isPlayerTurn
        ? 'Your turn (X)'
        : 'Companion thinking...'
      : isPlayerTurn
        ? 'Player X turn'
        : 'Player O turn';

  return (
    <ThemedView style={tttStyles.container}>
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
              <ThemedText style={[tttStyles.cellText, cell === 'X' ? tttStyles.cellX : tttStyles.cellO]}>
                {cell ?? ''}
              </ThemedText>
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
const EMOJI_PAIRS = ['🐶', '🐱', '🐻', '🦊', '🐼', '🦁', '🐸', '🦋'];
type MemoryMode = 'ai' | 'friend';
type MemoryPlayer = 'one' | 'two';

type MemCard = { id: number; emoji: string; flipped: boolean; matched: boolean };

function initCards(): MemCard[] {
  return [...EMOJI_PAIRS, ...EMOJI_PAIRS]
    .sort(() => Math.random() - 0.5)
    .map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
}

const { width: SCREEN_W } = Dimensions.get('window');
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

function MemoryCardsGame() {
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

  const matchedCount = cards.filter((c) => c.matched).length;
  const isComplete = matchedCount === 16;
  const pairCount = matchedCount / 2;
  const playerOneLabel = mode === 'ai' ? 'You' : 'Player 1';
  const playerTwoLabel = mode === 'ai' ? 'Companion' : 'Player 2';

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

  const handleCardPress = (id: number) => {
    if (mode === 'ai' && currentPlayer === 'two') return;
    if (checking.current) return;
    const card = cards[id];
    if (card.flipped || card.matched || flippedIds.length >= 2) return;

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

  useEffect(() => {
    return () => {
      clearPendingTimeouts();
    };
  }, []);

  useEffect(() => {
    if (mode !== 'ai' || currentPlayer !== 'two' || checking.current || flippedIds.length > 0 || isComplete) {
      return;
    }

    const choices = getAiMemoryChoices(cards, seenCards);
    if (!choices) return;
    const [firstId, secondId] = choices;
    aiPlannedSecondId.current = secondId;

    const firstTimeout = setTimeout(() => {
      handleCardPress(firstId);
    }, 450);

    timeoutIds.current.push(firstTimeout);

    return () => {
      clearTimeout(firstTimeout);
    };
  }, [cards, currentPlayer, flippedIds.length, isComplete, mode, seenCards]);

  useEffect(() => {
    if (mode !== 'ai' || currentPlayer !== 'two' || checking.current || flippedIds.length !== 1 || isComplete) {
      return;
    }

    const secondId = aiPlannedSecondId.current;
    if (secondId === null) return;

    const secondTimeout = setTimeout(() => {
      handleCardPress(secondId);
      aiPlannedSecondId.current = null;
    }, 550);

    timeoutIds.current.push(secondTimeout);

    return () => {
      clearTimeout(secondTimeout);
    };
  }, [currentPlayer, flippedIds.length, isComplete, mode]);

  const statusText = isComplete
    ? scores.one === scores.two
      ? "It's a tie! 🎉"
      : mode === 'ai'
        ? scores.one > scores.two
          ? 'You win! 🎉'
          : 'Companion wins! 🎉'
        : scores.one > scores.two
          ? 'Player 1 wins! 🎉'
          : 'Player 2 wins! 🎉'
    : mode === 'ai'
      ? currentPlayer === 'one'
        ? 'Your turn'
        : 'Companion turn'
      : currentPlayer === 'one'
        ? 'Player 1 turn'
        : 'Player 2 turn';

  return (
    <ThemedView style={memStyles.container}>
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
            <ThemedText style={memStyles.cardText}>
              {card.flipped || card.matched ? card.emoji : '?'}
            </ThemedText>
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
  completeRow: { alignItems: 'center', gap: Spacing.two },
});

// ─── Word Puzzle ──────────────────────────────────────────────────────────────
const PUZZLE_WORDS = [
  { word: 'STUDY', clue: 'What you do with books' },
  { word: 'FOCUS', clue: 'Concentrate on one thing' },
  { word: 'NOTES', clue: 'What you write in class' },
  { word: 'LEARN', clue: 'Gain new knowledge' },
  { word: 'BRAIN', clue: 'The thinking organ' },
  { word: 'TIMER', clue: 'Counts down seconds' },
  { word: 'SMART', clue: 'Quick to understand' },
  { word: 'GRADE', clue: 'How your work is scored' },
  { word: 'CLASS', clue: 'Where students learn together' },
  { word: 'PAGES', clue: 'Found in a book' },
];

function scramble(word: string): string {
  let s = word;
  let tries = 0;
  while (s === word && tries < 20) {
    s = word.split('').sort(() => Math.random() - 0.5).join('');
    tries++;
  }
  return s;
}

function WordPuzzleGame() {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [gameOver, setGameOver] = useState(false);

  const words = useMemo(
    () => [...PUZZLE_WORDS].sort(() => Math.random() - 0.5).slice(0, 5),
    [],
  );

  const current = words[round];
  const scrambled = useMemo(() => (current ? scramble(current.word) : ''), [current]);

  const handleSubmit = () => {
    if (!current) return;
    const correct = answer.trim().toUpperCase() === current.word;
    setFeedback(correct ? 'correct' : 'wrong');
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      setFeedback(null);
      setAnswer('');
      if (round + 1 >= words.length) {
        setGameOver(true);
      } else {
        setRound((r) => r + 1);
      }
    }, 900);
  };

  const reset = () => {
    setRound(0);
    setScore(0);
    setAnswer('');
    setFeedback(null);
    setGameOver(false);
  };

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  if (gameOver) {
    return (
      <ThemedView style={wpStyles.container}>
        <ThemedText style={wpStyles.finishEmoji}>
          {score >= 4 ? '🏆' : score >= 2 ? '😊' : '💪'}
        </ThemedText>
        <ThemedText type="smallBold" style={wpStyles.finishTitle}>
          {score}/5 correct!
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {score === 5 ? 'Perfect score!' : score >= 3 ? 'Great job!' : 'Nice try — keep practicing!'}
        </ThemedText>
        <Pressable style={tttStyles.resetBtn} onPress={reset}>
          <ThemedText type="smallBold" style={tttStyles.resetBtnText}>Play again</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={wpStyles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        Word {round + 1}/5 · Score: {score}
      </ThemedText>
      <ThemedView type="backgroundElement" style={wpStyles.clueCard}>
        <ThemedText type="small" themeColor="textSecondary">{current?.clue}</ThemedText>
      </ThemedView>
      <ThemedView style={wpStyles.scrambleRow}>
        {scrambled.split('').map((letter, i) => (
          <ThemedView key={i} type="backgroundElement" style={wpStyles.letterChip}>
            <ThemedText style={wpStyles.letterText}>{letter}</ThemedText>
          </ThemedView>
        ))}
      </ThemedView>
      <TextInput
        style={[wpStyles.input, {
          color: isDark ? '#fff' : '#000',
          borderColor: feedback === 'correct' ? '#81C784' : feedback === 'wrong' ? '#E05C3A' : (isDark ? '#444' : '#DDD'),
          backgroundColor: isDark ? '#1A1A1A' : '#FAFAFA',
        }]}
        value={answer}
        onChangeText={(t) => setAnswer(t.toUpperCase())}
        placeholder="Type your answer..."
        placeholderTextColor={isDark ? '#666' : '#AAA'}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={current?.word.length ?? 10}
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
      {feedback && (
        <ThemedText style={[wpStyles.feedback, feedback === 'correct' ? wpStyles.correct : wpStyles.wrong]}>
          {feedback === 'correct' ? `✓ Correct! "${current?.word}"` : `✗ Answer: "${current?.word}"`}
        </ThemedText>
      )}
      <Pressable
        style={({ pressed }) => [wpStyles.submitBtn, !answer.trim() && wpStyles.submitBtnDisabled, pressed && wpStyles.pressed]}
        onPress={handleSubmit}
        disabled={!answer.trim()}>
        <ThemedText type="smallBold" style={wpStyles.submitBtnText}>Check answer</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const wpStyles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.three, width: '100%' },
  clueCard: { borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: 10, alignItems: 'center' },
  scrambleRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' },
  letterChip: {
    width: 38, height: 38, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  letterText: { fontSize: 18, fontWeight: '700' },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
    width: '80%',
  },
  feedback: { fontSize: 14, fontWeight: '600' },
  correct: { color: '#4CAF50' },
  wrong: { color: '#E05C3A' },
  submitBtn: { backgroundColor: '#7C6F5A', borderRadius: 12, paddingHorizontal: 28, paddingVertical: 10 },
  submitBtnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  submitBtnText: { color: '#FFF' },
  finishEmoji: { fontSize: 48, lineHeight: 56 },
  finishTitle: { fontSize: 22 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
const ALLOWED_BREAK_MINUTES = [5, 10, 15];

export default function BreakGameScreen() {
  const { breakMinutes, fromSession } = useLocalSearchParams<{
    breakMinutes: string;
    fromSession?: string;
  }>();
  const { ownedShopItems, isPlus } = useApp();

  const parsedMinutes = parseInt(breakMinutes ?? '', 10);
  const validEntry =
    fromSession === '1' && ALLOWED_BREAK_MINUTES.includes(parsedMinutes);

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
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);
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
    if (!validEntry || phase === 'over') return;
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

  const GAMES: { id: GameId; name: string; emoji: string; free: boolean; shopItemId: string | null }[] = [
    { id: 'tictactoe', name: 'Tic-Tac-Toe', emoji: '⭕', free: true, shopItemId: null },
    { id: 'memory', name: 'Memory Cards', emoji: '🃏', free: false, shopItemId: 'game_memory' },
    { id: 'wordpuzzle', name: 'Word Puzzle', emoji: '🔤', free: false, shopItemId: 'game_words' },
  ];

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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Timer bar always visible */}
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

        {phase === 'select' ? (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollFlex}>
            <ThemedView style={styles.selectContent}>
              <ThemedText type="subtitle" style={styles.selectTitle}>
                Choose a game
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                No coins are earned during breaks
              </ThemedText>

              <ThemedView style={styles.gameList}>
                {GAMES.map((g) => {
                  const unlocked =
                    g.free ||
                    isPlus ||
                    (g.shopItemId ? ownedShopItems.includes(g.shopItemId) : false);
                  return (
                    <Pressable
                      key={g.id}
                      style={({ pressed }) => [styles.gameCard, !unlocked && styles.gameCardLocked, pressed && unlocked && styles.pressed]}
                      onPress={() => {
                        if (!unlocked) return;
                        setSelectedGame(g.id);
                        setPhase('playing');
                      }}>
                      <ThemedText style={styles.gameEmoji}>{g.emoji}</ThemedText>
                      <ThemedView style={styles.gameInfo}>
                        <ThemedText type="smallBold">{g.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {unlocked
                            ? g.free
                              ? 'Free to play'
                              : isPlus
                                ? 'Included with Plus'
                                : 'Unlocked'
                            : '🔒 Buy in Shop or get Plus'}
                        </ThemedText>
                      </ThemedView>
                      {unlocked ? (
                        g.free ? (
                          <ThemedText style={styles.gameArrow}>→</ThemedText>
                        ) : (
                          <ThemedView style={styles.unlockedBadge}>
                            <ThemedText style={styles.unlockedBadgeText}>
                              {isPlus ? 'Plus' : 'Shop unlock'}
                            </ThemedText>
                          </ThemedView>
                        )
                      ) : null}
                    </Pressable>
                  );
                })}
              </ThemedView>

              <Pressable onPress={startResting} style={styles.restBtn}>
                <ThemedText type="linkPrimary">Just rest →</ThemedText>
              </Pressable>
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
              <Pressable onPress={showGames} style={styles.backGameBtn}>
                <ThemedText type="small" themeColor="textSecondary">← Games</ThemedText>
              </Pressable>
              {selectedGame === 'tictactoe' && <TicTacToeGame />}
              {selectedGame === 'memory' && <MemoryCardsGame />}
              {selectedGame === 'wordpuzzle' && <WordPuzzleGame />}
            </ThemedView>
          </ScrollView>
        )}

        <Pressable
          style={({ pressed }) => [styles.endStudyBtn, pressed && styles.pressed]}
          onPress={goHome}>
          <ThemedText type="smallBold" style={styles.endStudyBtnText}>
            End study
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  gameList: { gap: Spacing.two },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(124,111,90,0.1)',
    borderRadius: 16,
    padding: Spacing.three,
  },
  gameCardLocked: { opacity: 0.5 },
  gameEmoji: { fontSize: 28, lineHeight: 34 },
  gameInfo: { flex: 1, gap: 2 },
  gameArrow: { fontSize: 18, color: '#7C6F5A' },
  unlockedBadge: {
    backgroundColor: 'rgba(129,199,132,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  unlockedBadgeText: {
    color: '#2F7A3F',
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
  },
  backGameBtn: { alignSelf: 'flex-start' },
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
