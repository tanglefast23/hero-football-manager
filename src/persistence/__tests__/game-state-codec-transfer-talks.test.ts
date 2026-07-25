import { createLaunchCareerSetup } from '../../application/launch';
import { careerMarketViewModelSource } from '../../application/market-source-adapter';
import { createCareer } from '../../game/career';
import { beginCareerTransferTalks } from '../../game/market-career';
import type { ScoutReport } from '../../game/market';
import type { GameState } from '../../game/types';
import { CorruptCareerSaveError, InvalidGameStateError } from '../errors';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

describe('transfer talk referential integrity', () => {
  test('round-trips talks that resolve to a pyramid transfer target', () => {
    const state = withTransferTalks(baseCareer());

    const restored = parseStoredGameState(serializeGameState(state));

    expect(restored.market?.transferTalks?.playerId)
      .toBe(state.market?.transferTalks?.playerId);
  });

  test('refuses to save talks whose target is gone', () => {
    const state = retargetTalks(withTransferTalks(baseCareer()), 'retired-hero-nobody-has');

    expect(() => serializeGameState(state)).toThrow(InvalidGameStateError);
    expect(() => serializeGameState(state)).toThrow('transferTalks');
  });

  test('loads a save that already contains dangling talks by dropping them', () => {
    // The shape a save written before the schema required the reference has:
    // legal JSON, unreadable market. Dropping the negotiation keeps the career.
    const state = retargetTalks(withTransferTalks(baseCareer()), 'retired-hero-nobody-has');

    const restored = parseStoredGameState(JSON.stringify(state));

    expect(restored.market?.transferTalks).toBeUndefined();
    // The Market tab is what used to throw on the dangling reference.
    expect(() => careerMarketViewModelSource(restored)).not.toThrow();
  });

  test('drops talks that now point at a player of the user club', () => {
    const career = baseCareer();
    const ownPlayer = career.players.find(player => player.clubId === career.userClubId)!;
    const state = retargetTalks(withTransferTalks(career), ownPlayer.id);

    const restored = parseStoredGameState(JSON.stringify(state));

    expect(restored.market?.transferTalks).toBeUndefined();
  });

  test('keeps the rest of the market when it drops the talks', () => {
    const state = retargetTalks(withTransferTalks(baseCareer()), 'retired-hero-nobody-has');

    const restored = parseStoredGameState(JSON.stringify(state));

    expect(restored.market?.scoutReports).toHaveLength(1);
    expect(restored.market?.nextMissionNumber).toBe(state.market?.nextMissionNumber);
  });

  test('keeps malformed talks so the validator still reports a corrupt save', () => {
    // The target resolves, but the negotiation inside disagrees about who is
    // being signed. That is corruption, not a stale reference, so the fail-soft
    // must leave it for the validator.
    const state = withTransferTalks(baseCareer());
    const stored = JSON.parse(JSON.stringify(state)) as {
      market: { transferTalks: { negotiation: { playerId: string } } };
    };
    stored.market.transferTalks.negotiation.playerId = 'someone-else-entirely';

    expect(() => parseStoredGameState(JSON.stringify(stored)))
      .toThrow(CorruptCareerSaveError);
    expect(() => parseStoredGameState(JSON.stringify(stored)))
      .toThrow('transferTalks');
  });
});

function baseCareer(): GameState {
  return createCareer(createLaunchCareerSetup(31415));
}

/** A player from another club in the pyramid, i.e. a legitimate transfer target. */
function scoutedPyramidPlayerId(state: GameState): string {
  for (const division of state.m2?.pyramid.divisions ?? []) {
    for (const club of division.clubs) {
      if (club.id === state.userClubId) continue;
      const player = club.squad[0];
      if (player !== undefined) return player.id;
    }
  }
  throw new Error('the test career has no pyramid transfer target');
}

/** Opens real talks, so the quote and negotiation inside are the shipped shape. */
function withTransferTalks(state: GameState): GameState {
  const playerId = scoutedPyramidPlayerId(state);
  const range = { minimum: 40, maximum: 60 };
  const report: ScoutReport = {
    playerId,
    role: 'MID',
    age: 24,
    statRanges: {
      pac: range, sho: range, pas: range, def: range, tec: range, sta: range, ref: range,
    },
    potentialRange: { minimum: 3, maximum: 4 },
  };
  const scouted = { ...state.market!, scoutReports: [report] };
  return { ...state, market: beginCareerTransferTalks(state, scouted, playerId) };
}

/** Repoints every reference inside the talks, i.e. a consistent but stale target. */
function retargetTalks(state: GameState, playerId: string): GameState {
  const talks = state.market!.transferTalks!;
  return {
    ...state,
    market: {
      ...state.market!,
      transferTalks: {
        ...talks,
        playerId,
        transferQuote: { ...talks.transferQuote, playerId },
        negotiation: { ...talks.negotiation, playerId },
      },
    },
  };
}
