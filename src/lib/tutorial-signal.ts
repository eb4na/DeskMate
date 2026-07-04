// Tiny pub/sub so the Home screen can decide WHEN the first-launch coachmark
// should show, while the overlay itself is PAINTED from a root-mounted portal
// (src/components/home-tutorial.tsx → TutorialPortal). The tab bar is rendered by
// the Tabs navigator as a sibling that paints on top of every tab screen, so a
// tutorial mounted inside Home can never rise above it (its tasks/shop step cards
// would hide behind the bar). Publishing a boolean and rendering the overlay at
// the root — a sibling of the whole navigator — lets it paint over the tab bar.
type Listener = (visible: boolean) => void;

let visible = false;
const listeners = new Set<Listener>();

export function setTutorialVisible(v: boolean) {
  if (v === visible) return;
  visible = v;
  listeners.forEach((fn) => fn(v));
}

export function subscribeTutorialVisible(fn: Listener) {
  listeners.add(fn);
  fn(visible);
  return () => {
    listeners.delete(fn);
  };
}
