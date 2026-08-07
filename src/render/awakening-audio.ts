// Owns the awakening's sad pre-rise music and layered ascension cue. The UI
// starts the sad cue with the limp, stops it exactly as the rise begins, then
// starts the angels/harps reveal.
//
// Fail-soft like the other render-ring audio modules: an out-of-date native
// client or a bad asset disables this cue without blocking the cutscene.
import type { AudioPlayer, AudioSource } from 'expo-audio';

const ANGELS_SOURCE: AudioSource = require('../../assets/audio/sfx/awakening-angels.m4a');
const HARPS_SOURCE: AudioSource = require('../../assets/audio/sfx/awakening-harps.m4a');
const LIMP_SOURCE: AudioSource = require('../../assets/audio/music/awakening-limp.m4a');

// The supplied angels clip is 2.34 seconds long. Keep this explicit so the
// creative timing is stable even if player status updates arrive late.
export const AWAKENING_HARPS_DELAY_MS = 1_170;
/** Beat 1 (7.5s) plus Beat 2 (2.8s), trimmed from the supplied 169s source. */
export const AWAKENING_LIMP_CLIP_MS = 10_300;

let angelsPlayer: AudioPlayer | null = null;
let harpsPlayer: AudioPlayer | null = null;
let limpPlayer: AudioPlayer | null = null;
let harpTimer: ReturnType<typeof setTimeout> | null = null;
let ready = false;
let initAttempted = false;
let warned = false;
let masterVolume = 1;
let playbackGeneration = 0;
let limpPlaybackGeneration = 0;

function warnOnce(context: string, error: unknown): void {
  if (warned) return;
  warned = true;
  console.warn(`[awakening-audio] ${context}`, error);
}

function clearHarpTimer(): void {
  if (harpTimer === null) return;
  clearTimeout(harpTimer);
  harpTimer = null;
}

/**
 * Matches `menu-audio` and `celebration-audio`: every music bed plays at half,
 * under the effects. The limp is the one bed reached from outside those two
 * modules, and playing it at the SFX gain put it 6dB above every other theme
 * once the assets were levelled to one loudness per class.
 */
const MUSIC_VOLUME = 0.5;

function setPlayerVolume(player: AudioPlayer | null, baseVolume: number, context: string): void {
  if (!player) return;
  try {
    player.volume = baseVolume * masterVolume;
    // Programmatic volume is a no-op in browsers on iOS; `muted` is not.
    player.muted = masterVolume === 0;
  } catch (error) {
    warnOnce(`${context} volume failed`, error);
  }
}

export function setAwakeningMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  applyAwakeningVolumes();
}

function applyAwakeningVolumes(): void {
  setPlayerVolume(angelsPlayer, 1, 'angels');
  setPlayerVolume(harpsPlayer, 1, 'harps');
  setPlayerVolume(limpPlayer, MUSIC_VOLUME, 'limp');
}

export function initAwakeningAudio(): void {
  if (initAttempted) return;
  initAttempted = true;

  try {
    const audio = require('expo-audio') as typeof import('expo-audio');
    audio.setAudioModeAsync({ playsInSilentMode: false })
      .catch((error: unknown) => warnOnce('setAudioModeAsync failed', error));

    try {
      angelsPlayer = audio.createAudioPlayer(ANGELS_SOURCE);
    } catch (error) {
      angelsPlayer = null;
      warnOnce('createAudioPlayer failed (angels)', error);
    }

    try {
      harpsPlayer = audio.createAudioPlayer(HARPS_SOURCE);
    } catch (error) {
      harpsPlayer = null;
      warnOnce('createAudioPlayer failed (harps)', error);
    }

    try {
      limpPlayer = audio.createAudioPlayer(LIMP_SOURCE);
      limpPlayer.loop = false;
    } catch (error) {
      limpPlayer = null;
      warnOnce('createAudioPlayer failed (limp)', error);
    }

    ready = angelsPlayer !== null || harpsPlayer !== null || limpPlayer !== null;
    applyAwakeningVolumes();
  } catch (error) {
    angelsPlayer = null;
    harpsPlayer = null;
    limpPlayer = null;
    ready = false;
    warnOnce('init failed - awakening sounds disabled for this session', error);
  }
}

function pausePlayer(player: AudioPlayer | null, context: string): void {
  if (!player) return;
  try {
    player.pause();
  } catch (error) {
    warnOnce(`${context} stop failed`, error);
  }
}

const RECOVERY_COOLDOWN_MS = 5000;
let lastRecoveryAt = 0;

