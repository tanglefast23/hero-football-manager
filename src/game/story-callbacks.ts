import { SEASON_WEEKS, type GameState, type StoryCallback } from './types';

/**
 * How many scheduled callbacks a save carries.
 *
 * Thirty by coincidence, not because a season is thirty weeks — this is a queue
 * cap on saved state, and it is spelled out so a later calendar change cannot
 * silently drag it along.
 */
const RETAINED_STORY_CALLBACKS = 30;

interface StoryCallbackInput {
  readonly sourceId: string;
  readonly delayWeeks: number;
  readonly speaker: StoryCallback['speaker'];
  readonly playerId?: string;
  readonly coachRole?: StoryCallback['coachRole'];
  readonly text: string;
  readonly textKey: string;
}

export function scheduleStoryCallback(
  state: GameState,
  input: StoryCallbackInput,
): GameState {
  if (!Number.isSafeInteger(input.delayWeeks) || input.delayWeeks < 1)
    throw new Error('story callback delay must be a positive number of weeks');
  if (input.speaker === 'PLAYER' && input.playerId === undefined)
    throw new Error('a player story callback needs a player');
  if (input.speaker === 'COACH' && input.coachRole === undefined)
    throw new Error('a coach story callback needs a coach role');
  const absolute =
    (state.season - 1) * SEASON_WEEKS + state.week + input.delayWeeks;
  const callback: StoryCallback = {
    id: `callback:${input.sourceId}:s${state.season}:w${state.week}:${input.playerId ?? input.coachRole ?? input.speaker}`,
    dueSeason: Math.floor((absolute - 1) / SEASON_WEEKS) + 1,
    dueWeek: ((absolute - 1) % SEASON_WEEKS) + 1,
    sourceId: input.sourceId,
    speaker: input.speaker,
    ...(input.playerId === undefined ? {} : { playerId: input.playerId }),
    ...(input.coachRole === undefined ? {} : { coachRole: input.coachRole }),
    text: input.text,
    textKey: input.textKey,
  };
  if ((state.storyCallbacks ?? []).some((entry) => entry.id === callback.id))
    return state;
  return {
    ...state,
    storyCallbacks: [...(state.storyCallbacks ?? []), callback].slice(
      -RETAINED_STORY_CALLBACKS,
    ),
  };
}

export function nextDueStoryCallback(
  state: GameState,
): StoryCallback | undefined {
  const now = (state.season - 1) * SEASON_WEEKS + state.week;
  return (state.storyCallbacks ?? []).find((callback) => {
    const due = (callback.dueSeason - 1) * SEASON_WEEKS + callback.dueWeek;
    if (due > now) return false;
    if (callback.speaker === 'PLAYER') {
      return state.players.some(
        (player) =>
          player.id === callback.playerId && player.clubId === state.userClubId,
      );
    }
    if (callback.speaker === 'COACH') {
      return callback.coachRole === 'HEAD'
        ? state.market?.headCoach !== undefined
        : state.market?.assistantCoach !== undefined;
    }
    return true;
  });
}

export function dismissStoryCallback(
  state: GameState,
  callbackId: string,
): GameState {
  if (!(state.storyCallbacks ?? []).some((entry) => entry.id === callbackId))
    return state;
  return {
    ...state,
    storyCallbacks: state.storyCallbacks!.filter(
      (entry) => entry.id !== callbackId,
    ),
  };
}
