# Companion memory + keepsakes ("the companion notices you, and has a life")

**Date:** 2026-11-19
**Status:** design — awaiting founder approval
**Scope:** two features built on one engine: **Moments** (the companion remembers your real
life) and **Away life** (the companion does things while you're gone and brings you a
keepsake). A third idea — anonymous notes between players — is **parked**, not in scope.

## Why

Memobun exists so a lonely student feels less alone. Today the companion can't deliver
that: it speaks in two places only — a random line when you tap it on Home (4 lines per
skin) and a session-start line (5 generic English lines, never translated). Hearing the
same handful of lines makes it feel like a toy, not a friend. AI chat was removed because
credits cost money, and it is not coming back.

The research (see the 2026-11-19 conversation) is thin but points one way: what helps is
**feeling noticed and remembered** (the "mattering" literature), not the volume of talk.
So the companion should (1) bring up real things from *your* life, once each, and
(2) have a small life of its own that it shares with you.

## Decisions the founder made

- **Build Moments (#1) and Away life (#2). Park friend/stranger notes (#4).**
- **The companion speaks first** (option A): when you open Home it says the new thing on its
  own, once — after any reward popups. No "sparkle, tap to hear" variant.
- **Keepsakes only.** Away-life gifts carry no coins or items. They go into a letter box.
- **Paper only — no pictures.** (Decided after seeing a postcard mockup.) Postcards and
  treats would need a picture per keepsake and so more image generation. Keepsakes are
  **handwritten-style notes, little stories and letters on code-drawn paper**; the
  envelope, seal, tape and paper are drawn in code (react-native-svg). Adding content =
  writing, never art.

## Goals

1. On opening Home, when something new and real has happened, the active companion says
   **one** line about it, in its own voice. Each such line is said **once, then retired**.
2. Some moments ask a question with **2–3 tap replies**; the companion reacts right away and
   sometimes **follows up the next day** ("Feeling better than yesterday?").
3. The existing **bond level-up popup carries a short letter** from the companion (one per
   level), so leveling up means getting to know them.
4. After you've been away a while, the companion sometimes tells you **what it did** and
   leaves you a **keepsake** on the desk: a handwritten note, a little story, or a letter
   (paper only, no pictures).
5. Every keepsake and bond letter is kept in a **per-companion letter box** you can flip
   through later.
6. All six playable companions have their **own voice** (Meruru/Bun, Bunny, Miel, Soda,
   Tira, Hanji), in **all 7 languages**.

## Non-goals

- AI or free-text input of any kind.
- Coins, items, or any reward attached to a moment or keepsake.
- Notes between players (#4) — parked.
- Push notifications for moments (could come later; not now).
- Replacing the random tap lines — they stay as everyday filler.
- Localizing the old session-start / break-over lines in `companion-lines.ts` (a known
  gap, separate fix).

## Anti-goals (it would be a failure even if it "works")

- **Guilt.** No sad, hungry, lonely or neglected companion; never "you abandoned me" or
  streak-loss pressure. Coming back after a long time is always warm ("I kept your seat
  warm"). This must not undercut the free 3-day streak grace.
- **Chatter.** More than one speak-first moment per open, or a moment fighting a reward
  popup. If nothing new happened, the companion stays quiet (taps still give filler).
- **Repetition.** A "once" line said twice. Running out of away-life content must pause
  the feature, not start looping.
- **Breaking character.** Bunny not in third person, Soda gushing, Hanji chatty.
- **Slot machine.** Keepsakes framed as prizes ("You got: a Note!"). They're framed as
  something the companion did and wanted to share.
- **Clumsy templates** — lines where a dropped-in exam/subject name reads unnaturally,
  especially in JA/KO/ES/FR.

## How it behaves

### When the companion speaks first

The companion checks for a moment when **Home becomes visible after an "open"**: a cold
start, or returning to the foreground after being in the background. It only speaks when
all of these are true: Home is focused, no study session is active, the starter has been
chosen, the first-launch tutorial is done, and **no popup in the existing reward chain is
pending** (character obtained → Hanji → recipe badge → birthday → streak rescue → daily
reward → room ticket → bond level-up). It waits until the chain is clear, then speaks.

At most **one moment per open** and **two per account-day**. Anything else that qualified
waits for a later open if its window is still valid.

```
   ┌──────────────────────────────┐
   │ "Your Bio exam is Friday,    │   persistent speech bubble
   │  right? ...I'll be cheering  │   (not the 3.6s floating cloud)
   │  quietly the whole time~"    │
   └──────────────┬───────────────┘
              (Meruru)
        [ I'm ready ]  [ Nervous... ]   ← reply chips (only on question moments)
```

- The bubble **stays until tapped** (tap the bubble, the companion, or a reply). It is an
  **inline overlay on Home**, not a native Modal (stacked iOS modals freeze/fail — see
  `src/lib/modal-traffic.ts`). Other Home buttons stay usable; navigating away dismisses
  it (the moment still counts as said).
- Choosing a reply shows the companion's reaction line in the same bubble, then it
  dismisses on the next tap.
- Text uses FitText-style fitting (never clipped), up to ~4 short lines. Tablet layout
  follows `useIsTablet()` like the existing PetBubble.

### Moments (#1) — what it notices

Highest priority first. Each has a stable **instance id** so it fires once.

| # | Moment | Trigger (account-timezone days) | Replies → follow-up |
|---|---|---|---|
| 1 | Follow-up | A pending follow-up from a reply is due today (expires 2 days after due) | — |
| 2 | Birthday | Today is `profileBirthday` (after the birthday reward popup) — id `birthday:<year>` | — |
| 3 | Exam today | An exam's `dateISO` is today and its `time` hasn't passed (or it has no time). After the start time on exam day, it's treated as the aftermath (row 5) instead | — |
| 4 | Exam tomorrow | An exam is tomorrow | Ready / Nervous → reaction |
| 5 | Exam aftermath | 1–2 days after an exam | Great / Okay / Rough → reaction; **Rough** schedules a next-day follow-up |
| 6 | Welcome back | ≥3 days since the last study day (warm; never mentions the streak) | — |
| 7 | Away-life keepsake | See "Away life" below | — |
| 8 | Anniversary | 7 / 30 / 100 / 365 days since `firstStudyDate` (valid that day + 3 days) | — |
| 9 | Streak milestone | Current streak reaches 3 / 7 / 14 / 30 / 50 / 100 (id includes the streak's start date, so a rebuilt streak can be celebrated again) | — |
| 10 | Late night / early bird | The last session ended 00:00–04:59, or ended before 07:00 (valid until the next day ends) | Late night: I'm okay / So tired → reaction |
| 11 | Deadline met | A due task ("Due that day?" = yes, `isDeadline`) was completed on or before its due day, since the last open — id `task:<id>`. Repeating tasks excluded (they'd fire constantly). (Task priority can't be set in the UI — every task is `medium` — so priority is not used.) | — |
| 12 | Study milestones | 10th / 50th / 100th / 250th session; 10 / 50 / 100 total hours | — |
| 13 | Quiet subject | An active subject with ≥2 sessions and none in ≥10 days — once per quiet stretch | — |
| 14 | Exam soon | An exam 2–3 days away | Ready / Nervous → reaction |

Recurring kinds (exams, quiet subject, task done, late night) have **2–3 line variants per
companion**, rotated, so a second exam doesn't get the identical sentence.

Placeholders allowed: `{{exam}}`, `{{subject}}` (via `localizeSubjectName`), `{{days}}`,
`{{count}}`. Lines are written so the inserted name sits in a grammatically neutral spot
in every language (e.g. quoted, or as a topic). The user's display name is **not** used in
v1 (often empty for guests; avoids awkward fallbacks).

**Reply chips** are in the user's voice and shared across companions (localized). The
**reaction** to each reply is per companion.

### Bond letters

When the bond level-up popup appears for levels **2–15**, it shows a short letter (2–4
sentences) from that companion under the level, plus "Saved to letter box". Letters
progress: early levels are light; later ones reveal more of the character (their lore
already exists per skin in `companion-utils.ts` and can seed this). Levels beyond 15 show
the popup as today. Level 15 ≈ 37 hours studied with one companion.

**Letters must never go missing.** Level-ups are only detected in `recordSession`, which
records just the final level — so a level crossed by **petting** (`petCompanion` adds bond
minutes with no level check), a long session that **jumps two levels**, or levels an
**existing player** already passed would all skip their letter. So filing is continuous:
on every Home focus, compare each companion's current level (capped at 15) with the
letters already in `keepsakes` and add any missing ones to the letter box (marked new, no
popup). The popup still shows the letter for the level a session just reached.

### Away life (#2)

- **Eligible** when the app opens after **≥8 hours** since the player was last active, and
  no keepsake was given today.
- **Frequency ≈ 3–4 per week** for a daily user: always if ≥2 days since the last keepsake;
  ~40% chance if it was yesterday. (Builder may tune.)
- The **active companion** gives it from its **own pool**, in its own voice. It occupies the
  speak-first slot (priority 7 above), so it never lands on the same open as another moment.
- The bubble line says they left something ("I left something on your desk~"); a **sealed
  envelope** (or folded note) sits on the desk with a gentle wiggle and "Tap to open".
  Tapping opens a centered popup: the envelope opens and the handwritten note unfolds,
  with a **Done** button. It's saved to the letter box the moment it's shown.

```
   ┌──────────────────────────────┐
   │ "I left something on your    │
   │  desk~"                      │
   └──────────────┬───────────────┘
              (Meruru)
           ┌──────────┐
           │ ╲      ╱ │   sealed envelope on the desk → tap
           │    ♥     │
           └──────────┘

   popup:  ┌─────────────────────────┐
           │ Dear you...             │
           │ I tried to fold 100     │
           │ paper cranes today.     │
           │ I made 4~               │
           │              — Meruru   │
           │ [ Done ]                │
           └─────────────────────────┘
```

**Keepsake kinds — all text on code-drawn paper, no images:**
- **Note** — a short handwritten-style note ("Dear you... drink some water today.").
- **Story** — a tiny anecdote of what they did ("I tried to fold 100 paper cranes. I made
  4."). This is how the companion "has a life".
- **Letter** — longer; bond letters are this kind.
- Paper, lines, tape strips, envelope and heart seal are code-drawn SVG/views. A
  handwriting-style font may be used for the note text if it covers all 7 languages
  (otherwise the app font). No emojis, no faces on icons.

**Pool size:** ~30 entries per companion (≈ 2 months for a daily user). Each companion's
order is shuffled per player (seeded by friend code + companion) so friends don't get the
same sequence. **When a companion's pool runs out, away life pauses for that companion**
(no repeats) and an analytics event fires so the founder knows to ship more.

### Letter box

One per companion, opened from that companion's card in the **companion gallery**
("Letters"). A grid of paper tiles — notes, stories and bond letters — newest first, each
with its date and the first line in handwriting. Unopened back-filled letters show as a
sealed envelope with a dot. Tap → the full note/letter.

```
  Meruru's letters
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Dear you │ │ ╲  ♥  ╱  │ │ A strang-│
  │ drink... │ │ (sealed) │ │ er order…│
  │ Nov 19   │ │ Level 5  │ │ Nov 9    │
  └──────────┘ └──────────┘ └──────────┘
```

## Constraints

- **Local-first / offline-safe.** The engine runs on device; no server, no network needed.
  State persists in `PersistedState` and syncs through the existing `user_state` blob
  (full-blob sync — new fields ride along). Guests work the same, unsynced.
- **Dates** use the account timezone (`todayISO`, `daysBetween`, `daysAgoISO`), never
  `new Date()` day math. Hours for late-night/early-bird also in the account timezone.
- **No new native modules** (JS-only change; no rebuild).
- **Light mode only; no emojis; FitText for fixed boxes; PNGs transparent.**
- **Modals:** the speak-first bubble is an inline overlay. The full keepsake view and the
  letter box are router screens (keepsake view = centered rectangle popup via
  `transparentModal`, per the "rectangle popup, not sheet" convention), opened only when
  no other modal is up.
- **Performance:** Home is a very large component. The moment host must be isolated (like
  `PetCloudHost`) so showing/dismissing a moment doesn't re-render all of Home.
- **i18n:** all new text — lines, replies, letters, keepsakes, letter box UI — goes in **new
  per-language files** (e.g. `src/i18n/companion/<lang>.json`, loaded as a second i18next
  namespace or merged at init). This keeps ~2,000+ new strings out of the shared i18n
  files, which other sessions are actively editing (they currently carry foreign staged
  changes). zh-Hant is produced from zh via OpenCC, as today.
- **Concurrent sessions:** commit only by explicit pathspec; never stage or revert foreign
  i18n/PNG changes.

## Data (new `PersistedState` fields, with defaults + `normalizePersistedState` handling)

- `momentsSeen: string[]` — instance ids already said (e.g. `exam_tomorrow:<examId>`).
  Capped (keep the newest ~2,000).
- `momentDayCount: { dateISO: string; count: number }` — the 2-per-day cap.
- `pendingFollowUp: { id, companionKey, kind, answer, dueISO } | null`.
- `firstStudyDate: string` — back-filled from the oldest `sessionHistory` record, else set
  on the first finished session.
- `SessionRecord.endHour?: number` (0–23, account tz) — recorded from now on; old records
  have none, so late-night moments start from the next session.
- `lastActiveAt: number` (epoch ms) — stamped when the app backgrounds and on Home focus;
  used for the 8-hour away check. On an open, the away gap is **read before** the new
  stamp is written, or away life could never trigger.
- `lastKeepsakeISO: string` — frequency gate.
- `keepsakes: { id, companionKey, kind, contentId, dateISO, seen }[]` — letter box contents
  (bond letters included, kind `letter`).
- `awayLifeGiven: Record<companionKey, string[]>` — content ids already given, per
  companion.

## Approaches considered

1. **On-device engine + content in i18n files — chosen.** Fits how tap lines already work,
   works offline, all 7 languages stay together. Trade-off: new lines ship with an app
   update.
2. **Content on the server (Supabase table).** Could add lines without an update, but the
   companion would go quiet offline and 7-language content in a table is clumsy. Rejected:
   breaks the offline-safe core loop.
3. **Lines hard-coded in TypeScript** (like `companion-lines.ts`). Simplest to write, but
   bypasses translation and the 7-language parity. Rejected.

## Content plan

- Voice source of truth: the **current pet lines** in `en.json` (`pet.*`) plus
  `CHARACTER_DIALOGUE_GUIDE.md`, which is outdated (no Soda; Meruru is now dreamy/drifting
  with "..." and "~", not the old "sweet earnest Bun"). Update the guide alongside.
- Rough English volume: ~14 moment kinds × 6 companions × 1–3 variants (~170 lines) + reply
  reactions (~80) + 14 bond letters × 6 (84) + 30 keepsakes × 6 (180) ≈ **500 English
  strings**, then 6 translations.
- **Process:** write English for one or two companions first and show the founder a sample
  before writing the rest and translating — the voices are the product.
- Aki (hidden) and any custom companion use a gentle **generic voice** set.

## Left to the builder

- Exact engine shape — recommended: a pure `pickMoment(state, now)` in
  `src/lib/companion-moments.ts` (no React), so it can be checked with a small script.
- Exact away-life odds, bubble styling/animation, letter box styling (match the bakery
  menu-card / paper look).
- A dev-only "companion moments" tester in `dev-knobs.tsx` to force each moment (the repo
  has no unit-test framework; verify on the simulator via `/verify` + sim state injection).
- Analytics (PostHog, `src/lib/analytics.ts`): `moment_shown {kind}`, `moment_reply
  {kind, answer}`, `keepsake_given {kind}`, `letterbox_opened`, `away_pool_exhausted
  {companion}`.
