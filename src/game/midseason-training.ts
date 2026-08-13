import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import type { Attrs } from '../sim/types';
import { currentUserDivision } from './m2-career';
import type { DivisionLevel } from './pyramid';
import type { CareerPlayer, GameState } from './types';

export const MIDSEASON_TRAINING_WEEK = 19;
export const MIDSEASON_TRAINING_CONDITION_COST = 10;

const ATTRIBUTE_KEYS = [
  'pac',
  'sho',
  'pas',
  'def',
  'tec',
  'sta',
  'ref',
] as const satisfies readonly (keyof Attrs)[];

const GAIN_BY_DIVISION: Readonly<Record<DivisionLevel, number>> = {
  5: 1,
  4: 2,
  3: 3,
  2: 4,
  1: 5,
};

export type MidseasonTrainingStatus = 'prompt' | 'celebration' | 'complete';

export function midseasonTrainingAcceptedFlag(season: number): string {
  return `midseason-training:season-${season}:accepted`;
}

export function midseasonTrainingCompleteFlag(season: number): string {
  return `midseason-training:season-${season}:complete`;
}

/**
 * Returns this season's durable stage. An accepted trip stays resumable even
 * if a damaged save has moved beyond Week 19; a fresh offer only starts in the
 * exact calendar week.
 */
export function midseasonTrainingStatus(
  state: Pick<GameState, 'eventFlags' | 'season' | 'week'>,
): MidseasonTrainingStatus | undefined {
  if (state.eventFlags.includes(midseasonTrainingCompleteFlag(state.season)))
    return 'complete';
  if (state.eventFlags.includes(midseasonTrainingAcceptedFlag(state.season)))
    return 'celebration';
  return state.week === MIDSEASON_TRAINING_WEEK ? 'prompt' : undefined;
}

export function midseasonTrainingGainForDivision(
  division: DivisionLevel,
): number {
  return GAIN_BY_DIVISION[division];
}

export function midseasonTrainingGain(state: GameState): number {
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  return midseasonTrainingGainForDivision(division);
}

/** The named captain, then the Starting XI's first player for legacy saves. */
export function midseasonTrainingCaptain(
  state: GameState,
): CareerPlayer | undefined {
  const squad = state.players.filter(
    (player) => player.clubId === state.userClubId,
  );
  const namedCaptain = squad.find((player) => player.isCaptain === true);
  if (namedCaptain !== undefined) return namedCaptain;

  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  const firstStarter = lineup?.playerIds
    .map((playerId) => squad.find((player) => player.id === playerId))
    .find((player): player is CareerPlayer => player !== undefined);
  return firstStarter ?? squad[0];
}

/**
 * Pays every TP currently held, raises all seven stored attributes, and costs
 * every user-club player 10 condition. The accepted flag makes a repeated call
 * an exact no-op.
 */
export function acceptMidseasonTraining(state: GameState): GameState {
  if (midseasonTrainingStatus(state) !== 'prompt') return state;
  const gain = midseasonTrainingGain(state);
  return {
    ...state,
    trainingPoints: 0,
    players: state.players.map((player) =>
      player.clubId !== state.userClubId
        ? player
        : {
            ...player,
            condition: Math.max(
              0,
              (player.condition ?? 100) - MIDSEASON_TRAINING_CONDITION_COST,
            ),
            attrs: mapAttributes(player.attrs, (value) =>
              Math.min(MAX_PLAYER_ATTRIBUTE, value + gain),
            ),
          },
    ),
    eventFlags: [
      ...state.eventFlags,
      midseasonTrainingAcceptedFlag(state.season),
    ],
  };
}

/** A refusal retires only this season's offer and changes no resources. */
export function declineMidseasonTraining(state: GameState): GameState {
  if (midseasonTrainingStatus(state) !== 'prompt') return state;
  return {
    ...state,
    eventFlags: [
      ...state.eventFlags,
      midseasonTrainingCompleteFlag(state.season),
    ],
  };
}

/** Completes the accepted celebration without applying the reward again. */
export function completeMidseasonTraining(state: GameState): GameState {
  if (midseasonTrainingStatus(state) !== 'celebration') return state;
  return {
    ...state,
    eventFlags: [
      ...state.eventFlags,
      midseasonTrainingCompleteFlag(state.season),
    ],
  };
}

function mapAttributes(
  attrs: Attrs,
  transform: (value: number) => number,
): Attrs {
  const next = { ...attrs };
  for (const key of ATTRIBUTE_KEYS) next[key] = transform(attrs[key]);
  return next;
}
