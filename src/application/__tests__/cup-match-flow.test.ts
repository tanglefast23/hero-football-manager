import { CUP_SETTLEMENT_WEEKS, DEFAULT_CREATION_RATINGS } from '../../game';
import { createMatch } from '../../sim/match';
import { useM1Store } from '../store';

const PLAY_IN_WEEK = CUP_SETTLEMENT_WEEKS[0];

describe('Hero Cup app routing', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  test('routes from the league match through awakening into the playable cup tie', () => {
    useM1Store.getState().startNewCareer(2);
    useM1Store.getState().completePlayerCreation({
      name: 'Cup Runner',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const career = useM1Store.getState().career!;
    useM1Store.setState({
      career: { ...career, week: 3, phase: 'matchday' },
      screen: 'matchday',
    });

    useM1Store.getState().quickResult();
    expect(useM1Store.getState().error).toBeNull();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'awakening',
      career: { week: 4, phase: 'manage' },
    });

    useM1Store.getState().continueAfterAwakening();
    // The awakening hands back to that match's accounts before the desk.
    expect(useM1Store.getState()).toMatchObject({
      screen: 'postmatch',
      career: { week: 4, phase: 'manage' },
    });

    useM1Store.getState().continueAfterMatch();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'management',
      career: { week: 4, phase: 'manage' },
    });

    // The cup settles in weeks the season-1 league leaves empty, so the league
    // round after the play-in week is pulled onto it. That reproduces the
    // season-2-onward double-header this routing has to handle without playing
    // out a whole season first.
    const awakenedCareer = useM1Store.getState().career!;
    const doubleHeaderRound = Math.min(...awakenedCareer.fixtures
      .filter(fixture => fixture.season === awakenedCareer.season && fixture.week > PLAY_IN_WEEK)
      .map(fixture => fixture.round));
    useM1Store.setState({
      career: {
        ...awakenedCareer,
        week: PLAY_IN_WEEK,
        phase: 'matchday',
        fixtures: awakenedCareer.fixtures.map(fixture => (
          fixture.season === awakenedCareer.season && fixture.round === doubleHeaderRound
            ? { ...fixture, week: PLAY_IN_WEEK }
            : fixture
        )),
      },
      screen: 'matchday',
    });

    useM1Store.getState().quickResult();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'postmatch',
      career: { week: PLAY_IN_WEEK, phase: 'matchday' },
    });
    useM1Store.getState().continueAfterMatch();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'matchday',
      career: { week: PLAY_IN_WEEK, phase: 'matchday' },
    });

    useM1Store.getState().quickResult();
    const final = useM1Store.getState();
    expect(final).toMatchObject({
      screen: 'postmatch',
      career: { week: PLAY_IN_WEEK + 1, phase: 'manage' },
      postMatch: {
        result: {
          fixtureId: expect.stringContaining('-cup-'),
          competition: 'Hero Cup · Play-in',
        },
      },
    });
    expect(final.career!.m2!.nationalCups[0].rounds[0].fixtures.every(
      fixture => fixture.status === 'played',
    )).toBe(true);
  });

  test('hands a watched cup tie its round, and a watched league fixture none', () => {
    // The round is what the match screen's title card is built from, so it has
    // to survive the trip from the bracket into the watched-match context.
    useM1Store.getState().startNewCareer(2);
    useM1Store.getState().completePlayerCreation({
      name: 'Cup Runner',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const career = useM1Store.getState().career!;

    useM1Store.setState({
      career: { ...career, week: 3, phase: 'matchday' },
      screen: 'matchday',
    });
    useM1Store.getState().watchMatch();
    expect(useM1Store.getState().error).toBeNull();
    expect(useM1Store.getState().watchedMatch!.cupRoundLabel).toBeUndefined();

    // Season 1 leaves the play-in week empty of league fixtures, so the
    // matchday resolves to the cup tie on its own.
    useM1Store.setState({
      career: { ...career, week: PLAY_IN_WEEK, phase: 'matchday' },
      screen: 'matchday',
    });
    useM1Store.getState().watchMatch();
    expect(useM1Store.getState().error).toBeNull();
    expect(useM1Store.getState().watchedMatch!.cupRoundLabel).toBe('Play-in');
  });

  test.each([
    { path: 'Quick Result', watched: false },
    { path: 'watched', watched: true },
  ])('queues exactly one Bert giant-killing walk-on after the $path path', ({ watched }) => {
    const prepared = prepareGiantKillingCupTie(2);
    const matchday = prepared.m2!.nationalCups[0].rounds[0].fixtures.find(fixture => (
      fixture.homeClubId === prepared.userClubId || fixture.awayClubId === prepared.userClubId
    ))!;

    if (watched) {
      useM1Store.getState().watchMatch();
      const context = useM1Store.getState().watchedMatch!;
      const result = createMatch(
        context.fixture.matchSeed,
        context.home,
        context.away,
        { controlledTeam: context.controlledTeam },
      );
      result.score = context.userIsFixtureHome ? [1, 0] : [0, 1];
      result.phase = 'fulltime';
      useM1Store.getState().finishWatchedMatch(result);
      // A duplicate full-time callback is ignored and must not queue Bert twice.
      useM1Store.getState().finishWatchedMatch(result);
    } else {
      useM1Store.getState().quickResult();
      // The post-match screen rejects a double tap at the store boundary.
      useM1Store.getState().quickResult();
    }

    expect(useM1Store.getState().career?.pendingCupGiantKillingCelebrations).toEqual([
      expect.objectContaining({
        fixtureId: matchday.id,
        divisionGap: 2,
        title: 'Two divisions up!',
      }),
    ]);
    useM1Store.getState().completeCupGiantKillingCelebration();
    expect(useM1Store.getState().career?.pendingCupGiantKillingCelebrations).toBeUndefined();
  });
});

