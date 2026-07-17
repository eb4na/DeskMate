// The showPopup() card as a transparentModal ROUTE. PopupHost pushes this instead
// of presenting its root <Modal> whenever the focused route is itself modal-
// presented (sheet / fullScreenModal / …): a root <Modal> cannot legally present
// then — iOS silently drops it or wedges — but the navigation stack serializes
// native presentations, so this route shows safely on top of ANY screen depth.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { getCurrentPopup, setPopupRouteActive, subscribePopup, type PopupButton } from '@/lib/popup';
import { noteModalTransition } from '@/lib/modal-traffic';
import { PopupCard } from '@/components/popup-card';

export default function PopupRoute() {
  // Mounts right after a showPopup(), so the config is already waiting. A further
  // showPopup while we're up replaces the card in place via the subscription.
  const [config, setConfig] = useState(getCurrentPopup());
  useEffect(() => subscribePopup(setConfig), []);

  // Register with the popup plumbing (so showPopup updates us instead of pushing a
  // second route) and stamp the anti-freeze signal on mount/unmount so native
  // <Modal> presenters wait out our transitions like any other modal's.
  useEffect(() => {
    setPopupRouteActive(true);
    noteModalTransition();
    return () => {
      setPopupRouteActive(false);
      noteModalTransition();
    };
  }, []);

  // Dismiss the route first, then run the handler — mirrors PopupHost, so a handler
  // that opens another popup pushes a fresh one rather than updating a dying route
  // (setPopupRouteActive(false) eagerly, before the handler can call showPopup).
  const press = (btn: PopupButton | null) => {
    const cb = btn?.onPress;
    setPopupRouteActive(false);
    if (router.canGoBack()) router.back();
    cb?.();
  };

  // Fail-safe: mounted with nothing to show (e.g. a stray deep link) — leave.
  useEffect(() => {
    if (!config && router.canGoBack()) router.back();
  }, [config]);
  if (!config) return null;

  return (
    <View style={{ flex: 1 }}>
      <PopupCard config={config} onPress={press} />
    </View>
  );
}
