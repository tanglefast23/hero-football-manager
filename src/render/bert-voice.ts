// Bert "speaks" for as long as the bubble's copy takes to say — 1s for a
// one-liner, 1.9s for a full paragraph. Presentation-only and fail-soft, so
// headless Jest and an out-of-date native dev client still render the guide
// with no audio.
import type { AudioPlayer } from 'expo-audio';
import { registerAudioOwner } from './audio-lifecycle';

/**
 * The supplied dialogue run: 8.8s of continuous chatter, entered at an
 * arbitrary point and cut off when the line ends.
 *
 * It replaces a 20ms tick this module looped at a 90ms cadence. The clip
 * outlasts the longest line by more than four times, so the loop is gone with
 * it, and so is the seam that forced the tick to be a mono 44.1kHz file.
 *
 * What has NOT changed is the one constraint the tick was built around: exactly
 * one seek per bubble. iOS retires an `AudioPlayer` seek by cancelling it when
 * the next one arrives, so a voice re-seeked on a timer plays only its first
 * sound. Keep it to a single seek per line.
 *
 * Rebuild after replacing the recording — the raw take arrives well below every
 * other cue, so it has to be brought up or Bert is inaudible under the music:
 *   ffmpeg -y -i assets/audio/sfx/dialogue2.m4a \
 *     -c:a aac -b:a 96k -ar 44100 -ac 1 \
 *     assets/audio/sfx/bert-voice-dialogue2.m4a
 *   node scripts/audio/normalize-levels.mjs
 * The gain is no longer hand-picked: the levels pass measures the copy and
 * brings it to the same loudness as every other SFX cue.
 */
const VOICE_SOURCE = require('../../assets/audio/sfx/bert-voice-dialogue2.m4a');
/** Length of the clip, and the most any one line can consume of it. */
const VOICE_CLIP_SECONDS = 8.8;
const LONGEST_LINE_SECONDS = 2;

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
    // No loop: the clip runs four times longer than the longest line, so its
    // end is unreachable and looping would only matter if it were not.
    created.loop = false;
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
  // The one seek of the line, landing somewhere new each time. Entering at 0
  // would open every bubble on the identical syllables and differ only in where
  // it stopped — the same metronomic problem the randomised duration above
  // exists to avoid, moved from the length to the content.
  const offset = Math.random() * (VOICE_CLIP_SECONDS - LONGEST_LINE_SECONDS);
  active.seekTo(offset)
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
