import type { GameState } from './types';

/**
 * Manager's tips: one non-obvious rule, offered on a quiet week, never twice.
 *
 * "Never twice" is the whole design. A tip the player has already read is noise
 * on a desk that only shows it because the week was empty, and a hint system
 * that repeats itself teaches people to stop reading hints. Seen tips are
 * recorded as career flags, so the catalog drains across a playthrough and a
 * long career eventually stops offering any.
 */

const SEEN_TIP_PREFIX = 'tip:seen:';

export interface DeskTipState {
  readonly season: number;
  readonly week: number;
  /** Absent when the week was settled and the roll came up empty. */
  readonly tipId?: string;
}

export function hasSeenDeskTip(state: Pick<GameState, 'eventFlags'>, tipId: string): boolean {
  return state.eventFlags.includes(seenTipFlag(tipId));
}

export function markDeskTipSeen(state: GameState, tipId: string): GameState {
  const flag = seenTipFlag(tipId);
  if (state.eventFlags.includes(flag)) return state;
  return { ...state, eventFlags: [...state.eventFlags, flag] };
}

/** The tips this career has not been shown, in catalog order. */
export function unseenDeskTipIds(
  state: Pick<GameState, 'eventFlags'>,
  tipIds: readonly string[],
): string[] {
  return tipIds.filter(tipId => !hasSeenDeskTip(state, tipId));
}

/** True once this week has already been decided, whether or not a tip landed. */
export function isDeskTipSettled(state: Pick<GameState, 'deskTip' | 'season' | 'week'>): boolean {
  return state.deskTip?.season === state.season && state.deskTip.week === state.week;
}

/** The tip showing right now, or undefined on a week that drew a blank. */
export function currentDeskTipId(
  state: Pick<GameState, 'deskTip' | 'season' | 'week'>,
): string | undefined {
  return isDeskTipSettled(state) ? state.deskTip?.tipId : undefined;
}

function seenTipFlag(tipId: string): string {
  if (typeof tipId !== 'string' || tipId.trim().length === 0) {
    throw new Error('manager tip IDs must be non-empty strings');
  }
  return `${SEEN_TIP_PREFIX}${tipId}`;
}
