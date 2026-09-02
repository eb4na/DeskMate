# Memobun — App Store Connect "App Privacy" cheat‑sheet

A guide for filling out **App Store Connect → your app → App Privacy**, based on
what Memobun actually collects.

> **Updated July 27, 2026.** The previous version of this file predated the ads
> and analytics work and told you to answer "No" to tracking and to declare no
> analytics/advertising data. That is no longer true — following it would have
> produced a **false privacy label.** Ads (AdMob), analytics (PostHog), and real
> in‑app purchases (RevenueCat) are all live in the shipped build.

Canonical policy text lives in **`src/constants/legal.ts`** (in‑app, 7 languages)
and **`website/privacy.html`** (the public copy at
`https://memobun.app/privacy.html`). Keep all three in sync — this file, those
two, and the Play Data safety form.

## Data types to declare as **collected**

| Apple data type | Specifics | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| **Contact Info → Email Address** | Account email (email sign‑up or Google sign‑in) | **Yes** | No | App Functionality |
| **User Content → Other User Content** | Direct messages, tasks/exams/mood notes, profile text (display name, description) | **Yes** | No | App Functionality |
| **Identifiers → User ID** | Account ID + friend code; randomly generated device ID (single active session) | **Yes** | No | App Functionality, Analytics |
| **Identifiers → Device ID** | **Advertising identifier (IDFA/GAID)** via Google AdMob, when the user allows tracking | No | **Yes** | Third‑Party Advertising |
| **Usage Data → Product Interaction** | PostHog events (session completed, shop purchase, ad reward, chat opened), app lifecycle, device/OS/app version, coarse IP‑derived location | **Yes** | No | Analytics, App Functionality |
| **Usage Data → Advertising Data** | Ad impressions/completions reported by AdMob | No | **Yes** | Third‑Party Advertising |
| **Purchases → Purchase History** | Coin packs and Memobun Plus subscription, via Apple IAP + RevenueCat | **Yes** | No | App Functionality |

Notes:
- **Date of birth is NOT collected.** App Review rejected the old onboarding DOB
  wheel under guideline 5.1.1(v); the gate now only asks the user to affirm they
  meet the 13+ minimum, and stores nothing. Any DOB from older installs is purged
  on launch. Do **not** declare a date of birth.
- **Optional birthday** (month + day only, added in Settings for the yearly
  reward) stays covered by the existing *User Content → Other User Content* row —
  no separate data type, and no checkbox change is needed for it.
- The email purpose is **App Functionality** (account/auth), not marketing.
- The two advertising rows are the ones that changed. If you ever ship a build
  with ads removed, revisit them — don't leave them declared out of caution, an
  over‑declaration is also inaccurate.

## Data types to declare as **NOT collected**
- **Health & Fitness** — none.
- **Financial Info** — none. *(Payment details are handled entirely by Apple; we
  never see card data. Purchase **history** is declared above.)*
- **Location** — none precise. Coarse country/city is inferred from IP by
  PostHog; declare under *Usage Data*, not *Location*, since we request no
  location permission.
- **Contacts** — none.
- **Browsing History / Search History** — none.
- **Diagnostics** — none (no crash‑reporting SDK). PostHog is product analytics,
  declared as *Usage Data → Product Interaction*.
- **Photos, Camera, Microphone** — none.

## Tracking
- **"Do you or your third‑party partners use data for tracking?" → Yes.**
  Google AdMob serves rewarded video ads. Ads are non‑personalized by default;
  when the user grants App Tracking Transparency, the advertising identifier is
  used for personalized ads, which is tracking under Apple's definition.
- **App Tracking Transparency is required and is implemented.** See
  `src/lib/ads.ts` (`requestTrackingPermissionsAsync`) and the
  `userTrackingPermission` string in `app.json`. Apple will reject a build that
  accesses the IDFA without the prompt.

## Third parties / sub‑processors
| Provider | Role |
|---|---|
| **Supabase** | Auth, database, storage, realtime |
| **PostHog** | Product analytics (US servers) |
| **Google AdMob** | Rewarded video ads; advertising identifiers |
| **RevenueCat** | In‑app purchase / subscription validation |
| **Apple / Google** | Sign‑in, distribution, payments |
| **Expo** | Build/runtime infrastructure |

## Required URLs in App Store Connect
1. **Privacy Policy URL** — `https://memobun.app/privacy.html`
   (source: `website/privacy.html`, deployed with `wrangler pages deploy`).
   Redeploy the site whenever the policy changes, or the hosted copy will
   contradict your privacy label.
2. **Support URL** — a page with a contact route; **memobunsupport@gmail.com**.

## Other submission reminders
- **Memobun Plus is a real, charging subscription** (RevenueCat + Apple IAP), not
  a mock. The old "keep the mock disclaimer" note here is obsolete.
- Age rating: the app is **13+**, and it serves ads. Ads plus a teen audience
  draws extra scrutiny on both stores — make sure the ad content rating in AdMob
  is set appropriately.
- Make sure **memobunsupport@gmail.com** is monitored; it is the privacy and
  support contact.
