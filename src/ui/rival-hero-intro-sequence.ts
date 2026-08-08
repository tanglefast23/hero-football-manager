export type RivalHeroIntroPhase = 'power' | 'power-exit' | 'speech' | 'done';

export const RIVAL_HERO_POWER_INTRO_MS = 240;
export const RIVAL_HERO_POWER_HOLD_MS = 2760;
export const RIVAL_HERO_POWER_EXIT_MS = 300;
export const RIVAL_HERO_SPEECH_HOLD_MS = 3000;
export const RIVAL_HERO_LAUGH_DELAY_MS = 1000;

/**
 * React Native Web reports screen-reader support as enabled for every browser,
 * rather than detecting assistive technology. Using that placeholder result
 * would disable the signed-off three-second auto-advance for every web player.
 * The existing Reduce Motion preference remains an explicit non-timed route
 * for web players who need one.
 */
export function rivalHeroScreenReaderTimingState(
  platform: string,
  detectedState: boolean | null,
  reduceMotion: boolean,
): boolean | null {
  return platform === 'web' ? reduceMotion : detectedState;
}

/** Absolute speech-beat time when the assigned laugh should begin. */
export function rivalHeroLaughStartMs(dialogueDurationMs: number): number {
  return Math.max(0, dialogueDurationMs) + RIVAL_HERO_LAUGH_DELAY_MS;
}

function timedAutoExitMs(
  screenReaderEnabled: boolean | null,
  appActive: boolean,
  durationMs: number,
): number | undefined {
  return screenReaderEnabled === false && appActive ? durationMs : undefined;
}

export function rivalHeroPowerAutoExitMs(
  screenReaderEnabled: boolean | null,
  appActive: boolean,
): number | undefined {
  return timedAutoExitMs(
    screenReaderEnabled,
    appActive,
    RIVAL_HERO_POWER_INTRO_MS + RIVAL_HERO_POWER_HOLD_MS,
  );
}

export function rivalHeroSpeechAutoExitMs(
  screenReaderEnabled: boolean | null,
  appActive: boolean,
): number | undefined {
  return timedAutoExitMs(
    screenReaderEnabled,
    appActive,
    RIVAL_HERO_SPEECH_HOLD_MS,
  );
}

/** One input advances one semantic beat; the exiting card consumes extras. */
export function advanceRivalHeroIntroPhase(
  phase: RivalHeroIntroPhase,
): RivalHeroIntroPhase {
  if (phase === 'power') return 'power-exit';
  if (phase === 'power-exit') return 'power-exit';
  if (phase === 'speech') return 'done';
  return 'done';
}
