---
name: verify
description: Build, launch, and drive Memobun on the iOS simulator to verify a change end-to-end (screenshots as evidence).
---

# Verifying Memobun on the iOS Simulator

## Build + launch
1. Metro (new files need a cache clear): `npx expo start -c --port 8081` (kill any stale Metro on 8081 first: `lsof -ti :8081 | xargs kill`).
2. If the installed dev client predates a native module (red "Cannot find native module" screen): `npx expo run:ios --no-bundler` (~6 min; installs `com.sophialin.memobun` on the booted sim and opens it against the running Metro). An old `com.anonymous.DeskMate` install may exist — ignore it, the real app is Memobun.app.
3. Screenshots: `xcrun simctl io booted screenshot out.png`.

## Driving the UI (no idb/maestro on this machine)
- Get the device-screen rect inside the Simulator window:
  `osascript -e 'tell application "System Events" to tell process "Simulator" to get {position, size} of group 1 of window 1'`
  (e.g. `1266, 114, 400, 871` for an iPhone 17 Pro at 402×874pt → map app-point (x,y) → global (1266 + x·400/402, 114 + y·871/874)).
- Tap/drag by posting Quartz mouse events from python3 (`import Quartz`, `CGEventCreateMouseEvent` + `CGEventPost`), after `osascript … activate` + ~0.5s. AppleScript `click at` is flaky — use Quartz. Drags need a hover first, mouse-down ≥0.3s, ~30 interpolated move steps.
- **Screenshot between every tap.** Blind tap chains derail.

## Gotchas that WILL bite
- **Invisible tab-bar strip:** `CustomTabBar` is `position:absolute, bottom:-16, height:232, justifyContent:flex-end` — its transparent top (~pt y 658–748) overlays tab-screen content. On DEEP-LINKED routes the bar can steal taps aimed at bottom buttons; the same buttons work when the route is pushed in-app. So navigate in-app (tap Home's Start Session), don't `openurl` to `deskmate://session-picker`, when you need the bottom CTA.
- **Expo dev menu / element inspector:** synthetic input sometimes pops the dev menu; the element inspector then eats ALL taps while showing normal UI. If taps mysteriously do nothing or navigate wrong, screenshot — if you see "Tap something to inspect it"/Inspect bar, open the menu (⌘D via `osascript keystroke "d" using command down`) and hit "Toggle element inspector".
- **Draggable overlays:** the ⚙️ design-knobs FAB and the settings gear float over content and move when dragged; a stray tap can open Settings (one session accidentally switched the app language to Chinese — restore via `deskmate://language-picker`).
- **Synthetic clicks can die machine-wide mid-session** (2026-07-05): Quartz AND AppleScript clicks stop registering ANYWHERE in the Simulator — even the Expo dev menu ignores them — while keyboard (⌘D, `r`), scroll-drags, and `openurl` deep links keep working. Checks that did NOT fix it: clickState field, HID event source, stuck-button clear, Simulator.app restart, AXPress. Also check for a stale macOS **Screenshot overlay window** eating clicks (`CGWindowListCopyWindowInfo`, owner "Screenshot", layer 24 — dismiss with Escape). If clicks still don't land after a Simulator restart, STOP burning time: verify what deep links + screenshots can reach and hand the tap-through to Sophia (a Mac reboot / real mouse click likely clears it).
- **Typing via `osascript keystroke` without a focused TextInput reloads the app** — any `r` in the string is the RN reload key. Only type after a screenshot proves the keyboard/caret is up; otherwise skip naming fields (labels default fine).
- Test account on the sim: maruyamaaya162007@gmail.com (owns Bun/Bunny/Miel).

## Driving a solo study session (where StudyRoomView renders)
Home "Start Session" (~pt 175,640) → duration picker "Start Session →" (~200,767) → mood screen "Skip and start session" (~200,808) → bake mini-game: drag flour (151,544), butter (239,544), berries (333,546) into the mixer (~323,485) → ~10s load → study room. End without payout: "End session" (~200,812) → "Stop" (~200,475).
Companion switch: round swap FAB (~46,317) → "Set Active" on a card (sheet auto-closes).
