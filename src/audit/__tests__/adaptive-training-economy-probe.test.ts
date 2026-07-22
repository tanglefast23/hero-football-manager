/**
 * OPT-IN BALANCE PROBE (not a gate): follows an adaptive weekly training plan
 * across roughly fifty available training weeks. The planner rotates through
 * unlocked drills, replaces capped trainee/drill pairs, spends banked TP, and
 * scales the trainee group down before declaring that cash blocks training.
 *
 * Directional run (default 30 careers):
 *   npm run test:probe -- src/audit/__tests__/adaptive-training-economy-probe.test.ts
 * Final run:
 *   ADAPTIVE_ECONOMY_SEEDS=300 npm run test:probe -- \
 *     src/audit/__tests__/adaptive-training-economy-probe.test.ts
 */
import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  FACILITY_CATALOG,
  activeCareerMatchday,
  advanceWeek,
  chargeableCareerTrainingPlan,
  completeMatchday,
  createCareer,
  renewCareerPlayer,
  setCareerTrainingPlan,
  startNextSeason,
  type CareerPlayer,
  type FocusDrill,
  type GameState,
} from '../../game';

const content = loadLaunchContent();
const SEEDS = positiveIntegerEnv('ADAPTIVE_ECONOMY_SEEDS', 30);
const SETTLED_WEEKS = positiveIntegerEnv('ADAPTIVE_ECONOMY_WEEKS', 50);
const MAX_TRAINEES = 3;
const CHEAP_DRILL_CEILING = 10;
const TP_PILE_CEILING = 50;
const NEXT_PURCHASE_COST = Math.min(...Object.values(FACILITY_CATALOG)
  .filter(facility => facility.type !== 'training-pitch' && facility.available)
  .map(facility => facility.buildCost));

interface UsefulOption {
  drill: FocusDrill;
  eligiblePlayerIds: string[];
  moneyPerTrainee: number;
  trainingPointCost: number;
}

interface CareerRun {
  seed: number;
  settledWeeks: number;
  trainedWeeks: number;
  distinctDrillIds: Set<string>;
  capDrivenReassignments: number;
  cheapUsefulWeeks: number;
  cheapTpBlockedWeeks: number;
  tpWaitWeeks: number;
  longestTpWaitStreak: number;
  maxTpWhileTrainingAffordable: number;
  longestTpGrowthStreak: number;
  cashBlockedTrainingWeeks: number;
  firstPurchaseBlockedWeek?: number;
  minimumCash: number;
  finalCash: number;
  finalTrainingPoints: number;
  usefulOptionsAtEnd: number;
  affordableUsefulOptionsAtEnd: number;
}

describe('adaptive training and economy balance probe', () => {
  it('keeps useful training funded by TP until cash becomes the real constraint', () => {
    const runs = Array.from({ length: SEEDS }, (_, index) => runCareer(8_000_000 + index * 7919));

    for (const run of runs) {
      expect(run.settledWeeks).toBe(SETTLED_WEEKS);
      expect(run.trainedWeeks).toBeGreaterThan(0);
      expect(run.distinctDrillIds.size).toBeGreaterThan(1);
      expect(run.capDrivenReassignments).toBeGreaterThan(0);

      // A useful 9- or 10-TP option must never be rejected for TP now that the
      // operational Level-1 Training Pitch restores 10 TP every settlement.
      expect(run.cheapTpBlockedWeeks).toBe(0);

      // Small waits for an 11-15 TP drill are allowed, but an adaptive manager
      // must spend the bank rather than reproduce the old permanent 98-TP pile.
      expect(run.longestTpWaitStreak).toBeLessThanOrEqual(2);
      expect(run.maxTpWhileTrainingAffordable).toBeLessThan(TP_PILE_CEILING);
      expect(run.longestTpGrowthStreak).toBeLessThanOrEqual(2);
      expect(
        run.finalTrainingPoints < TP_PILE_CEILING || run.affordableUsefulOptionsAtEnd === 0,
      ).toBe(true);

      // Training need not bankrupt the club. It must, however, force a real
      // choice by blocking either the cheapest useful session or the next
      // facility-sized purchase.
      expect(
        run.cashBlockedTrainingWeeks > 0 || run.firstPurchaseBlockedWeek !== undefined,
      ).toBe(true);
    }

    report(runs);
  }, 900_000);
});

