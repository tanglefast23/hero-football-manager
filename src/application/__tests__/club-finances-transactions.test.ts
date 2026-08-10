import { createLaunchCareerSetup } from '../launch';
import { clubFinancesViewModel } from '../view-models';
import type { SponsorContractSnapshot } from '../../game/club-business-types';
import {
  advanceFacilityConstruction,
  buildCareerFacility,
  createCareer,
  relocateCareerFacility,
  TRAINING_PITCH_TP_PER_LEVEL,
  type FacilityGridState,
} from '../../game';

function finishConstruction(grid: FacilityGridState): FacilityGridState {
  let next = grid;
  while (next.construction !== undefined)
    next = advanceFacilityConstruction(next).grid;
  return next;
}

describe('club finances immediate transaction history', () => {
  test('orders the facility cards in manager-priority pairs', () => {
    const initial = createCareer(createLaunchCareerSetup(20260810));
    const catalog = clubFinancesViewModel(initial).facilities.catalog;

    expect(catalog.map((facility) => facility.type)).toEqual([
      'training-pitch',
      'coaching-office',
      'fan-shop',
      'stadium-stand',
      'keeper-court',
      'medical-bay',
      'dorm',
      'scout-office',
      'gym',
      'youth-field',
      'tech-center',
      'shooting-range',
    ]);
    expect(
      Object.fromEntries(
        catalog.map((facility) => [facility.type, facility.effectLabel]),
      ),
    ).toMatchObject({
      'training-pitch': '+12 TP per level +10% DEF Training',
      'coaching-office': 'Unlock Assistant Coach',
      'fan-shop': '+$$$ Merchandise sales multiplier. Scales with Fans.',
      'stadium-stand': '+50% home gate income',
      'medical-bay': 'Recovery -1 week',
      dorm: '+4 condition recovery weekly',
      'scout-office': '3 names per mission',
    });
  });

  test('offers only the Training Pitch for the guided first facility', () => {
    const initial = createCareer(createLaunchCareerSetup(20260805));
    const openingCatalog = clubFinancesViewModel(initial).facilities.catalog;

    expect(
      openingCatalog.find((entry) => entry.type === 'training-pitch'),
    ).toMatchObject({
      affordable: true,
      blockedByOpeningTrainingPitch: false,
    });
    expect(openingCatalog.find((entry) => entry.type === 'gym')).toMatchObject({
      affordable: false,
      blockedByOpeningTrainingPitch: true,
      blockedReason: 'Build the Training Pitch first.',
    });
    expect(
      clubFinancesViewModel({
        ...initial,
        assistantMode: 'advisor',
      }).facilities.catalog.find((entry) => entry.type === 'gym'),
    ).toMatchObject({ affordable: true, blockedByOpeningTrainingPitch: false });

    const pitchProject = buildCareerFacility(initial, 'training-pitch', {
      x: 0,
      y: 0,
    }).state;
    const pitchReady = {
      ...pitchProject,
      facilities: {
        ...pitchProject.facilities,
        grid: finishConstruction(pitchProject.facilities.grid!),
      },
    };
    expect(
      clubFinancesViewModel(pitchReady).facilities.catalog.find(
        (entry) => entry.type === 'gym',
      ),
    ).toMatchObject({ affordable: true, blockedByOpeningTrainingPitch: false });
  });

  test('shows newest M2 purchases separately from the weekly statement', () => {
    const initial = createCareer(createLaunchCareerSetup(20260719));
    const building = buildCareerFacility(initial, 'gym', { x: 2, y: 0 }).state;
    const built = {
      ...building,
      facilities: {
        ...building.facilities,
        grid: finishConstruction(building.facilities.grid!),
      },
    };
    const moved = relocateCareerFacility(built, 'facility-1', {
      x: 2,
      y: 2,
    }).state;

    const viewModel = clubFinancesViewModel(moved);

    expect(viewModel.ledger).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Gym construction started' }),
      ]),
    );
    expect(viewModel.recentTransactions).toEqual([
      expect.objectContaining({
        periodLabel: 'S1 · W1',
        label: 'Relocated Gym',
        amount: -350,
        balanceAfter: 45_650,
      }),
      expect.objectContaining({
        label: 'Gym construction started',
        amount: -7_000,
        balanceAfter: 46_000,
      }),
    ]);
    expect(moved.ledgers).toHaveLength(0);
  });

  test('projects recurring commitments instead of replaying a one-off statement', () => {
    const initial = createCareer(createLaunchCareerSetup(20260720));
    const withOneOffStatement = {
      ...initial,
      ledgers: [
        {
          season: 1,
          week: 1,
          lines: [
            {
              kind: 'prize' as const,
              label: 'One-off cup prize',
              amount: 99_999,
            },
          ],
          balanceAfter: initial.clubs.find(
            (club) => club.id === initial.userClubId,
          )!.cash,
        },
      ],
    };

    const viewModel = clubFinancesViewModel(withOneOffStatement);

    expect(viewModel.ledger).toEqual([
      expect.objectContaining({ label: 'One-off cup prize', amount: 99_999 }),
    ]);
    expect(viewModel.weeklyNet).not.toBe(99_999);
    expect(viewModel.projectedBalance).toBe(
      viewModel.resources.money + viewModel.weeklyNet,
    );
  });

  test('projects four weeks with home gates, away no-gate weeks, Cup gates, and sponsor cadence', () => {
    const initial = createCareer(createLaunchCareerSetup(20260728));
    const opponent = initial.clubs.find(
      (club) => club.id !== initial.userClubId,
    )!;
    const fixture = (
      id: string,
      week: number,
      homeClubId: string,
      awayClubId: string,
    ) => ({
      id,
      season: 1,
      round: week,
      week,
      homeClubId,
      awayClubId,
      matchSeed: week,
      status: 'scheduled' as const,
    });
    const cup = initial.m2!.nationalCups.find(
      (candidate) => candidate.season === 1,
    )!;
    const firstRound = cup.rounds[0];
    const cupFixture = firstRound.fixtures.find(
      (candidate) =>
        candidate.homeClubId === initial.userClubId ||
        candidate.awayClubId === initial.userClubId,
    )!;
    const state = {
      ...initial,
      week: 3,
      fixtures: [
        fixture('home-w3', 3, initial.userClubId, opponent.id),
        fixture('away-w4', 4, opponent.id, initial.userClubId),
      ],
      m2: {
        ...initial.m2!,
        nationalCups: [
          {
            ...cup,
            rounds: [
              {
                ...firstRound,
                fixtures: firstRound.fixtures.map((candidate) =>
                  candidate.id === cupFixture.id
                    ? {
                        ...candidate,
                        homeClubId: initial.userClubId,
                        awayClubId: opponent.id,
                      }
                    : candidate,
                ),
              },
            ],
          },
        ],
      },
    };

    const viewModel = clubFinancesViewModel(state);
    const baseline = viewModel.weeklyNet;

    expect(viewModel.operatingOutlook.weeks).toEqual([
      expect.objectContaining({
        periodLabel: 'S1 · W3',
        detail: 'Home league gate',
        net: baseline + 1_200,
      }),
      expect.objectContaining({
        periodLabel: 'S1 · W4',
        detail: 'Away league game · no gate · Advertising payment',
        net: baseline + 3_000,
      }),
      expect.objectContaining({
        periodLabel: 'S1 · W5',
        detail: 'No match or advertising payment',
        net: baseline,
      }),
      expect.objectContaining({
        periodLabel: 'S1 · W6',
        detail: 'Home Hero Cup gate',
        net: baseline + 1_200,
      }),
    ]);
    expect(viewModel.operatingOutlook.net).toBe(baseline * 4 + 5_400);
    expect(viewModel.operatingOutlook.projectedBalance).toBe(
      viewModel.resources.money + viewModel.operatingOutlook.net,
    );
  });

  /**
   * The outlook must follow the contracts, not the division. A club relegated
   * from D4 keeps its managed portfolio, so a division test would tell it its
   * real sponsors were pitchside boards.
   */
  test('keeps sponsor wording in the outlook once managed contracts exist', () => {
    const initial = createCareer(createLaunchCareerSetup(20260806));
    const contract: SponsorContractSnapshot = {
      contractId: 'test-slot0',
      sponsorContentId: 'continuity',
      sponsorName: 'Test Sponsor',
      offerLine: 'Test terms.',
      season: 1,
      slot: 0,
      nominalMonthlyFee: 4_000,
      provisional: false,
    };
    const managed = {
      ...initial,
      clubBusiness: {
        ...initial.clubBusiness,
        sponsorship: {
          activeContracts: [contract],
          offers: [],
          portfolioSeason: 1,
        },
      },
    };

    const details = clubFinancesViewModel(managed)
      .operatingOutlook.weeks.map((week) => week.detail)
      .join(' | ');
    expect(details).toContain('Sponsor payment');
    expect(details).not.toContain('dvertising');
  });

  /**
   * A home gate is the club's largest income and exists only as a ledger line,
   * so a one-week statement window made it unreadable the moment the next week
   * settled. The window keeps the last four weeks, newest first.
   */
  test('keeps four settled weeks on the statement, newest first, each line dated', () => {
    const initial = createCareer(createLaunchCareerSetup(20260725));
    const week = (number: number) => ({
      season: 1,
      week: number,
      lines: [
        {
          kind: 'tickets' as const,
          label: 'League home gate',
          amount: 100 * number,
        },
        { kind: 'wages' as const, label: 'Weekly wages', amount: -50 },
      ],
      balanceAfter: 1_000,
    });
    const fiveWeeks = {
      ...initial,
      week: 6,
      ledgers: [1, 2, 3, 4, 5].map(week),
    };

    const viewModel = clubFinancesViewModel(fiveWeeks);

    // Five settled, four shown: week 1 has aged out.
    expect(viewModel.ledger).toHaveLength(8);
    expect(viewModel.ledger[0]).toMatchObject({
      periodLabel: 'S1 · W5',
      label: 'League home gate',
      amount: 500,
      kind: 'income',
    });
    expect(viewModel.ledger.at(-1)).toMatchObject({
      periodLabel: 'S1 · W2',
      label: 'Weekly wages',
      kind: 'expense',
    });
    expect(viewModel.ledger.map((line) => line.periodLabel)).toEqual([
      'S1 · W5',
      'S1 · W5',
      'S1 · W4',
      'S1 · W4',
      'S1 · W3',
      'S1 · W3',
      'S1 · W2',
      'S1 · W2',
    ]);
    expect(new Set(viewModel.ledger.map((line) => line.id)).size).toBe(8);
  });

  /**
   * `weeklyNet` cannot forecast a gate, a four-weekly sponsor fee or a season
   * prize, so the panel reports what those three actually banked. A zero needs
   * its reason attached or it reads as a broken number.
   */
  test('reports banked match, sponsor and prize income and explains a zero', () => {
    const initial = createCareer(createLaunchCareerSetup(20260726));
    const settled = (
      lines: {
        kind: 'tickets' | 'sponsor' | 'prize' | 'wages';
        label: string;
        amount: number;
      }[],
    ) => ({
      ...initial,
      week: 2,
      ledgers: [{ season: 1, week: 1, lines, balanceAfter: 1_000 }],
    });

    expect(
      clubFinancesViewModel(
        settled([
          { kind: 'tickets', label: 'League home gate', amount: 2_040 },
          {
            kind: 'sponsor',
            label: 'Local advertising (monthly)',
            amount: 600,
          },
          { kind: 'wages', label: 'Weekly wages', amount: -1_180 },
        ]),
      ).variableIncome,
    ).toEqual({ amount: 2_640 });

    // Away in the settled week: no gate line exists at all, and the screen says why.
    const awayFixture = initial.fixtures.find(
      (fixture) => fixture.awayClubId === initial.userClubId,
    )!;
    const away = settled([
      { kind: 'wages', label: 'Weekly wages', amount: -1_180 },
    ]);
    expect(
      clubFinancesViewModel({
        ...away,
        fixtures: [{ ...awayFixture, season: 1, week: 1 }],
      }).variableIncome,
    ).toEqual({ amount: 0, detail: 'away game' });

    // The league calendar opens with two fixture-free weeks, and a settled week
    // with no fixture at all must not read as a bare zero either.
    expect(
      clubFinancesViewModel({
        ...settled([{ kind: 'wages', label: 'Weekly wages', amount: -1_180 }]),
        fixtures: [],
      }).variableIncome,
    ).toEqual({ amount: 0, detail: 'no match' });

    // Before the first week settles there is nothing to report yet.
    expect(clubFinancesViewModel(initial).variableIncome).toEqual({
      amount: 0,
      detail: 'no match',
    });
  });

  test('puts the club fan count on the finances panel', () => {
    const initial = createCareer(createLaunchCareerSetup(20260727));
    const club = initial.clubs.find(
      (candidate) => candidate.id === initial.userClubId,
    )!;

    expect(clubFinancesViewModel(initial).fans).toBe(club.fans);
    expect(club.fans).toBeGreaterThan(0);
  });

  test('advertises and projects the smaller Chairman Season-1 wage subsidy', () => {
    const chairman = createCareer(
      createLaunchCareerSetup(20260721, undefined, undefined, 'CHAIRMAN'),
    );

    const viewModel = clubFinancesViewModel(chairman);
    const userClub = chairman.clubs.find(
      (club) => club.id === chairman.userClubId,
    )!;

    expect(viewModel.wageSubsidyLabel).toBe(
      'Season 1 support covers 40% of weekly wages',
    );
    expect(viewModel.ledger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Season 1 wage subsidy' }),
      ]),
    );
    expect(viewModel.weeklyNet).toBe(
      -userClub.weeklyWages + Math.floor((userClub.weeklyWages * 40) / 100),
    );
  });

  test('describes facility effects, affordability, and the exact buildings in an active combo', () => {
    const initial = createCareer(createLaunchCareerSetup(20260720));
    const gymProject = buildCareerFacility(initial, 'gym', {
      x: 2,
      y: 0,
    }).state;
    const gym = {
      ...gymProject,
      facilities: {
        ...gymProject.facilities,
        grid: finishConstruction(gymProject.facilities.grid!),
      },
    };
    const dormProject = buildCareerFacility(gym, 'dorm', { x: 3, y: 0 }).state;
    const paired = {
      ...dormProject,
      facilities: {
        ...dormProject.facilities,
        grid: finishConstruction(dormProject.facilities.grid!),
      },
    };
    const broke = {
      ...paired,
      clubs: paired.clubs.map((club) =>
        club.id === paired.userClubId ? { ...club, cash: 0 } : club,
      ),
    };

    const viewModel = clubFinancesViewModel(broke);
    const gymBuilding = viewModel.facilities.buildings.find(
      (building) => building.type === 'gym',
    );
    const dormBuilding = viewModel.facilities.buildings.find(
      (building) => building.type === 'dorm',
    );
    const d5Gym = clubFinancesViewModel(gym).facilities.buildings.find(
      (building) => building.type === 'gym',
    );

    expect(viewModel.facilities.catalog).toHaveLength(12);
    expect(
      viewModel.facilities.catalog.every(
        (entry) => entry.effectLabel.length > 0,
      ),
    ).toBe(true);
    // A funded D5 club can upgrade to level 2 without a promotion.
    expect(d5Gym).toMatchObject({ canUpgrade: true });
    expect(d5Gym?.upgradeBlockedReason).toBeUndefined();
    expect(viewModel.facilities.activeAdjacencies).toEqual(['gym-dorm']);
    expect(gymBuilding).toMatchObject({
      effectLabel: '+10% PAC + STA training',
      canUpgrade: false,
      upgradeShortfall: 9_000,
      canRelocate: false,
      relocationShortfall: 350,
      activeAdjacencyIds: ['gym-dorm'],
    });
    expect(dormBuilding?.activeAdjacencyIds).toEqual(['gym-dorm']);
    expect(
      viewModel.facilities.catalog.find((entry) => entry.type === 'fan-shop'),
    ).toMatchObject({
      builtCount: 0,
      buildLimit: 3,
      weeklyUpkeep: 40,
      affordable: false,
      affordabilityShortfall: 5_000,
    });
    expect(
      viewModel.facilities.catalog.find((entry) => entry.type === 'gym'),
    ).toMatchObject({
      builtCount: 1,
      buildLimit: 1,
      affordable: false,
      affordabilityShortfall: 0,
      blockedReason:
        'Already built. Select it on the grid to upgrade or move it.',
    });
  });

  test('shows income-building counts and disables the build card at three', () => {
    let state = createCareer(createLaunchCareerSetup(20260806));
    for (let index = 0; index < 3; index += 1) {
      const project = buildCareerFacility(state, 'fan-shop', {
        x: index,
        y: 0,
      }).state;
      state = {
        ...project,
        facilities: {
          ...project.facilities,
          grid: finishConstruction(project.facilities.grid!),
        },
      };
    }

    expect(
      clubFinancesViewModel(state).facilities.catalog.find(
        (entry) => entry.type === 'fan-shop',
      ),
    ).toMatchObject({
      builtCount: 3,
      buildLimit: 3,
      affordable: false,
      affordabilityShortfall: 0,
      blockedReason: 'Build limit reached · 3 of 3 built.',
    });
  });

  test('uses the real Training Pitch TP constant in catalog and active-building copy', () => {
    const initial = createCareer(createLaunchCareerSetup(20260804));
    const withPitch = buildCareerFacility(initial, 'training-pitch', {
      x: 0,
      y: 0,
    }).state;
    const viewModel = clubFinancesViewModel(withPitch);

    const expected = `+${TRAINING_PITCH_TP_PER_LEVEL} TP per level`;

    expect(
      viewModel.facilities.catalog.find(
        (entry) => entry.type === 'training-pitch',
      )?.effectLabel,
    ).toContain(expected);
    expect(
      viewModel.facilities.buildings.find(
        (building) => building.type === 'training-pitch',
      )?.effectLabel,
    ).toContain(expected);
  });

  /**
   * The outstanding loan balance used to exist on exactly one surface — the
   * `emergency-loan` inbox row — so a club could repay for thirty weeks with no
   * way to check what it still owed. The accounts office is where a debt goes.
   */
  test('shows what the emergency loan borrowed, what remains, and when it is paid', () => {
    const initial = createCareer(createLaunchCareerSetup(20260724));
    const loan = {
      originalAmount: 20_000,
      remainingBalance: 22_000,
      repaymentStartsSeason: 2,
      remainingWeeks: 30,
    };
    const borrowed = {
      ...initial,
      financialSafety: {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        loan,
      },
    };

    // Season 1: nothing is taken yet, so the screen says when it starts.
    expect(clubFinancesViewModel(borrowed).loan).toEqual({
      originalAmount: 20_000,
      remainingBalance: 22_000,
      scheduleLabel: 'Repayments begin',
      scheduleValue: 'Season 2',
      detail: expect.stringContaining('Season 2'),
    });

    // Season 2, part-way through: the countdown replaces the start date.
    const repaying = clubFinancesViewModel({
      ...borrowed,
      season: 2,
      financialSafety: {
        ...borrowed.financialSafety,
        loan: { ...loan, remainingBalance: 9_000, remainingWeeks: 12 },
      },
    });
    expect(repaying.loan).toMatchObject({
      originalAmount: 20_000,
      remainingBalance: 9_000,
      scheduleLabel: 'Weeks left',
      scheduleValue: '12',
    });

    // Cleared, and never taken: the same rule the inbox row uses.
    expect(
      clubFinancesViewModel({
        ...borrowed,
        financialSafety: {
          ...borrowed.financialSafety,
          loan: { ...loan, remainingBalance: 0, remainingWeeks: 0 },
        },
      }).loan,
    ).toBeUndefined();
    expect(clubFinancesViewModel(initial).loan).toBeUndefined();
  });

  test('puts the completed benefit on every facility construction notice model', () => {
    const initial = createCareer(createLaunchCareerSetup(20260722));
    const catalog = clubFinancesViewModel(initial).facilities.catalog;

    for (const entry of catalog) {
      const started = buildCareerFacility(initial, entry.type, {
        x: 2,
        y: 0,
      }).state;
      expect(
        clubFinancesViewModel(started).facilities.activeProject,
      ).toMatchObject({
        name: entry.name,
        benefitLabel: entry.effectLabel,
      });
    }
  });
});
