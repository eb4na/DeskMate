// Renders the app's custom popup in place of the native iOS/Android alert.
// Mounted once at the root; listens to showPopup() (src/lib/popup.ts).
//
// TWO presentation paths (the reason is an iOS rule confirmed on-device):
// a root-mounted native <Modal> CANNOT present while a presentation:'modal'
// SCREEN is on top — the root view controller is already presenting, so iOS
// silently drops the popup (or, on some devices, wedges the whole app). So:
//  - top route is a plain screen → present our own root <Modal> (as always);
//  - top route is modal-presented (sheet / fullScreenModal / transparentModal)
//    → push the /popup route instead. The navigation stack serializes native
//    presentations, so that route legally presents on top of ANY screen depth.
// If the /popup route is already up, a new showPopup updates it in place via its
// own subscription — no second push.

import { router, useNavigationContainerRef } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal } from 'react-native';

import { isPopupRouteActive, subscribePopup, type PopupButton, type PopupConfig } from '@/lib/popup';
import { msUntilModalSafe, useReportModalTransition } from '@/lib/modal-traffic';
import { PopupCard } from '@/components/popup-card';

// Route presentations that mean "the root <Modal> cannot legally present right now".
const PRESENTED_MODALLY = new Set(['modal', 'fullScreenModal', 'formSheet', 'containedModal', 'transparentModal']);

export function PopupHost() {
  const [config, setConfig] = useState<PopupConfig | null>(null);
  const navRef = useNavigationContainerRef();

  // Anti-freeze: a popup is itself a native <Modal>, so never present it in the same
  // ~300ms window another modal is opening/closing — that stacks two iOS modals and
  // freezes the app. Wait out the global settle window before showing. Pure delay, so
  // it can never wedge; a popup just appears a touch later if a modal just moved.
  useEffect(
    () =>
      subscribePopup((cfg) => {
        const present = () => {
          // /popup route already up → it updates itself from the subscription.
          if (isPopupRouteActive()) return;
          // Focused route presented modally → root <Modal> would be dropped/wedge;
          // go through the navigation stack instead. Fail-open: if options can't be
          // read (early startup), fall back to the root <Modal> as before.
          const presentation = (navRef?.getCurrentOptions() as { presentation?: string } | undefined)?.presentation;
          if (presentation && PRESENTED_MODALLY.has(presentation)) {
            router.push('/popup');
            return;
          }
          setConfig(cfg);
        };
        const wait = msUntilModalSafe();
        if (wait === 0) present();
        else setTimeout(present, wait);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Report our own open/close so OTHER presenters likewise wait us out.
  useReportModalTransition(config !== null);

  if (!config) return null;

  // Dismiss first, then run the handler — so a handler that opens another popup
  // (e.g. purchase → confirmation) isn't immediately cleared.
  const press = (btn: PopupButton | null) => {
    const cb = btn?.onPress;
    setConfig(null);
    cb?.();
  };

  // Hardware back mirrors the backdrop: run the cancel action if there is one.
  const cancel = (config.buttons ?? []).find((b) => b.style === 'cancel') ?? null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => press(cancel)}>
      <PopupCard config={config} onPress={press} />
    </Modal>
  );
}
