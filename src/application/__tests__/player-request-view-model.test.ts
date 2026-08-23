import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game/career';
import { DEFAULT_PLAYER_REQUEST_STATE } from '../../game/player-requests';
import type { GameState } from '../../game/types';
import { copyFor } from '../../i18n';
import { createLaunchCareerSetup } from '../launch';
import { playerRequestViewModel } from '../player-request-view-model';
import { homeViewModel } from '../view-models';

const CATALOG = loadLaunchContent().playerRequests;

/** The real game attaches the catalog in store.ts; tests do it here. */
function career(): GameState {
  return createCareer({
    ...createLaunchCareerSetup(20260801),
    playerRequestRules: CATALOG,
  });
}

/** Season 2 or later, with sidecars kept in step. See the engine tests. */
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

function withPending(
  state: GameState,
  requestId: string,
  costAmount?: number,
): GameState {
  const asker = state.players.find(
    (player) => player.clubId === state.userClubId,
  )!;
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

function withLegacyMoneyCost(state: GameState, requestId: string): GameState {
  return {
    ...state,
    playerRequestRules: {
      ...CATALOG,
      requests: CATALOG.requests.map((request) =>
        request.id === requestId
          ? {
              ...request,
              cost: { kind: 'MONEY_PLAYER' as const, wageMultiple: 4 },
            }
          : request,
      ),
    },
  };
}

describe('playerRequestViewModel', () => {
  it('is unavailable before the start season, so the tab row never renders', () => {
    // Season 1 is the whole of the gate now: the tab opens in season 2 week 1,
    // because nothing about wanting a new car depends on the league being in
    // session. Costs the pre-season cannot collect are filtered per request in
    // `advancePlayerRequests` instead of by silencing the feature for a month.
    expect(playerRequestViewModel(career()).available).toBe(false);
  });

  it('is unavailable for a career with no baked catalog', () => {
    // Measurement harnesses build careers this way, so the tab must simply not
    // exist for them rather than half-render.
    const bare = createCareer(createLaunchCareerSetup(20260801));

    expect(playerRequestViewModel(atStartWeek(bare)).available).toBe(false);
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
    expect(model.pending!.refuseLabel).toBe('Lose 3 loyalty and 4 morale');
    expect(model.pending!.artKey).toBe('request-bahamas-fortnight');
    expect(model.pending!.weeksToAnswer).toBe(CATALOG.tuning.answerWeeks);
  });

  it('keeps every pending request in the Home inbox until a decision', () => {
    const pending = withPending(atStartWeek(career()), 'bahamas-fortnight');

    const beforeOpening = homeViewModel(pending).alerts.map(
      (alert) => alert.id,
    );
    const afterOpening = homeViewModel(pending).alerts.map((alert) => alert.id);
    expect(beforeOpening).toContain('player-request-waiting');
    expect(afterOpening).toContain('player-request-waiting');

    const decided: GameState = {
      ...pending,
      playerRequests: {
        ...pending.playerRequests!,
        pending: undefined,
      },
    };
    expect(
      homeViewModel(decided).alerts.map((alert) => alert.id),
    ).not.toContain('player-request-waiting');
  });

  it('states the harder Chairman refusal', () => {
    const state = {
      ...withPending(atStartWeek(career()), 'bahamas-fortnight'),
      difficulty: 'CHAIRMAN' as const,
    };
    const model = playerRequestViewModel(state);

    expect(model.pending!.grantLabel).toBe('Out 2 weeks');
    expect(model.pending!.refuseLabel).toBe('Lose 5 loyalty and 8 morale');
  });

  it('writes Spanish losses without duplicate minus signs', () => {
    const refusal = playerRequestViewModel(
      withPending(atStartWeek(career()), 'bahamas-fortnight'),
      copyFor('es'),
    );
    const squadCondition = playerRequestViewModel(
      withPending(atStartWeek(career()), 'squad-headphones'),
      copyFor('es'),
    );

    expect(refusal.pending!.refuseLabel).toBe(
      'Pierdes 3 de lealtad y 4 de ánimo',
    );
    expect(squadCondition.pending!.grantLabel).toBe(
      'La plantilla pierde 6 de estado',
    );
  });

  it('prints a money cost from the snapshot the request was opened with', () => {
    const model = playerRequestViewModel(
      withLegacyMoneyCost(
        withPending(atStartWeek(career()), 'gold-boots', 4200),
        'gold-boots',
      ),
    );

    expect(model.pending!.grantLabel).toBe('-$4,200');
    expect(model.pending!.grantMoneyCost).toBe('-$4,200');
  });

  it('disables granting when the club cannot pay', () => {
    const state = withLegacyMoneyCost(
      withPending(atStartWeek(career()), 'the-car', 500_000),
      'the-car',
    );
    const broke: GameState = {
      ...state,
      clubs: state.clubs.map((club) =>
        club.id === state.userClubId ? { ...club, cash: 100 } : club,
      ),
    };

    expect(playerRequestViewModel(broke).pending!.canAfford).toBe(false);
  });

  it('counts the answer window down as the weeks pass', () => {
    const state = {
      ...withPending(atStartWeek(career()), 'gold-boots', 4200),
      week: 6,
    };

    expect(playerRequestViewModel(state).pending!.weeksToAnswer).toBe(1);
  });

  it('lists what the manager decided, newest first', () => {
    const base = atStartWeek(career());
    const asker = base.players.find(
      (player) => player.clubId === base.userClubId,
    )!;
    const state: GameState = {
      ...base,
      playerRequests: {
        ...DEFAULT_PLAYER_REQUEST_STATE,
        history: [
          {
            requestId: 'the-car',
            playerId: asker.id,
            season: 2,
            week: 9,
            resolution: 'REFUSED',
          },
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
    expect(new Set(model.history.map((entry) => entry.key)).size).toBe(2);
  });
});
