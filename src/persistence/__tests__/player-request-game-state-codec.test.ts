import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import type { GameState } from '../../game/types';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

/**
 * Deliberately does not fast-forward the season. Several sidecars are stamped
 * with the season they were built for — `youthIntake.season` is validated
 * against the active one — so bumping `state.season` alone produces a save the
 * codec rightly refuses, for a reason that has nothing to do with requests.
 * Requests do not begin until season 2 in play; the codec neither knows nor
 * cares, so the fixture stays internally consistent instead.
 */
function careerWithRequests(): GameState {
  const base = createCareer(createLaunchCareerSetup(20260801));
  const asker = base.players.find(player => player.clubId === base.userClubId)!;
  return {
    ...base,
    week: 8,
    players: base.players.map(player => (player.id === asker.id
      ? { ...player, loyalty: 41, awayWeeks: 2 }
      : player)),
    playerRequests: {
      weeksSinceRequest: 3,
      pending: {
        requestId: 'bahamas-fortnight',
        playerId: asker.id,
        askedSeason: base.season,
        askedWeek: 7,
        costAmount: 4200,
        warned: false,
      },
      effects: [{
        kind: 'DRILL_SQUAD',
        weeksRemaining: 2,
        multiplierPercent: 60,
      }],
      history: [{
        requestId: 'gold-boots',
        playerId: asker.id,
        season: base.season,
        week: 5,
        resolution: 'GRANTED',
        costAmount: 1200,
      }],
      lastAskingPlayerId: asker.id,
    },
  };
}

describe('player request game-state codec', () => {
  test('round-trips loyalty, away weeks, a pending request, effects and history', () => {
    const state = careerWithRequests();

    expect(parseStoredGameState(serializeGameState(state))).toEqual(state);
  });

  test('round-trips a granted request as a player-request cash transaction', () => {
    const base = careerWithRequests();
    const club = base.clubs.find(candidate => candidate.id === base.userClubId)!;
    const state: GameState = {
      ...base,
      cashTransactions: [{
        id: 'cash-transaction-1',
        season: base.season,
        week: 8,
        kind: 'player-request',
        label: 'Custom gold boots',
        amount: -1200,
        balanceAfter: club.cash - 1200,
        referenceId: 'gold-boots',
      }],
    };

    expect(parseStoredGameState(serializeGameState(state))).toEqual(state);
  });

  test('rejects a loyalty above 100', () => {
    const base = careerWithRequests();
    const broken = {
      ...base,
      players: base.players.map((player, index) => (index === 0
        ? { ...player, loyalty: 101 }
        : player)),
    } as GameState;

    expect(() => parseStoredGameState(serializeGameState(broken))).toThrow();
  });

  test('rejects an unknown request effect kind', () => {
    const base = careerWithRequests();
    const broken = {
      ...base,
      playerRequests: {
        ...base.playerRequests!,
        effects: [{ kind: 'GUARANTEED_START', playerId: 'x', weeksRemaining: 4 }],
      },
    } as unknown as GameState;

    expect(() => parseStoredGameState(serializeGameState(broken))).toThrow();
  });
});
