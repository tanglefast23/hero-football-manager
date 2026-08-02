import { createLaunchCareerSetup } from '../launch';
import { clubFinancesViewModel } from '../view-models';
import {
  advanceFacilityConstruction,
  buildCareerFacility,
  createCareer,
  relocateCareerFacility,
  type FacilityGridState,
} from '../../game';

function finishConstruction(grid: FacilityGridState): FacilityGridState {
  let next = grid;
  while (next.construction !== undefined) next = advanceFacilityConstruction(next).grid;
  return next;
}

describe('club finances immediate transaction history', () => {
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
    const moved = relocateCareerFacility(built, 'facility-1', { x: 2, y: 2 }).state;

    const viewModel = clubFinancesViewModel(moved);

    expect(viewModel.ledger).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Gym construction started' }),
    ]));
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
      ledgers: [{
        season: 1,
        week: 1,
        lines: [{ kind: 'prize' as const, label: 'One-off cup prize', amount: 99_999 }],
        balanceAfter: initial.clubs.find(club => club.id === initial.userClubId)!.cash,
      }],
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

  test('does not advertise or project the Cozy wage subsidy on Chairman difficulty', () => {
    const chairman = createCareer(createLaunchCareerSetup(
      20260721,
      undefined,
      undefined,
      'CHAIRMAN',
    ));

    const viewModel = clubFinancesViewModel(chairman);
    const userClub = chairman.clubs.find(club => club.id === chairman.userClubId)!;

    expect(viewModel.wageSubsidyLabel).toBeUndefined();
    expect(viewModel.ledger).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Season 1 wage subsidy' }),
    ]));
    expect(viewModel.weeklyNet).toBe(-userClub.weeklyWages);
  });

  test('describes facility effects, affordability, and the exact buildings in an active combo', () => {
    const initial = createCareer(createLaunchCareerSetup(20260720));
    const gymProject = buildCareerFacility(initial, 'gym', { x: 2, y: 0 }).state;
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
      clubs: paired.clubs.map(club => club.id === paired.userClubId
        ? { ...club, cash: 0 }
        : club),
    };

    const viewModel = clubFinancesViewModel(broke);
    const gymBuilding = viewModel.facilities.buildings.find(building => building.type === 'gym');
    const dormBuilding = viewModel.facilities.buildings.find(building => building.type === 'dorm');
    const d5Gym = clubFinancesViewModel(gym).facilities.buildings.find(
      building => building.type === 'gym',
    );

    expect(viewModel.facilities.catalog).toHaveLength(12);
    expect(viewModel.facilities.catalog.every(entry => entry.effectLabel.length > 0)).toBe(true);
    // A funded D5 club can upgrade to level 2 without a promotion.
    expect(d5Gym).toMatchObject({ canUpgrade: true });
    expect(d5Gym?.upgradeBlockedReason).toBeUndefined();
    expect(viewModel.facilities.activeAdjacencies).toEqual(['gym-dorm']);
    expect(gymBuilding).toMatchObject({
      effectLabel: '+25% PAC + STA training',
      canUpgrade: false,
      upgradeShortfall: 7_000,
      canRelocate: false,
      relocationShortfall: 350,
      activeAdjacencyIds: ['gym-dorm'],
    });
    expect(dormBuilding?.activeAdjacencyIds).toEqual(['gym-dorm']);
    expect(viewModel.facilities.catalog.find(entry => entry.type === 'fan-shop')).toMatchObject({
      weeklyUpkeep: 65,
      affordable: false,
      affordabilityShortfall: 5_000,
    });
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
      financialSafety: { consecutiveNegativeWeeks: 0, emergencyLoanUsed: true, loan },
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
    expect(clubFinancesViewModel({
      ...borrowed,
      financialSafety: {
        ...borrowed.financialSafety,
        loan: { ...loan, remainingBalance: 0, remainingWeeks: 0 },
      },
    }).loan).toBeUndefined();
    expect(clubFinancesViewModel(initial).loan).toBeUndefined();
  });

  test('puts the completed benefit on every facility construction notice model', () => {
    const initial = createCareer(createLaunchCareerSetup(20260722));
    const catalog = clubFinancesViewModel(initial).facilities.catalog;

    for (const entry of catalog) {
      const started = buildCareerFacility(initial, entry.type, { x: 2, y: 0 }).state;
      expect(clubFinancesViewModel(started).facilities.activeProject).toMatchObject({
        name: entry.name,
        benefitLabel: entry.effectLabel,
      });
    }
  });
});
