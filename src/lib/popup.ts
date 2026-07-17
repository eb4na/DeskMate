// A drop-in, on-brand replacement for React Native's native `Alert.alert`. The
// signature matches `Alert.alert(title, message?, buttons?)` exactly, so call
// sites only swap the function name. A single <PopupHost> (mounted at the root)
// subscribes and renders the styled popup, so the system alert is never seen.
//
// Imperative + pub-sub (mirrors src/lib/loading-signal.ts) so it works anywhere,
// including non-component code.

export type PopupButtonStyle = 'default' | 'cancel' | 'destructive';

export type PopupButton = {
  text: string;
  onPress?: () => void;
  style?: PopupButtonStyle;
};

export type PopupConfig = {
  title: string;
  message?: string;
  buttons?: PopupButton[];
};

const _listeners = new Set<(cfg: PopupConfig) => void>();

// The most recent config, kept so the /popup ROUTE (see popup-host.tsx: popups fired
// while a modal-presented screen is on top are pushed as a transparentModal route,
// which iOS presents safely at any depth) can read it on mount. Never cleared — the
// route only mounts right after a showPopup, so staleness is unobservable.
let _current: PopupConfig | null = null;
export function getCurrentPopup(): PopupConfig | null {
  return _current;
}

// True while the /popup route is mounted — a new showPopup then updates it in place
// (via the subscription) instead of pushing a second copy. The route clears this
// eagerly when a button dismisses it, so a chained popup from a button handler
// takes the fresh-push path rather than updating a dismissing route.
let _routeActive = false;
export function setPopupRouteActive(active: boolean): void {
  _routeActive = active;
}
export function isPopupRouteActive(): boolean {
  return _routeActive;
}

/** Show the custom popup. Same arg order as Alert.alert(title, message, buttons). */
export function showPopup(title: string, message?: string, buttons?: PopupButton[]): void {
  const cfg: PopupConfig = { title, message, buttons };
  _current = cfg;
  _listeners.forEach((fn) => fn(cfg));
}

export function subscribePopup(fn: (cfg: PopupConfig) => void): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}
