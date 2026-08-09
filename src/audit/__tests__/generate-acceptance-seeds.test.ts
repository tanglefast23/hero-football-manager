import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import {
  addCreatedPlayer,
  beginCareerTransferTalks,
  beginStoryOnboarding,
  buildFacility,
  createBoardUltimatum,
  createCareer,
  careerRosterCapacity,
  currentUserDivision,
  offerCareerEvent,
  resolveCareerScoutClock,
  resolvePostMatchAwakening,
  startCareerScoutMission,
  startNextSeason,
  type DifficultyMode,
  type GameState,
} from '../../game';
import {
  parseStoredGameState,
  serializeGameState,
} from '../../persistence/game-state-codec';

const OUTPUT_DIR = join(
  process.cwd(),
  'artifacts',
  'acceptance-audit-2026-07-21',
  'seeds',
);
const content = loadLaunchContent();

/**
 * Writes into git-tracked artifact files, so a plain `npx jest` used to dirty
 * the working tree whenever engine or content changes moved the generated
 * saves — hostile to the many-concurrent-worktrees workflow. Opt in explicitly
 * when regenerating the acceptance seeds:
 *
 *   ACCEPTANCE_SEEDS=1 npx jest src/audit/__tests__/generate-acceptance-seeds.test.ts
 */
const describeIfEnabled =
  process.env.ACCEPTANCE_SEEDS === '1' ? describe : describe.skip;

interface Scenario {
  readonly id: string;
  readonly expectedScreen: string;
  readonly state: GameState;
}

