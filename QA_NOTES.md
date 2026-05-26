# Memobun Phase QA Notes

## Phase 1: Visible reward loop
- What changed: shop purchases now auto-equip visible cosmetics, owned items can be re-equipped, companion room visuals react to active themes/outfits/poses/decor, reminder styles show up in reminder UI, and break-game unlocks show clearer shop/Plus feedback.
- Checks: targeted lints on touched files, clean `npx tsc --noEmit`.
- Still risky: cosmetic visuals are UI-layer effects built on the two starter companion images rather than new art assets.

## Phase 2: Real reminders and break extras
- What changed: local device reminders are scheduled with `expo-notifications`, reminder settings now request permission and sync scheduled notifications, break presets were added to app state, custom timers now support both focus and break modes, and session-complete can launch saved/custom break lengths.
- Checks: targeted lints on touched files, clean `npx tsc --noEmit`.
- Still risky: scheduled reminder behavior is device/runtime dependent and should be smoke-tested on a real simulator/device after reinstall or notification permission changes.

## Phase 3: Account/access polish
- What changed: guest mode is clearer on login, verification/resend screens now offer a guest fallback, and leaving guest mode/signing out routes back to login explicitly.
- Checks: targeted lints on touched files, clean `npx tsc --noEmit`.
- Still risky: Supabase email delivery still depends on dashboard template/SMTP setup outside the app code.

## Phase 4: User-linked sync staging
- What changed: app persistence now has a storage repository seam, local state is scoped per guest vs signed-in user, legacy single-file data is used as a fallback migration path, and the root layout waits for the correct scoped state before rendering.
- Checks: targeted lints on touched files, clean `npx tsc --noEmit`.
- Still risky: this is still local-first storage, not remote sync or conflict resolution yet.

## Deferred Infrastructure
- Real SMTP/domain hardening, payment wiring, and real subscription entitlements remain intentionally deferred.
- Existing coin packs and Plus flows are still mock/local behavior by design.

## Repo-wide note
- `npm run lint` now has Expo ESLint configured, but there are unrelated pre-existing lint issues outside the files changed in this implementation pass.
