import { createCareer } from '../../game/career';
import type { GameState } from '../../game/types';
import { createLaunchCareerSetup } from '../../application/launch';
import { createDeveloperSaveRepository } from '../developer-save-repository';
import { FakePersistenceDatabase } from './fake-database';

describe('developer save repository', () => {
  it('rotates weekly snapshots through 1-5 and then overwrites the oldest slot', async () => {
    const repository = await createDeveloperSaveRepository(new FakePersistenceDatabase());
    const initial = createCareer(createLaunchCareerSetup(24680));

    for (let week = 2; week <= 7; week += 1) {
      await repository.saveNextWeek(atMoment(initial, week, week * 10));
    }

    await expect(repository.list(initial.careerSeed)).resolves.toEqual([
      { slot: '1', kind: 'AUTO', season: 1, week: 7 },
      { slot: '2', kind: 'AUTO', season: 1, week: 3 },
      { slot: '3', kind: 'AUTO', season: 1, week: 4 },
      { slot: '4', kind: 'AUTO', season: 1, week: 5 },
      { slot: '5', kind: 'AUTO', season: 1, week: 6 },
    ]);
    await expect(repository.load('1', initial.careerSeed))
      .resolves.toMatchObject({ week: 7, trainingPoints: 70 });
  });

  it('captures an exact manual moment without moving the weekly rotation', async () => {
    const repository = await createDeveloperSaveRepository(new FakePersistenceDatabase());
    const initial = createCareer(createLaunchCareerSetup(13579));
    await repository.saveNextWeek(atMoment(initial, 2, 20));

    const manual = atMoment(initial, 9, 123);
    await repository.saveManual('C', manual);
    await repository.saveNextWeek(atMoment(initial, 3, 30));

    await expect(repository.load('C', initial.careerSeed)).resolves.toEqual(manual);
    await expect(repository.list(initial.careerSeed)).resolves.toEqual([
      { slot: '1', kind: 'AUTO', season: 1, week: 2 },
      { slot: '2', kind: 'AUTO', season: 1, week: 3 },
      { slot: 'C', kind: 'MANUAL', season: 1, week: 9 },
    ]);
  });

  it('starts a new career at weekly slot 1 and never loads another career through it', async () => {
    const repository = await createDeveloperSaveRepository(new FakePersistenceDatabase());
    const first = createCareer(createLaunchCareerSetup(111));
    const second = createCareer(createLaunchCareerSetup(222));
    await repository.saveNextWeek(atMoment(first, 2, 11));

    await expect(repository.load('1', second.careerSeed)).resolves.toBeNull();
    await repository.saveNextWeek(atMoment(second, 4, 22));

    await expect(repository.list(second.careerSeed)).resolves.toEqual([
      { slot: '1', kind: 'AUTO', season: 1, week: 4 },
    ]);
    await expect(repository.load('1', first.careerSeed)).resolves.toBeNull();
  });
});

function atMoment(state: GameState, week: number, trainingPoints: number): GameState {
  return { ...state, week, trainingPoints };
}