/**
 * iOS tears down the audio-session server while the app sits in the background
 * (and a dev reload strands the previous context's players): every seek/play
 * then fails with "Session lookup failed". Dead native objects can't be
 * revived, so recovery releases all three players and rebuilds them through
 * the normal init, which also re-activates the session via setAudioModeAsync.
 * Releases stay silent — warnOnce here is a single slot, and it must be kept
 * for the failure that survives the retry. The cooldown keeps a device whose
 * audio is genuinely broken fail-soft.
 */
function tryRecoverAwakeningAudio(): boolean {
  const now = Date.now();
  if (now - lastRecoveryAt < RECOVERY_COOLDOWN_MS) return false;
  lastRecoveryAt = now;
  clearHarpTimer();
  for (const player of [angelsPlayer, harpsPlayer, limpPlayer]) {
    if (!player) continue;
    try {
      player.remove();
      player.release();
    } catch {
      // Already dead — that is why we are recovering.
    }
  }
  angelsPlayer = null;
  harpsPlayer = null;
  limpPlayer = null;
  ready = false;
  initAttempted = false;
  initAwakeningAudio();
  return ready;
}

// Takes a getter, not a player: recovery replaces the module-level players, so
// a retry (and the delayed harps layer) must re-read them instead of holding a
// reference to a dead one.
function playFromStart(
  getPlayer: () => AudioPlayer | null,
  context: string,
  shouldStart: () => boolean,
  isRetry = false,
): Promise<boolean> {
  const player = getPlayer();
  if (!player) return Promise.resolve(false);
  const recoverOr = (label: string, error: unknown): Promise<boolean> => {
    if (!isRetry && tryRecoverAwakeningAudio()) {
      return playFromStart(getPlayer, context, shouldStart, true);
    }
    warnOnce(label, error);
    return Promise.resolve(false);
  };
  try {
    return player.seekTo(0)
      .then(() => {
        if (!shouldStart()) return false;
        player.play();
        return true;
      })
      .catch((error: unknown) => recoverOr(`${context} seek/play failed`, error));
  } catch (error) {
    return recoverOr(`${context} playback failed`, error);
  }
}

export function playAwakeningAscension(): void {
  initAwakeningAudio();
  if (!ready) return;
  stopAwakeningLimp();

  playbackGeneration += 1;
  const generation = playbackGeneration;
  clearHarpTimer();
  pausePlayer(angelsPlayer, 'angels');
  pausePlayer(harpsPlayer, 'harps');

  if (!angelsPlayer) return;
  void playFromStart(
    () => angelsPlayer,
    'angels',
    () => generation === playbackGeneration,
  ).then(started => {
    if (!started || generation !== playbackGeneration) return;
    harpTimer = setTimeout(() => {
      harpTimer = null;
      if (!harpsPlayer || generation !== playbackGeneration) return;
      void playFromStart(
        () => harpsPlayer,
        'harps',
        () => generation === playbackGeneration,
      );
    }, AWAKENING_HARPS_DELAY_MS);
  });
}

export function playAwakeningLimp(): void {
  initAwakeningAudio();
  if (!ready || !limpPlayer) return;
  stopAwakeningAscension();
  limpPlaybackGeneration += 1;
  const generation = limpPlaybackGeneration;
  pausePlayer(limpPlayer, 'limp');
  void playFromStart(
    () => limpPlayer,
    'limp',
    () => generation === limpPlaybackGeneration,
  );
}

export function stopAwakeningLimp(): void {
  limpPlaybackGeneration += 1;
  pausePlayer(limpPlayer, 'limp');
}

export function stopAwakeningAscension(): void {
  playbackGeneration += 1;
  clearHarpTimer();
  pausePlayer(angelsPlayer, 'angels');
  pausePlayer(harpsPlayer, 'harps');
}

function releasePlayer(player: AudioPlayer | null, context: string): void {
  if (!player) return;
  try {
    player.pause();
    player.remove();
    player.release();
  } catch (error) {
    warnOnce(`${context} teardown failed`, error);
  }
}

export function teardownAwakeningAudio(): void {
  playbackGeneration += 1;
  limpPlaybackGeneration += 1;
  clearHarpTimer();
  releasePlayer(angelsPlayer, 'angels');
  releasePlayer(harpsPlayer, 'harps');
  releasePlayer(limpPlayer, 'limp');
  angelsPlayer = null;
  harpsPlayer = null;
  limpPlayer = null;
  ready = false;
  initAttempted = false;
  lastRecoveryAt = 0;
}
