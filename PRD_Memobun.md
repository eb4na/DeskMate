# Memobun — Product Requirements Document

**Version:** As-built v1.x (generated from the codebase on 2026-06-10)
**Platform:** iOS-first mobile app (Android + Web builds exist), portrait only
**Bundle ID:** `com.sophialin.memobun` · **Display name:** Memobun
**Owner:** Sophia Lin

> This PRD documents the product *as it is actually implemented in the repository today*, not an aspirational spec. Where a capability is partial or mocked, it is flagged inline. It supersedes the older `PRD_CHECKLIST.md` (audited against PRD v1.9/1.10), which predates the rename to Memobun and the multiplayer / real-AI / friends features.

---

## 1. Vision & Positioning

Memobun is a **cozy, anime/bakery-themed mobile study companion** for students aged ~16–25. The goal is to make solo studying feel less lonely and more rewarding by pairing a focus timer with a charming companion character, a reward economy (Focus Coins), room/character customization, light social features, and short break games.

**Core promise:** *Study → earn coins → unlock items → feel accompanied → come back tomorrow.*

Every feature must reinforce that loop. Features that don't connect study time to reward, companionship, or retention are out of scope.

### Design pillars
- **Cozy & non-shaming.** Warm sepia/bakery palette, gentle companion lines, supportive copy for avoided work. App is **locked to light mode** (dark theme is intentionally disabled).
- **Companionship.** A persistent companion ("Bun" by default) studies alongside the user, reacts to sessions, and can chat.
- **Reward loop, not gambling.** Coins are earned by real study time; no coin-to-cash conversion.
- **Approachable freemium.** Generous free tier; **Memobun Plus** subscription plus consumable coin packs and AI tickets.

---

## 2. Target Users & Personas

- **The lonely solo studier (primary):** studies alone, wants ambient company and gentle structure.
- **The avoider:** procrastinates specific subjects/tasks; needs non-judgmental nudges and tiny wins.
- **The social studier:** wants to study "with" friends — synced study rooms and casual break games.
- **The customizer:** motivated by collecting companions, outfits, room decor, and AI-generated characters.

---

## 3. Tech Stack & Architecture

| Layer | Choice |
|-------|--------|
| Framework | React Native 0.85 + **Expo SDK 56**, React 19 |
| Language | TypeScript |
| Navigation | `expo-router` (file-based, **typed routes**, React Compiler enabled) |
| State | React Context (`app-context`, `auth-context`) + local persistence |
| Persistence | `expo-file-system` scoped per-user (`app-state-repository`); `expo-secure-store` for auth |
| Backend | **Supabase** — Postgres + Auth + Storage + Edge Functions (Deno) |
| Realtime | Supabase Realtime channels (`game-net`) for multiplayer rooms |
| AI | Supabase Edge Functions: `companion-chat` (LLM chat) and `generate-companion` (image gen + moderation + background removal) |
| i18n | `react-i18next` — **6 languages** (en/ja/zh/ko/es/fr), ~1,123 keys at parity, device-default + in-app picker |
| Notifications | `expo-notifications` |
| Media | `expo-image`, `react-native-svg` (UI icons drawn as SVG, no emoji-as-icon), `react-native-view-shot`, `expo-sharing` |
| Animation | `react-native-reanimated` + worklets |

**Data model (Supabase):**
- `profiles` — public shareable friend card (friend_code, display_name, companion_id, skin_id, background_id, streaks, total_minutes). Public-read, owner-write.
- `friend_requests` — pending/accepted/declined requests between users (RLS scoped to both parties).
- `companion-images` storage bucket — public PNGs for AI-generated companions.

Most app state (coins, tasks, subjects, sessions, streak, inventory, settings) lives **client-side** and is persisted per-user via the file-system repository, synced to the cloud profile for the social-facing fields only.

---

## 4. Information Architecture

**Bottom tab bar (exactly 4 tabs, never a 5th):**
1. **Home** — companion scene, today's goal, Start Session, room background, links to ambience/chat/Plus.
2. **Tasks** — task tracker + calendar + subject manager entry.
3. **Progress** — streak, stats, subject time, mood insights, weekly report, exams.
4. **Shop** — spend coins on companions, outfits, recipes, backgrounds, desks, sounds, reminders.

**Tabs are hidden** during a focus session, break game, and multiplayer study to keep those states immersive.

**Full screen inventory (`src/app/`):**

| Area | Screens |
|------|---------|
| Auth `(auth)` | login, signup, verify-code, forgot-password, reset-password, resend-confirmation |
| Tabs `(tabs)` | index (Home), tasks, progress, shop |
| Session flow | session-picker, subject-picker, session, session-complete, custom-timer |
| Break/games | break-game, cake-game, study-desk, study-lobby |
| Companion | companion-chat, companion-gallery, companion-pfp, food-gallery |
| Social | friends, friend-card, party-invite |
| Customization | edit-room, ambience-picker, manage-subjects, subject-picker |
| Planning | add-task, add-exam, reminder-settings |
| Account/monetization | profile, settings, plus-upgrade, coin-shop, weekly-report, language-picker |

