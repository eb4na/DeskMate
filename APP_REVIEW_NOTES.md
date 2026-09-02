# App Review Notes — Memobun (com.sophialin.memobun)

> SUPERSEDED: send **APP_REVIEW_REPLY.md** instead — it answers Apple's points 1-7
> in their own order. This file is kept for the background detail and checklists.

Answers to the Guideline 2.1 "Information Needed" letter. Paste the **Short version**
into App Store Connect → App Review Information → Notes, and the **Full version**
into the Resolution Center reply (more room there).

Facts here were read out of this repo (`app.json`, `package.json`, `src/lib/*`,
`src/i18n/en.json`) — if the app changes, update this file too.

---

## Short version — paste into ASC → App Review Information → Notes

> Before pasting: replace `REPLACE_ME_EMAIL` / `REPLACE_ME_PASSWORD` with the real
> demo credentials, and replace the `DEVICES TESTED` list at the bottom of the block
> with the devices you actually tested on (template in the Full version below).

```
DEMO ACCOUNT
Email: REPLACE_ME_EMAIL   Password: REPLACE_ME_PASSWORD
This account already has a friend and an existing chat thread so the report and
block flows can be reached immediately (Friends tab -> tap the friend's card ->
Report / Block).

Login is NOT required to use the app — the sign-in screen has "Continue as guest"
and the full study loop works without an account. An account is only needed for
Friends, direct messages, Study Buddy, and Memobun Plus.

WHAT THE APP DOES
Memobun is a cozy study-focus timer for students. You pick a companion character,
set a duration and subject, and study; the character studies alongside you at a
desk. Finishing a session pays out one Focus Coin per minute studied (ending early
pays nothing), and coins buy cosmetic companions, outfits, rooms and treats. It
also has tasks, exam countdowns, subject stats, weekly mood/subject reports and
daily streaks. Audience: students aged 13+ (the app asks the user to confirm they
are 13+ at first launch; no date of birth is collected). Problem solved: starting and sustaining focused study alone is
hard; a companion, a visible streak and a small reward loop make it easier.

HOW TO REACH THE MAIN FEATURES
1. Launch -> accept Privacy Policy + Terms -> confirm you are at least 13.
2. Pick one of five starter companions (free).
3. Sign in with the demo account above (or tap "Continue as guest").
4. Home -> tap the timer/desk -> choose duration, subject, mood -> the session
   starts automatically. Finish it to see the coin payout.
5. Shop tab -> buy cosmetics with coins; "Get more coins" -> coin packs (IAP) and
   an optional rewarded video ad (+100 coins, 3/day).
6. Memobun Plus paywall: Shop or Settings -> Memobun Plus. Monthly $4.99 and
   Yearly $39.99, auto-renewing, with the renewal disclosure and Terms/Privacy
   links on the same screen. "Restore Purchases" is on that screen.
7. Friends tab -> friend list, add by friend code, direct messages, and Report /
   Block on a friend's card. Study Buddy pairs you with an anonymous partner in
   your age band (no names, no free chat, canned check-ins only).
8. Settings -> Delete account (permanently deletes the account and its data),
   language, reminders, legal documents, and support contact
   memobunsupport@gmail.com.

PERMISSION PROMPTS
The only system permission the app requests is Notifications (optional study
reminders / streak nudges). The app does not use camera, photos, microphone,
location, contacts, or App Tracking Transparency, and does not track users
(NSPrivacyTracking = false).

EXTERNAL SERVICES
Supabase (accounts, database, realtime multiplayer), Sign in with Apple, Google
Sign-In, RevenueCat (in-app purchases), Google AdMob (rewarded video only,
non-personalized), PostHog (product analytics), Spotify Web API (optional, user
connects their own Spotify Premium account to control playback). The app uses no
AI services and generates no AI content.

REGIONAL DIFFERENCES
The app behaves identically in every region. The interface is localized in 7
languages (English, Simplified Chinese, Traditional Chinese, Japanese, Korean,
Spanish, French) and follows the device language. In-app purchase prices are
localized by the App Store. The only availability difference is the optional
Spotify integration, which requires the user's own Spotify Premium account and is
unavailable where Spotify does not operate; every other feature works without it.

REGULATED INDUSTRY / THIRD-PARTY MATERIAL
The app is not in a regulated industry. All artwork, characters, text and audio
are original and owned by the developer. The only third-party content is Spotify:
the app uses the public Spotify Web API under Spotify's Developer Terms of
Service, the user authorizes their own Spotify account via OAuth, all playback
happens in Spotify's own app, and the app only displays the currently playing
track name and album art returned by the API. No media is stored, redistributed
or rebroadcast.

USER-GENERATED CONTENT SAFEGUARDS (Guideline 1.2)
- Direct messages are only possible between mutual friends; blocked users are
  filtered out server-side.
- Report and Block are on every friend card; blocking removes the friend and
  hides them everywhere. Study Buddy has its own Report which ends the match.
- A profanity filter masks bad words in chat and hard-blocks them in
  user-entered subject and task names.
- Support/abuse contact: memobunsupport@gmail.com (also in Settings).
- Terms of Service (EULA) and Privacy Policy are shown before first use and are
  in Settings -> Legal; policy also at https://memobun.app/privacy.html

DEVICES TESTED
- iPhone 13, iOS 26.5 (physical device, tested via TestFlight, build 33)
- iPhone 17, iOS 26.5 (Xcode Simulator)
- iPad Pro 13-inch (M4), iPadOS 26.5 (Xcode Simulator)
```

---

## Full version — additional detail for the Resolution Center reply

Use everything above, plus:

**2. Devices and OS versions tested.** Fill this in truthfully with what you
actually ran. Format Apple expects:

