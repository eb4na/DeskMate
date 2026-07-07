// Navigate to a "heavy" screen behind the app's quick loading overlay, preloading
// the destination's images FIRST so it slides in already-warm and its art doesn't
// pop in one-by-one.
//
// Usage:
//   navigateWithLoading(() => router.push('/session-picker'), { assets: SESSION_PICKER_ASSETS });
//
// The overlay shows over the SOURCE screen while we preload (Asset.loadAsync for
// local require()s, ExpoImage.prefetch for remote {uri}s); only once everything is
// cached do we run `navigate()`, so the destination is fully drawn on first frame.
// Preloading before navigating (rather than mounting behind the overlay) means we
// don't depend on the overlay z-ordering above native fullScreenModal screens.
// A failed/slow image never hangs the loader (errors are swallowed), and there's a
// short minimum hold so it never flickers.

import { Asset } from 'expo-asset';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';

import { showLoadingScreen } from '@/lib/loading-signal';

// Session-length picker art (src/app/session-picker.tsx).
export const SESSION_PICKER_ASSETS = [
  require('@/assets/images/home/session-bg.png'),
  require('@/assets/images/cake/dessert-10.png'),
  require('@/assets/images/cake/dessert-25.png'),
  require('@/assets/images/cake/dessert-50.png'),
  require('@/assets/images/cake/dessert-90.png'),
];

// Multiplayer lobby + study-room art (src/components/study-room-view.tsx).
export const STUDY_ASSETS = [
  require('@/assets/images/study/timer-card.png'),
  require('@/assets/images/study/avatar-frame.png'),
  require('@/assets/images/study/ppl-icon.png'),
  require('@/assets/images/study/break-pill.png'),
  require('@/assets/images/study/game-btn.png'),
  require('@/assets/images/home/desk-new.png'),
  require('@/assets/images/home/study-radio.png'),
  require('@/assets/images/bun/bun-studying.png'),
];

type PreloadOpts = {
  // Local require()'d images (numbers) to warm via expo-asset.
  assets?: number[];
  // Remote image URIs to warm via expo-image's prefetch.
  prefetch?: (string | null | undefined)[];
};

// A companion's imageSource is either a local require() (number) or a remote
// { uri }. Returns the URI to prefetch for the remote case, else null.
export function companionPrefetchUri(source: number | { uri: string } | null | undefined): string | null {
  return source && typeof source === 'object' && typeof source.uri === 'string' ? source.uri : null;
}

// Resolve a job within `ms` no matter what. `.catch()` swallows REJECTIONS but a
// PENDING (hung) ExpoImage.prefetch / Asset.loadAsync never rejects, so Promise.all
// would pend forever and freeze the loader. Racing a timeout guarantees settlement.
function withTimeout(p: Promise<unknown>, ms = 5000): Promise<unknown> {
  return Promise.race([
    Promise.resolve(p).catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, ms)),
  ]);
}

// Warm everything the solo/multiplayer studying view draws (StudyRoomView art +
// the active companion's character image) so the loading screen that plays right
// before studying never lifts onto a half-loaded scene. Per-asset failures are
// swallowed so a slow/broken image can't hang the loader.
export function preloadStudyAssets(
  characterSource?: number | { uri: string } | null,
): Promise<unknown> {
  const jobs: Promise<unknown>[] = [Asset.loadAsync(STUDY_ASSETS)];
  if (typeof characterSource === 'number') jobs.push(Asset.loadAsync(characterSource));
  const uri = companionPrefetchUri(characterSource);
  if (uri) jobs.push(ExpoImage.prefetch(uri));
  // Timeout-wrapped so a hung asset/prefetch can never freeze the loading overlay.
  return Promise.all(jobs.map((p) => withTimeout(p)));
}

export function navigateWithLoading(navigate: () => void, { assets, prefetch }: PreloadOpts = {}) {
  const jobs: Promise<unknown>[] = [];
  if (assets && assets.length) jobs.push(Asset.loadAsync(assets));
  for (const uri of prefetch ?? []) {
    if (uri) jobs.push(ExpoImage.prefetch(uri));
  }
  // Timeout-wrapped so a slow/broken/HUNG image can never hang the overlay.
  const preloaded = Promise.all(jobs.map((p) => withTimeout(p)));
  // Navigate only once assets are cached, so the destination slides in warm. The
  // overlay (over the source screen) lifts right after `navigate()`, by which
  // point the destination renders fully on its first frame.
  const until = preloaded.then(() => {
    // Refresh-under-the-loader: collapse every screen piled up on the stack
    // BEFORE navigating, so the destination sits directly on the tabs root
    // (old screens unmount → less memory/re-render work, and Back/leave from
    // the destination lands home instead of on a stale screen). The overlay
    // covers the whole swap, so the user never sees the intermediate pop.
    // Same canDismiss→dismissAll idiom as subject-picker/use-study-room.
    // Fail-open: a dismiss hiccup must never block the navigation itself.
    try {
      if (router.canDismiss()) router.dismissAll();
    } catch {}
    navigate();
  });

  showLoadingScreen(undefined, { quick: true, until });
}
