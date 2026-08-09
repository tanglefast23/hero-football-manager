import { createLaunchCareerSetup } from '../../application/launch';
import {
  advanceWeek,
  completeMatchday,
  createCareer,
  fixturesForCurrentWeek,
} from '../../game/career';
import type { SponsorContractSnapshot } from '../../game/club-business-types';
import { createSeasonSponsorship } from '../../game/sponsors';
import type { DifficultyMode, GameState } from '../../game/types';
import { parseStoredGameState } from '../game-state-codec';

function reachWeekFour(difficulty: DifficultyMode = 'COZY'): GameState {
  let state = createCareer(
    createLaunchCareerSetup(20260805, undefined, undefined, difficulty),
  );

  state = advanceWeek(state);
  state = advanceWeek(state);
  state = advanceWeek(state);
  expect(state).toMatchObject({ season: 1, week: 3, phase: 'matchday' });
  state = completeMatchday(
    state,
    fixturesForCurrentWeek(state).map((fixture) => ({
      fixtureId: fixture.id,
      homeGoals: 0,
      awayGoals: 0,
    })),
  );
  expect(state).toMatchObject({ season: 1, week: 4, phase: 'manage' });
  return withSafeCash(state);
}

function withSafeCash(state: GameState): GameState {
  return {
    ...state,
    clubs: state.clubs.map((club) =>
      club.id === state.userClubId ? { ...club, cash: 1_000_000 } : club,
    ),
  };
}

function sponsorLines(state: GameState) {
  return (
    state.ledgers.at(-1)?.lines.filter((line) => line.kind === 'sponsor') ?? []
  );
}

function settleManageWeek(state: GameState): GameState {
  const advanced = advanceWeek(state);
  if (advanced.phase !== 'matchday') return advanced;
  return completeMatchday(
    advanced,
    fixturesForCurrentWeek(advanced).map((fixture) => ({
      fixtureId: fixture.id,
      homeGoals: 0,
      awayGoals: 0,
    })),
  );
}