describeIfEnabled('acceptance audit seed harness', () => {
  it('generates schema-valid production saves for every requested boundary', () => {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    const scenarios = buildScenarios();
    const manifest = scenarios.map(({ id, expectedScreen, state }) => {
      let serialized: string;
      try {
        serialized = serializeGameState(state);
      } catch (error) {
        throw new Error(
          `${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      expect(parseStoredGameState(serialized)).toEqual(state);
      writeFileSync(join(OUTPUT_DIR, `${id}.json`), serialized);
      return {
        id,
        expectedScreen,
        season: state.season,
        week: state.week,
        phase: state.phase,
        difficulty: state.difficulty ?? 'COZY',
      };
    });
    writeFileSync(
      join(OUTPUT_DIR, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    expect(scenarios).toHaveLength(34);
  });
});

function buildScenarios(): Scenario[] {
  const freshCozy = onboardingStart(7_210_001, 'COZY');
  const freshChairman = onboardingStart(7_210_002, 'CHAIRMAN');
  const firstMatch = createdCareer(7_210_003, 'COZY', false);

  const collapseFixtureId = firstMatch.onboarding!.firstFixtureId!;
  const collapse = {
    ...firstMatch,
    onboarding: { ...firstMatch.onboarding!, stage: 'collapse' as const },
    fixtures: firstMatch.fixtures.map((fixture) =>
      fixture.id === collapseFixtureId
        ? {
            ...fixture,
            status: 'played' as const,
            score: { homeGoals: 1, awayGoals: 1 },
          }
        : fixture,
    ),
  };
  const revealLineup = collapse.lineups.find(
    (lineup) => lineup.clubId === collapse.userClubId,
  )!;
  const reveal = resolvePostMatchAwakening(
    collapse,
    collapseFixtureId,
    revealLineup.playerIds,
    content.powers.powers.map((power) => power.id),
    content.onboarding.triggers.map((trigger) => trigger.id),
    {
      chancePercent: 100,
      secondInSeasonChancePercent: 100,
      maxPerSeason: 99,
      minimumMatchesBetween: 0,
    },
  ).state;

  const base = auditCareer(7_210_100);
  const week2 = atWeek(base, 2);
  const week3 = atWeek(base, 3);
  const week5 = atWeek(base, 5);
  const week15 = atWeek(base, 15);
  const week17 = atWeek(base, 17);
  const week18 = atWeek(base, 18);
  const matchFixture = base.fixtures.find(
    (fixture) =>
      fixture.homeClubId === base.userClubId ||
      fixture.awayClubId === base.userClubId,
  )!;
  const matchWeek = {
    ...atWeek(base, matchFixture.week),
    phase: 'matchday' as const,
  };

  const userLineup = base.lineups.find(
    (lineup) => lineup.clubId === base.userClubId,
  )!;
  const fullRoster = withRosterCount(
    atWeek(base, 18),
    careerRosterCapacity(base),
  );
  const removableReserve = fullRoster.players.find(
    (player) =>
      player.clubId === fullRoster.userClubId &&
      !userLineup.playerIds.includes(player.id),
  )!;
  const zeroMoney = withCash(base, 0);
  const negativeCash = {
    ...withCash(atWeek(base, 8), -750),
    financialSafety: {
      consecutiveNegativeWeeks: 1,
      emergencyLoanUsed: false,
    },
  };
  const emergencyLoan = {
    ...withCash(atWeek(base, 12), 3_250),
    financialSafety: {
      consecutiveNegativeWeeks: 4,
      emergencyLoanUsed: true,
      loan: {
        originalAmount: 20_000,
        remainingBalance: 18_000,
        repaymentStartsSeason: 2,
        remainingWeeks: 30,
      },
    },
  };
  const boardCash = withCash(atWeek(base, 20), -4_000);
  const boardUltimatum = createBoardUltimatum(boardCash);
  if (boardUltimatum === undefined)
    throw new Error('expected board candidates');
  const boardState = {
    ...boardCash,
    financialSafety: {
      consecutiveNegativeWeeks: 8,
      emergencyLoanUsed: true,
      loan: {
        originalAmount: 20_000,
        remainingBalance: 20_000,
        repaymentStartsSeason: 2,
        remainingWeeks: 30,
      },
      boardUltimatum,
    },
  };
  const boardDeadline = {
    ...boardState,
    financialSafety: {
      ...boardState.financialSafety,
      boardUltimatum: {
        ...boardState.financialSafety.boardUltimatum,
        weeksRemaining: 1,
      },
    },
  };

  const pendingEvent = offerCareerEvent(
    { ...atWeek(base, 7), pendingEvent: undefined },
    'meteor-shard-center-circle',
  );

  const injuredPlayerId = userLineup.playerIds.find(
    (id) => base.players.find((player) => player.id === id)?.role !== 'GK',
  )!;
  const injured = {
    ...atWeek(base, 8),
    players: base.players.map((player) =>
      player.id === injuredPlayerId
        ? { ...player, injuryWeeks: 3, condition: 35 }
        : player,
    ),
  };
  const cappedPlayerId = userLineup.playerIds[1];
  const capped = {
    ...atWeek(base, 8),
    players: base.players.map((player) =>
      player.id === cappedPlayerId
        ? {
            ...player,
            attrs: {
              pac: 99,
              sho: 99,
              pas: 99,
              def: 99,
              tec: 99,
              sta: 99,
              ref: 99,
            },
          }
        : player,
    ),
  };

  const constructionBase = atWeek(withCash(base, 40_000), 8);
  const construction = buildFacility(
    constructionBase.facilities.grid!,
    'gym',
    { x: 2, y: 0 },
    userClub(constructionBase).cash,
  );
  const activeConstruction = {
    ...constructionBase,
    clubs: constructionBase.clubs.map((club) =>
      club.id === constructionBase.userClubId
        ? { ...club, cash: construction.cashAfter }
        : club,
    ),
    facilities: { ...constructionBase.facilities, grid: construction.grid },
  };

  const scoutBase = atWeek(withCash(base, 50_000), 15);
  const scouted = startCareerScoutMission(
    scoutBase,
    scoutBase.market!,
    'LOCAL',
    { kind: 'AGE', minimumAge: 16, maximumAge: 45 },
  );
  const activeScout = { ...scouted.state, market: scouted.market };
  const scoutDue = { ...activeScout, week: 18 };
  const resolvedMarket = resolveCareerScoutClock(scoutDue, scoutDue.market!);
  const firstReport = resolvedMarket.scoutReports[0];
  if (firstReport === undefined) throw new Error('expected a scouting report');
  const pendingNegotiation = {
    ...scoutDue,
    market: beginCareerTransferTalks(
      scoutDue,
      resolvedMarket,
      firstReport.playerId,
    ),
  };
  const fullRosterWithNegotiation = withRosterCount(
    pendingNegotiation,
    careerRosterCapacity(pendingNegotiation),
  );
  const oneSlotWithNegotiation = {
    ...fullRosterWithNegotiation,
    players: fullRosterWithNegotiation.players.filter(
      (player) => player.id !== removableReserve.id,
    ),
    clubs: fullRosterWithNegotiation.clubs.map((club) =>
      club.id === fullRosterWithNegotiation.userClubId
        ? {
            ...club,
            weeklyWages: club.weeklyWages - removableReserve.weeklyWage,
          }
        : club,
    ),
  };

  const seasonEnd = finishSeason(auditCareer(7_210_200), 'loss');
  const promotion = finishSeason(auditCareer(7_210_201), 'win');
  const promotedSeason = withoutOnboarding(
    startNextSeason(
      finishSeason(ensureContracts(auditCareer(7_210_202)), 'win'),
    ),
  );
  const relegation = finishSeason(ensureContracts(promotedSeason), 'loss');

  const lateCareer = {
    ...atWeek(auditCareer(7_210_300), 15),
    season: 9,
    youthIntake:
      auditCareer(7_210_300).youthIntake === undefined
        ? undefined
        : {
            ...auditCareer(7_210_300).youthIntake!,
            season: 9,
            status: 'CLOSED' as const,
            offers: [],
          },
  };

  const legacyBase = atWeek(auditCareer(7_210_400), 6);
  const legacySource = legacyBase.players.find(
    (player) => player.clubId === legacyBase.userClubId,
  )!;
  const retiredLegend = {
    ...legacySource,
    id: 'audit-retired-legend',
    name: 'Ari Legend',
    age: 36,
    seasonsAtClub: 8,
    fame: 92,
    retirementAnnounced: true,
    retirementAnnouncementSeason: 8,
  };
  const legacy = {
    ...legacyBase,
    retiredPlayers: [retiredLegend],
    pendingLegacyPlayerIds: [retiredLegend.id],
  };

  let d1Journey = ensureContracts(auditCareer(7_210_500));
  while (currentUserDivision(d1Journey.m2!) > 1) {
    d1Journey = ensureContracts(
      withoutOnboarding(startNextSeason(finishSeason(d1Journey, 'win'))),
    );
  }
  const completed = {
    ...finishSeason(d1Journey, 'win'),
    phase: 'complete' as const,
  };

  const migratedSource = atWeek(auditCareer(7_210_600), 6);
  const {
    onboarding: _onboarding,
    retirementAnnouncements: _retirementAnnouncements,
    seasonRecaps: _seasonRecaps,
    ...migrated
  } = migratedSource;

  return [
    scenario('fresh-cozy', 'create-player', freshCozy),
    scenario('fresh-chairman', 'create-player', freshChairman),
    scenario('onboarding-first-match', 'management', firstMatch),
    scenario('onboarding-collapse', 'awakening', collapse),
    scenario('onboarding-reveal', 'awakening', reveal),
    scenario('onboarding-complete', 'management', auditCareer(7_210_004)),
    scenario('week-2', 'management', week2),
    scenario('week-3', 'management', week3),
    scenario('week-5', 'management', week5),
    scenario('week-15', 'management', week15),
    scenario('transfer-window-week-17', 'management', week17),
    scenario('transfer-window-week-18', 'management', week18),
    scenario('match-week', 'matchday', matchWeek),
    scenario('full-roster', 'management', fullRosterWithNegotiation),
    scenario('one-slot-free', 'management', oneSlotWithNegotiation),
    scenario('zero-tp', 'management', { ...base, trainingPoints: 0 }),
    scenario('zero-money', 'management', zeroMoney),
    scenario('negative-cash', 'management', negativeCash),
    scenario('emergency-loan-active', 'management', emergencyLoan),
    scenario('board-ultimatum', 'management', boardState),
    scenario('board-deadline', 'management', boardDeadline),
    scenario('injured-squad', 'management', injured),
    scenario('capped-players', 'management', capped),
    scenario('active-construction', 'management', activeConstruction),
    scenario('active-scout-mission', 'management', activeScout),
    scenario('pending-negotiation', 'management', pendingNegotiation),
    scenario('pending-event', 'event', pendingEvent),
    scenario('season-end', 'season-end', seasonEnd),
    scenario('promotion', 'championship-celebration', promotion),
    scenario('relegation', 'season-end', relegation),
    scenario('late-career-season', 'management', lateCareer),
    scenario('retirement-legacy', 'legacy', legacy),
    scenario('completed-career', 'championship-celebration', completed),
    scenario('migrated-save', 'management', migrated as GameState),
  ];
}

function onboardingStart(seed: number, difficulty: DifficultyMode): GameState {
  return beginStoryOnboarding(
    createCareer(createLaunchCareerSetup(seed, undefined, content, difficulty)),
  );
}

function createdCareer(
  seed: number,
  difficulty: DifficultyMode,
  completeGuide = true,
): GameState {
  let state = addCreatedPlayer(onboardingStart(seed, difficulty), {
    name: 'Audit Rookie',
    appearance: { skinTone: 2, hairstyle: 3, kitAccent: 1 },
    ratings: { pac: 52, sho: 51, pas: 50, def: 47, tec: 53, sta: 47 },
  });
  if (!completeGuide) return state;
  const createdPlayerId = state.onboarding!.createdPlayerId!;
  return {
    ...state,
    onboarding: {
      ...state.onboarding!,
      stage: 'complete',
      awakenedPower: 'SUPER_SPEED',
    },
    players: state.players.map((player) =>
      player.id === createdPlayerId
        ? { ...player, power: 'SUPER_SPEED', powerTier: 1, licensed: true }
        : player,
    ),
    eventFlags: unique([
      ...state.eventFlags,
      'guide:bert:intro-complete',
      'guide:bert:first-training-complete',
      'guide:bert:desk-intro-complete',
      'guide:bert:first-week-advanced',
      'm4:event-guide-seen',
      'm4:season-recap-guide-seen',
    ]),
  };
}

function auditCareer(seed: number): GameState {
  return createdCareer(seed, 'COZY', true);
}

function atWeek(state: GameState, week: number): GameState {
  return { ...state, week, phase: 'manage' };
}

function withCash(state: GameState, cash: number): GameState {
  return {
    ...state,
    clubs: state.clubs.map((club) =>
      club.id === state.userClubId ? { ...club, cash } : club,
    ),
  };
}

function withRosterCount(state: GameState, targetCount: number): GameState {
  const existing = state.players.filter(
    (player) => player.clubId === state.userClubId,
  );
  if (existing.length > targetCount)
    throw new Error('audit roster already exceeds target');
  const template =
    existing.find((player) => player.power === undefined) ?? existing[0];
  if (template === undefined)
    throw new Error('audit roster needs a player template');
  const additions = Array.from(
    { length: targetCount - existing.length },
    (_, index) => ({
      ...template,
      id: `audit-roster-cap-${index + 1}`,
      name: `Roster Cap ${index + 1}`,
      licensed: false,
    }),
  );
  const addedWages = additions.reduce(
    (sum, player) => sum + player.weeklyWage,
    0,
  );
  return {
    ...state,
    players: [...state.players, ...additions],
    clubs: state.clubs.map((club) =>
      club.id === state.userClubId
        ? { ...club, weeklyWages: club.weeklyWages + addedWages }
        : club,
    ),
  };
}

function finishSeason(
  state: GameState,
  result: 'win' | 'draw' | 'loss',
): GameState {
  return {
    ...state,
    week: 30,
    phase: 'season-end',
    fixtures: state.fixtures.map((fixture) =>
      fixture.season !== state.season
        ? fixture
        : {
            ...fixture,
            status: 'played' as const,
            score:
              fixture.homeClubId === state.userClubId
                ? result === 'win'
                  ? { homeGoals: 3, awayGoals: 0 }
                  : result === 'loss'
                    ? { homeGoals: 0, awayGoals: 3 }
                    : { homeGoals: 1, awayGoals: 1 }
                : fixture.awayClubId === state.userClubId
                  ? result === 'win'
                    ? { homeGoals: 0, awayGoals: 3 }
                    : result === 'loss'
                      ? { homeGoals: 3, awayGoals: 0 }
                      : { homeGoals: 1, awayGoals: 1 }
                  : { homeGoals: 0, awayGoals: 0 },
          },
    ),
  };
}

function ensureContracts(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) =>
      player.clubId === state.userClubId
        ? {
            ...player,
            contractSeasonsRemaining: Math.max(
              3,
              player.contractSeasonsRemaining,
            ),
          }
        : player,
    ),
  };
}

function withoutOnboarding(state: GameState): GameState {
  const { onboarding: _onboarding, ...next } = state;
  return next as GameState;
}

function userClub(state: GameState): GameState['clubs'][number] {
  return state.clubs.find((club) => club.id === state.userClubId)!;
}

function scenario(
  id: string,
  expectedScreen: string,
  state: GameState,
): Scenario {
  return { id, expectedScreen, state };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
