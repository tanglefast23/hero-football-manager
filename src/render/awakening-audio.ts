// Owns the layered ascension cue used by the awakening cutscene. The UI only
// starts/stops one cue; this module keeps the harp entrance locked halfway
// through the angels clip and owns both players for clean teardown.
//
// Fail-soft like the other render-ring audio modules: an out-of-date native
// client or a bad asset disables this cue without blocking the cutscene.
import type { AudioPlayer, AudioSource } from 'expo-audio';

const ANGELS_SOURCE: AudioSource = require('../../assets/audio/sfx/awakening-angels.m4a');
const HARPS_SOURCE: AudioSource = require('../../assets/audio/sfx/awakening-harps.m4a');

// The supplied angels clip is 2.34 seconds long. Keep this explicit so the
// creative timing is stable even if player status updates arrive late.
export const AWAKENING_HARPS_DELAY_MS = 1_170;

let angelsPlayer: AudioPlayer | null = null;
let harpsPlayer: AudioPlayer | null = null;
let harpTimer: ReturnType<typeof setTimeout> | null = null;
let ready = false;
let initAttempted = false;
let warned = false;
let masterVolume = 1;
let playbackGeneration = 0;

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
  } catch (error) {
    warnOnce(`${context} volume failed`, error);
  }
}

export function setAwakeningMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  setPlayerVolume(angelsPlayer, 'angels');
  setPlayerVolume(harpsPlayer, 'harps');
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

    ready = angelsPlayer !== null || harpsPlayer !== null;
    setPlayerVolume(angelsPlayer, 'angels');
    setPlayerVolume(harpsPlayer, 'harps');
  } catch (error) {
    angelsPlayer = null;
    harpsPlayer = null;
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

function playFromStart(player: AudioPlayer, context: string, generation: number): Promise<boolean> {
  try {
    return player.seekTo(0)
      .then(() => {
        if (generation !== playbackGeneration) return false;
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

  playbackGeneration += 1;
  const generation = playbackGeneration;
  clearHarpTimer();
  pausePlayer(angelsPlayer, 'angels');
  pausePlayer(harpsPlayer, 'harps');

  if (!angelsPlayer) return;
  void playFromStart(angelsPlayer, 'angels', generation).then(started => {
    if (!started || generation !== playbackGeneration) return;
    harpTimer = setTimeout(() => {
      harpTimer = null;
      if (!harpsPlayer || generation !== playbackGeneration) return;
      void playFromStart(harpsPlayer, 'harps', generation);
    }, AWAKENING_HARPS_DELAY_MS);
  });
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
  clearHarpTimer();
  releasePlayer(angelsPlayer, 'angels');
  releasePlayer(harpsPlayer, 'harps');
  angelsPlayer = null;
  harpsPlayer = null;
  ready = false;
  initAttempted = false;
}
