/**
 * Report-owned audio for the Financial Report modal (spec §9): the slot-spin
 * bed, the landing thunk pool, and the two surge cues. Deliberately NOT in the
 * management-sfx registry — the report needs a loop player, per-cue gain, and
 * cancellation around async seek/play, none of which the one-shot registry
 * has.
 *
 * Cancellation is three-layered, and every async start captures all three:
 * a per-cue generation (a newer start or stop of the same cue), the stop
 * epoch (`stopAllFinancialReportSfx`), and the suspend epoch (bumped by BOTH
 * suspend and resume, so a seek that straddles a suspension can never play
 * after resume). Dead players get one bounded recreate-and-retry, mirroring
 * audio.ts and management-sfx.ts — iOS invalidates players backgrounded too
 * long, and a cue must go quiet, not permanently dead.
 */
import type { AudioPlayer, AudioSource } from 'expo-audio';
import { audioIsSuspended, registerAudioOwner } from './audio-lifecycle';

const SPIN_SOURCE: AudioSource = require('../../assets/audio/sfx/ledger-spin.wav');
const THUNK_SOURCE: AudioSource = require('../../assets/audio/sfx/ledger-thunk.wav');
const FLAME_UP_SOURCE: AudioSource = require('../../assets/audio/sfx/flame-up.wav');
const CRACKLE_SOURCE: AudioSource = require('../../assets/audio/sfx/flame-loop.m4a');

// Per-cue gain under the shared master volume: the spin bed sits low so the
// thunk and flame reads land above it.
const SPIN_GAIN = 0.6;
const THUNK_GAIN = 1.0;
const FLAME_UP_GAIN = 0.9;
const CRACKLE_GAIN = 0.5;

const THUNK_VOICES = 4;

interface Cue {
  player: AudioPlayer | null;
  readonly source: AudioSource;
  readonly gain: number;
  readonly loop: boolean;
}

let spinCue: Cue | null = null;
let thunkCues: Cue[] = [];
let flameUpCue: Cue | null = null;
let crackleCue: Cue | null = null;
let ready = false;
let masterVolume = 1;
let suspended = false;
let unregisterLifecycle: (() => void) | null = null;

let spinGeneration = 0;
let surgeGeneration = 0;
let crackleActive = false;
const thunkVoiceGenerations: number[] = Array.from({ length: THUNK_VOICES }, () => 0);
let nextThunkVoice = 0;
let stopEpoch = 0;
let suspendEpoch = 0;

function makeCue(source: AudioSource, gain: number, loop: boolean): Cue {
  const cue: Cue = { player: null, source, gain, loop };
  recreatePlayer(cue);
  return cue;
}

function recreatePlayer(cue: Cue): AudioPlayer | null {
  try {
    cue.player?.remove();
    cue.player?.release();
  } catch {
    // A dead player that cannot even detach must not block its replacement.
  }
  cue.player = null;
  try {
    const mod = require('expo-audio') as typeof import('expo-audio');
    const player = mod.createAudioPlayer(cue.source);
    if (cue.loop) player.loop = true;
    cue.player = player;
    applyVolumeTo(cue);
    return player;
  } catch {
    return null;
  }
}

function applyVolumeTo(cue: Cue): void {
  if (cue.player === null) return;
  try {
    cue.player.volume = cue.gain * masterVolume;
    cue.player.muted = masterVolume === 0;
  } catch {
    // Losing a volume write is non-fatal.
  }
}

function allCues(): Cue[] {
  const cues: Cue[] = [];
  if (spinCue) cues.push(spinCue);
  cues.push(...thunkCues);
  if (flameUpCue) cues.push(flameUpCue);
  if (crackleCue) cues.push(crackleCue);
  return cues;
}

function init(): void {
  if (ready) return;
  spinCue = makeCue(SPIN_SOURCE, SPIN_GAIN, false);
  thunkCues = Array.from({ length: THUNK_VOICES }, () => makeCue(THUNK_SOURCE, THUNK_GAIN, false));
  flameUpCue = makeCue(FLAME_UP_SOURCE, FLAME_UP_GAIN, false);
  crackleCue = makeCue(CRACKLE_SOURCE, CRACKLE_GAIN, true);
  ready = true;
  if (unregisterLifecycle === null) {
    unregisterLifecycle = registerAudioOwner({
      suspend: suspendFinancialReportSfx,
      resume: resumeFinancialReportSfx,
    });
  }
}

