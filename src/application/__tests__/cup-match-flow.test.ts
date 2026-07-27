import { CUP_SETTLEMENT_WEEKS, DEFAULT_CREATION_RATINGS } from '../../game';
import { useM1Store } from '../store';

const PLAY_IN_WEEK = CUP_SETTLEMENT_WEEKS[0];

describe('National Cup app routing', () => {
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
          competition: 'Global Cup · Play-in',
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
});
