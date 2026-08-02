import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homeViewModel } from '../../../../application/view-models';
import { protectBoardUltimatumPlayer } from '../../../../game/board-ultimatum';
import { difficultyRules } from '../../../../game/difficulty';
import type { GameState } from '../../../../game/types';

/**
 * Jest runs with `testEnvironment: 'node'` and no react-native preset, so the
 * real `react-native` module throws on require. The entry's fabrication is
 * plain TypeScript sitting in the same file as its component — these stubs are
 * what let the state builders be run at all, and nothing here renders.
 */
jest.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  Text: 'Text',
  View: 'View',
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../../screens/ClubHomeScreen', () => ({ ClubHomeScreen: () => null }));
jest.mock('../../DevHarnessControls', () => ({
  DevHarnessButton: () => null,
  devHarnessControlStyles: { row: {}, rowLabel: {} },
}));

// The mocks above are hoisted over these imports by the ts-jest transformer.
import {
  boardUltimatumCareer,
  boardUltimatumEntry,
  boardUltimatumNote,
  type BoardUltimatumCaseId,
} from '../board-ultimatum';

const OPTIONS = { weeksRemaining: 2, quietDesk: true } as const;

function career(caseId: BoardUltimatumCaseId): GameState {
  return boardUltimatumCareer(caseId, OPTIONS);
}

function userCash(state: GameState): number {
  const club = state.clubs.find(candidate => candidate.id === state.userClubId);
  if (club === undefined) throw new Error('the reel career has no user club');
  return club.cash;
}

