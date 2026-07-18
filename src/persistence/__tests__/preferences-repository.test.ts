import {
  createPreferencesRepository,
  DEFAULT_APP_PREFERENCES,
  replaceFormationPreset,
} from '../preferences-repository';
import { FakePersistenceDatabase } from './fake-database';

describe('app preferences repository', () => {
  it('loads manual powers and the three coverage formations by default', async () => {
    const repository = await createPreferencesRepository(new FakePersistenceDatabase());
    await expect(repository.load()).resolves.toEqual(DEFAULT_APP_PREFERENCES);
  });

  it('persists formation presets, automatic powers, and master volume', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createPreferencesRepository(database);
    const preferences = {
      formationPresets: ['3-5-2', '4-5-1', '3-4-3'] as ['3-5-2', '4-5-1', '3-4-3'],
      autoPowers: true,
      masterVolume: 0.5 as const,
    };
    await repository.save(preferences);
    await expect(repository.load()).resolves.toEqual(preferences);
  });

  it('cycles one preset without introducing duplicates', () => {
    const next = replaceFormationPreset(DEFAULT_APP_PREFERENCES, 0);
    expect(next.formationPresets).toEqual(['4-3-3', '3-4-3', '5-3-2']);
    expect(new Set(next.formationPresets).size).toBe(3);
  });
});
