import { DEFAULT_CREATION_RATINGS, type CareerPlayer, type GameState } from '../../game';
import { clubLegacyViewModel } from '../view-models';
import { useM1Store } from '../store';

describe('club-legend app flow', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('pauses a full-career season transition for the legacy choice and returns to the office', () => {
    useM1Store.getState().startNewCareer(73_531);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const current = useM1Store.getState().career!;
    const retiredLegend = legendFrom(current.players.find(player =>
      player.clubId === current.userClubId,
    )!);
    const seasonEnd: GameState = {
      ...current,
      phase: 'season-end',
      fixtures: current.fixtures.map(fixture => {
        const userIsHome = fixture.homeClubId === current.userClubId;
        const userIsAway = fixture.awayClubId === current.userClubId;
        return {
          ...fixture,
          status: 'played' as const,
          score: userIsHome
            ? { homeGoals: 0, awayGoals: 1 }
            : userIsAway
              ? { homeGoals: 1, awayGoals: 0 }
              : { homeGoals: 0, awayGoals: 0 },
        };
      }),
      retiredPlayers: [retiredLegend],
      pendingLegacyPlayerIds: [retiredLegend.id],
    };
    useM1Store.setState({ career: seasonEnd, screen: 'season-end' });

    // Every season boundary presents the division awards before the recap will
    // advance, so the legacy queue is reached one screen further along.
    useM1Store.getState().advanceCareer();
    expect(useM1Store.getState().screen).toBe('awards-ceremony');
    useM1Store.getState().completeAwardsCeremony();
    useM1Store.getState().advanceCareer();

    expect(useM1Store.getState()).toMatchObject({
      screen: 'legacy',
      activeTab: 'home',
      career: { season: 2, phase: 'manage' },
    });
    expect(clubLegacyViewModel(useM1Store.getState().career!)).toMatchObject({
      playerName: 'Ari Flint',
      role: retiredLegend.role,
      queueLabel: 'Final legacy decision',
      // Two choices. "Mentor a prospect" is not one of them: it needed a
      // seventeenth roster place the season transition never leaves free.
      choices: [
        { id: 'coach-candidate' },
        { id: 'farewell' },
      ],
    });

    useM1Store.getState().chooseLegacy('coach-candidate');

    expect(useM1Store.getState().screen).toBe('management');
    expect(useM1Store.getState().career?.pendingLegacyPlayerIds).toEqual([]);
    expect(useM1Store.getState().career?.market?.coachCandidates).toContainEqual(
      expect.objectContaining({
        name: 'Ari Flint',
        retiredLegendPlayerId: retiredLegend.id,
      }),
    );
  });

  it('resumes directly into a pending legacy decision', () => {
    useM1Store.getState().startNewCareer(73_532);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const current = useM1Store.getState().career!;
    const retiredLegend = legendFrom(current.players.find(player =>
      player.clubId === current.userClubId,
    )!);
    useM1Store.setState({
      career: {
        ...current,
        retiredPlayers: [retiredLegend],
        pendingLegacyPlayerIds: [retiredLegend.id],
      },
      screen: 'welcome',
    });

    useM1Store.getState().continueCareer();

    expect(useM1Store.getState().screen).toBe('legacy');
  });

  /**
   * The decline leaves the store in exactly the state the coach path leaves it
   * in, minus the coach: the queue advanced, the office reached, no error. It
   * was the missing half of a screen that presented one button.
   */
  it('clears the queue on a farewell without hiring anybody', () => {
    useM1Store.getState().startNewCareer(73_533);
    useM1Store.getState().completePlayerCreation({
      name: 'Jo Rook',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const current = useM1Store.getState().career!;
    const retiredLegend = legendFrom(current.players.find(player =>
      player.clubId === current.userClubId,
    )!);
    const coachesBefore = current.market?.coachCandidates ?? [];
    useM1Store.setState({
      career: {
        ...current,
        retiredPlayers: [retiredLegend],
        pendingLegacyPlayerIds: [retiredLegend.id],
      },
      screen: 'legacy',
    });

    useM1Store.getState().chooseLegacy('farewell');

    expect(useM1Store.getState().screen).toBe('management');
    expect(useM1Store.getState().error).toBeNull();
    expect(useM1Store.getState().career?.pendingLegacyPlayerIds).toEqual([]);
    expect(useM1Store.getState().career?.market?.coachCandidates).toEqual(coachesBefore);
    expect(useM1Store.getState().career?.players).toEqual(current.players);
  });
});

function legendFrom(player: CareerPlayer): CareerPlayer {
  return {
    ...player,
    id: 'retired-legend',
    name: 'Ari Flint',
    age: 37,
    fame: 288,
    seasonsAtClub: 7,
    personality: 'Loyal',
    retirementAge: 37,
    retirementAnnounced: true,
    retirementAnnouncementSeason: 1,
    contractSeasonsRemaining: 0,
  };
}
