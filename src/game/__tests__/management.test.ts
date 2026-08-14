import { createLaunchCareerSetup } from '../../application/launch';
import {
  BASE_WEEKLY_TRAINING_POINTS,
  TRAINING_PITCH_TP_PER_LEVEL,
  advanceFacilityConstruction,
  buildCareerFacility,
  closeCareerFacility,
  createCareer,
  relocateCareerFacility,
  upgradeCareerFacility,
  weeklyAmbientTrainingPoints,
} from '..';

describe('career facility transactions', () => {
  test('allows facility work before a match, including Hero Cup weeks', () => {
    const matchday = {
      ...createCareer(createLaunchCareerSetup(20260809)),
      phase: 'matchday' as const,
    };

    const built = buildCareerFacility(matchday, 'gym', { x: 2, y: 0 });

    expect(built.state.phase).toBe('matchday');
    expect(built.state.facilities.grid?.buildings).toEqual([
      expect.objectContaining({ type: 'gym', x: 2, y: 0 }),
    ]);
  });

  test('charges the user club and persists build, upgrade, and relocation state', () => {
    const initial = createCareer(createLaunchCareerSetup(20260719));
    const built = buildCareerFacility(initial, 'gym', { x: 2, y: 0 });
    const builtReady = completeProject(built.state);
    const levelTwoUnlocked = {
      ...builtReady,
      m2: { ...builtReady.m2!, highestDivisionReached: 4 as const },
    };
    const upgraded = upgradeCareerFacility(levelTwoUnlocked, 'facility-1');
    const upgradedReady = completeProject(upgraded.state);
    const moved = relocateCareerFacility(upgradedReady, 'facility-1', {
      x: 4,
      y: 3,
    });

    expect(initial.facilities.grid?.buildings).toEqual([]);
    expect(
      built.state.clubs.find((club) => club.id === initial.userClubId)?.cash,
    ).toBe(46_000);
    expect(built.state.facilities.grid?.buildings[0].capitalInvested).toBe(
      7_000,
    );
    expect(
      upgraded.state.facilities.grid?.buildings.find(
        (building) => building.id === 'facility-1',
      )?.level,
    ).toBe(1);
    expect(
      upgraded.state.facilities.grid?.buildings.find(
        (building) => building.id === 'facility-1',
      )?.capitalInvested,
    ).toBe(25_000);
    expect(
      upgradedReady.facilities.grid?.buildings.find(
        (building) => building.id === 'facility-1',
      )?.level,
    ).toBe(2);
    expect(
      moved.state.facilities.grid?.buildings.find(
        (building) => building.id === 'facility-1',
      ),
    ).toMatchObject({ capitalInvested: 25_000, x: 4, y: 3 });
    expect(
      moved.state.clubs.find((club) => club.id === initial.userClubId)?.cash,
    ).toBe(27_650);
    expect(moved.state.cashTransactions).toEqual([
      expect.objectContaining({
        id: 'cash-transaction-1',
        kind: 'facility-build',
        label: 'Gym construction started',
        amount: -7_000,
        balanceAfter: 46_000,
      }),
      expect.objectContaining({
        id: 'cash-transaction-2',
        kind: 'facility-upgrade',
        label: 'Gym Level 2 upgrade started',
        amount: -18_000,
        balanceAfter: 28_000,
      }),
      expect.objectContaining({
        id: 'cash-transaction-3',
        kind: 'facility-relocation',
        amount: -350,
        balanceAfter: 27_650,
      }),
    ]);
    expect(moved.state.ledgers).toHaveLength(0);
  });

  test('gates new facility levels by the best division reached', () => {
    const initial = createCareer(createLaunchCareerSetup(20260720));
    const built = completeProject(
      buildCareerFacility(initial, 'gym', { x: 2, y: 0 }).state,
    );

    // Level 2 needs no promotion: it is the club's main training accelerator,
    // so a D5 club can reach it. Only level 3 is still a promotion reward.
    const levelTwo = completeProject(
      upgradeCareerFacility(built, 'facility-1').state,
    );
    expect(
      levelTwo.facilities.grid?.buildings.find(
        (building) => building.id === 'facility-1',
      )?.level,
    ).toBe(2);
    expect(() => upgradeCareerFacility(levelTwo, 'facility-1')).toThrow(
      'Level 3 facilities unlock in D2 · National League',
    );

    const d2 = {
      ...levelTwo,
      clubs: levelTwo.clubs.map((club) =>
        club.id === levelTwo.userClubId ? { ...club, cash: 100_000 } : club,
      ),
      m2: { ...levelTwo.m2!, highestDivisionReached: 2 as const },
    };
    const levelThree = completeProject(
      upgradeCareerFacility(d2, 'facility-1').state,
    );
    expect(
      levelThree.facilities.grid?.buildings.find(
        (building) => building.id === 'facility-1',
      )?.level,
    ).toBe(3);
  });

  test('credits half the investment back on closing and logs it as one off', () => {
    const initial = createCareer(createLaunchCareerSetup(20260803));
    const built = completeProject(
      buildCareerFacility(initial, 'gym', { x: 2, y: 0 }).state,
    );
    const cashBefore = built.clubs.find(
      (club) => club.id === initial.userClubId,
    )!.cash;
    const closed = closeCareerFacility(built, 'facility-1');

    expect(closed.state.facilities.grid?.buildings).toEqual([]);
    expect(
      closed.state.clubs.find((club) => club.id === initial.userClubId)?.cash,
    ).toBe(cashBefore + 3_500);
    expect(closed.state.cashTransactions?.at(-1)).toMatchObject({
      kind: 'facility-closure',
      label: 'Closed Gym',
      amount: 3_500,
    });
    // The Training Pitch is what earns TP, so closing it has to take the flag
    // down with it or a demolished pitch keeps paying. `completeProject` only
    // runs the crew off the board; the weekly settlement is what raises the
    // flag, so it is set here the way an advanced week would leave it.
    const advanced = completeProject(
      buildCareerFacility(initial, 'training-pitch', { x: 0, y: 0 }).state,
    );
    const pitch = {
      ...advanced,
      facilities: { ...advanced.facilities, trainingGroundBuilt: true },
    };
    expect(weeklyAmbientTrainingPoints(pitch)).toBe(
      BASE_WEEKLY_TRAINING_POINTS + TRAINING_PITCH_TP_PER_LEVEL,
    );
    const demolished = closeCareerFacility(pitch, 'facility-1').state;
    expect(demolished.facilities.trainingGroundBuilt).toBe(false);
    expect(weeklyAmbientTrainingPoints(demolished)).toBe(
      BASE_WEEKLY_TRAINING_POINTS,
    );
  });

  test('stores the grid build behind its construction weeks and logs the spend', () => {
    const initial = createCareer(createLaunchCareerSetup(99));
    const built = buildCareerFacility(initial, 'training-pitch', {
      x: 0,
      y: 0,
    });

    expect(built.state.facilities.trainingGroundBuilt).toBe(false);
    expect(built.state.facilities.grid?.buildings[0].type).toBe(
      'training-pitch',
    );
    expect(built.state.facilities.grid?.buildings[0].capitalInvested).toBe(
      8_000,
    );
    expect(built.state.facilities.grid?.construction).toMatchObject({
      weeksRemaining: 2,
    });
    expect(built.state.cashTransactions).toMatchObject([
      {
        kind: 'facility-build',
        label: 'Training Pitch construction started',
        amount: -8000,
      },
    ]);
  });
});

function completeProject(state: ReturnType<typeof createCareer>) {
  const grid = state.facilities.grid;
  if (grid === undefined) throw new Error('missing facility grid');
  let next = grid;
  while (next.construction !== undefined)
    next = advanceFacilityConstruction(next).grid;
  return {
    ...state,
    facilities: { ...state.facilities, grid: next },
  };
}
