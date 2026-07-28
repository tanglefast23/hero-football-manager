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
  // The steppers keep the light tap, not the push-button click — the heavier
  // click is what `ui-click` uses, and on the steppers it reads as too blunt.
  // The gain cannot live in playback: every cue already plays at the 1.0
  // volume ceiling and expo-audio clamps there, so it is baked into the asset.
  //
  // `stat-step-tap-loud.m4a` is `stat-step-tap.m4a` at 1.6x with a soft knee
  // (sample ceiling -0.5dBFS, top rounded rather than squared off). Measured
  // gain is +1.9 LU (-20.1 -> -18.2 LUFS), not the full +4.1 the 1.6x implies:
  // the tap is an 85ms transient already peaking over full scale, so its crest
  // factor eats the rest. Pushing past ~2x only trades grit for ~1dB more.
  'stat-step': require('../../assets/audio/sfx/stat-step-tap-loud.m4a'),
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
const ownedPlayers = new Set<AudioPlayer>();
type RapidManagementSfxKey = 'ui-click' | 'stat-step';
const RAPID_SFX_KEYS: readonly RapidManagementSfxKey[] = ['ui-click', 'stat-step'];
const RAPID_SFX_POOL_SIZE = 4;
const RAPID_SFX_REWIND_DELAY_MS: Record<RapidManagementSfxKey, number> = {
  'ui-click': 480,
  'stat-step': 120,
};
const rapidPlayers = new Map<RapidManagementSfxKey, AudioPlayer[]>();
const rapidPlayerCursor = new Map<RapidManagementSfxKey, number>();
const rapidPlayerReady = new Set<AudioPlayer>();
const rapidPlayerGeneration = new Map<AudioPlayer, number>();
const rapidPlayerRewindTimers = new Map<AudioPlayer, ReturnType<typeof setTimeout>>();
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
      const player = audio.createAudioPlayer(MANAGEMENT_SFX[key], {
        // A button must not reopen the native audio session on every tap.
        keepAudioSessionActive: true,
      });
      player.volume = masterVolume;
      players.set(key, player);
      ownedPlayers.add(player);
    } catch (error) {
      warnOnce(`${key} failed to load; that cue is silent for this session`, error);
    }
  }

  // One AVPlayer cannot restart a transient for every quick repeated tap: a
  // second seek/play pair can overtake the first while its asynchronous seek is
  // still completing. Four warm voices let human-speed steppers and button
  // presses overlap, then each voice rewinds while the other three are free.
  for (const key of RAPID_SFX_KEYS) {
    const firstPlayer = players.get(key);
    if (firstPlayer === undefined) continue;
    const pool = [firstPlayer];
    rapidPlayerReady.add(firstPlayer);
    while (pool.length < RAPID_SFX_POOL_SIZE) {
      try {
        const player = audio.createAudioPlayer(MANAGEMENT_SFX[key], {
          keepAudioSessionActive: true,
        });
        player.volume = masterVolume;
        pool.push(player);
        ownedPlayers.add(player);
        rapidPlayerReady.add(player);
      } catch (error) {
        warnOnce(`${key} rapid player failed to load; repeated taps may be delayed`, error);
        break;
      }
    }
    rapidPlayers.set(key, pool);
    rapidPlayerCursor.set(key, 0);
  }
}

export function setManagementSfxMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));
  // App calls this on mount, before a player can reach a management button.
  // Initialising here keeps asset/player construction off the first real tap.
  initManagementSfx();
  // Called straight from a React effect, so a throwing native setter here would
  // take the render with it — every other module in this folder guards its own.
  for (const player of ownedPlayers) {
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
  if (key === 'ui-click' || key === 'stat-step') {
    playRapidManagementSfx(key);
    return;
  }
  const player = players.get(key);
  if (player === undefined || masterVolume === 0) return;
  player.seekTo(0)
    .then(() => player.play())
    .catch((error: unknown) => warnOnce(`${key} playback failed`, error));
}

function playRapidManagementSfx(key: RapidManagementSfxKey): void {
  const pool = rapidPlayers.get(key);
  if (pool === undefined || pool.length === 0 || masterVolume === 0) return;
  const cursor = rapidPlayerCursor.get(key) ?? 0;
  const player = pool[cursor % pool.length];
  rapidPlayerCursor.set(key, (cursor + 1) % pool.length);

  const generation = (rapidPlayerGeneration.get(player) ?? 0) + 1;
  rapidPlayerGeneration.set(player, generation);
  const previousTimer = rapidPlayerRewindTimers.get(player);
  if (previousTimer !== undefined) clearTimeout(previousTimer);

  const playAndPrepareNextTap = (): void => {
    if (rapidPlayerGeneration.get(player) !== generation) return;
    try {
      rapidPlayerReady.delete(player);
      player.play();
      const timer = setTimeout(() => {
        rapidPlayerRewindTimers.delete(player);
        if (rapidPlayerGeneration.get(player) !== generation) return;
        player.seekTo(0, 0, 0)
          .then(() => {
            if (rapidPlayerGeneration.get(player) === generation) {
              rapidPlayerReady.add(player);
            }
          })
          .catch((error: unknown) => warnOnce(`${key} rewind failed`, error));
      }, RAPID_SFX_REWIND_DELAY_MS[key]);
      rapidPlayerRewindTimers.set(player, timer);
    } catch (error) {
      warnOnce(`${key} playback failed`, error);
    }
  };

  if (rapidPlayerReady.has(player)) {
    // Fresh and pre-rewound voices start synchronously with the press.
    playAndPrepareNextTap();
    return;
  }

  // This only occurs beyond the four-voice human-speed pool. It still restarts
  // reliably instead of letting a play() at the end of the clip disappear.
  player.seekTo(0, 0, 0)
    .then(playAndPrepareNextTap)
    .catch((error: unknown) => warnOnce(`${key} restart failed`, error));
}

export function teardownManagementSfx(): void {
  for (const timer of rapidPlayerRewindTimers.values()) clearTimeout(timer);
  rapidPlayerRewindTimers.clear();
  for (const player of ownedPlayers) {
    try {
      player.pause();
      player.remove();
      player.release();
    } catch (error) {
      warnOnce('player teardown failed', error);
    }
  }
  players.clear();
  ownedPlayers.clear();
  rapidPlayers.clear();
  rapidPlayerCursor.clear();
  rapidPlayerReady.clear();
  rapidPlayerGeneration.clear();
  initAttempted = false;
  warned.clear();
}
