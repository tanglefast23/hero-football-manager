import { DEFAULT_CREATION_RATINGS } from '../../game';
import { useM1Store } from '../store';

describe('National Cup app routing', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  test('routes from the league match through awakening into the playable cup tie', () => {
    useM1Store.getState().startNewCareer(2, 'full');
    useM1Store.getState().completePlayerCreation({
      name: 'Cup Runner',
      ratings: DEFAULT_CREATION_RATINGS,
    });
    const career = useM1Store.getState().career!;
    useM1Store.setState({
      career: { ...career, week: 5, phase: 'matchday' },
      screen: 'matchday',
    });

    useM1Store.getState().quickResult();
    expect(useM1Store.getState().error).toBeNull();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'awakening',
      career: { week: 6, phase: 'manage' },
    });

    useM1Store.getState().continueAfterAwakening();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'management',
      career: { week: 6, phase: 'manage' },
    });

    const awakenedCareer = useM1Store.getState().career!;
    useM1Store.setState({
      career: { ...awakenedCareer, week: 10, phase: 'matchday' },
      screen: 'matchday',
    });

    useM1Store.getState().quickResult();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'postmatch',
      career: { week: 10, phase: 'matchday' },
    });
    useM1Store.getState().continueAfterMatch();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'matchday',
      career: { week: 10, phase: 'matchday' },
    });

    useM1Store.getState().quickResult();
    const final = useM1Store.getState();
    expect(final).toMatchObject({
      screen: 'postmatch',
      career: { week: 11, phase: 'manage' },
      postMatch: {
        result: {
          fixtureId: expect.stringContaining('-cup-'),
          competition: 'National Cup · Play-in',
        },
      },
    });
    expect(final.career!.m2!.nationalCups[0].rounds[0].fixtures.every(
      fixture => fixture.status === 'played',
    )).toBe(true);
  });

});
