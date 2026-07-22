// A tiny pub-sub so any screen can re-show the app's loading overlay (e.g. after
// finishing a study session, or after dropping the ingredients to begin a
// session). RootNavigator owns the loading state and listens.
//
// An optional `onDone` can be passed to showLoadingScreen — RootNavigator runs it
// once the loading screen finishes (used to start the study timer only after the
// loading screen has played).
//
// `opts.quick` shows a fast, readiness-based loader (short minimum, no forced 3s)
// instead of the launch-style 3s loader. `opts.until` is a promise the overlay
// waits on before lifting — used to preload a destination screen's assets so its
// art doesn't pop in one-by-one. See navigateWithLoading in preload-nav.ts.

export type LoadingOpts = { quick?: boolean; until?: Promise<unknown> };

const _listeners = new Set<(opts: LoadingOpts) => void>();
let _onDone: (() => void) | null = null;

export function showLoadingScreen(onDone?: () => void, opts: LoadingOpts = {}) {
  _onDone = onDone ?? null;
  _listeners.forEach((fn) => fn(opts));
}

// Called by RootNavigator when the loading screen completes; returns and clears
// any pending onDone callback so it runs exactly once.
export function takeLoadingDone(): (() => void) | null {
  const fn = _onDone;
  _onDone = null;
  return fn;
}

export function subscribeLoadingScreen(fn: (opts: LoadingOpts) => void): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}

// ── Loading-overlay visibility, so screens can wait until the user is actually
// looking at the app (not the launch splash) before showing their own popups. ──
let _active = false;
const _doneListeners = new Set<() => void>();

/** RootNavigator mirrors its loading-overlay visibility here. Fires the
 *  done-listeners on every true→false transition (the splash just lifted). */
export function setLoadingActive(visible: boolean) {
  const was = _active;
  _active = visible;
  if (was && !visible) _doneListeners.forEach((fn) => fn());
}

/** True while the loading splash is covering the app. */
export function isLoadingActive(): boolean {
  return _active;
}

/** Fires once each time the loading splash finishes and lifts. */
export function subscribeLoadingDone(fn: () => void): () => void {
  _doneListeners.add(fn);
  return () => {
    _doneListeners.delete(fn);
  };
}

// ── Home first-paint gate ────────────────────────────────────────────────────
// The launch/login loader waits until the home screen's main background image has
// actually PAINTED (its expo-image `onLoad`/`onError` fired), not merely been
// prefetched into cache. Prefetch resolving only means the bytes are cached — the
// on-screen <Image> still decodes and paints a frame or two later, so gating on
// prefetch alone let the room art pop in just after the splash lifted. The home
// screen calls markHomePainted() from its background image; RootNavigator resets
// the flag on each login (fresh home mount) and gates the loader on it. All the
// existing fail-open timers still apply, so a missed paint can never wedge the
// splash — it just falls back to the max-hold cap.
let _homePainted = false;
const _homePaintListeners = new Set<() => void>();

/** Home screen calls this once its background image paints (onLoad/onError). */
export function markHomePainted() {
  if (_homePainted) return;
  _homePainted = true;
  _homePaintListeners.forEach((fn) => fn());
}

/** RootNavigator clears the flag on login so the loader waits for the new paint. */
export function resetHomePainted() {
  _homePainted = false;
}

export function isHomePainted(): boolean {
  return _homePainted;
}

export function subscribeHomePainted(fn: () => void): () => void {
  _homePaintListeners.add(fn);
  return () => {
    _homePaintListeners.delete(fn);
  };
}
