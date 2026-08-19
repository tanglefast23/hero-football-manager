/**
 * OPT-IN BALANCE PROBE (not a CI gate): measures whether a managed club that
 * earns promotion from D5 can survive D4. Both paired paths build and upgrade
 * the Training Pitch, buy useful drill tiers, train through the whole season,
 * and play every fixture through production Quick Result. The prepared path
 * additionally scouts and signs up to two affordable reported upgrades in
 * Weeks 1-4; its paired control keeps the same promoted save and development
 * policy but makes no transfer-window move.
 *
 * Smoke run (three careers by default):
 *   npm run test:probe -- src/audit/__tests__/promotion-survival-probe.test.ts
 * Final acceptance run (single process):
 *   PROMOTION_SURVIVAL_SEEDS=300 PROMOTION_SURVIVAL_WEEKS=30 npm run test:probe -- \
 *     src/audit/__tests__/promotion-survival-probe.test.ts
 * The same 300-career sample may be split into disjoint shards with
 * PROMOTION_SURVIVAL_SEED_OFFSET, PROMOTION_SURVIVAL_SEEDS, and the optional
 * PROMOTION_SURVIVAL_DIFFICULTY=COZY|CHAIRMAN filter. Point every shard at one
 * fresh PROMOTION_SURVIVAL_SUMMARY_DIR, then run the aggregate probe. Shards
 * validate individual careers but never enforce cohort statistics alone.
 *
 * A shorter week limit is directional only. Week 30 is required to classify
 * actual survival because the bottom two clubs are relegated after 18 matches.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createLaunchCareerSetup } from '../../application/launch';
import { careerMarketScoutOptions } from '../../application/market-source-adapter';
import { loadLaunchContent } from '../../content';
import {
  activeCareerMatchday,
  addCreatedPlayer,
  advanceWeek,
  beginCareerTransferTalks,
  beginStoryOnboarding,
  buildCareerMatchTeams,
  buildCareerMatchTeamDef,
  careerHeroLimit,
  careerTransferTarget,
  completeCareerTransfer,
  completeFirstOnboardingMatch,
  completeMatchday,
  completePostMatchAwakening,
  createCareer,
  currentUserDivision,
  hasActiveCareerContractPromise,
  isFirstOnboardingFixture,
  leagueStandings,
  nextTrainingUpgradeOffer,
  playerAttributeCaps,
  POSITION_TRAINING_ATTRIBUTES,
  quickMatchForFixture,
  renewCareerPlayer,
  resolveTrainingDrillForPath,
  trainPlayerInstantly,
  restoreCareerContractPromiseLineup,
  resolvePostMatchAwakening,
  roleOverall,
  sellCareerPlayer,
  selectCareerLicensedHeroes,
  setCareerLineup,
  startCareerScoutMission,
  startNextSeason,
  submitCareerTransferOffer,
  careerRosterCapacity,
  userCareerRosterCount,
  type CareerPlayer,
  type DifficultyMode,
  type GameState,
} from '../../game';
import {
  buildCareerFacility,
  purchaseCareerTrainingUpgrade,
  upgradeCareerFacility,
} from '../../game/management';
import { willRetireAtSeasonTransition } from '../../game/m2-career';
import type { ScoutReport } from '../../game/market';
import type { Attrs, Role } from '../../sim/types';
import {
  PROMOTION_SURVIVAL_SUMMARY_VERSION,
  aggregatePromotionSurvivalShards,
  assertPromotionSurvivalSeedWindow,
  promotionSurvivalSeed,
  type PromotionSurvivalShardSummary,
} from '../promotion-survival-summary';

const content = loadLaunchContent();
const SEED_COUNT = positiveIntegerEnv('PROMOTION_SURVIVAL_SEEDS', 3, 10_000);
const D4_WEEKS = positiveIntegerEnv('PROMOTION_SURVIVAL_WEEKS', 30, 30);
const SEED_OFFSET = nonNegativeIntegerEnv(
  'PROMOTION_SURVIVAL_SEED_OFFSET',
  0,
  40_000,
);
const SUMMARY_DIR = optionalNonemptyEnv('PROMOTION_SURVIVAL_SUMMARY_DIR');
const PRESEASON_LAST_WEEK = 4;
const FINAL_SEASON_WEEK = 30;
const AGGREGATE_SEED_COUNT = 300;
const MAX_D5_SEASONS = 2;
const MAX_PRESEASON_SIGNINGS = 2;
const DRILL_UPGRADE_CASH_RESERVE = 12_000;
const DIFFICULTIES = promotionSurvivalDifficulties(
  process.env.PROMOTION_SURVIVAL_DIFFICULTY,
);
const POWER_IDS = content.powers.powers.map((power) => power.id);
const TRIGGER_IDS = content.onboarding.triggers.map((trigger) => trigger.id);
const AWAKENING_TUNING = {
  weeklyChanceStepPercent: content.powers.awakening.weeklyChanceStepPercent,
  maxPerSeason: content.powers.awakening.maxPerSeason,
  minimumMatchesBetween: content.powers.awakening.minimumMatchesBetween,
};

interface SeasonOutcome {
  readonly completed: boolean;
  readonly position: number;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly points: number;
  readonly goalDifference: number;
  readonly preWindowStrength: number;
  readonly postWindowStrength: number;
  readonly endingCash: number;
  readonly trainingWeeks: number;
  readonly scoutReports: number;
  readonly scoutBriefId: string;
  readonly signingStopReason: SigningStopReason;
  readonly signings: number;
  readonly signed: boolean;
  readonly saleFee: number;
  readonly transferFee: number;
  readonly signedUpgrade: number;
  readonly licensedStarterPowers: number;
  readonly licensedStarterTier1: number;
  readonly licensedStarterTier2: number;
  readonly licensedStarterTier3: number;
  readonly opponentStrengthMinimum: number;
  readonly opponentStrengthMedian: number;
  readonly opponentStrengthMaximum: number;
}

interface LicensedStarterProfile {
  readonly powers: number;
  readonly tier1: number;
  readonly tier2: number;
  readonly tier3: number;
}

interface StrengthRange {
  readonly minimum: number;
  readonly median: number;
  readonly maximum: number;
}

interface PairedRun {
  readonly seedIndex: number;
  readonly seed: number;
  readonly promotedInSeason: number;
  readonly prepared: SeasonOutcome;
  readonly control: SeasonOutcome;
}

type SigningStopReason =
  | 'NOT_ATTEMPTED'
  | 'SCOUT_IN_PROGRESS'
  | 'SCOUT_INCOMPLETE'
  | 'NO_REPORTS'
  | 'NO_ELIGIBLE_ORDINARY_TARGETS'
  | 'NO_REPORTED_UPGRADES'
  | 'NO_AFFORDABLE_UPGRADES'
  | 'NO_RESERVE_SALE'
  | 'MAX_SIGNINGS';

interface PreparationState {
  state: GameState;
  scoutStarted: boolean;
  signingResolved: boolean;
  trainingWeeks: number;
  scoutReports: number;
  scoutBriefId: string;
  signingStopReason: SigningStopReason;
  signings: number;
  signed: boolean;
  saleFee: number;
  transferFee: number;
  signedUpgrade: number;
}

describe('promoted-club survival probe', () => {
  assertPromotionSurvivalSeedWindow(SEED_OFFSET, SEED_COUNT);

  it.each(DIFFICULTIES)(
    'measures a naturally promoted managed career through its first D4 season on %s',
    (difficulty) => {
      const runs = Array.from({ length: SEED_COUNT }, (_, index) => {
        const seedIndex = SEED_OFFSET + index;
        const seed = promotionSurvivalSeed(seedIndex);
        const promoted = createPromotedCareer(seed, difficulty);
        if (promoted.difficulty !== difficulty) {
          throw new Error(
            `promotion seed ${seed} lost ${difficulty} difficulty identity` +
              ` (received ${String(promoted.difficulty)})`,
          );
        }
        const prepared = runD4Season(promoted, seed, true);
        const control = runD4Season(promoted, seed, false);
        return {
          seedIndex,
          seed,
          promotedInSeason: promoted.season,
          prepared,
          control,
        };
      });

      expect(runs).toHaveLength(SEED_COUNT);
      expect(runs.every((run) => run.promotedInSeason <= MAX_D5_SEASONS)).toBe(
        true,
      );
      expect(
        runs.every((run) => run.prepared.played === run.control.played),
      ).toBe(true);
      expect(runs.every((run) => run.prepared.preWindowStrength > 0)).toBe(
        true,
      );
      if (D4_WEEKS === FINAL_SEASON_WEEK) {
        expect(
          runs.every((run) => run.prepared.completed && run.control.completed),
        ).toBe(true);
        expect(runs.every((run) => run.prepared.played === 18)).toBe(true);
        expect(
          runs.every((run) => recruitmentWindowResolved(run.prepared)),
        ).toBe(true);
      }

      const summary = promotionSurvivalShardSummary(runs, difficulty);
      emitPromotionSurvivalShardSummary(summary);
      const isCanonicalAggregate =
        D4_WEEKS === FINAL_SEASON_WEEK &&
        SEED_OFFSET === 0 &&
        SEED_COUNT === AGGREGATE_SEED_COUNT;
      report(runs, difficulty, isCanonicalAggregate);
      if (isCanonicalAggregate) {
        aggregatePromotionSurvivalShards([summary], {
          expectedDifficulties: [difficulty],
          expectedSeedCount: AGGREGATE_SEED_COUNT,
          throughWeek: FINAL_SEASON_WEEK,
        });
      }
    },
    14_400_000,
  );
});

/**
 * Earns the promotion being measured through the existing managed-career
 * policy: real fixtures, a Training Pitch, drill-tier purchases, and useful
 * weekly training. A club that cannot earn promotion within two seasons is a
 * real red result; the probe must never manufacture a table position for it.
 */
