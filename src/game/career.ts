import { CUP_SETTLEMENT_WEEKS, generateSeasonFixtures } from './schedule';
import { applyVariancePercent, matchdayVarianceRoll } from './finance-variance';
import {
  BASE_WEEKLY_TRAINING_POINTS,
  FACILITY_CATALOG,
  TRAINING_PITCH_TP_PER_LEVEL,
  advanceFacilityConstruction,
  cappedFacilityBoost,
  createFacilityGrid,
  facilityEffects,
  isFacilityOperational,
  weeklyFacilityUpkeep,
  type FacilityGridState,
  type PlacedFacility,
} from './facilities';
import { difficultyRules } from './difficulty';
import { recordCareerMilestones } from './career-events';
import { recordFanGain } from './fan-growth';
import { recordSeasonRecap } from './season-recap';
import { compareStandings } from './ordering';
import { enableFullCareer, startNextFullCareerSeason } from './full-career';
import {
  careerCoachWageLedgerAmount,
  careerCoachWeeklyTrainingPoints,
} from './coach-weekly';
import { resolveCareerScoutClock } from './market-career';
import {
  currentUserDivision,
  resolveNextM2NationalCupRound,
  willRetireAtSeasonTransition,
} from './m2-career';
import {
  FIRST_D4_PROMOTION_RECRUITMENT_FUND,
  highestDivisionReached,
  leaguePrizeMoney,
} from './promotion-progression';
import {
  applyMatchConditionCosts,
  resolveWeeklyPlayerWellbeing,
  type WeeklyMatchOutcome,
} from './player-wellbeing';
import {
  CUP_DISPLAY_NAME,
  CUP_NAME_KEY,
  CUP_ROUND_NAME_KEYS,
  FAME_CEILING,
} from './pyramid';
import type {
  DivisionLevel,
  NationalCup,
  NationalCupFixture,
  NationalCupResult,
} from './pyramid';
import {
  cupGiantKillingCelebration,
  queueCupGiantKillingCelebration,
} from './cup-giant-killing';
import { repairCareerLineupForInjuries } from './squad';
import { advancePlayerRequests } from './player-requests';
import { createClubBusinessState } from './club-business';
import { applyBuzzImpacts, applySupporterImpacts } from './club-business';
import {
  appendPendingUserMatchImpact,
  pendingImpactFromProduction,
} from './pending-match-impact';
import type { ProductionFixtureResult } from './matchday';
import {
  actualSponsorPortfolioIncome,
  allocateSponsorPortfolioPayment,
  expireSponsorOfferWindow,
  settleSponsorObjectivesAtWeek30,
  settleSponsorWeeklyChallenge,
} from './sponsors';
import {
  initializeSeasonYouthIntake,
  reconcileStoryYouthIntake,
} from './youth-intake';
import {
  applyBoardFacilityConversionConsequences,
  applyBoardForcedSaleConsequences,
  boardFacilityConversionAtDeadline,
  boardForcedSaleAtDeadline,
  boardUltimatumConsequence,
  createBoardFacilityUltimatum,
  createBoardUltimatum,
  targetMetResolution,
  type BoardFacilityConversionResolution,
  type BoardForcedSaleResolution,
} from './board-ultimatum';
import {
  EMPTY_WEEKLY_SETTLEMENT_AWARDS,
  nationalCupRoundSettlementAwards,
  resolveWeeklySettlementAwards,
  weeklySettlementAwardKeys,
} from './weekly-settlement-awards';
import {
  GAME_SCHEMA_VERSION,
  SEASON_WEEKS,
  type AwardCompetition,
  type CareerSetup,
  type CareerPlayer,
  type ClubState,
  type FixtureResult,
  type GameState,
  type LeagueFixture,
  type LeagueStanding,
  type LedgerLine,
  type LedgerLineReveal,
  type FinancialSafetyState,
  type WeeklyLedger,
  type WeeklySettlementAward,
  type WeeklySettlementAwards,
} from './types';

const CLUB_COUNT = 10;
const UINT32_MAX = 4294967295;
/**
 * What the emergency loan must leave in the bank once the deficit is cleared.
 * Kept above the newly cheaper Stadium Stand so the one rescue buys the income
 * building and still leaves operating room instead of shrinking by $5,000.
 */
const EMERGENCY_LOAN_FLOOR = 15_000;
// Re-exported from its home in `schedule.ts`, which owns the season calendar.
// `player-requests.ts` needs the same weeks to know whether a cost priced in
// missed matches can be collected, and this module already imports that one.
export { CUP_SETTLEMENT_WEEKS } from './schedule';

/**
 * Long enough after the first cup match that a board has names on it rather
 * than one lucky hat-trick, and short enough to still be the same conversation.
 */
const DIVISION_LEADERS_UNLOCK_WEEKS_AFTER_FIRST_CUP = 3;

/**
 * Season and week of the career's very first cup match, or null before one is
 * drawn.
 *
 * Cup fixtures carry no week of their own: the engine settles round N in
 * `CUP_SETTLEMENT_WEEKS[N - 1]`, so the calendar is the only place the week
 * exists. Undrawn rounds are skipped — a round without fixtures has no match to
 * count from. The season is carried alongside the week because `nationalCups`
 * gains a cup per season, and a bare minimum over every cup's weeks would
 * answer with a later season's calendar.
 */
function firstCupMatch(
  cups: readonly NationalCup[],
): { season: number; week: number } | null {
  let first: { season: number; week: number } | null = null;
  for (const cup of cups) {
    for (const round of cup.rounds) {
      if (round.fixtures.length === 0) continue;
      const week = CUP_SETTLEMENT_WEEKS[round.number - 1] as number | undefined;
      if (week === undefined) continue;
      if (
        first === null ||
        cup.season < first.season ||
        (cup.season === first.season && week < first.week)
      ) {
        first = { season: cup.season, week };
      }
    }
  }
  return first;
}

/**
 * When the division leader boards open. One derivation, read by both the
 * League screen's sub-tab list and Bert's briefing: split them and the first
 * move of the cup calendar sends the manager to a tab that is not there.
 *
 * Monotonic in career time, not in the week counter. `week` restarts at 1 every
 * season, so a threshold compared against the week alone re-locks the tab for
 * the opening weeks of every season after the first — hiding live boards from a
 * veteran career, and silently, because Bert's briefing only fires once.
 *
 * A career with no cup drawn never unlocks: there is no first match to count
 * from.
 */
export function isDivisionLeadersUnlocked(
  cups: readonly NationalCup[],
  season: number,
  week: number,
): boolean {
  const first = firstCupMatch(cups);
  if (first === null) return false;
  if (season !== first.season) return season > first.season;
  return week >= first.week + DIVISION_LEADERS_UNLOCK_WEEKS_AFTER_FIRST_CUP;
}

export type NationalCupRoundLabel =
  | 'Play-in'
  | 'Round of 32'
  | 'Round of 16'
  | 'Quarter-final'
  | 'Semi-final'
  | 'Final';

export interface ActiveCareerMatchday {
  kind: 'league' | 'national-cup';
  fixture: LeagueFixture;
  fixtures: LeagueFixture[];
  cupRoundLabel?: NationalCupRoundLabel;
}

export function createCareer(setup: CareerSetup): GameState {
  validateSetup(setup);

  const clubs = setup.clubs.map((club) => ({ ...club }));

  const state: GameState = {
    schemaVersion: GAME_SCHEMA_VERSION,
    ...(setup.launchRosterVersion === undefined
      ? {}
      : { launchRosterVersion: setup.launchRosterVersion }),
    careerSeed: setup.seed,
    userClubId: setup.userClubId,
    season: 1,
    week: 1,
    phase: 'manage',
    ...(setup.difficulty === undefined ? {} : { difficulty: setup.difficulty }),
    clubs,
    fixtures: generateSeasonFixtures(
      clubs.map((club) => club.id),
      1,
      setup.seed,
    ),
    players: (setup.players ?? []).map(clonePlayer),
    lineups: (setup.lineups ?? []).map((lineup) => ({
      clubId: lineup.clubId,
      playerIds: [...lineup.playerIds],
    })),
    facilities: { trainingGroundBuilt: false, grid: createFacilityGrid() },
    ...(setup.trainingRules === undefined
      ? {}
      : {
          trainingRules: {
            focusDrills: setup.trainingRules.focusDrills.map((drill) => ({
              ...drill,
              gains: { ...drill.gains },
            })),
          },
        }),
    ...(setup.playerRequestRules === undefined
      ? {}
      : {
          playerRequestRules: JSON.parse(
            JSON.stringify(setup.playerRequestRules),
          ),
        }),
    ...(setup.sponsorRules === undefined
      ? {}
      : {
          sponsorRules: JSON.parse(JSON.stringify(setup.sponsorRules)),
        }),
    eventClock: { weeksWithoutEvent: 0, riskyChoices: 0 },
    eventFlags: [],
    resolvedEventIds: [],
    awakening: { matchesSinceLastAwakening: 0, usedTriggerIds: [] },
    trainingPoints: setup.startingTrainingPoints ?? 0,
    ledgers: [],
    seasonOpeningCash: clubs.find((club) => club.id === setup.userClubId)!.cash,
    seasonStatLines: [],
    careerMode: 'full',
    clubBusiness: createClubBusinessState({ season: 1 }),
  };
  return enableFullCareer(state);
}

export function fixturesForCurrentWeek(state: GameState): LeagueFixture[] {
  return state.fixtures
    .filter(
      (fixture) =>
        fixture.season === state.season &&
        fixture.week === state.week &&
        fixture.status === 'scheduled',
    )
    .map(cloneFixture);
}

/** The one player-controlled match for the current Match Day, league first on double-header weeks. */
export function activeCareerMatchday(
  state: GameState,
): ActiveCareerMatchday | undefined {
  const leagueFixtures = fixturesForCurrentWeek(state);
  const leagueFixture = leagueFixtures.find(
    (fixture) =>
      fixture.homeClubId === state.userClubId ||
      fixture.awayClubId === state.userClubId,
  );
  if (leagueFixture !== undefined) {
    return { kind: 'league', fixture: leagueFixture, fixtures: leagueFixtures };
  }

  const cup = nationalCupUserFixtureForCurrentWeek(state);
  if (cup === undefined) return undefined;
  const fixture = nationalCupFixtureAsLeagueFixture(cup.fixture, state.week);
  return {
    kind: 'national-cup',
    fixture,
    fixtures: [fixture],
    cupRoundLabel: cup.roundLabel,
  };
}

function nationalCupFixtureById(
  state: GameState,
  fixtureId: string,
): NationalCupFixture | undefined {
  return state.m2?.nationalCups
    .flatMap((cup) => cup.rounds)
    .flatMap((round) => round.fixtures)
    .find((fixture) => fixture.id === fixtureId);
}

export function advanceWeek(state: GameState): GameState {
  if (state.phase !== 'manage') {
    throw new Error('a week can only advance from the manage phase');
  }

  if (activeCareerMatchday(state) !== undefined) {
    return { ...state, phase: 'matchday' };
  }

  return settleCurrentWeek(state);
}

