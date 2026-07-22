import { createCareer } from '../../game';
import { createCareerRepository } from '../../persistence';
import { FakePersistenceDatabase } from '../../persistence/__tests__/fake-database';
import { loadLaunchContent } from '../../content';
import { createLaunchCareerSetup, reconcileLaunchRoster } from '../launch';
import { useM1Store } from '../store';

describe('saved training-plan reconciliation', () => {
  beforeEach(() => {
    useM1Store.setState(useM1Store.getInitialState(), true);
  });

  it('replaces legacy payloads from content and keeps the first saved tier per path across reloads', async () => {
    const content = loadLaunchContent();
    const current = createCareer(createLaunchCareerSetup(20260725, undefined, content));
    const playerId = current.players.find(player => player.clubId === current.userClubId)!.id;
    const legacy = {
      ...current,
      trainingPlan: {
        assignedPlayerIds: [playerId],
        drills: [
          {
            id: 'sprints-ii',
            moneyCost: 9_999,
            tpCost: 99,
            gains: { pac: 1, sho: 2 },
          },
          {
            id: 'sprints',
            moneyCost: 8_888,
            tpCost: 88,
            gains: { pac: 9 },
          },
          {
            id: 'finishing',
            moneyCost: 7_777,
            tpCost: 77,
            gains: { sho: 1, tec: 1 },
          },
        ],
      },
    };
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    await repository.save(legacy);

    await useM1Store.getState().initializePersistence(repository);
    const migrated = useM1Store.getState().career!;
    expect(migrated.trainingPlan).toEqual({
      assignedPlayerIds: [playerId],
      drills: [
        { id: 'sprints-ii', moneyCost: 800, tpCost: 20, gains: { pac: 5 } },
        { id: 'finishing', moneyCost: 500, tpCost: 12, gains: { sho: 3 } },
      ],
    });
    expect(useM1Store.getState().selectedDrillIds).toEqual(['sprints-ii', 'finishing']);
    await expect(repository.load()).resolves.toEqual(migrated);
    expect(reconcileLaunchRoster(migrated, content)).toBe(migrated);

    useM1Store.setState(useM1Store.getInitialState(), true);
    await useM1Store.getState().initializePersistence(repository);
    expect(useM1Store.getState().career).toEqual(migrated);
    expect(useM1Store.getState().selectedDrillIds).toEqual(['sprints-ii', 'finishing']);
  });
});
