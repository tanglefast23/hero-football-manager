import { applyTrainingPlan, type FocusDrill } from './progression';
import { facilityEffects } from './facilities';
import { trainingMultiplierForAge } from './pyramid';
import { careerCoachTrainingModifiers } from './coach-weekly';
import { capPlayerTrainingGain, playerAttributeCaps } from './archetype-caps';
import { resolveTrainingDrillForPath, trainingPathAttribute } from './training-paths';
import { assertCareerTrainingHonorsContractPromises } from './contract-promises';
import type {
  CareerPlayer,
  CareerTrainingDrill,
  CareerTrainingSlot,
  GameState,
} from './types';

export interface WeeklyTrainingResolution {
  players: CareerPlayer[];
  trainingPoints: number;
  moneyCost: number;
  focusApplied: boolean;
  reachedCaps: TrainingCapReached[];
  skippedCaps: TrainingCapReached[];
}

export interface TrainingCapReached {
  playerId: string;
  playerName: string;
  drillId: string;
  attribute: keyof CareerPlayer['attrs'];
  cap: number;
  kind?: 'reached' | 'skipped';
}

/** True when the slot's player has already reached the cap for the slot's stat. */
export function slotIsAtCap(state: GameState, slot: CareerTrainingSlot): boolean {
  const player = userRoster(state).find(candidate => candidate.id === slot.playerId);
  if (player === undefined) return false;
  const attribute = trainingPathAttribute(slot.pathId);
  return player.attrs[attribute] >= playerAttributeCaps(player)[attribute];
}

/** Sums the best-tier TP cost of every slot whose stat still has room. */
export function slotTrainingPointCost(state: GameState, slots: readonly CareerTrainingSlot[]): number {
  let tp = 0;
  for (const slot of slots) {
    if (slotIsAtCap(state, slot)) continue;
    tp = checkedAdd(tp, resolveTrainingDrillForPath(state, slot.pathId).tpCost, 'weekly training point cost');
  }
  return tp;
}

/**
 * Stores a repeating weekly template of player+path slots. Attribute gains and
 * costs resolve once, at weekly settlement, so editing the template repeatedly
 * cannot duplicate a week's training.
 */
export function setCareerTrainingPlan(
  state: GameState,
  slots: readonly CareerTrainingSlot[],
): GameState {
  if (state.phase !== 'manage') {
    throw new Error('training plans can only change during the manage phase');
  }
  const maxSlots = state.trainingRules?.maxFocusDrillsPerWeek ?? 3;
  if (slots.length > maxSlots) {
    throw new Error(`a training plan allows at most ${maxSlots} players`);
  }
  if (new Set(slots.map(slot => slot.playerId)).size !== slots.length) {
    throw new Error('a player can occupy only one training slot');
  }
  const roster = new Set(userRoster(state).map(player => player.id));
  for (const slot of slots) {
    if (!roster.has(slot.playerId)) throw new Error(`unknown trainee ${slot.playerId}`);
    resolveTrainingDrillForPath(state, slot.pathId); // throws on unknown path
  }
  assertCareerTrainingHonorsContractPromises(state, slots.map(slot => slot.playerId));
  return { ...state, trainingPlan: { slots: slots.map(slot => ({ ...slot })) } };
}

/** Resolves free conditioning plus the affordable repeating focus plan once. */
export function resolveCareerTrainingWeek(state: GameState): WeeklyTrainingResolution {
  const roster = userRoster(state);
  const base = state.trainingRules?.baseConditioning;
  const coachModifiers = state.market === undefined ? undefined : careerCoachTrainingModifiers(state.market);
  const conditioned = base === undefined
    ? roster
    : applyTrainingPlan(roster, roster.map(p => p.id), [base], { money: 0, tp: 0 }).players as CareerPlayer[];

  const slots = state.trainingPlan?.slots ?? [];
  const executable = slots
    .filter(slot => !slotIsAtCap(state, slot))
    .map(slot => ({ slot, drill: resolveTrainingDrillForPath(state, slot.pathId) }));
  const tpCost = executable.reduce((sum, e) => checkedAdd(sum, e.drill.tpCost, 'weekly training point cost'), 0);
  const canAfford = executable.length > 0 && tpCost <= state.trainingPoints;

  let players = conditioned as CareerPlayer[];
  let tp = state.trainingPoints;
  if (canAfford) {
    for (const { slot, drill } of executable) {
      const applied = applyTrainingPlan(
        players,
        [slot.playerId],
        [{ id: drill.id, moneyCost: 0, tpCost: drill.tpCost, gains: { ...drill.gains } }],
        { money: Number.MAX_SAFE_INTEGER, tp },
      );
      players = applied.players as CareerPlayer[];
      tp = applied.resources.tp;
    }
  }

  const growthAdjusted = state.careerMode === 'full'
    ? applyM2TrainingGrowthModifiers(state, roster, players, coachModifiers)
    : players;
  const staminaBonusPercent = state.facilities.grid === undefined
    ? 0
    : facilityEffects(state.facilities.grid).staminaTrainingBonusPercent;
  const facilityBoosted = applyFacilityStaminaBonus(roster, growthAdjusted, staminaBonusPercent);

  const trainedById = new Map(facilityBoosted.map(p => [p.id, p]));
  const reachedCaps = findReachedTrainingCaps(
    state, roster, facilityBoosted,
    executable.map(e => e.slot.playerId),
    executable.map(e => ({ id: e.drill.id, moneyCost: 0, tpCost: e.drill.tpCost, gains: e.drill.gains })),
    canAfford,
  );

  return {
    players: state.players.map(p => {
      const trained = trainedById.get(p.id);
      return trained === undefined ? p : { ...p, ...trained, attrs: { ...trained.attrs } };
    }),
    trainingPoints: tp,
    moneyCost: 0,
    focusApplied: canAfford,
    reachedCaps,
    skippedCaps: [],
  };
}

function findReachedTrainingCaps(
  state: GameState,
  original: readonly CareerPlayer[],
  trained: readonly CareerPlayer[],
  assignedPlayerIds: readonly string[],
  drills: readonly CareerTrainingDrill[],
  focusApplied: boolean,
): TrainingCapReached[] {
  if (state.careerMode !== 'full' || !focusApplied) return [];
  const assigned = new Set(assignedPlayerIds);
  const trainedById = new Map(trained.map(player => [player.id, player]));
  const reached: TrainingCapReached[] = [];
  const reportedPlayerAttributes = new Set<string>();
  for (const player of original) {
    if (!assigned.has(player.id)) continue;
    const after = trainedById.get(player.id);
    if (after === undefined) continue;
    const caps = playerAttributeCaps(player);
    for (const drill of drills) {
      for (const attribute of trainingAttributes(drill)) {
        const reportKey = `${player.id}:${attribute}`;
        if (!reportedPlayerAttributes.has(reportKey)
          && player.attrs[attribute] < caps[attribute]
          && after.attrs[attribute] >= caps[attribute]) {
          reportedPlayerAttributes.add(reportKey);
          reached.push({
            playerId: player.id,
            playerName: player.name,
            drillId: drill.id,
            attribute,
            cap: caps[attribute],
          });
        }
      }
    }
  }
  return reached;
}

function trainingAttributes(drill: FocusDrill | CareerTrainingDrill): (keyof CareerPlayer['attrs'])[] {
  return (Object.entries(drill.gains) as Array<[keyof CareerPlayer['attrs'], number | undefined]>)
    .flatMap(([attribute, gain]) => gain === undefined || gain <= 0 ? [] : [attribute]);
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