function runCareer(seed: number): CareerRun {
  let state = createCareer(createLaunchCareerSetup(seed, undefined, content, 'full', 'COZY'));
  const run: CareerRun = {
    seed,
    settledWeeks: 0,
    trainedWeeks: 0,
    distinctDrillIds: new Set(),
    capDrivenReassignments: 0,
    cheapUsefulWeeks: 0,
    cheapTpBlockedWeeks: 0,
    tpWaitWeeks: 0,
    longestTpWaitStreak: 0,
    maxTpWhileTrainingAffordable: 0,
    longestTpGrowthStreak: 0,
    cashBlockedTrainingWeeks: 0,
    minimumCash: userCash(state),
    finalCash: userCash(state),
    finalTrainingPoints: state.trainingPoints,
    usefulOptionsAtEnd: 0,
    affordableUsefulOptionsAtEnd: 0,
  };
  const lastAssignedByDrill = new Map<string, string[]>();
  let optionCursor = 0;
  let tpWaitStreak = 0;
  let tpGrowthStreak = 0;
  let previousAffordableTp: number | undefined;
  let transitions = 0;

  while (run.settledWeeks < SETTLED_WEEKS) {
    transitions += 1;
    if (transitions > SETTLED_WEEKS * 4 + 20) {
      throw new Error(`adaptive economy seed ${seed} exceeded its transition guard`);
    }

    if (state.phase === 'season-end') {
      for (const player of state.players.filter(candidate => (
        candidate.clubId === state.userClubId && candidate.contractSeasonsRemaining === 0
      ))) {
        state = renewCareerPlayer(state, player.id, 4, 1);
      }
      state = startNextSeason(state);
      continue;
    }

    if (state.phase === 'matchday') {
      const ledgersBefore = state.ledgers.length;
      state = settleMatchday(state);
      if (state.ledgers.length > ledgersBefore) {
        run.settledWeeks += 1;
        recordSettlement(run, state);
      }
      continue;
    }

    if (state.phase !== 'manage') {
      throw new Error(`adaptive economy seed ${seed} entered unsupported phase ${state.phase}`);
    }

    const options = usefulOptions(state);
    const cheapOptions = options.filter(option => option.trainingPointCost <= CHEAP_DRILL_CEILING);
    if (cheapOptions.length > 0) {
      run.cheapUsefulWeeks += 1;
      const cheapest = Math.min(...cheapOptions.map(option => option.trainingPointCost));
      if (state.trainingPoints < cheapest) run.cheapTpBlockedWeeks += 1;
    }

    const tpAffordable = options.filter(option => option.trainingPointCost <= state.trainingPoints);
    const cashAffordable = tpAffordable.filter(option => option.moneyPerTrainee <= userCash(state));
    if (options.length > 0 && tpAffordable.length === 0) {
      run.tpWaitWeeks += 1;
      tpWaitStreak += 1;
      run.longestTpWaitStreak = Math.max(run.longestTpWaitStreak, tpWaitStreak);
    } else {
      tpWaitStreak = 0;
    }

    if (cashAffordable.length > 0) {
      run.maxTpWhileTrainingAffordable = Math.max(
        run.maxTpWhileTrainingAffordable,
        state.trainingPoints,
      );
      if (previousAffordableTp !== undefined && state.trainingPoints > previousAffordableTp) {
        tpGrowthStreak += 1;
        run.longestTpGrowthStreak = Math.max(run.longestTpGrowthStreak, tpGrowthStreak);
      } else {
        tpGrowthStreak = 0;
      }
      previousAffordableTp = state.trainingPoints;
    } else {
      previousAffordableTp = undefined;
      tpGrowthStreak = 0;
    }

    if (tpAffordable.length > 0 && cashAffordable.length === 0) {
      run.cashBlockedTrainingWeeks += 1;
    }
    if (userCash(state) < NEXT_PURCHASE_COST && run.firstPurchaseBlockedWeek === undefined) {
      run.firstPurchaseBlockedWeek = run.settledWeeks + 1;
    }

    if (cashAffordable.length === 0) {
      state = clearTrainingPlan(state);
    } else {
      // Rotate across useful drills, but prefer a high-cost drill whenever TP
      // reaches the old pile-up threshold. Both rules are deterministic.
      const ordered = [...cashAffordable].sort((left, right) => (
        right.trainingPointCost - left.trainingPointCost || left.drill.id.localeCompare(right.drill.id)
      ));
      const selected = state.trainingPoints >= 30
        ? ordered[0]
        : ordered[optionCursor % ordered.length];
      optionCursor += 1;
      const traineeCount = Math.min(
        MAX_TRAINEES,
        selected.eligiblePlayerIds.length,
        Math.floor(userCash(state) / selected.moneyPerTrainee),
      );
      const assignedPlayerIds = selected.eligiblePlayerIds.slice(0, traineeCount);
      const previousAssigned = lastAssignedByDrill.get(selected.drill.id) ?? [];
      for (const playerId of previousAssigned) {
        if (!assignedPlayerIds.includes(playerId) && isCappedForDrill(state, playerId, selected.drill)) {
          run.capDrivenReassignments += 1;
        }
      }
      lastAssignedByDrill.set(selected.drill.id, [...assignedPlayerIds]);
      state = setCareerTrainingPlan(state, assignedPlayerIds, [selected.drill]);
      run.trainedWeeks += 1;
      run.distinctDrillIds.add(selected.drill.id);
    }

    const ledgersBefore = state.ledgers.length;
    state = advanceWeek(state);
    if (state.ledgers.length > ledgersBefore) {
      run.settledWeeks += 1;
      recordSettlement(run, state);
    }
  }

  run.finalCash = userCash(state);
  run.finalTrainingPoints = state.trainingPoints;
  const inspectionState = state.phase === 'season-end'
    ? prepareNextSeasonForInspection(state)
    : state;
  const endingOptions = usefulOptions(inspectionState);
  run.usefulOptionsAtEnd = endingOptions.length;
  run.affordableUsefulOptionsAtEnd = endingOptions.filter(option => (
    option.trainingPointCost <= inspectionState.trainingPoints
    && option.moneyPerTrainee <= userCash(inspectionState)
  )).length;
  return run;
}

