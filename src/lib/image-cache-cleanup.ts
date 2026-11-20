import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';

const PURGE_KEY = 'memobun.imageDiskCachePurge.v1';

/**
 * One-time storage cleanup (2026-11). Before the expo-image patch that stops
 * disk-caching bundled (file://) images, every in-app image the player saw was
 * copied into Library/Caches: up to a few hundred MB that iOS counts as the app's
 * "Documents & Data". Clear that disk cache once; the patch keeps it from refilling.
 * Remote images (custom companion art) simply re-download on their next view.
 */
export async function purgeLegacyImageDiskCacheOnce(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(PURGE_KEY)) return;
    await ExpoImage.clearDiskCache();
    await AsyncStorage.setItem(PURGE_KEY, '1');
  } catch {
    // Best effort: it retries on the next launch.
  }
}