describe('sponsor settlement integration', () => {
  test('pays the managed Chairman portfolio exactly once before Week 5 closes its offers', () => {
    const initial = reachWeekFour('CHAIRMAN');
    const sponsorship = createSeasonSponsorship({
      rules: initial.sponsorRules!,
      careerSeed: initial.careerSeed,
      season: initial.season,
      division: 2,
      highestDivisionReached: 2,
      difficulty: 'CHAIRMAN',
      nominalAnchor: 8_000,
    });
    const ready: GameState = {
      ...initial,
      m2: {
        ...initial.m2!,
        highestDivisionReached: 2,
      },
      clubBusiness: {
        ...initial.clubBusiness,
        sponsorship,
      },
    };

    expect(ready.clubBusiness.sponsorship.offers).toHaveLength(9);
    expect(
      ready.clubBusiness.sponsorship.activeContracts.every(
        (contract) => contract.provisional,
      ),
    ).toBe(true);

    const settled = settleManageWeek(ready);
    const paid = sponsorLines(settled);

    expect(paid.map((line) => line.amount)).toEqual([2_134, 2_133, 2_133]);
    expect(paid.reduce((total, line) => total + line.amount, 0)).toBe(6_400);
    expect(paid).toHaveLength(3);
    expect(
      paid.some(
        (line) =>
          line.label === 'Chairman sponsor target' ||
          line.label === 'Local advertising (monthly)',
      ),
    ).toBe(false);
    expect(settled).toMatchObject({ season: 1, week: 5, phase: 'manage' });
    expect(settled.clubBusiness.sponsorship.offers).toEqual([]);
    expect(
      settled.clubBusiness.sponsorship.activeContracts.every(
        (contract) => !contract.provisional,
      ),
    ).toBe(true);
  });

  test('preserves a migrated D4 sponsor scalar through the real Week 4 cash settlement', () => {
    const current = reachWeekFour();
    const legacy = JSON.parse(JSON.stringify(current)) as Record<
      string,
      unknown
    >;
    legacy.schemaVersion = 3;
    delete legacy.clubBusiness;
    delete legacy.sponsorRules;
    const m2 = legacy.m2 as Record<string, unknown>;
    m2.highestDivisionReached = 4;
    const clubs = legacy.clubs as Array<Record<string, unknown>>;
    const userClub = clubs.find((club) => club.id === legacy.userClubId)!;
    userClub.sponsorMonthlyFee = 4_123;

    const migrated = parseStoredGameState(JSON.stringify(legacy));
    expect(migrated.clubBusiness.sponsorship.activeContracts).toHaveLength(1);
    expect(migrated.clubBusiness.sponsorship.activeContracts[0]).toMatchObject({
      nominalMonthlyFee: 4_123,
      provisional: true,
    });

    const settled = settleManageWeek(migrated);

    expect(sponsorLines(settled)).toEqual([
      expect.objectContaining({
        amount: 4_123,
        idempotencyKey: expect.stringContaining('continuity-s1-slot0'),
      }),
    ]);
    expect(
      settled.clubs.find((club) => club.id === settled.userClubId)
        ?.sponsorMonthlyFee,
    ).toBe(4_123);
    expect(
      settled.clubBusiness.sponsorship.activeContracts[0].provisional,
    ).toBe(false);
  });

  test('settles Chairman objective bonuses at Week 30 once through the weekly ledger seam', () => {
    const initial = reachWeekFour('CHAIRMAN');
    const userFixture = initial.fixtures.find(
      (fixture) =>
        fixture.status === 'scheduled' &&
        (fixture.homeClubId === initial.userClubId ||
          fixture.awayClubId === initial.userClubId),
    )!;
    const userIsHome = userFixture.homeClubId === initial.userClubId;
    const contracts: SponsorContractSnapshot[] = [
      {
        contractId: 'wins',
        sponsorContentId: 'wins',
        sponsorName: 'Wins Co',
        offerLine: 'Win a league match.',
        season: 1,
        slot: 0,
        nominalMonthlyFee: 4_000,
        provisional: false,
        objective: {
          kind: 'LEAGUE_WINS',
          label: 'Win 1 league match',
          target: 1,
          nominalBonus: 1_001,
        },
      },
      {
        contractId: 'goals',
        sponsorContentId: 'goals',
        sponsorName: 'Goals Co',
        offerLine: 'Score twice.',
        season: 1,
        slot: 1,
        nominalMonthlyFee: 4_000,
        provisional: false,
        objective: {
          kind: 'LEAGUE_GOALS',
          label: 'Score 2 league goals',
          target: 2,
          nominalBonus: 999,
        },
      },
    ];
    const ready: GameState = {
      ...initial,
      week: 30,
      phase: 'manage',
      m2: {
        ...initial.m2!,
        highestDivisionReached: 3,
      },
      fixtures: initial.fixtures.map((fixture) =>
        fixture.id === userFixture.id
          ? {
              ...fixture,
              status: 'played' as const,
              score: {
                homeGoals: userIsHome ? 2 : 0,
                awayGoals: userIsHome ? 0 : 2,
              },
            }
          : fixture,
      ),
      clubBusiness: {
        ...initial.clubBusiness,
        sponsorship: {
          activeContracts: contracts,
          offers: [],
          portfolioSeason: 1,
          offerSeason: 1,
        },
      },
    };

    // Week 30 is the league finale, so the objectives settle behind the last
    // match of the season rather than behind a bare Advance Week press.
    const settled = settleManageWeek(ready);
    const objectiveLines = settled.ledgers
      .flatMap((ledger) => ledger.lines)
      .filter((line) => line.idempotencyKey?.startsWith('sponsor-objective:'));

    expect(objectiveLines.map((line) => [line.label, line.amount])).toEqual([
      ['Wins Co objective bonus', 801],
      ['Goals Co objective bonus', 799],
    ]);
    expect(
      settled.clubBusiness.sponsorship.activeContracts.map(
        (contract) => contract.objectiveOutcome,
      ),
    ).toEqual([
      { met: true, settledSeason: 1, actualBonus: 801 },
      { met: true, settledSeason: 1, actualBonus: 799 },
    ]);

    const repeated = advanceWeek({ ...settled, phase: 'manage' });
    expect(
      repeated.ledgers
        .flatMap((ledger) => ledger.lines)
        .filter((line) =>
          line.idempotencyKey?.startsWith('sponsor-objective:'),
        ),
    ).toEqual(objectiveLines);
  });

  test('labels the unmanaged D5 monthly income as local advertising in both modes', () => {
    const cozy = sponsorLines(settleManageWeek(reachWeekFour('COZY')));
    expect(cozy).toEqual([
      expect.objectContaining({
        label: 'Local advertising (monthly)',
        amount: 3_000,
      }),
    ]);

    const chairman = sponsorLines(settleManageWeek(reachWeekFour('CHAIRMAN')));
    expect(chairman).toEqual([
      expect.objectContaining({
        label: 'Local advertising (monthly)',
        amount: 2_400,
      }),
    ]);
  });
});
