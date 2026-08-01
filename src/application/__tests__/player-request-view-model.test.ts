import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game/career';
import { DEFAULT_PLAYER_REQUEST_STATE } from '../../game/player-requests';
import type { GameState } from '../../game/types';
import { createLaunchCareerSetup } from '../launch';
import { playerRequestViewModel } from '../player-request-view-model';

const CATALOG = loadLaunchContent().playerRequests;

function career(): GameState {
  return createCareer(createLaunchCareerSetup(20260801));
}

/** Season-2 week-5 or later, with sidecars kept in step. See the engine tests. */
function atStartWeek(state: GameState, week = 5): GameState {
  return {
    ...state,
    season: 2,
    week,
    ...(state.youthIntake === undefined
      ? {}
      : { youthIntake: { ...state.youthIntake, season: 2 } }),
  };
}

function withPending(state: GameState, requestId: string, costAmount?: number): GameState {
  const asker = state.players.find(player => player.clubId === state.userClubId)!;
  return {
    ...state,
    playerRequests: {
      ...DEFAULT_PLAYER_REQUEST_STATE,
      pending: {
        requestId,
        playerId: asker.id,
        askedSeason: 2,
        askedWeek: 5,
        ...(costAmount === undefined ? {} : { costAmount }),
        warned: false,
      },
    },
  };
}

describe('playerRequestViewModel', () => {
  it('is unavailable before the start week, so the tab row never renders', () => {
    expect(playerRequestViewModel(atStartWeek(career(), 4)).available).toBe(false);
  });

  it('is unavailable for a career with no baked catalog', () => {
    const { playerRequestRules: _dropped, ...setup } = createLaunchCareerSetup(20260801);

    expect(playerRequestViewModel(atStartWeek(createCareer(setup))).available).toBe(false);
  });

  it('is available and quiet from season 2 week 5', () => {
    const model = playerRequestViewModel(atStartWeek(career()));

    expect(model.available).toBe(true);
    expect(model.pending).toBeUndefined();
    expect(model.glowing).toBe(false);
    expect(model.emptyDetail).toContain('quiet');
  });

  it('glows and prints both button costs while a request is pending', () => {
    const state = withPending(atStartWeek(career()), 'bahamas-fortnight');
    const model = playerRequestViewModel(state);

    expect(model.glowing).toBe(true);
    // Default difficulty is Cozy, which caps leave at a single week.
    expect(model.pending!.grantLabel).toBe('Out 1 week');
    expect(model.pending!.refuseLabel).toBe('−3 loyalty · −4 morale');
    expect(model.pending!.artKey).toBe('request-bahamas-fortnight');
    expect(model.pending!.weeksToAnswer).toBe(CATALOG.tuning.answerWeeks);
  });

  it('states the harder Chairman refusal', () => {
    const state = {
      ...withPending(atStartWeek(career()), 'bahamas-fortnight'),
      difficulty: 'CHAIRMAN' as const,
    };
    const model = playerRequestViewModel(state);

    expect(model.pending!.grantLabel).toBe('Out 2 weeks');
    expect(model.pending!.refuseLabel).toBe('−5 loyalty · −8 morale');
  });

  it('prints a money cost from the snapshot the request was opened with', () => {
    const model = playerRequestViewModel(withPending(atStartWeek(career()), 'gold-boots', 4200));

    expect(model.pending!.grantLabel).toBe('−4,200');
  });

  it('disables granting when the club cannot pay', () => {
    const state = withPending(atStartWeek(career()), 'the-car', 500_000);
    const broke: GameState = {
      ...state,
      clubs: state.clubs.map(club => (club.id === state.userClubId
        ? { ...club, cash: 100 }
        : club)),
    };

    expect(playerRequestViewModel(broke).pending!.canAfford).toBe(false);
  });

  it('counts the answer window down as the weeks pass', () => {
    const state = { ...withPending(atStartWeek(career()), 'gold-boots', 4200), week: 6 };

    expect(playerRequestViewModel(state).pending!.weeksToAnswer).toBe(1);
  });

  it('lists what the manager decided, newest first', () => {
    const base = atStartWeek(career());
    const asker = base.players.find(player => player.clubId === base.userClubId)!;
    const state: GameState = {
      ...base,
      playerRequests: {
        ...DEFAULT_PLAYER_REQUEST_STATE,
        history: [
          { requestId: 'the-car', playerId: asker.id, season: 2, week: 9, resolution: 'REFUSED' },
          {
            requestId: 'gold-boots',
            playerId: asker.id,
            season: 2,
            week: 5,
            resolution: 'GRANTED',
            costAmount: 4200,
          },
        ],
      },
    };
    const model = playerRequestViewModel(state);

    expect(model.history[0].label).toBe('The car · S2 W9');
    expect(model.history[0].resolution).toBe('REFUSED');
    expect(model.history[1].label).toBe('Custom gold boots · S2 W5');
    expect(new Set(model.history.map(entry => entry.key)).size).toBe(2);
  });
});
