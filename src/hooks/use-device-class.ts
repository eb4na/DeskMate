import { useSyncExternalStore } from 'react';
import { useWindowDimensions } from 'react-native';

// Tablets get their own layout overrides; phones are untouched. We classify by
// the *shortest* screen edge so the result is orientation-independent:
//   - iPad shortest side ≥ 744pt, the largest phones ≤ 430pt → 600 separates them
//   - using min(width,height) avoids the landscape bug where a phone's wide edge
//     ( ~932pt ) reads as a tablet.
const TABLET_MIN_SIDE = 600;

// Dev-only override so the design-knobs panel can preview tablet layout on a
// phone-sized simulator (and vice-versa). The setter is only ever called from
// the __DEV__-gated panel, and useIsTablet ignores it entirely in production.
type ForcedClass = 'phone' | 'tablet' | null;
let forcedClass: ForcedClass = null;
const listeners = new Set<() => void>();

export function setForcedDeviceClass(value: ForcedClass) {
  forcedClass = value;
  listeners.forEach((l) => l());
}

function getForcedClass(): ForcedClass {
  return forcedClass;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Current dev preview override (or null). Single global source of truth so every
 *  mounted panel agrees — avoids one panel's unmount resetting another's choice. */
export function useForcedDeviceClass(): ForcedClass {
  return useSyncExternalStore(subscribe, getForcedClass, getForcedClass);
}

/** True on tablet-class devices. Reactive to rotation and (in dev) to the panel toggle. */
export function useIsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  const forced = useSyncExternalStore(subscribe, getForcedClass, getForcedClass);
  if (__DEV__ && forced) return forced === 'tablet';
  return Math.min(width, height) >= TABLET_MIN_SIDE;
}