---

## 5. Accounts & Authentication

Full **email/password auth via Supabase**:
- Sign up with email confirmation (verify-code), login, resend confirmation, forgot/reset password.
- Auth state held in `auth-context`; secure token storage via `expo-secure-store`.
- On sign-in, app state is loaded into the user's scope; a public `profiles` row (with a generated **friend code**) is created/synced.
- **Friend code:** 6 chars from `A–Z` + `2–9` with ambiguous chars (I/O/0/1) removed.

---

## 6. Core Feature Set

### 6.1 Focus Timer
- **Free presets:** 10 / 25 / 50 / 90 min (labeled Quick Warm-up, Focus Boost, Deep Focus, Long Session).
- **Custom focus timer (Plus):** arbitrary durations via `custom-timer`.
- **Saved presets (Plus):** fixed-size queue, max 4, newest-first.
- Large centered countdown; optional subject and/or task shown; **General Study** fallback when skipped.
- **Pause** up to 2× per session.
- **Break timer** after each session: 5 / 10 / 15 min (custom break length supported per active session via `breakMinutes`).
- Break games are only reachable **after** a completed session (guarded; not from Home).

### 6.2 Focus Coins (reward economy)
- **Earn rate:** ~1 coin per minute studied; preset payouts 10/25/50/90 coins for the 10/25/50/90 presets.
- **Daily free-earn cap:** 200 coins/day (purchased coins are **not** capped and never expire).
- Early-cancel sessions are prorated/reduced; minimum threshold for coins.
- **Bonuses:** finish a task (+10), streak milestones (3-day, 7-day), comeback after missed days.
- **No coins** during breaks; no coin↔real-money conversion.
- **Coin packs** purchasable (`coin-shop`) — currently mock IAP tiers.

### 6.3 Shop & Customization
27 items across shop categories shown as tabs: **Companions, Outfits, Recipes, Backgrounds, Desks, Study Sounds, Reminders** (legacy decoration/theme/pose categories retained internally for effect compatibility).
- Buy with coins; ownership persisted; **cosmetics actually render** (companion skins/outfits, room background, desk).
- **Companions:** Cocoa (barista kitty), Bunny (princess bunny), Miel (honey-bear baker), **Tira** (Plus-exclusive, granted free on Plus). Default starter companion is **Bun** (girl/dude starter variants).
- **Outfits / wardrobe:** per-companion skins (e.g. Bun → Classic / Angel / Angel Kei; Cocoa → Relax). Some outfits change the companion's reminder tone/personality while worn.
- **Plus benefits:** 20% shop discount; `plusOnly` items auto-granted on first upgrade.

### 6.4 Companion Behavior
- Default scripted lines (`companion-lines`, `companion-reminder-lines`): session start/end, break-over, missed-day, home greetings — gentle, non-shaming tone.
- **AI companion chat (real):** `companion-chat` screen → Supabase Edge Function calling an LLM. System prompt gives the companion a warm bakery-study persona, keeps replies short (1–3 sentences), steers away from harmful/off-topic content, bounds history (last 16 turns, 1k chars each).
- Companion avatar rendered from selected companion + equipped skin; profile-picture framing (zoom/pan) configurable via `companion-pfp`.

### 6.5 AI Generation Tickets
- **`generate-companion` Edge Function (real):** builds a structured prompt for an anime bakery character, runs **prompt moderation** (`assertPromptIsSafe`), generates an image, **removes the background** (chroma/alpha), and uploads to the public `companion-images` bucket.
- Result saved as a **companion slot** (Plus: multiple saved slots).
- **Plus:** monthly ticket allotment (e.g. 3/month with monthly reset). Static images only — no chat/voice/animation from generation.
- *Known follow-up:* AI endpoints currently lack server-side entitlement checks + rate-limiting (ticket/balance enforcement is client-side).

### 6.6 Tasks, Subjects & Avoidance
- **Tasks:** title, subject, due date + optional time, estimate, priority (low/med/high), status (not_started/in_progress/done). Full CRUD; complete → +10 coins + companion reaction; optional local notification (`notifyAt`/`notifId`).
- **Calendar** view (`task-calendar`).
- **Subjects:** add/rename/archive/delete/reorder, auto color + optional emoji, no limit, General Study fallback; skip-subject nudge after repeated skips.
- **Avoidance tracker:** postpone counts per task, "Needs attention" surfacing of most-delayed tasks, supportive copy.

### 6.7 Mood Tracker (free)
- 6 mood options before a session (in subject-picker) and 6 after (in session-complete).
- "% positive after studying" insight on Progress + weekly report. Non-medical wording.

### 6.8 Streaks
- Current + longest streak, days studied this week.
- Milestone coin bonuses; comeback bonus after missed days.
- **Streak freeze (Plus):** limited number per month.

### 6.9 Exams
- **Free:** up to 3 active exam countdowns (name, subject, date, optional time, reminder toggle).
- **Plus:** unlimited exams + advanced fields (topics, target hours, confidence 1–5).