export function completeMatchday(
  state: GameState,
  results: FixtureResult[],
  production?: ProductionFixtureResult,
): GameState {
  if (state.phase !== 'matchday') {
    throw new Error(
      'matchday results can only be completed from the matchday phase',
    );
  }

  const scheduledFixtures = fixturesForCurrentWeek(state);
  if (scheduledFixtures.length === 0) {
    return completeNationalCupMatchday(state, results, production);
  }
  validateResults(state, scheduledFixtures, results);

  /**
   * A hat-trick can only be seen here, while the result is still in hand.
   *
   * `scorerPlayerIds` lives on the settlement result; the persisted fixture
   * keeps only the score, and the scorer list is folded into season totals and
   * dropped. So this is banked as a flag at the moment it happens — a later
   * re-scan has nothing to read. User-club scorers only: a rival's hat-trick is
   * not the manager's milestone.
   */
  const hatTrickScorerId = hatTrickScorer(state, scheduledFixtures, results);

  const resultByFixtureId = new Map(
    results.map((result) => [result.fixtureId, result]),
  );
  const conditionedState = applyMatchConditionCosts(
    state,
    scheduledFixtures,
    results,
  );
  const fixtures = state.fixtures.map((fixture) => {
    const result = resultByFixtureId.get(fixture.id);
    if (result === undefined) return fixture;

    return {
      ...fixture,
      status: 'played' as const,
      score: {
        homeGoals: result.homeGoals,
        awayGoals: result.awayGoals,
      },
    };
  });

  const seasonStatLines = recordStatLines(
    state,
    scheduledFixtures,
    resultByFixtureId,
    'league',
  );

  const userFixture = scheduledFixtures.find(
    (fixture) =>
      fixture.homeClubId === state.userClubId ||
      fixture.awayClubId === state.userClubId,
  );
  const pendingImpact =
    production === undefined || userFixture === undefined
      ? undefined
      : pendingImpactFromProduction({
          state,
          fixture: userFixture,
          production,
          competition: 'LEAGUE',
        });
  const participantIdsByFixture =
    pendingImpact === undefined
      ? undefined
      : new Map([
          [pendingImpact.fixtureId, pendingImpact.participantPlayerIds],
        ]);
  const players = resolveCareerMatchFame(
    conditionedState,
    scheduledFixtures,
    resultByFixtureId,
    participantIdsByFixture,
  );

  const playedLeagueState = bankHatTrickMilestone(
    {
      ...conditionedState,
      fixtures,
      players,
      seasonStatLines,
      ...(pendingImpact === undefined
        ? {}
        : {
            clubBusiness: {
              ...state.clubBusiness,
              pendingUserMatchImpacts: appendPendingUserMatchImpact(
                state.clubBusiness.pendingUserMatchImpacts,
                pendingImpact,
              ),
            },
          }),
    },
    hatTrickScorerId,
  );
  if (nationalCupUserFixtureForCurrentWeek(playedLeagueState) !== undefined) {
    return { ...playedLeagueState, phase: 'matchday' };
  }
  return settleCurrentWeek(playedLeagueState);
}

export function leagueStandings(
  state: GameState,
  season = state.season,
): LeagueStanding[] {
  if (!Number.isInteger(season) || season < 1) {
    throw new Error('season must be a positive integer');
  }

  const rows = new Map<string, Omit<LeagueStanding, 'position'>>(
    state.clubs.map((club) => [
      club.id,
      {
        clubId: club.id,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      },
    ]),
  );

  for (const fixture of state.fixtures) {
    if (
      fixture.season !== season ||
      fixture.status !== 'played' ||
      fixture.score === undefined
    ) {
      continue;
    }

    const home = rows.get(fixture.homeClubId);
    const away = rows.get(fixture.awayClubId);
    if (home === undefined || away === undefined) {
      throw new Error(`fixture ${fixture.id} references an unknown club`);
    }

    home.played = checkedAdd(home.played, 1, `${home.clubId} matches played`);
    away.played = checkedAdd(away.played, 1, `${away.clubId} matches played`);
    home.goalsFor = checkedAdd(
      home.goalsFor,
      fixture.score.homeGoals,
      `${home.clubId} goals for`,
    );
    home.goalsAgainst = checkedAdd(
      home.goalsAgainst,
      fixture.score.awayGoals,
      `${home.clubId} goals against`,
    );
    away.goalsFor = checkedAdd(
      away.goalsFor,
      fixture.score.awayGoals,
      `${away.clubId} goals for`,
    );
    away.goalsAgainst = checkedAdd(
      away.goalsAgainst,
      fixture.score.homeGoals,
      `${away.clubId} goals against`,
    );

    if (fixture.score.homeGoals > fixture.score.awayGoals) {
      home.won = checkedAdd(home.won, 1, `${home.clubId} wins`);
      home.points = checkedAdd(home.points, 3, `${home.clubId} league points`);
      away.lost = checkedAdd(away.lost, 1, `${away.clubId} losses`);
    } else if (fixture.score.homeGoals < fixture.score.awayGoals) {
      away.won = checkedAdd(away.won, 1, `${away.clubId} wins`);
      away.points = checkedAdd(away.points, 3, `${away.clubId} league points`);
      home.lost = checkedAdd(home.lost, 1, `${home.clubId} losses`);
    } else {
      home.drawn = checkedAdd(home.drawn, 1, `${home.clubId} draws`);
      away.drawn = checkedAdd(away.drawn, 1, `${away.clubId} draws`);
      home.points = checkedAdd(home.points, 1, `${home.clubId} league points`);
      away.points = checkedAdd(away.points, 1, `${away.clubId} league points`);
    }
  }

  const sorted = Array.from(rows.values(), (row) => ({
    ...row,
    goalDifference: checkedSubtract(
      row.goalsFor,
      row.goalsAgainst,
      `${row.clubId} goal difference`,
    ),
  })).sort(compareStandings);

  return sorted.map((row, index) => ({ ...row, position: index + 1 }));
}

export function startNextSeason(state: GameState): GameState {
  if (state.phase !== 'season-end') {
    throw new Error('the next season can only start from the season-end phase');
  }
  const expired = state.players.filter(
    (player) =>
      player.clubId === state.userClubId &&
      player.contractSeasonsRemaining === 0 &&
      !willRetireAtSeasonTransition(player, state.season),
  );
  if (expired.length > 0) {
    throw new Error(
      `${expired.length} expired contract${expired.length === 1 ? '' : 's'} must be resolved before the next season`,
    );
  }
  return startNextFullCareerSeason(state, leagueStandings(state));
}

/**
 * Settles the week and banks any milestone that week just earned. The
 * recognition story still waits for the next story beat, but the flag itself is
 * recorded the moment the club earns it instead of sitting unnoticed for weeks.
 * `recordCareerMilestones` derives its flags from persisted results, consumes no
 * random value and skips flags already present, so a settled week records each
 * milestone exactly once.
 */
interface SettleCurrentWeekOptions {
  readonly cupAlreadyResolved?: boolean;
  readonly additionalMatchOutcomes?: readonly WeeklyMatchOutcome[];
  readonly awards?: WeeklySettlementAwards;
}

/** The user-club player who scored three or more in one of this week's fixtures. */
function hatTrickScorer(
  state: GameState,
  scheduled: readonly LeagueFixture[],
  results: readonly FixtureResult[],
): string | undefined {
  const userFixtureIds = new Set(
    scheduled
      .filter(
        (fixture) =>
          fixture.homeClubId === state.userClubId ||
          fixture.awayClubId === state.userClubId,
      )
      .map((fixture) => fixture.id),
  );
  const squad = new Set(
    state.players
      .filter((player) => player.clubId === state.userClubId)
      .map((player) => player.id),
  );
  for (const result of results) {
    if (!userFixtureIds.has(result.fixtureId)) continue;
    const goals = new Map<string, number>();
    for (const scorerId of result.scorerPlayerIds ?? []) {
      if (!squad.has(scorerId)) continue;
      goals.set(scorerId, (goals.get(scorerId) ?? 0) + 1);
    }
    const scorer = [...goals.entries()]
      .filter(([, count]) => count >= 3)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))[0];
    if (scorer !== undefined) return scorer[0];
  }
  return undefined;
}

/** Banks the scorer while the settlement result still carries goal identities. */
function bankHatTrickMilestone(
  state: GameState,
  scorerPlayerId: string | undefined,
): GameState {
  if (scorerPlayerId === undefined) return state;
  const eventId = 'milestone-hat-trick';
  const alreadyQueued = (state.pendingMilestones ?? []).some(
    (entry) => entry.eventId === eventId,
  );
  return {
    ...state,
    eventFlags: state.eventFlags.includes('milestone:hat-trick')
      ? state.eventFlags
      : [...state.eventFlags, 'milestone:hat-trick'],
    pendingMilestones:
      alreadyQueued || state.resolvedEventIds.includes(eventId)
        ? state.pendingMilestones
        : [
            ...(state.pendingMilestones ?? []),
            { eventId, selectedPlayerId: scorerPlayerId },
          ],
  };
}

/**
 * How many seasons of weekly ledgers a save keeps.
 *
 * The same retention rule the Hero Cup brackets already have
 * (`RETAINED_CUP_BRACKET_SEASONS`), for the slice that outgrew them: ledgers
 * were append-only for the life of the career, so a season-100 save reached
 * 2.07 MB with 69% of it ledgers, re-stringified into SQLite at every
 * settlement. The cups are flat because they prune; nothing pruned these.
 *
 * Twenty rather than the cups' ten because a ledger is read further back than
 * a bracket is: the longest measurement rail in the repo drives fifteen
 * seasons and scans career-wide ledger totals at the end of it, and the
 * Financial Report, the season recap and the award idempotency scan all sit
 * far inside that. Nothing in the game or the harnesses reads a ledger twenty
 * seasons old.
 */
export const RETAINED_LEDGER_SEASONS = 20;

function retainedLedgers(
  ledgers: readonly WeeklyLedger[],
  season: number,
): WeeklyLedger[] {
  const oldestRetained = season - RETAINED_LEDGER_SEASONS + 1;
  return ledgers.filter((ledger) => ledger.season >= oldestRetained);
}

function settleCurrentWeek(
  state: GameState,
  options: SettleCurrentWeekOptions = {},
): GameState {
  const cupProgression =
    options.cupAlreadyResolved === true
      ? { state, awards: EMPTY_WEEKLY_SETTLEMENT_AWARDS }
      : progressAutomaticCupBeforeSettlement(state);
  const suppliedAwards = options.awards ?? EMPTY_WEEKLY_SETTLEMENT_AWARDS;
  return recordCareerMilestones(
    settleWeekResults(
      cupProgression.state,
      options.additionalMatchOutcomes ?? [],
      {
        awards: [...cupProgression.awards.awards, ...suppliedAwards.awards],
      },
    ),
  );
}

