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
  | 'super-training-yay'
  | 'super-celebration';

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
  // The supplied tap recording: a single 69ms attack that is silent after 28ms,
  // so a fast run of taps never overlaps itself. Kept as PCM rather than AAC —
  // a tap is the one cue where the decoder's priming delay is audible as lag.
  'ui-click': require('../../assets/audio/sfx/ui-tap.wav'),
  // Player and coach signings intentionally share this confirmation sound.
  'transaction-confirm': require('../../assets/audio/sfx/match-statement-positive.m4a'),
  'coach-departure': require('../../assets/audio/sfx/fulltime-whistle.wav'),
  'facility-start': require('../../assets/audio/sfx/advance-week.m4a'),
  'facility-complete': require('../../assets/audio/sfx/facility-complete.m4a'),
  // A gamble that paid off announces itself. This was the match crowd-cheer
  // wash, which read as stadium ambience rather than a result — a brass fanfare
  // is the cue that says the call was right. Trimmed to 3.55s (0.2s tail) and
  // level-matched to `positive`, the other celebration cue.
  'event-success': require('../../assets/audio/sfx/event-success-fanfare.m4a'),
  // Same tap as `ui-click`: one sound answers a press on the screen, whichever
  // cue name the caller reaches for.
  select: require('../../assets/audio/sfx/ui-tap.wav'),
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
  // Keep the lighter stepper character the controls were designed around. It
  // reads clearly over the menu bed — the taps that seemed to vanish under the
  // music were taps that never played, not taps that were too quiet.
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
  // The jingle under the SUPER takeover. Its 3.6s is the length of the
  // celebration itself, which played out in silence before this.
  // Appended last so existing player indices stay stable.
  //
  // This file is already the level-up cue the owner asked SUPER training to
  // use — re-encoding the supplied source reproduced it byte for byte, so the
  // sound was never the thing that was wrong. What was wrong is the crowd wash
  // that used to start underneath it; see `playSuperTrainingSfx`.
  'super-celebration': require('../../assets/audio/sfx/level-up.m4a'),
};

const players = new Map<ManagementSfxKey, AudioPlayer>();
const ownedPlayers = new Set<AudioPlayer>();
type RapidManagementSfxKey = 'ui-click' | 'stat-step';
const RAPID_SFX_KEYS: readonly RapidManagementSfxKey[] = ['ui-click', 'stat-step'];
const RAPID_SFX_POOL_SIZE = 4;
const rapidPlayers = new Map<RapidManagementSfxKey, AudioPlayer[]>();
const rapidPlayerCursor = new Map<RapidManagementSfxKey, number>();
let masterVolume = 1;
let initAttempted = false;
const warned = new Set<string>();

function warnOnce(context: string, error: unknown): void {
  if (warned.has(context)) return;
  warned.add(context);
  console.warn(`[management-sfx] ${context}`, error);
}

const RECOVERY_COOLDOWN_MS = 5000;
let lastRecoveryAt = 0;

/**
 * iOS tears down the audio-session server while the app sits in the background
 * (and a dev reload strands the previous context's players): every seek/play
 * then fails with "Session lookup failed". Dead native objects can't be
 * revived, so recovery releases the whole catalog and rebuilds it through the
 * normal init — same cue order, same pool sizes, so every player index stays
 * where the tests pin it. The cooldown keeps a device whose audio is genuinely
 * broken fail-soft instead of rebuilding 29 players on every tap.
 */
function tryRecoverManagementSfx(): boolean {
  const now = Date.now();
  if (now - lastRecoveryAt < RECOVERY_COOLDOWN_MS) return false;
  lastRecoveryAt = now;
  for (const player of ownedPlayers) {
    try {
      player.remove();
      player.release();
    } catch {
      // Already dead — that is why we are recovering.
    }
  }
  players.clear();
  ownedPlayers.clear();
  rapidPlayers.clear();
  rapidPlayerCursor.clear();
  initAttempted = false;
  initManagementSfx();
  return players.size > 0;
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
  // still completing. Four voices let human-speed steppers and button presses
  // overlap instead of cutting each other off.
  for (const key of RAPID_SFX_KEYS) {
    const firstPlayer = players.get(key);
    if (firstPlayer === undefined) continue;
    const pool = [firstPlayer];
    while (pool.length < RAPID_SFX_POOL_SIZE) {
      try {
        const player = audio.createAudioPlayer(MANAGEMENT_SFX[key], {
          keepAudioSessionActive: true,
        });
        player.volume = masterVolume;
        pool.push(player);
        ownedPlayers.add(player);
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
  // One cue, not two. The reveal used to lay a crowd wash under this sting and
  // the takeover's own jingle started on top of it a moment later; the jingle
  // is the celebration, and the sting is the hit that announces it.
  playManagementSfx('hero');
}

/** The jingle that runs under the SUPER takeover, from the moment it appears. */
export function playSuperCelebrationSfx(): void {
  playManagementSfx('super-celebration');
}

/** The cheer that lands as the SUPER takeover leaves the screen. */
export function playSuperTrainingYaySfx(): void {
  playManagementSfx('super-training-yay');
}

/**
 * The takeover can be tapped away long before its jingle ends, and a 3.6s
 * celebration still playing over the next screen is the loudest kind of stale.
 * Owned by the takeover itself, like the drill scene's progress bed.
 */
export function stopSuperCelebrationSfx(): void {
  try {
    players.get('super-celebration')?.pause();
  } catch (error) {
    warnOnce('super celebration stop failed', error);
  }
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
  const attempt = (isRetry: boolean): void => {
    const recoverOr = (label: string, error: unknown): void => {
      if (!isRetry && tryRecoverManagementSfx()) {
        attempt(true);
        return;
      }
      warnOnce(label, error);
    };
    const player = key === 'ui-click' || key === 'stat-step'
      ? nextRapidPlayer(key)
      : players.get(key);
    if (player === undefined || masterVolume === 0) return;
    // Every cue rewinds before it plays, rapid ones included. A voice parked at
    // the end of its clip ignores play() outright and the tap is silent, and JS
    // cannot know when a voice got there: playback begins some unmeasured time
    // after play() returns, so a timer that rewinds on a fixed delay lands mid-
    // clip as often as not — and a seek does not stop playback, so that rewind
    // re-fires the transient and one press is heard twice. The pool below is
    // what keeps quick repeats from cutting each other off; the seek is what
    // makes each press sound exactly once.
    try {
      player.seekTo(0)
        .then(() => player.play())
        .catch((error: unknown) => recoverOr(`${key} playback failed`, error));
    } catch (error) {
      recoverOr(`${key} playback failed`, error);
    }
  };
  attempt(false);
}

/** Round-robins the pooled voices so overlapping taps never share a playhead. */
function nextRapidPlayer(key: RapidManagementSfxKey): AudioPlayer | undefined {
  const pool = rapidPlayers.get(key);
  if (pool === undefined || pool.length === 0) return undefined;
  const cursor = rapidPlayerCursor.get(key) ?? 0;
  rapidPlayerCursor.set(key, (cursor + 1) % pool.length);
  return pool[cursor % pool.length];
}

export function teardownManagementSfx(): void {
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
  initAttempted = false;
  lastRecoveryAt = 0;
  warned.clear();
}
