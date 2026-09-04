# Progress tab → studied-subject time tracker

**Date:** 2026-09-04
**Status:** implemented in feebb2c + 0c528fe, verified on the iOS simulator
**Chosen layout:** Option C ("One glance") — a ring with the total in the middle, subjects ranked beneath.

## Why

The Progress tab currently opens with a large streak cupcake, a Streak Freeze row, and
three stat pills that read `0 Sessions / 0 Minutes / 0 Days` on a quiet week. The thing
the founder actually wants to see — **how much time went into which subject** — is last on
the screen, smallest, and hidden behind a "Subject chart" button.

The tab becomes a subject time tracker. Streak drops to a header chip (Home already shows
the streak, so the card was saying it twice), the range selector moves to the top, and the
subject split becomes the screen.

## The screen

Top to bottom:

1. **Header** — `Progress` on the left, streak chip on the right: a small cupcake glyph and
   `N days`. Tapping it opens the streak popup (below).
2. **Range pills** — `Week · Month · Year · All`. Week is selected on open. **None are
   locked** — see "History cap" below.
3. **Ring card** — a donut of the subject split. Centred inside it: total time for the
   range (e.g. `7h 30m`) and a caption naming the range (`this week`). When the range is
   Week, the card header carries a `Full report ›` link to the existing `/weekly-report`
   screen.
4. **Insight line** — a compact line under the ring replacing the old "Session insights"
   card. What it can show **depends on the range's source**, because the rollups carry
   minutes but not session counts or per-day detail:

   | Range | Shows |
   |---|---|
   | Week, Month | Average session + best day (both from raw records) |
   | Year | Best month (from `subjectMonthly`) — no average, no session count exists |
   | All | Nothing; the line is hidden |

   Showing an average for Year or All would mean inventing a session count the rollup
   never stored. The line hides rather than lies.
5. **"Where it went"** — the ranked subject list: colour dot, name, percent, time. Sorted
   by time descending. A `Manage subjects ›` link sits at the end of the list.
6. **Achievements** — one row (`Achievements · 3 / 15 ›`) opening `/achievements`.

### Ring behaviour with many subjects

A donut turns to confetti past about five slices. The ring renders the **top 5 subjects by
time and merges the remainder into a single muted "Other" slice**. The list beneath is not
truncated — it shows every subject with a nonzero total.

### Empty state

When the selected range has no tracked minutes, the ring renders as an empty outlined
circle with `0m` in the middle, and the list is replaced by one line:
*"Tag a session with a subject and it lands here."*
The three zero-value stat pills are gone; they said less than one honest total.

### Streak popup

Streak and Streak Freeze leave the tab body and move into a popup behind the header chip.
Per the founder's standing preference this is a **centred rectangle popup**
(`presentation:'transparentModal'`, `animation:'fade'`, `gestureEnabled:false`, explicit
Done button), **not** an iOS swipe-down sheet. Content is the existing streak card, best
streak, rescue/at-risk states, and the freeze row with its Use action — moved, not
rewritten.

## Where each range gets its numbers

All four ranges are **calendar-based**, not trailing windows — "this week", "this month",
"this year", "all time". This is not cosmetic: `subjectMonthly` is bucketed by calendar
month, so a trailing-365-day Year could not be computed from it. Calendar boundaries keep
every range derivable from its source and keep the captions honest.

