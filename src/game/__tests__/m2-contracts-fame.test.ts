import { createLaunchCareerSetup } from '../../application/launch';
import { loadLaunchContent } from '../../content';
import { seasonEndViewModel } from '../../application/view-models';
import {
  completeCareerRenewal,
  beginCareerRenewalTalks,
  submitCareerRenewalOffer,
} from '../market-career';
import { createCareer, resolveCareerMatchFame, startNextSeason } from '../career';
import { releaseCareerPlayer } from '../squad';
import type { GameState } from '../types';

describe('M2 fame and expired contracts', () => {
  test('turns genuine appearances, wins, and goals into reachable club-legend fame', () => {
    let state = createCareer({ ...createLaunchCareerSetup(8801), careerMode: 'full' });
    const fixture = state.fixtures.find(candidate => (
      candidate.homeClubId === state.userClubId || candidate.awayClubId === state.userClubId
    ))!;
    const lineup = state.lineups.find(candidate => candidate.clubId === state.userClubId)!;
    const scorerId = lineup.playerIds[1];
    const reserveId = state.players.find(player => (
      player.clubId === state.userClubId && !lineup.playerIds.includes(player.id)
    ))!.id;
    const userIsHome = fixture.homeClubId === state.userClubId;
    const result = {
      fixtureId: fixture.id,
      homeGoals: userIsHome ? 1 : 0,
      awayGoals: userIsHome ? 0 : 1,
      scorerPlayerIds: [scorerId],
    };
    const startingFame = state.players.find(player => player.id === scorerId)!.fame ?? 0;
    const reserveFame = state.players.find(player => player.id === reserveId)!.fame ?? 0;

    // Eighteen scoring wins across a season are enough to make a homegrown
    // player famous, while a player who never appears gains nothing.
    for (let appearance = 0; appearance < 18; appearance += 1) {
      state = {
        ...state,
        players: resolveCareerMatchFame(state, [fixture], new Map([[fixture.id, result]])),
      };
    }

    expect(state.players.find(player => player.id === scorerId)?.fame).toBe(startingFame + 90);
    expect(state.players.find(player => player.id === reserveId)?.fame).toBe(reserveFame);
    expect(state.players.find(player => player.id === scorerId)?.fame).toBeGreaterThanOrEqual(70);
  });

  test('blocks a new full-career season until every ordinary or hero expiry is resolved', () => {
    const content = loadLaunchContent();
    const initial = createCareer({ ...createLaunchCareerSetup(8802), careerMode: 'full' });
    const lineupIds = new Set(initial.lineups.find(lineup => lineup.clubId === initial.userClubId)!.playerIds);
    const expired = initial.players
      .filter(player => player.clubId === initial.userClubId && !lineupIds.has(player.id))
      .slice(0, 2);
    expect(expired).toHaveLength(2);
    let state: GameState = {
      ...initial,
      phase: 'season-end' as const,
      players: initial.players.map(player => expired.some(candidate => candidate.id === player.id)
        ? { ...player, contractSeasonsRemaining: 0 }
        : player),
    };

    const firstReview = seasonEndViewModel(state, content, 1);
    expect(firstReview).toMatchObject({
      canContinue: false,
      expiredContract: { requiresNegotiation: true, remainingExpiredCount: 2 },
    });
    expect(() => startNextSeason(state)).toThrow('2 expired contracts must be resolved');

    let market = beginCareerRenewalTalks(state, state.market!, firstReview.expiredContract!.playerId);
    const ask = market.renewalTalks!.negotiation.weeklyAsk;
    market = submitCareerRenewalOffer(market, {
      weeklyWage: ask,
      termSeasons: 2,
      perk: 'GUARANTEED_STARTER',
    }, market.renewalTalks!.negotiation.pitchCards[0]);
    const renewed = completeCareerRenewal(state, market);
    state = { ...renewed.state, market: renewed.market };

    const secondReview = seasonEndViewModel(state, content, 1);
    expect(secondReview.expiredContract).toMatchObject({ remainingExpiredCount: 1 });
    expect(secondReview.expiredContract?.playerId).not.toBe(firstReview.expiredContract?.playerId);
    state = {
      ...state,
      market: beginCareerRenewalTalks(
        state,
        state.market!,
        secondReview.expiredContract!.playerId,
      ),
    };
    state = releaseCareerPlayer(state, secondReview.expiredContract!.playerId);

    expect(state.market?.renewalTalks).toBeUndefined();
    expect(seasonEndViewModel(state, content, 1).canContinue).toBe(true);
    expect(() => startNextSeason(state)).not.toThrow();
  });
});
