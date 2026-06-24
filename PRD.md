# Memobun — Product Requirements Document (Current State)

> **Status:** Reflects the app as actually built (supersedes the original PRD v1.11, which was authored before AI chat, multiplayer, and social features existed).
> **App name:** Memobun · **Bundle id:** `com.sophialin.memobun` · **Platform:** iOS-first (Expo / React Native).
> **One-line:** A cozy, anime-bakery-themed study companion that makes focused studying feel less lonely and more rewarding.

---

## 1. Vision & Core Loop

Memobun turns studying into a warm daily ritual. A cute companion studies *with* the user at a customizable bakery desk; finishing focus sessions earns **Focus Coins**, which unlock companions, outfits, rooms, and treats. Streaks, quests, and friends pull the user back tomorrow.

**Core loop:** `study → earn coins → unlock & customize → come back tomorrow (streak)`.
Every feature must reinforce this loop.

**Theme:** Cozy anime bakery. Light, soft, pastel. (App is **locked to light mode** — dark mode is intentionally disabled.) No emojis in UI; icons are PNG/code-drawn art; no faces on UI icons (except semantic mood/confidence states).

---

## 2. Target Audience

Students, roughly **13–25**. The app is gated at **13+** (with a date-of-birth check). Designed for solo studiers who want company, light accountability, and a collection/customization reward layer.

---

## 3. Platform & Tech Stack

- **Client:** React Native + Expo (SDK 56) + TypeScript, `expo-router` file-based navigation.
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage + Edge Functions).
- **State/persistence:** Local-first app state in React context, persisted to AsyncStorage, synced to Supabase (`user_state`) for cross-device continuity.
- **AI:** OpenAI accessed **only** via Supabase Edge Functions (key never ships in the app).
- **Payments:** RevenueCat (App Store IAP).
- **Analytics:** PostHog (env-gated, JS-only).
- **Localization:** `react-i18next`, **6 languages at full key parity** (English, Japanese, Chinese, Korean, Spanish, French).

---

## 4. Navigation

Four bottom tabs only: **Home · Tasks · Progress · Shop**. Everything else is a pushed/modal screen. ~44 screens total.

---

## 5. Feature Catalog

### 5.1 Study Sessions (the heart)
- **Session picker** → choose duration; **custom timer** with a scrollable wheel.
- **Subject + mood picker** before a session; topic carries into the session.
- **Study desk / session screen:** the companion sits at a bakery desk with a book centered under its face; ambient art, day/night.
- **Ambience picker** and **Study Sounds** (4 purchasable looping tracks) for focus audio.
- **Spotify radio control** (PKCE + Web API, Premium only) — control study music in-app.
- **Coins on completion only:** ending a session early forfeits all coins (warned). Finishing pays out (1 coin/min, daily cap for free users).
- **Break game** between sessions; companion "bakes" during breaks.

### 5.2 Companions & Customization
- **Starter chooser:** first launch, pick **1 of 5 companions free**; the other 4 become 1,200-coin shop items (strict ownership model + grandfathering).
- **Companion gallery** ("switch character"): change active companion and **outfits/skins**.
- **Outfits:** per-companion wardrobe; outfit **lore** popups (pronoun-free poems); some outfits **pair with a matched room** (background + desk) via a wardrobe chain icon.
- **Hanji** companion: earned by collecting **all recipe badges** (not sold), auto-granted with a one-time popup.
- **Room / desk editor** ("background"): change room background and desk, decorate.
- **Profile picture (PFP)** chooser from owned companions.
- **Character-obtained celebration** card when a companion is bought/picked.

### 5.3 Economy (Focus Coins)
- **Earn:** studying (1 coin/min), daily login reward (tied to study streak, N coins on day N, cap 200), birthday reward (+1,000, once/year), quests & achievements (bonus coins bypass the daily cap).
- **Daily earn cap** for free users (e.g., 500/day shown in shop).
- **Spend:** companions, outfits, rooms, desks, study sounds, streak freezes.
- **Coin shop / "Bakery Menu":** coin packs ($0.99 Strawberry Cupcake → $99.99 Together With You) as IAP; Plus members get a discount.

### 5.4 Habit & Progress
- **Streaks:** day = midnight in the account's captured timezone; **up to 3 missed days grace**; **streak freezes** (Plus members get some; purchasable) protect a streak.
- **Tasks:** to-do tracker with completion + a **calendar** view.
- **Subjects:** manage subjects (color-coded); per-subject time tracking.
- **Exam countdowns:** free up to 3 active exams.
- **Mood tracker:** before/after session moods (free).
- **Weekly report** + **mood chart** + **subject chart** (pie); Plus unlocks advanced report sections.

