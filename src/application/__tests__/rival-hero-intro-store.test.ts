import { createLaunchCareerSetup } from '../launch';
import { useM1Store } from '../store';
import { matchDayViewModel } from '../view-models';
import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game/career';
import { DEFAULT_CREATION_RATINGS } from '../../game/onboarding/player-creation';
import {
  addCreatedPlayer,
  beginStoryOnboarding,
} from '../../game/onboarding/story-onboarding';
import {
  pendingRivalHeroIntro,
  rivalHeroIntroFlag,
} from '../../game/rival-hero-intro';
import type { GameState } from '../../game/types';

function openingMatchday(): GameState {
  const begun = beginStoryOnboarding(
    createCareer(createLaunchCareerSetup(20260808)),
  );
  const career = addCreatedPlayer(begun, {
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  const fixture = career.fixtures.find(
    (candidate) => candidate.id === career.onboarding?.firstFixtureId,
  );
  if (fixture === undefined) throw new Error('opening fixture missing');
  return { ...career, week: fixture.week, phase: 'matchday' };
}

describe('rival hero intro store flow', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('blocks Back, Play, and Quick Result until Barry finishes his taunt', () => {
    const career = openingMatchday();
    useM1Store.setState({ career, screen: 'matchday', activeTab: 'league' });

    useM1Store.getState().setActiveTab('home');
    useM1Store.getState().watchMatch();
    useM1Store.getState().quickResult();
    expect(useM1Store.getState()).toMatchObject({
      screen: 'matchday',
      activeTab: 'league',
      watchedMatch: null,
      career,
    });

    useM1Store.getState().completeRivalHeroIntro('special-f171');
    const completed = useM1Store.getState().career!;
    expect(completed.eventFlags).toContain(rivalHeroIntroFlag('special-f171'));
    expect(pendingRivalHeroIntro(completed)).toBeUndefined();
    expect(useM1Store.getState().screen).toBe('matchday');

    useM1Store.getState().completeRivalHeroIntro('special-f171');
    expect(
      useM1Store
        .getState()
        .career?.eventFlags.filter(
          (flag) => flag === rivalHeroIntroFlag('special-f171'),
        ),
    ).toHaveLength(1);
  });

  it('keeps the approved first tutorial match powerless after the teaser', () => {
    const career = openingMatchday();
    const fixture = matchDayViewModel(career, loadLaunchContent()).fixture;
    expect(fixture.opponentHeroCount).toBe(1);
    expect(fixture.opponentHeroes).toEqual([
      {
        id: 'special-f171',
        name: 'Larry Alan',
        role: 'FWD',
        lookId: 'f171',
      },
    ]);

    useM1Store.setState({ career, screen: 'matchday' });
    useM1Store.getState().completeRivalHeroIntro('special-f171');
    useM1Store.getState().watchMatch();

    const watched = useM1Store.getState().watchedMatch!;
    expect(
      watched.home.players.every((player) => player.power === undefined),
    ).toBe(true);
    expect(
      watched.away.players.every((player) => player.power === undefined),
    ).toBe(true);
    expect(useM1Store.getState().screen).toBe('watched');
  });
});
