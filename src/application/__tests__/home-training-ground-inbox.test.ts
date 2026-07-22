import { loadLaunchContent } from '../../content';
import { createCareer } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { homeViewModel } from '../view-models';

describe('training-ground inbox letter', () => {
  const content = loadLaunchContent();

  it('does not tell a fresh full career to build the pitch that is already open', () => {
    const fresh = createCareer(createLaunchCareerSetup(20260720, undefined, content, 'full'));
    expect(fresh.careerMode).toBe('full');
    expect(fresh.facilities.trainingGroundBuilt).toBe(true);
    expect(fresh.facilities.grid).toMatchObject({
      buildings: [{ type: 'training-pitch', level: 1 }],
      construction: undefined,
    });

    const home = homeViewModel(fresh);
    expect(home.alerts.some(alert => alert.id === 'training-ground')).toBe(false);
    expect(home.alerts.some(alert => alert.guideSequenceId === 'facility-placement')).toBe(false);
  });
});
