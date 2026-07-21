import type { GameState } from './types';

export const STORY_STARTING_ROSTER_SIZE = 15;
export const STORY_YOUTH_UNLOCK_WEEK = 3;
export const STORY_CUP_GUIDE_WEEK = 5;
export const STORY_SCOUT_UNLOCK_WEEK = 15;

/** Every full Season 1 career uses the story pace, including migrated saves without onboarding state. */
export function isStoryFeaturePacingActive(
  state: Pick<GameState, 'careerMode' | 'season'>,
): boolean {
  return state.careerMode === 'full' && state.season === 1;
}

export function isStoryYouthUnlocked(
  state: Pick<GameState, 'careerMode' | 'season' | 'week'>,
): boolean {
  return !isStoryFeaturePacingActive(state) || state.week >= STORY_YOUTH_UNLOCK_WEEK;
}

export function isStoryCupGuideUnlocked(
  state: Pick<GameState, 'careerMode' | 'season' | 'week'>,
): boolean {
  return !isStoryFeaturePacingActive(state) || state.week >= STORY_CUP_GUIDE_WEEK;
}

export function isStoryScoutingUnlocked(
  state: Pick<GameState, 'careerMode' | 'season' | 'week'>,
): boolean {
  return !isStoryFeaturePacingActive(state) || state.week >= STORY_SCOUT_UNLOCK_WEEK;
}
