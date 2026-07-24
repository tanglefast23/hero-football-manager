import { mulberry32 } from '../sim/rng';
import { facilityEffects } from './facilities';
import { trainingMultiplierForAge } from './pyramid';
import { careerCoachTrainingModifiers } from './coach-weekly';
import {
  archetypeTrainingBonusPercent,
  capPlayerTrainingGain,
  playerPotentialGrade,
  positionTrainingBonusPercent,
  superTrainingChancePercent,
} from './archetype-caps';
import {
  gridMedicalBayLevel,
  medicalBayRecoveryWeeks,
  overtrainingInjuryChancePercent,
  OVERTRAINING_CONDITION_THRESHOLD,
} from './player-wellbeing';
import { repairCareerLineupForInjuries } from './squad';
import { resolveTrainingDrillForPath, trainingPathAttribute } from './training-paths';
import type { CareerPlayer, GameState } from './types';

export const INSTANT_DRILL_CONDITION_COST = 8;
export const SUPER_TRAINING_PITY_DRILLS = 12;

export interface InstantDrillResolution {
  state: GameState;
  playerId: string;
  pathId: string;
  drillId: string;
  attribute: keyof CareerPlayer['attrs'];
  tpSpent: number;
  isSuper: boolean;
  before: number;
  after: number;
  conditionAfter: number;
  injury?: { chancePercent: number; recoveryWeeks: number };
}

/**
 * Resolves one drill for one player the moment the user taps it. Pure and
 * deterministic: SUPER, injury, and injury-duration rolls derive from the
 * career seed and the persisted lifetime drill nonce, so replaying the same
 * state yields the same result while back-to-back taps roll fresh.
 */
export function trainPlayerInstantly(
  state: GameState,
  playerId: string,
  pathId: string,
): InstantDrillResolution {
  const player = state.players.find(candidate => candidate.id === playerId);
  if (player === undefined || player.clubId !== state.userClubId) {
    throw new Error(`player ${playerId} is not on the user club`);
  }
  if (player.injuryWeeks > 0) throw new Error(`${player.name} is injured and cannot train`);
  const drill = resolveTrainingDrillForPath(state, pathId);
  if (drill.tpCost > state.trainingPoints) {
    throw new Error(`training needs ${drill.tpCost} TP but only ${state.trainingPoints} are available`);
  }

  const nonce = state.totalInstantDrills ?? 0;
  const superChance = superTrainingChancePercent(playerPotentialGrade(player));
  const pityReached = (player.drillsSinceSuper ?? 0) + 1 >= SUPER_TRAINING_PITY_DRILLS;
  const isSuper = pityReached
    || instantDrillRoll(state.careerSeed, nonce, playerId, 0, 100) < superChance;

  const attribute = trainingPathAttribute(pathId);
  const baseDrillGain = drill.gains[attribute] ?? 0;
  const rolledGain = isSuper ? Math.round(baseDrillGain * 1.5) : baseDrillGain;
  const growth = state.careerMode === 'full'
    ? applyInstantGrowthModifiers(state, player, attribute, rolledGain)
    : {
        value: capPlayerTrainingGain(
          player,
          attribute,
          player.attrs[attribute],
          checkedAdd(player.attrs[attribute], rolledGain, 'instant drill attribute'),
        ),
      };

  const conditionBefore = player.condition ?? 100;
  const injuryRiskReductionPercent = state.facilities.grid === undefined
    ? 0
    : facilityEffects(state.facilities.grid).injuryRiskReductionPercent;
  const injuryChancePercent = conditionBefore >= OVERTRAINING_CONDITION_THRESHOLD
    ? 0
    : overtrainingInjuryChancePercent(conditionBefore, injuryRiskReductionPercent);
  const injured = injuryChancePercent > 0
    && instantDrillRoll(state.careerSeed, nonce, playerId, 1, 100) < injuryChancePercent;
  const recoveryWeeks = injured
    ? medicalBayRecoveryWeeks(
        2 + instantDrillRoll(state.careerSeed, nonce, playerId, 2, 5),
        gridMedicalBayLevel(state.facilities.grid),
      )
    : undefined;
  const conditionAfter = Math.max(0, conditionBefore - INSTANT_DRILL_CONDITION_COST);

  const trainedPlayer: CareerPlayer = {
    ...player,
    attrs: { ...player.attrs, [attribute]: growth.value },
    condition: conditionAfter,
    drillsSinceSuper: isSuper ? 0 : (player.drillsSinceSuper ?? 0) + 1,
    ...(growth.trainingBonusRemainders === undefined
      ? {}
      : { trainingBonusRemainders: growth.trainingBonusRemainders }),
    ...(growth.facilityStaBonusRemainder === undefined
      ? {}
      : { facilityStaBonusRemainder: growth.facilityStaBonusRemainder }),
    ...(recoveryWeeks === undefined ? {} : { injuryWeeks: recoveryWeeks }),
  };

  const nextState: GameState = {
    ...state,
    players: state.players.map(candidate =>
      candidate.id === playerId ? trainedPlayer : candidate,
    ),
    trainingPoints: state.trainingPoints - drill.tpCost,
    totalInstantDrills: nonce + 1,
  };

  return {
    // A tap-time injury must bench the starter right away — settlement no
    // longer stands between training and the next matchday to repair it.
    state: recoveryWeeks === undefined ? nextState : repairCareerLineupForInjuries(nextState),
    playerId,
    pathId,
    drillId: drill.id,
    attribute,
    tpSpent: drill.tpCost,
    isSuper,
    before: player.attrs[attribute],
    after: growth.value,
    conditionAfter,
    ...(recoveryWeeks === undefined
      ? {}
      : { injury: { chancePercent: injuryChancePercent, recoveryWeeks } }),
  };
}

