import { loadLaunchContent } from '../../content';
import {
  advanceFacilityConstruction,
  buildCareerFacility,
  createCareer,
  offerCareerEvent,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import {
  DESK_STORY_ALERT_ID,
  homeViewModel,
  isHomeDeskClear,
} from '../view-models';

describe('stories on the desk', () => {
  const content = loadLaunchContent();
  const story = content.events.events.find(
    (event) => event.id === 'meteor-shard-center-circle',
  )!;

  /** A career whose guide queue is silent, so the desk is genuinely empty. */
  function deskClearCareer(seed: number): GameState {
    const started = buildCareerFacility(
      createCareer(createLaunchCareerSetup(seed, undefined, content)),
      'training-pitch',
      { x: 0, y: 0 },
    ).state;
    let grid = started.facilities.grid!;
    while (grid.construction !== undefined) {
      grid = advanceFacilityConstruction(grid).grid;
    }
    return {
      ...started,
      facilities: { trainingGroundBuilt: true, grid },
      market: undefined,
      m2: undefined,
    };
  }

  it('recognises a week with nothing to act on', () => {
    const clear = deskClearCareer(20261001);

    expect(isHomeDeskClear({ ...clear, week: 9 })).toBe(true);
    expect(
      isHomeDeskClear({
        ...clear,
        week: 9,
        players: clear.players.map((player, index) =>
          index === 0 && player.clubId === clear.userClubId
            ? { ...player, injuryWeeks: 2 }
            : player,
        ),
      }),
    ).toBe(false);
  });

  it('is never desk-clear outside the manage phase', () => {
    expect(
      isHomeDeskClear({
        ...deskClearCareer(20261002),
        week: 9,
        phase: 'matchday',
      }),
    ).toBe(false);
  });

  it('puts the offered story on the desk with its whole opening on the card', () => {
    const offered = offerCareerEvent(
      { ...deskClearCareer(20261003), week: 9 },
      story.id,
    );

    const alerts = homeViewModel(offered).alerts;

    expect(alerts).toEqual([
      {
        id: DESK_STORY_ALERT_ID,
        title: story.title,
        detail: story.body,
        tone: 'event',
      },
    ]);
  });

  it('outranks the standing keep-building nudge', () => {
    const clear = { ...deskClearCareer(20261004), week: 7 };
    expect(homeViewModel(clear).alerts.map((alert) => alert.id)).toEqual([
      'build-reminder',
    ]);

    const offered = offerCareerEvent(clear, story.id);

    expect(homeViewModel(offered).alerts.map((alert) => alert.id)).toEqual([
      DESK_STORY_ALERT_ID,
    ]);
  });

  it('leaves the desk once the story has been answered', () => {
    const offered = offerCareerEvent(
      { ...deskClearCareer(20261005), week: 9 },
      story.id,
    );
    const resolved = {
      ...offered,
      pendingEvent: {
        ...offered.pendingEvent!,
        resolvedChoiceId: story.choices[0].id,
      },
    };

    // The card is gone and Week 9 stays quiet; the building reminder retired
    // after its single Week 7 appearance.
    expect(homeViewModel(resolved).alerts).toHaveLength(0);
  });
});
