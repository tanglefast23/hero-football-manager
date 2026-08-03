import type { GameState } from './types';

/**
 * Set the first time the club's crowd grows, whatever brought them in — a cup
 * run, a good week in the papers, or the step up a division gives.
 *
 * Written where the fans are added rather than derived afterwards. The count
 * also falls (a board forced sale, a bad story outcome), so "more than the club
 * started with" would forget a career that won a hundred neutrals and then lost
 * them again — and that career has still gained fans once.
 */
export const FIRST_FAN_GAIN_FLAG = 'club:first-fan-gain';

/** Records the first positive fan movement. Idempotent; a loss records nothing. */
export function recordFanGain(state: GameState, gained: number): GameState {
  if (gained <= 0 || state.eventFlags.includes(FIRST_FAN_GAIN_FLAG)) return state;
  return { ...state, eventFlags: [...state.eventFlags, FIRST_FAN_GAIN_FLAG] };
}

/** True once the club has ever won a supporter. */
export function hasEverGainedFans(state: Pick<GameState, 'eventFlags'>): boolean {
  return state.eventFlags.includes(FIRST_FAN_GAIN_FLAG);
}
