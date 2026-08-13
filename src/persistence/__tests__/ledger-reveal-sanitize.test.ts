import { parseStoredGameState, serializeGameState } from '../game-state-codec';
import {
  activeCareerMatchday,
  advanceWeek,
  completeMatchday,
  createCareer,
} from '../../game/career';
import type { GameState, LedgerLine } from '../../game/types';
import { createLaunchCareerSetup } from '../../application/launch';

/** A settled career whose stored JSON has at least one ledger to patch. */
function storedCareer(): Record<string, unknown> & {
  ledgers: { lines: unknown[] }[];
} {
  let state: GameState = createCareer(createLaunchCareerSetup(31337));
  state = advanceWeek(state);
  while (state.phase === 'matchday') {
    const matchday = activeCareerMatchday(state)!;
    state = completeMatchday(
      state,
      matchday.fixtures.map((fixture) => ({
        fixtureId: fixture.id,
        homeGoals: 0,
        awayGoals: 0,
      })),
    );
  }
  const stored = JSON.parse(serializeGameState(state));
  if (!Array.isArray(stored.ledgers) || stored.ledgers.length === 0) {
    throw new Error('expected at least one settled ledger');
  }
  return stored;
}

/** Reconstructs exactly: 1000 + floor(1000 × (200-100)/100) = 2000. */
function gateLine(
  revealOverrides: Partial<Record<string, unknown>> = {},
  lineOverrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    kind: 'tickets',
    label: 'League home gate',
    amount: 2000,
    reveal: {
      source: 'league-gate',
      base: 1000,
      variancePercent: -7,
      surge: false,
      multiplierPercent: 200,
      facilityCount: 2,
      ...revealOverrides,
    },
    ...lineOverrides,
  };
}

/** Reconstructs exactly: 250 × 3 + floor(750 × 10/100) = 825. */
function merchLine(
  revealOverrides: Partial<Record<string, unknown>> = {},
  lineOverrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    kind: 'merch',
    label: 'Fan Shop merchandise',
    amount: 825,
    reveal: {
      source: 'merch',
      base: 250,
      variancePercent: -7,
      surge: false,
      multiplierTimes: 3,
      facilityCount: 3,
      adjacencyPercent: 10,
      adjacencyAmount: 75,
      ...revealOverrides,
    },
    ...lineOverrides,
  };
}

function parseWithLines(lines: Record<string, unknown>[]): GameState {
  const stored = storedCareer();
  stored.ledgers[0] = { ...stored.ledgers[0], lines };
  return parseStoredGameState(JSON.stringify(stored));
}

function loadedLine(state: GameState, index: number): LedgerLine {
  return state.ledgers[0].lines[index];
}

describe('ledger reveal sanitization', () => {
  it('preserves valid reveals exactly, including negative variance', () => {
    const restored = parseWithLines([gateLine(), merchLine()]);
    expect(loadedLine(restored, 0).reveal).toEqual({
      source: 'league-gate',
      base: 1000,
      variancePercent: -7,
      surge: false,
      multiplierPercent: 200,
      facilityCount: 2,
    });
    expect(loadedLine(restored, 1).reveal).toEqual({
      source: 'merch',
      base: 250,
      variancePercent: -7,
      surge: false,
      multiplierTimes: 3,
      facilityCount: 3,
      adjacencyPercent: 10,
      adjacencyAmount: 75,
    });
  });

  it('round-trips reveals through settle → serialize → parse untouched', () => {
    const restored = parseWithLines([gateLine()]);
    const again = parseStoredGameState(serializeGameState(restored));
    expect(again.ledgers[0].lines[0].reveal).toEqual(
      loadedLine(restored, 0).reveal,
    );
  });

  it('round-trips the reduced upgrade multiplier used by new Fan Shop income', () => {
    const restored = parseWithLines([
      merchLine(
        { multiplierPercent: 250, adjacencyAmount: 62 },
        { amount: 687 },
      ),
    ]);
    expect(loadedLine(restored, 0).reveal).toMatchObject({
      source: 'merch',
      multiplierTimes: 3,
      multiplierPercent: 250,
      adjacencyAmount: 62,
    });
  });

  const stripCases: readonly [string, Record<string, unknown>][] = [
    ['a merch reveal on a tickets line', gateLine({ source: 'merch' })],
    [
      'an out-of-band surge percent',
      gateLine({ variancePercent: 25, surge: true }),
    ],
    [
      'a surge flag disagreeing with the band',
      gateLine({ variancePercent: 15, surge: false }),
    ],
    [
      'a non-surge percent flagged as surge',
      gateLine({ variancePercent: 5, surge: true }),
    ],
    ['a zero base', gateLine({ base: 0 })],
    ['a gate reconstruction mismatch', gateLine({}, { amount: 2001 })],
    [
      'a merch adjacency mismatch',
      merchLine({ adjacencyAmount: 76 }, { amount: 826 }),
    ],
    ['a zero multiplierTimes', merchLine({ multiplierTimes: 0 })],
    ['a sub-base multiplierPercent', merchLine({ multiplierPercent: 99 })],
    ['a non-object reveal', { ...gateLine(), reveal: 'garbage' }],
    [
      'a multiplication overflow',
      merchLine({ base: Number.MAX_SAFE_INTEGER - 1, multiplierTimes: 4 }),
    ],
    [
      'an addition overflow at reconstruction',
      merchLine({
        base: Number.MAX_SAFE_INTEGER - 5,
        multiplierTimes: 1,
        adjacencyPercent: 1,
        adjacencyAmount: Math.floor((Number.MAX_SAFE_INTEGER - 5) / 100),
      }),
    ],
  ];

  it.each(stripCases)(
    'strips %s while the line and save still load',
    (_name, line) => {
      const restored = parseWithLines([line, merchLine()]);
      expect(loadedLine(restored, 0).reveal).toBeUndefined();
      expect(loadedLine(restored, 0).amount).toBe(line.amount);
      // The neighbouring valid reveal is untouched — the sanitizer strips only
      // the inconsistent one.
      expect(loadedLine(restored, 1).reveal).toBeDefined();
    },
  );

  it('never rejects the save for a malformed reveal', () => {
    const restored = parseWithLines([
      { ...gateLine(), reveal: { source: 'league-gate' } },
    ]);
    expect(restored.ledgers[0].lines[0].amount).toBe(2000);
  });

  it('strips a reveal typed correctly but on the wrong kind of line', () => {
    const restored = parseWithLines([
      merchLine({}, { kind: 'sponsor', label: 'Monthly sponsor fee' }),
    ]);
    expect(loadedLine(restored, 0).reveal).toBeUndefined();
  });
});
