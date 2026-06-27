// Global anti-freeze coordination for native <Modal>s.
//
// iOS freezes the whole app if you try to PRESENT a native modal while another one
// is still presenting or mid-dismiss ("attempt to present X while Y is already
// presenting"). Every freeze we've hit has been a variant of that: a popup shown in
// the same instant another modal was closing.
//
// This is the automatic guard. Native modals stamp a timestamp whenever they open or
// close; presenters (chiefly the global popup-host) wait out a short settle window
// after the LAST stamp before presenting, so two modals never transition at once.
//
// It is intentionally just a TIMESTAMP — there is no lock and no counter to get
// stuck, so a missed/duplicated call can never strand a modal permanently invisible.
// Worst case is a popup that appears a few hundred ms late. Fail-open by construction.

import { useEffect } from 'react';

// Roughly the RN Modal fade/slide duration plus a little slack, so the previous
// modal's view controller is fully gone before the next one presents.
export const MODAL_SETTLE_MS = 350;

let lastTransitionAt = 0;

/** Stamp now — call whenever a native modal becomes visible OR hidden. */
export function noteModalTransition() {
  lastTransitionAt = Date.now();
}

/** How long a presenter should wait to avoid colliding with a modal mid-transition. */
export function msUntilModalSafe(): number {
  const elapsed = Date.now() - lastTransitionAt;
  return elapsed >= MODAL_SETTLE_MS ? 0 : MODAL_SETTLE_MS - elapsed;
}

/**
 * Hook: report a modal's visibility transitions to the global signal. Drop one call
 * into any component that renders a native <Modal>, passing its `visible` prop.
 */
export function useReportModalTransition(visible: boolean) {
  useEffect(() => {
    noteModalTransition();
  }, [visible]);
}
