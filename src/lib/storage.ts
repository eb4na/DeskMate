/**
 * Wave 1 persistence via expo-file-system (ships with Expo — no AsyncStorage).
 * Legacy API only warns if native module missing; falls back to in-memory.
 */

import * as FileSystem from 'expo-file-system/legacy';

type StorageBackend = 'file' | 'memory';

let backend: StorageBackend | null = null;
const memoryStore = new Map<string, string>();

function statePath(): string | null {
  const dir = FileSystem.documentDirectory;
  if (!dir) return null;
  return `${dir}deskmate_w1_state.json`;
}

function resolveBackend(): StorageBackend {
  if (backend !== null) return backend;

  const path = statePath();
  backend = path ? 'file' : 'memory';
  return backend;
}

export async function loadPersistedState<T>(): Promise<T | null> {
  const mode = resolveBackend();

  try {
    if (mode === 'file') {
      const path = statePath()!;
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;
      const raw = await FileSystem.readAsStringAsync(path);
      return JSON.parse(raw) as T;
    }

    const raw = memoryStore.get('state') ?? null;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function savePersistedState<T>(value: T): Promise<void> {
  const mode = resolveBackend();
  const json = JSON.stringify(value);

  try {
    if (mode === 'file') {
      const path = statePath()!;
      await FileSystem.writeAsStringAsync(path, json);
      return;
    }

    memoryStore.set('state', json);
  } catch {
    // Persistence failed; in-memory state still works for this session.
  }
}

export function getStorageBackend(): StorageBackend {
  return resolveBackend();
}
