import { loadLaunchContent } from '../../content';
import { buildTrainingGround, createCareer, type GameState } from '../../game';
import { createLaunchCareerSetup } from '../launch';
import { homeViewModel } from '../view-models';

describe('training-ground inbox letter', () => {
  const content = loadLaunchContent();

  it('urges a full-mode career to build the training pitch until it is built', () => {
    const fresh = createCareer(createLaunchCareerSetup(20260720, undefined, content, 'full'));
    expect(fresh.careerMode).toBe('full');
    expect(fresh.facilities.trainingGroundBuilt).toBe(false);

    const beforeBuild = homeViewModel(fresh);
    const proposal = beforeBuild.alerts.find(alert => alert.id === 'training-ground');
    expect(beforeBuild.alerts).toHaveLength(3);
    expect(proposal).toMatchObject({
      guideSequenceId: 'facility-placement',
      destination: 'club-facilities',
    });

    const underConstruction = buildTrainingGround(fresh);
    expect(underConstruction.facilities.trainingGroundBuilt).toBe(false);
    expect(underConstruction.facilities.grid?.construction).toMatchObject({
      kind: 'BUILD',
      type: 'training-pitch',
    });
    expect(homeViewModel(underConstruction).alerts.some(alert => alert.id === 'training-ground')).toBe(false);

    const built: GameState = {
      ...fresh,
      facilities: { ...fresh.facilities, trainingGroundBuilt: true },
    };
    const afterBuild = homeViewModel(built);
    expect(afterBuild.alerts.some(alert => alert.id === 'training-ground')).toBe(false);
  });
});
