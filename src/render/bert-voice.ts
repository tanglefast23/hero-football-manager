// Bert "speaks" in ticks: one very short tick clip repeated at a typewriter
// cadence for as long as the page's copy takes to say — 2s for a one-line tip,
// 3.5s for a full briefing. Presentation-only and fail-soft, so headless Jest
// and an out-of-date native dev client still render the guide with no audio.
import type { AudioPlayer } from 'expo-audio';
import { registerAudioOwner } from './audio-lifecycle';

const VOICE_SOURCE = require('../../assets/audio/sfx/bert-voice-tick.m4a');

// The clip is ~23ms, so this spacing reads as speech; looping the clip natively
// would run the ticks together into one buzz.
const TICK_INTERVAL_MS = 90;
/** Copy longer than this counts as a long message. */
const LONG_MESSAGE_CHARS = 100;
export const SHORT_MESSAGE_MS = 2_000;
export const LONG_MESSAGE_MS = 3_500;

/** How long Bert talks for one page of copy. */
export function bertVoiceDurationMs(spoken: string): number {
  return spoken.trim().length > LONG_MESSAGE_CHARS ? LONG_MESSAGE_MS : SHORT_MESSAGE_MS;
}

let player: AudioPlayer | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
const warned = new Set<string>();
let masterVolume = 1;
let initAttempted = false;

function warnOnce(context: string, error: unknown): void {
  if (warned.has(context)) return;
  warned.add(context);
  console.warn(`[bert-voice] ${context}`, error);
}

function initBertVoice(): void {
  if (initAttempted) return;
  initAttempted = true;
  try {
    const audio = require('expo-audio') as typeof import('expo-audio');
    const created = audio.createAudioPlayer(VOICE_SOURCE);
    created.volume = masterVolume;
    player = created;
  } catch (error) {
    player = null;
    warnOnce('init failed — Bert voice disabled for this session', error);
  }
}

export function setBertVoiceMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  // Muting mid-sentence used to leave the ticker running at volume 0: silent,
  // but still seeking and replaying the clip every 90ms until the message ran
  // out. playBertVoice already refuses to start while muted; this makes muting
  // stop a run already in flight.
  if (masterVolume === 0) stopBertVoice();
  if (player === null) return;
  try {
    player.volume = masterVolume;
  } catch (error) {
    warnOnce('volume update failed', error);
  }
}

function tick(): void {
  const active = player;
  if (active === null) return;
  try {
    active.seekTo(0)
      .then(() => active.play())
      .catch((error: unknown) => warnOnce('tick playback failed', error));
  } catch (error) {
    warnOnce('tick playback failed', error);
  }
}

/** Stops the run of ticks immediately; safe to call when nothing is talking. */
export function stopBertVoice(): void {
  if (ticker !== null) clearInterval(ticker);
  ticker = null;
  if (stopTimer !== null) clearTimeout(stopTimer);
  stopTimer = null;
  try {
    player?.pause();
  } catch (error) {
    warnOnce('stop failed', error);
  }
}

/** Ticks for `durationMs`, then falls silent on its own. */
export function playBertVoice(durationMs: number): void {
  initBertVoice();
  if (player === null || masterVolume === 0 || durationMs <= 0) return;
  stopBertVoice();
  tick();
  ticker = setInterval(tick, TICK_INTERVAL_MS);
  stopTimer = setTimeout(stopBertVoice, durationMs);
}

/**
 * Backgrounding cuts Bert off mid-sentence and there is nothing to resume: the
 * ticks are the length of a message the player is no longer reading, and the
 * guide re-speaks whenever a page is shown again.
 */
registerAudioOwner({
  suspend: stopBertVoice,
  resume: () => {},
});

export function teardownBertVoice(): void {
  stopBertVoice();
  if (player !== null) {
    try {
      player.remove();
      player.release();
    } catch (error) {
      warnOnce('teardown failed', error);
    }
  }
  player = null;
  initAttempted = false;
}