function createPromotedCareer(
  seed: number,
  difficulty: DifficultyMode,
): GameState {
  let state = addCreatedPlayer(
    beginStoryOnboarding(
      createCareer(
        createLaunchCareerSetup(seed, undefined, content, difficulty),
      ),
    ),
    {
      name: 'Promotion Probe Hero',
      ratings: { pac: 55, sho: 60, pas: 50, def: 50, tec: 50, sta: 50 },
      difficulty,
    },
  );
  for (let d5Season = 1; d5Season <= MAX_D5_SEASONS; d5Season += 1) {
    let guard = 0;
    while (state.phase !== 'season-end') {
      guard += 1;
      if (guard > 180)
        throw new Error(
          `promotion seed ${seed} exceeded its D5 transition guard`,
        );
      if (state.phase === 'manage') {
        state = choosePromotionHeroLicenses(state);
        state = buildManagedFacilities(state);
        state = buyManagedDrillUpgrades(state);
        state = trainManagedCore(state).state;
        state = advanceWeek(state);
        continue;
      }
      if (state.phase === 'matchday') {
        state = settleMeasuredMatchday(state);
        continue;
      }
      throw new Error(
        `promotion seed ${seed} entered unsupported phase ${state.phase}`,
      );
    }

    const finish = leagueStandings(state).find(
      (row) => row.clubId === state.userClubId,
    );
    if (finish === undefined)
      throw new Error(`promotion seed ${seed} lost its D5 standing`);
    state = renewExpiringPlayers(state);
    if (finish.position <= 2) return state;
    if (d5Season < MAX_D5_SEASONS) state = startNextSeason(state);
  }
  throw new Error(
    `promotion seed ${seed} did not earn D4 within ${MAX_D5_SEASONS} seasons`,
  );
}

