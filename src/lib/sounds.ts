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

function makePool(asset: number, volume = VOLUME, size = POOL_SIZE): Pool {
  const players = Array.from({ length: size }, () => {
    const p = createAudioPlayer(asset);
    p.volume = volume;
    // The instant a clip finishes, rewind it so it's parked at the start ready for
    // its next turn. Without this a player is left sitting at its END position, and
    // a later `play()` there makes no sound — that's the "sometimes no pop" on the
    // tab bar (taps are spaced out, so each one reuses a finished, end-parked player).
    p.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) p.seekTo(0).catch(() => {});
    });
    return p;
  });
  return { players, next: 0 };
}

let tapPool: Pool | null = null;
let confirmPool: Pool | null = null;
let swooshPool: Pool | null = null;
let dingPool: Pool | null = null;
let tickPool: Pool | null = null;
let pieceDropPool: Pool | null = null;

function getTapPool() {
  if (!tapPool) tapPool = makePool(require('@/assets/sounds/tap.wav'));
  return tapPool;
}

function getConfirmPool() {
  if (!confirmPool) confirmPool = makePool(require('@/assets/sounds/tap-confirm.wav'));
  return confirmPool;
}

// Swoosh plays a touch louder than the UI taps so the ingredient-drop reads clearly.
function getSwooshPool() {
  if (!swooshPool) swooshPool = makePool(require('@/assets/sounds/swoosh.mp3'), 0.55);
  return swooshPool;
}

// Session-finished "ding" (oven-timer feel). Fires once per completion, so a tiny
// 2-player pool is plenty.
function getDingPool() {
  if (!dingPool) dingPool = makePool(require('@/assets/sounds/ding.wav'), 0.6, 2);
  return dingPool;
}

// Crisp "tick" for spinning a time/date picker wheel or choosing a duration — one
// click per value change. A fast wheel spin fires these far quicker than a single
// ~60ms click finishes, so the round-robin pool is sized extra-large (16): by the
// time we cycle back to a player it has long finished, so no overlapping tick is
// ever asked to restart mid-playback (which would drop silently).
function getTickPool() {
  if (!tickPool) tickPool = makePool(require('@/assets/sounds/tick.wav'), 0.5, 16);
  return tickPool;
}

// Bouncy "piece drop" for board-game moves (Connect 4). Plays for every move —
// yours, the AI's, and a remote opponent's.
function getPieceDropPool() {
  if (!pieceDropPool) pieceDropPool = makePool(require('@/assets/sounds/piece-drop.wav'), 0.6);
  return pieceDropPool;
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
    // seekTo() is async but play() is sync, so calling them back-to-back races: if
    // this player is sitting at the end of its clip the play() fires at the end and
    // makes no sound before the rewind lands. Wait for the rewind, THEN play, so
    // every press is audible and overlapping presses each restart cleanly.
    const fire = () => {
      player
        .seekTo(0)
        .then(() => player.play())
        .catch(() => {
          try {
            player.play();
          } catch {}
        });
    };
    if (player.isLoaded) {
      fire();
    } else {
      // First use of a lazily-created pool (e.g. the swoosh, first heard when picking
      // a starter) — the bundled asset hasn't finished loading yet, and play() on an
      // unloaded player drops silently. Fire once it reports loaded, then stop listening.
      const sub = player.addListener('playbackStatusUpdate', (st) => {
        if (st.isLoaded) {
          sub.remove();
          fire();
        }
      });
    }
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

/** Swoosh for dropping a kitchen ingredient into the mixer. */
export function playSwoosh() {
  play(getSwooshPool);
}

/** Oven-timer "ding" for when a study session finishes. */
export function playFinishDing() {
  play(getDingPool);
}

/** Crisp click for changing a value in a time/date picker (wheel spin, duration pick). */
export function playTick() {
  play(getTickPool);
}

/** Bouncy drop for a board-game piece move (Connect 4) — fires for every player. */
export function playPieceDrop() {
  play(getPieceDropPool);
}
