import { applyTrainingPlan, type FocusDrill } from './progression';
import type {
  CareerPlayer,
  CareerTrainingDrill,
  CareerTrainingPlan,
  GameState,
} from './types';

export interface WeeklyTrainingResolution {
  players: CareerPlayer[];
  trainingPoints: number;
  moneyCost: number;
  focusApplied: boolean;
}

/**
 * Stores a repeating weekly template. Attribute gains and costs resolve once,
 * at weekly settlement, so editing the template repeatedly cannot duplicate a
 * week's training.
 */
export function setCareerTrainingPlan(
  state: GameState,
  assignedPlayerIds: readonly string[],
  drills: readonly FocusDrill[],
): GameState {
  if (state.phase !== 'manage') {
    throw new Error('training plans can only change during the manage phase');
  }
  const maxDrills = state.trainingRules?.maxFocusDrillsPerWeek ?? 3;
  if (assignedPlayerIds.length === 0) {
    throw new Error('a training plan requires at least one assigned player');
  }
  if (drills.length === 0 || drills.length > maxDrills) {
    throw new Error(`a training plan requires from 1 to ${maxDrills} focus drills`);
  }

  // applyTrainingPlan is the shared validation boundary for player IDs, drill
  // IDs, attributes, and cost integers. Use exact available resources here so
  // an unaffordable template cannot be locked from the UI.
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  applyTrainingPlan(
    userRoster(state),
    assignedPlayerIds,
    drills,
    { money: Math.max(0, club.cash), tp: state.trainingPoints },
  );

  return {
    ...state,
    trainingPlan: {
      assignedPlayerIds: [...assignedPlayerIds],
      drills: drills.map(cloneDrill),
    },
  };
}

/** Resolves free conditioning plus the affordable repeating focus plan once. */
export function resolveCareerTrainingWeek(state: GameState): WeeklyTrainingResolution {
  const roster = userRoster(state);
  const base = state.trainingRules?.baseConditioning;
  const conditioned = base === undefined
    ? roster
    : applyTrainingPlan(
        roster,
        roster.map(player => player.id),
        [base],
        { money: 0, tp: 0 },
      ).players as CareerPlayer[];

  const plan = state.trainingPlan;
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  const focusCost = plan === undefined ? { money: 0, tp: 0 } : planCost(plan);
  const canAffordFocus = plan !== undefined
    && focusCost.money <= Math.max(0, club.cash)
    && focusCost.tp <= state.trainingPoints;
  const focused = canAffordFocus && plan !== undefined
    ? applyTrainingPlan(
        conditioned,
        plan.assignedPlayerIds,
        plan.drills,
        { money: Math.max(0, club.cash), tp: state.trainingPoints },
      )
    : {
        players: conditioned,
        resources: { money: Math.max(0, club.cash), tp: state.trainingPoints },
      };

  const trainedById = new Map(
    focused.players.map(player => [player.id, player]),
  );
  return {
    players: state.players.map(player => {
      const trained = trainedById.get(player.id);
      return trained === undefined
        ? player
        : { ...player, ...trained, attrs: { ...trained.attrs } };
    }),
    trainingPoints: focused.resources.tp,
    moneyCost: canAffordFocus ? focusCost.money : 0,
    focusApplied: canAffordFocus,
  };
}

function userRoster(state: GameState): CareerPlayer[] {
  return state.players
    .filter(player => player.clubId === state.userClubId)
    .map(player => ({ ...player, attrs: { ...player.attrs } }));
}

function planCost(plan: CareerTrainingPlan): { money: number; tp: number } {
  let money = 0;
  let tp = 0;
  for (const drill of plan.drills) {
    money += drill.moneyCost;
    tp += drill.tpCost;
    if (!Number.isSafeInteger(money) || !Number.isSafeInteger(tp)) {
      throw new Error('weekly training cost exceeds the safe integer range');
    }
  }
  return { money, tp };
}

function cloneDrill(drill: FocusDrill | CareerTrainingDrill): CareerTrainingDrill {
  return {
    id: drill.id,
    moneyCost: drill.moneyCost,
    tpCost: drill.tpCost,
    gains: { ...drill.gains },
  };
}