function renewExpiringPlayers(state: GameState): GameState {
  let next = state;
  for (const player of state.players.filter(
    (candidate) =>
      candidate.clubId === state.userClubId &&
      candidate.contractSeasonsRemaining === 0 &&
      !willRetireAtSeasonTransition(candidate, state.season),
  )) {
    next = renewCareerPlayer(next, player.id, 4, 2);
  }
  return next;
}

function runD4Season(
  promoted: GameState,
  seed: number,
  prepared: boolean,
): SeasonOutcome {
  let state = choosePromotionHeroLicenses(startNextSeason(promoted));
  if (state.m2 === undefined || currentUserDivision(state.m2) !== 4) {
    throw new Error(`promotion seed ${seed} did not enter Division 4`);
  }
  const preWindowStrength = startingElevenStrength(state);
  const prep: PreparationState = {
    state,
    scoutStarted: false,
    signingResolved: false,
    trainingWeeks: 0,
    scoutReports: 0,
    scoutBriefId: 'NOT_ATTEMPTED',
    signingStopReason: 'NOT_ATTEMPTED',
    signings: 0,
    signed: false,
    saleFee: 0,
    transferFee: 0,
    signedUpgrade: 0,
  };
  if (prepared) openPromotionWindow(prep);

  let postWindowStrength: number | undefined;
  let postWindowHeroes: LicensedStarterProfile | undefined;
  let postWindowOpponentStrengths: StrengthRange | undefined;
  let guard = 0;
  while (prep.state.phase !== 'season-end' && prep.state.week <= D4_WEEKS) {
    guard += 1;
    if (guard > D4_WEEKS * 5 + 30) {
      throw new Error(
        `promotion seed ${seed} exceeded its D4 transition guard`,
      );
    }
    if (prep.state.phase === 'manage') {
      // Later D4 awakenings also require the manager to revisit the limited
      // license allocation before the next weekly settlement.
      prep.state = choosePromotionHeroLicenses(prep.state);
      if (prepared && prep.state.week <= PRESEASON_LAST_WEEK) {
        tryCompletePromotionSigning(prep);
      }
      // The transfer-prepared policy keeps its cash liquid while the scout is
      // working, then resumes the same capital purchases as the control. Buying
      // newly unlocked drill tiers first made the later signing impossible and
      // compared two spending orders while calling one of them recruitment.
      const transferWindowPending =
        prepared &&
        prep.state.week <= PRESEASON_LAST_WEEK &&
        !prep.signingResolved;
      if (!transferWindowPending) {
        prep.state = buildManagedFacilities(prep.state);
        prep.state = buyManagedDrillUpgrades(prep.state);
      }
      const training = trainManagedCore(prep.state);
      prep.state = training.state;
      if (training.drills > 0) prep.trainingWeeks += 1;
      try {
        prep.state = advanceWeek(prep.state);
      } catch (error) {
        const lineup = userLineupIds(prep.state).map((id) => {
          const player = prep.state.players.find(
            (candidate) => candidate.id === id,
          )!;
          return {
            id,
            power: player.power,
            licensed: player.licensed,
            injuryWeeks: player.injuryWeeks,
            promise: player.contractPromise?.perk,
          };
        });
        const benchedHeroes = prep.state.players
          .filter(
            (player) =>
              player.clubId === prep.state.userClubId &&
              player.power !== undefined &&
              !userLineupIds(prep.state).includes(player.id),
          )
          .map((player) => ({
            id: player.id,
            power: player.power,
            licensed: player.licensed,
            injuryWeeks: player.injuryWeeks,
            promise: player.contractPromise?.perk,
          }));
        throw new Error(
          `D4 advance failed for seed ${seed} (${prepared ? 'prepared' : 'control'})` +
            ` in week ${prep.state.week}; lineup=${JSON.stringify(lineup)}` +
            `; benchedHeroes=${JSON.stringify(benchedHeroes)}`,
          { cause: error },
        );
      }
      if (
        prep.state.week > PRESEASON_LAST_WEEK &&
        postWindowStrength === undefined
      ) {
        postWindowStrength = startingElevenStrength(prep.state);
        postWindowHeroes = licensedStarterProfile(prep.state);
        postWindowOpponentStrengths = activeOpponentStrengthRange(prep.state);
      }
      continue;
    }
    if (prep.state.phase === 'matchday') {
      // A Week-4 plan must not leak into the Week-5 league settlement.
      prep.state = settleMeasuredMatchday(prep.state);
      continue;
    }
    throw new Error(
      `promotion seed ${seed} entered unsupported D4 phase ${prep.state.phase}`,
    );
  }
  if (
    prepared &&
    !prep.signingResolved &&
    prep.state.week > PRESEASON_LAST_WEEK
  ) {
    prep.signingResolved = true;
    prep.signingStopReason = 'SCOUT_INCOMPLETE';
  }
  postWindowStrength ??= startingElevenStrength(prep.state);
  postWindowHeroes ??= licensedStarterProfile(prep.state);
  postWindowOpponentStrengths ??= activeOpponentStrengthRange(prep.state);
  const row = leagueStandings(prep.state, 2).find(
    (candidate) => candidate.clubId === prep.state.userClubId,
  );
  if (row === undefined)
    throw new Error(`promotion seed ${seed} lost its D4 standing`);
  return {
    completed: prep.state.phase === 'season-end',
    position: row.position,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    points: row.points,
    goalDifference: row.goalDifference,
    preWindowStrength,
    postWindowStrength,
    endingCash: userCash(prep.state),
    trainingWeeks: prep.trainingWeeks,
    scoutReports: prep.scoutReports,
    scoutBriefId: prep.scoutBriefId,
    signingStopReason: prep.signingStopReason,
    signings: prep.signings,
    signed: prep.signed,
    saleFee: prep.saleFee,
    transferFee: prep.transferFee,
    signedUpgrade: prep.signedUpgrade,
    licensedStarterPowers: postWindowHeroes.powers,
    licensedStarterTier1: postWindowHeroes.tier1,
    licensedStarterTier2: postWindowHeroes.tier2,
    licensedStarterTier3: postWindowHeroes.tier3,
    opponentStrengthMinimum: postWindowOpponentStrengths.minimum,
    opponentStrengthMedian: postWindowOpponentStrengths.median,
    opponentStrengthMaximum: postWindowOpponentStrengths.maximum,
  };
}