function usefulOptions(state: GameState): UsefulOption[] {
  const roster = state.players.filter(player => (
    player.clubId === state.userClubId && player.injuryWeeks === 0
  ));
  return content.training.focusDrills.flatMap(drill => {
    const eligiblePlayerIds = roster
      .filter(player => canBenefit(state, player, drill))
      .map(player => player.id)
      .sort();
    if (eligiblePlayerIds.length === 0) return [];
    const chargeable = chargeableCareerTrainingPlan(state, [eligiblePlayerIds[0]], [drill]);
    if (chargeable.drills.length === 0 || chargeable.moneyCost <= 0) return [];
    return [{
      drill,
      eligiblePlayerIds,
      moneyPerTrainee: chargeable.moneyCost,
      trainingPointCost: chargeable.trainingPointCost,
    }];
  });
}

function canBenefit(state: GameState, player: CareerPlayer, drill: FocusDrill): boolean {
  return chargeableCareerTrainingPlan(state, [player.id], [drill]).drills.length > 0;
}

function isCappedForDrill(state: GameState, playerId: string, drill: FocusDrill): boolean {
  return chargeableCareerTrainingPlan(state, [playerId], [drill]).drills.length === 0;
}

function settleMatchday(state: GameState): GameState {
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined) throw new Error('adaptive economy entered matchday without a fixture');
  const results = matchday.fixtures.map(fixture => {
    if (matchday.kind === 'league') {
      return { fixtureId: fixture.id, homeGoals: 1, awayGoals: 1 };
    }
    const userIsHome = fixture.homeClubId === state.userClubId;
    return {
      fixtureId: fixture.id,
      homeGoals: userIsHome ? 0 : 1,
      awayGoals: userIsHome ? 1 : 0,
    };
  });
  return completeMatchday(state, results);
}

