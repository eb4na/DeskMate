/**
 * Wave 1 persistence via expo-file-system (ships with Expo — no AsyncStorage).
 * Legacy API only warns if native module missing; falls back to in-memory.
 */

import * as FileSystem from 'expo-file-system/legacy';

type StorageBackend = 'file' | 'memory';
const LEGACY_STORAGE_KEY = 'state';

let backend: StorageBackend | null = null;
const memoryStore = new Map<string, string>();

function sanitizeStorageKey(key: string) {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function statePath(key = LEGACY_STORAGE_KEY): string | null {
  const dir = FileSystem.documentDirectory;
  if (!dir) return null;
  if (key === LEGACY_STORAGE_KEY) {
    return `${dir}deskmate_w1_state.json`;
  }
  return `${dir}deskmate_${sanitizeStorageKey(key)}.json`;
}

function resolveBackend(): StorageBackend {
  if (backend !== null) return backend;

  const path = statePath(LEGACY_STORAGE_KEY);
  backend = path ? 'file' : 'memory';
  return backend;
}

export async function loadPersistedState<T>(key = LEGACY_STORAGE_KEY): Promise<T | null> {
  const mode = resolveBackend();

  try {
    if (mode === 'file') {
      const path = statePath(key)!;
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;
      const raw = await FileSystem.readAsStringAsync(path);
      return JSON.parse(raw) as T;
    }

    const raw = memoryStore.get(key) ?? null;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function savePersistedState<T>(value: T, key = LEGACY_STORAGE_KEY): Promise<void> {
  const mode = resolveBackend();
  const json = JSON.stringify(value);

  try {
    if (mode === 'file') {
      const path = statePath(key)!;
      await FileSystem.writeAsStringAsync(path, json);
      return;
    }

    memoryStore.set(key, json);
  } catch {
    // Persistence failed; in-memory state still works for this session.
  }
}

export function getStorageBackend(): StorageBackend {
  return resolveBackend();
}