### 6.10 Reminders & Notifications
- Daily study reminder (time + toggle); **Plus:** multiple reminders with labels and weekdays-only option.
- Backed by `expo-notifications` (`notifications.ts`); cozy default tone, example copy on reminder screen.

### 6.11 Progress & Reports
- Per-subject time tracking (incl. General Study), most/least studied subject, best study day, average session length, total focus time.
- **Weekly report** (`weekly-report`): total time, sessions, tasks, study days, estimated coins, mood improvement, subject breakdown, suggested goal — shareable via `view-shot` + `expo-sharing`. Advanced weekly/monthly analytics are Plus (partly placeholder).

### 6.12 Ambience / Study Sounds
- `ambience-picker` with study-sound options (Plus); sounds sold in shop. *(Audio playback may be UI-stage depending on build.)*

---

## 7. Social & Multiplayer

### 7.1 Friends
- Add friends by **friend code**; **friend requests** (send → accept/decline) backed by the `friend_requests` table.
- **Friend cards** (`friend-card`) show the friend's synced profile: display name, companion + skin + background, description, birthday, current/longest streak, total minutes.

### 7.2 Multiplayer Study Rooms
- Synced co-study over Supabase Realtime (`use-study-room`, `game-net`): a shared timer, live **studying / break / idle** status per member, host-controlled start.
- Flow: `study-lobby` → `study-desk`; connection lives in the root layout so it survives lobby→home transitions.
- Party invites (`party-invite`, `invite-listener`) for inviting friends into a room.

### 7.3 Break Games
Reachable only after a completed session (single-player) or from a party (multiplayer):
- **Tic-Tac-Toe** — free; vs AI or pass-and-play friend / online.
- **Memory Cards** — vs AI or friend; cute SVG icon pairs.
- **Connect 4** — vs AI or **online multiplayer** (7×5 board, four-in-a-row; shared pure logic in `game/connect4/logic.ts`).
- **Cake Kitchen / "BatterDash"** (`cake-game`) — wave-based cooking mini-game with grid **A\*** click-to-move navigation, ingredient art, checklist + cook previews, coin rewards.

---

## 8. Monetization

| Tier | Offering |
|------|----------|
| **Free** | Full core loop, 2 starter companions, mood tracker, up to 3 exams, 1 daily reminder, free break games, 200 coins/day earn cap |
| **Memobun Plus** | Subscription — **$8.00/month** (or ~$4.17/mo billed annually). Unlocks: custom + saved timers, multiple reminders, unlimited exams + planner fields, streak freezes, 20% shop discount + Plus-only cosmetics (e.g. Tira), all break games, AI tickets + extra saved companion slots, advanced analytics, study sounds |
| **Consumables** | Coin packs (multiple tiers); AI generation tickets |

> Payments are currently **mock** (no RevenueCat/StoreKit wiring yet). Plus status and balances are enforced client-side — a known hardening follow-up.

---

## 9. Localization & Accessibility
- 6 fully-translated languages at key parity (~1,123 keys): English, Japanese, Chinese, Korean, Spanish, French.
- Language auto-detected from device; overridable at login and in `language-picker`/settings.
- **Light mode locked** by design.
- UI icons are drawn as **SVG** (no emoji-as-icon); transparent-PNG rule enforced for companion/asset art (always transparent background, never `ImageBackground` for transparent PNGs).

---

## 10. Out of Scope (v1)
- Real payment processing (RevenueCat/StoreKit) — mocked.
- Server-side entitlement + rate-limiting for AI endpoints.
- Generated **animations**, voice, or general-purpose AI assistant behavior.
- Calendar/LMS integrations.
- Coin → real-money conversion.
- Dark mode.

---

## 11. Known Gaps / Follow-ups
1. **Monetization:** wire real IAP/subscription (Plus, coin packs, AI tickets); move entitlement + rate-limiting server-side.
2. **Ambience audio:** confirm real sound playback for purchased/Plus study sounds.
3. **Notifications:** ensure scheduled push fires for daily reminders, task due times, and exam countdowns end-to-end.
4. **Advanced analytics:** replace Plus weekly/monthly placeholders with real trend data (best time-of-day, avoidance-by-subject).
5. **Exam planner depth:** surface Plus exam fields (topics/target hours/confidence) and review-session flow on Progress.
6. **AI moderation/refund:** consume tickets on success only; refund on failure; verify safety filters end-to-end.

---

## 12. Success Metrics (proposed)
- **Retention:** D1 / D7 / D30; average study days/week; streak length distribution.
- **Engagement:** sessions/user/day, avg session length, total focus minutes.
- **Economy health:** coins earned vs spent, % users hitting daily cap, shop conversion.
- **Social:** % users with ≥1 friend, multiplayer study-room sessions, break-game plays.
- **Monetization:** free→Plus conversion, coin-pack / AI-ticket purchase rate, Plus churn.
- **AI:** chat sessions/user, companion-generation success rate, moderation rejection rate.

---

*Generated by auditing the live repository (screens, context/actions, Supabase migrations + edge functions, shop catalog, i18n, and game modules). Re-generate after major feature ships.*
