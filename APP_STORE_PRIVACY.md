# Memobun — App Store Connect "App Privacy" cheat‑sheet

A guide for filling out **App Store Connect → your app → App Privacy**, based on
what Memobun actually collects. Pair this with `PRIVACY_POLICY.md` (host it and
paste the URL into the fields described at the bottom).

> Apple asks, for each data type: *Is it collected? Is it linked to the user's
> identity? Is it used to track the user? What's the purpose?* Memobun does **not
> track** users (no ads, no cross‑app/website tracking, no analytics SDKs), so
> answer **"No"** to tracking for every type.

## Data types to declare as **collected**

| Apple data type | Specifics | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| **Contact Info → Email Address** | Account email (email sign‑up or Google sign‑in) | **Yes** (linked) | No | App Functionality |
| **User Content → Customer Support / Other User Content** | Direct messages, tasks/exams/mood notes, profile text (display name, description), and AI chat/image prompts you submit | **Yes** (linked) | No | App Functionality |
| **Identifiers → User ID** | Account ID + friend code; randomly generated device ID (single active session) | **Yes** (linked) | No | App Functionality |
| **Usage Data → Product Interaction** | In‑app progress/study stats synced to your account (streaks, minutes, sessions) | **Yes** (linked) | No | App Functionality |

Notes:
- **Birthday** is optional profile info — if you want to be thorough you can also
  declare **Sensitive Info? No**; treat the optional birthday under
  *User Content / Other* (App Functionality, Linked). It's optional and
  user‑entered.
- The email purpose is purely **App Functionality** (account/auth), not marketing.

## Data types to declare as **NOT collected**
- **Health & Fitness** — none.
- **Financial Info** — none. *(In‑app purchases for "Plus" are handled by Apple;
  the current build's upgrade is a mock with no real payment — see the in‑app
  disclaimer.)*
- **Location** — none (no location permission).
- **Contacts** — none.
- **Browsing History / Search History** — none.
- **Diagnostics / Analytics** — **none** (no analytics or crash‑reporting SDKs).
- **Advertising Data / Identifiers (IDFA)** — none (no ads).
- **Photos, Camera, Microphone** — none.

## Tracking
- **"Do you or your third‑party partners use data for tracking?" → No.**
  No advertising, no data brokers, no cross‑app tracking. (You do **not** need
  App Tracking Transparency / `NSUserTrackingUsageDescription`.)

## Third parties / sub‑processors (for your reference)
Data is processed by: **Supabase** (auth, database, storage, realtime), **OpenAI**
(optional AI chat + image generation), **remove.bg** (image background removal),
**Apple/Google** (sign‑in, distribution), **Expo** (build/runtime). These are
service providers that process data to run the app — not tracking partners.

## Required URLs in App Store Connect
1. **Privacy Policy URL** — host `PRIVACY_POLICY.md` somewhere public and paste
   the link. Free options until you have a domain:
   - **GitHub Pages** (push this repo's doc and enable Pages), or
   - a public **Notion** page, or
   - a Google Site / simple static host.
   When you get a domain (e.g. memobun.app), use `https://memobun.app/privacy`.
2. **Support URL** — a page (or even a Notion page) with a way to contact support;
   you can point it at the same site and list **memobunsupport@gmail.com**.

## Other submission reminders
- The "Plus" upgrade is currently a **mock** (no real payment). Keep the in‑app
  disclaimer until real in‑app purchases are wired, and don't market it as a paid
  feature in the listing until then — Apple reviewers will test it.
- Make sure the contact email **memobunsupport@gmail.com** is monitored, since
  it's the privacy + support contact.