function settleWeekResults(
  state: GameState,
  additionalMatchOutcomes: readonly WeeklyMatchOutcome[],
  suppliedAwards: WeeklySettlementAwards,
): GameState {
  const userClub = state.clubs.find((club) => club.id === state.userClubId);
  if (userClub === undefined) {
    throw new Error(`user club ${state.userClubId} does not exist`);
  }

  const challengeSettlement = settleSponsorWeeklyChallenge(
    state.clubBusiness.sponsorship,
    state.fixtures,
    state.userClubId,
    state.season,
    difficultyRules(state).sponsorIncomePercent,
  );
  if (challengeSettlement.sponsorship !== state.clubBusiness.sponsorship) {
    state = {
      ...state,
      clubBusiness: {
        ...state.clubBusiness,
        sponsorship: challengeSettlement.sponsorship,
      },
    };
  }
  if (challengeSettlement.payment !== undefined) {
    suppliedAwards = {
      awards: [
        ...suppliedAwards.awards,
        {
          line: {
            kind: 'sponsor',
            label: `${challengeSettlement.payment.sponsorName} weekly challenge bonus`,
            labelKey: 'ledger.sponsorWeeklyChallengeBonus',
            labelParams: {
              sponsor: challengeSettlement.payment.sponsorName,
            },
            amount: challengeSettlement.payment.actualAmount,
            idempotencyKey: weeklySettlementAwardKeys.sponsorWeeklyChallenge(
              state.userClubId,
              state.season,
            ),
          },
        },
      ],
    };
  }

  if (
    state.week === SEASON_WEEKS &&
    state.clubBusiness.sponsorship.activeContracts.some(
      (contract) =>
        contract.objective !== undefined &&
        contract.objectiveOutcome === undefined,
    )
  ) {
    const objectiveSettlement = settleSponsorObjectivesAtWeek30(
      state.clubBusiness.sponsorship,
      state.fixtures,
      state.userClubId,
      state.season,
      state.week,
      difficultyRules(state).sponsorIncomePercent,
    );
    state = {
      ...state,
      clubBusiness: {
        ...state.clubBusiness,
        sponsorship: objectiveSettlement.sponsorship,
      },
    };
    suppliedAwards = {
      awards: [
        ...suppliedAwards.awards,
        ...objectiveSettlement.payments
          .filter((payment) => payment.actualAmount > 0)
          .map((payment) => ({
            line: {
              kind: 'sponsor' as const,
              label: `${payment.sponsorName} objective bonus`,
              labelKey: 'ledger.sponsorObjectiveBonus',
              labelParams: { sponsor: payment.sponsorName },
              amount: payment.actualAmount,
              idempotencyKey: weeklySettlementAwardKeys.sponsorObjective(
                state.userClubId,
                state.season,
                payment.contractId,
              ),
            },
          })),
      ],
    };
  }

  // Drills resolve instantly at tap time now, so settlement only credits the
  // week's ambient TP income and runs the recovery/morale wellbeing tick.
  const ambientTrainingPoints = weeklyAmbientTrainingPoints(state);
  const trainingPoints = checkedAdd(
    state.trainingPoints,
    ambientTrainingPoints,
    'weekly ambient training point balance',
  );
  const pendingImpacts = state.clubBusiness.pendingUserMatchImpacts;
  const productionParticipations = pendingImpacts.map((impact) => ({
    fixtureId: impact.fixtureId,
    outcome: impact.outcome.toLowerCase() as WeeklyMatchOutcome,
    participantPlayerIds: impact.participantPlayerIds,
  }));
  const currentLineup = state.lineups.find(
    (lineup) => lineup.clubId === state.userClubId,
  );
  const matchParticipations =
    productionParticipations.length === 0
      ? undefined
      : [
          ...productionParticipations,
          ...additionalMatchOutcomes.map((outcome, index) => ({
            fixtureId: `synthetic-extra-${index}`,
            outcome,
            participantPlayerIds: currentLineup?.playerIds ?? [],
          })),
        ];
  const weeklyWellbeing = resolveWeeklyPlayerWellbeing(
    state,
    matchParticipations === undefined
      ? { additionalMatchOutcomes }
      : { matchParticipations },
  );
  const actualMonthlySponsorIncome = currentActualMonthlySponsorIncome(
    state,
    userClub,
  );
  const appliedBuzz = applyBuzzImpacts(
    state.clubBusiness.buzz,
    pendingImpacts,
    state.season,
    state.week,
    actualMonthlySponsorIncome,
  );
  const trainedState = {
    ...state,
    players: weeklyWellbeing.players,
    ...(weeklyWellbeing.m2 === undefined ? {} : { m2: weeklyWellbeing.m2 }),
    trainingPoints,
    clubBusiness: {
      ...state.clubBusiness,
      buzz: appliedBuzz.buzz,
    },
  };
  const buzzAwards: WeeklySettlementAward[] =
    appliedBuzz.payout === undefined || appliedBuzz.payout.amount === 0
      ? []
      : [
          {
            line: {
              kind: 'buzz',
              label: appliedBuzz.payout.label,
              labelKey: appliedBuzz.payout.labelKey,
              amount: appliedBuzz.payout.amount,
              idempotencyKey: weeklySettlementAwardKeys.buzzHalf(
                state.userClubId,
                state.season,
                appliedBuzz.payout.half,
              ),
            },
          },
        ];
  const awards = resolveWeeklySettlementAwards(
    state.ledgers,
    settlementAwards(trainedState, userClub, {
      awards: [...suppliedAwards.awards, ...buzzAwards],
    }),
  );
  const lines = settlementLines(trainedState, userClub, 0, awards.lines);
  const safety = resolveFinancialSafety(trainedState, userClub.cash, lines);
  const settledLines = safety.lines;
  const balanceAfter = safety.balanceAfter;
  const facilityIntervenedState =
    safety.facilityConversion === undefined
      ? trainedState
      : applyBoardFacilityConversionConsequences(
          trainedState,
          safety.facilityConversion,
        );
  const intervenedState =
    safety.forcedSale === undefined
      ? facilityIntervenedState
      : applyBoardForcedSaleConsequences(
          facilityIntervenedState,
          safety.forcedSale,
        );
  const intervenedUserClub = intervenedState.clubs.find(
    (club) => club.id === state.userClubId,
  );
  if (intervenedUserClub === undefined)
    throw new Error(`user club ${state.userClubId} disappeared`);
  const appliedSupporters = applySupporterImpacts(
    intervenedState.clubBusiness.supporters,
    intervenedUserClub.fans,
    pendingImpacts,
    state.season,
    state.week,
  );
  const finalFanCount = checkedAdd(
    appliedSupporters.fanCount,
    awards.fanGain,
    'weekly supporter awards',
  );
  const settledClubBusiness = {
    ...intervenedState.clubBusiness,
    supporters: appliedSupporters.supporters,
    pendingUserMatchImpacts: [],
  };
  const clubs = intervenedState.clubs.map((club) =>
    club.id === state.userClubId
      ? {
          ...club,
          cash: balanceAfter,
          fans: finalFanCount,
        }
      : club,
  );
  const ledgers = retainedLedgers(
    [
      ...state.ledgers,
      {
        season: state.season,
        week: state.week,
        lines: settledLines,
        balanceAfter,
      },
    ],
    state.season,
  );

  const injuryWeeksBeforeSettlement = new Map(
    state.players.map((player) => [player.id, player.injuryWeeks]),
  );
  const recoveredPlayers = intervenedState.players.map((player) => {
    const injuryWeeksBefore = injuryWeeksBeforeSettlement.get(player.id);
    if (injuryWeeksBefore === undefined) {
      if (safety.forcedSale?.replacementPlayerId === player.id) return player;
      throw new Error(`weekly wellbeing returned unknown player ${player.id}`);
    }
    // An existing injury advances by one recovery week. A new overtraining
    // injury begins now and must retain its full deterministic recovery time.
    const shouldRecover = injuryWeeksBefore > 0;
    return {
      ...player,
      injuryWeeks: shouldRecover
        ? Math.max(0, player.injuryWeeks - 1)
        : player.injuryWeeks,
    };
  });

  if (state.week === SEASON_WEEKS) {
    const seasonFamePlayers = resolveCareerSeasonFame({
      ...state,
      players: recoveredPlayers,
    });
    const players = seasonFamePlayers.map((player) => ({
      ...player,
      contractSeasonsRemaining:
        player.contractSeasonsRemaining > 0
          ? player.contractSeasonsRemaining - 1
          : 0,
    }));
    const settledState = recordFanGain(
      {
        ...intervenedState,
        clubs,
        ledgers,
        players,
        trainingPoints,
        clubBusiness: settledClubBusiness,
        financialSafety: safety.financialSafety,
        phase: 'season-end',
      },
      checkedAdd(
        appliedSupporters.positiveFanGain,
        awards.fanGain,
        'positive weekly supporter gain',
      ),
    );
    const withRecap = recordSeasonRecap(settledState);
    // openRequests: false — leave and effects still tick, but no card is dealt
    // on the week the season ends and the request clock resets.
    const withRequests = advancePlayerRequests(withRecap, false);
    return advanceM2WeeklySidecars(repairCareerLineupForInjuries(withRequests));
  }

  const settledState = recordFanGain(
    {
      ...intervenedState,
      clubs,
      ledgers,
      players: recoveredPlayers,
      trainingPoints,
      clubBusiness: settledClubBusiness,
      financialSafety: safety.financialSafety,
      week: checkedAdd(state.week, 1, 'career week'),
      phase: 'manage',
    },
    checkedAdd(
      appliedSupporters.positiveFanGain,
      awards.fanGain,
      'positive weekly supporter gain',
    ),
  );
  // Runs on `settledState`, which already carries week + 1, so a pending request
  // stamps `askedWeek` as the week the manager is about to play. It runs BEFORE
  // repair because it decrements awayWeeks, and repair must see the
  // post-decrement flags or a returning player sits out an extra week.
  const withRequests = advancePlayerRequests(settledState, true);
  return advanceM2WeeklySidecars(repairCareerLineupForInjuries(withRequests));
}

/**
 * Awards fame only from a player's real first-team appearance, the club result,
 * and goals recorded by the simulation. No RNG is consumed.
 */
export function resolveCareerMatchFame(
  state: GameState,
  fixtures: readonly LeagueFixture[],
  resultByFixtureId: ReadonlyMap<string, FixtureResult>,
  participantIdsByFixture?: ReadonlyMap<string, readonly string[]>,
  winnerClubIdsByFixture?: ReadonlyMap<string, string>,
): CareerPlayer[] {
  const lineup = state.lineups.find(
    (candidate) => candidate.clubId === state.userClubId,
  );
  if (lineup === undefined) throw new Error('the user club has no lineup');
  const gains = new Map<string, number>();

  for (const fixture of fixtures) {
    if (
      fixture.homeClubId !== state.userClubId &&
      fixture.awayClubId !== state.userClubId
    )
      continue;
    const result = resultByFixtureId.get(fixture.id);
    if (result === undefined) continue;
    const userIsHome = fixture.homeClubId === state.userClubId;
    const goalsFor = userIsHome ? result.homeGoals : result.awayGoals;
    const goalsAgainst = userIsHome ? result.awayGoals : result.homeGoals;
    const winnerClubId = winnerClubIdsByFixture?.get(fixture.id);
    if (
      winnerClubId !== undefined &&
      winnerClubId !== fixture.homeClubId &&
      winnerClubId !== fixture.awayClubId
    ) {
      throw new Error(
        `fixture ${fixture.id} winner ${winnerClubId} is not in the fixture`,
      );
    }
    // League draws earn the ordinary draw point. A knockout score can also be
    // level, but its recorded penalty winner is the result that earns Fame.
    const resultGain =
      winnerClubId === undefined
        ? goalsFor > goalsAgainst
          ? 2
          : goalsFor === goalsAgainst
            ? 1
            : 0
        : winnerClubId === state.userClubId
          ? 2
          : 0;
    const participantIds =
      participantIdsByFixture?.get(fixture.id) ?? lineup.playerIds;
    for (const playerId of participantIds) {
      const participant = state.players.find(
        (player) => player.id === playerId,
      );
      if (participant?.clubId !== state.userClubId) {
        throw new Error(
          `fixture ${fixture.id} participant ${playerId} is outside the user club`,
        );
      }
      gains.set(playerId, 1 + resultGain);
    }
    for (const scorerId of result.scorerPlayerIds ?? []) {
      const scorer = state.players.find((player) => player.id === scorerId);
      if (scorer?.clubId !== state.userClubId) continue;
      gains.set(scorerId, (gains.get(scorerId) ?? 0) + 2);
    }
  }

  return state.players.map((player) => {
    const gain = gains.get(player.id);
    if (gain === undefined) return clonePlayer(player);
    return {
      ...clonePlayer(player),
      fame: Math.min(FAME_CEILING, (player.fame ?? 0) + gain),
    };
  });
}

