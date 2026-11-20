# Companion Memory + Paper Keepsakes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Home companion speaks first, once, about real things in the player's life (exams, streaks, late nights…), sometimes asks a question with tap replies, leaves paper notes/stories while the player is away, writes a letter at each bond level 2–15, and keeps all of it in a per-companion letter box.

**Architecture:** One pure, React-free engine (`src/lib/companion-moments.ts`) decides *what* to say from a plain input snapshot; it is unit-tested with Node's built-in test runner. App state gains a handful of persisted fields + actions in `app-context.tsx`. A self-contained `MomentHost` on Home asks the engine on each open and renders the bubble, reply chips and desk envelope; paper/envelope visuals are code-drawn and shared with the letter box screen. All new text lives in a separate i18next namespace (`companion`) so the shared i18n files are never touched.

**Tech Stack:** Expo 56 / React Native, expo-router, react-native-svg, i18next (second namespace), Node 24 `node:test` (native TS type-stripping) for engine tests.

**Spec:** `docs/superpowers/specs/2026-11-19-companion-memory-keepsakes-design.md`

**Delivery order:** Tasks 1–9 ship the whole system with **Meruru (`bun`) + a generic voice** in English. Task 10 (other five voices) and Task 11 (six translations) start only after the founder has tried Meruru on the simulator and approved the feel.

## Global Constraints

