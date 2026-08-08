import type { AudioPlayer, AudioSource } from 'expo-audio';
import type { RivalHeroIntroHeroId } from '../game/rival-hero-intro';
import { audioIsSuspended, registerAudioOwner } from './audio-lifecycle';

/** One authored laugh per division-headline rival, chosen to match their character. */
const RIVAL_HERO_LAUGH_SOURCES: Readonly<
  Record<RivalHeroIntroHeroId, AudioSource>
> = Object.freeze({
  'special-f171': require('../../assets/audio/sfx/rival-laugh-barry-allan.m4a'),
  'special-f178': require('../../assets/audio/sfx/rival-laugh-scott-somers.m4a'),
  'special-f174': require('../../assets/audio/sfx/rival-laugh-steve-rodgers.m4a'),
  'special-f176': require('../../assets/audio/sfx/rival-laugh-bruno-bannor.m4a'),
  'special-f168': require('../../assets/audio/sfx/rival-laugh-bruce-wain.m4a'),
});

const players = new Map<RivalHeroIntroHeroId, AudioPlayer>();
const warned = new Set<string>();
let activePlayer: AudioPlayer | null = null;
let pendingPlayer: AudioPlayer | null = null;
let masterVolume = 1;
let initAttempted = false;
let playToken = 0;

function warnOnce(context: string, error: unknown): void {
  if (warned.has(context)) return;
  warned.add(context);
  console.warn(`[rival-hero-voice] ${context}`, error);
}

function initRivalHeroVoice(): void {
  if (initAttempted) return;
  initAttempted = true;
  let audio: typeof import('expo-audio');
  try {
    audio = require('expo-audio') as typeof import('expo-audio');
  } catch (error) {
    warnOnce(
      'initialization failed; rival laughs disabled for this session',
      error,
    );
    return;
  }

  for (const heroId of Object.keys(
    RIVAL_HERO_LAUGH_SOURCES,
  ) as RivalHeroIntroHeroId[]) {
    try {
      const player = audio.createAudioPlayer(RIVAL_HERO_LAUGH_SOURCES[heroId], {
        keepAudioSessionActive: true,
      });
      player.loop = false;
      player.volume = masterVolume;
      players.set(heroId, player);
    } catch (error) {
      warnOnce(`${heroId} laugh failed to load`, error);
    }
  }
}

export function setRivalHeroVoiceMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  initRivalHeroVoice();
  if (masterVolume === 0) stopRivalHeroLaugh();
  for (const player of players.values()) {
    try {
      player.volume = masterVolume;
      player.muted = masterVolume === 0;
    } catch (error) {
      warnOnce('volume update failed', error);
    }
  }
}

export function stopRivalHeroLaugh(): void {
  cancelPendingRivalHeroLaugh();
  try {
    activePlayer?.pause();
  } catch (error) {
    warnOnce('laugh stop failed', error);
  }
  activePlayer = null;
}

/** Cancel a queued rewind without cutting off a one-shot that is already audible. */
export function cancelPendingRivalHeroLaugh(): void {
  if (pendingPlayer === null) return;
  playToken += 1;
  pendingPlayer = null;
}

export function playRivalHeroLaugh(heroId: RivalHeroIntroHeroId): void {
  initRivalHeroVoice();
  if (masterVolume === 0 || audioIsSuspended()) return;
  const player = players.get(heroId);
  if (player === undefined) return;
  stopRivalHeroLaugh();
  const token = playToken;
  pendingPlayer = player;
  try {
    player
      .seekTo(0)
      .then(() => {
        if (token !== playToken || pendingPlayer !== player) return;
        pendingPlayer = null;
        activePlayer = player;
        player.play();
      })
      .catch((error: unknown) => {
        if (token === playToken && pendingPlayer === player) {
          pendingPlayer = null;
        }
        if (token === playToken && activePlayer === player) {
          activePlayer = null;
        }
        warnOnce(`${heroId} laugh playback failed`, error);
      });
  } catch (error) {
    if (token === playToken && pendingPlayer === player) pendingPlayer = null;
    warnOnce(`${heroId} laugh playback failed`, error);
  }
}

registerAudioOwner({
  suspend: stopRivalHeroLaugh,
  resume: () => {},
});

export function teardownRivalHeroVoice(): void {
  stopRivalHeroLaugh();
  for (const player of players.values()) {
    try {
      player.remove();
      player.release();
    } catch (error) {
      warnOnce('player teardown failed', error);
    }
  }
  players.clear();
  initAttempted = false;
  warned.clear();
}
