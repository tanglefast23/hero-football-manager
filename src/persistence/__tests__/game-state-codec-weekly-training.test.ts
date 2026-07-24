import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';

describe('retired weekly-training migration', () => {
  it('loads a save carrying a weekly plan, cap notices, a promise bump, and the slot cap', () => {
    const base = createCareer(createLaunchCareerSetup(20260724, undefined, undefined, 'full'));
    const playerId = base.players.find(p => p.clubId === base.userClubId)!.id;
    const serialized = serializeGameState(base);
    const legacy = JSON.stringify({
      ...JSON.parse(serialized),
      trainingPlan: { slots: [{ playerId, pathId: 'sprints' }] },
      trainingCapNotices: [{
        id: 'training-cap:s1-w1:test:pac:sprints',
        season: 1,
        week: 1,
        playerId,
        playerName: 'Test Player',
        attribute: 'pac',
        cap: 50,
        drillId: 'sprints',
      }],
      pendingTrainingPromiseBump: { promisedPlayerId: playerId },
      trainingRules: {
        maxFocusDrillsPerWeek: 3,
        focusDrills: JSON.parse(serialized).trainingRules.focusDrills,
      },
    });

    const loaded = parseStoredGameState(legacy) as Record<string, unknown>;

    // The pending plan is discarded silently; drills happen at tap time now.
    expect(loaded.trainingPlan).toBeUndefined();
    expect(loaded.trainingCapNotices).toBeUndefined();
    expect(loaded.pendingTrainingPromiseBump).toBeUndefined();
    expect((loaded.trainingRules as Record<string, unknown>).maxFocusDrillsPerWeek).toBeUndefined();
    expect((loaded.trainingRules as { focusDrills: unknown[] }).focusDrills).toHaveLength(21);
  });
});
