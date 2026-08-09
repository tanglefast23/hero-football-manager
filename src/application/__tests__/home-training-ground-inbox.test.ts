import { loadLaunchContent } from '../../content';
import {
  advanceFacilityConstruction,
  buildCareerFacility,
  createCareer,
} from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { homeViewModel } from '../view-models';

describe('training-ground inbox letter', () => {
  const content = loadLaunchContent();

  it('gives a fresh full career the pitch budget and guides the player to build it', () => {
    const fresh = createCareer(
      createLaunchCareerSetup(20260720, undefined, content),
    );
    expect(fresh.careerMode).toBe('full');
    expect(fresh.clubs.find((club) => club.id === fresh.userClubId)?.cash).toBe(
      53_000,
    );
    expect(fresh.facilities.trainingGroundBuilt).toBe(false);
    expect(fresh.facilities.grid?.buildings).toHaveLength(0);

    const home = homeViewModel(fresh);
    expect(home.alerts).toContainEqual(
      expect.objectContaining({
        id: 'training-ground',
        guideSequenceId: 'facility-placement',
        mustDoDutyId: 'facility-placement',
      }),
    );
  });

  /*
   * The opening cue points at this row, and until the pitch is placed it is the
   * only row of the two the week can act on. It shipped second, under the coach
   * explainer, because the desk sorted on `tone` and this row is calm by design.
   */
  it('puts the pitch above the coach explainer on the opening desk', () => {
    const fresh = createCareer(
      createLaunchCareerSetup(20260804, undefined, content),
    );

    const alerts = homeViewModel(fresh).alerts;
    expect(alerts.map((alert) => alert.id)).toEqual([
      'training-ground',
      'assistant-guide:head-coach-market',
    ]);
    expect(alerts.map((alert) => alert.mustDoDutyId)).toEqual([
      'facility-placement',
      'head-coach-market',
    ]);
  });

  it('leaves an existing seeded pitch alone when loading an older career', () => {
    const fresh = createCareer(
      createLaunchCareerSetup(20260721, undefined, content),
    );
    const started = buildCareerFacility(fresh, 'training-pitch', {
      x: 0,
      y: 0,
    }).state;
    const completedGrid = advanceFacilityConstruction(
      started.facilities.grid!,
    ).grid;
    const oldSave = {
      ...started,
      facilities: {
        trainingGroundBuilt: true,
        grid: {
          ...completedGrid,
          buildings: completedGrid.buildings.map((building) => ({
            ...building,
            seeded: true as const,
          })),
        },
      },
    };

    const home = homeViewModel(oldSave);
    expect(home.alerts.some((alert) => alert.id === 'training-ground')).toBe(
      false,
    );
    expect(
      home.alerts.some(
        (alert) => alert.guideSequenceId === 'facility-placement',
      ),
    ).toBe(false);
  });
});
