// Baked tablet-only move/resize overrides for buttons and image assets, keyed by
// "screen.element". These are applied ONLY on tablet-class devices (see
// useIsTablet) and never on phones. A missing key resolves to identity (x:0,
// y:0, scale:1) — so an element that hasn't been dialed yet renders exactly as
// before. Values are authored live in the 🎛 design-knobs panel; paste the
// "Get code" string and the matching entry is filled in here.
//
// Format per element: { x?, y?, scale? }
//   x / y  — translate in points (− = left / up)
//   scale  — size multiplier (1 = unchanged)

export type TabletTweak = { x?: number; y?: number; scale?: number };

export const TABLET_TWEAKS: Record<string, TabletTweak> = {
  // e.g. 'breakgame.backBtn': { x: 0, y: -8, scale: 1.1 },
  'studysession.desk': { y: 31 }, // nudge the desk down on tablet
};
