import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import type { GameState } from '../../game/types';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

/**
 * The rules that let a saved career render in a language it was not saved in,
 * without breaking one that was.
 */
function careerWithLine(line: Record<string, unknown>): GameState {
  const career = createCareer(createLaunchCareerSetup(20260806));
  return {
    ...career,
    ledgers: [{ season: 1, week: 1, lines: [line], balanceAfter: 5_000 }],
  } as unknown as GameState;
}

function roundTrip(line: Record<string, unknown>) {
  const parsed = parseStoredGameState(serializeGameState(careerWithLine(line)));
  return parsed.ledgers[0]!.lines[0]! as unknown as Record<string, unknown>;
}

const ENGLISH_LINE = {
  kind: 'merch',
  label: 'Fan Shop merchandise',
  amount: 120,
  balanceAfter: 5_000,
};

describe('persisted copy carries keys alongside English', () => {
  test('a line may carry a key and raw parameters beside its English', () => {
    const line = roundTrip({
      ...ENGLISH_LINE,
      labelKey: 'ledger.merch',
      labelParams: { shop: 'Fan Shop', takings: 120 },
    });

    expect(line.labelKey).toBe('ledger.merch');
    expect(line.labelParams).toEqual({ shop: 'Fan Shop', takings: 120 });
  });

  test('a line saved before this change still loads, and keeps its English', () => {
    const line = roundTrip(ENGLISH_LINE);

    expect(line.label).toBe('Fan Shop merchandise');
    expect(line.labelKey).toBeUndefined();
  });

  test.each([
    [
      'Current Sponsor · Monthly sponsor',
      'ledger.monthlyContinuitySponsor',
      undefined,
    ],
    [
      'Current Sponsor 2 · Monthly sponsor',
      'ledger.monthlyContinuitySponsorNumbered',
      { number: 2 },
    ],
  ])('repairs an old continuity sponsor label: %s', (label, key, params) => {
    const line = roundTrip({ kind: 'sponsor', label, amount: 120 });

    expect(line.labelKey).toBe(key);
    expect(line.labelParams).toEqual(params);
  });

  test('English stays required, so a writer cannot emit keys alone', () => {
    const { label: _dropped, ...withoutEnglish } = ENGLISH_LINE;

    expect(() =>
      roundTrip({ ...withoutEnglish, labelKey: 'ledger.merch' }),
    ).toThrow();
  });

  test('parameters refuse a structured value — raw strings and numbers only', () => {
    // `{ fee: "$240,000" }` would freeze one locale's separator and currency
    // placement into SQLite, which is the bug this pair exists to prevent. The
    // schema refuses anything that is not a plain scalar; a formatted *string*
    // is caught by review and the placeholder-parity gate instead.
    expect(() =>
      roundTrip({
        ...ENGLISH_LINE,
        labelKey: 'ledger.merch',
        labelParams: { fee: { amount: 240_000 } },
      }),
    ).toThrow();
  });
});
