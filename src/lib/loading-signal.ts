// A tiny pub-sub so any screen can re-show the app's loading overlay (e.g. after
// finishing a study session). RootNavigator owns the loading state and listens.

const _listeners = new Set<() => void>();

export function showLoadingScreen() {
  _listeners.forEach((fn) => fn());
}

export function subscribeLoadingScreen(fn: () => void): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}