/**
 * A real manager must choose the legal D4 Hero Licenses before advancing.
 * Keep the strongest promised/starting heroes and use the production lineup
 * boundary to bench any third awakened hero that the season transition placed
 * back in the eleven.
 */
function choosePromotionHeroLicenses(state: GameState): GameState {
  const lineupIds = new Set(userLineupIds(state));
  const selectedHeroIds = state.players
    .filter(
      (player) =>
        player.clubId === state.userClubId && player.power !== undefined,
    )
    .slice()
    .sort((left, right) => {
      const leftPromise = hasActiveStartingPromise(left);
      const rightPromise = hasActiveStartingPromise(right);
      if (leftPromise !== rightPromise) return leftPromise ? -1 : 1;
      const leftStarts = lineupIds.has(left.id);
      const rightStarts = lineupIds.has(right.id);
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
      return (
        roleOverall(right.role, right.attrs) -
          roleOverall(left.role, left.attrs) || left.id.localeCompare(right.id)
      );
    })
    .slice(0, careerHeroLimit(state))
    .map((player) => player.id);
  let next = restoreCareerContractPromiseLineup(
    selectCareerLicensedHeroes(state, selectedHeroIds),
  );
  const playerById = new Map(next.players.map((player) => [player.id, player]));
  const lineup = [...userLineupIds(next)];
  const selected = new Set(lineup);
  for (let slot = 0; slot < lineup.length; slot += 1) {
    const starter = playerById.get(lineup[slot])!;
    if (starter.power === undefined || starter.licensed) continue;
    selected.delete(starter.id);
    const eligible = next.players
      .filter(
        (candidate) =>
          candidate.clubId === next.userClubId &&
          !selected.has(candidate.id) &&
          candidate.injuryWeeks === 0 &&
          !(candidate.power !== undefined && !candidate.licensed) &&
          (slot === 0 ? candidate.role === 'GK' : candidate.role !== 'GK'),
      )
      .sort((left, right) => {
        const leftRolePenalty = left.role === starter.role ? 0 : 1;
        const rightRolePenalty = right.role === starter.role ? 0 : 1;
        return (
          leftRolePenalty - rightRolePenalty ||
          roleOverall(right.role, right.attrs) -
            roleOverall(left.role, left.attrs) ||
          left.id.localeCompare(right.id)
        );
      })[0];
    if (eligible === undefined) {
      throw new Error(
        `unlicensed promoted hero ${starter.id} has no eligible replacement`,
      );
    }
    lineup[slot] = eligible.id;
    selected.add(eligible.id);
  }
  next = setCareerLineup(next, lineup);
  return next;
}

function hasActiveStartingPromise(player: CareerPlayer): boolean {
  return (
    hasActiveCareerContractPromise(player) &&
    (player.contractPromise?.perk === 'GUARANTEED_STARTER' ||
      player.contractPromise?.perk === 'CAPTAINCY')
  );
}

function openPromotionWindow(prep: PreparationState): void {
  const state = prep.state;
  const market = state.market;
  if (market === undefined)
    throw new Error('promoted career has no transfer market');
  const focusRole = weakestStartingRole(state);
  const options = careerMarketScoutOptions(state);
  const selected = options
    .slice()
    .sort(
      (left, right) =>
        promotionScoutPriority(left.focus, focusRole) -
          promotionScoutPriority(right.focus, focusRole) ||
        left.id.localeCompare(right.id),
    )[0];
  if (selected === undefined)
    throw new Error('promoted career has no production scouting brief');
  const mission = startCareerScoutMission(
    state,
    market,
    selected.region,
    selected.focus,
    4,
  );
  prep.state = { ...mission.state, market: mission.market };
  prep.scoutStarted = true;
  prep.scoutBriefId = selected.id;
  prep.signingStopReason = 'SCOUT_IN_PROGRESS';
}

function promotionScoutPriority(
  focus: ReturnType<typeof careerMarketScoutOptions>[number]['focus'],
  weakestRole: Role,
): number {
  if (focus.kind === 'POSITION' && focus.role === weakestRole) return 0;
  if (focus.kind === 'AGE' && focus.minimumAge >= 22 && focus.maximumAge <= 29)
    return 1;
  if (focus.kind === 'POSITION') return 2;
  return 3;
}