| Range | Source | Window |
|---|---|---|
| Week  | `sessionHistory` | `dateISO >= weekStartISO()` (the app's existing Mon-start week) |
| Month | `sessionHistory` | 1st of the current month → today |
| Year  | **`subjectMonthly`** (new) | The current year's `YYYY-MM` buckets, summed |
| All   | `subjectTimeMap` | Already exists, already lifetime, already synced |

`subjectTimeMap: Record<subjectName, minutes>` is already maintained in `addSubjectTime`
and is never trimmed, so **All needs no new data**. Only Year does.

### New field: `subjectMonthly`

```ts
/** Per-month, per-subject minutes. Keyed "YYYY-MM" → subject name → minutes.
 *  Never trimmed: it is the only honest source for the Year range once raw
 *  records age out of sessionHistory. ~6 subjects × 12 months = ~72 numbers/year. */
subjectMonthly: Record<string, Record<string, number>>;
```

Written in `addSubjectTime` alongside `subjectTimeMap` and `sessionHistory`. Defaults to
`{}` for existing accounts — no migration; Year is simply thin until a month accrues.
Added to the persisted/synced state the same way `subjectTimeMap` is.

## History cap

Free accounts are currently limited to `FREE_HISTORY_MONTHS = 3` of browsable history, and
`year` is filtered out of the existing subject chart's range list for non-Plus users. **The
founder chose to open all four ranges to everyone.**

- Remove the `historyCutoffISO` calls from `progress.tsx` and delete `subject-chart.tsx`
  (its only other caller).
- Gut `src/lib/history-window.ts` — with no callers left, delete the file.
- Delete the "Your full history" upsell card and its `progress.historyCapTitle` /
  `progress.historyCapDesc` keys.
- Raise the `sessionHistory` cap from `slice(0, 1000)` to `slice(0, 5000)`. At three
  sessions a day, 1000 records is about eleven months — Month would start under-reporting
  before Year did.

**This does not weaken the paywall.** The Plus "Advanced reports" perk is sold as
*"Monthly trends, best study hours, mood insights"* (`plus.f_advancedReportsDesc`), which
this change does not touch. Only the separate full-history upsell card goes away.

## Deletions

- `src/app/subject-chart.tsx` — the tab now does everything it did. Its route registration
  and the "Subject chart" button in the old subject section go with it.
- `src/lib/history-window.ts` — no remaining callers.
- Old Progress sections: the "This week" summary card (its `/weekly-report` link survives
  on the ring card), the stats row, the Session insights card, and the most/least-studied
  highlight row (the ranked list makes both obvious at a glance).

`/weekly-report` and `/achievements` are **not** touched — only their entry points move.

## Components

A new `src/components/subject-ring.tsx`: props `{ slices: {name, color, minutes}[], total,
caption, size }`. Drawn with `react-native-svg` (already a dependency) as stroked arc
segments on a circle, matching the app's code-drawn-icon convention — no AI raster, no
charting library. Handles the empty case by rendering the track ring only.

## i18n

New keys under `progress.*` in **all seven** locale files (`en`, `zh`, `zh-Hant`, `ja`,
`ko`, `es`, `fr`): `rangeWeek`, `rangeMonth`, `rangeYear`, `rangeAll`, `whereItWent`,
`ringEmptyHint`, `otherSubjects`, `bestMonth`, plus range-aware captions (`capThisWeek`,
`capThisMonth`, `capThisYear`, `capAllTime`). `avgSession` and `bestDay` already exist and
are reused.

Removed keys: `progress.historyCapTitle`, `progress.historyCapDesc`, and the
`progress.subjectChartBtn` label.

Subject names keep going through `localizeSubjectName`; durations through `formatDuration`.

## Testing

**As built:** the repo has no test runner, so rather than bolt one on uninvited the
aggregation was checked with 16 standalone assertions compiled straight from
`progress-ranges.ts` (all four ranges, the week/month calendar straddle, the previous
year's exclusion, the top-5 + "Other" threshold, and the empty/zero cases). Screen
behaviour was driven on the simulator. Two additions to the plan below: the account /
sign-out card was on this tab and has been kept at the bottom, and `formatDate` carried
a pre-existing UTC off-by-one that is now fixed.

- Aggregation is pure and gets unit tests: given a fixed `sessionHistory` /
  `subjectTimeMap` / `subjectMonthly`, each of the four ranges returns the expected
  per-subject totals, sorted, with the top-5 + "Other" rollup applied.
- Boundary cases: a session dated exactly on the week start; a month with no sessions;
  more than five subjects; every subject at zero.
- Simulator pass via the `verify` skill on all four ranges, plus the empty state and the
  streak popup.

## Out of scope

Mood insights, best-study-hours analysis, and any change to how sessions are recorded or
credited. This is a presentation change plus one additive rollup field.