/** Small club-wide recognition bonus for a real top-two league finish. */
function resolveCareerSeasonFame(state: GameState): CareerPlayer[] {
  const finish = leagueStandings(state).find(
    (row) => row.clubId === state.userClubId,
  )?.position;
  const leagueBonus = finish === 1 ? 5 : finish === 2 ? 3 : 0;
  const cupWon =
    state.m2?.nationalCups.some(
      (cup) =>
        cup.season === state.season && cup.championClubId === state.userClubId,
    ) ?? false;
  const bonus = leagueBonus + (cupWon ? 5 : 0);
  if (bonus === 0) return state.players.map(clonePlayer);
  return state.players.map((player) =>
    player.clubId === state.userClubId
      ? {
          ...clonePlayer(player),
          fame: Math.min(FAME_CEILING, (player.fame ?? 0) + bonus),
        }
      : clonePlayer(player),
  );
}

/**
 * Variance rolls only on settlements the Financial Report presents (spec §5):
 * a played user fixture this week, and never the season-final settlement,
 * which routes to the season review instead of the report.
 */
function varianceEligibleSettlement(state: GameState): boolean {
  if (state.week === SEASON_WEEKS) return false;
  const playedLeague = state.fixtures.some(
    (fixture) =>
      fixture.season === state.season &&
      fixture.week === state.week &&
      fixture.status === 'played' &&
      (fixture.homeClubId === state.userClubId ||
        fixture.awayClubId === state.userClubId),
  );
  if (playedLeague) return true;
  const currentCup = state.m2?.nationalCups.find(
    (cup) => cup.season === state.season,
  );
  const currentRound = currentCup?.rounds.find(
    (round) => CUP_SETTLEMENT_WEEKS[round.number - 1] === state.week,
  );
  return (
    currentRound?.fixtures.some(
      (fixture) =>
        fixture.status === 'played' &&
        (fixture.homeClubId === state.userClubId ||
          fixture.awayClubId === state.userClubId),
    ) ?? false
  );
}

/**
 * What the division pays the club for a league win, at D5.
 *
 * League only, which is what makes it divisional: the Hero Cup crosses every
 * tier, so a cup win has no division to be paid by. Its own prize money is the
 * cup's business.
 */
export const DIVISIONAL_WIN_BONUS_AT_D5 = 500;

/**
 * Added per tier climbed: D5 500, D4 750, D3 1,000, D2 1,250, D1 1,500.
 *
 * A flat rate would shrink into irrelevance on the way up — by D1 a home gate
 * is worth several times its D5 self — and a doubling ladder would outrun the
 * gate it sits beside. Tripling across the whole pyramid puts a win at roughly
 * the same share of a week's income in every division, which is the property
 * that makes it feel like the same reward rather than a bigger one.
 */
export const DIVISIONAL_WIN_BONUS_PER_TIER = 250;

/** The bonus one league win pays a club playing in `division`. */
export function divisionalWinBonus(division: DivisionLevel): number {
  return checkedAdd(
    DIVISIONAL_WIN_BONUS_AT_D5,
    checkedMultiply(
      5 - division,
      DIVISIONAL_WIN_BONUS_PER_TIER,
      'divisional win bonus',
    ),
    'divisional win bonus',
  );
}

/** The user club's league win this week, if it played one and took it. */
function settledLeagueWin(state: GameState): boolean {
  const fixture = state.fixtures.find(
    (candidate) =>
      candidate.season === state.season &&
      candidate.week === state.week &&
      candidate.status === 'played' &&
      (candidate.homeClubId === state.userClubId ||
        candidate.awayClubId === state.userClubId),
  );
  if (fixture?.score === undefined) return false;
  return fixture.homeClubId === state.userClubId
    ? fixture.score.homeGoals > fixture.score.awayGoals
    : fixture.score.awayGoals > fixture.score.homeGoals;
}

function settlementLines(
  state: GameState,
  userClub: ClubState,
  trainingMoneyCost: number,
  awardLines: readonly LedgerLine[],
): LedgerLine[] {
  const lines: LedgerLine[] = [];
  const homeFixture = state.fixtures.find(
    (fixture) =>
      fixture.season === state.season &&
      fixture.week === state.week &&
      fixture.homeClubId === state.userClubId &&
      fixture.status === 'played',
  );

  if (homeFixture !== undefined) {
    const gate = homeGateIncomeWithReveal(
      state,
      userClub,
      'ticket revenue',
      'league-gate',
    );
    lines.push({
      kind: 'tickets',
      label: 'League home gate',
      labelKey: 'ledger.leagueHomeGate',
      amount: gate.amount,
      ...(gate.reveal === undefined ? {} : { reveal: gate.reveal }),
    });
  }

  const currentCup = state.m2?.nationalCups.find(
    (cup) => cup.season === state.season,
  );
  const currentCupRound = currentCup?.rounds.find(
    (round) => CUP_SETTLEMENT_WEEKS[round.number - 1] === state.week,
  );
  const homeCupFixture = currentCupRound?.fixtures.find(
    (fixture) =>
      fixture.homeClubId === state.userClubId && fixture.status === 'played',
  );
  if (currentCupRound !== undefined && homeCupFixture !== undefined) {
    const cupGate = homeGateIncomeWithReveal(
      state,
      userClub,
      'Hero Cup ticket revenue',
      'cup-gate',
    );
    lines.push({
      kind: 'tickets',
      label: `${CUP_DISPLAY_NAME} ${currentCupRound.label} home gate`,
      labelKey: 'ledger.cupHomeGate',
      // `<param>Key` names `<param>`: the app ring swaps in the translated
      // cup and round before interpolating, so a German statement stops
      // reading "Heldenpokal Quarter-final".
      labelParams: {
        cup: CUP_DISPLAY_NAME,
        cupKey: CUP_NAME_KEY,
        round: currentCupRound.label,
        roundKey: CUP_ROUND_NAME_KEYS[currentCupRound.label],
      },
      amount: cupGate.amount,
      ...(cupGate.reveal === undefined ? {} : { reveal: cupGate.reveal }),
    });
  }

  if (settledLeagueWin(state)) {
    lines.push({
      kind: 'prize',
      label: 'Divisional Win Bonus',
      labelKey: 'ledger.divisionalWinBonus',
      amount: divisionalWinBonus(
        state.m2 === undefined ? 5 : currentUserDivision(state.m2),
      ),
    });
  }

  lines.push(...awardLines);

  if (trainingMoneyCost > 0) {
    lines.push({
      kind: 'training',
      label: 'Weekly focus training',
      labelKey: 'ledger.weeklyFocusTraining',
      amount: checkedMultiply(trainingMoneyCost, -1, 'weekly training expense'),
    });
  }

  const merchandise = weeklyMerchandiseIncomeWithReveal(state, userClub);
  if (merchandise.amount > 0) {
    lines.push({
      kind: 'merch',
      label: 'Fan Shop merchandise',
      labelKey: 'ledger.fanShopMerchandise',
      amount: merchandise.amount,
      ...(merchandise.reveal === undefined
        ? {}
        : { reveal: merchandise.reveal }),
    });
  }

  const facilityUpkeep =
    state.facilities.grid === undefined
      ? 0
      : weeklyFacilityUpkeep(state.facilities.grid);
  if (facilityUpkeep > 0) {
    lines.push({
      kind: 'facilities',
      label: 'Facility upkeep',
      labelKey: 'ledger.facilityUpkeep',
      amount: checkedMultiply(facilityUpkeep, -1, 'weekly facility expense'),
    });
  }

  lines.push({
    kind: 'wages',
    label: 'Weekly wages',
    labelKey: 'ledger.weeklyWages',
    amount: checkedMultiply(userClub.weeklyWages, -1, 'weekly wage expense'),
  });

  const coachWage =
    state.market === undefined ? 0 : careerCoachWageLedgerAmount(state.market);
  if (coachWage !== 0) {
    lines.push({
      kind: 'wages',
      label: 'Coaching staff wages',
      labelKey: 'ledger.coachingStaffWages',
      amount: coachWage,
    });
  }

  const subsidyPercent = difficultyRules(state).seasonOneWageSubsidyPercent;
  if (state.season === 1 && subsidyPercent > 0) {
    const totalWageBill = checkedAdd(
      userClub.weeklyWages,
      Math.abs(coachWage),
      'subsidized wage bill',
    );
    lines.push({
      kind: 'subsidy',
      label: 'Season 1 wage subsidy',
      labelKey: 'ledger.seasonOneWageSubsidy',
      amount: requireSafeInteger(
        Math.floor(
          (requireSafeInteger(totalWageBill, 'weekly wages') * subsidyPercent) /
            100,
        ),
        'wage subsidy',
      ),
    });
  }

  return lines;
}

/**
 * The season-end prize line, named after the place it was actually won in.
 *
 * `position` leaves the ring RAW, never as "9th": ordinal suffixes are the
 * catalog's problem, not this ring's, and `src/game` cannot read `src/i18n`.
 */
function leaguePrizeLabel(position: number): {
  label: string;
  labelKey: string;
  labelParams?: Readonly<Record<string, number>>;
} {
  if (position === 1) {
    return {
      label: 'League champion prize',
      labelKey: 'ledger.leagueChampionPrize',
    };
  }
  if (position === 2) {
    return {
      label: 'League runner-up prize',
      labelKey: 'ledger.leagueRunnerUpPrize',
    };
  }
  return {
    label: `League prize · #${position}`,
    labelKey: 'ledger.leaguePlacePrize',
    labelParams: { position },
  };
}

