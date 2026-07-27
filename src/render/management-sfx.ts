// Owns short management-screen feedback sounds. Kept fail-soft so an older
// native dev client can still render the review UI when expo-audio is absent.
import type { AudioPlayer, AudioSource } from 'expo-audio';

type ExplicitManagementSfxKey =
  | 'match-statement'
  | 'training-ding'
  | 'ui-click'
  | 'transaction-confirm'
  | 'coach-departure'
  | 'facility-start'
  | 'facility-complete'
  | 'event-success'
  | 'stat-step'
  | 'drill-progress'
  | 'drill-gain-reveal'
  | 'super-training-yay';

export type ManagementActionCue =
  | 'select'
  | 'cash'
  | 'build'
  | 'dispatch'
  | 'card'
  | 'success'
  | 'hero'
  | 'warning'
  | 'positive'
  | 'danger';

type ManagementSfxKey = ExplicitManagementSfxKey | ManagementActionCue;

const MANAGEMENT_SFX: Record<ManagementSfxKey, AudioSource> = {
  'match-statement': require('../../assets/audio/sfx/match-statement-positive.m4a'),
  'training-ding': require('../../assets/audio/sfx/training-stat-ding.m4a'),
  // A real push-button click: the old 80ms tap was too slight to register under
  // the music bed, so small buttons read as dead.
  'ui-click': require('../../assets/audio/sfx/ui-push-button.m4a'),
  // Player and coach signings intentionally share this confirmation sound.
  'transaction-confirm': require('../../assets/audio/sfx/match-statement-positive.m4a'),
  'coach-departure': require('../../assets/audio/sfx/fulltime-whistle.wav'),
  'facility-start': require('../../assets/audio/sfx/advance-week.m4a'),
  'facility-complete': require('../../assets/audio/sfx/facility-complete.m4a'),
  'event-success': require('../../assets/audio/sfx/crowd-cheer.wav'),
  select: require('../../assets/audio/sfx/ui-push-button.m4a'),
  cash: require('../../assets/audio/sfx/save-slap.wav'),
  build: require('../../assets/audio/sfx/tackle-thud.m4a'),
  dispatch: require('../../assets/audio/sfx/save-slap.wav'),
  card: require('../../assets/audio/sfx/save-slap.wav'),
  success: require('../../assets/audio/sfx/plan-locked-chime.m4a'),
  hero: require('../../assets/audio/sfx/zone-enter.m4a'),
  // The supplied negative cue. This is the "you cannot do that" sound the UI
  // plays at a blocked tap, and it used to be the referee's card whistle —
  // far too harsh for a menu, and it also made a denied drill sound like a
  // booking. The whistle stays in `audio.ts`, where an actual card is shown.
  warning: require('../../assets/audio/sfx/negative.m4a'),
  // Reusable celebratory cue for positive outcomes (e.g. signing a player).
  // Appended last so existing player indices stay stable.
  positive: require('../../assets/audio/sfx/positive.m4a'),
  // Steppers get their own light tap rather than the push-button used for
  // commits. A stat point or a hair swatch is one notch of an adjustment the
  // player makes a dozen times in a row, and the heavier click made each notch
  // sound like a decision.
  'stat-step': require('../../assets/audio/sfx/ui-stat-step.m4a'),
  // Appended last, after `positive` and `stat-step`, so existing player indices
  // stay stable.
  'drill-progress': require('../../assets/audio/sfx/drill-progress.m4a'),
  'drill-gain-reveal': require('../../assets/audio/sfx/drill-gain-reveal.m4a'),
  'super-training-yay': require('../../assets/audio/sfx/super-training-yay.m4a'),
  // Dismissing a coach or erasing a save used to answer with `positive`, the
  // signing chime — a celebration for the one class of tap the manager may
  // regret. This is the softer back-button cue: it confirms without applauding.
  // Appended last so existing player indices stay stable.
  danger: require('../../assets/audio/sfx/back-button.m4a'),
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
  let audio: typeof import('expo-audio');
  try {
    audio = require('expo-audio') as typeof import('expo-audio');
  } catch (error) {
    // No audio module at all (headless Jest, an out-of-date dev client) — the
    // whole catalog is unavailable and every play() becomes a no-op.
    warnOnce('initialization failed; review sounds disabled for this session', error);
    return;
  }
  // One cue failing to load is that cue's problem. Clearing the map on the first
  // failure threw away every player already built, silencing the whole app for
  // the session over a single bad asset.
  for (const key of Object.keys(MANAGEMENT_SFX) as ManagementSfxKey[]) {
    try {
      const player = audio.createAudioPlayer(MANAGEMENT_SFX[key]);
      player.volume = masterVolume;
      players.set(key, player);
    } catch (error) {
      warnOnce(`${key} failed to load; that cue is silent for this session`, error);
    }
  }
}

