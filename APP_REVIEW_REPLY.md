# App Review reply — Memobun (com.sophialin.memobun)

Paste the block below into **App Store Connect → App Review Information → Notes**,
and send the same text as the **Resolution Center** reply with the screen recording
attached. Answers are numbered to match Apple's request.

Before sending:
  * fill in the demo account email + password (item 4)
  * confirm your iPhone's iOS version (Settings > General > About) and correct the
    numbers in item 2; delete any line for a device you did not actually test on

---

```
Thank you for the review. Answers to each point below.

1. SCREEN RECORDING
A screen recording captured on a physical iPhone running the latest iOS is
attached. It starts from tapping the app icon and covers, in one take: the
Privacy Policy and Terms consent, the 13+ age confirmation, choosing a starter
companion, signing in, a full study session with its coin payout, the shop and a
cosmetic purchase, the coin-pack in-app purchase sheet, the rewarded-video option,
the Memobun Plus subscription page (price, renewal terms, Terms/Privacy links and
Restore Purchases), the Friends list with direct messages and the Report and Block
controls, the notification permission prompt, and finally registering a new account
and deleting it.

2. DEVICES AND OPERATING SYSTEMS TESTED
- iPhone 13, iOS 26.5 (physical device, tested via TestFlight, build 33)
- iPhone 17, iOS 26.5 (Xcode Simulator)
- iPad Pro 13-inch (M4), iPadOS 26.5 (Xcode Simulator)

3. WHAT THE APP DOES, AND FOR WHOM
Memobun is a cozy study-focus timer for students. The user picks a companion
character, sets a duration and subject, and studies; the character studies
alongside them at a desk for that time. Finishing a session pays one Focus Coin
per minute studied — ending early pays nothing, which is a deliberate design
choice that makes the last stretch of a session easier to sit through. Coins buy
purely cosmetic items: companions, outfits, rooms, desks and ambient sound packs.
Around that loop sit study tools — a task list, exam countdowns, a subject
manager, weekly reports charting study time by subject and mood, and a daily
streak with optional reminders. Friends can run timers together in real time, and
Study Buddy pairs a user with an anonymous accountability partner in their own age
band for one week.

Target audience: students aged 13 and older (the app asks the user to confirm they
are 13+ at first launch; no date of birth is collected), particularly high-school
and university students who study alone.

Problem solved: starting a study session and staying consistent is hard when
studying alone. Value: the app lowers the cost of starting, and gives visible,
cumulative credit for effort already spent.

4. SETUP AND ACCESS INSTRUCTIONS
Demo account — email: FILL IN   password: FILL IN
This account already has a friend and an existing chat thread, so the Report and
Block flows can be reached immediately: Friends tab -> tap the friend's card ->
Report / Block.

An account is NOT required. The sign-in screen has "Continue as guest" and the
entire study loop works without signing in. An account is only needed for Friends,
direct messages, Study Buddy and Memobun Plus; each of those shows a "create an
account" prompt in guest mode.

To reach the main features:
a. Launch -> accept Privacy Policy and Terms -> confirm you are at least 13.
b. Choose one of five starter companions (free).
c. Sign in with the demo account above, or tap "Continue as guest".
d. Home -> "Start Session" -> pick a duration and optional subject -> the session
   starts. Let it run to completion to see the coin payout.
e. Shop tab -> buy a cosmetic with coins. "Get more coins" -> coin packs (in-app
   purchase) and an optional rewarded video (+100 coins, up to 3 per day).
f. Memobun Plus: Shop or Settings -> Memobun Plus. Monthly USD 4.99 and Yearly
   USD 39.99, auto-renewing. The title, length and price of each option, the
   renewal disclosure, links to the Terms of Use and Privacy Policy, and Restore
   Purchases are all on that one screen.
g. Friends tab -> friend list, add by friend code, direct messages, and Report /
   Block on a friend's card. Study Buddy pairs the user with an anonymous partner
   in their age band — no names, no free-text chat, only canned check-in messages.
h. Settings -> Delete account permanently deletes the account and its data. Also
   in Settings: language, reminders, legal documents, and support contact
   memobunsupport@gmail.com.

Permission prompts: the only system permission the app ever requests is
Notifications, for optional study reminders and streak nudges (Settings ->
Reminders). The app does not use camera, photos, microphone, location or contacts,
does not track users, and shows no App Tracking Transparency prompt
(NSPrivacyTracking is false).

5. EXTERNAL SERVICES USED
- Supabase — accounts, database, progress sync, friends, direct messages, and
  realtime multiplayer study rooms.
- Sign in with Apple — optional sign-in.
- Google Sign-In — optional sign-in.
- RevenueCat — in-app purchase and subscription entitlement handling.
- Google AdMob — the optional rewarded video only; non-personalized ads, no ATT
  prompt, no third-party ad tracking.
- PostHog — aggregate product analytics (screen and feature usage). No tracking
  across other companies' apps or websites.
- Spotify Web API — optional. The user connects their own Spotify Premium account
  to control playback of their own music while studying.
The app uses NO artificial-intelligence services and generates no AI content.

6. REGIONAL DIFFERENCES
The app functions consistently across all regions. The interface is localized in
seven languages (English, Simplified Chinese, Traditional Chinese, Japanese,
Korean, Spanish, French) and follows the device language. In-app purchase prices
are localized by the App Store. The only availability difference is the optional
Spotify integration, which requires the user's own Spotify Premium account and is
unavailable in territories where Spotify does not operate. Every other feature
works normally without it.

7. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
The app does not operate in a regulated industry. All artwork, characters, written
content and audio are original and owned by the developer. The only third-party
material is Spotify: the app uses the public Spotify Web API under Spotify's
Developer Terms of Service, the user authorizes their own Spotify account by OAuth,
all playback happens in Spotify's own app, and Memobun only displays the currently
playing track name and album art returned by the API. No media is stored,
redistributed or rebroadcast.

ADDITIONAL — USER-GENERATED CONTENT SAFEGUARDS
- Direct messages are only possible between mutual friends; blocked users are
  filtered out server-side.
- Report and Block are available on every friend's card. Blocking removes the
  friend and hides them everywhere. Study Buddy has its own Report, which ends the
  match immediately.
- A profanity filter masks bad words in chat and blocks them outright in
  user-entered subject and task names.
- Abuse/support contact: memobunsupport@gmail.com (also shown in Settings).
- The Terms of Use (EULA) and Privacy Policy are presented before first use and
  are available in Settings -> Legal. The policy is also hosted at
  https://memobun.app/privacy.html
```
