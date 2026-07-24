// Bert's "voice": four short dialogue bleeps played back-to-back, each randomly
// one of two samples, so every briefing line sounds a little different (Animal
// Crossing "animalese" style). Presentation-only and fail-soft — headless Jest
// and an out-of-date native dev client still render the guide with no audio.
import type { AudioPlayer, AudioSource } from 'expo-audio';

const VOICE_SOURCES: AudioSource[] = [
  require('../../assets/audio/sfx/bert-voice-1.wav'),
  require('../../assets/audio/sfx/bert-voice-2.wav'),
];

// Each sample carries ~0.28s of sound at its head; four bleeps at this spacing
// read as one spoken line just over a second long, with no clip talking over
// the previous one.
const CLIPS_PER_LINE = 4;
const CLIP_GAP_MS = 280;

const players: AudioPlayer[] = [];
const pending: Array<ReturnType<typeof setTimeout>> = [];
const warned = new Set<string>();
let masterVolume = 1;
let initAttempted = false;
let ready = false;

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
    for (const source of VOICE_SOURCES) {
      const player = audio.createAudioPlayer(source);
      player.volume = masterVolume;
      players.push(player);
    }
    ready = true;
  } catch (error) {
    players.length = 0;
    ready = false;
    warnOnce('init failed — Bert voice disabled for this session', error);
  }
}

export function setBertVoiceMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  for (const player of players) {
    try {
      player.volume = masterVolume;
    } catch (error) {
      warnOnce('volume update failed', error);
    }
  }
}

/** Cancels any bleeps still queued from a previous line. */
export function stopBertVoice(): void {
  for (const timer of pending) clearTimeout(timer);
  pending.length = 0;
}

/** Plays one spoken line: CLIPS_PER_LINE bleeps, each a random one of two samples. */
export function playBertVoice(): void {
  initBertVoice();
  if (!ready || masterVolume === 0 || players.length === 0) return;
  stopBertVoice();
  for (let clip = 0; clip < CLIPS_PER_LINE; clip += 1) {
    const timer = setTimeout(() => {
      const player = players[Math.random() < 0.5 ? 0 : players.length - 1];
      try {
        player.seekTo(0)
          .then(() => player.play())
          .catch((error: unknown) => warnOnce('bleep playback failed', error));
      } catch (error) {
        warnOnce('bleep playback failed', error);
      }
    }, clip * CLIP_GAP_MS);
    pending.push(timer);
  }
}

export function teardownBertVoice(): void {
  stopBertVoice();
  for (const player of players) {
    try {
      player.pause();
      player.remove();
      player.release();
    } catch (error) {
      warnOnce('teardown failed', error);
    }
  }
  players.length = 0;
  ready = false;
  initAttempted = false;
}
