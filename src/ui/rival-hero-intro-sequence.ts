export type RivalHeroIntroPhase = 'power' | 'power-exit' | 'speech' | 'done';

export const RIVAL_HERO_POWER_INTRO_MS = 240;
export const RIVAL_HERO_POWER_HOLD_MS = 1400;
export const RIVAL_HERO_POWER_EXIT_MS = 300;

export function rivalHeroPowerAutoExitMs(
  screenReaderEnabled: boolean | null,
  appActive: boolean,
): number | undefined {
  return screenReaderEnabled === false && appActive
    ? RIVAL_HERO_POWER_INTRO_MS + RIVAL_HERO_POWER_HOLD_MS
    : undefined;
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