/**
 * Single-drill version of the M2 growth pipeline: age and facility structural
 * multipliers plus banked-hundredth percent bonuses (archetype, position,
 * coach). Potential no longer contributes a percent bonus — its job moved to
 * the SUPER session roll.
 */
function applyInstantGrowthModifiers(
  state: GameState,
  player: CareerPlayer,
  attribute: keyof CareerPlayer['attrs'],
  rolledGain: number,
): {
  value: number;
  trainingBonusRemainders?: Partial<Record<keyof CareerPlayer['attrs'], number>>;
  facilityStaBonusRemainder?: number;
} {
  const coachModifiers = state.market === undefined
    ? undefined
    : careerCoachTrainingModifiers(state.market);
  const structuralMultiplier = trainingMultiplierForAge(player.age ?? 24)
    * facilityTrainingMultiplier(state, attribute);
  const baseGain = Math.max(1, Math.round(rolledGain * structuralMultiplier));
  const coachBonusPercent = (coachModifiers?.gainScalePercentByAttribute[attribute] ?? 100) - 100;
  const developmentBonusPercent = archetypeTrainingBonusPercent(player.archetype, attribute)
    + positionTrainingBonusPercent(player.role, attribute)
    + coachBonusPercent;

  const trainingBonusRemainders = {
    ...(player.trainingBonusRemainders ?? player.coachTrainingBonusRemainders ?? {}),
  };
  const previousRemainder = trainingBonusRemainders[attribute] ?? 0;
  validateCoachTrainingRemainder(previousRemainder, player.id, attribute);
  // Bank hundredths so small percent bonuses remain exact even when one drill
  // cannot award a whole extra attribute point.
  const earnedHundredths = developmentBonusPercent === 0
    ? 0
    : Math.round(rolledGain * structuralMultiplier * developmentBonusPercent);
  const totalHundredths = checkedAdd(previousRemainder, earnedHundredths, 'training bonus progress');
  const extraGain = Math.floor(totalHundredths / 100);
  const nextRemainder = totalHundredths % 100;
  const proposedValue = checkedAdd(
    player.attrs[attribute],
    checkedAdd(baseGain, extraGain, 'adjusted training gain'),
    'adjusted training attribute',
  );
  let value = capPlayerTrainingGain(player, attribute, player.attrs[attribute], proposedValue);
  if (developmentBonusPercent > 0) {
    trainingBonusRemainders[attribute] = value < proposedValue ? 0 : nextRemainder;
  }

  let facilityStaBonusRemainder: number | undefined;
  if (attribute === 'sta') {
    const staminaBonusPercent = state.facilities.grid === undefined
      ? 0
      : facilityEffects(state.facilities.grid).staminaTrainingBonusPercent;
    const realizedGain = value - player.attrs.sta;
    if (staminaBonusPercent > 0 && realizedGain > 0) {
      const previousStaRemainder = player.facilityStaBonusRemainder ?? 0;
      const totalPercentagePoints = checkedAdd(
        previousStaRemainder,
        checkedMultiply(realizedGain, staminaBonusPercent, 'facility stamina bonus progress'),
        'facility stamina bonus progress',
      );
      const staExtra = Math.floor(totalPercentagePoints / 100);
      facilityStaBonusRemainder = totalPercentagePoints % 100;
      value = capPlayerTrainingGain(
        player,
        'sta',
        player.attrs.sta,
        checkedAdd(value, staExtra, 'facility stamina attribute'),
      );
    }
  }

  const hasPercentBonusState = developmentBonusPercent > 0
    || player.trainingBonusRemainders !== undefined
    || player.coachTrainingBonusRemainders !== undefined;
  return {
    value,
    ...(hasPercentBonusState ? { trainingBonusRemainders } : {}),
    ...(facilityStaBonusRemainder === undefined ? {} : { facilityStaBonusRemainder }),
  };
}

function instantDrillRoll(
  careerSeed: number,
  nonce: number,
  playerId: string,
  stream: number,
  upperExclusive: number,
): number {
  const seed = (
    careerSeed
    ^ Math.imul(nonce + 1, 0x9e3779b1)
    ^ Math.imul(fnvHashString(playerId), stream + 1)
  ) >>> 0;
  return Math.floor(mulberry32(seed)() * upperExclusive);
}

function fnvHashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193);
  }
  return hash >>> 0;
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
