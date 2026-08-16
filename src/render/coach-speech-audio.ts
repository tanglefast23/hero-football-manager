// Owns the half-time motivational speech cutscene's three sounds: the thunder
// crack that opens it, the gospel bed that runs underneath it, and the coach's
// talking voice.
//
// Modelled on `awakening-audio` (a bed plus one-shots, owned by one cutscene)
// and `bert-voice` (a talking voice driven by how long a line takes to read).
// Fail-soft like both: headless Jest has no `expo-audio` at all, and an
// out-of-date native client disables the cutscene's sound without blocking the
// cutscene itself.
import type { AudioPlayer, AudioSource } from 'expo-audio';
import { registerAudioOwner } from './audio-lifecycle';

const THUNDER_SOURCE: AudioSource = require('../../assets/audio/sfx/speech-thunder.m4a');
const GOSPEL_SOURCE: AudioSource = require('../../assets/audio/music/speech-gospel.m4a');
/**
 * The coach's voice. 5.9s of continuous speech-shaped noise, entered at an
 * arbitrary point and cut off when the line ends — the same trick `bert-voice`
 * uses, and for the same reason: entering at 0 every time opens each bubble on
 * identical syllables and reads as a sound effect rather than someone talking.
 *
 * Rebuild after replacing the recording, then re-run the levels pass so it sits
 * at the same loudness as every other cue:
 *   ffmpeg -y -i <source> -c:a aac -b:a 96k -ar 44100 -ac 1 \
 *     assets/audio/sfx/coach-voice.m4a
 *   node scripts/audio/normalize-levels.mjs
 */
const VOICE_SOURCE: AudioSource = require('../../assets/audio/sfx/coach-voice.m4a');

/** Length of the voice clip, and the most any one line may consume of it. */
const VOICE_CLIP_SECONDS = 5.8;
const LONGEST_LINE_SECONDS = 2;

/**
 * Music beds play at half, under the effects — the same rule `menu-audio`,
 * `celebration-audio` and `awakening-audio` follow. The gospel is a bed.
 */
const MUSIC_VOLUME = 0.5;

let thunderPlayer: AudioPlayer | null = null;
let gospelPlayer: AudioPlayer | null = null;
let voicePlayer: AudioPlayer | null = null;
let voiceStopTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Bumped by every start and every stop, so a seek that resolves after the line
 * it belonged to has ended cannot start the voice again. Without it, tapping
 * through lines faster than the seeks resolve leaves the coach talking over
 * a cutscene that has already finished.
 */
let voiceToken = 0;
let ready = false;
let initAttempted = false;
let warned = false;
let masterVolume = 1;

function warnOnce(context: string, error: unknown): void {
  if (warned) return;
  warned = true;
  console.warn(`[coach-speech-audio] ${context}`, error);
}

function setPlayerVolume(
  player: AudioPlayer | null,
  baseVolume: number,
  context: string,
): void {
  if (!player) return;
  try {
    player.volume = baseVolume * masterVolume;
    // Programmatic volume is a no-op in browsers on iOS; `muted` is not.
    player.muted = masterVolume === 0;
  } catch (error) {
    warnOnce(`${context} volume failed`, error);
  }
}

export function setCoachSpeechMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  // Muting mid-line must stop a line already in flight, not leave it ticking
  // silently to its end. `playCoachVoice` already refuses to start while muted.
  if (masterVolume === 0) stopCoachVoice();
  setPlayerVolume(thunderPlayer, 1, 'thunder');
  setPlayerVolume(gospelPlayer, MUSIC_VOLUME, 'gospel');
  setPlayerVolume(voicePlayer, 1, 'voice');
}

