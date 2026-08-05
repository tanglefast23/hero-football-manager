import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import type { GameState } from '../../game/types';
import { CorruptCareerSaveError, InvalidGameStateError } from '../errors';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

function careerWithLedger(): GameState {
  const career = createCareer(createLaunchCareerSetup(20260805));
  return {
    ...career,
    ledgers: [{
      season: 1,
      week: 1,
      lines: [
        {
          kind: 'prize',
          label: 'Hero Cup Play-in win',
          amount: 2_000,
          idempotencyKey: `cup-round:${career.userClubId}:s1:r1`,
        },
        {
          kind: 'buzz',
          label: 'Buzz payout · First half',
          amount: 500,
          idempotencyKey: 'buzz/1/half-1',
        },
        { kind: 'wages', label: 'Legacy wages', amount: -1_000 },
      ],
      balanceAfter: 1_000,
    }],
  };
}

describe('ledger idempotency key codec', () => {
  test('round-trips new keys while retaining legacy lines without one', () => {
    const state = careerWithLedger();

    expect(parseStoredGameState(serializeGameState(state)).ledgers).toEqual(state.ledgers);
  });

  test('rejects an empty persisted key instead of treating it as an identity', () => {
    const state = careerWithLedger();
    const invalid = {
      ...state,
      ledgers: [{
        ...state.ledgers[0],
        lines: [{ ...state.ledgers[0].lines[0], idempotencyKey: '' }],
      }],
    } as GameState;

    expect(() => serializeGameState(invalid)).toThrow(InvalidGameStateError);
    expect(() => serializeGameState(invalid)).toThrow('idempotencyKey');
    expect(() => parseStoredGameState(JSON.stringify(invalid))).toThrow(CorruptCareerSaveError);
    expect(() => parseStoredGameState(JSON.stringify(invalid))).toThrow('idempotencyKey');
  });
});