function settlementAwards(
  state: GameState,
  userClub: ClubState,
  supplied: WeeklySettlementAwards,
): WeeklySettlementAwards {
  const awards: WeeklySettlementAward[] = [];

  if (state.week % 4 === 0) {
    const contracts = state.clubBusiness.sponsorship.activeContracts;
    if (contracts.length > 0) {
      if (state.clubBusiness.sponsorship.portfolioSeason !== state.season) {
        throw new Error(
          'active sponsor portfolio does not match the settling season',
        );
      }
      for (const payment of allocateSponsorPortfolioPayment(
        contracts,
        difficultyRules(state).sponsorIncomePercent,
      )) {
        if (payment.actualAmount <= 0) continue;
        awards.push({
          line: {
            kind: 'sponsor',
            label: `${payment.sponsorName} · Monthly sponsor`,
            labelKey: 'ledger.monthlySponsor',
            labelParams: { sponsor: payment.sponsorName },
            amount: payment.actualAmount,
            idempotencyKey: weeklySettlementAwardKeys.sponsorMonth(
              state.userClubId,
              state.season,
              state.week,
              payment.contractId,
            ),
          },
        });
      }
    } else {
      const sponsorIncome = currentActualMonthlySponsorIncome(state, userClub);
      if (sponsorIncome > 0) {
        awards.push({
          line: {
            kind: 'sponsor',
            label: 'Local advertising (monthly)',
            labelKey: 'ledger.localAdvertisingMonthly',
            amount: sponsorIncome,
            idempotencyKey: weeklySettlementAwardKeys.sponsorMonth(
              state.userClubId,
              state.season,
              state.week,
            ),
          },
        });
      }
    }
  }

  awards.push(...supplied.awards);

  if (state.week === SEASON_WEEKS) {
    const position = leagueStandings(state).find(
      (row) => row.clubId === state.userClubId,
    )?.position;
    const division = state.m2 === undefined ? 5 : currentUserDivision(state.m2);
    const prize =
      position === undefined ? 0 : leaguePrizeMoney(division, position);
    if (position !== undefined && prize > 0) {
      awards.push({
        line: {
          kind: 'prize',
          // The prize table pays all ten places; this label only had two
          // branches, so 3rd through 10th all banked a "League runner-up
          // prize" — "Prämie für den Zweiten" to a German manager who finished
          // 9th. Anything off the top two gets its own neutral, placed line.
          ...leaguePrizeLabel(position),
          amount: prize,
          idempotencyKey: weeklySettlementAwardKeys.leaguePrize(
            state.userClubId,
            state.season,
          ),
        },
      });
    }
    const firstD4Promotion =
      state.m2 !== undefined &&
      position !== undefined &&
      position <= 2 &&
      currentUserDivision(state.m2) === 5 &&
      highestDivisionReached(state) === 5;
    if (firstD4Promotion) {
      awards.push({
        line: {
          kind: 'subsidy',
          label: 'County League recruitment fund',
          labelKey: 'ledger.countyLeagueRecruitmentFund',
          amount: FIRST_D4_PROMOTION_RECRUITMENT_FUND,
          idempotencyKey: weeklySettlementAwardKeys.recruitmentFund(
            state.userClubId,
          ),
        },
      });
    }
  }

  return { awards };
}

export function currentActualMonthlySponsorIncome(
  state: GameState,
  userClub: ClubState,
): number {
  const contracts = state.clubBusiness.sponsorship.activeContracts;
  if (contracts.length > 0) {
    if (state.clubBusiness.sponsorship.portfolioSeason !== state.season) {
      throw new Error(
        'active sponsor portfolio does not match the current season',
      );
    }
    return actualSponsorPortfolioIncome(
      contracts,
      difficultyRules(state).sponsorIncomePercent,
    );
  }
  return Math.floor(
    (requireSafeInteger(userClub.sponsorMonthlyFee, 'monthly sponsor fee') *
      difficultyRules(state).sponsorIncomePercent) /
      100,
  );
}

/**
 * Extra seats and matchday spend from Stadium Stands. Level 1 adds the full
 * ordinary gate and upgrades add half. It rides the division scaling in
 * `divisionFans` and `divisionTicketPrice` instead of bypassing it.
 */
export const STADIUM_STAND_UPGRADE_GATE_BONUS_PERCENT = 50;
export const FAN_SHOP_UPGRADE_INCOME_PERCENT = 50;

/**
 * Commercial buildings open at full strength, then each upgrade adds half as
 * much. Building another shop or stand stays a real layout choice; repeatedly
 * upgrading the same one no longer repays itself within a few weeks.
 */
function commercialLevelPercent(
  level: number,
  count: number,
  upgradePercent: number,
  label: string,
): number {
  const safeLevel = requireSafeInteger(level, label);
  const safeCount = requireSafeInteger(count, `${label} building count`);
  if (safeLevel <= 0 || safeCount <= 0) return 0;
  return checkedAdd(
    checkedMultiply(safeCount, 100, `${label} buildings`),
    checkedMultiply(
      Math.max(0, safeLevel - safeCount),
      upgradePercent,
      `${label} upgrades`,
    ),
    label,
  );
}

/** Combined operational Stadium Stand level and building count across up to three stands. */
function gridStadiumStands(grid: FacilityGridState | undefined): {
  level: number;
  count: number;
} {
  if (grid === undefined) return { level: 0, count: 0 };
  let level = 0;
  let weighted = 0;
  let count = 0;
  for (const building of grid.buildings) {
    if (building.type !== 'stadium-stand') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    // Levels stack across up to three copies, so a story's boost has to raise
    // only the share of the building it happened to. Weighting each level by
    // its own building's boost and rounding the total keeps the downstream
    // integer arithmetic intact.
    weighted +=
      (building.level *
        (100 + cappedFacilityBoost(building.boosts, 'incomeBonusPercent'))) /
      100;
    level = checkedAdd(level, building.level, 'combined Stadium Stand level');
    count += 1;
  }
  return { level: Math.max(0, Math.round(weighted)), count };
}

/** Every operational stand level adds to the home gate across up to three stands. */
export function gridStadiumStandLevel(
  grid: FacilityGridState | undefined,
): number {
  return gridStadiumStands(grid).level;
}

/**
 * What the club's money buildings are currently worth, as multipliers.
 *
 * The accounts office shows these as percentages rather than cash: a Stand is
 * not worth a fixed cash amount, and what its multiplier pays depends on the
 * division the club is in when it is read. One derivation,
 * reused by the panel that explains them, so the copy can never drift from the
 * settlement above it.
 */
export interface CommercialFacilitySummary {
  readonly standLevel: number;
  readonly standCount: number;
  /** Percent added to the home gate by every operational stand level together. */
  readonly gateBonusPercent: number;
  readonly shopLevel: number;
  readonly shopCount: number;
  /** Merchandise multiplier as a percentage of one Level-1 shop. */
  readonly shopIncomePercent: number;
  /** The adjacency bonus already earned on merchandise; 0 when none is active. */
  readonly merchAdjacencyPercent: number;
}

export function commercialFacilitySummary(
  state: GameState,
): CommercialFacilitySummary {
  const grid = state.facilities.grid;
  const stands = gridStadiumStands(grid);
  const shops = gridFanShops(grid);
  return {
    standLevel: stands.level,
    standCount: stands.count,
    gateBonusPercent: commercialLevelPercent(
      stands.level,
      stands.count,
      STADIUM_STAND_UPGRADE_GATE_BONUS_PERCENT,
      'stand-gate-bonus',
    ),
    shopLevel: shops.level,
    shopCount: shops.count,
    shopIncomePercent: commercialLevelPercent(
      shops.level,
      shops.count,
      FAN_SHOP_UPGRADE_INCOME_PERCENT,
      'fan-shop-income',
    ),
    merchAdjacencyPercent:
      grid === undefined || shops.level === 0
        ? 0
        : facilityEffects(grid).merchIncomeBonusPercent,
  };
}

function gridFanShops(grid: FacilityGridState | undefined): {
  level: number;
  count: number;
} {
  if (grid === undefined) return { level: 0, count: 0 };
  let level = 0;
  let weighted = 0;
  let count = 0;
  for (const building of grid.buildings) {
    if (building.type !== 'fan-shop') continue;
    if (!isFacilityOperational(grid, building.id)) continue;
    // Levels stack across up to three copies, so a story's boost has to raise
    // only the share of the building it happened to. Weighting each level by
    // its own building's boost and rounding the total keeps the downstream
    // integer arithmetic intact.
    weighted +=
      (building.level *
        (100 + cappedFacilityBoost(building.boosts, 'incomeBonusPercent'))) /
      100;
    level = checkedAdd(level, building.level, 'combined Fan Shop level');
    count += 1;
  }
  return { level: Math.max(0, Math.round(weighted)), count };
}

/**
 * A flat uplift on every home gate — league and cup, every division, all game.
 *
 * It sits on the base rather than on the settled total, so the Stadium Stand
 * multiplier and the weekly variance roll ride on top of it exactly as they
 * already do for the rest of the gate, and the Financial Report's reveal keeps
 * showing the same base the club was actually paid on.
 */
const HOME_GATE_UPLIFT_PERCENT = 105;

function rawGateBase(userClub: ClubState, label: string): number {
  const attendance = sixtyPercentOf(userClub.fans);
  const gate = checkedMultiply(attendance, userClub.ticketPrice, label);
  return Math.floor(
    checkedMultiply(gate, HOME_GATE_UPLIFT_PERCENT, label) / 100,
  );
}

function gateIncomeFromBase(
  state: GameState,
  base: number,
): { amount: number; standLevel: number } {
  const stands = gridStadiumStands(state.facilities.grid);
  const standLevel = stands.level;
  if (standLevel === 0) return { amount: base, standLevel };
  const bonus = Math.floor(
    checkedMultiply(
      base,
      commercialLevelPercent(
        standLevel,
        stands.count,
        STADIUM_STAND_UPGRADE_GATE_BONUS_PERCENT,
        'stand-gate-bonus',
      ),
      'Stadium Stand gate bonus',
    ) / 100,
  );
  return { amount: checkedAdd(base, bonus, 'home gate income'), standLevel };
}

export function homeGateIncome(
  state: GameState,
  userClub: ClubState,
  label: string,
): number {
  return gateIncomeFromBase(state, rawGateBase(userClub, label)).amount;
}

/**
 * The gate as settlement banks it: the seeded weekly roll on the base, the
 * stand multiplier on top, and the saved reveal the Financial Report replays.
 * Ineligible weeks (spec §5) and zero-fan gates bank the baseline with no
 * reveal.
 */
function homeGateIncomeWithReveal(
  state: GameState,
  userClub: ClubState,
  label: string,
  source: 'league-gate' | 'cup-gate',
): { amount: number; reveal?: LedgerLineReveal } {
  const rawBase = rawGateBase(userClub, label);
  if (!varianceEligibleSettlement(state) || rawBase <= 0) {
    return { amount: gateIncomeFromBase(state, rawBase).amount };
  }
  const roll = matchdayVarianceRoll(
    state.careerSeed,
    state.season,
    state.week,
    source,
  );
  const base = applyVariancePercent(rawBase, roll.percent);
  const { amount, standLevel } = gateIncomeFromBase(state, base);
  const { count } = gridStadiumStands(state.facilities.grid);
  return {
    amount,
    reveal: {
      source,
      base,
      variancePercent: roll.percent,
      surge: roll.surge,
      multiplierPercent:
        100 +
        commercialLevelPercent(
          standLevel,
          count,
          STADIUM_STAND_UPGRADE_GATE_BONUS_PERCENT,
          'stand-gate-bonus',
        ),
      facilityCount: count,
    },
  };
}

function rawMerchPerLevel(userClub: ClubState): number {
  // One Level-1 merchandise unit per two fans. Upgrades scale this base below.
  return Math.floor(requireSafeInteger(userClub.fans, 'club fans') / 2);
}