function prepareNextSeasonForInspection(state: GameState): GameState {
  let next = state;
  for (const player of next.players.filter(candidate => (
    candidate.clubId === next.userClubId && candidate.contractSeasonsRemaining === 0
  ))) {
    next = renewCareerPlayer(next, player.id, 4, 1);
  }
  return startNextSeason(next);
}

function clearTrainingPlan(state: GameState): GameState {
  if (state.trainingPlan === undefined) return state;
  const { trainingPlan: _removed, ...rest } = state;
  return rest as GameState;
}

function recordSettlement(run: CareerRun, state: GameState): void {
  const cash = userCash(state);
  run.minimumCash = Math.min(run.minimumCash, cash);
  run.finalCash = cash;
  run.finalTrainingPoints = state.trainingPoints;
}

function userCash(state: GameState): number {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error(`adaptive economy lost user club ${state.userClubId}`);
  return club.cash;
}

function report(runs: readonly CareerRun[]): void {
  const average = (pick: (run: CareerRun) => number): number => Math.round(
    (runs.reduce((sum, run) => sum + pick(run), 0) / runs.length) * 100,
  ) / 100;
  const percent = (predicate: (run: CareerRun) => boolean): number => Math.round(
    (runs.filter(predicate).length / runs.length) * 1000,
  ) / 10;
  const firstPurchaseWeeks = runs
    .map(run => run.firstPurchaseBlockedWeek)
    .filter((week): week is number => week !== undefined);

  const lines = [
    '',
    `=== ADAPTIVE TRAINING + ECONOMY (${runs.length} careers, ${SETTLED_WEEKS} weeks each) ===`,
    `training: avg weeks ${average(run => run.trainedWeeks)}`
      + `  drills ${average(run => run.distinctDrillIds.size)}`
      + `  cap reassignments ${average(run => run.capDrivenReassignments)}`,
    `TP: cheap useful weeks ${average(run => run.cheapUsefulWeeks)}`
      + `  cheap blocks ${runs.reduce((sum, run) => sum + run.cheapTpBlockedWeeks, 0)}`
      + `  avg waits ${average(run => run.tpWaitWeeks)}`
      + `  peak while affordable ${Math.max(...runs.map(run => run.maxTpWhileTrainingAffordable))}`,
    `cash: avg minimum ${average(run => run.minimumCash)}`
      + `  avg final ${average(run => run.finalCash)}`
      + `  avg training blocks ${average(run => run.cashBlockedTrainingWeeks)}`
      + `  training-block careers ${percent(run => run.cashBlockedTrainingWeeks > 0)}%`
      + `  ${NEXT_PURCHASE_COST}-purchase-block careers ${percent(run => run.firstPurchaseBlockedWeek !== undefined)}%`,
    `first ${NEXT_PURCHASE_COST}-purchase block: avg week ${firstPurchaseWeeks.length === 0
      ? 'n/a'
      : Math.round((firstPurchaseWeeks.reduce((sum, week) => sum + week, 0) / firstPurchaseWeeks.length) * 10) / 10}`,
    `end: avg TP ${average(run => run.finalTrainingPoints)}`
      + `  useful unlocked options ${average(run => run.usefulOptionsAtEnd)}`
      + `  affordable useful options ${average(run => run.affordableUsefulOptionsAtEnd)}`,
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

function positiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} must be a safe positive integer`);
  return parsed;
}