function prepareGiantKillingCupTie(divisionGap: 1 | 2) {
  useM1Store.getState().startNewCareer(2);
  useM1Store.getState().completePlayerCreation({
    name: 'Cup Runner',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  const career = useM1Store.getState().career!;
  const cup = career.m2!.nationalCups[0];
  const fixture = cup.rounds[0].fixtures.find(candidate => (
    candidate.homeClubId === career.userClubId || candidate.awayClubId === career.userClubId
  ));
  if (fixture === undefined) throw new Error('expected a user play-in fixture');
  const opponentClubId = fixture.homeClubId === career.userClubId
    ? fixture.awayClubId
    : fixture.homeClubId;
  const dominant = {
    pac: 999, sho: 999, pas: 999, def: 999, tec: 999, sta: 999, ref: 999,
  };
  const overmatched = {
    pac: 1, sho: 1, pas: 1, def: 1, tec: 1, sta: 1, ref: 1,
  };
  const nextCup = {
    ...cup,
    seedDivisionByClubId: {
      ...cup.seedDivisionByClubId,
      [career.userClubId]: 5 as const,
      [opponentClubId]: (5 - divisionGap) as 3 | 4,
    },
  };
  const prepared = {
    ...career,
    week: PLAY_IN_WEEK,
    phase: 'matchday' as const,
    players: career.players.map(player => (
      player.clubId === career.userClubId
        ? { ...player, attrs: dominant }
        : player.clubId === opponentClubId
          ? { ...player, attrs: overmatched }
          : player
    )),
    m2: {
      ...career.m2!,
      nationalCups: career.m2!.nationalCups.map(candidate => (
        candidate.season === nextCup.season ? nextCup : candidate
      )),
      pyramid: {
        ...career.m2!.pyramid,
        divisions: career.m2!.pyramid.divisions.map(division => ({
          ...division,
          clubs: division.clubs.map(club => (
            club.id !== career.userClubId && club.id !== opponentClubId
              ? club
              : {
                  ...club,
                  squad: club.squad.map(player => ({
                    ...player,
                    attrs: club.id === career.userClubId ? dominant : overmatched,
                  })),
                }
          )),
        })),
      },
    },
  };
  useM1Store.setState({ career: prepared, screen: 'matchday' });
  return prepared;
}