function merchandiseIncomeFromPerLevel(
  state: GameState,
  perLevel: number,
): {
  amount: number;
  level: number;
  incomePercent: number;
  adjacencyPercent: number;
  adjacencyAmount: number;
} {
  const grid = state.facilities.grid;
  const { level, count } = gridFanShops(grid);
  if (grid === undefined || level === 0) {
    return {
      amount: 0,
      level,
      incomePercent: 0,
      adjacencyPercent: 0,
      adjacencyAmount: 0,
    };
  }
  const incomePercent = commercialLevelPercent(
    level,
    count,
    FAN_SHOP_UPGRADE_INCOME_PERCENT,
    'fan-shop-income',
  );
  const afterMultiplier = Math.floor(
    checkedMultiply(perLevel, incomePercent, 'Fan Shop merchandise base') / 100,
  );
  const adjacencyPercent = facilityEffects(grid).merchIncomeBonusPercent;
  const adjacencyAmount = Math.floor(
    checkedMultiply(
      afterMultiplier,
      adjacencyPercent,
      'Fan Shop merchandise adjacency bonus',
    ) / 100,
  );
  return {
    amount: checkedAdd(
      afterMultiplier,
      adjacencyAmount,
      'Fan Shop merchandise income',
    ),
    level,
    incomePercent,
    adjacencyPercent,
    adjacencyAmount,
  };
}

/** A small recurring return for building a Fan Shop, with the documented adjacency bonus. */
export function weeklyMerchandiseIncome(
  state: GameState,
  userClub: ClubState,
): number {
  return merchandiseIncomeFromPerLevel(state, rawMerchPerLevel(userClub))
    .amount;
}

/** Merchandise as settlement banks it — see homeGateIncomeWithReveal. */
function weeklyMerchandiseIncomeWithReveal(
  state: GameState,
  userClub: ClubState,
): { amount: number; reveal?: LedgerLineReveal } {
  const rawPerLevel = rawMerchPerLevel(userClub);
  if (!varianceEligibleSettlement(state) || rawPerLevel <= 0) {
    return { amount: merchandiseIncomeFromPerLevel(state, rawPerLevel).amount };
  }
  const roll = matchdayVarianceRoll(
    state.careerSeed,
    state.season,
    state.week,
    'merch',
  );
  const base = applyVariancePercent(rawPerLevel, roll.percent);
  const result = merchandiseIncomeFromPerLevel(state, base);
  if (result.level === 0 || base <= 0) return { amount: result.amount };
  const { count } = gridFanShops(state.facilities.grid);
  return {
    amount: result.amount,
    reveal: {
      source: 'merch',
      base,
      variancePercent: roll.percent,
      surge: roll.surge,
      multiplierTimes: result.level,
      multiplierPercent: result.incomePercent,
      facilityCount: count,
      adjacencyPercent: result.adjacencyPercent,
      adjacencyAmount: result.adjacencyAmount,
    },
  };
}

function progressAutomaticCupBeforeSettlement(state: GameState): {
  state: GameState;
  awards: WeeklySettlementAwards;
} {
  if (
    state.m2 === undefined ||
    !CUP_SETTLEMENT_WEEKS.includes(
      state.week as (typeof CUP_SETTLEMENT_WEEKS)[number],
    )
  ) {
    return { state, awards: EMPTY_WEEKLY_SETTLEMENT_AWARDS };
  }
  const activeCup = state.m2.nationalCups.find(
    (cup) => cup.championClubId === undefined,
  );
  if (activeCup === undefined)
    return { state, awards: EMPTY_WEEKLY_SETTLEMENT_AWARDS };

  const round = activeCup.rounds[activeCup.rounds.length - 1];
  const progressedM2 = resolveNextM2NationalCupRound(state.m2);
  const progressedState = { ...state, m2: progressedM2 };
  const resolvedCup = progressedM2.nationalCups.find(
    (cup) => cup.season === activeCup.season,
  )!;
  const resolvedRound = resolvedCup.rounds.find(
    (candidate) => candidate.number === round.number,
  )!;
  const userWon = resolvedRound.fixtures.some(
    (fixture) =>
      (fixture.homeClubId === state.userClubId ||
        fixture.awayClubId === state.userClubId) &&
      fixture.winnerClubId === state.userClubId,
  );
  return {
    state: progressedState,
    awards: userWon
      ? nationalCupRoundSettlementAwards({
          clubId: state.userClubId,
          season: activeCup.season,
          roundNumber: resolvedRound.number,
          roundLabel: resolvedRound.label,
        })
      : EMPTY_WEEKLY_SETTLEMENT_AWARDS,
  };
}

function advanceM2WeeklySidecars(state: GameState): GameState {
  let next = state;
  const sponsorship = next.clubBusiness.sponsorship;
  if (
    next.week >= 5 &&
    sponsorship.portfolioSeason === next.season &&
    (sponsorship.offers.length > 0 ||
      sponsorship.activeContracts.some((contract) => contract.provisional))
  ) {
    next = {
      ...next,
      clubBusiness: {
        ...next.clubBusiness,
        sponsorship: {
          ...expireSponsorOfferWindow(sponsorship, next.season, next.week),
          offerSeason: sponsorship.offerSeason ?? next.season,
        },
      },
    };
  }
  const grid = next.facilities.grid;
  if (grid !== undefined) {
    const advanced = advanceFacilityConstruction(grid);
    if (advanced.grid !== grid) {
      next = {
        ...next,
        facilities: {
          ...next.facilities,
          grid: advanced.grid,
          trainingGroundBuilt: advanced.grid.buildings.some(
            (building) =>
              building.type === 'training-pitch' &&
              isFacilityOperational(advanced.grid, building.id),
          ),
        },
      };
    }
  }
  if (next.market !== undefined) {
    next = { ...next, market: resolveCareerScoutClock(next, next.market) };
  }
  return reconcileStoryYouthIntake(next);
}

function completeNationalCupMatchday(
  state: GameState,
  results: FixtureResult[],
  production?: ProductionFixtureResult,
): GameState {
  const cupMatchday = activeCareerMatchday(state);
  if (
    cupMatchday?.kind !== 'national-cup' ||
    cupMatchday.cupRoundLabel === undefined
  ) {
    throw new Error('the matchday has no scheduled league or Hero Cup fixture');
  }
  validateResults(state, cupMatchday.fixtures, results);
  const conditionedState = applyMatchConditionCosts(
    state,
    cupMatchday.fixtures,
    results,
  );
  const hatTrickScorerId = hatTrickScorer(state, cupMatchday.fixtures, results);
  const result = results[0];
  const cupFixture = nationalCupFixtureById(state, cupMatchday.fixture.id);
  if (cupFixture === undefined || state.m2 === undefined) {
    throw new Error(`unknown Hero Cup fixture ${cupMatchday.fixture.id}`);
  }
  const winnerClubId =
    result.homeGoals > result.awayGoals
      ? cupFixture.homeClubId
      : result.homeGoals < result.awayGoals
        ? cupFixture.awayClubId
        : deterministicPenaltyWinner(state, cupFixture);
  const cupResult: NationalCupResult = {
    fixtureId: result.fixtureId,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    winnerClubId,
  };
  const resultByFixtureId = new Map([[result.fixtureId, result]]);
  const pendingImpact =
    production === undefined
      ? undefined
      : pendingImpactFromProduction({
          state: conditionedState,
          fixture: cupMatchday.fixture,
          production,
          competition: 'CUP',
          cupWinnerClubId: winnerClubId,
        });
  const participantIdsByFixture =
    pendingImpact === undefined
      ? undefined
      : new Map([
          [pendingImpact.fixtureId, pendingImpact.participantPlayerIds],
        ]);
  const progressed: GameState = queueCupGiantKillingCelebration(
    bankHatTrickMilestone(
      {
        ...conditionedState,
        m2: resolveNextM2NationalCupRound(conditionedState.m2!, cupResult),
        players: resolveCareerMatchFame(
          conditionedState,
          cupMatchday.fixtures,
          resultByFixtureId,
          participantIdsByFixture,
          new Map([[result.fixtureId, winnerClubId]]),
        ),
        seasonStatLines: recordStatLines(
          conditionedState,
          cupMatchday.fixtures,
          resultByFixtureId,
          'cup',
        ),
        ...(pendingImpact === undefined
          ? {}
          : {
              clubBusiness: {
                ...state.clubBusiness,
                pendingUserMatchImpacts: appendPendingUserMatchImpact(
                  state.clubBusiness.pendingUserMatchImpacts,
                  pendingImpact,
                ),
              },
            }),
      },
      hatTrickScorerId,
    ),
    cupGiantKillingCelebration(conditionedState, cupFixture, winnerClubId),
  );
  const cupOutcome: WeeklyMatchOutcome =
    winnerClubId === state.userClubId ? 'win' : 'loss';
  return settleCurrentWeek(progressed, {
    cupAlreadyResolved: true,
    // A production impact already carries this exact fixture, outcome, and its
    // real participants. Supplying the thin fallback as well would apply Cup
    // morale twice; only synthetic/headless Cup results need it.
    additionalMatchOutcomes: pendingImpact === undefined ? [cupOutcome] : [],
    awards:
      winnerClubId === state.userClubId
        ? nationalCupRoundSettlementAwards({
            clubId: state.userClubId,
            season: cupFixture.season,
            roundNumber: cupFixture.round,
            roundLabel: cupMatchday.cupRoundLabel,
          })
        : EMPTY_WEEKLY_SETTLEMENT_AWARDS,
  });
}

