import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Subtle UI tap sounds (CC0, see assets/sounds/CREDITS.md). Kept centralized so the
// on/off setting lives in one place.

const VOLUME = 0.4;
// A single shared player can't reliably restart while it's still mid-playback —
// `seekTo(0)+play()` on a busy player drops silently, which made some taps (e.g.
// the Home/Progress tabs) produce no pop. Instead each sound owns a small POOL of
// players and we round-robin through them: a given player isn't reused until the
// others have played, so its short bubble has always finished by the next turn.
// Pool big enough that fast, overlapping taps each get their own free player and
// none is ever asked to restart mid-playback (which would drop silently).
const POOL_SIZE = 8;

let enabled = true;
let audioModeReady = false;

/** Mirror of the user's `soundEffectsEnabled` setting (synced from AppContext). */
export function setTapSoundEnabled(value: boolean) {
  enabled = value;
}

function ensureAudioMode() {
  if (audioModeReady) return;
  audioModeReady = true;
  // Respect the hardware mute switch (standard for UI sounds; this is a study app).
  setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
}

type Pool = { players: AudioPlayer[]; next: number };

function makePool(asset: number): Pool {
  const players = Array.from({ length: POOL_SIZE }, () => {
    const p = createAudioPlayer(asset);
    p.volume = VOLUME;
    return p;
  });
  return { players, next: 0 };
}

let tapPool: Pool | null = null;
let confirmPool: Pool | null = null;

function getTapPool() {
  if (!tapPool) tapPool = makePool(require('@/assets/sounds/tap.wav'));
  return tapPool;
}

function getConfirmPool() {
  if (!confirmPool) confirmPool = makePool(require('@/assets/sounds/tap-confirm.wav'));
  return confirmPool;
}

function play(getPool: () => Pool) {
  if (!enabled) return;
  // No throttle — every press should pop, even fast overlapping taps. The pool
  // round-robins so each tap gets a fresh player rather than restarting a busy one.
  try {
    ensureAudioMode();
    const pool = getPool();
    const player = pool.players[pool.next];
    pool.next = (pool.next + 1) % pool.players.length;
    player.seekTo(0);
    player.play();
  } catch {
    // Audio is non-critical — never let a playback hiccup break a button.
  }
}

/** Soft tap for ordinary action buttons. */
export function playTap() {
  play(getTapPool);
}

/** Slightly fuller tap for positive confirmations (task complete, session start, purchase). */
export function playTapConfirm() {
  play(getConfirmPool);
}