function tryCompletePromotionSigning(prep: PreparationState): void {
  if (prep.signingResolved || !prep.scoutStarted) return;
  const market = prep.state.market;
  if (market === undefined)
    throw new Error('promotion preparation lost its transfer market');
  if (market.activeScoutMission !== undefined) return;
  prep.scoutReports = market.scoutReports.length;
  prep.signingResolved = true;
  for (let signing = 0; signing < MAX_PRESEASON_SIGNINGS; signing += 1) {
    const currentMarket = prep.state.market;
    if (currentMarket === undefined)
      throw new Error('promotion signing lost its market');
    const rosterFull =
      userCareerRosterCount(prep.state) >= careerRosterCapacity(prep.state);
    // This is a transfer-prepared policy, so it funds each arrival with the
    // weakest ordinary reserve even when a retirement has already opened a
    // roster slot. Selling only when the roster was full left Chairman with a
    // nominal transfer plan and no spendable cash.
    const previewSale = sellPromotionReserve(prep.state, currentMarket);
    if (rosterFull && previewSale === undefined) {
      prep.signingStopReason = 'NO_RESERVE_SALE';
      return;
    }
    const availableCash = userCash(previewSale?.state ?? prep.state);
    if (currentMarket.scoutReports.length === 0) {
      prep.signingStopReason = 'NO_REPORTS';
      return;
    }
    const eligible = currentMarket.scoutReports
      .map((report) => signingCandidate(prep.state, currentMarket, report))
      .filter(
        (candidate): candidate is NonNullable<typeof candidate> =>
          candidate !== undefined,
      );
    if (eligible.length === 0) {
      prep.signingStopReason = 'NO_ELIGIBLE_ORDINARY_TARGETS';
      return;
    }
    const upgrades = eligible.filter(
      (candidate) => candidate.reportedUpgrade > 0,
    );
    if (upgrades.length === 0) {
      prep.signingStopReason = 'NO_REPORTED_UPGRADES';
      return;
    }
    const candidates = upgrades
      .filter((candidate) => candidate.fee <= availableCash)
      .sort(
        (left, right) =>
          right.reportedUpgrade - left.reportedUpgrade ||
          right.reportedPotential - left.reportedPotential ||
          left.fee - right.fee ||
          left.report.playerId.localeCompare(right.report.playerId),
      );
    const selected = candidates[0];
    if (selected === undefined) {
      prep.signingStopReason = 'NO_AFFORDABLE_UPGRADES';
      return;
    }
    const sale = sellPromotionReserve(prep.state, selected.market);
    if (rosterFull && sale === undefined) {
      prep.signingStopReason = 'NO_RESERVE_SALE';
      return;
    }
    const transferState = sale?.state ?? prep.state;
    const transferMarket = sale?.market ?? selected.market;
    const talks = submitCareerTransferOffer(transferState, transferMarket, {
      weeklyWage: selected.weeklyAsk,
      termSeasons: 2,
      perk: 'GUARANTEED_STARTER',
    });
    const beforeStrength = startingElevenStrength(transferState);
    const completed = completeCareerTransfer(transferState, talks);
    prep.saleFee += sale?.state.cashTransactions?.at(-1)?.amount ?? 0;
    prep.state = { ...completed.state, market: completed.market };
    prep.transferFee += selected.fee;
    prep.signings += 1;
    prep.signed = true;
    prep.signedUpgrade += startingElevenStrength(prep.state) - beforeStrength;
  }
  prep.signingStopReason = 'MAX_SIGNINGS';
}

function sellPromotionReserve(
  state: GameState,
  market: NonNullable<GameState['market']>,
) {
  const lineupIds = new Set(userLineupIds(state));
  const reserve = state.players
    .filter(
      (player) =>
        player.clubId === state.userClubId &&
        !lineupIds.has(player.id) &&
        player.role !== 'GK' &&
        player.power === undefined &&
        player.contractPromise === undefined,
    )
    .sort(
      (left, right) =>
        roleOverall(left.role, left.attrs) -
          roleOverall(right.role, right.attrs) ||
        left.id.localeCompare(right.id),
    )[0];
  if (reserve === undefined) return undefined;
  const buyer = state.clubs
    .filter((club) => club.id !== state.userClubId)
    .sort(
      (left, right) =>
        right.cash - left.cash || left.id.localeCompare(right.id),
    )[0];
  if (buyer === undefined)
    throw new Error('promoted career has no transfer buyer');
  return sellCareerPlayer(state, market, reserve.id, buyer.id, 4);
}

function signingCandidate(
  state: GameState,
  market: NonNullable<GameState['market']>,
  report: ScoutReport,
):
  | {
      report: ScoutReport;
      market: NonNullable<GameState['market']>;
      fee: number;
      weeklyAsk: number;
      reportedUpgrade: number;
      reportedPotential: number;
    }
  | undefined {
  const target = careerTransferTarget(state, report.playerId, 4);
  const player = target?.player;
  // A normal signing is enough for this gate. Do not let an extra hidden hero
  // or a full license allocation turn it into a different experiment.
  if (player === undefined || player.power !== undefined) return undefined;
  const weakest = weakestStarterForRole(state, report.role);
  if (weakest === undefined) return undefined;
  const candidateMarket = beginCareerTransferTalks(
    state,
    market,
    report.playerId,
  );
  const talks = candidateMarket.transferTalks!;
  return {
    report,
    market: candidateMarket,
    fee: talks.transferQuote.fee,
    weeklyAsk: talks.negotiation.weeklyAsk,
    reportedUpgrade:
      reportedOverall(report) - roleOverall(weakest.role, weakest.attrs),
    reportedPotential:
      (report.potentialRange.minimum + report.potentialRange.maximum) / 2,
  };
}

