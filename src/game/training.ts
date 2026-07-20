import { applyTrainingPlan, type FocusDrill } from './progression';
import { facilityEffects } from './facilities';
import { trainingMultiplierForAge } from './pyramid';
import { careerCoachTrainingModifiers } from './coach-weekly';
import { capPlayerTrainingGain } from './archetype-caps';
import {
  assertCareerTrainingHonorsContractPromises,
  hasActiveCareerContractPromise,
} from './contract-promises';
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
  assertCareerTrainingHonorsContractPromises(state, assignedPlayerIds);

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
  const coachModifiers = state.market === undefined
    ? undefined
    : careerCoachTrainingModifiers(state.market);
  const conditioned = base === undefined
    ? roster
    : applyTrainingPlan(
        roster,
        roster.map(player => player.id),
        [base],
        { money: 0, tp: 0 },
      ).players as CareerPlayer[];

  const plan = state.trainingPlan;
  const assignedPlayerIds = plan === undefined
    ? []
    : Array.from(new Set([
        ...plan.assignedPlayerIds,
        ...roster
          .filter(player => (
            player.injuryWeeks === 0
            && hasActiveCareerContractPromise(player, 'TRAINING_PRIORITY')
          ))
          .map(player => player.id),
      ]));
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  const focusCost = plan === undefined ? { money: 0, tp: 0 } : planCost(plan);
  const canAffordFocus = plan !== undefined
    && focusCost.money <= Math.max(0, club.cash)
    && focusCost.tp <= state.trainingPoints;
  const focused = canAffordFocus && plan !== undefined
    ? applyTrainingPlan(
        conditioned,
        assignedPlayerIds,
        plan.drills,
        { money: Math.max(0, club.cash), tp: state.trainingPoints },
      )
    : {
        players: conditioned,
        resources: { money: Math.max(0, club.cash), tp: state.trainingPoints },
      };

  const growthAdjusted = state.careerMode === 'full'
    ? applyM2TrainingGrowthModifiers(
        state,
        roster,
        focused.players as CareerPlayer[],
        coachModifiers,
      )
    : focused.players as CareerPlayer[];
  const staminaBonusPercent = state.facilities.grid === undefined
    ? 0
    : facilityEffects(state.facilities.grid).staminaTrainingBonusPercent;
  const facilityBoosted = applyFacilityStaminaBonus(
    roster,
    growthAdjusted,
    staminaBonusPercent,
  );

  const trainedById = new Map(
    facilityBoosted.map(player => [player.id, player]),
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

/**
 * Applies M2's player-specific growth curve after the shared training plan has
 * established the actual gains. M1 keeps its accepted integer tuning exactly.
 */
function applyM2TrainingGrowthModifiers(
  state: GameState,
  original: readonly CareerPlayer[],
  trained: readonly CareerPlayer[],
  coachModifiers: ReturnType<typeof careerCoachTrainingModifiers> | undefined,
): CareerPlayer[] {
  const originalById = new Map(original.map(player => [player.id, player]));
  return trained.map(player => {
    const before = originalById.get(player.id);
    if (before === undefined) throw new Error(`unknown trained player ${player.id}`);
    const attrs = { ...player.attrs };
    const coachTrainingBonusRemainders = { ...(player.coachTrainingBonusRemainders ?? {}) };
    let hasCoachRemainderChange = false;
    for (const attribute of Object.keys(attrs) as Array<keyof CareerPlayer['attrs']>) {
      const realizedGain = player.attrs[attribute] - before.attrs[attribute];
      if (realizedGain <= 0) continue;
      const baseMultiplier = trainingMultiplierForAge(player.age ?? 24)
        * archetypeTrainingMultiplier(player.archetype, attribute)
        * facilityTrainingMultiplier(state, attribute)
        * diminishingTrainingMultiplier(before.attrs[attribute]);
      const baseGain = Math.max(1, Math.round(realizedGain * baseMultiplier));
      const coachBonusPercent = (coachModifiers?.gainScalePercentByAttribute[attribute] ?? 100) - 100;
      const previousRemainder = coachTrainingBonusRemainders[attribute] ?? 0;
      validateCoachTrainingRemainder(previousRemainder, player.id, attribute);
      // Bank hundredths instead of rounding a small coach bonus away every week.
      // Example: a +3 drill with a +10% coach earns 30 hundredths; the fourth
      // identical session awards +1 and carries the remaining 20 hundredths.
      const earnedHundredths = coachBonusPercent === 0
        ? 0
        : Math.round(realizedGain * baseMultiplier * coachBonusPercent);
      const totalHundredths = checkedAdd(
        previousRemainder,
        earnedHundredths,
        'coach training bonus progress',
      );
      const extraGain = Math.floor(totalHundredths / 100);
      const nextRemainder = totalHundredths % 100;
      const proposedValue = checkedAdd(
        before.attrs[attribute],
        checkedAdd(baseGain, extraGain, 'coach-adjusted training gain'),
        'coach-adjusted training attribute',
      );
      const cappedValue = capPlayerTrainingGain(
        before,
        attribute,
        before.attrs[attribute],
        proposedValue,
      );
      attrs[attribute] = cappedValue;
      if (coachBonusPercent > 0) {
        coachTrainingBonusRemainders[attribute] = cappedValue < proposedValue ? 0 : nextRemainder;
        hasCoachRemainderChange = true;
      }
    }
    return {
      ...player,
      attrs,
      ...(hasCoachRemainderChange || player.coachTrainingBonusRemainders !== undefined
        ? { coachTrainingBonusRemainders }
        : {}),
    };
  });
}

function validateCoachTrainingRemainder(
  remainder: number,
  playerId: string,
  attribute: keyof CareerPlayer['attrs'],
): void {
  if (!Number.isSafeInteger(remainder) || remainder < 0 || remainder >= 100) {
    throw new Error(`player ${playerId} ${attribute} coach training remainder must be from 0 to 99`);
  }
}

function archetypeTrainingMultiplier(
  archetype: CareerPlayer['archetype'],
  attribute: keyof CareerPlayer['attrs'],
): number {
  if (archetype === 'Prodigy') return 1.2;
  if (archetype === 'All-Rounder') return 1.05;
  const specialties: Partial<Record<NonNullable<CareerPlayer['archetype']>, readonly (keyof CareerPlayer['attrs'])[]>> = {
    Speedster: ['pac'],
    Sniper: ['sho'],
    Playmaker: ['pas', 'tec'],
    Anchor: ['def', 'sta'],
    Wall: ['ref', 'def'],
    Engine: ['sta', 'pac'],
  };
  return archetype !== undefined && specialties[archetype]?.includes(attribute) ? 1.15 : 1;
}

function facilityTrainingMultiplier(
  state: GameState,
  attribute: keyof CareerPlayer['attrs'],
): number {
  const facilityType = attribute === 'sho'
    ? 'shooting-range'
    : attribute === 'ref'
      ? 'keeper-court'
      : attribute === 'pas' || attribute === 'tec'
        ? 'tech-center'
        : attribute === 'pac' || attribute === 'sta'
          ? 'gym'
          : 'training-pitch';
  const level = state.facilities.grid?.buildings
    .filter(building => building.type === facilityType)
    .reduce((maximum, building) => Math.max(maximum, building.level), 0) ?? 0;
  return level === 0 ? 1 : 1 + (level - 1) / 2;
}

function diminishingTrainingMultiplier(currentStat: number): number {
  if (currentStat >= 90) return 0.5;
  if (currentStat >= 80) return 0.75;
  return 1;
}

/**
 * Carries percentage points between weeks so a 10% bonus remains exact even
 * when weekly integer gains are small. Only gains that survived the 99 cap
 * earn bonus credit.
 */
function applyFacilityStaminaBonus(
  original: readonly CareerPlayer[],
  trained: readonly CareerPlayer[],
  bonusPercent: number,
): CareerPlayer[] {
  if (!Number.isSafeInteger(bonusPercent) || bonusPercent < 0) {
    throw new Error('facility stamina bonus must be a non-negative safe integer percent');
  }
  if (bonusPercent === 0) return [...trained];

  const originalById = new Map(original.map(player => [player.id, player]));
  return trained.map(player => {
    const before = originalById.get(player.id);
    if (before === undefined) throw new Error(`unknown trained player ${player.id}`);
    const realizedGain = player.attrs.sta - before.attrs.sta;
    if (realizedGain <= 0) return player;

    const previousRemainder = player.facilityStaBonusRemainder ?? 0;
    if (!Number.isSafeInteger(previousRemainder)
      || previousRemainder < 0
      || previousRemainder >= 100) {
      throw new Error(`player ${player.id} facility stamina remainder must be from 0 to 99`);
    }
    const earnedPercentagePoints = checkedMultiply(
      realizedGain,
      bonusPercent,
      'facility stamina bonus progress',
    );
    const totalPercentagePoints = checkedAdd(
      previousRemainder,
      earnedPercentagePoints,
      'facility stamina bonus progress',
    );
    const extraGain = Math.floor(totalPercentagePoints / 100);
    const facilityStaBonusRemainder = totalPercentagePoints % 100;
    const sta = capPlayerTrainingGain(
      before,
      'sta',
      before.attrs.sta,
      checkedAdd(player.attrs.sta, extraGain, 'facility stamina attribute'),
    );

    return {
      ...player,
      attrs: { ...player.attrs, sta },
      facilityStaBonusRemainder,
    };
  });
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

function checkedAdd(left: number, right: number, label: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range`);
  return result;
}

function checkedMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result)) throw new Error(`${label} exceeds the safe integer range`);
  return result;
}