function resolveFinancialSafety(
  state: GameState,
  startingCash: number,
  baseLines: readonly LedgerLine[],
): {
  lines: LedgerLine[];
  balanceAfter: number;
  financialSafety?: FinancialSafetyState;
  facilityConversion?: BoardFacilityConversionResolution;
  forcedSale?: BoardForcedSaleResolution;
} {
  const previous = state.financialSafety ?? {
    consecutiveNegativeWeeks: 0,
    emergencyLoanUsed: false,
  };
  const lines = [...baseLines];
  let loan = previous.loan === undefined ? undefined : { ...previous.loan };
  if (
    loan !== undefined &&
    loan.remainingBalance > 0 &&
    loan.remainingWeeks > 0 &&
    state.season >= loan.repaymentStartsSeason
  ) {
    const repayment = Math.ceil(loan.remainingBalance / loan.remainingWeeks);
    lines.push({
      kind: 'loan-repayment',
      label: 'Emergency loan repayment',
      labelKey: 'ledger.emergencyLoanRepayment',
      amount: -repayment,
    });
    loan = {
      ...loan,
      remainingBalance: loan.remainingBalance - repayment,
      remainingWeeks: loan.remainingWeeks - 1,
    };
  }

  const net = lines.reduce(
    (total, line) => checkedAdd(total, line.amount, 'weekly ledger net'),
    0,
  );
  let balanceAfter = checkedAdd(startingCash, net, 'club cash balance');
  let consecutiveNegativeWeeks =
    balanceAfter < 0
      ? checkedAdd(
          previous.consecutiveNegativeWeeks,
          1,
          'negative cash week count',
        )
      : 0;
  let emergencyLoanUsed = previous.emergencyLoanUsed;
  let facilityConversionUsed =
    previous.facilityConversionUsed ??
    ((previous.boardUltimatum !== undefined &&
      boardUltimatumConsequence(previous.boardUltimatum) === 'FORCED_SALE') ||
      previous.latestBoardResolution?.kind === 'FACILITY_CONVERSION' ||
      previous.latestBoardResolution?.kind === 'FORCED_SALE' ||
      (previous.latestBoardResolution?.kind === 'TARGET_MET' &&
        !previous.latestBoardResolution.id.startsWith(
          'board-facility-ultimatum-',
        )));
  const rules = difficultyRules(state);
  if (previous.consecutiveNegativeWeeks > 0 && !emergencyLoanUsed) {
    // The first red week is the warning. Once it has been shown, the loan is a
    // board decision already in motion: it lands at the next settlement even
    // if prize money or other income has brought the balance above zero.
    // The rescue clears the hole AND leaves a Stadium Stand's worth of cash on
    // the table. A flat sum paid off the deficit and left whatever happened to
    // remain, which on a bad week was nothing — the one intervention the club
    // ever gets bought it a week of breathing and no way out of the hole. The
    // floor makes the loan a springboard: the stand is the club's income
    // building, so the money arrives already earmarked for earning it back.
    //
    // Never smaller than the difficulty's own figure, so this can only ever
    // raise a rescue, never shrink one.
    const deficit = Math.max(0, -balanceAfter);
    const amount = Math.max(
      rules.emergencyLoanAmount,
      checkedAdd(deficit, EMERGENCY_LOAN_FLOOR, 'emergency loan floor'),
    );
    lines.push({
      kind: 'emergency-loan',
      label: 'Board emergency loan',
      labelKey: 'ledger.boardEmergencyLoan',
      amount,
    });
    balanceAfter = checkedAdd(balanceAfter, amount, 'emergency loan balance');
    emergencyLoanUsed = true;
    consecutiveNegativeWeeks = balanceAfter < 0 ? consecutiveNegativeWeeks : 0;
    loan = {
      originalAmount: amount,
      remainingBalance: Math.ceil(amount * 1.1),
      repaymentStartsSeason: checkedAdd(
        state.season,
        1,
        'loan repayment season',
      ),
      remainingWeeks: 30,
    };
  }

  let boardUltimatum =
    previous.boardUltimatum === undefined
      ? undefined
      : {
          ...previous.boardUltimatum,
          candidates: previous.boardUltimatum.candidates.map((candidate) => ({
            ...candidate,
          })),
        };
  let latestBoardResolution =
    previous.latestBoardResolution === undefined
      ? undefined
      : { ...previous.latestBoardResolution };
  let forcedSale: BoardForcedSaleResolution | undefined;
  let facilityConversion: BoardFacilityConversionResolution | undefined;
  if (boardUltimatum !== undefined) {
    if (
      boardUltimatum.waitingForFacilityHomeGate === true &&
      baseLines.some((line) => line.kind === 'tickets')
    ) {
      const {
        waitingForFacilityHomeGate: _waitingForFacilityHomeGate,
        ...afterFirstHomeGate
      } = boardUltimatum;
      boardUltimatum = afterFirstHomeGate;
    }
    if (balanceAfter >= boardUltimatum.targetCash) {
      if (boardUltimatumConsequence(boardUltimatum) === 'FORCED_SALE') {
        // Legacy saves reached this stage before facility conversion existed.
        // Once a sale-stage round resolves, it must never be followed by the
        // newer first-stage facility intervention.
        facilityConversionUsed = true;
      }
      latestBoardResolution = targetMetResolution(state, boardUltimatum);
      boardUltimatum = undefined;
    } else if (boardUltimatum.weeksRemaining > 1) {
      boardUltimatum = {
        ...boardUltimatum,
        weeksRemaining: boardUltimatum.weeksRemaining - 1,
      };
    } else if (boardUltimatum.waitingForFacilityHomeGate === true) {
      // Four ordinary settlements have elapsed without one home gate. Keep the
      // last week open until the new commercial facility gets one home match
      // to affect cash, then resolve against that settlement's final balance.
    } else if (
      boardUltimatumConsequence(boardUltimatum) === 'FACILITY_CONVERSION'
    ) {
      facilityConversion = boardFacilityConversionAtDeadline(
        state,
        boardUltimatum,
      );
      const convertedState = applyBoardFacilityConversionConsequences(
        state,
        facilityConversion,
      );
      facilityConversionUsed = true;
      consecutiveNegativeWeeks = 0;
      latestBoardResolution = facilityConversion;
      // The money-making buildings need home fixtures to work. The next round
      // starts now and gives them four full settlements before a player sale.
      const playerSaleUltimatum = createBoardUltimatum(convertedState);
      boardUltimatum =
        playerSaleUltimatum === undefined
          ? undefined
          : {
              ...playerSaleUltimatum,
              waitingForFacilityHomeGate: true,
            };
    } else {
      forcedSale = boardForcedSaleAtDeadline(state, boardUltimatum);
      if (forcedSale === undefined) {
        // The deadline came and the board could not sell anyone.
        //
        // Parking the old ultimatum at one week meant re-entering this same
        // dead end every settlement: a squad trimmed to the starting eleven has
        // no eligible candidate at all, so the desk showed "Board deadline · 1
        // week" forever, the sale never happened, and only the next season's
        // squad refill ended it — up to thirty weeks of a threat that could not
        // fire. Fail-soft means the threat stops, not that it lies. A squad
        // that can still offer a list gets a fresh round; one that cannot is
        // left alone until it can, and the cash floor keeps carrying the club.
        //
        // `createBoardUltimatum` already mints `board-ultimatum-s{season}-
        // w{week}`, which the season and week make unique. Prefixing it with
        // the previous id grew a persisted string by ~18 characters per failed
        // round (22 -> 40 -> 58 -> 76 in sixteen weeks) for no gain.
        boardUltimatum = createBoardUltimatum(state);
      } else {
        // The player's NAME, not their id. Both halves carried the raw
        // `p-…` id, so the statement read "Board-enforced sale · p-abc123" —
        // in English too, not only in translation. The board selling someone
        // out from under you is the harshest moment the economy has; it should
        // at least name them.
        // Copied to a const first: `forcedSale` is a `let`, and TypeScript drops
        // its narrowing inside the closure below.
        const sale = forcedSale;
        const soldName =
          state.players.find((player) => player.id === sale.playerId)?.name ??
          sale.playerId;
        lines.push({
          kind: 'board-sale',
          label: `Board-enforced sale · ${soldName}`,
          labelKey: 'ledger.boardEnforcedSale',
          labelParams: { player: soldName },
          amount: forcedSale.fee,
        });
        balanceAfter = checkedAdd(
          balanceAfter,
          forcedSale.fee,
          'board forced-sale balance',
        );
        consecutiveNegativeWeeks = 0;
        facilityConversionUsed = true;
        latestBoardResolution = forcedSale;
        boardUltimatum = undefined;
      }
    }
  } else if (
    balanceAfter < 0 &&
    consecutiveNegativeWeeks >= rules.negativeWeeksBeforeIntervention &&
    emergencyLoanUsed
  ) {
    if (facilityConversionUsed) {
      boardUltimatum = createBoardUltimatum(state);
    } else {
      const facilityUltimatum = createBoardFacilityUltimatum(state);
      const facilityPlan = boardFacilityConversionAtDeadline(
        state,
        facilityUltimatum,
      );
      if (facilityPlan.addedFacilities.length > 0) {
        boardUltimatum = facilityUltimatum;
      } else {
        // Do not make Bert offer a building conversion the board already knows
        // cannot happen. Record the reason and start the player-sale warning
        // window instead. No player leaves at this point; the normal four-week
        // protection and recovery period still applies.
        facilityConversionUsed = true;
        latestBoardResolution = facilityPlan;
        boardUltimatum = createBoardUltimatum(state);
      }
    }
  }

  // The floor is the last line and it never runs out. Everything above it —
  // warnings, the one emergency loan, board-enforced sales — is finite, so a
  // club that stalled used them all up and then fell forever. Topping back up
  // to the floor keeps the debt bounded and keeps a rescue visible in the
  // ledger every week it happens, which is the difference between "fail-soft"
  // and "no consequence and no way back".
  if (balanceAfter < rules.cashFloor) {
    const rescue = checkedAdd(
      rules.cashFloor,
      -balanceAfter,
      'board rescue amount',
    );
    lines.push({
      kind: 'board-rescue',
      label: 'Board rescue package',
      labelKey: 'ledger.boardRescuePackage',
      amount: rescue,
    });
    balanceAfter = rules.cashFloor;
  }

  return {
    lines,
    balanceAfter,
    financialSafety: {
      consecutiveNegativeWeeks,
      emergencyLoanUsed,
      facilityConversionUsed,
      ...(loan === undefined ? {} : { loan }),
      ...(boardUltimatum === undefined ? {} : { boardUltimatum }),
      ...(latestBoardResolution === undefined ? {} : { latestBoardResolution }),
    },
    ...(facilityConversion === undefined ? {} : { facilityConversion }),
    ...(forcedSale === undefined ? {} : { forcedSale }),
  };
}

function nationalCupUserFixtureForCurrentWeek(state: GameState):
  | {
      fixture: NationalCupFixture;
      roundLabel: NationalCupRoundLabel;
    }
  | undefined {
  if (state.m2 === undefined) return undefined;
  const activeCup = state.m2.nationalCups.find(
    (cup) => cup.championClubId === undefined,
  );
  if (activeCup === undefined || activeCup.season !== state.season)
    return undefined;
  const round = activeCup.rounds[activeCup.rounds.length - 1];
  if (
    round === undefined ||
    CUP_SETTLEMENT_WEEKS[round.number - 1] !== state.week
  )
    return undefined;
  const fixture = round.fixtures.find(
    (candidate) =>
      candidate.status === 'scheduled' &&
      (candidate.homeClubId === state.userClubId ||
        candidate.awayClubId === state.userClubId),
  );
  return fixture === undefined
    ? undefined
    : { fixture, roundLabel: round.label };
}

function nationalCupFixtureAsLeagueFixture(
  fixture: NationalCupFixture,
  week: number,
): LeagueFixture {
  return {
    id: fixture.id,
    season: fixture.season,
    round: fixture.round,
    week,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    matchSeed: fixture.matchSeed,
    status: fixture.status,
    ...(fixture.score === undefined ? {} : { score: { ...fixture.score } }),
  };
}

export function deterministicPenaltyWinner(
  state: Pick<GameState, 'careerSeed'>,
  fixture: Pick<
    NationalCupFixture,
    'matchSeed' | 'round' | 'homeClubId' | 'awayClubId'
  >,
): string {
  const homeWins =
    ((fixture.matchSeed ^
      state.careerSeed ^
      Math.imul(fixture.round, 0x9e3779b1)) >>>
      0) %
      2 ===
    0;
  return homeWins ? fixture.homeClubId : fixture.awayClubId;
}

export function weeklyAmbientTrainingPoints(state: GameState): number {
  const grid = state.facilities.grid;
  /**
   * The best operational pitch wins, and its own boost travels with it.
   *
   * Reading the boost off the *same* building the level came from is the whole
   * trick: a build limit of one means there is never any ambiguity, and a
   * boost stored on a building nobody reads would leave a save that looks
   * improved while the numbers never move.
   */
  const bestPitch = grid?.buildings
    .filter(
      (building) =>
        building.type === 'training-pitch' &&
        isFacilityOperational(grid, building.id),
    )
    .reduce<PlacedFacility | undefined>(
      (best, building) =>
        best === undefined || building.level > best.level ? building : best,
      undefined,
    );
  const trainingPitchLevel =
    grid === undefined
      ? state.facilities.trainingGroundBuilt
        ? 1
        : 0
      : (bestPitch?.level ?? 0);
  const rawFacilityPoints = checkedMultiply(
    trainingPitchLevel,
    TRAINING_PITCH_TP_PER_LEVEL,
    'facility training points',
  );
  const facilityPoints = Math.max(
    0,
    Math.round(
      (rawFacilityPoints *
        (100 + cappedFacilityBoost(bestPitch?.boosts, 'tpBonusPercent'))) /
        100,
    ),
  );
  const coachPoints =
    state.market === undefined
      ? 0
      : careerCoachWeeklyTrainingPoints(state.market);
  // The baseline is unconditional: a club can run drills on whatever field it
  // has. Without it a career with no Training Pitch earned nothing, forever.
  return checkedAdd(
    checkedAdd(
      BASE_WEEKLY_TRAINING_POINTS,
      facilityPoints,
      'baseline training points',
    ),
    coachPoints,
    'ambient training points',
  );
}

