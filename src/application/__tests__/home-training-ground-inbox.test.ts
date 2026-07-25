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
    const fresh = createCareer(createLaunchCareerSetup(20260720, undefined, content));
    expect(fresh.careerMode).toBe('full');
    expect(fresh.clubs.find(club => club.id === fresh.userClubId)?.cash).toBe(53_000);
    expect(fresh.facilities.trainingGroundBuilt).toBe(false);
    expect(fresh.facilities.grid?.buildings).toHaveLength(0);

    const home = homeViewModel(fresh);
    expect(home.alerts).toContainEqual(expect.objectContaining({
      id: 'training-ground',
      guideSequenceId: 'facility-placement',
    }));
  });

  it('leaves an existing seeded pitch alone when loading an older career', () => {
    const fresh = createCareer(createLaunchCareerSetup(20260721, undefined, content));
    const started = buildCareerFacility(fresh, 'training-pitch', { x: 0, y: 0 }).state;
    const completedGrid = advanceFacilityConstruction(started.facilities.grid!).grid;
    const oldSave = {
      ...started,
      facilities: {
        trainingGroundBuilt: true,
        grid: {
          ...completedGrid,
          buildings: completedGrid.buildings.map(building => ({ ...building, seeded: true as const })),
        },
      },
    };

    const home = homeViewModel(oldSave);
    expect(home.alerts.some(alert => alert.id === 'training-ground')).toBe(false);
    expect(home.alerts.some(alert => alert.guideSequenceId === 'facility-placement')).toBe(false);
  });
});
