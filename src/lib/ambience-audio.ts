// Looping 10-second previews for the study sounds (shop + ambience picker). Only
// one preview plays at a time. A sound can be previewed once its audio file is
// listed in SOUND_ASSETS — sounds without a file yet simply can't be previewed.
//
// "First 10 seconds then repeats": we play the clip and, once playback passes the
// 10s mark, seek back to 0. `loop` also covers files shorter than the window.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

const PREVIEW_SECONDS = 10;
const VOLUME = 0.8;

// Keyed by ambience id (the part after `sound_`). Add files here as they're made.
const SOUND_ASSETS: Record<string, number> = {
  rain: require('@/assets/sounds/rain-thunder.wav'),
  ocean: require('@/assets/sounds/ocean.m4a'),
  fireplace: require('@/assets/sounds/fireplace.m4a'),
  night: require('@/assets/sounds/night.m4a'),
  // keyboard — audio pending.
};

/** True if this sound has an audio file and can be previewed. */
export function hasSoundPreview(id: string): boolean {
  return !!SOUND_ASSETS[id];
}

let player: AudioPlayer | null = null;
let currentId: string | null = null;
let capTimer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<(id: string | null) => void>();

function notify() {
  listeners.forEach((fn) => fn(currentId));
}

/** Subscribe to "which sound is previewing" changes (null = none). */
export function subscribePreview(fn: (id: string | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function previewingId(): string | null {
  return currentId;
}

export function stopPreview() {
  if (capTimer) {
    clearInterval(capTimer);
    capTimer = null;
  }
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {
      // Player teardown is best-effort.
    }
    player = null;
  }
  if (currentId !== null) {
    currentId = null;
    notify();
  }
}

/** Start (or restart) a sound's 10s looping preview. No-op + false if no audio. */
export function startPreview(id: string): boolean {
  const asset = SOUND_ASSETS[id];
  if (!asset) return false;
  stopPreview();
  // Previews are an explicit tap, so play even with the silent switch on.
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  const p = createAudioPlayer(asset);
  p.volume = VOLUME;
  p.loop = true; // covers clips shorter than the 10s window
  player = p;
  currentId = id;
  try {
    p.play();
  } catch {
    // If playback can't start, fall back to a clean stop.
    stopPreview();
    return false;
  }
  capTimer = setInterval(() => {
    try {
      if (player && player.currentTime >= PREVIEW_SECONDS) player.seekTo(0);
    } catch {
      // Ignore transient status read errors.
    }
  }, 300);
  notify();
  return true;
}

/** Toggle: start if not playing this sound, stop if it already is. */
export function togglePreview(id: string): void {
  if (currentId === id) stopPreview();
  else startPreview(id);
}

// ── Study-session music: the equipped study sound, looped full-length (not the
// 10s preview window) for as long as the study screen is up. ──
let musicPlayer: AudioPlayer | null = null;
let musicAmbId: string | null = null;

export function isStudyMusicPlaying(): boolean {
  return musicAmbId != null;
}

export function stopStudyMusic() {
  if (musicPlayer) {
    try {
      musicPlayer.pause();
      musicPlayer.remove();
    } catch {
      // best-effort teardown
    }
    musicPlayer = null;
  }
  musicAmbId = null;
}

/** Loop a sound (by ambience id, e.g. 'rain') as study music. `null` or a sound
 *  with no audio file → silence. Switching ids swaps the track. */
export function playStudyMusic(ambienceId: string | null) {
  const target = ambienceId && SOUND_ASSETS[ambienceId] ? ambienceId : null;
  // Already playing the desired track → leave it alone. But only short-circuit
  // when the player is *actually* playing: musicAmbId can still name a track whose
  // native player has stopped (an audio-session interruption after backgrounding,
  // or a play() that fired before the source finished loading). In that "equipped
  // but silent" state we must fall through and rebuild, or re-tapping the sound
  // would no-op forever.
  if (target === musicAmbId && musicPlayer?.playing) return;
  stopStudyMusic();
  if (!target) return;
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  const p = createAudioPlayer(SOUND_ASSETS[target]);
  p.volume = 0.6;
  p.loop = true;
  musicPlayer = p;
  musicAmbId = target;
  const start = () => {
    try {
      p.play();
    } catch {
      // best-effort; the status listener below retries once loaded
    }
  };
  start();
  // play() is a no-op if the source hasn't finished loading yet (large clips like
  // the rain .wav decode slowly), so retry once it's ready, then stop listening.
  if (!p.isLoaded) {
    const sub = p.addListener('playbackStatusUpdate', (status) => {
      // Stop listening once the player is superseded or has finished loading; if
      // it loaded without playing (the initial play() lost the race), kick it.
      if (musicPlayer !== p) {
        sub.remove();
        return;
      }
      if (status.isLoaded) {
        if (!status.playing) start();
        sub.remove();
      }
    });
  }
}
