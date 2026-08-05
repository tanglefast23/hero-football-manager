import { loadLaunchContent } from '../../content';
import {
  advanceFacilityConstruction,
  buildCareerFacility,
  createCareer,
  type GameState,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { homeViewModel } from '../view-models';

const BUILD_REMINDER_ID = 'build-reminder';

describe('keep-building inbox nudge', () => {
  const content = loadLaunchContent();

  /**
   * A career with the Training Pitch finished and the guide queue silent, so
   * the desk is genuinely empty. Dropping `market`/`m2` is the pre-M2 save
   * shape the guide scheduler already treats as "nothing due" — the cheapest
   * way to isolate an empty inbox without hiring a coach and clearing intake.
   */
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

  it('nudges the manager to keep building once week 7 opens on an empty desk', () => {
    const home = homeViewModel({ ...deskClearCareer(20260801), week: 7 });

    expect(home.alerts).toEqual([{
      id: BUILD_REMINDER_ID,
      title: 'Keep building',
      detail: 'Remember to construct new buildings every week if you have the finances to do so.',
      tone: 'info',
    }]);
  });

  it('stays quiet while the works crew is already on a project', () => {
    const clear = deskClearCareer(20260802);
    const building = buildCareerFacility(clear, 'coaching-office', { x: 5, y: 4 }).state;
    expect(building.facilities.grid?.construction).toBeDefined();

    const home = homeViewModel({ ...building, week: 7 });

    expect(home.alerts).toHaveLength(0);
  });

  it('never crowds out a real inbox item', () => {
    const clear = deskClearCareer(20260803);
    const injuredId = clear.players.find(player => player.clubId === clear.userClubId)!.id;
    const withInjury = {
      ...clear,
      week: 7,
      players: clear.players.map(player => (
        player.id === injuredId ? { ...player, injuryWeeks: 3 } : player
      )),
    };

    const home = homeViewModel(withInjury);

    expect(home.alerts.some(alert => alert.id === `injury-${injuredId}`)).toBe(true);
    expect(home.alerts.some(alert => alert.id === BUILD_REMINDER_ID)).toBe(false);
  });

  it('holds off until week 7 so the opening weeks stay guided', () => {
    const clear = deskClearCareer(20260804);

    expect(homeViewModel({ ...clear, week: 6 }).alerts).toHaveLength(0);
    expect(homeViewModel({ ...clear, week: 7 }).alerts).toHaveLength(1);
    expect(homeViewModel({ ...clear, week: 8 }).alerts).toHaveLength(0);
  });

  it('does not repeat in a later season', () => {
    const clear = deskClearCareer(20260805);

    expect(homeViewModel({ ...clear, season: 2, week: 7 }).alerts).toHaveLength(0);
  });
});
