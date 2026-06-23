/**
 * Spotify "full control" for the study radio — JS-only, no native module:
 *   - Auth: Authorization Code + PKCE via expo-web-browser (no client secret).
 *   - Playback: the Spotify Web API (play / pause / next / previous / now-playing),
 *     which drives the user's ACTIVE Spotify device (their phone's Spotify app).
 *
 * Requirements the user must satisfy (surfaced in the UI):
 *   - A Spotify Developer app → its Client ID in EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
 *     with this redirect URI registered (see REDIRECT_URI below).
 *   - Spotify Premium (the control endpoints 403 for free accounts).
 *   - Spotify open/playing on a device (else the API has no active device to drive).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { sha256 } from 'js-sha256';

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
// Must EXACTLY match the value registered in the Spotify dashboard → "Redirect URIs".
// Hardcoded (not derived) so the two can never drift. Uses the app's `deskmate` scheme.
export const REDIRECT_URI = 'deskmate://spotify-auth';
const SCOPES = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing'].join(' ');
const STORAGE_KEY = 'spotify.tokens.v1';

type Tokens = { access: string; refresh: string; expiresAt: number };
let tokens: Tokens | null = null;
let loaded = false;
const listeners = new Set<() => void>();

/** True once a Client ID is configured (else "Connect" can't work yet). */
export function spotifyConfigured(): boolean {
  return CLIENT_ID.length > 0;
}
/** True while we hold valid-ish credentials (connected). */
export function spotifyConnected(): boolean {
  return tokens != null;
}
export function subscribeSpotify(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// When the user deliberately jumps out to the Spotify app (to start music), the
// study session's "come back!" nudge should hold off rather than fire instantly.
// We record the moment of the jump; the focus watcher relaxes its nudge if the
// backgrounding happens right after.
let spotifyOpenedAt = 0;
export function markSpotifyAppOpened() {
  spotifyOpenedAt = Date.now();
}
/** True if the Spotify app was opened within the last `windowMs` (default 4s). */
export function spotifyAppRecentlyOpened(windowMs = 4000): boolean {
  return Date.now() - spotifyOpenedAt < windowMs;
}
function notify() {
  listeners.forEach((fn) => fn());
}

// ── PKCE (RN-safe: no btoa / URLSearchParams) ──
const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function base64url(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64URL[b0 >> 2];
    out += B64URL[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 === undefined) break;
    out += B64URL[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 === undefined) break;
    out += B64URL[b2 & 63];
  }
  return out;
}
function randomVerifier(len = 64): string {
  let s = '';
  for (let i = 0; i < len; i++) s += B64URL[Math.floor(Math.random() * B64URL.length)];
  return s;
}
function getParam(url: string, key: string): string | null {
  const m = url.match(new RegExp(`[?&]${key}=([^&#]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}
function form(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function persist() {
  try {
    if (tokens) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
}
async function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) tokens = JSON.parse(raw);
  } catch {
    tokens = null;
  }
}

async function refresh(): Promise<boolean> {
  if (!tokens?.refresh) return false;
  try {
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: tokens.refresh }),
    });
    const j = await r.json();
    if (!j.access_token) return false;
    tokens = {
      access: j.access_token,
      refresh: j.refresh_token ?? tokens.refresh,
      expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
    };
    await persist();
    return true;
  } catch {
    return false;
  }
}

async function validToken(): Promise<string | null> {
  await ensureLoaded();
  if (!tokens) return null;
  if (Date.now() > tokens.expiresAt - 30_000) {
    if (!(await refresh())) {
      // Refresh failed → treat as disconnected.
      tokens = null;
      await persist();
      notify();
      return null;
    }
  }
  return tokens?.access ?? null;
}

export type ConnectResult = { ok: boolean; error?: 'no-client-id' | 'cancelled' | 'failed' };

/** Run the Spotify login + PKCE token exchange. */
export async function connectSpotify(): Promise<ConnectResult> {
  if (!CLIENT_ID) return { ok: false, error: 'no-client-id' };
  const verifier = randomVerifier();
  const challenge = base64url(sha256.array(verifier));
  const authUrl =
    'https://accounts.spotify.com/authorize?response_type=code' +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}` +
    `&code_challenge_method=S256&code_challenge=${challenge}`;
  try {
    const res = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);
    if (res.type !== 'success' || !res.url) return { ok: false, error: 'cancelled' };
    const code = getParam(res.url, 'code');
    if (!code) return { ok: false, error: 'cancelled' };
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    });
    const j = await r.json();
    if (!j.access_token) return { ok: false, error: 'failed' };
    tokens = {
      access: j.access_token,
      refresh: j.refresh_token,
      expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000,
    };
    await persist();
    notify();
    return { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function disconnectSpotify() {
  tokens = null;
  await persist();
  notify();
}

// ── Playback control (drives the active Spotify device) ──
async function api(path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown): Promise<Response | null> {
  const tok = await validToken();
  if (!tok) return null;
  try {
    return await fetch(`https://api.spotify.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${tok}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    return null;
  }
}

export type Playback = {
  isPlaying: boolean;
  track?: string;
  artist?: string;
  hasDevice: boolean;
  // Track URI (spotify:track:…) + playback position, used to mirror the host's
  // song to other players in a multiplayer study room.
  uri?: string;
  progressMs?: number;
  // Track length (ms) — with progressMs drives the scrub slider.
  durationMs?: number;
  // Album cover art URL (mid size) — shown on the study-radio vinyl's label.
  coverUrl?: string;
};

export async function getPlayback(): Promise<Playback | null> {
  const r = await api('me/player', 'GET');
  if (!r) return null;
  if (r.status === 204) return { isPlaying: false, hasDevice: false }; // no active device
  try {
    const j = await r.json();
    return {
      isPlaying: !!j.is_playing,
      track: j.item?.name,
      artist: Array.isArray(j.item?.artists) ? j.item.artists.map((a: { name: string }) => a.name).join(', ') : undefined,
      hasDevice: true,
      uri: typeof j.item?.uri === 'string' ? j.item.uri : undefined,
      progressMs: typeof j.progress_ms === 'number' ? j.progress_ms : undefined,
      durationMs: typeof j.item?.duration_ms === 'number' ? j.item.duration_ms : undefined,
      // Prefer a mid/small cover (images are ordered largest-first) for a ~150px label.
      coverUrl: Array.isArray(j.item?.album?.images)
        ? (j.item.album.images[1]?.url ?? j.item.album.images[0]?.url)
        : undefined,
    };
  } catch {
    return { isPlaying: false, hasDevice: false };
  }
}

export const spotifyNext = () => api('me/player/next', 'POST');
export const spotifyPrevious = () => api('me/player/previous', 'POST');
export const spotifyResume = () => api('me/player/play', 'PUT');
export const spotifyPause = () => api('me/player/pause', 'PUT');

// Result of a play attempt, so the UI can explain WHY nothing happened instead of
// failing silently (the old bare-resume swallowed every error).
export type PlayResult = 'ok' | 'no-device' | 'premium' | 'not-connected' | 'error';

/**
 * Start/resume playback robustly. A bare `PUT me/player/play` only works when a
 * device is already ACTIVE — it 404s ("no active device") if the user's Spotify is
 * merely open/idle. So we first list devices and target one explicitly by id, which
 * wakes an idle device and resumes its context. Returns a reason on failure so the
 * caller can show a notice (no device open / Premium required / etc.).
 */
export async function spotifyPlay(): Promise<PlayResult> {
  const dr = await api('me/player/devices', 'GET');
  if (!dr) return spotifyConnected() ? 'error' : 'not-connected';
  if (dr.status === 403) return 'premium';
  let devices: { id: string; is_active: boolean }[] = [];
  try {
    devices = (await dr.json()).devices ?? [];
  } catch {
    return 'error';
  }
  if (devices.length === 0) return 'no-device';
  // Prefer the already-active device; otherwise wake the first available one.
  const target = devices.find((d) => d.is_active) ?? devices[0];
  const r = await api(`me/player/play?device_id=${encodeURIComponent(target.id)}`, 'PUT');
  if (!r) return 'error';
  if (r.status === 403) return 'premium';
  if (r.status === 404) return 'no-device'; // device vanished / nothing to resume
  return r.ok ? 'ok' : 'error';
}
/** Seek the active device to a position (ms) within the current track. */
export const spotifySeek = (positionMs: number) =>
  api(`me/player/seek?position_ms=${Math.max(0, Math.floor(positionMs))}`, 'PUT');

/** Play a specific track at a position on this user's active device — used to
 * mirror the host's song in a multiplayer room. Premium-only (403s for free
 * accounts, which we ignore). */
export const playTrackAt = (uri: string, positionMs: number) =>
  api('me/player/play', 'PUT', { uris: [uri], position_ms: Math.max(0, Math.floor(positionMs)) });

// Eagerly load any stored tokens on first import so spotifyConnected() reflects a
// reconnected session right away (e.g. a study-room guest mirroring the host's
// music) instead of reading false until the first control call lazily loads them.
void ensureLoaded().then(() => {
  if (tokens) notify();
});