### 5.5 Engagement & Retention
- **First-launch tutorial:** coachmark tour pointing at real UI (Start, streak, coins, switch character/outfit, recipes, room/background, Tasks, Shop). Renders above the menu bar.
- **Daily quests:** 3/day, bonus coins.
- **Achievements:** 14 achievements.
- **Recipe badges:** collecting all unlocks Hanji.
- **Streak-nudge notifications:** up to 2 local notifications/day (1pm + 9pm) on days the app isn't opened, before the midnight reset.

### 5.6 Social & Multiplayer
- **Friends:** friend codes, send/accept requests, friend list, **friend cards** (view a friend's character, streaks, hours, birthday, description).
- **Direct messages:** 1:1 chat (Supabase table for history + broadcast for liveness), with a profanity mask filter and in-chat game invites.
- **Profiles:** display name, description, card color (Plus), avatar frame (auto gold ring + crown for Plus).
- **Multiplayer study rooms:** a **study lobby** with circular avatars showing each member's synced time + topic; study together live. Leaving auto-ends that member's session; host migrates to a random remaining member; anyone can invite (max 3).
- **Presence status:** studying (red) / on break (pink) / free (green) drives game-invite availability.
- **Mini-games:** Connect 4 and Tic-Tac-Toe via real-time invites; auto-exit when a break ends.
- **Study Buddy matching:** opt-in, random **1-week stranger accountability partner**; safety-first (age-band matching, server-side RPC, canned cheers only, hidden friend code, report → block).
- **Block & Report:** report a user (reason picker → Supabase `user_reports`, founder reviews in dashboard) and block (removes + hides them everywhere).

### 5.7 AI Features
- **AI companion chat:** chat with your companion (warm, study-focused persona) via the `companion-chat` Edge Function.
- **AI companion image generation:** generate cosmetic companion images via `generate-companion` (with **content moderation** + background removal).
- **Tickets:** AI usage is metered by tickets; per-user **server-side daily rate limits** (chat 150/day, image 20/day) cap cost.

### 5.8 Mini-games (standalone)
- **Cake Kitchen / BatterDash:** wave-based baking mini-game (grid A* navigation, coins).

---

## 6. Monetization (Freemium)

- **Memobun Plus** (~$7/month subscription): kept-forever cosmetics, custom card color, gold avatar frame + crown, advanced reports, bonus streak freezes, Golden Teahouse room, coin-shop discount.
- **Coin packs:** consumable IAP, $0.99–$99.99.
- **AI tickets:** for companion image generation.
- All purchases via **RevenueCat**, **fail-closed** (never grants in production if the store is unavailable).

---

## 7. Safety, Privacy & Compliance

- **Age gate:** 13+ with DOB capture (folded into the legal consent gate; covers guests; DOB wiped on account deletion).
- **Legal consent gate:** first-launch Privacy Policy + Terms acceptance. *(Outstanding: a publicly hosted Privacy Policy URL is required for App Store submission.)*
- **Content moderation:** profanity filter (mask in most UI; **blocks** on subject/task names), AI image moderation, block/report flows.
- **Data access:** Supabase **Row-Level Security on every table**; profile reads gated to authenticated users (no anonymous scraping).
- **Abuse/cost protection:** server-side AI rate limits.
- **Account controls:** single active session per account (instant realtime kick + cross-device sync); self-serve **account deletion** (RPC + local wipe).
- **Analytics:** PostHog, env-gated.

---

## 8. Accessibility & Device Support

- **Tablet support:** proportional scaling via a shared tablet-scale hook; iPad layouts verified so text never clips or shrinks inconsistently.
- **Light mode locked** (dark mode disabled by design).
- **Localization:** 6 languages, device-default + in-app picker, full parity.
- Optional button tap sounds (respects mute switch).

---

## 9. Backend Surface (Supabase)

- **Tables:** `profiles`, `friend_requests`, `direct_messages`, `user_state`, `blocked_codes`, `user_reports`, `ai_usage`, study-buddy tables (`study_days`, `buddy_queue`, `buddy_pairs`, `buddy_nudges`).
- **Edge Functions:** `companion-chat`, `generate-companion` (auth-gated + rate-limited + moderated).
- **Realtime:** presence (`online-users`) + broadcast (study rooms, DMs, game moves).
- **Storage:** companion image bucket.

---

## 10. Known Follow-ups / Out of Scope

- Hosted Privacy Policy URL (App Store blocker).
- Unify the two block code paths (`friend-requests.blockFriend` vs `app-context.blockUser`) into one API.
- Extend block filtering to incoming friend requests + DM inbox (not just the friends list).
- Localize remaining English-only companion line files.
- Coins are granted client-side (acceptable for a cosmetic economy; not server-validated).
- Two pre-existing TS strictness warnings (`pointerEvents` on `<Image>`) — runtime-harmless.

---

*Generated from the live codebase. The canonical original product doc is `Memobun_PRD_v1.11.docx`; this document captures the current, broader feature set.*
