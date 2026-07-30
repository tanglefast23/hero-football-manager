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

function setPlayerVolume(player: AudioPlayer | null, context: string): void {
  if (!player) return;
  try {
    player.volume = masterVolume;
    // Programmatic volume is a no-op in browsers on iOS; `muted` is not.
    player.muted = masterVolume === 0;
  } catch (error) {
    warnOnce(`${context} volume failed`, error);
  }
}

export function setAwakeningMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  setPlayerVolume(angelsPlayer, 'angels');
  setPlayerVolume(harpsPlayer, 'harps');
  setPlayerVolume(limpPlayer, 'limp');
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
    setPlayerVolume(angelsPlayer, 'angels');
    setPlayerVolume(harpsPlayer, 'harps');
    setPlayerVolume(limpPlayer, 'limp');
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

function playFromStart(
  player: AudioPlayer,
  context: string,
  shouldStart: () => boolean,
): Promise<boolean> {
  try {
    return player.seekTo(0)
      .then(() => {
        if (!shouldStart()) return false;
        player.play();
        return true;
      })
      .catch((error: unknown) => {
        warnOnce(`${context} seek/play failed`, error);
        return false;
      });
  } catch (error) {
    warnOnce(`${context} playback failed`, error);
    return Promise.resolve(false);
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
    angelsPlayer,
    'angels',
    () => generation === playbackGeneration,
  ).then(started => {
    if (!started || generation !== playbackGeneration) return;
    harpTimer = setTimeout(() => {
      harpTimer = null;
      if (!harpsPlayer || generation !== playbackGeneration) return;
      void playFromStart(
        harpsPlayer,
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
    limpPlayer,
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
}