describe('the board ultimatum reel', () => {
  it('registers one case per state of the escalation', () => {
    expect(boardUltimatumEntry.cases.map(entry => entry.id)).toEqual([
      'warning',
      'loan',
      'ultimatum',
      'survived',
      'forced-sale',
    ]);
    // Every case carries the line the menu row and the bar note are drawn from.
    expect(boardUltimatumEntry.cases.every(entry => (entry.note ?? '').length > 0)).toBe(true);
  });

  it('builds every case, deterministically', () => {
    for (const entry of boardUltimatumEntry.cases) {
      const caseId = entry.id as BoardUltimatumCaseId;
      expect(career(caseId)).toEqual(career(caseId));
    }
  });

  it('opens the warning with the club in the red and no intervention spent', () => {
    const state = career('warning');

    expect(userCash(state)).toBeLessThan(0);
    expect(state.financialSafety?.emergencyLoanUsed).toBe(false);
    expect(state.financialSafety?.boardUltimatum).toBeUndefined();
    expect(homeViewModel(state).alerts.map(alert => alert.id)).toContain('financial-warning');
  });

  it('draws the loan on the terms the weekly settlement writes', () => {
    const state = career('loan');
    const rules = difficultyRules(state);
    const loan = state.financialSafety?.loan;

    expect(state.financialSafety?.emergencyLoanUsed).toBe(true);
    expect(loan?.originalAmount).toBe(rules.emergencyLoanAmount);
    expect(loan?.remainingBalance).toBe(Math.ceil(rules.emergencyLoanAmount * 1.1));
    expect(loan?.repaymentStartsSeason).toBe(state.season + 1);
    expect(homeViewModel(state).alerts.map(alert => alert.id)).toContain('emergency-loan');
  });

  /**
   * The candidates are the point of the panel, and they come from the engine:
   * a hand-written list would prove only that the reel can draw four rows.
   */
  it('puts the engine’s own sale candidates on the block', () => {
    const state = career('ultimatum');
    const panel = homeViewModel(state).boardUltimatum;
    const rosterIds = new Set(state.players
      .filter(player => player.clubId === state.userClubId)
      .map(player => player.id));

    expect(panel?.weeksRemaining).toBe(OPTIONS.weeksRemaining);
    expect(panel?.candidates.length).toBeGreaterThanOrEqual(3);
    expect(panel?.candidates.every(candidate => rosterIds.has(candidate.playerId))).toBe(true);
    expect(panel?.candidates.every(candidate => candidate.forcedSaleFee < candidate.marketValue)).toBe(true);
    expect(panel?.protectedPlayerId).toBeUndefined();
  });

  it('lets the deadline be shortened without changing who is on the block', () => {
    const issued = boardUltimatumCareer('ultimatum', { ...OPTIONS, weeksRemaining: 4 });
    const lastWeek = boardUltimatumCareer('ultimatum', { ...OPTIONS, weeksRemaining: 1 });

    expect(issued.financialSafety?.boardUltimatum?.weeksRemaining).toBe(4);
    expect(lastWeek.financialSafety?.boardUltimatum?.weeksRemaining).toBe(1);
    expect(lastWeek.financialSafety?.boardUltimatum?.candidates)
      .toEqual(issued.financialSafety?.boardUltimatum?.candidates);
  });

  /** The reel's Protect tap is the shipped reducer, not a local copy of it. */
  it('protects a candidate through the real reducer', () => {
    const state = career('ultimatum');
    const target = state.financialSafety?.boardUltimatum?.candidates[1];
    if (target === undefined) throw new Error('the ultimatum has no second candidate');

    const protectedState = protectBoardUltimatumPlayer(state, target.playerId);

    expect(homeViewModel(protectedState).boardUltimatum?.protectedPlayerId).toBe(target.playerId);
    expect(() => protectBoardUltimatumPlayer(state, 'someone-else')).toThrow();
  });

  it('closes the intervention when the target was met', () => {
    const state = career('survived');
    const resolution = homeViewModel(state).boardResolution;

    expect(userCash(state)).toBeGreaterThanOrEqual(0);
    expect(state.financialSafety?.boardUltimatum).toBeUndefined();
    expect(resolution?.kind).toBe('TARGET_MET');
    expect(resolution?.soldPlayer).toBeUndefined();
  });

  /**
   * The forced sale is the one case that changes the squad, so it is the one
   * that can be built wrong and still render: the player has to have actually
   * left, and the academy replacement has to have actually arrived.
   */
  it('moves the sold player out and the replacement in', () => {
    const state = career('forced-sale');
    const resolution = state.financialSafety?.latestBoardResolution;
    if (resolution?.kind !== 'FORCED_SALE') throw new Error('the sold case has no forced sale');

    const sold = state.players.find(player => player.id === resolution.playerId);
    const replacement = state.players.find(player => player.id === resolution.replacementPlayerId);

    expect(sold?.clubId).toBe(resolution.buyerClubId);
    expect(replacement?.clubId).toBe(state.userClubId);
    expect(resolution.discountPercent).toBe(30);
    expect(userCash(state)).toBeGreaterThan(-Infinity);

    const panel = homeViewModel(state).boardResolution;
    expect(panel?.kind).toBe('FORCED_SALE');
    expect(panel?.soldPlayer?.id).toBe(resolution.playerId);
    expect(panel?.replacementPlayer?.id).toBe(resolution.replacementPlayerId);
  });

  /**
   * The note is the reel's instrument. `board rows n/m` is the measurement the
   * entry exists to take: the desk holds three items a week and the board's
   * rows are built last, so a busy desk drops them.
   */
  it('reports how many of the board’s own rows reached the desk', () => {
    expect(boardUltimatumNote(career('ultimatum'))).toContain('board rows');
    expect(boardUltimatumNote(career('ultimatum'))).toContain('on the block');

    const quiet = boardUltimatumCareer('ultimatum', { ...OPTIONS, quietDesk: true });
    const busy = boardUltimatumCareer('ultimatum', { ...OPTIONS, quietDesk: false });
    const boardRows = (state: GameState) => homeViewModel(state).alerts
      .filter(alert => alert.id === 'board-ultimatum' || alert.id === 'financial-warning')
      .length;

    expect(boardRows(quiet)).toBeGreaterThan(boardRows(busy));
  });

  /**
   * A function-form `style` on a Pressable drops layout properties on iOS and
   * collapses the control to nothing. The entry draws every control with
   * `DevHarnessButton`, which is where the 44pt minimum lives.
   */
  it('keeps its controls on the harness button', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/ui/dev-harness/entries/board-ultimatum.tsx'),
      'utf8',
    );

    expect(source).not.toContain('<Pressable');
    expect(source).not.toContain('style={({');
    expect(source).toContain('DevHarnessButton');
    // No audio cue: the management SFX table is index-addressed by eight tests.
    expect(source).not.toContain('Sfx');
  });
});