function settleMeasuredMatchday(state: GameState): GameState {
  const matchday = activeCareerMatchday(state);
  if (matchday === undefined)
    throw new Error('survival probe entered matchday without a fixture');
  const fixture = matchday.fixture;
  const teams = buildCareerMatchTeams(state, [
    ...new Set(
      matchday.fixtures.flatMap((candidate) => [
        candidate.homeClubId,
        candidate.awayClubId,
      ]),
    ),
  ]);
  const quickMatches = matchday.fixtures.map((candidate) => ({
    fixture: candidate,
    quick: quickMatchForFixture(
      candidate,
      teams,
      candidate.id === fixture.id
        ? {
            userClubId: state.userClubId,
            initialFormation: '4-4-2',
            autoSubs: false,
          }
        : undefined,
    ),
  }));
  const userQuick = quickMatches.find(
    (candidate) => candidate.fixture.id === fixture.id,
  )?.quick;
  if (userQuick === undefined)
    throw new Error('survival probe lost the user Quick Result replay');
  if (userQuick.production === undefined) {
    throw new Error('survival probe did not produce user match facts');
  }
  const results = quickMatches.map((candidate) => candidate.quick.result);
  const settled = completeMatchday(state, results, userQuick.production);
  const completed = isFirstOnboardingFixture(state, fixture.id)
    ? completeFirstOnboardingMatch(settled, fixture.id)
    : settled;
  if (matchday.kind !== 'league') return completed;
  const awakening = resolvePostMatchAwakening(
    completed,
    fixture.id,
    userQuick.production.participantPlayerIds,
    POWER_IDS,
    TRIGGER_IDS,
    AWAKENING_TUNING,
  );
  return awakening.awakened
    ? completePostMatchAwakening(awakening.state)
    : awakening.state;
}

/** Matches the natural division-entry policy: build and then upgrade the Pitch. */
function buildManagedFacilities(state: GameState): GameState {
  const grid = state.facilities.grid;
  if (grid === undefined || grid.construction !== undefined) return state;
  const pitch = grid.buildings.find(
    (building) => building.type === 'training-pitch',
  );
  try {
    if (pitch === undefined) {
      return buildCareerFacility(state, 'training-pitch', { x: 0, y: 0 }).state;
    }
    if (pitch.level < 3) return upgradeCareerFacility(state, pitch.id).state;
  } catch {
    return state;
  }
  return state;
}

/** Buys the same useful core drill tiers as the natural division-entry policy. */
function buyManagedDrillUpgrades(state: GameState): GameState {
  let next = state;
  for (const pathId of [
    'finishing',
    'duels',
    'keeper-drills',
    'rondo',
    'first-touch',
  ]) {
    const offer = nextTrainingUpgradeOffer(next, pathId);
    if (offer === undefined || offer.blockedReason !== undefined) continue;
    if (userCash(next) - offer.cost < DRILL_UPGRADE_CASH_RESERVE) continue;
    next = purchaseCareerTrainingUpgrade(next, pathId).state;
  }
  return next;
}

/** Trains one healthy core starter per role, every management week. */
function trainManagedCore(state: GameState): {
  state: GameState;
  drills: number;
} {
  const starters = userLineupIds(state)
    .map((id) => state.players.find((player) => player.id === id))
    .filter(
      (player): player is CareerPlayer =>
        player !== undefined && player.injuryWeeks === 0,
    );
  const core = (['GK', 'DEF', 'MID', 'FWD'] as const)
    .map(
      (role) =>
        starters
          .filter((player) => player.role === role)
          .sort(
            (left, right) =>
              roleOverall(right.role, right.attrs) -
                roleOverall(left.role, left.attrs) ||
              left.id.localeCompare(right.id),
          )[0],
    )
    .filter((player): player is CareerPlayer => player !== undefined);
  const pathByAttribute = {
    pac: 'sprints',
    sho: 'finishing',
    pas: 'rondo',
    def: 'duels',
    tec: 'first-touch',
    sta: 'circuit',
    ref: 'keeper-drills',
  } as const;
  const rotation = (state.season * 30 + state.week) % Math.max(1, core.length);
  const order = [...core.slice(rotation), ...core.slice(0, rotation)];
  let next = state;
  let drills = 0;
  for (let index = 0; index < order.length; index += 1) {
    const player = order[index];
    const attributes =
      player.role === 'GK'
        ? (['ref'] as const)
        : POSITION_TRAINING_ATTRIBUTES[player.role];
    const attribute =
      attributes[(state.season * 30 + state.week + index) % attributes.length];
    if (player.attrs[attribute] >= playerAttributeCaps(player)[attribute])
      continue;
    const pathId = pathByAttribute[attribute];
    if (resolveTrainingDrillForPath(next, pathId).tpCost > next.trainingPoints)
      continue;
    try {
      next = trainPlayerInstantly(next, player.id, pathId).state;
      drills += 1;
    } catch {
      continue;
    }
  }
  return { state: next, drills };
}

function weakestStartingRole(state: GameState): Role {
  const players = userLineupIds(state).map((id) =>
    state.players.find((player) => player.id === id)!,
  );
  return players
    .slice()
    .sort(
      (left, right) =>
        roleOverall(left.role, left.attrs) -
          roleOverall(right.role, right.attrs) ||
        left.id.localeCompare(right.id),
    )[0].role;
}

function weakestStarterForRole(
  state: GameState,
  role: Role,
): CareerPlayer | undefined {
  return userLineupIds(state)
    .map((id) => state.players.find((player) => player.id === id)!)
    .filter(
      (player) =>
        player.role === role &&
        player.contractPromise?.perk !== 'GUARANTEED_STARTER' &&
        player.contractPromise?.perk !== 'CAPTAINCY',
    )
    .sort(
      (left, right) =>
        roleOverall(left.role, left.attrs) -
          roleOverall(right.role, right.attrs) ||
        left.id.localeCompare(right.id),
    )[0];
}