export function setManagementSfxMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  // Called straight from a React effect, so a throwing native setter here would
  // take the render with it — every other module in this folder guards its own.
  for (const player of players.values()) {
    try {
      player.volume = masterVolume;
      player.muted = masterVolume === 0;
    } catch (error) {
      warnOnce('volume apply failed', error);
    }
  }
}

export function playTrainingStatDing(): void {
  playManagementSfx('training-ding');
}

/** Drill-result ding whose pitch climbs with the same-player tap streak. */
export function playDrillResultSfx(streak: number): void {
  initManagementSfx();
  const player = players.get('training-ding');
  if (player === undefined || masterVolume === 0) return;
  try {
    const rate = 1 + 0.06 * Math.max(0, Math.min(streak, 8));
    (player as unknown as { setPlaybackRate?: (rate: number) => void }).setPlaybackRate?.(rate);
  } catch (error) {
    warnOnce('training-ding pitch adjust failed', error);
  }
  player.seekTo(0)
    .then(() => player.play())
    .catch((error: unknown) => warnOnce('training-ding playback failed', error));
}

/** Big celebratory hit for a SUPER training session. */
export function playSuperTrainingSfx(): void {
  playManagementSfx('hero');
  playManagementSfx('event-success');
}

/** The cheer that lands as the SUPER takeover leaves the screen. */
export function playSuperTrainingYaySfx(): void {
  playManagementSfx('super-training-yay');
}

/**
 * Runs under the drill count-up and nothing else. The clip is a steady 4s
 * progress bed, so the caller starts it when the number starts climbing and
 * stops it the instant the number lands — the sound is the animation's length,
 * not its own.
 */
export function playDrillProgressSfx(): void {
  playManagementSfx('drill-progress');
}

export function stopDrillProgressSfx(): void {
  try {
    players.get('drill-progress')?.pause();
  } catch (error) {
    warnOnce('drill progress stop failed', error);
  }
}

/** The hit under the big "+N STAT" reveal once the count-up has landed. */
export function playDrillGainRevealSfx(): void {
  playManagementSfx('drill-gain-reveal');
}

export function playMatchStatementSfx(): void {
  playManagementSfx('match-statement');
}

export function playUiClickSfx(): void {
  playManagementSfx('ui-click');
  playTapHaptic();
}

export function playStatStepSfx(): void {
  playManagementSfx('stat-step');
  playTapHaptic();
}

export function playTransactionConfirmSfx(): void {
  playManagementSfx('transaction-confirm');
}

export function playCoachDepartureSfx(): void {
  playManagementSfx('coach-departure');
}

export function playFacilityStartSfx(): void {
  playManagementSfx('facility-start');
}

export function playFacilityCompleteSfx(): void {
  playManagementSfx('facility-complete');
}

export function playEventSuccessSfx(): void {
  playManagementSfx('event-success');
}

/** Short, upbeat cue for positive outcomes (signings, confirmations); fail-soft. */
export function playPositiveSfx(): void {
  playManagementSfx('positive');
}

/** Softer cue for a destructive commit — confirms the tap without celebrating it. */
export function playDangerSfx(): void {
  playManagementSfx('danger');
}

/** Short semantic cues shared by management screens; presentation-only and fail-soft. */
export function playManagementActionSfx(cue: ManagementActionCue): void {
  playManagementSfx(cue);
  if (cue === 'select') playTapHaptic();
}

function playTapHaptic(): void {
  try {
    const haptics = require('./haptics') as typeof import('./haptics');
    haptics.playManagementHaptic('tap');
  } catch (error) {
    warnOnce('tap haptic failed; sound remains available', error);
  }
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
