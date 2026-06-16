import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';

import { loadPersistedState, savePersistedState } from '@/lib/storage';

const GUEST_SCOPE: AppStateScope = { kind: 'guest', storageKey: 'guest_state' };

// Set when a guest taps "connect Google" to become a real account. It survives
// the OAuth browser round-trip so app-context can migrate the guest's progress
// into the new account on the next load. See app-context's load effect.
const GUEST_UPGRADE_KEY = 'deskmate.pendingGuestUpgrade';

export function markGuestUpgradePending(): Promise<void> {
  return AsyncStorage.setItem(GUEST_UPGRADE_KEY, 'true').catch(() => {});
}

export async function isGuestUpgradePending(): Promise<boolean> {
  return (await AsyncStorage.getItem(GUEST_UPGRADE_KEY).catch(() => null)) === 'true';
}

export function clearGuestUpgradePending(): Promise<void> {
  return AsyncStorage.removeItem(GUEST_UPGRADE_KEY).catch(() => {});
}

// The guest's locally-saved progress, used to seed a brand-new account on upgrade.
export function loadGuestState<T>(): Promise<T | null> {
  return loadScopedAppState<T>(GUEST_SCOPE);
}

export type AppStateScope =
  | { kind: 'guest'; storageKey: 'guest_state' }
  | { kind: 'user'; storageKey: string; userId: string };

export function getAppStateScope(session: Session | null): AppStateScope {
  if (session?.user.id) {
    return {
      kind: 'user',
      storageKey: `user_state_${session.user.id}`,
      userId: session.user.id,
    };
  }

  return { kind: 'guest', storageKey: 'guest_state' };
}

export async function loadScopedAppState<T>(scope: AppStateScope): Promise<T | null> {
  const scoped = await loadPersistedState<T>(scope.storageKey);
  if (scoped) {
    return scoped;
  }

  // Fall back to the legacy single-file store so existing installs keep their data
  // while we stage user-specific persistence.
  return loadPersistedState<T>();
}

export function saveScopedAppState<T>(scope: AppStateScope, value: T): Promise<void> {
  return savePersistedState(value, scope.storageKey);
}
