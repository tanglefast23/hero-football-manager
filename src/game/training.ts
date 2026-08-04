import { MAX_PLAYER_ATTRIBUTE } from '../sim/attributes';
import { mulberry32 } from '../sim/rng';
import {
  FACILITY_CATALOG,
  facilityEffects,
  isFacilityOperational,
  type FacilityType,
} from './facilities';
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
import {
  hasActiveCareerContractPromise,
  pendingTrainingPriorityHolder,
} from './contract-promises';
import { repairCareerLineupForInjuries } from './squad';
import { isAvailableForSelection } from './lineup';
import { drillMultiplierPercent } from './player-requests';
import {
  keeperDisplayLadderMultiplier,
  resolveTrainingDrillForPath,
  trainingPathAttribute,
} from './training-paths';
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
  /** The stored stat before the drill — what the sim, scout and wage all see. */
  before: number;
  /** The stored stat after the drill. Never the displayed one; see `displayedAfter`. */
  after: number;
  /**
   * What the card shows, which for a keeper's Reflexes runs ahead of the stored
   * value so the halved Keeper Drills ladder reads like the outfield one. Equal
   * to `before` / `after` for every other player and every other drill.
   */
  displayedBefore: number;
  displayedAfter: number;
  conditionAfter: number;
  injury?: { chancePercent: number; recoveryWeeks: number };
}

export interface InstantTrainingPreview {
  /** The authored drill result before any player or club modifiers. */
  baseAfter: number;
  /** The ordinary-session result after every active modifier and banked fraction. */
  adjustedAfter: number;
  /** Signed difference between the authored base result and adjusted result. */
  adjustment: number;
  /** Short player-facing names for every modifier participating in the result. */
  modifierLabels: readonly string[];
}

/**
 * Previews the exact ordinary result for the confirmation card.
 *
 * SUPER remains a chance and therefore stays separate. Everything deterministic
 * — age, position, archetype, facilities, coaches, and banked fractions — uses
 * the same growth path as the drill itself so the card cannot promise +5 and
 * then quietly award +9.
 */
export function instantTrainingPreview(
  state: GameState,
  playerId: string,
  pathId: string,
): InstantTrainingPreview {
  const player = state.players.find(candidate => candidate.id === playerId);
  if (player === undefined || player.clubId !== state.userClubId) {
    throw new Error(`player ${playerId} is not on the user club`);
  }
  const drill = resolveTrainingDrillForPath(state, pathId);
  const attribute = trainingPathAttribute(pathId);
  const currentValue = player.attrs[attribute];

  /**
   * The card previews the *displayed* result, because the count-up that follows
   * it does. Both halves shadow, not just the adjusted one: the card's top line
   * is `baseValueAfter - currentValue`, so leaving it on the authored gain would
   * promise `+2` over a `+4` count-up — a worse defect than the uniform `+2` the
   * whole change exists to remove.
   *
   * The ceiling here is the displayed one, deliberately. `capPlayerTrainingGain`
   * clamps against the stored value, and near the top of the range that would
   * keep promising a full step after the display had already stalled at 999.
   */
  const displayMultiplier = keeperDisplayLadderMultiplier(state, drill.id);
  const displayedCurrent = displayedValue(player, attribute);
  const baseGain = (drill.gains[attribute] ?? 0) * displayMultiplier;
  const baseAfter = Math.min(
    MAX_PLAYER_ATTRIBUTE,
    checkedAdd(displayedCurrent, baseGain, 'base training attribute'),
  );
  const adjustedGain = applyInstantGrowthModifiers(
    state,
    player,
    attribute,
    baseGain,
  ).value - currentValue;
  const adjustedAfter = Math.min(MAX_PLAYER_ATTRIBUTE, displayedCurrent + adjustedGain);
  return {
    baseAfter,
    adjustedAfter,
    adjustment: adjustedAfter - baseAfter,
    modifierLabels: instantGrowthModifierLabels(state, player, attribute),
  };
}

