import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import type { Attrs } from '../sim/types';
import { recordCashTransaction } from './cash-transactions';
import { currentUserDivision } from './m2-career';
import type { DivisionLevel } from './pyramid';
import { weeklyAmbientTrainingPoints } from './career';
import { individualTrainingUsedFlag } from './training';
import type { CareerPlayer, GameState } from './types';

export const MIDSEASON_TRAINING_WEEK = 19;
export const MIDSEASON_TRAINING_CONDITION_COST = 10;
export const GREEN_BULL_TRAINING_GAIN = 2;
const GREEN_BULL_BASE_COST = 50_000;
const GREEN_BULL_COST_INCREMENT = 25_000;

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
export type GreenBullTrainingBlockedReason =
  | 'USED_THIS_WEEK'
  | 'INDIVIDUAL_TRAINING_USED'
  | 'NOT_ENOUGH_TP'
  | 'NOT_ENOUGH_CASH';

export interface GreenBullTrainingOffer {
  readonly cost: number;
  readonly trainingPointsRequired: number;
  readonly statGain: number;
  readonly conditionCost: number;
  readonly blockedReason?: GreenBullTrainingBlockedReason;
}

export function midseasonTrainingAcceptedFlag(season: number): string {
  return `midseason-training:season-${season}:accepted`;
}

export function midseasonTrainingCompleteFlag(season: number): string {
  return `midseason-training:season-${season}:complete`;
}

export function greenBullTrainingAcceptedFlag(
  season: number,
  week: number,
): string {
  return `green-bull-training:season-${season}:week-${week}:accepted`;
}

export function greenBullTrainingCompleteFlag(
  season: number,
  week: number,
): string {
  return `green-bull-training:season-${season}:week-${week}:complete`;
}

/**
 * Returns this season's durable stage. An accepted trip stays resumable even
 * if a damaged save has moved beyond Week 19; a fresh offer only starts in the
 * exact calendar week.
 */
export function midseasonTrainingStatus(
  state: GameState,
): MidseasonTrainingStatus | undefined {
  if (
    state.eventFlags.includes(
      greenBullTrainingCompleteFlag(state.season, state.week),
    )
  )
    return 'complete';
  if (
    state.eventFlags.includes(
      greenBullTrainingAcceptedFlag(state.season, state.week),
    )
  )
    return 'celebration';
  if (state.eventFlags.includes(midseasonTrainingCompleteFlag(state.season)))
    return 'complete';
  if (state.eventFlags.includes(midseasonTrainingAcceptedFlag(state.season)))
    return 'celebration';
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  return state.week === MIDSEASON_TRAINING_WEEK && division >= 4
    ? 'prompt'
    : undefined;
}

export function midseasonTrainingGainForDivision(
  division: DivisionLevel,
): number {
  return GAIN_BY_DIVISION[division];
}

export function midseasonTrainingGain(state: GameState): number {
  if (
    state.eventFlags.includes(
      greenBullTrainingAcceptedFlag(state.season, state.week),
    )
  )
    return GREEN_BULL_TRAINING_GAIN;
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  return midseasonTrainingGainForDivision(division);
}

/** The paid D3-D1 trip shown on the Drills screen. */
export function greenBullTrainingOffer(
  state: GameState,
): GreenBullTrainingOffer | undefined {
  const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
  if (division !== 1 && division !== 2 && division !== 3) return undefined;
  const previousTrips = state.eventFlags.filter(
    (flag) =>
      flag.startsWith('green-bull-training:') && flag.endsWith(':accepted'),
  ).length;
  const cost = GREEN_BULL_BASE_COST + previousTrips * GREEN_BULL_COST_INCREMENT;
  const trainingPointsRequired = weeklyAmbientTrainingPoints(state);
  const usedThisWeek = state.eventFlags.some(
    (flag) =>
      flag === greenBullTrainingAcceptedFlag(state.season, state.week) ||
      flag === greenBullTrainingCompleteFlag(state.season, state.week),
  );
  const individualTrainingUsed = state.eventFlags.includes(
    individualTrainingUsedFlag(state.season, state.week),
  );
  const cash = state.clubs.find((club) => club.id === state.userClubId)?.cash;
  if (cash === undefined)
    throw new Error(`unknown user club ${state.userClubId}`);
  return {
    cost,
    trainingPointsRequired,
    statGain: GREEN_BULL_TRAINING_GAIN,
    conditionCost: MIDSEASON_TRAINING_CONDITION_COST,
    ...(usedThisWeek
      ? { blockedReason: 'USED_THIS_WEEK' as const }
      : individualTrainingUsed
        ? { blockedReason: 'INDIVIDUAL_TRAINING_USED' as const }
        : state.trainingPoints < trainingPointsRequired
          ? { blockedReason: 'NOT_ENOUGH_TP' as const }
          : cash < cost
            ? { blockedReason: 'NOT_ENOUGH_CASH' as const }
            : {}),
  };
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
  return applySquadTraining(state, midseasonTrainingGain(state), [
    ...state.eventFlags,
    midseasonTrainingAcceptedFlag(state.season),
  ]);
}

export function acceptGreenBullTraining(state: GameState): GameState {
  const offer = greenBullTrainingOffer(state);
  if (offer === undefined || offer.blockedReason !== undefined) return state;
  const charged = applySquadTraining(
    {
      ...state,
      clubs: state.clubs.map((club) =>
        club.id === state.userClubId
          ? { ...club, cash: club.cash - offer.cost }
          : club,
      ),
    },
    offer.statGain,
    [
      ...state.eventFlags,
      greenBullTrainingAcceptedFlag(state.season, state.week),
    ],
  );
  return recordCashTransaction(charged, {
    kind: 'event',
    label: 'Green Bull training',
    labelKey: 'cashTransaction.greenBullTraining',
    amount: -offer.cost,
    referenceId: `green-bull-${state.season}-${state.week}`,
  });
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
  const greenBullAccepted = state.eventFlags.includes(
    greenBullTrainingAcceptedFlag(state.season, state.week),
  );
  return {
    ...state,
    eventFlags: [
      ...state.eventFlags,
      greenBullAccepted
        ? greenBullTrainingCompleteFlag(state.season, state.week)
        : midseasonTrainingCompleteFlag(state.season),
    ],
  };
}

function applySquadTraining(
  state: GameState,
  gain: number,
  eventFlags: string[],
): GameState {
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
    eventFlags,
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