function reportedOverall(report: ScoutReport): number {
  const attrs = Object.fromEntries(
    Object.entries(report.statRanges).map(([key, range]) => [
      key,
      Math.round((range.minimum + range.maximum) / 2),
    ]),
  ) as unknown as Attrs;
  return roleOverall(report.role, attrs);
}

function startingElevenStrength(state: GameState): number {
  return clubStartingElevenStrength(state, state.userClubId);
}

function clubStartingElevenStrength(state: GameState, clubId: string): number {
  const team = buildCareerMatchTeamDef(state, clubId);
  return (
    Math.round(
      (team.players.reduce(
        (sum, player) => sum + roleOverall(player.role, player.attrs),
        0,
      ) /
        team.players.length) *
        100,
    ) / 100
  );
}

function licensedStarterProfile(state: GameState): LicensedStarterProfile {
  const starters = new Set(userLineupIds(state));
  const powered = state.players.filter(
    (player) =>
      player.clubId === state.userClubId &&
      starters.has(player.id) &&
      player.power !== undefined &&
      player.licensed,
  );
  return {
    powers: powered.length,
    tier1: powered.filter((player) => (player.powerTier ?? 1) === 1).length,
    tier2: powered.filter((player) => player.powerTier === 2).length,
    tier3: powered.filter((player) => player.powerTier === 3).length,
  };
}

function activeOpponentStrengthRange(state: GameState): StrengthRange {
  const strengths = state.clubs
    .filter((club) => club.id !== state.userClubId)
    .map((club) => clubStartingElevenStrength(state, club.id))
    .sort((left, right) => left - right);
  if (strengths.length === 0)
    throw new Error('D4 survival requires active opponents');
  const middle = Math.floor(strengths.length / 2);
  return {
    minimum: strengths[0],
    median:
      strengths.length % 2 === 0
        ? (strengths[middle - 1] + strengths[middle]) / 2
        : strengths[middle],
    maximum: strengths[strengths.length - 1],
  };
}

function userLineupIds(state: GameState): readonly string[] {
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (lineup === undefined) throw new Error('career lost the user lineup');
  return lineup.playerIds;
}

function userCash(state: GameState): number {
  const club = state.clubs.find(
    (candidate) => candidate.id === state.userClubId,
  );
  if (club === undefined) throw new Error('career lost the user club');
  return club.cash;
}

function promotionSurvivalShardSummary(
  runs: readonly PairedRun[],
  difficulty: DifficultyMode,
): PromotionSurvivalShardSummary {
  return {
    kind: 'promotion-survival-shard',
    schemaVersion: PROMOTION_SURVIVAL_SUMMARY_VERSION,
    difficulty,
    seedOffset: SEED_OFFSET,
    seedCount: SEED_COUNT,
    throughWeek: D4_WEEKS,
    runs: runs.map((run) => ({
      seedIndex: run.seedIndex,
      seed: run.seed,
      promotedInSeason: run.promotedInSeason,
      prepared: {
        completed: run.prepared.completed,
        played: run.prepared.played,
        position: run.prepared.position,
        points: run.prepared.points,
        endingCash: run.prepared.endingCash,
        recruitmentResolved: recruitmentWindowResolved(run.prepared),
        signed: run.prepared.signed,
      },
      control: {
        completed: run.control.completed,
        played: run.control.played,
        position: run.control.position,
        points: run.control.points,
        endingCash: run.control.endingCash,
      },
    })),
  };
}

