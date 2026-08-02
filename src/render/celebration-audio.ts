// Owns the two music beds the endgame celebrations play over. Kept out of
// `menu-audio` because that module derives exactly one theme from the current
// screen, and the true ending needs two beds on one screen: the farewell under
// the star's speech, then the anthem the moment the squad joins him.
//
// Fail-soft like the other render-ring audio modules: an out-of-date native
// client or a bad asset costs the music, never the celebration.
import type { AudioPlayer, AudioSource } from 'expo-audio';
import { audioIsSuspended, registerAudioOwner } from './audio-lifecycle';

/**
 * The victory song. Division titles, the Global League screen, the Cup, and the
 * curtain call that closes the true ending all play this one, always from the
 * top — it is the club's theme, and it should always open on its own intro.
 */
const ANTHEM_SOURCE: AudioSource = require('../../assets/audio/music/celebration-anthem.m4a');
/**
 * The bed under the star's thank-you. Rendered as a 30-second cut that fades in
 * and out at its own edges, so looping it breathes rather than butt-splices —
 * the speech runs as long as the player takes to tap through it.
 */
const FAREWELL_SOURCE: AudioSource = require('../../assets/audio/music/ending-farewell.m4a');

type Bed = 'anthem' | 'farewell';

/** Matches `menu-audio`: these files are level-matched to the other beds. */
const MUSIC_VOLUME = 0.5;

const players = new Map<Bed, AudioPlayer>();
let activeBed: Bed | null = null;
let masterVolume = 1;
let ready = false;
let initAttempted = false;
const warned = new Set<string>();

function warnOnce(context: string, error: unknown): void {
  if (warned.has(context)) return;
  warned.add(context);
  console.warn(`[celebration-audio] ${context}`, error);
}

function applyMasterVolume(): void {
  // `muted` alongside `volume`: browsers on iOS ignore programmatic volume, so
  // a muted game would otherwise still sing at device level.
  const muted = masterVolume === 0;
  for (const [bed, player] of players) {
    try {
      player.volume = MUSIC_VOLUME * masterVolume;
      player.muted = muted;
    } catch (error) {
      warnOnce(`${bed} volume failed`, error);
    }
  }
}

export function setCelebrationMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  applyMasterVolume();
}

export function initCelebrationAudio(): void {
  if (initAttempted) return;
  initAttempted = true;
  try {
    const audio = require('expo-audio') as typeof import('expo-audio');
    audio.setAudioModeAsync({ playsInSilentMode: false })
      .catch((error: unknown) => warnOnce('setAudioModeAsync failed', error));

    for (const [bed, source] of [
      ['anthem', ANTHEM_SOURCE],
      ['farewell', FAREWELL_SOURCE],
    ] as const) {
      try {
        const player = audio.createAudioPlayer(source);
        // The anthem is a song that plays out; the farewell holds the speech
        // for as long as the player reads it.
        player.loop = bed === 'farewell';
        players.set(bed, player);
      } catch (error) {
        warnOnce(`createAudioPlayer failed (${bed})`, error);
      }
    }

    ready = players.size > 0;
    applyMasterVolume();
  } catch (error) {
    players.clear();
    ready = false;
    warnOnce('init failed — celebration music disabled for this session', error);
  }
}

const RECOVERY_COOLDOWN_MS = 5000;
let lastRecoveryAt = 0;

/**
 * iOS tears down the audio-session server while the app sits in the background
 * (and a dev reload strands the previous context's players), after which every
 * play() throws. Dead native objects cannot be revived, so recovery rebuilds
 * both players and leaves the caller to restart the bed it wanted.
 */
function tryRecoverCelebrationAudio(): boolean {
  const now = Date.now();
  if (now - lastRecoveryAt < RECOVERY_COOLDOWN_MS) return false;
  lastRecoveryAt = now;
  for (const [, player] of players) {
    try {
      player.remove();
      player.release();
    } catch {
      // Already dead — that is why we are recovering.
    }
  }
  players.clear();
  ready = false;
  initAttempted = false;
  initCelebrationAudio();
  return ready;
}

function pause(bed: Bed): void {
  try {
    players.get(bed)?.pause();
  } catch (error) {
    warnOnce(`${bed} stop failed`, error);
  }
}

function start(bed: Bed, isRetry = false): void {
  const player = players.get(bed);
  if (player === undefined || audioIsSuspended()) return;
  const recoverOr = (label: string, error: unknown): void => {
    if (!isRetry && tryRecoverCelebrationAudio()) {
      start(bed, true);
      return;
    }
    warnOnce(label, error);
  };
  try {
    player.seekTo(0)
      .then(() => {
        // A later call may have taken the stage while the seek was in flight.
        if (activeBed !== bed) return;
        player.play();
      })
      .catch((error: unknown) => recoverOr(`${bed} seek/play failed`, error));
  } catch (error) {
    recoverOr(`${bed} playback failed`, error);
  }
}

/**
 * Only one bed is ever up. The true ending hands the speech's farewell straight
 * over to the anthem, and playing a bed that is already the active one restarts
 * it from the top — every celebration is entered fresh, never resumed.
 */
function playBed(bed: Bed): void {
  initCelebrationAudio();
  if (!ready) return;
  if (activeBed !== null && activeBed !== bed) pause(activeBed);
  activeBed = bed;
  start(bed);
}

/** The victory song, from its intro. */
export function playCelebrationAnthem(): void {
  playBed('anthem');
}

/** The looping bed under the star's thank-you. */
export function playEndingFarewell(): void {
  playBed('farewell');
}

/**
 * Silences whichever bed is up. Celebrations call this on unmount: these
 * screens are left by tapping through them, and a song that outlived its scene
 * would play on over the season boundary behind it.
 */
export function stopCelebrationAudio(): void {
  if (activeBed === null) return;
  pause(activeBed);
  activeBed = null;
}

/**
 * A celebration can sit on screen indefinitely while the player looks at it, so
 * backgrounding must silence it. `activeBed` still records what the app wanted,
 * and the anthem restarts from its intro rather than resuming mid-song.
 */
registerAudioOwner({
  suspend: () => {
    if (!ready || activeBed === null) return;
    pause(activeBed);
  },
  resume: () => {
    if (!ready || activeBed === null) return;
    start(activeBed);
  },
});

export function teardownCelebrationAudio(): void {
  for (const [bed, player] of players) {
    try {
      player.pause();
      player.remove();
      player.release();
    } catch (error) {
      warnOnce(`${bed} teardown failed`, error);
    }
  }
  players.clear();
  activeBed = null;
  ready = false;
  initAttempted = false;
  lastRecoveryAt = 0;
}