function pauseCue(cue: Cue | null): void {
  try {
    cue?.player?.pause();
  } catch {
    // A pause on a dead player is a no-op, not a fault.
  }
}

function seekThenPlay(cue: Cue, isCurrent: () => boolean, allowRecovery = true): void {
  if (suspended || audioIsSuspended()) return;
  const player = cue.player ?? (allowRecovery ? recreatePlayer(cue) : null);
  if (player === null) return;
  try {
    player.pause();
    player.seekTo(0).then(
      () => {
        if (!isCurrent() || suspended || audioIsSuspended()) return;
        try {
          player.play();
        } catch {
          // Device audio loss at play time is non-fatal.
        }
      },
      () => {
        // A rejected seek means the native player died. One bounded recreate.
        if (!allowRecovery || !isCurrent()) return;
        if (recreatePlayer(cue) !== null) seekThenPlay(cue, isCurrent, false);
      },
    );
  } catch {
    if (allowRecovery && recreatePlayer(cue) !== null) seekThenPlay(cue, isCurrent, false);
  }
}

/** Captures the stop and suspend epochs a start must survive to be current. */
function epochGuard(): () => boolean {
  const stop = stopEpoch;
  const suspend = suspendEpoch;
  return () => stop === stopEpoch && suspend === suspendEpoch;
}

export function playLedgerSpin(): void {
  init();
  if (spinCue === null) return;
  spinGeneration += 1;
  const generation = spinGeneration;
  const epochs = epochGuard();
  seekThenPlay(spinCue, () => generation === spinGeneration && epochs());
}

export function stopLedgerSpin(): void {
  spinGeneration += 1;
  pauseCue(spinCue);
}

export function playLedgerThunk(): void {
  init();
  if (thunkCues.length === 0) return;
  const voice = nextThunkVoice;
  nextThunkVoice = (nextThunkVoice + 1) % thunkCues.length;
  const cue = thunkCues[voice];
  thunkVoiceGenerations[voice] += 1;
  const generation = thunkVoiceGenerations[voice];
  const epochs = epochGuard();
  seekThenPlay(cue, () => generation === thunkVoiceGenerations[voice] && epochs());
}

export function playSurgeIgnition(): void {
  init();
  surgeGeneration += 1;
  crackleActive = true;
  const generation = surgeGeneration;
  const epochs = epochGuard();
  const isCurrent = () => generation === surgeGeneration && crackleActive && epochs();
  if (flameUpCue !== null) seekThenPlay(flameUpCue, isCurrent);
  if (crackleCue !== null) seekThenPlay(crackleCue, isCurrent);
}

export function stopSurgeBed(): void {
  surgeGeneration += 1;
  crackleActive = false;
  pauseCue(flameUpCue);
  pauseCue(crackleCue);
}

export function stopAllFinancialReportSfx(): void {
  stopEpoch += 1;
  spinGeneration += 1;
  surgeGeneration += 1;
  crackleActive = false;
  for (const cue of allCues()) pauseCue(cue);
}

/** Lifecycle suspend: pause everything, keep the crackle's logical intent. */
export function suspendFinancialReportSfx(): void {
  suspended = true;
  suspendEpoch += 1;
  for (const cue of allCues()) pauseCue(cue);
}

/** Lifecycle resume: only a still-active surge bed restarts, with a fresh seek. */
export function resumeFinancialReportSfx(): void {
  suspended = false;
  suspendEpoch += 1;
  if (!crackleActive || crackleCue === null) return;
  const generation = surgeGeneration;
  const epochs = epochGuard();
  seekThenPlay(crackleCue, () => generation === surgeGeneration && crackleActive && epochs());
}

export function setFinancialReportSfxMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  for (const cue of allCues()) applyVolumeTo(cue);
}

export function teardownFinancialReportSfx(): void {
  stopAllFinancialReportSfx();
  for (const cue of allCues()) {
    try {
      cue.player?.remove();
      cue.player?.release();
    } catch {
      // One bad player must not leave the rest un-removed.
    }
    cue.player = null;
  }
  spinCue = null;
  thunkCues = [];
  flameUpCue = null;
  crackleCue = null;
  nextThunkVoice = 0;
  ready = false;
  unregisterLifecycle?.();
  unregisterLifecycle = null;
}
