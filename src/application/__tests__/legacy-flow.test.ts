import { DEFAULT_CREATION_RATINGS, type CareerPlayer, type GameState } from '../../game';
import { clubLegacyViewModel } from '../view-models';
import { useM1Store } from '../store';

describe('club-legend app flow', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('pauses a full-career season transition for the legacy choice and returns to the office', () => {
    useM1Store.getState().startNewCareer(73_531, 'full');
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
      choices: [
        { id: 'coach-candidate' },
        { id: 'mentor-youth' },
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
    useM1Store.getState().startNewCareer(73_532, 'full');
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
});

function legendFrom(player: CareerPlayer): CareerPlayer {
  return {
    ...player,
    id: 'retired-legend',
    name: 'Ari Flint',
    age: 37,
    fame: 88,
    seasonsAtClub: 7,
    personality: 'Loyal',
    retirementAge: 37,
    retirementAnnounced: true,
    retirementAnnouncementSeason: 1,
    contractSeasonsRemaining: 0,
  };
}
