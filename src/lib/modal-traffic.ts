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

import { useEffect, useState } from 'react';

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

/**
 * Hook: gate a native <Modal>'s visibility through the global settle window so it can
 * NEVER present while another modal is still opening/closing (the iOS double-present
 * freeze). Pass the visibility you WANT; get back the visibility that is SAFE to apply.
 *
 * This is the PRESENTER half of the guard — until now only PopupHost waited like this,
 * inline; every other modal merely reported, so anything that presented on top of a
 * transitioning modal (e.g. a realtime invite arriving while a popup was open, on any
 * screen) could wedge the screen. Use this for any modal that PRESENTS on its own; it
 * also reports its own open/close, so don't ALSO call useReportModalTransition.
 *
 * When `want` turns true it waits out msUntilModalSafe(), re-checking on each wake in
 * case another modal moved meanwhile; turning `want` off hides at once. Pure timer —
 * it can never wedge (worst case the modal appears a few hundred ms late).
 */
export function useModalSafeVisible(want: boolean): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!want) {
      setShow(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tryShow = () => {
      const wait = msUntilModalSafe();
      if (wait <= 0) setShow(true);
      else timer = setTimeout(tryShow, wait);
    };
    tryShow();
    return () => { if (timer) clearTimeout(timer); };
  }, [want]);
  // Report our own open/close so OTHER presenters likewise wait us out.
  useReportModalTransition(show);
  return show;
}
