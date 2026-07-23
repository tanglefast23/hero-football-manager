import { applyTrainingPlan, type FocusDrill } from './progression';
import { facilityEffects } from './facilities';
import { trainingMultiplierForAge } from './pyramid';
import { careerCoachTrainingModifiers } from './coach-weekly';
import { capPlayerTrainingGain, playerAttributeCaps } from './archetype-caps';
import { trainingDrillBlockedReason } from './promotion-progression';
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
  reachedCaps: TrainingCapReached[];
  skippedCaps: TrainingCapReached[];
}

export interface TrainingPlanCapConflict {
  playerId: string;
  playerName: string;
  drillId: string;
  drillName: string;
  attributes: (keyof CareerPlayer['attrs'])[];
}

export interface ChargeableCareerTrainingPlan {
  drills: FocusDrill[];
  capConflicts: TrainingPlanCapConflict[];
  moneyCost: number;
  trainingPointCost: number;
}

export interface TrainingCapReached {
  playerId: string;
  playerName: string;
  drillId: string;
  attribute: keyof CareerPlayer['attrs'];
  cap: number;
  kind?: 'reached' | 'skipped';
}

/**
 * True when the in-editor selection is exactly the saved plan (same trainees and
 * same drills, order-independent). Drives the "unsaved changes" highlight and the
 * advance-week guard, so both agree on when a plan still needs locking in.
 */
export function trainingSelectionMatchesSavedPlan(
  savedPlan: CareerTrainingPlan | undefined,
  assignedPlayerIds: readonly string[],
  selectedDrillIds: readonly string[],
): boolean {
  if (savedPlan === undefined) return false;
  const savedDrillIds = savedPlan.drills.map(drill => drill.id);
  return savedPlan.assignedPlayerIds.length === assignedPlayerIds.length
    && savedPlan.assignedPlayerIds.every(playerId => assignedPlayerIds.includes(playerId))
    && savedDrillIds.length === selectedDrillIds.length
    && savedDrillIds.every(drillId => selectedDrillIds.includes(drillId));
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
  assertDistinctTrainingDrillPaths(drills);
  assertCareerTrainingDrillsUnlocked(state, drills);
  assertCareerTrainingHonorsContractPromises(state, assignedPlayerIds);

  // applyTrainingPlan is the shared validation boundary for player IDs, drill
  // IDs, attributes, and cost integers. Validate the full authored plan first,
  // then use exact resources only for drills with at least one eligible player.
  // A fully capped plan is allowed so it can be saved with actionable warnings
  // without requiring resources that will never be charged.
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`unknown user club ${state.userClubId}`);
  const roster = userRoster(state);
  applyTrainingPlan(
    roster,
    assignedPlayerIds,
    drills,
    { money: Number.MAX_SAFE_INTEGER, tp: Number.MAX_SAFE_INTEGER },
  );
  const chargeable = chargeableCareerTrainingPlan(state, assignedPlayerIds, drills);
  if (
    chargeable.moneyCost > Math.max(0, club.cash)
    || chargeable.trainingPointCost > state.trainingPoints
  ) {
    throw new Error('Training plan is not affordable');
  }
  const skippedCaps = capConflictsAsSkippedCaps(state, chargeable.capConflicts);
  const existingNoticeIds = new Set((state.trainingCapNotices ?? []).map(notice => notice.id));
  const trainingCapNotices = [
    ...(state.trainingCapNotices ?? []),
    ...skippedCaps
      .map(skipped => trainingCapNotice(state, skipped))
      .filter(notice => !existingNoticeIds.has(notice.id)),
  ];

  return {
    ...state,
    trainingPlan: {
      assignedPlayerIds: [...assignedPlayerIds],
      drills: drills.map(cloneDrill),
    },
    trainingCapNotices,
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
  const chargeable = plan === undefined
    ? { drills: [], capConflicts: [], moneyCost: 0, trainingPointCost: 0 }
    : chargeableCareerTrainingPlan(state, assignedPlayerIds, plan.drills);
  const capConflicts = chargeable.capConflicts;
  const blockedPlayerDrills = new Set(
    capConflicts.map(conflict => `${conflict.playerId}:${conflict.drillId}`),
  );
  const executableDrills = plan === undefined
    ? []
    : chargeable.drills.flatMap(drill => {
        const eligiblePlayerIds = assignedPlayerIds.filter(playerId => (
          !blockedPlayerDrills.has(`${playerId}:${drill.id}`)
        ));
        return eligiblePlayerIds.length === 0 ? [] : [{ drill, eligiblePlayerIds }];
      });
  const focusCost = {
    money: chargeable.moneyCost,
    tp: chargeable.trainingPointCost,
  };
  const canAffordFocus = executableDrills.length > 0
    && focusCost.money <= Math.max(0, club.cash)
    && focusCost.tp <= state.trainingPoints;
  let focused = {
    players: conditioned as CareerPlayer[],
    resources: { money: Math.max(0, club.cash), tp: state.trainingPoints },
  };
  if (canAffordFocus) {
    for (const execution of executableDrills) {
      const applied = applyTrainingPlan(
        focused.players,
        execution.eligiblePlayerIds,
        [{
          ...execution.drill,
          moneyCost: checkedMultiply(
            execution.drill.moneyCost,
            execution.eligiblePlayerIds.length,
            'weekly training money cost',
          ),
        }],
        focused.resources,
      );
      focused = {
        players: applied.players as CareerPlayer[],
        resources: applied.resources,
      };
    }
  }

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
  const reachedCaps = findReachedTrainingCaps(
    state,
    roster,
    facilityBoosted,
    assignedPlayerIds,
    plan?.drills ?? [],
    canAffordFocus,
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
    reachedCaps,
    skippedCaps: canAffordFocus || executableDrills.length === 0
      ? capConflictsAsSkippedCaps(state, capConflicts)
      : [],
  };
}

