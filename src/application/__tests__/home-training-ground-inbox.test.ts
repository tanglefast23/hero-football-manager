import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { homeViewModel } from '../view-models';

describe('training-ground inbox letter', () => {
  const content = loadLaunchContent();

  it('does not tell a fresh full career to build the pitch that is already open, but still asks it to place its first facility', () => {
    const fresh = createCareer(createLaunchCareerSetup(20260720, undefined, content, 'full'));
    expect(fresh.careerMode).toBe('full');
    expect(fresh.facilities.trainingGroundBuilt).toBe(true);
    expect(fresh.facilities.grid).toMatchObject({
      buildings: [{ type: 'training-pitch', level: 1, seeded: true }],
      construction: undefined,
    });

    const home = homeViewModel(fresh);
    expect(home.alerts.some(alert => alert.id === 'training-ground')).toBe(false);
    // The seeded pitch was never player-built, so the facility-placement
    // tutorial is still due.
    expect(home.alerts.some(alert => alert.guideSequenceId === 'facility-placement')).toBe(true);
  });
});
