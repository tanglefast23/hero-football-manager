import { loadLaunchContent } from '../../content';
import { createCareer, type GameState } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { homeViewModel } from '../view-models';

describe('training-ground inbox letter', () => {
  const content = loadLaunchContent();

  it('urges a full-mode career to build the training pitch until it is built', () => {
    const fresh = createCareer(createLaunchCareerSetup(20260720, undefined, content, 'full'));
    expect(fresh.careerMode).toBe('full');
    expect(fresh.facilities.trainingGroundBuilt).toBe(false);

    const beforeBuild = homeViewModel(fresh);
    expect(beforeBuild.alerts.some(alert => alert.id === 'training-ground')).toBe(true);

    const built: GameState = {
      ...fresh,
      facilities: { ...fresh.facilities, trainingGroundBuilt: true },
    };
    const afterBuild = homeViewModel(built);
    expect(afterBuild.alerts.some(alert => alert.id === 'training-ground')).toBe(false);
  });
});
