import { createLaunchCareerSetup } from '../../application/launch';
import {
  advanceFacilityConstruction,
  buildCareerFacility,
  closeCareerFacility,
  closeStaffedCareerCoachingOffice,
  createCareer,
  staffedCoachingOfficeClosureConfirmation,
} from '..';
import type { GameState } from '../types';

describe('staffed Coaching Office closure', () => {
  test('the ordinary facility close rejects a staffed office without mutating it', () => {
    const staffed = staffedOffice(2_000, 4_000);
    const before = JSON.stringify(staffed);

    expect(() => closeCareerFacility(staffed, 'facility-1'))
      .toThrow('a staffed Coaching Office must dismiss its assistant and close together');
    expect(JSON.stringify(staffed)).toBe(before);
  });

  test('confirmation names the assistant and exposes severance, refund, net, and shortage', () => {
    const staffed = staffedOffice(500, 4_000);

    expect(staffedCoachingOfficeClosureConfirmation(staffed, 'facility-1')).toEqual({
      buildingId: 'facility-1',
      assistantId: staffed.market!.assistantCoach!.id,
      assistantName: staffed.market!.assistantCoach!.name,
      cashBefore: 500,
      severanceCost: 4_000,
      facilityRefund: 3_250,
      netCashEffect: -750,
      cashAfter: 0,
      shortage: 250,
      canConfirm: false,
    });
  });

  test('allows exact affordability when the office refund funds most of severance', () => {
    const staffed = staffedOffice(750, 4_000);
    const result = closeStaffedCareerCoachingOffice(staffed, 'facility-1');

    expect(result.confirmation).toMatchObject({
      cashBefore: 750,
      severanceCost: 4_000,
      facilityRefund: 3_250,
      netCashEffect: -750,
      cashAfter: 0,
      shortage: 0,
      canConfirm: true,
    });
    expect(userCash(result.state)).toBe(0);
    expect(result.state.facilities.grid?.buildings).toEqual([]);
    expect(result.state.market?.assistantCoach).toBeUndefined();
  });

  test('allows cash below severance when combined funds are sufficient', () => {
    const staffed = staffedOffice(1_000, 4_000);
    const result = closeStaffedCareerCoachingOffice(staffed, 'facility-1');

    expect(userCash(result.state)).toBe(250);
    expect(result.state.facilities.grid?.buildings).toEqual([]);
    expect(result.state.market?.assistantCoach).toBeUndefined();
    expect(result.state.cashTransactions?.slice(-2)).toEqual([
      expect.objectContaining({
        kind: 'facility-closure',
        label: 'Closed Coaching Office',
        amount: 3_250,
        balanceAfter: 4_250,
        referenceId: 'facility-1',
      }),
      expect.objectContaining({
        kind: 'coach-dismissal',
        label: `Severance · ${staffed.market!.assistantCoach!.name}`,
        amount: -4_000,
        balanceAfter: 250,
        referenceId: staffed.market!.assistantCoach!.id,
      }),
    ]);
  });

  test('reports the exact shortage and leaves every field untouched when insufficient', () => {
    const staffed = staffedOffice(500, 4_000);
    const before = JSON.stringify(staffed);

    expect(() => closeStaffedCareerCoachingOffice(staffed, 'facility-1'))
      .toThrow('the club needs $250 more to cover assistant severance after the Coaching Office refund');
    expect(JSON.stringify(staffed)).toBe(before);
  });

  test('does not route an empty office or another facility through the staffed close', () => {
    const staffed = staffedOffice(2_000, 4_000);
    const empty = {
      ...staffed,
      market: {
        ...staffed.market!,
        assistantCoach: undefined,
        assistantCoachSeasonsEmployed: undefined,
      },
    };

    expect(() => closeStaffedCareerCoachingOffice(empty, 'facility-1'))
      .toThrow('does not have an assistant');

    const initial = createCareer(createLaunchCareerSetup(20260806));
    const gym = completeProject(buildCareerFacility(initial, 'gym', { x: 2, y: 0 }).state);
    const withAssistant = {
      ...gym,
      market: staffed.market,
    };
    expect(() => closeStaffedCareerCoachingOffice(withAssistant, 'facility-1'))
      .toThrow('is not a Coaching Office');
  });
});

function staffedOffice(cash: number, severanceCost: number): GameState {
  const initial = createCareer(createLaunchCareerSetup(20260805));
  const office = completeProject(
    buildCareerFacility(initial, 'coaching-office', { x: 2, y: 0 }).state,
  );
  const assistant = office.market!.coachCandidates.find(candidate => (
    candidate.requiredDivision === 5
  ));
  if (assistant === undefined) throw new Error('missing D5 assistant fixture');
  return {
    ...office,
    clubs: office.clubs.map(club => club.id === office.userClubId
      ? { ...club, cash }
      : club),
    market: {
      ...office.market!,
      assistantCoach: { ...assistant, weeklyWage: severanceCost },
      assistantCoachSeasonsEmployed: 0,
      coachCandidates: office.market!.coachCandidates.filter(candidate => (
        candidate.id !== assistant.id
      )),
    },
  };
}

function completeProject(state: GameState): GameState {
  const grid = state.facilities.grid;
  if (grid === undefined) throw new Error('missing facility grid');
  let next = grid;
  while (next.construction !== undefined) {
    next = advanceFacilityConstruction(next).grid;
  }
  return { ...state, facilities: { ...state.facilities, grid: next } };
}

function userCash(state: GameState): number {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error('missing user club');
  return club.cash;
}
