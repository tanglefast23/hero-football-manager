// Bert "speaks" in ticks: one short tick clip repeated at a typewriter cadence
// for as long as the bubble's copy takes to say — 1s for a one-liner, 1.9s for
// a full paragraph. Presentation-only and fail-soft, so headless Jest and an
// out-of-date native dev client still render the guide with no audio.
import type { AudioPlayer } from 'expo-audio';
import { registerAudioOwner } from './audio-lifecycle';

/**
 * One tick plus the silence after it, so the run of ticks is the *player's*
 * loop rather than a JS timer's.
 *
 * A timer used to re-trigger a single bare tick every 90ms, and only the first
 * one was ever heard: iOS retires an `AudioPlayer` seek by cancelling it when
 * the next seek arrives, so eleven seeks a second means ten cancellations a
 * second and ten `play()` calls that never run. Spacing the clip instead of the
 * calls removes the race outright — there is now exactly one seek per bubble.
 *
 * Rebuild after changing the tick or the cadence (44.1kHz mono keeps the loop
 * seam sample-exact; the tail is digital silence, so the seam cannot click):
 *   ffmpeg -y -i assets/audio/sfx/bert-voice-tick.m4a -af apad -t 0.090 \
 *     -ar 44100 -ac 1 -c:a pcm_s16le assets/audio/sfx/bert-voice-loop.wav
 */
const VOICE_SOURCE = require('../../assets/audio/sfx/bert-voice-loop.wav');

/** Copy this short is a one-liner, not a message box. */
const SHORT_MESSAGE_CHARS = 45;
/** Copy longer than this is a full paragraph. */
const LONG_MESSAGE_CHARS = 130;
export const SHORT_MESSAGE_MS = 1_000;
export const REGULAR_MESSAGE_MIN_MS = 1_300;
export const REGULAR_MESSAGE_MAX_MS = 1_700;
export const LONG_MESSAGE_MS = 1_900;

/**
 * How long Bert talks for one bubble of copy.
 *
 * The regular band is randomised because most beats land in it: a fixed length
 * makes consecutive bubbles tick for an identical, metronomic beat, which reads
 * as a sound effect rather than someone talking.
 */
export function bertVoiceDurationMs(spoken: string): number {
  const length = spoken.trim().length;
  if (length === 0) return 0;
  if (length <= SHORT_MESSAGE_CHARS) return SHORT_MESSAGE_MS;
  if (length > LONG_MESSAGE_CHARS) return LONG_MESSAGE_MS;
  const spread = REGULAR_MESSAGE_MAX_MS - REGULAR_MESSAGE_MIN_MS;
  return REGULAR_MESSAGE_MIN_MS + Math.round(Math.random() * spread);
}

let player: AudioPlayer | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Bumped by every start and every stop, so a seek that resolves after the line
 * it belonged to has ended cannot start the loop again. Without it a page
 * change during the seek leaves Bert ticking with nothing left to stop him.
 */
let playToken = 0;
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
    const created = audio.createAudioPlayer(VOICE_SOURCE, {
      // Bert talks on nearly every guide beat; reopening the native audio
      // session for each bubble would clip the first tick off the front.
      keepAudioSessionActive: true,
    });
    created.volume = masterVolume;
    created.loop = true;
    player = created;
  } catch (error) {
    player = null;
    warnOnce('init failed — Bert voice disabled for this session', error);
  }
}

export function setBertVoiceMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  // Muting mid-sentence used to leave the loop running at volume 0: silent, but
  // still ticking until the message ran out. playBertVoice already refuses to
  // start while muted; this makes muting stop a line already in flight.
  if (masterVolume === 0) stopBertVoice();
  if (player === null) return;
  try {
    player.volume = masterVolume;
  } catch (error) {
    warnOnce('volume update failed', error);
  }
}

/** Stops the run of ticks immediately; safe to call when nothing is talking. */
export function stopBertVoice(): void {
  playToken += 1;
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
  const active = player;
  if (active === null || masterVolume === 0 || durationMs <= 0) return;
  stopBertVoice();
  const token = playToken;
  // The one seek of the line: a looping voice left parked at the end of its
  // clip ignores play(), so each bubble rewinds before it starts talking.
  active.seekTo(0)
    .then(() => {
      if (token !== playToken) return;
      active.play();
    })
    .catch((error: unknown) => warnOnce('playback failed', error));
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
