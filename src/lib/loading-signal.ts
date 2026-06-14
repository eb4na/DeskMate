// A tiny pub-sub so any screen can re-show the app's loading overlay (e.g. after
// finishing a study session, or after dropping the ingredients to begin a
// session). RootNavigator owns the loading state and listens.
//
// An optional `onDone` can be passed to showLoadingScreen — RootNavigator runs it
// once the loading screen finishes (used to start the study timer only after the
// loading screen has played).

const _listeners = new Set<() => void>();
let _onDone: (() => void) | null = null;

export function showLoadingScreen(onDone?: () => void) {
  _onDone = onDone ?? null;
  _listeners.forEach((fn) => fn());
}

// Called by RootNavigator when the loading screen completes; returns and clears
// any pending onDone callback so it runs exactly once.
export function takeLoadingDone(): (() => void) | null {
  const fn = _onDone;
  _onDone = null;
  return fn;
}

export function subscribeLoadingScreen(fn: () => void): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}
