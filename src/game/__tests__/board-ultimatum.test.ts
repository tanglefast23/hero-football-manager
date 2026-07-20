import { createLaunchCareerSetup } from '../../application/launch';
import {
  applyBoardForcedSaleConsequences,
  boardForcedSaleAtDeadline,
  clearMetBoardUltimatum,
  createBoardUltimatum,
  protectBoardUltimatumPlayer,
} from '../board-ultimatum';
import { createCareer } from '../career';
import { buildCareerTeamDef } from '../squad';

function career(seed: number) {
  return createCareer(createLaunchCareerSetup(seed, undefined, undefined, 'full'));
}

describe('board ultimatum domain', () => {
  test('creates a byte-identical visible list of four discounted safe candidates', () => {
    const state = career(9501);
    const first = createBoardUltimatum(state)!;
    const second = createBoardUltimatum(JSON.parse(JSON.stringify(state)) as typeof state)!;

    expect(first).toEqual(second);
    expect(first.weeksRemaining).toBe(4);
    expect(first.targetCash).toBe(0);
    expect(first.candidates).toHaveLength(4);
    expect(new Set(first.candidates.map(candidate => candidate.playerId)).size).toBe(4);
    expect(first.candidates.every(candidate => (
      candidate.discountPercent === 30
      && candidate.forcedSaleFee > 0
      && candidate.forcedSaleFee < candidate.marketValue
    ))).toBe(true);
  });

  test('protects exactly one visible candidate and never selects them at the deadline', () => {
    const state = career(9502);
    const ultimatum = createBoardUltimatum(state)!;
    const withUltimatum = {
      ...state,
      financialSafety: {
        consecutiveNegativeWeeks: 4,
        emergencyLoanUsed: true,
        boardUltimatum: ultimatum,
      },
    };
    const protectedId = ultimatum.candidates[0].playerId;
    const protectedState = protectBoardUltimatumPlayer(withUltimatum, protectedId);
    const resolution = boardForcedSaleAtDeadline(
      protectedState,
      protectedState.financialSafety!.boardUltimatum!,
    )!;

    expect(protectedState.financialSafety?.boardUltimatum?.protectedPlayerId).toBe(protectedId);
    expect(resolution.playerId).not.toBe(protectedId);
    expect(ultimatum.candidates.map(candidate => candidate.playerId)).toContain(resolution.playerId);
    expect(() => protectBoardUltimatumPlayer(withUltimatum, 'not-visible'))
      .toThrow('visible board candidates');
  });

  test('applies the exact stored sale with payroll, lineup, morale, and fan consequences', () => {
    const state = career(9503);
    const ultimatum = createBoardUltimatum(state)!;
    const resolution = boardForcedSaleAtDeadline(state, ultimatum)!;
    const player = state.players.find(candidate => candidate.id === resolution.playerId)!;
    const userClub = state.clubs.find(club => club.id === state.userClubId)!;
    const buyer = state.clubs.find(club => club.id === resolution.buyerClubId)!;
    const next = applyBoardForcedSaleConsequences(state, resolution);

    expect(next.players.find(candidate => candidate.id === player.id)?.clubId)
      .toBe(buyer.id);
    expect(next.clubs.find(club => club.id === state.userClubId)).toMatchObject({
      fans: userClub.fans - resolution.fansLost,
      weeklyWages: userClub.weeklyWages - player.weeklyWage
        + next.players.find(candidate => candidate.id === resolution.replacementPlayerId)!.weeklyWage,
    });
    expect(next.clubs.find(club => club.id === buyer.id)).toMatchObject({
      cash: buyer.cash - resolution.fee,
      weeklyWages: buyer.weeklyWages + player.weeklyWage,
    });
    expect(next.players.filter(candidate => (
      candidate.clubId === state.userClubId
      && candidate.id !== resolution.replacementPlayerId
    ))
      .every(candidate => candidate.morale === 42)).toBe(true);
    expect(next.players.find(candidate => candidate.id === resolution.replacementPlayerId))
      .toMatchObject({ clubId: state.userClubId, role: player.role, age: 17, weeklyWage: expect.any(Number) });
    expect(next.players.find(candidate => candidate.id === resolution.replacementPlayerId)?.lookId)
      .toMatch(new RegExp(`^${player.role === 'GK' ? 'g' : 'f'}\\d+$`));
    expect(next.players.filter(candidate => candidate.clubId === state.userClubId)).toHaveLength(16);
    expect(() => buildCareerTeamDef(next, state.userClubId)).not.toThrow();
  });

  test('clears an active target immediately when current cash reaches it', () => {
    const state = career(9504);
    const ultimatum = { ...createBoardUltimatum(state)!, targetCash: 1_000 };
    const below = {
      ...state,
      clubs: state.clubs.map(club => club.id === state.userClubId
        ? { ...club, cash: 999 }
        : club),
      financialSafety: {
        consecutiveNegativeWeeks: 0,
        emergencyLoanUsed: true,
        boardUltimatum: ultimatum,
      },
    };
    const met = {
      ...below,
      clubs: below.clubs.map(club => club.id === state.userClubId
        ? { ...club, cash: 1_000 }
        : club),
    };

    expect(clearMetBoardUltimatum(below)).toBe(below);
    const clearedSafety = clearMetBoardUltimatum(met).financialSafety;
    expect(clearedSafety?.boardUltimatum).toBeUndefined();
    expect(clearedSafety).toMatchObject({
      latestBoardResolution: { kind: 'TARGET_MET', targetCash: 1_000 },
    });
  });
});