/**
 * The value a card shows for one attribute — the stored stat plus whatever the
 * keeper's Reflexes display bonus has banked, stalled at the shared ceiling.
 *
 * Lives here rather than in `src/application/displayed-attributes.ts` because
 * `src/game/` cannot import the application layer. That module re-exports the
 * same rule for the UI; both are one line and the tests pin them together.
 */
export function displayedValue(
  player: CareerPlayer,
  attribute: keyof CareerPlayer['attrs'],
): number {
  const stored = player.attrs[attribute];
  if (attribute !== 'ref') return stored;
  return Math.min(MAX_PLAYER_ATTRIBUTE, stored + (player.refDisplayBonus ?? 0));
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
  // Two messages, not one "unavailable". The manager can act on an injury —
  // the Medical Bay shortens it — and can only wait out leave, so collapsing
  // them would throw away the one useful thing the error says.
  if (player.injuryWeeks > 0) throw new Error(`${player.name} is injured and cannot train`);
  if ((player.awayWeeks ?? 0) > 0) throw new Error(`${player.name} is away and cannot train`);
  // A TRAINING_PRIORITY promise is a debt: the promised player owns the next
  // drills until their countdown drains. They remind the manager; an injured
  // holder pauses the debt instead of deadlocking training.
  const targetOwedDrills = (player.priorityDrillsRemaining ?? 0) > 0
    && hasActiveCareerContractPromise(player, 'TRAINING_PRIORITY');
  const priorityHolder = pendingTrainingPriorityHolder(state);
  if (!targetOwedDrills && priorityHolder !== undefined) {
    throw new Error(
      `${priorityHolder.playerName} was promised the next `
      + `${priorityHolder.remaining} drill${priorityHolder.remaining === 1 ? '' : 's'}, train them first`,
    );
  }
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
  const growth = applyInstantGrowthModifiers(state, player, attribute, rolledGain);

  /**
   * Keeper Drills award half the outfield ladder for the same TP, so a keeper's
   * card reads `+2` beside three `+4`s and looks short-changed when the truth is
   * the opposite. Bank the shortfall for display only.
   *
   * Computed by running this player's own modifiers a second time over the
   * outfield-ladder base rather than doubling the realised gain, because a flat
   * x2 would print +6 for a 22-year-old whose outfield equivalent gets +5 —
   * `round(2 x 1.3) x 2` is not `round(4 x 1.3)`.
   *
   * **Only `growth`'s remainders are persisted; the shadow's are discarded.**
   * That is the invariant the whole trick rests on: `applyInstantGrowthModifiers`
   * banks sub-point percent bonuses, and a goalkeeper always earns one on REF,
   * so letting the shadow's ledger through would hand the keeper genuine extra
   * attribute points off a presentation feature. The call is pure — it returns a
   * fresh remainder object and mutates nothing — so running it twice is free of
   * ordering effects and consumes no RNG.
   *
   * Not clamped here. The ceiling belongs to the *display*, and an earlier draft
   * that capped the banked figure at `999 - stored` quietly destroyed it as the
   * stat climbed: measured over a long keeper career the bonus peaked at 405 and
   * then fell to 5 while the card still read a stalled 999. That made the field
   * mean "whatever fits under the ceiling" rather than "how far the display has
   * been allowed to run ahead", and left §6's drift rail measuring nothing.
   * `displayedValue` applies the ceiling on the way out instead.
   */
  const displayMultiplier = keeperDisplayLadderMultiplier(state, pathId);
  const displayBonusBefore = attribute === 'ref' ? player.refDisplayBonus ?? 0 : 0;
  const displayBonusAfter = displayMultiplier <= 1
    ? displayBonusBefore
    : displayBonusBefore
      + (applyInstantGrowthModifiers(state, player, attribute, rolledGain * displayMultiplier).value
        - growth.value);

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
    ...(targetOwedDrills
      ? { priorityDrillsRemaining: (player.priorityDrillsRemaining ?? 0) - 1 }
      : {}),
    ...(growth.trainingBonusRemainders === undefined
      ? {}
      : { trainingBonusRemainders: growth.trainingBonusRemainders }),
    ...(growth.facilityStaBonusRemainder === undefined
      ? {}
      : { facilityStaBonusRemainder: growth.facilityStaBonusRemainder }),
    ...(displayBonusAfter > 0 ? { refDisplayBonus: displayBonusAfter } : {}),
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
    // Clamped on the way out, like every other read of the displayed value.
    displayedBefore: Math.min(MAX_PLAYER_ATTRIBUTE, player.attrs[attribute] + displayBonusBefore),
    displayedAfter: Math.min(MAX_PLAYER_ATTRIBUTE, growth.value + displayBonusAfter),
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
  // A granted "my own guru" or "ease off the lads" scales gains for its spell.
  // The floor of 1 stays: a drill must always be worth something, even at a
  // compounded 30%, or the manager pays TP for literally nothing.
  const requestScale = drillMultiplierPercent(state.playerRequests?.effects ?? [], player.id);
  const baseGain = Math.max(
    1,
    Math.round(rolledGain * structuralMultiplier * requestScale / 100),
  );
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

function instantGrowthModifierLabels(
  state: GameState,
  player: CareerPlayer,
  attribute: keyof CareerPlayer['attrs'],
): string[] {
  const labels: string[] = [];
  const ageMultiplier = trainingMultiplierForAge(player.age ?? 24);
  if (ageMultiplier > 1) labels.push('Youth');
  if (ageMultiplier < 1) labels.push('Veteran');
  if (positionTrainingBonusPercent(player.role, attribute) > 0) labels.push(player.role);
  if (archetypeTrainingBonusPercent(player.archetype, attribute) > 0) {
    labels.push(player.archetype ?? 'Archetype');
  }
  const facilityLevel = facilityTrainingLevel(state, attribute);
  if (facilityLevel > 0) {
    labels.push(`${FACILITY_CATALOG[trainingFacilityType(attribute)].name} Lv${facilityLevel}`);
  }
  const coachScale = state.market === undefined
    ? 100
    : careerCoachTrainingModifiers(state.market).gainScalePercentByAttribute[attribute];
  if (coachScale > 100) labels.push('Coach');
  return labels;
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

/**
 * Indexed by facility level; index 0 means the club owns no such building.
 * An explicit table replaces the old `1 + (level - 1) / 2`, which made level 1
 * worth exactly x1.0 — so the first Gym, Tech Center, Shooting Range or Keeper
 * Court a club ever built changed nothing, at the only level a D5 club can
 * afford. Level 2 and 3 keep their previous x1.5 and x2.0.
 */
export const FACILITY_TRAINING_MULTIPLIER: readonly number[] = [1, 1.25, 1.5, 2];

function facilityTrainingMultiplier(
  state: GameState,
  attribute: keyof CareerPlayer['attrs'],
): number {
  return FACILITY_TRAINING_MULTIPLIER[facilityTrainingLevel(state, attribute)] ?? 1;
}

function trainingFacilityType(
  attribute: keyof CareerPlayer['attrs'],
): FacilityType {
  return attribute === 'sho'
    ? 'shooting-range'
    : attribute === 'ref'
      ? 'keeper-court'
      : attribute === 'pas' || attribute === 'tec'
        ? 'tech-center'
        : attribute === 'pac' || attribute === 'sta'
        ? 'gym'
        : 'training-pitch';
}

function facilityTrainingLevel(
  state: GameState,
  attribute: keyof CareerPlayer['attrs'],
): number {
  const facilityType = trainingFacilityType(attribute);
  const grid = state.facilities.grid;
  // A building under construction trains nobody — the same rule the Medical
  // Bay, dorm, and income lookups already follow.
  return grid?.buildings
    .filter(building => building.type === facilityType && isFacilityOperational(grid, building.id))
    .reduce((maximum, building) => Math.max(maximum, building.level), 0) ?? 0;
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
