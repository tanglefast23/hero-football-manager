import { createLaunchCareerSetup } from '../launch';
import { clubFinancesViewModel } from '../view-models';
import { advanceFacilityConstruction, buildCareerFacility, createCareer, relocateCareerFacility } from '../../game';

describe('club finances immediate transaction history', () => {
  test('shows newest M2 purchases separately from the weekly statement', () => {
    const initial = createCareer(createLaunchCareerSetup(20260719, undefined, undefined, 'full'));
    const building = buildCareerFacility(initial, 'gym', { x: 0, y: 0 }).state;
    const built = {
      ...building,
      facilities: {
        ...building.facilities,
        grid: advanceFacilityConstruction(building.facilities.grid!).grid,
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
        balanceAfter: 37_650,
      }),
      expect.objectContaining({
        label: 'Gym construction started',
        amount: -7_000,
        balanceAfter: 38_000,
      }),
    ]);
    expect(moved.ledgers).toHaveLength(0);
  });

  test('projects recurring commitments instead of replaying a one-off statement', () => {
    const initial = createCareer(createLaunchCareerSetup(20260720, undefined, undefined, 'full'));
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

  test('describes facility effects, affordability, and the exact buildings in an active combo', () => {
    const initial = createCareer(createLaunchCareerSetup(20260720, undefined, undefined, 'full'));
    const gymProject = buildCareerFacility(initial, 'gym', { x: 0, y: 0 }).state;
    const gym = {
      ...gymProject,
      facilities: {
        ...gymProject.facilities,
        grid: advanceFacilityConstruction(gymProject.facilities.grid!).grid,
      },
    };
    const dormProject = buildCareerFacility(gym, 'dorm', { x: 1, y: 0 }).state;
    const paired = {
      ...dormProject,
      facilities: {
        ...dormProject.facilities,
        grid: advanceFacilityConstruction(dormProject.facilities.grid!).grid,
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
    expect(d5Gym).toMatchObject({
      canUpgrade: false,
      upgradeBlockedReason: 'Level 2 facilities unlock in D4 · County League.',
    });
    expect(viewModel.facilities.activeAdjacencies).toEqual(['gym-dorm']);
    expect(gymBuilding).toMatchObject({
      effectLabel: 'Level 1: no PAC + STA bonus · upgrades add +50%/+100%',
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
});
