import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  awayNoteDue,
  seededShuffle,
  nextAwayNoteId,
  missingBondLetters,
  AWAY_MIN_MS,
} from '../src/lib/companion-moments.ts';

const HOUR = 3600 * 1000;
const NOW = 1_800_000_000_000;
const base = { now: NOW, lastActiveAt: NOW - 10 * HOUR, today: '2026-11-20', lastKeepsakeISO: '', roll: 0.9 };

test('never active is not away', () => {
  assert.equal(awayNoteDue({ ...base, lastActiveAt: 0 }), false);
});

test('under 8 hours is not away', () => {
  assert.equal(awayNoteDue({ ...base, lastActiveAt: NOW - AWAY_MIN_MS + 1 }), false);
});

test('8 hours is away', () => {
  assert.equal(awayNoteDue({ ...base, lastActiveAt: NOW - AWAY_MIN_MS }), true);
});

test('not twice a day', () => {
  assert.equal(awayNoteDue({ ...base, lastKeepsakeISO: '2026-11-20' }), false);
});

test('two or more days ago is always due', () => {
  assert.equal(awayNoteDue({ ...base, lastKeepsakeISO: '2026-11-18' }), true);
});

test('yesterday uses the 40% roll', () => {
  const y = { ...base, lastKeepsakeISO: '2026-11-19' };
  assert.equal(awayNoteDue({ ...y, roll: 0.39 }), true);
  assert.equal(awayNoteDue({ ...y, roll: 0.41 }), false);
});

const pool = Array.from({ length: 30 }, (_, i) => `n${i}`);

test('same seed same order; different seed different order', () => {
  assert.deepEqual(seededShuffle(pool, 'a'), seededShuffle(pool, 'a'));
  assert.notDeepEqual(seededShuffle(pool, 'a'), seededShuffle(pool, 'b'));
  assert.deepEqual([...seededShuffle(pool, 'a')].sort(), [...pool].sort());
});

test('nextAwayNoteId skips given; exhausted pool returns null', () => {
  const first = nextAwayNoteId({ poolIds: pool, given: [], seed: 's' });
  assert.equal(first, seededShuffle(pool, 's')[0]);
  const second = nextAwayNoteId({ poolIds: pool, given: [first!], seed: 's' });
  assert.equal(second, seededShuffle(pool, 's')[1]);
  assert.equal(nextAwayNoteId({ poolIds: pool, given: pool, seed: 's' }), null);
});

test('letters back-fill every missed level up to 15', () => {
  const r = missingBondLetters({ companions: [{ persona: 'bun', level: 5 }], have: [], today: '2026-11-20' });
  assert.deepEqual(r.map((k) => k.id), ['letter:bun:2', 'letter:bun:3', 'letter:bun:4', 'letter:bun:5']);
  assert.equal(r[0].kind, 'letter');
  assert.equal(r[0].contentId, '2');
  assert.equal(r[0].level, 2);
  assert.equal(r[0].seen, false);
  assert.equal(r[0].dateISO, '2026-11-20');
  const big = missingBondLetters({ companions: [{ persona: 'bun', level: 20 }], have: [], today: '2026-11-20' });
  assert.equal(big.length, 14);
  assert.equal(big[big.length - 1].level, 15);
});

test('letters are not duplicated', () => {
  const have = [
    { id: 'letter:bun:2', persona: 'bun', kind: 'letter', contentId: '2', level: 2, dateISO: 'x', seen: true },
  ] as const;
  const r = missingBondLetters({ companions: [{ persona: 'bun', level: 3 }], have: [...have], today: '2026-11-20' });
  assert.deepEqual(r.map((k) => k.id), ['letter:bun:3']);
});