function emitPromotionSurvivalShardSummary(
  summary: PromotionSurvivalShardSummary,
): void {
  const compact = JSON.stringify(summary);
  // The marker makes captured test output machine-readable even when no shared
  // output directory was configured.
  // eslint-disable-next-line no-console
  console.log(`PROMOTION_SURVIVAL_SHARD_JSON ${compact}`);
  if (SUMMARY_DIR === undefined) return;
  const directory = resolve(SUMMARY_DIR);
  mkdirSync(directory, { recursive: true });
  const name = [
    'promotion-survival',
    summary.difficulty.toLowerCase(),
    `offset-${String(summary.seedOffset).padStart(5, '0')}`,
    `count-${String(summary.seedCount).padStart(5, '0')}.json`,
  ].join('-');
  writeFileSync(
    join(directory, name),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
}

function report(
  runs: readonly PairedRun[],
  difficulty: DifficultyMode,
  isCanonicalAggregate: boolean,
): void {
  const average = (pick: (run: PairedRun) => number): number =>
    Math.round(
      (runs.reduce((sum, run) => sum + pick(run), 0) / runs.length) * 100,
    ) / 100;
  const rate = (predicate: (run: PairedRun) => boolean): number =>
    Math.round((runs.filter(predicate).length / runs.length) * 1000) / 10;
  const median = (values: readonly number[]): number => {
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];
  };
  const breakdown = (values: readonly string[]): string => {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return [...counts.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([value, count]) => `${value} ${count}/${values.length}`)
      .join(', ');
  };
  const fullSeason =
    D4_WEEKS === FINAL_SEASON_WEEK &&
    runs.every((run) => run.prepared.completed && run.control.completed);
  const signingRate = rate((run) => run.prepared.signed);
  const recruitmentResolutionRate = rate((run) =>
    recruitmentWindowResolved(run.prepared),
  );
  const survivalRate = rate((run) => run.prepared.position <= 8);
  const medianPosition = median(runs.map((run) => run.prepared.position));
  const classification = !fullSeason
    ? 'DIRECTIONAL ONLY — rerun through Week 30 before judging survival.'
    : recruitmentResolutionRate < 100
      ? 'INVALID PREPARATION — at least one scouting window did not resolve.'
      : !isCanonicalAggregate
        ? 'SHARD REPORT — merge the exact 300-seed cohort before judging survival.'
        : survivalRate > 50 && medianPosition <= 8
          ? 'PASS — the prepared promoted club is more likely to survive than be relegated.'
          : 'FAIL — the prepared promoted club remains more likely to be relegated.';

  const lines = [
    '',
    `=== D5 -> D4 PROMOTION SURVIVAL · ${difficulty} (${runs.length} paired careers, seed offset ${SEED_OFFSET}, through D4 Week ${D4_WEEKS}) ===`,
    `natural D5 promotion season: ${breakdown(runs.map((run) => String(run.promotedInSeason)))}`,
    'shared policy: build/upgrade the Training Pitch, buy useful drill tiers, train a healthy core through every management week,',
    '               and play every fixture through production Quick Result (4-4-2, Auto Subs off)',
    'prepared-only window: one reserve sale per completed signing, one production scouting brief, up to two affordable reported upgrades',
    `preparation: scouting resolved ${recruitmentResolutionRate}%  signed ${signingRate}%` +
      `  avg signings ${average((run) => run.prepared.signings)}` +
      `  reports ${average((run) => run.prepared.scoutReports)}` +
      `  avg sale ${average((run) => run.prepared.saleFee)}` +
      `  avg fee ${average((run) => run.prepared.transferFee)}` +
      `  training weeks ${average((run) => run.prepared.trainingWeeks)}`,
    `production briefs: ${breakdown(runs.map((run) => run.prepared.scoutBriefId))}`,
    `signing stop reasons: ${breakdown(runs.map((run) => run.prepared.signingStopReason))}`,
    `XI strength: ${average((run) => run.prepared.preWindowStrength)}` +
      ` -> ${average((run) => run.prepared.postWindowStrength)}` +
      `  signed-XI gain ${average((run) => run.prepared.signedUpgrade)}`,
    `licensed starters: powers ${average((run) => run.prepared.licensedStarterPowers)}` +
      `  tiers T1/T2/T3 ${average((run) => run.prepared.licensedStarterTier1)}` +
      `/${average((run) => run.prepared.licensedStarterTier2)}` +
      `/${average((run) => run.prepared.licensedStarterTier3)}`,
    `D4 opponent XI strength: min ${average((run) => run.prepared.opponentStrengthMinimum)}` +
      `  median ${average((run) => run.prepared.opponentStrengthMedian)}` +
      `  max ${average((run) => run.prepared.opponentStrengthMaximum)}`,
    `prepared: position ${average((run) => run.prepared.position)}` +
      ` (median ${medianPosition})  survival/top-8 ${survivalRate}%` +
      `  PPM ${average((run) => run.prepared.points / Math.max(1, run.prepared.played))}` +
      `  W/D/L ${average((run) => run.prepared.won)}/${average((run) => run.prepared.drawn)}/${average((run) => run.prepared.lost)}` +
      `  GD ${average((run) => run.prepared.goalDifference)}` +
      `  cash ${average((run) => run.prepared.endingCash)}`,
    `prepared position distribution: ${breakdown(runs.map((run) => String(run.prepared.position)))}`,
    `control:  position ${average((run) => run.control.position)}` +
      `  survival/top-8 ${rate((run) => run.control.position <= 8)}%` +
      `  PPM ${average((run) => run.control.points / Math.max(1, run.control.played))}` +
      `  GD ${average((run) => run.control.goalDifference)}` +
      `  cash ${average((run) => run.control.endingCash)}`,
    `paired preparation delta: position ${average((run) => run.control.position - run.prepared.position)}` +
      `  points ${average((run) => run.prepared.points - run.control.points)}` +
      `  GD ${average((run) => run.prepared.goalDifference - run.control.goalDifference)}`,
    `INTERPRETATION: ${classification}`,
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
}

function recruitmentWindowResolved(outcome: SeasonOutcome): boolean {
  return (
    outcome.scoutReports > 0 &&
    outcome.signingStopReason !== 'NOT_ATTEMPTED' &&
    outcome.signingStopReason !== 'SCOUT_IN_PROGRESS' &&
    outcome.signingStopReason !== 'SCOUT_INCOMPLETE' &&
    outcome.signingStopReason !== 'NO_REPORTS'
  );
}

function positiveIntegerEnv(
  name: string,
  fallback: number,
  maximum: number,
): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(raw))
    throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) {
    throw new Error(
      `${name} must be a safe positive integer no greater than ${maximum}`,
    );
  }
  return value;
}

function nonNegativeIntegerEnv(
  name: string,
  fallback: number,
  maximum: number,
): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw))
    throw new Error(`${name} must be a nonnegative integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) {
    throw new Error(
      `${name} must be a safe nonnegative integer no greater than ${maximum}`,
    );
  }
  return value;
}

function optionalNonemptyEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const value = raw.trim();
  if (value.length === 0) throw new Error(`${name} must not be empty`);
  return value;
}

function promotionSurvivalDifficulties(
  raw: string | undefined,
): readonly DifficultyMode[] {
  if (raw === undefined || raw === 'ALL') return ['COZY', 'CHAIRMAN'];
  if (raw === 'COZY' || raw === 'CHAIRMAN') return [raw];
  throw new Error(
    'PROMOTION_SURVIVAL_DIFFICULTY must be ALL, COZY, or CHAIRMAN',
  );
}