```
- iPhone 13, iOS <version> (physical device, TestFlight build <n>)
- iPad Pro 13-inch (M4), iPadOS <version> (physical device / TestFlight)
- iPhone 17 Pro simulator, iOS <version> (Xcode)
- iPad Pro 13-inch simulator, iPadOS <version> (Xcode)
```

Only list devices you really tested on, and put the physical devices first — the
letter specifically asks about physical-device testing. Take the build number from
the rejected submission in App Store Connect, not from `app.json` (the working tree
may be ahead of what was submitted).

**3. Longer description of the app.** Memobun turns solo studying into a small,
repeatable ritual. The core loop is: choose a duration, subject and current mood →
a companion character sits at a bakery desk and studies with you for that time →
finishing pays one Focus Coin per minute. Coins are only paid on completion, which
is a deliberate design choice that makes the last stretch of a session easier to
sit through. Coins buy purely cosmetic items — companions, outfits, rooms, desks,
ambient sound packs. Around the loop sit study tools: a task list, exam
countdowns, a subject manager, and weekly reports that chart study time by subject
and mood over time, plus a daily streak with optional reminder notifications.
Multiplayer study rooms let friends run timers together in real time, and Study
Buddy pairs a user with an anonymous accountability partner in their own age band
for one week. Target audience: students 13 and older, particularly high-school and
university students studying alone who struggle with starting and with
consistency. Value: lower the activation cost of a study session and give visible
progress for effort already spent.

**4. Notes on the demo account.** Also state which parts are account-gated so the
reviewer isn't confused when a guest hits a gate: Friends, direct messages, Study
Buddy and Memobun Plus all show a "create an account" prompt in guest mode. The
rest of the app — study sessions, shop, tasks, exams, reports, streaks, ambient
sounds — works fully as a guest.

**5. What each external service is used for.**

| Service | Used for | Data sent |
| --- | --- | --- |
| Supabase | Accounts, profile, progress sync, friends, DMs, realtime study rooms | Email, user id, app progress, message text |
| Sign in with Apple | Optional native sign-in | Apple-provided identity token |
| Google Sign-In | Optional sign-in (web OAuth) | Google account email |
| RevenueCat | In-app purchases and subscription entitlement | Anonymous user id, purchase receipts |
| Google AdMob | Optional rewarded video for coins (non-personalized ads only, no ATT prompt) | Standard AdMob ad request data |
| PostHog | Aggregate product analytics (screen/feature usage) | User id, event names — no tracking across apps |
| Spotify Web API | Optional playback control of the user's own Spotify Premium account | OAuth token, playback commands |

No AI or machine-learning service is used anywhere in the app, and the app does
not generate content with AI.

---

## Pre-reply checklist (do these before replying)

- [x] **Confirm the submitted build actually has its API keys.** ✅ Checked
      2026-08-16: `eas env:list production` and the local `.env` both carry
      `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_ADMOB_REWARDED_IOS`,
      `EXPO_PUBLIC_SPOTIFY_CLIENT_ID` and `EXPO_PUBLIC_POSTHOG_KEY`, so both the
      cloud-build path and the local-archive path pick them up. Still worth one
      live tap-through on the TestFlight build (purchase sheet, rewarded ad,
      Spotify connect) before promising these to Apple in writing.
- [ ] **Create the demo account, plus a second account friended to it**, with a
      few messages already in the thread — otherwise Report and Block cannot be
      demonstrated in the recording.
- [ ] **Check the ASC age rating** reflects 13+ with user-to-user messaging and
      third-party ads, and that the app is not in the Kids Category (the Kids
      Category forbids third-party ads and analytics; this app ships both).
- [ ] **Check the ASC App Privacy answers match `app.json`'s privacy manifest** —
      it declares email address, user id, other user content, purchase history,
      product interaction, device id, and advertising data.
- [ ] Record the video (see the flow below), attach it or link it, paste the Notes,
      set "Sign-In Required" with the demo credentials, and reply in Resolution
      Center **with the existing build** — no new upload is needed unless one of
      the checks above fails.

## Recording flow (physical device, latest iOS, ~4 minutes, no cuts)

**Record the TestFlight build — the exact binary you submitted — not an
`expo run:ios` dev build.** A dev client can predate a native pod and make
purchases, ads or sounds silently no-op, so filming it risks filming a bug.

1. Launch from the Home screen (show the app icon being tapped).
2. Privacy Policy + Terms consent, then the 13+ age confirmation.
3. Starter companion picker.
4. Sign in with the demo account (show the login screen and the guest option).
5. Home → start a session → duration, subject, mood → let it run briefly →
   finish → coin payout.
6. Shop → buy a cosmetic with coins → "Get more coins" → show the coin-pack
   purchase sheet and the rewarded-ad flow.
7. Memobun Plus paywall — hold on it long enough to read the price, renewal
   disclosure and the Terms/Privacy link → tap Start Plus far enough to show the
   App Store sheet → Restore Purchases.
8. Friends tab → open a friend's card → direct message → **Report** (show the
   reason list) → back → on the **second** friend's card, **Block** (show the
   confirmation). Block removes that person from the friend list, so either seed
   two friends and block the spare, or unblock afterwards — the demo account must
   still have a friend and a chat thread when the reviewer logs in.
9. Settings → Reminders → turn a daily study reminder **on** and save → the iOS
   notification permission prompt appears. (That is the code path that requests
   it: `reminder-settings.tsx` → `syncStudyReminders` → permission request.)
10. **Do not delete the demo account.** Sign out → tap **Sign up** and register a
    brand-new throwaway account with a fresh email → land on Home → Settings →
    Delete account → show the confirmation and the signed-out state.
    This single segment covers Apple's "registration, login, and account deletion"
    bullet and leaves the demo account intact for the reviewer.
