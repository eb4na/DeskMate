import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(
  fs.readFileSync(path.join(here, '../src/i18n/companion/en.json'), 'utf8'),
);

// Every MomentKind except away_note (whose bubble lives on the away entry).
const SPOKEN_KINDS = [
  'followup',
  'birthday',
  'exam_today',
  'exam_tomorrow',
  'exam_after',
  'welcome_back',
  'anniversary',
  'streak',
  'late_night',
  'early_bird',
  'deadline_met',
  'milestone_sessions',
  'milestone_hours',
  'quiet_subject',
  'exam_soon',
];

const REPLY_KINDS: Record<string, string[]> = {
  exam_tomorrow: ['ready', 'nervous'],
  exam_soon: ['ready', 'nervous'],
  exam_after: ['great', 'okay', 'rough'],
  late_night: ['fine', 'tired'],
};

const PERSONAS_WITH_CONTENT = ['bun', 'generic'];
const ALLOWED_VOICE_VARS = new Set(['exam', 'subject', 'days', 'count', 'n', 'task']);
const ALLOWED_UI_VARS = new Set([...ALLOWED_VOICE_VARS, 'name', 'level']);

function nonEmptyString(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Yield [path, string] for every string leaf under a JSON value. */
function* strings(v: unknown, at: string): Generator<[string, string]> {
  if (typeof v === 'string') yield [at, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], `${at}.${i}`);
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) yield* strings(x, `${at}.${k}`);
}

test('every moment kind has bun and generic lines', () => {
  for (const p of PERSONAS_WITH_CONTENT) {
    for (const kind of SPOKEN_KINDS) {
      const lines = content.voices?.[p]?.moments?.[kind];
      assert.ok(Array.isArray(lines) && lines.length > 0, `${p}.moments.${kind} missing`);
      for (const l of lines) assert.ok(nonEmptyString(l), `${p}.moments.${kind} has an empty line`);
    }
  }
});

test('bun recurring kinds have 3 variants and followup has 2', () => {
  const m = content.voices.bun.moments;
  for (const kind of ['exam_today', 'exam_tomorrow', 'exam_after', 'exam_soon', 'quiet_subject', 'deadline_met', 'late_night']) {
    assert.ok(m[kind].length >= 3, `bun.moments.${kind} needs 3 variants, has ${m[kind].length}`);
  }
  assert.equal(m.followup.length, 2);
});

test('every reply-bearing kind has a reaction per reply', () => {
  for (const p of PERSONAS_WITH_CONTENT) {
    for (const [kind, answers] of Object.entries(REPLY_KINDS)) {
      for (const a of answers) {
        assert.ok(
          nonEmptyString(content.voices[p].reactions?.[kind]?.[a]),
          `${p}.reactions.${kind}.${a} missing`,
        );
      }
    }
  }
});

test('every reply has a label', () => {
  for (const answers of Object.values(REPLY_KINDS)) {
    for (const a of answers) assert.ok(nonEmptyString(content.replies?.[a]), `replies.${a} missing`);
  }
});

test('bun has letters 2..15 and 30 away entries', () => {
  const bun = content.voices.bun;
  for (let level = 2; level <= 15; level++) {
    assert.ok(nonEmptyString(bun.letters?.[String(level)]), `bun.letters.${level} missing`);
  }
  const away = Object.entries(bun.away ?? {});
  assert.equal(away.length, 30);
  for (const [id, e] of away as [string, any][]) {
    assert.ok(e.kind === 'note' || e.kind === 'story', `bun.away.${id}.kind = ${e.kind}`);
    assert.ok(nonEmptyString(e.bubble), `bun.away.${id}.bubble empty`);
    assert.ok(nonEmptyString(e.text), `bun.away.${id}.text empty`);
  }
  const kinds = new Set(away.map(([, e]) => (e as any).kind));
  assert.ok(kinds.has('note') && kinds.has('story'), 'bun away pool mixes notes and stories');
});

