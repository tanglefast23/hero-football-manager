// Owns short management-screen feedback sounds. Kept fail-soft so an older
// native dev client can still render the review UI when expo-audio is absent.
import type { AudioPlayer, AudioSource } from 'expo-audio';

export type ManagementActionCue =
  | 'select'
  | 'cash'
  | 'build'
  | 'dispatch'
  | 'card'
  | 'success'
  | 'hero'
  | 'warning';

type ManagementSfxKey = 'match-statement' | 'training-ding' | ManagementActionCue;

const MANAGEMENT_SFX: Record<ManagementSfxKey, AudioSource> = {
  'match-statement': require('../../assets/audio/sfx/match-statement-positive.m4a'),
  'training-ding': require('../../assets/audio/sfx/training-stat-ding.m4a'),
  select: require('../../assets/audio/sfx/training-stat-ding.m4a'),
  cash: require('../../assets/audio/sfx/save-slap.wav'),
  build: require('../../assets/audio/sfx/tackle-thud.m4a'),
  dispatch: require('../../assets/audio/sfx/save-slap.wav'),
  card: require('../../assets/audio/sfx/save-slap.wav'),
  success: require('../../assets/audio/sfx/plan-locked-chime.m4a'),
  hero: require('../../assets/audio/sfx/zone-enter.m4a'),
  warning: require('../../assets/audio/sfx/card-whistle.wav'),
};

const players = new Map<ManagementSfxKey, AudioPlayer>();
let masterVolume = 1;
let initAttempted = false;
const warned = new Set<string>();

function warnOnce(context: string, error: unknown): void {
  if (warned.has(context)) return;
  warned.add(context);
  console.warn(`[management-sfx] ${context}`, error);
}

function initManagementSfx(): void {
  if (initAttempted) return;
  initAttempted = true;
  try {
    const audio = require('expo-audio') as typeof import('expo-audio');
    for (const key of Object.keys(MANAGEMENT_SFX) as ManagementSfxKey[]) {
      const player = audio.createAudioPlayer(MANAGEMENT_SFX[key]);
      player.volume = masterVolume;
      players.set(key, player);
    }
  } catch (error) {
    players.clear();
    warnOnce('initialization failed; review sounds disabled for this session', error);
  }
}

export function setManagementSfxMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  for (const player of players.values()) player.volume = masterVolume;
}

export function playTrainingStatDing(): void {
  playManagementSfx('training-ding');
}

export function playMatchStatementSfx(): void {
  playManagementSfx('match-statement');
}

/** Short semantic cues shared by management screens; presentation-only and fail-soft. */
export function playManagementActionSfx(cue: ManagementActionCue): void {
  playManagementSfx(cue);
}

export function stopMatchStatementSfx(): void {
  try {
    players.get('match-statement')?.pause();
  } catch (error) {
    warnOnce('match statement stop failed', error);
  }
}

function playManagementSfx(key: ManagementSfxKey): void {
  initManagementSfx();
  const player = players.get(key);
  if (player === undefined || masterVolume === 0) return;
  player.seekTo(0)
    .then(() => player.play())
    .catch((error: unknown) => warnOnce(`${key} playback failed`, error));
}

export function teardownManagementSfx(): void {
  for (const [key, player] of players) {
    try {
      player.pause();
      player.remove();
      player.release();
    } catch (error) {
      warnOnce(`${key} teardown failed`, error);
    }
  }
  players.clear();
  initAttempted = false;
  warned.clear();
}
