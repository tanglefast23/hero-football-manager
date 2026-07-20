import { createLaunchCareerSetup } from '../../application/launch';
import {
  advanceFacilityConstruction,
  buildCareerFacility,
  createCareer,
  relocateCareerFacility,
  upgradeCareerFacility,
} from '..';

describe('career facility transactions', () => {
  test('charges the user club and persists build, upgrade, and relocation state', () => {
    const initial = createCareer(createLaunchCareerSetup(20260719, undefined, undefined, 'full'));
    const built = buildCareerFacility(initial, 'gym', { x: 2, y: 0 });
    const builtReady = completeProject(built.state);
    const upgraded = upgradeCareerFacility(builtReady, 'facility-1');
    const upgradedReady = completeProject(upgraded.state);
    const moved = relocateCareerFacility(upgradedReady, 'facility-1', { x: 4, y: 3 });

    expect(initial.facilities.grid?.buildings).toEqual([]);
    expect(built.state.clubs.find(club => club.id === initial.userClubId)?.cash)
      .toBe(38_000);
    expect(upgraded.state.facilities.grid?.buildings[0].level).toBe(1);
    expect(upgradedReady.facilities.grid?.buildings[0].level).toBe(2);
    expect(moved.state.facilities.grid?.buildings[0]).toMatchObject({ x: 4, y: 3 });
    expect(moved.state.clubs.find(club => club.id === initial.userClubId)?.cash)
      .toBe(30_650);
    expect(moved.state.cashTransactions).toEqual([
      expect.objectContaining({
        id: 'cash-transaction-1',
        kind: 'facility-build',
        label: 'Gym construction started',
        amount: -7_000,
        balanceAfter: 38_000,
      }),
      expect.objectContaining({
        id: 'cash-transaction-2',
        kind: 'facility-upgrade',
        label: 'Gym Level 2 upgrade started',
        amount: -7_000,
        balanceAfter: 31_000,
      }),
      expect.objectContaining({
        id: 'cash-transaction-3',
        kind: 'facility-relocation',
        amount: -350,
        balanceAfter: 30_650,
      }),
    ]);
    expect(moved.state.ledgers).toHaveLength(0);
  });

  test('keeps M1 training-ground compatibility while storing the M2 grid', () => {
    const initial = createCareer(createLaunchCareerSetup(99));
    const built = buildCareerFacility(initial, 'training-pitch', { x: 0, y: 0 });

    expect(built.state.facilities.trainingGroundBuilt).toBe(false);
    expect(built.state.facilities.grid?.buildings[0].type).toBe('training-pitch');
    expect(built.state.facilities.grid?.construction).toMatchObject({ weeksRemaining: 1 });
    expect(built.state.cashTransactions).toBeUndefined();
  });
});

function completeProject(state: ReturnType<typeof createCareer>) {
  const grid = state.facilities.grid;
  if (grid === undefined) throw new Error('missing facility grid');
  let next = grid;
  while (next.construction !== undefined) next = advanceFacilityConstruction(next).grid;
  return {
    ...state,
    facilities: { ...state.facilities, grid: next },
  };
}