/**
 * Prices exactly the drills that weekly settlement can execute. Money is
 * charged once per eligible assigned trainee; TP is charged once per
 * selected drill. A player/drill pairing is free for that week only when that
 * player is already capped on every attribute the drill improves.
 */
export function chargeableCareerTrainingPlan(
  state: GameState,
  assignedPlayerIds: readonly string[],
  drills: readonly FocusDrill[],
): ChargeableCareerTrainingPlan {
  const unlockedDrills = drills.filter(drill => trainingDrillBlockedReason(state, drill.id) === undefined);
  const capConflicts = trainingPlanCapConflicts(state, assignedPlayerIds, unlockedDrills);
  const blockedPlayerDrills = new Set(
    capConflicts.map(conflict => `${conflict.playerId}:${conflict.drillId}`),
  );
  const chargeableDrills = unlockedDrills.filter(drill => assignedPlayerIds.some(playerId => (
    !blockedPlayerDrills.has(`${playerId}:${drill.id}`)
  )));
  let moneyCost = 0;
  let trainingPointCost = 0;
  for (const drill of chargeableDrills) {
    const eligibleTraineeCount = assignedPlayerIds.filter(playerId => (
      !blockedPlayerDrills.has(`${playerId}:${drill.id}`)
    )).length;
    moneyCost = checkedAdd(
      moneyCost,
      checkedMultiply(drill.moneyCost, eligibleTraineeCount, 'weekly training money cost'),
      'weekly training money cost',
    );
    trainingPointCost = checkedAdd(trainingPointCost, drill.tpCost, 'weekly training point cost');
  }
  return {
    drills: chargeableDrills.map(cloneDrill),
    capConflicts,
    moneyCost,
    trainingPointCost,
  };
}

/** Returns player/drill pairs that cannot add any of that drill's attributes. */
export function trainingPlanCapConflicts(
  state: GameState,
  assignedPlayerIds: readonly string[],
  drills: readonly FocusDrill[],
): TrainingPlanCapConflict[] {
  if (state.careerMode !== 'full') return [];
  const roster = new Map(userRoster(state).map(player => [player.id, player]));
  return assignedPlayerIds.flatMap(playerId => {
    const player = roster.get(playerId);
    if (player === undefined) return [];
    const caps = playerAttributeCaps(player);
    return drills.flatMap(drill => {
      const attributes = trainingAttributes(drill);
      if (attributes.length === 0 || attributes.some(attribute => player.attrs[attribute] < caps[attribute])) {
        return [];
      }
      return [{
        playerId,
        playerName: player.name,
        drillId: drill.id,
        drillName: drillDisplayName(drill),
        attributes,
      }];
    });
  });
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

function drillDisplayName(drill: FocusDrill): string {
  const authoredName = (drill as FocusDrill & { readonly name?: string }).name;
  if (authoredName !== undefined) return authoredName;
  return drill.id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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

export function trainingDrillPathId(drillId: string): string {
  return drillId.replace(/-(ii|iii)$/, '');
}

function assertDistinctTrainingDrillPaths(drills: readonly FocusDrill[]): void {
  const paths = drills.map(drill => trainingDrillPathId(drill.id));
  if (new Set(paths).size !== paths.length) {
    throw new Error('a training plan can use only one level from each drill path');
  }
}

function assertCareerTrainingDrillsUnlocked(
  state: GameState,
  drills: readonly FocusDrill[],
): void {
  for (const drill of drills) {
    const blockedReason = trainingDrillBlockedReason(state, drill.id);
    if (blockedReason !== undefined) throw new Error(blockedReason);
  }
}

function capConflictsAsSkippedCaps(
  state: GameState,
  conflicts: readonly TrainingPlanCapConflict[],
): TrainingCapReached[] {
  const existingSkipped = new Set(
    (state.trainingCapNotices ?? [])
      .filter(notice => notice.kind === 'skipped')
      .map(notice => `${notice.playerId}:${notice.drillId}:${notice.attribute}`),
  );
  return conflicts.flatMap(conflict => conflict.attributes.flatMap(attribute => {
    const key = `${conflict.playerId}:${conflict.drillId}:${attribute}`;
    if (existingSkipped.has(key)) return [];
    const player = state.players.find(candidate => candidate.id === conflict.playerId);
    if (player === undefined) return [];
    return [{
      playerId: conflict.playerId,
      playerName: conflict.playerName,
      drillId: conflict.drillId,
      attribute,
      cap: playerAttributeCaps(player)[attribute],
      kind: 'skipped' as const,
    }];
  }));
}

function trainingCapNotice(state: GameState, cap: TrainingCapReached) {
  const kind = cap.kind ?? 'reached';
  return {
    id: kind === 'skipped'
      ? `training-cap:skipped:s${state.season}-w${state.week}:${cap.playerId}:${cap.attribute}:${cap.drillId}`
      : `training-cap:s${state.season}-w${state.week}:${cap.playerId}:${cap.attribute}:${cap.drillId}`,
    season: state.season,
    week: state.week,
    ...cap,
  };
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
