// Subtle UI tap sounds (CC0, see assets/sounds/CREDITS.md). Kept centralized so the
// on/off setting lives in one place.
//
// expo-audio requires a native dev-client build. Guard every call so the app
// doesn't crash in Expo Go / builds where the native module is absent.

type AudioPlayer = {
  volume: number;
  isLoaded: boolean;
  play(): void;
  seekTo(pos: number): Promise<void>;
  addListener(event: string, cb: (status: any) => void): { remove(): void };
};

type ExpoAudioModule = {
  createAudioPlayer(source: unknown): AudioPlayer;
  setAudioModeAsync(opts: Record<string, unknown>): Promise<void>;
};

function loadExpoAudio(): ExpoAudioModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-audio') as ExpoAudioModule;
  } catch {
    return null;
  }
}

const ExpoAudio = loadExpoAudio();

const VOLUME = 0.4;
const POOL_SIZE = 8;

let enabled = true;
let audioModeReady = false;

/** Mirror of the user's `soundEffectsEnabled` setting (synced from AppContext). */
export function setTapSoundEnabled(value: boolean) {
  enabled = value;
}

function ensureAudioMode() {
  if (audioModeReady || !ExpoAudio) return;
  audioModeReady = true;
  ExpoAudio.setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
}

type Pool = { players: AudioPlayer[]; next: number };

function makePool(asset: number, volume = VOLUME, size = POOL_SIZE): Pool | null {
  if (!ExpoAudio) return null;
  const players = Array.from({ length: size }, () => {
    const p = ExpoAudio!.createAudioPlayer(asset);
    p.volume = volume;
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
let popPool: Pool | null = null;

function getTapPool() {
  if (!tapPool) tapPool = makePool(require('@/assets/sounds/tap.wav'));
  return tapPool;
}

function getConfirmPool() {
  if (!confirmPool) confirmPool = makePool(require('@/assets/sounds/tap-confirm.wav'));
  return confirmPool;
}

function getSwooshPool() {
  if (!swooshPool) swooshPool = makePool(require('@/assets/sounds/swoosh.mp3'), 0.55);
  return swooshPool;
}

function getDingPool() {
  if (!dingPool) dingPool = makePool(require('@/assets/sounds/ding.wav'), 0.6, 2);
  return dingPool;
}

function getTickPool() {
  if (!tickPool) tickPool = makePool(require('@/assets/sounds/tick.wav'), 0.5, 16);
  return tickPool;
}

function getPieceDropPool() {
  if (!pieceDropPool) pieceDropPool = makePool(require('@/assets/sounds/piece-drop.wav'), 0.6);
  return pieceDropPool;
}

function getPopPool() {
  if (!popPool) popPool = makePool(require('@/assets/sounds/pop.wav'), 0.5, 4);
  return popPool;
}

function play(getPool: () => Pool | null) {
  if (!enabled || !ExpoAudio) return;
  try {
    ensureAudioMode();
    const pool = getPool();
    if (!pool) return;
    const player = pool.players[pool.next];
    pool.next = (pool.next + 1) % pool.players.length;
    const fire = () => {
      player
        .seekTo(0)
        .then(() => player.play())
        .catch(() => {
          try { player.play(); } catch {}
        });
    };
    if (player.isLoaded) {
      fire();
    } else {
      const sub = player.addListener('playbackStatusUpdate', (st) => {
        if (st.isLoaded) { sub.remove(); fire(); }
      });
    }
  } catch {
    // Audio is non-critical — never let a playback hiccup break a button.
  }
}

/** Soft tap for ordinary action buttons. */
export function playTap() { play(getTapPool); }

/** Slightly fuller tap for positive confirmations (task complete, session start, purchase). */
export function playTapConfirm() { play(getConfirmPool); }

/** Swoosh for dropping a kitchen ingredient into the mixer. */
export function playSwoosh() { play(getSwooshPool); }

/** Oven-timer "ding" for when a study session finishes. */
export function playFinishDing() { play(getDingPool); }

/** Crisp click for changing a value in a time/date picker (wheel spin, duration pick). */
export function playTick() { play(getTickPool); }

/** Bouncy drop for a board-game piece move (Connect 4) — fires for every player. */
export function playPieceDrop() { play(getPieceDropPool); }

/** Soft bubble "pop" — used when a fellow studier leaves the room mid-session. */
export function playPop() { play(getPopPool); }
