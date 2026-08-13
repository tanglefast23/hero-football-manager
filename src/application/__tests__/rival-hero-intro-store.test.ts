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

/**
 * The first match-day on which the user meets Larry Alan.
 *
 * Was the onboarding opener until 2026-08-13: the schedule pinned the
 * division's strongest club to match one and `placement: 5` puts Larry on
 * exactly that club. The pin now opens mid-table, so his scene fires on the
 * week that fixture actually arrives.
 */
function heroMatchday(): GameState {
  const begun = beginStoryOnboarding(
    createCareer(createLaunchCareerSetup(20260808)),
  );
  const career = addCreatedPlayer(begun, {
    name: 'Jo Rook',
    ratings: DEFAULT_CREATION_RATINGS,
  });
  const host = career.players.find(
    (player) => player.id === 'special-f171',
  )?.clubId;
  if (host === undefined) throw new Error('Larry Alan was never placed');
  const fixture = career.fixtures
    .filter(
      (candidate) =>
        candidate.season === 1 &&
        (candidate.homeClubId === host || candidate.awayClubId === host) &&
        (candidate.homeClubId === career.userClubId ||
          candidate.awayClubId === career.userClubId),
    )
    .sort((left, right) => left.round - right.round)[0];
  if (fixture === undefined) throw new Error('hero fixture missing');
  return { ...career, week: fixture.week, phase: 'matchday' };
}

describe('rival hero intro store flow', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('blocks Back, Play, and Quick Result until Barry finishes his taunt', () => {
    const career = heroMatchday();
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

  it('keeps the new club powerless but lets Larry charge and fire after the teaser', () => {
    const career = heroMatchday();
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
    const userTeam = watched.userIsFixtureHome ? watched.home : watched.away;
    const rivalTeam = watched.userIsFixtureHome ? watched.away : watched.home;
    expect(userTeam.players.every((player) => player.power === undefined)).toBe(
      true,
    );
    expect(
      rivalTeam.players.find((player) => player.id === 'special-f171'),
    ).toMatchObject({ name: 'Larry Alan', power: 'SUPER_SPEED' });
    expect(useM1Store.getState().screen).toBe('watched');
  });
});
