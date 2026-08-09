import { describe, expect, it } from '@jest/globals';
import { loadLaunchContent } from '../../content';
import {
  beginCareerRenewalTalks,
  createCareer,
  playerLoyalty,
  willRenegotiate,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { seasonEndViewModel } from '../view-models';

const content = loadLaunchContent();

/**
 * A season-end state whose expired queue holds two non-starters, both willing
 * to renegotiate so either can legally open renewal talks.
 */
function seasonEndWithTwoExpired(seed: number): {
  state: GameState;
  first: string;
  second: string;
} {
  const initial = createCareer(createLaunchCareerSetup(seed));
  const lineupIds = new Set(
    initial.lineups.find((lineup) => lineup.clubId === initial.userClubId)!
      .playerIds,
  );
  const candidates = initial.players
    .filter(
      (player) =>
        player.clubId === initial.userClubId &&
        !lineupIds.has(player.id) &&
        willRenegotiate(playerLoyalty(player, initial.careerSeed)),
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  expect(candidates.length).toBeGreaterThanOrEqual(2);
  const expiredIds = new Set([candidates[0].id, candidates[1].id]);
  return {
    first: candidates[0].id,
    second: candidates[1].id,
    state: {
      ...initial,
      phase: 'season-end' as const,
      players: initial.players.map((player) =>
        expiredIds.has(player.id)
          ? { ...player, contractSeasonsRemaining: 0 }
          : player,
      ),
    },
  };
}

describe('season-end expired queue', () => {
  it('presents the id-ordered head of the queue when no talks are open', () => {
    const { state, first } = seasonEndWithTwoExpired(9101);

    const view = seasonEndViewModel(state, content, 1);

    expect(view.expiredContract?.playerId).toBe(first);
    expect(view.expiredContract?.remainingExpiredCount).toBe(2);
    expect(view.canContinue).toBe(false);
  });

  it('follows open renewal talks instead of pinning the first expired id', () => {
    // The queue must be able to move past its head: talks opened for the second
    // player keep him on screen, with the negotiation panel attached to him.
    const { state, second } = seasonEndWithTwoExpired(9101);
    const negotiating: GameState = {
      ...state,
      market: beginCareerRenewalTalks(state, state.market!, second),
    };

    const view = seasonEndViewModel(negotiating, content, 1);

    expect(view.expiredContract?.playerId).toBe(second);
    expect(view.renewalNegotiation).toBeDefined();
  });
});
