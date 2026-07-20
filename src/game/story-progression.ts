import type { GameState } from './types';

export const STORY_STARTING_ROSTER_SIZE = 15;
export const STORY_YOUTH_UNLOCK_WEEK = 3;
export const STORY_CUP_GUIDE_WEEK = 5;
export const STORY_SCOUT_UNLOCK_WEEK = 15;

/** Story-only pacing disappears after Season 1; established and headless careers keep every system. */
export function isStoryFeaturePacingActive(
  state: Pick<GameState, 'onboarding' | 'season'>,
): boolean {
  return state.onboarding !== undefined && state.season === 1;
}

export function isStoryYouthUnlocked(
  state: Pick<GameState, 'onboarding' | 'season' | 'week'>,
): boolean {
  return !isStoryFeaturePacingActive(state) || state.week >= STORY_YOUTH_UNLOCK_WEEK;
}

export function isStoryCupGuideUnlocked(
  state: Pick<GameState, 'onboarding' | 'season' | 'week'>,
): boolean {
  return !isStoryFeaturePacingActive(state) || state.week >= STORY_CUP_GUIDE_WEEK;
}

export function isStoryScoutingUnlocked(
  state: Pick<GameState, 'onboarding' | 'season' | 'week'>,
): boolean {
  return !isStoryFeaturePacingActive(state) || state.week >= STORY_SCOUT_UNLOCK_WEEK;
}
