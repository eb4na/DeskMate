import type { Session } from '@supabase/supabase-js';

import { loadPersistedState, savePersistedState } from '@/lib/storage';

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