export function initCoachSpeechAudio(): void {
  if (initAttempted) return;
  initAttempted = true;

  try {
    const audio = require('expo-audio') as typeof import('expo-audio');

    try {
      thunderPlayer = audio.createAudioPlayer(THUNDER_SOURCE);
    } catch (error) {
      thunderPlayer = null;
      warnOnce('createAudioPlayer failed (thunder)', error);
    }

    try {
      gospelPlayer = audio.createAudioPlayer(GOSPEL_SOURCE);
      // The bed is trimmed to just outlast the cutscene, so its end is
      // unreachable and looping would only matter if it were not.
      gospelPlayer.loop = false;
    } catch (error) {
      gospelPlayer = null;
      warnOnce('createAudioPlayer failed (gospel)', error);
    }

    try {
      voicePlayer = audio.createAudioPlayer(VOICE_SOURCE, {
        // The coach talks on every line and on every tap; reopening the native
        // audio session per line would clip the first syllable off the front.
        keepAudioSessionActive: true,
      });
      voicePlayer.loop = false;
    } catch (error) {
      voicePlayer = null;
      warnOnce('createAudioPlayer failed (voice)', error);
    }

    ready =
      thunderPlayer !== null || gospelPlayer !== null || voicePlayer !== null;
    setCoachSpeechMasterVolume(masterVolume);
  } catch (error) {
    thunderPlayer = null;
    gospelPlayer = null;
    voicePlayer = null;
    ready = false;
    warnOnce(
      'init failed — speech cutscene sound disabled for this session',
      error,
    );
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

function playFromStart(player: AudioPlayer | null, context: string): void {
  if (!player) return;
  try {
    // Rewind first, THEN play. `seekTo(0); play()` runs play-then-seek on
    // device: replaying a finished clip no-ops the play, and the late seek
    // rewinds it while stopped. This is the documented "no SFX on device" bug
    // in `audio.ts`, and it bites any new module that gets the order wrong.
    player
      .seekTo(0)
      .then(() => player.play())
      .catch((error: unknown) =>
        warnOnce(`${context} seek/play failed`, error),
      );
  } catch (error) {
    warnOnce(`${context} playback failed`, error);
  }
}

/** The crack that opens the cutscene. */
export function playSpeechThunder(): void {
  initCoachSpeechAudio();
  if (!ready || masterVolume === 0) return;
  playFromStart(thunderPlayer, 'thunder');
}

/** The bed under the whole cutscene. The match theme is paused by the caller. */
export function startSpeechGospel(): void {
  initCoachSpeechAudio();
  if (!ready || masterVolume === 0) return;
  playFromStart(gospelPlayer, 'gospel');
}

export function stopSpeechGospel(): void {
  pausePlayer(gospelPlayer, 'gospel');
}

/** Stops the voice immediately; safe to call when nothing is talking. */
export function stopCoachVoice(): void {
  voiceToken += 1;
  if (voiceStopTimer !== null) clearTimeout(voiceStopTimer);
  voiceStopTimer = null;
  pausePlayer(voicePlayer, 'voice');
}

/**
 * The coach talks for `durationMs`, then falls silent on his own.
 *
 * EXACTLY ONE SEEK PER LINE. iOS retires a pending `AudioPlayer` seek by
 * cancelling it when the next one arrives, so a voice re-seeked on a timer
 * plays only its first sound. The mouth-flap animation must never call this —
 * it runs on its own interval and touches no audio.
 */
export function playCoachVoice(durationMs: number): void {
  initCoachSpeechAudio();
  const active = voicePlayer;
  if (!ready || active === null || masterVolume === 0 || durationMs <= 0)
    return;
  stopCoachVoice();
  const token = voiceToken;
  const offset = Math.random() * (VOICE_CLIP_SECONDS - LONGEST_LINE_SECONDS);
  try {
    active
      .seekTo(offset)
      .then(() => {
        if (token !== voiceToken) return;
        active.play();
      })
      .catch((error: unknown) => warnOnce('voice playback failed', error));
  } catch (error) {
    warnOnce('voice playback failed', error);
  }
  voiceStopTimer = setTimeout(stopCoachVoice, durationMs);
}

/**
 * Silences everything this module is playing, without releasing anything.
 *
 * This is what `finish()` calls. It is NOT what unmount calls — see
 * `teardownCoachSpeechAudio`. The two are easy to confuse and the difference
 * matters: a finished cutscene may run again in the same match.
 */
export function stopCoachSpeechAudio(): void {
  stopCoachVoice();
  stopSpeechGospel();
  pausePlayer(thunderPlayer, 'thunder');
}

/**
 * Backgrounding cuts the cutscene off and there is nothing to resume: it is a
 * four-second beat the manager is no longer watching, and the match itself is
 * paused behind it.
 */
registerAudioOwner({
  suspend: stopCoachSpeechAudio,
  resume: () => {},
});

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

/** Silences AND releases the native players. Called from unmount. */
export function teardownCoachSpeechAudio(): void {
  stopCoachSpeechAudio();
  releasePlayer(thunderPlayer, 'thunder');
  releasePlayer(gospelPlayer, 'gospel');
  releasePlayer(voicePlayer, 'voice');
  thunderPlayer = null;
  gospelPlayer = null;
  voicePlayer = null;
  ready = false;
  initAttempted = false;
}