test('generic has letters 2..15 and 10 away entries', () => {
  const g = content.voices.generic;
  for (let level = 2; level <= 15; level++) {
    assert.ok(nonEmptyString(g.letters?.[String(level)]), `generic.letters.${level} missing`);
  }
  const away = Object.entries(g.away ?? {});
  assert.equal(away.length, 10);
  for (const [id, e] of away as [string, any][]) {
    assert.ok(e.kind === 'note' || e.kind === 'story', `generic.away.${id}.kind = ${e.kind}`);
    assert.ok(nonEmptyString(e.bubble), `generic.away.${id}.bubble empty`);
    assert.ok(nonEmptyString(e.text), `generic.away.${id}.text empty`);
  }
});

test('ui strings exist', () => {
  for (const k of [
    'tapToOpen', 'done', 'savedToLetters', 'lettersButton', 'letterBoxTitle', 'empty',
    'filterAll', 'filterNotes', 'filterStories', 'filterLetters',
    'kindNote', 'kindStory', 'kindLetter', 'newBadge', 'fromNote', 'fromStory', 'fromLetter',
  ]) {
    assert.ok(nonEmptyString(content.ui?.[k]), `ui.${k} missing`);
  }
});

test('only allowed placeholders', () => {
  const re = /\{\{\s*([^}]*?)\s*\}\}/g;
  for (const [at, s] of strings(content.voices, 'voices')) {
    for (const m of s.matchAll(re)) {
      assert.ok(ALLOWED_VOICE_VARS.has(m[1]), `${at} uses {{${m[1]}}}`);
    }
  }
  for (const [at, s] of strings(content.ui, 'ui')) {
    for (const m of s.matchAll(re)) {
      assert.ok(ALLOWED_UI_VARS.has(m[1]), `${at} uses {{${m[1]}}}`);
    }
  }
});

test('placeholders match the vars each kind provides', () => {
  // From pickMoment: which vars each kind carries (followup carries its exam's vars).
  const VARS: Record<string, string[]> = {
    followup: ['exam'],
    birthday: [],
    exam_today: ['exam'],
    exam_tomorrow: ['exam'],
    exam_after: ['exam'],
    welcome_back: [],
    anniversary: ['n'],
    streak: ['n'],
    late_night: [],
    early_bird: [],
    deadline_met: ['task'],
    milestone_sessions: ['count'],
    milestone_hours: ['n'],
    quiet_subject: ['subject'],
    exam_soon: ['exam', 'days'],
  };
  const re = /\{\{\s*([^}]*?)\s*\}\}/g;
  for (const p of PERSONAS_WITH_CONTENT) {
    for (const [kind, vars] of Object.entries(VARS)) {
      for (const line of content.voices[p].moments[kind]) {
        for (const m of (line as string).matchAll(re)) {
          assert.ok(vars.includes(m[1]), `${p}.moments.${kind} uses {{${m[1]}}} it never gets`);
        }
      }
    }
    // Reactions, letters and away entries get no vars at all.
    for (const sect of ['reactions', 'letters', 'away']) {
      for (const [at, s] of strings(content.voices[p][sect], `${p}.${sect}`)) {
        assert.equal(s.match(re), null, `${at} has a placeholder but gets no vars`);
      }
    }
  }
});

test('no emoji', () => {
  for (const [at, s] of strings(content, '')) {
    assert.ok(!/\p{Extended_Pictographic}/u.test(s), `emoji in ${at}`);
  }
});

test('no player name and bubbles stay short', () => {
  for (const p of PERSONAS_WITH_CONTENT) {
    const v = content.voices[p];
    const bubbles: [string, string][] = [
      ...strings(v.moments, `${p}.moments`),
      ...strings(v.reactions, `${p}.reactions`),
      ...Object.entries(v.away).map(([id, e]: [string, any]) => [`${p}.away.${id}.bubble`, e.bubble] as [string, string]),
    ];
    for (const [at, s] of bubbles) assert.ok(s.length <= 100, `${at} is ${s.length} chars`);
    for (const [id, e] of Object.entries(v.away) as [string, any][]) {
      assert.ok(e.text.length <= 240, `${p}.away.${id}.text is ${e.text.length} chars`);
    }
  }
  for (const [at, s] of strings(content.voices, 'voices')) {
    assert.ok(!/\{\{\s*name\s*\}\}/.test(s), `${at} uses the player name`);
  }
});
