# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Working in this repo

- **Concurrent sessions leave uncommitted work.** The tree usually carries uncommitted PNG art and i18n JSON from other sessions/the IDE. Never `git add -A` / `git checkout` / `git restore` broadly. Commit by explicit pathspec (`git commit -- <files>`), and never revert PNGs or i18n JSON you didn't author.

- **Light mode only.** The app is forced to light mode; dark theme renders badly. Don't restore it.

- **No emojis in the app UI.** Use PNG or code-drawn (react-native-svg) icons. Country flags are the only exception.

# Companion & skin art sizing

Only the **study room** normalizes figure size at render time (`src/lib/figure-height.ts` + generated `FIGURE_METRICS`). The **Home screen, wardrobe picker, and gallery render skin PNGs RAW** (`contentFit:"contain"`, no calibration). So a skin that looks too big/small or sits too high/low on those screens is fixed in the **artwork**, not code:

- **Size by the HEAD, not the silhouette.** Match each skin so the character's face matches the companion's `classic` skin. Measure the **eyes/face** (the outer "head" width is inflated by hats/hair/hoods). Total-height matching makes a tall chef hat shrink the body.
- **Feet aligned.** Place each skin's content bottom at the same Y as `classic` so switching outfits doesn't make the character jump.
- After **any** companion art change, re-run `python3 scripts/measure-figure-heights.py` to regenerate `src/constants/figure-calibration.ts`.

# Legal text (Privacy Policy / Terms)

Localized per app language in `src/constants/legal.ts` via `getLegalDoc(lang)` (English is authoritative; each translation carries an "English governs" note). To change wording, update the English `en` doc **and** all 6 translations.

# Native modules

Adding an `expo-*` (or any native) module needs a **native rebuild** (`npx expo run:ios`); a JS reload cannot link it. A **top-level import** of a module missing from the installed dev-client binary **crashes the whole app on launch**. For optional native features, prefer a lazy `require('expo-x')` at the call site so a stale binary still boots (see `friends.tsx`, `profile.tsx`, `dev-knobs.tsx`).
