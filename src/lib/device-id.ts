// A stable per-install id used to enforce a single active session per account.
// Generated once and persisted, so the same physical device re-claims its
// session on relaunch (rather than kicking itself off).

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'deskmate.deviceId';

let cached: string | null = null;

function generateId(): string {
  // Dependency-free random id — expo-crypto isn't installed and we only need
  // uniqueness across a user's own devices, not cryptographic strength.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

/** Read (or create-and-persist) this device's stable id. */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
  } catch {
    // fall through to generate a fresh one
  }
  const id = generateId();
  cached = id;
  AsyncStorage.setItem(DEVICE_ID_KEY, id).catch(() => {});
  return id;
}
