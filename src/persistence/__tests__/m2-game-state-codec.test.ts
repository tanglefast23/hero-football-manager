import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import { buildCareerFacility } from '../../game/management';
import { InvalidGameStateError, CorruptCareerSaveError } from '../errors';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

describe('M2 game-state codec', () => {
  test('round-trips the full pyramid, cup, market, youth intake, facilities, and lifecycle metadata', () => {
    const initial = createCareer(createLaunchCareerSetup(20260719, undefined, undefined, 'full'));
    const state = buildCareerFacility(initial, 'gym', { x: 0, y: 0 }).state;

    const restored = parseStoredGameState(serializeGameState(state));

    expect(restored).toEqual(state);
    expect(restored.m2?.pyramid.divisions).toHaveLength(5);
    expect(restored.m2?.nationalCups).toHaveLength(1);
    expect(restored.market?.coachCandidates.length).toBeGreaterThan(0);
    expect(restored.youthIntake).toEqual(state.youthIntake);
    expect(restored.youthIntake?.offers.length).toBeGreaterThanOrEqual(1);
    expect(restored.cashTransactions).toEqual(state.cashTransactions);
    expect(restored.cashTransactions).toHaveLength(1);
  });

  test('rejects a full career whose required M2 market sidecar is missing', () => {
    const state = createCareer(createLaunchCareerSetup(44, undefined, undefined, 'full'));
    const { market: _market, ...withoutMarket } = state;

    expect(() => serializeGameState(withoutMarket as typeof state)).toThrow(InvalidGameStateError);
    expect(() => parseStoredGameState(JSON.stringify(withoutMarket))).toThrow(CorruptCareerSaveError);
  });

  test('rejects stale youth intake data from another season', () => {
    const state = createCareer(createLaunchCareerSetup(45, undefined, undefined, 'full'));
    const stale = {
      ...state,
      youthIntake: { ...state.youthIntake!, season: state.season + 1 },
    };

    expect(() => serializeGameState(stale)).toThrow(InvalidGameStateError);
    expect(() => parseStoredGameState(JSON.stringify(stale))).toThrow(CorruptCareerSaveError);
  });

  test('rejects duplicate or zero-value immediate cash transactions', () => {
    const initial = createCareer(createLaunchCareerSetup(46, undefined, undefined, 'full'));
    const state = buildCareerFacility(initial, 'gym', { x: 0, y: 0 }).state;
    const transaction = state.cashTransactions![0];
    const duplicate = { ...state, cashTransactions: [transaction, transaction] };
    const zero = {
      ...state,
      cashTransactions: [{ ...transaction, amount: 0 }],
    };

    expect(() => serializeGameState(duplicate)).toThrow(InvalidGameStateError);
    expect(() => serializeGameState(zero)).toThrow(InvalidGameStateError);
    expect(() => parseStoredGameState(JSON.stringify(duplicate))).toThrow(CorruptCareerSaveError);
  });
});
