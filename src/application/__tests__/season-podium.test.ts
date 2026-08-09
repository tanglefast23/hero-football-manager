import {
  createCareer,
  leagueStandings,
  roleOverall,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import {
  completeSeasonPodium,
  hasPendingSeasonPodium,
  seasonPodiumFlag,
  seasonPodiumViewModel,
} from '../season-podium';
import { useM1Store } from '../store';

/**
 * A finished season whose table is exactly the order given.
 *
 * Every fixture is decided by the two clubs' places in `order`, so the club at
 * index 0 wins all eighteen, the club at index 9 loses all eighteen, and no two
 * clubs can tie on points or goal difference. That makes "the user finished
 * second" a fact of the state rather than something a seed happened to produce.
 */
function seasonEndedWithTable(order: readonly string[]): GameState {
  const state = createCareer(createLaunchCareerSetup(777));
  const rank = new Map(order.map((clubId, index) => [clubId, index]));
  const fixtures = state.fixtures.map((fixture) => {
    const homeIsBetter =
      rank.get(fixture.homeClubId)! < rank.get(fixture.awayClubId)!;
    return {
      ...fixture,
      status: 'played' as const,
      score: homeIsBetter
        ? { homeGoals: 2, awayGoals: 0 }
        : { homeGoals: 0, awayGoals: 2 },
    };
  });
  return { ...state, week: 30, phase: 'season-end' as const, fixtures };
}

/** The same career with the user club placed at `position` in the table. */
function seasonEndedInPosition(position: number): GameState {
  const state = createCareer(createLaunchCareerSetup(777));
  const others = state.clubs
    .map((club) => club.id)
    .filter((clubId) => clubId !== state.userClubId);
  const order = [...others];
  order.splice(position - 1, 0, state.userClubId);
  return seasonEndedWithTable(order);
}

describe('the season podium', () => {
  it('places the user club exactly where the table says', () => {
    const state = seasonEndedInPosition(2);
    const standing = leagueStandings(state).find(
      (row) => row.clubId === state.userClubId,
    );

    expect(standing?.position).toBe(2);
  });

  it('fires for second and third', () => {
    expect(hasPendingSeasonPodium(seasonEndedInPosition(2))).toBe(true);
    expect(hasPendingSeasonPodium(seasonEndedInPosition(3))).toBe(true);
  });

  it('stands down for the champions, who get the parade instead', () => {
    expect(hasPendingSeasonPodium(seasonEndedInPosition(1))).toBe(false);
  });

  it('stands down for a club that finished off the podium', () => {
    expect(hasPendingSeasonPodium(seasonEndedInPosition(4))).toBe(false);
    expect(hasPendingSeasonPodium(seasonEndedInPosition(10))).toBe(false);
  });

  it('never fires mid-season, whatever the table currently says', () => {
    const midSeason = {
      ...seasonEndedInPosition(2),
      phase: 'manage' as const,
      week: 20,
    };

    expect(hasPendingSeasonPodium(midSeason)).toBe(false);
  });

  it('plays once a season and cannot be replayed by returning to the boundary', () => {
    const state = seasonEndedInPosition(3);
    const seen = completeSeasonPodium(state);

    expect(seen.eventFlags).toContain(seasonPodiumFlag(state.season));
    expect(hasPendingSeasonPodium(seen)).toBe(false);
    // Idempotent: a second exit adds nothing and cannot double the flag.
    expect(completeSeasonPodium(seen).eventFlags).toEqual(seen.eventFlags);
  });

  it('keeps a separate flag per season, so next season earns its own podium', () => {
    const state = seasonEndedInPosition(2);

    expect(seasonPodiumFlag(1)).not.toBe(seasonPodiumFlag(2));
    // Carrying a LATER season's flag must not silence this season's ceremony:
    // a prefix match rather than an exact one would do exactly that.
    expect(
      hasPendingSeasonPodium({
        ...state,
        eventFlags: [...state.eventFlags, seasonPodiumFlag(state.season + 1)],
      }),
    ).toBe(true);
  });
});

describe('the podium view model', () => {
  it('reads the table top down and marks which step is ours', () => {
    const state = seasonEndedInPosition(2);
    const standings = leagueStandings(state);
    const view = seasonPodiumViewModel(state);

    expect(view.userPosition).toBe(2);
    expect(view.headline).toBe('Second Place!');
    expect(view.places.map((place) => place.position)).toEqual([1, 2, 3]);
    expect(view.places.map((place) => place.clubName)).toEqual(
      standings
        .slice(0, 3)
        .map((row) => state.clubs.find((club) => club.id === row.clubId)!.name),
    );
    expect(view.places.map((place) => place.isUserClub)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it('names third place when that is where the season ended', () => {
    const view = seasonPodiumViewModel(seasonEndedInPosition(3));

    expect(view.userPosition).toBe(3);
    expect(view.headline).toBe('Third Place!');
    expect(view.places.map((place) => place.isUserClub)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('stands each club s own best player on its step', () => {
    const state = seasonEndedInPosition(2);
    const view = seasonPodiumViewModel(state);
    const standings = leagueStandings(state);

    for (const [index, place] of view.places.entries()) {
      const clubId = standings[index].clubId;
      const squad = state.players.filter((player) => player.clubId === clubId);
      const bestOverall = Math.max(
        ...squad.map((player) => roleOverall(player.role, player.attrs)),
      );
      const chosen = squad.find((player) => player.id === place.playerId)!;

      expect(chosen.clubId).toBe(clubId);
      expect(roleOverall(chosen.role, chosen.attrs)).toBe(bestOverall);
      expect(place.playerName).toBe(chosen.name);
      expect(place.role).toBe(chosen.role);
    }
  });

  it('never throws on a damaged state, because its own exit is the only way off it', () => {
    const state = seasonEndedInPosition(2);

    expect(() =>
      seasonPodiumViewModel({ ...state, players: [] }),
    ).not.toThrow();
    expect(
      seasonPodiumViewModel({ ...state, players: [] }).places,
    ).toHaveLength(3);
  });
});

describe('the boundary route through the podium', () => {
  it('hands off to the rest of the boundary and never back to itself', () => {
    const state = seasonEndedInPosition(2);
    useM1Store.setState(useM1Store.getInitialState(), true);
    useM1Store.setState({ career: state, screen: 'season-podium' });

    useM1Store.getState().completeSeasonPodium();

    const after = useM1Store.getState();
    expect(after.screen).not.toBe('season-podium');
    expect(['awards-ceremony', 'season-end']).toContain(after.screen);
    expect(after.career?.eventFlags).toContain(seasonPodiumFlag(state.season));
  });
});
