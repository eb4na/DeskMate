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

/** Show the custom popup. Same arg order as Alert.alert(title, message, buttons). */
export function showPopup(title: string, message?: string, buttons?: PopupButton[]): void {
  const cfg: PopupConfig = { title, message, buttons };
  _listeners.forEach((fn) => fn(cfg));
}

export function subscribePopup(fn: (cfg: PopupConfig) => void): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}