function validateSetup(setup: CareerSetup): void {
  if (
    !Number.isInteger(setup.seed) ||
    setup.seed < 0 ||
    setup.seed > UINT32_MAX
  ) {
    throw new Error('career seed must be an integer from 0 to 4294967295');
  }
  if (setup.clubs.length !== CLUB_COUNT) {
    throw new Error(`a career requires exactly ${CLUB_COUNT} clubs`);
  }
  if (
    setup.difficulty !== undefined &&
    setup.difficulty !== 'COZY' &&
    setup.difficulty !== 'CHAIRMAN'
  ) {
    throw new Error(`unknown career difficulty ${String(setup.difficulty)}`);
  }

  const ids = new Set<string>();
  for (const club of setup.clubs) {
    if (typeof club.id !== 'string' || club.id.trim().length === 0) {
      throw new Error('club IDs must be non-empty strings');
    }
    if (ids.has(club.id)) {
      throw new Error('club IDs must be unique');
    }
    ids.add(club.id);

    validateNonnegativeInteger(club.cash, `${club.id} cash`);
    validateNonnegativeInteger(club.fans, `${club.id} fans`);
    validateNonnegativeInteger(club.ticketPrice, `${club.id} ticket price`);
    validateNonnegativeInteger(
      club.sponsorMonthlyFee,
      `${club.id} sponsor fee`,
    );
    validateNonnegativeInteger(club.weeklyWages, `${club.id} weekly wages`);
  }

  if (typeof setup.userClubId !== 'string' || !ids.has(setup.userClubId)) {
    throw new Error('userClubId must identify one of the career clubs');
  }

  validateNonnegativeInteger(
    setup.startingTrainingPoints ?? 0,
    'starting training points',
  );
  validatePlayerSetup(setup, ids);
}

function validatePlayerSetup(
  setup: CareerSetup,
  clubIds: ReadonlySet<string>,
): void {
  const players = setup.players ?? [];
  const lineups = setup.lineups ?? [];
  if ((players.length === 0) !== (lineups.length === 0)) {
    throw new Error('career players and lineups must be supplied together');
  }
  if (players.length === 0) return;

  const playerIds = new Set<string>();
  const playersByClub = new Map<string, Set<string>>(
    Array.from(clubIds, (clubId) => [clubId, new Set<string>()]),
  );
  for (const player of players) {
    if (
      typeof player.id !== 'string' ||
      player.id.trim().length === 0 ||
      playerIds.has(player.id)
    ) {
      throw new Error('player IDs must be non-empty and unique');
    }
    const clubPlayers = playersByClub.get(player.clubId);
    if (clubPlayers === undefined) {
      throw new Error(
        `player ${player.id} references unknown club ${player.clubId}`,
      );
    }
    playerIds.add(player.id);
    clubPlayers.add(player.id);
    validateNonnegativeInteger(player.weeklyWage, `${player.id} weekly wage`);
    validateNonnegativeInteger(
      player.contractSeasonsRemaining,
      `${player.id} contract seasons remaining`,
    );
    validateNonnegativeInteger(player.injuryWeeks, `${player.id} injury weeks`);
    validateNonnegativeInteger(player.morale, `${player.id} morale`);
    if (player.morale > 100)
      throw new Error(`${player.id} morale must be at most 100`);
  }

  if (lineups.length !== clubIds.size) {
    throw new Error('a full career setup requires one lineup per club');
  }
  const lineupClubIds = new Set<string>();
  for (const lineup of lineups) {
    if (!clubIds.has(lineup.clubId) || lineupClubIds.has(lineup.clubId)) {
      throw new Error('lineup club IDs must be known and unique');
    }
    lineupClubIds.add(lineup.clubId);
    if (
      lineup.playerIds.length !== 11 ||
      new Set(lineup.playerIds).size !== 11
    ) {
      throw new Error(`lineup ${lineup.clubId} must contain 11 unique players`);
    }
    const clubPlayers = playersByClub.get(lineup.clubId);
    if (lineup.playerIds.some((playerId) => !clubPlayers?.has(playerId))) {
      throw new Error(
        `lineup ${lineup.clubId} must contain only its own players`,
      );
    }
  }
}

function validateResults(
  state: GameState,
  fixtures: LeagueFixture[],
  results: FixtureResult[],
): void {
  if (results.length !== fixtures.length) {
    throw new Error(
      `matchday requires exactly ${fixtures.length} fixture results`,
    );
  }

  const expectedIds = new Set(fixtures.map((fixture) => fixture.id));
  const fixtureById = new Map(fixtures.map((fixture) => [fixture.id, fixture]));
  const playerClubById = new Map(
    state.players.map((player) => [player.id, player.clubId]),
  );
  for (const player of state.m2?.pyramid.divisions.flatMap((division) =>
    division.clubs.flatMap((club) => club.squad),
  ) ?? []) {
    if (!playerClubById.has(player.id))
      playerClubById.set(player.id, player.clubId);
  }
  const receivedIds = new Set<string>();

  for (const result of results) {
    if (!expectedIds.has(result.fixtureId)) {
      throw new Error(
        `result ${result.fixtureId} is not scheduled for the current week`,
      );
    }
    if (receivedIds.has(result.fixtureId)) {
      throw new Error(`fixture ${result.fixtureId} has more than one result`);
    }
    receivedIds.add(result.fixtureId);
    validateNonnegativeInteger(
      result.homeGoals,
      `${result.fixtureId} home goals`,
    );
    validateNonnegativeInteger(
      result.awayGoals,
      `${result.fixtureId} away goals`,
    );
    if (result.scorerPlayerIds === undefined) continue;

    if (result.scorerPlayerIds.length !== result.homeGoals + result.awayGoals) {
      throw new Error(
        `result ${result.fixtureId} scorer count must match the score`,
      );
    }
    // The original headless M1 harness supports club-only careers with no
    // persistent player roster. Their sim teams still have player IDs, but
    // there is intentionally no career ledger to attach those scorers to.
    if (playerClubById.size === 0) continue;
    const fixture = fixtureById.get(result.fixtureId)!;
    let homeScorers = 0;
    let awayScorers = 0;
    for (const playerId of result.scorerPlayerIds) {
      const clubId = playerClubById.get(playerId);
      if (clubId === fixture.homeClubId) homeScorers += 1;
      else if (clubId === fixture.awayClubId) awayScorers += 1;
      else
        throw new Error(
          `result ${result.fixtureId} has an unknown scorer ${playerId}`,
        );
    }
    if (homeScorers !== result.homeGoals || awayScorers !== result.awayGoals) {
      throw new Error(
        `result ${result.fixtureId} scorers must match each club's goals`,
      );
    }
  }
}

/**
 * Folds this matchday's contributions into the season's stat lines.
 *
 * League and cup are kept apart because a division board that counted goals
 * scored against another division would not be a division board. The club is
 * read from the roster now rather than resolved when the board is drawn: a
 * player sold in January must keep the goals he scored before he left.
 */
function recordStatLines(
  state: GameState,
  fixtures: LeagueFixture[],
  resultByFixtureId: ReadonlyMap<string, FixtureResult>,
  competition: AwardCompetition,
): GameState['seasonStatLines'] {
  const clubByPlayerId = new Map(
    state.players.map((player) => [player.id, player.clubId]),
  );
  const totals = new Map(
    (state.seasonStatLines ?? []).map((line) => [
      `${line.season}:${line.playerId}:${line.clubId}:${line.competition}`,
      { ...line },
    ]),
  );

  for (const fixture of fixtures) {
    const result = resultByFixtureId.get(fixture.id);
    for (const contribution of result?.contributions ?? []) {
      // The original headless M1 harness runs club-only careers with no career
      // roster, so its sim player IDs have nothing to attach a stat line to.
      const clubId = clubByPlayerId.get(contribution.playerId);
      if (clubId === undefined) continue;
      const key = `${state.season}:${contribution.playerId}:${clubId}:${competition}`;
      const previous = totals.get(key);
      /** @i18n-fallback Developer-only overflow label; never rendered. */
      const label = `${contribution.playerId} season`;
      totals.set(key, {
        season: state.season,
        playerId: contribution.playerId,
        clubId,
        competition,
        goals: checkedAdd(
          previous?.goals ?? 0,
          contribution.goals,
          `${label} goals`,
        ),
        assists: checkedAdd(
          previous?.assists ?? 0,
          contribution.assists,
          `${label} assists`,
        ),
        tacklesWon: checkedAdd(
          previous?.tacklesWon ?? 0,
          contribution.tacklesWon,
          `${label} tackles won`,
        ),
        saves: checkedAdd(
          previous?.saves ?? 0,
          contribution.saves,
          `${label} saves`,
        ),
        passesCompleted: checkedAdd(
          previous?.passesCompleted ?? 0,
          contribution.passesCompleted,
          `${label} passes completed`,
        ),
      });
    }
  }

  return [...totals.values()];
}

function validateNonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative integer`);
  }
}

/** The share of the club's supporters who turn up and pay, in percent. */
export const GATE_ATTENDANCE_PERCENT = 60;

function sixtyPercentOf(value: number): number {
  const fans = requireSafeInteger(value, 'ticket attendance fan count');
  if (fans < 0) {
    throw new Error('ticket attendance fan count must be nonnegative');
  }

  const groupsOfFive = Math.floor(fans / 5);
  const remainder = fans % 5;
  const wholeGroupAttendance = checkedMultiply(
    groupsOfFive,
    3,
    'ticket attendance',
  );
  const remainderAttendance = Math.floor((remainder * 3) / 5);
  return checkedAdd(
    wholeGroupAttendance,
    remainderAttendance,
    'ticket attendance',
  );
}

function cloneFixture(fixture: LeagueFixture): LeagueFixture {
  return fixture.score === undefined
    ? { ...fixture }
    : { ...fixture, score: { ...fixture.score } };
}

function clonePlayer(player: CareerPlayer): CareerPlayer {
  return { ...player, attrs: { ...player.attrs } };
}

function checkedAdd(left: number, right: number, label: string): number {
  requireSafeInteger(left, `${label} left operand`);
  requireSafeInteger(right, `${label} right operand`);
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return result;
}

function checkedSubtract(left: number, right: number, label: string): number {
  requireSafeInteger(left, `${label} left operand`);
  requireSafeInteger(right, `${label} right operand`);
  const result = left - right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return result;
}

function checkedMultiply(left: number, right: number, label: string): number {
  requireSafeInteger(left, `${label} left operand`);
  requireSafeInteger(right, `${label} right operand`);
  const result = left * right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds the safe integer range`);
  }
  return result;
}

function requireSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer`);
  }
  return value;
}