- **Concurrent sessions:** commit by explicit pathspec only (`git commit -m … -- <paths>`); never `git add -A`, `git checkout`, `git restore`. Never stage, revert or rewrite `src/i18n/*.json` (they carry another session's staged changes) or any PNG.
- **`src/app/(tabs)/index.tsx` has a large uncommitted foreign edit.** Keep our change to it minimal (one import + one mounted layer) and stage **only our hunk**: build the staged blob as `HEAD` version + our hunk (`git show HEAD:"src/app/(tabs)/index.tsx" > /tmp/idx`, apply the same small edit to `/tmp/idx`, `git update-index --cacheinfo 100644,$(git hash-object -w /tmp/idx),"src/app/(tabs)/index.tsx"`), then `git commit -m …` (no pathspec for that file, since the index holds exactly our hunk). Verify with `git diff --cached` before committing.
- **Dates:** account timezone only — `todayISO()`, `daysBetween()`; never `new Date()` day math. Engine receives `today` and `nowMinutes` as inputs.
- **No new native modules; no new npm deps.** Handwriting = the already-loaded `Caveat` font (`src/app/_layout.tsx:95-98`) for `en`/`es`/`fr`; system font for `zh`/`zh-Hant`/`ja`/`ko`.
- **No pictures for keepsakes.** Paper, lines, tape, envelope, heart seal are react-native-svg / Views. No emojis. No faces on icons. Light mode only. Text in fixed boxes uses `FitText`/`adjustsFontSizeToFit` patterns already in the repo.
- **Modals:** never stack a third native modal. The letter box (opened from the gallery modal) shows notes as an **inline overlay**; Home may use one transparent `Modal` for the note because the reward chain is clear when a moment shows. (Spec said "router screen" for the keepsake view — changed for this reason; spec updated.)
- **Caps from the spec:** one speak-first moment per open, **2 per account-day**; away note needs **≥ 8 h** since last active; always if last note ≥ 2 days ago, **40 %** if yesterday, never twice a day; bond letters for **levels 2–15**; `momentsSeen` keeps the newest **2000**; away pool ≈ **30 per companion**, **pauses when exhausted** (no repeats).
- **Type check baseline:** `npx tsc --noEmit -p .` currently reports exactly **1** error (`src/components/home-icons.tsx:28`). No task may add errors.
- **Tests:** `node --test 'tests/**/*.test.ts'` (Node ≥ 24 strips TS types; a bare directory argument does NOT work — always pass the quoted glob). Engine files under test may only use `import type` from `@/…` paths — no runtime imports of app/RN code.

## Review Focus

1. **Existing players on first launch of this version** (hundreds of sessions, long streak, old exams) must not get a flood of stale "10th session!" / "7-day streak!" lines — freshness windows + the 2/day cap. → Task 2 test `existing player gets no stale milestones`.
2. **Brand-new guest with empty data** (no sessions, `firstStudyDate` '', `lastActiveAt` 0) — nothing fires, nothing throws. → Task 2 test `empty input returns null`, Task 3 test `never active is not away`.
3. **Exam-day clock boundary** — opening after the exam's start time must not say "good luck today". → Task 2 test `exam after its start time is aftermath, not exam_today`.
4. **Archived / deleted things** — archived subjects and deleted exams are never mentioned. → Task 2 test `quiet subject ignores archived`.
5. **Companion switched between a reply and its follow-up** — the follow-up is stored without a persona and is voiced by whoever is active the next day. → Task 2 test `follow-up carries no persona`.

---

### Task 1: Test harness + `companion` i18n namespace

**Files:**
- Modify: `tsconfig.json` (add `"tests/**/*"` to `exclude`)
- Modify: `package.json` (add script `"test:engine": "node --test 'tests/**/*.test.ts'"`)
- Create: `src/i18n/companion/en.json`, `src/i18n/companion/{zh,zh-Hant,ja,ko,es,fr}.json` (the six start as `{}`; English fallback until Task 11)
- Modify: `src/i18n/index.ts` (register namespace `companion` for all 7 languages; keep `translation` as `defaultNS`)
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `i18n.t('<key>', { ns: 'companion' })` resolves keys from `src/i18n/companion/<lang>.json`, falling back to `en`.

- [ ] **Step 1:** Write `tests/smoke.test.ts` that imports `node:test` + `node:assert/strict` and asserts `1 + 1 === 2`; run `node --test 'tests/**/*.test.ts'` → `pass 1`.
- [ ] **Step 2:** Add `"tests/**/*"` to `tsconfig.json` `exclude`; add the `test:engine` script; run `npx tsc --noEmit -p .` → still exactly 1 error.
- [ ] **Step 3:** Create `src/i18n/companion/en.json` with `{ "ui": { "tapToOpen": "Tap to open" } }` and the six `{}` files; in `src/i18n/index.ts` import them and set `resources[lang] = { translation: X, companion: companionX }`, `ns: ['translation','companion']`, `defaultNS: 'translation'`.
- [ ] **Step 4:** Verify existing text is unaffected and the new key resolves: run `npx tsc --noEmit -p .` (1 error) — runtime check happens in Task 9's simulator pass.
- [ ] **Step 5:** Commit — `git add tests/smoke.test.ts src/i18n/companion` then `git commit -m "Companion moments: test harness + companion i18n namespace" -- tsconfig.json package.json src/i18n/index.ts src/i18n/companion tests/smoke.test.ts`

### Task 2: Moment engine — `pickMoment`

**Files:**
- Create: `src/lib/companion-moments.ts`
- Test: `tests/companion-moments.test.ts`

**Interfaces:**
- Produces (all exported from `src/lib/companion-moments.ts`):
  - `type PersonaKey = 'bun' | 'bunny' | 'miel' | 'gray' | 'tira' | 'hanji' | 'cocoa' | 'generic'`
  - `type MomentKind = 'followup' | 'birthday' | 'exam_today' | 'exam_tomorrow' | 'exam_after' | 'welcome_back' | 'away_note' | 'anniversary' | 'streak' | 'late_night' | 'early_bird' | 'deadline_met' | 'milestone_sessions' | 'milestone_hours' | 'quiet_subject' | 'exam_soon'`
  - `type ReplyAnswer = 'ready' | 'nervous' | 'great' | 'okay' | 'rough' | 'fine' | 'tired'`
  - `type Moment = { id: string; kind: MomentKind; vars: Record<string, string | number>; replies: ReplyAnswer[]; noteId?: string }`
  - `type PendingFollowUp = { id: string; kind: 'exam_rough'; dueISO: string; vars: Record<string, string | number> }`
  - `type MomentInput` — fields: `today: string`, `nowMinutes: number` (minutes since local midnight, account tz), `momentsSeen: readonly string[]`, `momentDayCount: { dateISO: string; count: number }`, `pendingFollowUp: PendingFollowUp | null`, `profileBirthday: string`, `exams: readonly { id: string; name: string; dateISO: string; time?: string }[]`, `lastStudyDate: string | null`, `currentStreak: number`, `firstStudyDate: string`, `lastSession: { dateISO: string; endHour?: number } | null`, `tasks: readonly { id: string; title: string; isDeadline?: boolean; dueDate: string | null; status: string; completedDateISO: string | null; repeatDays?: number[] }[]`, `sessionsCompleted: number`, `totalMinutes: number`, `subjects: readonly { name: string; archived: boolean }[]`, `sessionHistory: readonly { dateISO: string; subjectName: string | null }[]`, `awayNoteId: string | null`
  - `pickMoment(input: MomentInput): Moment | null`
  - `followUpFor(moment: Moment, answer: ReplyAnswer, today: string): PendingFollowUp | null`
  - `addDaysISO(iso: string, delta: number): string`, `diffDaysISO(a: string, b: string): number` (same math as `daysBetween` in app-context — duplicated because this file must not import RN code)
  - `hashString(s: string): number` (stable, non-negative 32-bit; used for variant choice and shuffles)
  - `sampleMoment(kind: MomentKind): Moment` (dev testing; sample vars `exam: 'Biology midterm'`, `days: 3`, `subject: 'History'`, `task: 'Chem worksheet'`, `count: 10`, `n: 7`)

**Rules the implementation must follow (priority = order below; first match wins; return `null` when `momentDayCount.dateISO === today && count >= 2`; skip any id already in `momentsSeen`):**

| kind | fires when | id | replies |
|---|---|---|---|
| followup | `pendingFollowUp` and `0 <= diff(dueISO, today) <= 2` | `pendingFollowUp.id` | — |
| birthday | `profileBirthday` MM-DD equals today's MM-DD | `birthday:<YYYY>` | — |
| exam_today | exam `dateISO === today` and (no `time` or `nowMinutes < time`) | `exam_today:<examId>` | — |
| exam_tomorrow | `diff(today, exam.dateISO) === 1` | `exam_tomorrow:<examId>` | ready, nervous |
| exam_after | (`dateISO === today` and `time` passed) or `diff(exam.dateISO, today)` in 1–2 | `exam_after:<examId>` | great, okay, rough |
| welcome_back | `lastStudyDate` and `diff(lastStudyDate, today) >= 3` | `back:<lastStudyDate>` | — |
| away_note | `awayNoteId !== null` | `away:<awayNoteId>` (`noteId` = awayNoteId) | — |
| anniversary | `firstStudyDate` and `diff(firstStudyDate, today)` in `[n, n+3]` for n ∈ 7, 30, 100, 365 | `anniv:<n>` | — |
| streak | `lastStudyDate` ∈ {today, yesterday}; largest milestone m ∈ 3,7,14,30,50,100 with `m <= currentStreak <= m+2` | `streak:<m>:<addDaysISO(lastStudyDate, -(currentStreak-1))>` | — |
| late_night | `lastSession.dateISO` ∈ {today, yesterday}, `endHour` 0–4 | `late:<dateISO>` | fine, tired |
| early_bird | same dates, `endHour` 5–6 | `early:<dateISO>` | — |
| deadline_met | task `status === 'done'`, `isDeadline !== false`, `dueDate` set, no `repeatDays`/empty, `completedDateISO` ≤ `dueDate` and ≥ yesterday | `task:<taskId>` (vars `task`) | — |
| milestone_sessions | n ∈ 10, 50, 100, 250 with `n <= sessionsCompleted <= n+3` | `sessions:<n>` | — |
| milestone_hours | n ∈ 10, 50, 100 with `n <= totalMinutes/60 < n+2` | `hours:<n>` | — |
| quiet_subject | non-archived subject with ≥ 2 history records, last one 10–45 days ago; pick the one with most records | `quiet:<name>:<lastDateISO>` (vars `subject`) | — |
| exam_soon | `diff(today, exam.dateISO)` in 2–3 | `exam_soon:<examId>` (vars `days`) | ready, nervous |

Moment `vars`: exam kinds `{ exam: exam.name }` (+ `days` for exam_soon); anniversary `{ n }`; streak `{ n: m }`; milestone_sessions `{ count: n }`; milestone_hours `{ n }`; deadline_met `{ task: title }`; quiet_subject `{ subject: name }`; followup = the stored `pendingFollowUp.vars`; others `{}`. `followUpFor` returns `{ id: 'followup:' + moment.id, kind: 'exam_rough', dueISO: addDaysISO(today, 1), vars: moment.vars }` only for `exam_after` + `rough`; otherwise `null`.

- [ ] **Step 1: Write failing tests** in `tests/companion-moments.test.ts` (build inputs from one `baseInput()` helper with empty arrays, `today: '2026-11-19'`, `nowMinutes: 600`, `lastActiveAt`-free):
  - `empty input returns null` → `pickMoment(baseInput())` is `null`
  - `daily cap of 2` → with an exam tomorrow and `momentDayCount: { dateISO: today, count: 2 }` → `null`
  - `seen ids are skipped` → exam tomorrow with `momentsSeen: ['exam_tomorrow:e1']` → `null`
  - `exam tomorrow asks ready/nervous` → `kind 'exam_tomorrow'`, `replies ['ready','nervous']`, `vars.exam 'Biology midterm'`
  - `exam after its start time is aftermath, not exam_today` → exam today `time '09:00'`, `nowMinutes 600` → `kind 'exam_after'`
  - `exam today before start` → `nowMinutes 480` → `'exam_today'`
  - `followup outranks everything` → pending follow-up due today + exam tomorrow → `'followup'`
  - `rough exam schedules next-day follow-up` → `followUpFor(examAfterMoment,'rough','2026-11-19').dueISO === '2026-11-20'`; `'great'` → `null`
  - `follow-up carries no persona` → `Object.keys(followUpFor(...)!)` deep-equals `['id','kind','dueISO','vars']`
  - `away note beats anniversary but not welcome back` → (awayNoteId + anniversary) → `'away_note'`; (awayNoteId + lastStudyDate 5 days ago) → `'welcome_back'`
  - `streak milestone fires once per streak` → `currentStreak 7`, lastStudyDate today → id `streak:7:2026-11-13`
  - `existing player gets no stale milestones` → `sessionsCompleted 400`, `totalMinutes 30000`, `currentStreak 45` → `null`
  - `late night uses session end hour` → `lastSession { dateISO: today, endHour: 1 }` → `'late_night'`, replies `['fine','tired']`
  - `deadline met within 2 days only` → done deadline task completed today on its due date → `'deadline_met'`, `vars.task`; completed 5 days ago → `null`; repeating task → `null`
  - `quiet subject ignores archived` → archived subject with old history → `null`; same subject unarchived, last record 12 days ago, 3 records → `'quiet_subject'`
- [ ] **Step 2:** Run `node --test 'tests/**/*.test.ts'` → the new tests FAIL (module not found).
- [ ] **Step 3:** Implement `src/lib/companion-moments.ts` exactly to the table and signatures above (pure functions, no runtime imports).
- [ ] **Step 4:** Run `node --test 'tests/**/*.test.ts'` → all PASS; `npx tsc --noEmit -p .` → 1 error.
- [ ] **Step 5:** Commit — `git add src/lib/companion-moments.ts tests/companion-moments.test.ts` then `git commit -m "Companion moments: pure moment engine + tests" -- src/lib/companion-moments.ts tests/companion-moments.test.ts`

### Task 3: Away-life + bond-letter engine

**Files:**
- Modify: `src/lib/companion-moments.ts`
- Test: `tests/away-life.test.ts`

**Interfaces:**
- Produces:
  - `AWAY_MIN_MS = 8 * 3600 * 1000`, `BOND_LETTER_MAX_LEVEL = 15`
  - `awayNoteDue(i: { now: number; lastActiveAt: number; today: string; lastKeepsakeISO: string; roll: number }): boolean` — false if `lastActiveAt === 0`, gap < `AWAY_MIN_MS`, or `lastKeepsakeISO === today`; true if `lastKeepsakeISO === ''` or ≥ 2 days ago; `roll < 0.4` if exactly 1 day ago.
  - `seededShuffle<T>(xs: readonly T[], seed: string): T[]` (deterministic Fisher–Yates driven by `hashString`)
  - `nextAwayNoteId(i: { poolIds: readonly string[]; given: readonly string[]; seed: string }): string | null` — first id of `seededShuffle(poolIds, seed)` not in `given`; `null` when exhausted.
  - `type Keepsake = { id: string; persona: PersonaKey; kind: 'note' | 'story' | 'letter'; contentId: string; level?: number; dateISO: string; seen: boolean }`
  - `missingBondLetters(i: { companions: readonly { persona: PersonaKey; level: number }[]; have: readonly Keepsake[]; today: string }): Keepsake[]` — for each companion, levels `2..min(level, 15)` whose id `letter:<persona>:<level>` is not in `have`; `kind 'letter'`, `contentId String(level)`, `level`, `seen false`, `dateISO today`.

- [ ] **Step 1: Write failing tests** in `tests/away-life.test.ts`:
  - `never active is not away` → `awayNoteDue({ lastActiveAt: 0, … })` false
  - `under 8 hours is not away` / `8 hours is away` (lastKeepsakeISO '')
  - `not twice a day` → lastKeepsakeISO = today → false
  - `yesterday uses the 40% roll` → roll 0.39 true, 0.41 false
  - `same seed same order; different seed different order` (pool of 30 ids)
  - `exhausted pool returns null` → given = all ids → `null`
  - `letters back-fill every missed level up to 15` → persona bun level 5, have [] → ids for levels 2,3,4,5; level 20 → 14 letters, max level 15
  - `letters are not duplicated` → have contains `letter:bun:2` → result excludes it
- [ ] **Step 2:** `node --test 'tests/**/*.test.ts'` → new tests FAIL.
- [ ] **Step 3:** Implement the functions in `src/lib/companion-moments.ts`.
- [ ] **Step 4:** `node --test 'tests/**/*.test.ts'` → all PASS; tsc → 1 error.
- [ ] **Step 5:** Commit — `git add tests/away-life.test.ts` then `git commit -m "Companion moments: away-life + bond-letter engine" -- src/lib/companion-moments.ts tests/away-life.test.ts`

### Task 4: Persisted state, timestamps and actions

**Files:**
- Modify: `src/context/app-context.tsx` (`SessionRecord` ~L135, `PersistedState` ~L275, `DEFAULTS` ~L492, `normalizePersistedState` ~L879, `addSubjectTime` ~L2545, `AppContextType` ~L1140, provider value ~L3584, AppState listeners ~L1674)

**Interfaces:**
- Consumes: `PendingFollowUp`, `Keepsake`, `PersonaKey` (Task 2/3, `import type`).
- Produces on `useApp()`:
  - state: `momentsSeen: string[]`, `momentDayCount: { dateISO: string; count: number }`, `pendingFollowUp: PendingFollowUp | null`, `firstStudyDate: string`, `lastActiveAt: number`, `lastKeepsakeISO: string`, `keepsakes: Keepsake[]`, `awayLifeGiven: Record<string, string[]>`
  - `recordMomentShown(id: string): void` — append to `momentsSeen` (keep newest 2000), bump `momentDayCount` for `todayISO()`
  - `setMomentFollowUp(f: PendingFollowUp | null): void`
  - `addKeepsakes(ks: Keepsake[]): void` — append those whose `id` is new
  - `markKeepsakeSeen(id: string): void`
  - `recordAwayNoteGiven(persona: PersonaKey, contentId: string): void` — push to `awayLifeGiven[persona]`, set `lastKeepsakeISO = todayISO()`
  - `stampLastActive(): void` — `lastActiveAt = Date.now()`
  - non-persisted dev state: `devMoment: MomentKind | null`, `setDevMoment(k: MomentKind | null): void`
  - exported helpers `nowMinutesInAccountTz(): number` (Intl hour/minute parts in `activeTimezone`, like `dateInTimeZone`) and `accountDateOf(isoTimestamp: string): string` (= `dateInTimeZone(new Date(isoTimestamp), activeTimezone)`; used to build `completedDateISO` for the engine)
- `SessionRecord` gains `endHour?: number` (0–23, account tz), written in `addSubjectTime`; `addSubjectTime` also sets `firstStudyDate` when empty.
- `normalizePersistedState`: default every new field (DEFAULTS: `[]`, `{ dateISO: '', count: 0 }`, `null`, `''`, `0`, `''`, `[]`, `{}`); back-fill `firstStudyDate` from the oldest `sessionHistory[].dateISO` when empty.
- App backgrounding stamps `lastActiveAt` (add to an existing `AppState` `'change'` listener: `state === 'background'`).

- [ ] **Step 1:** Add the types/fields/defaults/normalization and the back-fill.
- [ ] **Step 2:** Add the actions and expose them (and `devMoment`) in `AppContextType` + the provider value.
- [ ] **Step 3:** Record `endHour` + `firstStudyDate` in `addSubjectTime`; stamp `lastActiveAt` on background.
- [ ] **Step 4:** `npx tsc --noEmit -p .` → 1 error; `node --test 'tests/**/*.test.ts'` → PASS.
- [ ] **Step 5:** Commit — `git commit -m "Companion moments: persisted state + actions" -- src/context/app-context.tsx`

### Task 5: Voice content (Meruru + generic) and the voice helper

**Files:**
- Modify: `src/i18n/companion/en.json`
- Create: `src/lib/companion-voice.ts`
- Modify: `src/components/companion-pet.tsx` (import `personaKeyForName` instead of its local `PERSONA_KEYS`)
- Modify: `CHARACTER_DIALOGUE_GUIDE.md` (Meruru's current dreamy voice; add Soda) 
- Test: `tests/companion-content.test.ts`

**Interfaces:**
- Consumes: `MomentKind`, `ReplyAnswer`, `Moment`, `PersonaKey`, `hashString` (Task 2).
- Produces (`src/lib/companion-voice.ts`):
  - `personaKeyForName(name: string | undefined): PersonaKey` — Bun→bun, Cocoa→cocoa, Bunny→bunny, Miel→miel, Tira→tira, Hanji→hanji, Soda→gray, else generic
  - `momentLine(persona: PersonaKey, m: Moment): string` — variant `hashString(m.id) % lines.length`, interpolates `m.vars`; persona with no content → `generic`
  - `reactionLine(persona: PersonaKey, kind: MomentKind, answer: ReplyAnswer): string`
  - `replyLabel(answer: ReplyAnswer): string`
  - `awayPoolIds(persona: PersonaKey): string[]`
  - `awayEntry(persona: PersonaKey, id: string): { kind: 'note' | 'story'; bubble: string; text: string } | null`
  - `letterText(persona: PersonaKey, level: number): string | null`
  - `noteFontFamily(lang: string): string | undefined` — `'Caveat'` for en/es/fr, else `undefined`
- **Content shape** (`en.json`): `ui.*` (tapToOpen, done, savedToLetters `"Saved to {{name}}'s letters"`, lettersButton `"Letters"`, letterBoxTitle `"{{name}}'s letters"`, empty, filterAll/filterNotes/filterStories/filterLetters, kindNote/kindStory, kindLetter `"Level {{level}} letter"`, newBadge, fromNote/fromStory/fromLetter `"A note from {{name}}"`…), `replies.<answer>`, and `voices.<persona>.{ moments.<kind>: string[], reactions.<kind>.<answer>: string, letters.<2..15>: string, away.<id>: { kind, bubble, text } }`.
- **Volume for this task:** `bun` — every moment kind (recurring kinds exam_*, quiet_subject, deadline_met, late_night: 3 variants; others 1–2), all reactions, 2 `moments.followup` lines (the next-day check-in after a rough exam), letters 2–15, **30** away entries (mix of notes and stories). `generic` — 1 line per kind, reactions, letters 2–15, 10 away entries. Use the approved samples from the 2026-11-19 conversation verbatim where they exist. Placeholders only `{{exam}}`, `{{subject}}`, `{{days}}`, `{{count}}`, `{{n}}`, `{{task}}`. No emojis, never guilt, no user name.

- [ ] **Step 1: Write failing content tests** in `tests/companion-content.test.ts` (read the JSON with `fs`):
  - `every moment kind has bun and generic lines` (all 16 kinds except `away_note`)
  - `every reply-bearing kind has a reaction per reply` (exam_tomorrow, exam_soon, exam_after, late_night)
  - `bun has letters 2..15 and 30 away entries`, each away entry has `kind` ∈ note/story, non-empty `bubble`/`text`
  - `only allowed placeholders` (regex over every string under `voices.*`: each `{{x}}` ∈ the six names; `ui.*` may also use `{{name}}` and `{{level}}`)
  - `no emoji` (no char in `\p{Extended_Pictographic}`)
- [ ] **Step 2:** `node --test 'tests/**/*.test.ts'` → FAIL.
- [ ] **Step 3:** Write the content and `src/lib/companion-voice.ts`; switch `companion-pet.tsx` to `personaKeyForName`; update the dialogue guide.
- [ ] **Step 4:** `node --test 'tests/**/*.test.ts'` → PASS; tsc → 1 error.
- [ ] **Step 5:** Commit — `git add src/lib/companion-voice.ts tests/companion-content.test.ts` then `git commit -m "Companion moments: Meruru + generic voice content" -- src/i18n/companion/en.json src/lib/companion-voice.ts src/components/companion-pet.tsx CHARACTER_DIALOGUE_GUIDE.md tests/companion-content.test.ts`

### Task 6: Paper visuals + note overlay

**Files:**
- Create: `src/components/paper-note.tsx`
- Create: `src/components/keepsake-overlay.tsx`

**Interfaces:**
- Consumes: `Keepsake` (Task 3), `awayEntry`, `letterText`, `noteFontFamily` (Task 5), `markKeepsakeSeen` (Task 4).
- Produces:
  - `Envelope({ width: number; sealed?: boolean }): JSX.Element` — SVG envelope, flap, pink heart seal (`#D96F83`), as in the approved mockup
  - `PaperNote({ text: string; signature: string; lang: string; width: number }): JSX.Element` — cream lined paper (`#FFFBF4`, rule lines), two tape strips, slight tilt, handwriting font via `noteFontFamily`
  - `KeepsakeOverlay({ keepsake: Keepsake; companionName: string; onClose: () => void }): JSX.Element` — absolute-fill dim backdrop; step 1 = big sealed `Envelope` + "Tap to open"; step 2 = title (`fromNote`/`fromStory`/`fromLetter`), date, `PaperNote`, pink **Done** (`BakeryColors.buttonPink`); marks the keepsake seen on open
- Look = the approved canvas `https://claude.ai/artifact/E7oKdkSUpk8wtipr2iGFkn` (artboards "Note on the desk", "Meruru's letter box").

- [ ] **Step 1:** Build `paper-note.tsx` (Envelope, PaperNote).
- [ ] **Step 2:** Build `keepsake-overlay.tsx` (two-step open, Done, seen marking; tablet sizing via `useIsTablet()`).
- [ ] **Step 3:** `npx tsc --noEmit -p .` → 1 error.
- [ ] **Step 4:** Commit — `git add src/components/paper-note.tsx src/components/keepsake-overlay.tsx` then `git commit -m "Companion moments: code-drawn paper note + envelope overlay" -- src/components/paper-note.tsx src/components/keepsake-overlay.tsx`

### Task 7: MomentHost on Home (speak-first, replies, away note, letter filing)

**Files:**
- Create: `src/lib/reward-chain.ts`
- Create: `src/components/moment-host.tsx`
- Modify: `src/app/(tabs)/index.tsx` (one import + one layer beside the `PetCloudHost` layer ~L1604; **stage only this hunk** — see Global Constraints)
- Modify: `src/lib/analytics.ts` (events `companion_moment_shown`, `companion_moment_reply`, `companion_note_given`, `letter_box_opened`, `away_pool_exhausted`)

**Interfaces:**
- Consumes: everything from Tasks 2–6.
- Produces:
  - `rewardChainBusy(a: ReturnType<typeof useApp>): boolean` — true while any of: `characterObtainedPending`, `hanjiUnlockPending`, `recipeBadgePending`, birthday reward available, `streakRescuePending`, daily login reward available, `exchangeTicketPending > 0`, `bondLevelUp` (same predicates as `BondLevelUpModal`'s `want`, plus `bondLevelUp` itself)
  - `MomentHost({ isTablet: boolean; scale: number }): JSX.Element | null`
- **Behavior:**
  - An "open" = mount, or `AppState` → `'active'` while Home is focused. On open: read `lastActiveAt` **first**, then `stampLastActive()`.
  - Wait until: Home focused (`useIsFocused`), no `activeSession`, `starterChosen`, `tutorialSeen`, `!rewardChainBusy`. Then decide once per open.
  - File missing bond letters (`missingBondLetters` → `addKeepsakes`) on every open.
  - Away note: if `awayNoteDue({ now, lastActiveAt: prev, today, lastKeepsakeISO, roll: Math.random() })`, take `nextAwayNoteId({ poolIds: awayPoolIds(persona), given: awayLifeGiven[persona] ?? [], seed: friendCode + persona })`; `null` → `track('away_pool_exhausted', { persona })`.
  - `pickMoment(...)` (or `sampleMoment(devMoment)` when `devMoment` is set, then `setDevMoment(null)`). On show: `recordMomentShown(id)`, `track('companion_moment_shown', { kind })`; for `away_note`: `addKeepsakes([{ id: 'note:' + persona + ':' + noteId, persona, kind: awayEntry(...).kind, contentId: noteId, dateISO: today, seen: false }])`, `recordAwayNoteGiven(persona, noteId)`, `track('companion_note_given')`. For the dev `away_note`, set `noteId` to the first id of `awayPoolIds(persona)` not yet given (or the first id).
  - Engine input mapping: `exams` ← `examCountdowns`; `tasks[].completedDateISO` ← `completedAt ? accountDateOf(completedAt) : null`; `lastSession` ← `sessionHistory[0]`; `nowMinutes` ← `nowMinutesInAccountTz()`; persona ← `personaKeyForName(resolveActiveCompanion(...).name)`.
  - Render: persistent white bubble (speaker pill with localized name, line via `momentLine`), reply chips (≥ 44 px) when `replies.length`; on reply → bubble shows `reactionLine`, `setMomentFollowUp(followUpFor(...))` when non-null, `track('companion_moment_reply', { kind, answer })`. Tap bubble/companion area → dismiss. `away_note` → `bubble` text + wiggling small `Envelope` on the desk with "Tap to open" → `KeepsakeOverlay` inside a transparent `Modal` (via `useModalSafeVisible`).
  - Leaving Home dismisses the bubble (moment still counts as said).

- [ ] **Step 1:** `reward-chain.ts` + analytics event names.
- [ ] **Step 2:** `moment-host.tsx` per the behavior list.
- [ ] **Step 3:** Mount in Home: `<View style={[styles.homeCharacterLayer, phCharLayer, tCharLayer, styles.petBubbleLayer]} pointerEvents="box-none"><MomentHost isTablet={isTablet} scale={isTablet ? htScaled.charScale * u : 1} /></View>` directly after the `PetCloudHost` layer.
- [ ] **Step 4:** `npx tsc --noEmit -p .` → 1 error; `node --test 'tests/**/*.test.ts'` → PASS.
- [ ] **Step 5:** Commit our files by pathspec (`git add src/lib/reward-chain.ts src/components/moment-host.tsx` then `git commit -m "Companion moments: speak-first MomentHost on Home" -- src/lib/reward-chain.ts src/components/moment-host.tsx src/lib/analytics.ts`), then stage the `index.tsx` hunk with the HEAD-blob method, check `git diff --cached`, and `git commit -m "Home: mount MomentHost"`.

### Task 8: Bond letter in the level-up popup, letter box screen, gallery entry, dev buttons

**Files:**
- Modify: `src/components/bond-levelup-modal.tsx` (letter text under the level + `savedToLetters`; file + mark seen)
- Create: `src/app/letter-box.tsx` (param `persona`)
- Modify: `src/app/_layout.tsx` (`<Stack.Screen name="letter-box" options={{ presentation: 'modal', headerShown: false }} />`)
- Modify: `src/app/companion-gallery.tsx` (a "Letters" button under `CompanionLevel` in the preview card, with a dot when the persona has unseen keepsakes)
- Modify: `src/app/settings.tsx` (inside the existing `__DEV__` block: "Companion moment (dev test)" cycles `MomentKind`s via `setDevMoment`, then `noteModalTransition(); router.back()`; "Companion note (dev test)" sets `'away_note'`)

**Interfaces:**
- Consumes: `letterText`, `KeepsakeOverlay`, `PaperNote`, `Envelope`, `addKeepsakes`, `markKeepsakeSeen`, `keepsakes`, `setDevMoment`.
- Letter box: graph-paper background (reuse `notebook-background.tsx`), back button, title `letterBoxTitle`, count line, filter pills All / Notes / Stories / Letters, 2-column grid of paper tiles (first lines in handwriting, kind + date) newest first; unseen letters render as sealed `Envelope` with dot; tap → **inline** `KeepsakeOverlay` (no route, no Modal); `track('letter_box_opened')` on mount; empty state `ui.empty`.
- `sampleMoment('away_note')` needs a real note id: MomentHost uses the first id of the active persona's pool for the dev case.

- [ ] **Step 1:** Bond popup letter (levels 2–15 only; levels above 15 unchanged).
- [ ] **Step 2:** Letter box screen + route registration.
- [ ] **Step 3:** Gallery "Letters" button + unseen dot.
- [ ] **Step 4:** Settings dev buttons.
- [ ] **Step 5:** `npx tsc --noEmit -p .` → 1 error; commit — `git add src/app/letter-box.tsx` then `git commit -m "Companion moments: bond letters, letter box, gallery entry, dev triggers" -- src/components/bond-levelup-modal.tsx src/app/letter-box.tsx src/app/_layout.tsx src/app/companion-gallery.tsx src/app/settings.tsx`

### Task 9: Simulator verification with Meruru

**Files:** none (evidence: screenshots)

- [ ] **Step 1:** Run the `/verify` skill flow; inject state via the sim's `deskmate_guest_state.json` (memory: sim state injection) to set up: an exam tomorrow; an exam yesterday; `lastActiveAt` 9 h ago with `lastKeepsakeISO` ''; `companionMinutes` at level 5 for Meruru.
- [ ] **Step 2:** Screenshot each: exam_tomorrow bubble + chips → reaction; exam_after "Rough" → next-day follow-up (advance via injected `pendingFollowUp.dueISO = today`); away note envelope → overlay → Done; letter box with back-filled letters 2–5 (sealed + dot); bond popup with letter; tablet layout once.
- [ ] **Step 3:** Confirm no moment appears while a reward popup is up and none during a session; confirm a second open the same day shows at most one more.
- [ ] **Step 4:** Hand the screenshots to the founder; **stop for approval** before Task 10.

### Task 10: Remaining voices (English) — after founder approval

**Files:** Modify `src/i18n/companion/en.json`

- [ ] **Step 1:** Write `bunny`, `miel`, `gray` (Soda), `tira`, `hanji` with the same volume as `bun` (voices from current `pet.*` lines + updated dialogue guide: Bunny third person, Soda deadpan-serious chef, Tira dry/aloof, Hanji short and poetic, Miel sleepy-warm). Show the founder 5 lines per character before writing the rest.
- [ ] **Step 2:** Extend `tests/companion-content.test.ts` so the "every kind / letters 2..15 / 30 away entries" assertions loop over all six personas; `node --test 'tests/**/*.test.ts'` → PASS.
- [ ] **Step 3:** Commit — `git commit -m "Companion moments: voices for Bunny, Miel, Soda, Tira, Hanji" -- src/i18n/companion/en.json tests/companion-content.test.ts`

### Task 11: Translations

**Files:** Modify `src/i18n/companion/{zh,ja,ko,es,fr}.json`; generate `src/i18n/companion/zh-Hant.json` from `zh.json` with OpenCC (`python3 -c "import opencc"` is available; config `s2twp`)

- [ ] **Step 1:** Translate `en.json` into zh, ja, ko, es, fr keeping each voice (localized companion names per `localizeCompanionName`: Meruru = 绵绵 / メルル / 메루루; JA パン/KO 빵 mean bread — never use them for Meruru). Placeholders unchanged.
- [ ] **Step 2:** Generate zh-Hant via OpenCC.
- [ ] **Step 3:** Add a parity test: every key path in `en.json` exists in all six files with the same placeholders; `node --test 'tests/**/*.test.ts'` → PASS.
- [ ] **Step 4:** Spot-check JA and ZH on the simulator (one moment + one note each).
- [ ] **Step 5:** Commit — `git commit -m "Companion moments: translations" -- src/i18n/companion tests/companion-content.test.ts`
