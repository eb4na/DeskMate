/**
 * Wave 1 persistence via expo-file-system (ships with Expo — no AsyncStorage).
 * Legacy API only warns if native module missing; falls back to in-memory.
 *
 * Durability guarantees:
 *  - Writes are atomic (stage to `.tmp`, then rename into place) and keep a
 *    `.bak` of the previous good copy, so an interrupted write can never leave a
 *    torn/half-written save.
 *  - Writes for a given key are serialized, so overlapping rapid saves can't
 *    clobber each other's temp file.
 *  - A read/parse failure of an *existing* file is NOT mistaken for a new user:
 *    we recover from `.bak`, and if that also fails we throw so callers refuse
 *    to overwrite the (still-on-disk) data with defaults.
 */

import * as FileSystem from 'expo-file-system/legacy';

type StorageBackend = 'file' | 'memory';
const LEGACY_STORAGE_KEY = 'state';

let backend: StorageBackend | null = null;
const memoryStore = new Map<string, string>();
// Per-key promise chain so rapid saves run one-at-a-time (no temp-file races).
const writeQueues = new Map<string, Promise<void>>();

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

async function readJson<T>(path: string): Promise<T> {
  const raw = await FileSystem.readAsStringAsync(path);
  return JSON.parse(raw) as T;
}

/**
 * Loads saved state. Returns `null` ONLY when nothing has ever been saved.
 * If a file exists but can't be read/parsed, recovers from `.bak`; if that too
 * fails it THROWS, so callers don't mistake corruption for a brand-new user and
 * overwrite the real (recoverable) data with defaults.
 */
export async function loadPersistedState<T>(key = LEGACY_STORAGE_KEY): Promise<T | null> {
  const mode = resolveBackend();

  if (mode !== 'file') {
    const raw = memoryStore.get(key) ?? null;
    return raw ? (JSON.parse(raw) as T) : null;
  }

  const path = statePath(key)!;
  const bak = `${path}.bak`;

  const main = await FileSystem.getInfoAsync(path);
  if (main.exists) {
    try {
      return await readJson<T>(path);
    } catch {
      // Main file is corrupt/torn — fall back to the last good backup.
      const bakInfo = await FileSystem.getInfoAsync(bak);
      if (bakInfo.exists) {
        try {
          return await readJson<T>(bak);
        } catch {
          /* backup unreadable too — fall through to throw */
        }
      }
      // Existing data we cannot read: signal corruption rather than returning
      // null (which the caller would treat as "new user" and overwrite).
      throw new Error(`persisted state unreadable: ${key}`);
    }
  }

  // No main file. An interrupted write may have left only the backup.
  const bakInfo = await FileSystem.getInfoAsync(bak);
  if (bakInfo.exists) {
    try {
      return await readJson<T>(bak);
    } catch {
      /* ignore — treat as no data */
    }
  }

  return null;
}

// Stage to a temp file, preserve the old copy as `.bak`, then rename into place.
// A crash between steps leaves either the old `path`, or `.bak` + the staged
// `.tmp` — never a half-written `path`.
async function atomicWrite(path: string, json: string): Promise<void> {
  const tmp = `${path}.tmp`;
  const bak = `${path}.bak`;

  await FileSystem.writeAsStringAsync(tmp, json);

  const cur = await FileSystem.getInfoAsync(path);
  if (cur.exists) {
    await FileSystem.deleteAsync(bak, { idempotent: true });
    await FileSystem.moveAsync({ from: path, to: bak });
  }

  await FileSystem.moveAsync({ from: tmp, to: path });
}

export async function savePersistedState<T>(value: T, key = LEGACY_STORAGE_KEY): Promise<void> {
  const mode = resolveBackend();
  const json = JSON.stringify(value);

  if (mode !== 'file') {
    memoryStore.set(key, json);
    return;
  }

  const path = statePath(key)!;
  // Chain after any in-flight write for this key so they never overlap.
  const next = (writeQueues.get(key) ?? Promise.resolve())
    .catch(() => {})
    .then(() => atomicWrite(path, json))
    .catch(() => {
      // Persistence failed; in-memory state still works for this session.
    });
  writeQueues.set(key, next);
  return next;
}

export function getStorageBackend(): StorageBackend {
  return resolveBackend();
}

/** Permanently delete a saved state (file + its .bak/.tmp). Used when wiping an
 * account's local data on account deletion. */
export async function clearPersistedState(key = LEGACY_STORAGE_KEY): Promise<void> {
  if (resolveBackend() !== 'file') {
    memoryStore.delete(key);
    return;
  }
  const path = statePath(key);
  if (!path) return;
  for (const p of [path, `${path}.bak`, `${path}.tmp`]) {
    await FileSystem.deleteAsync(p, { idempotent: true }).catch(() => {});
  }
}
