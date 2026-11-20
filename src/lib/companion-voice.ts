// Reads a companion's voice content (src/i18n/companion/<lang>.json, i18next
// namespace `companion`) for the speak-first moments, reply reactions, away-life
// keepsakes and bond letters. App-side only (imports i18n at runtime); the pure
// engine that decides WHAT to say lives in companion-moments.ts.
//
// Fallback rule (all helpers): the persona's own section first, then `generic`.
// Away ids are globally unique (`bun_01`, `gen_01`, ...), and a given note's id is
// persisted, so awayEntry also looks a generic id up in `generic` even after that
// persona later gets its own pool.
import i18n from '@/i18n';
import {
  hashString,
  type Moment,
  type MomentKind,
  type MomentVars,
  type PersonaKey,
  type ReplyAnswer,
} from '@/lib/companion-moments';

const NS = 'companion';

const NAME_TO_PERSONA = new Map<string, PersonaKey>([
  ['Bun', 'bun'],
  ['Cocoa', 'cocoa'],
  ['Bunny', 'bunny'],
  ['Miel', 'miel'],
  ['Tira', 'tira'],
  ['Hanji', 'hanji'],
  ['Soda', 'gray'],
]);

/** Companion canonical name (e.g. 'Bun', 'Soda') → its voice/persona key. */
export function personaKeyForName(name: string | undefined): PersonaKey {
  return (name && NAME_TO_PERSONA.get(name)) || 'generic';
}

type AwayEntry = { kind: 'note' | 'story'; bubble: string; text: string };

// Raw (uninterpolated) value at a key, or undefined when the path is missing.
// i18next returns the key path itself for a missing key, so check `exists` first.
function raw(key: string): unknown {
  if (!i18n.exists(key, { ns: NS })) return undefined;
  return i18n.t(key, { ns: NS, returnObjects: true, skipInterpolation: true });
}

function str(key: string): string | null {
  const v = raw(key);
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function lines(key: string): string[] | null {
  const v = raw(key);
  if (!Array.isArray(v) || v.length === 0) return null;
  return v.every((s) => typeof s === 'string') ? (v as string[]) : null;
}

/** Single-pass `{{var}}` fill; a value is never re-scanned for placeholders. */
function fill(s: string, vars: MomentVars): string {
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : match,
  );
}

function asAwayEntry(v: unknown): AwayEntry | null {
  if (!v || typeof v !== 'object') return null;
  const e = v as Record<string, unknown>;
  if (e.kind !== 'note' && e.kind !== 'story') return null;
  if (typeof e.bubble !== 'string' || typeof e.text !== 'string') return null;
  return { kind: e.kind, bubble: e.bubble, text: e.text };
}

/** The line a companion opens with for this moment, vars filled in. */
export function momentLine(persona: PersonaKey, m: Moment): string {
  if (m.kind === 'away_note') {
    return (m.noteId && awayEntry(persona, m.noteId)?.bubble) || '';
  }
  const ls =
    lines(`voices.${persona}.moments.${m.kind}`) ?? lines(`voices.generic.moments.${m.kind}`);
  if (!ls) return '';
  return fill(ls[hashString(m.id) % ls.length], m.vars);
}

/** The companion's answer after the player taps a reply chip. */
export function reactionLine(persona: PersonaKey, kind: MomentKind, answer: ReplyAnswer): string {
  return (
    str(`voices.${persona}.reactions.${kind}.${answer}`) ??
    str(`voices.generic.reactions.${kind}.${answer}`) ??
    ''
  );
}

/** Reply chip label, in the player's voice (shared across companions). */
export function replyLabel(answer: ReplyAnswer): string {
  return str(`replies.${answer}`) ?? answer;
}

/** Ids of this persona's away-life pool (its own, else the generic pool). */
export function awayPoolIds(persona: PersonaKey): string[] {
  for (const p of [persona, 'generic'] as const) {
    const v = raw(`voices.${p}.away`);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const ids = Object.keys(v).filter((id) => asAwayEntry((v as Record<string, unknown>)[id]));
      if (ids.length > 0) return ids;
    }
  }
  return [];
}

/** One away-life keepsake (note or story), looked up in the persona's pool, then generic. */
export function awayEntry(persona: PersonaKey, id: string): AwayEntry | null {
  return asAwayEntry(raw(`voices.${persona}.away.${id}`)) ?? asAwayEntry(raw(`voices.generic.away.${id}`));
}

/** The bond letter for a level (2..15), or null when there is none. */
export function letterText(persona: PersonaKey, level: number): string | null {
  return str(`voices.${persona}.letters.${level}`) ?? str(`voices.generic.letters.${level}`);
}

const HANDWRITING_LANGS = new Set(['en', 'es', 'fr']);

/** Handwriting font for notes: Caveat covers Latin scripts only, so CJK uses the system font. */
export function noteFontFamily(lang: string): string | undefined {
  const base = (lang || '').toLowerCase().split(/[-_]/)[0];
  return HANDWRITING_LANGS.has(base) ? 'Caveat' : undefined;
}
