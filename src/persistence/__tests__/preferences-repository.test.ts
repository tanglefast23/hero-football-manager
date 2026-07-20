import {
  availableFormationIds,
  createPreferencesRepository,
  DEFAULT_APP_PREFERENCES,
  replaceFormationPreset,
  type AppPreferences,
} from '../preferences-repository';
import { FakePersistenceDatabase } from './fake-database';

describe('app preferences repository', () => {
  it('loads manual powers and the three coverage formations by default', async () => {
    const repository = await createPreferencesRepository(new FakePersistenceDatabase());
    await expect(repository.load()).resolves.toEqual(DEFAULT_APP_PREFERENCES);
  });

  it('persists formation presets, automatic powers, master volume, and accessibility options', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createPreferencesRepository(database);
    const preferences = {
      formationPresets: ['3-5-2', '4-5-1', '3-4-3'] as ['3-5-2', '4-5-1', '3-4-3'],
      autoPowers: true,
      masterVolume: 0.5 as const,
      reduceMotion: true,
      hudSide: 'right' as const,
    };
    await repository.save(preferences);
    await expect(repository.load()).resolves.toEqual(preferences);
  });

  it('migrates schema-1 preferences without treating them as corrupt', async () => {
    const database = new FakePersistenceDatabase();
    database.preferencesRow = {
      schema_version: 1,
      preferences_json: JSON.stringify({
        formationPresets: ['4-4-2', '3-4-3', '5-3-2'],
        autoPowers: true,
        masterVolume: 0.75,
      }),
    };
    const repository = await createPreferencesRepository(database);

    await expect(repository.load()).resolves.toEqual({
      formationPresets: ['4-4-2', '3-4-3', '5-3-2'],
      autoPowers: true,
      masterVolume: 0.75,
      reduceMotion: false,
      hudSide: 'left',
    });
    expect(database.preferencesRow?.schema_version).toBe(2);
  });

  it('cycles one preset without introducing duplicates', () => {
    const next = replaceFormationPreset(DEFAULT_APP_PREFERENCES, 0);
    expect(next.formationPresets).toEqual(['5-3-2', '3-4-3', '4-4-2']);
    expect(new Set(next.formationPresets).size).toBe(3);
  });

  it('does not offer coach-gated formations before a coach teaches them', () => {
    const seen = new Set<string>();
    let preferences = DEFAULT_APP_PREFERENCES;
    for (let index = 0; index < 12; index++) {
      preferences = replaceFormationPreset(preferences, 0);
      seen.add(preferences.formationPresets[0]);
    }

    expect(seen).not.toContain('3-5-2');
    expect(seen).not.toContain('4-5-1');
    expect(seen).not.toContain('4-3-3');
  });

  it('offers the validated taught formation after hire and ignores trap or unknown IDs', () => {
    expect(availableFormationIds(DEFAULT_APP_PREFERENCES, [
      '3-5-2',
      'not-a-formation',
      '3-5-2',
      '4-5-1',
      '4-3-3',
    ])).toEqual(['4-4-2', '4-3-3', '5-3-2', '3-4-3']);

    let preferences = DEFAULT_APP_PREFERENCES;
    const seen = new Set<string>();
    for (let index = 0; index < 12; index++) {
      preferences = replaceFormationPreset(preferences, 0, ['4-3-3']);
      expect(new Set(preferences.formationPresets).size).toBe(3);
      seen.add(preferences.formationPresets[0]);
    }
    expect(seen).toEqual(new Set(['4-4-2', '4-3-3', '5-3-2', '3-4-3']));
  });

  it('grandfathers a saved gated formation without unlocking its untaught peer', () => {
    const saved: AppPreferences = {
      ...DEFAULT_APP_PREFERENCES,
      formationPresets: ['3-5-2', '3-4-3', '5-3-2'],
    };

    expect(availableFormationIds(saved)).toContain('3-5-2');
    expect(availableFormationIds(saved)).not.toContain('4-5-1');
    expect(replaceFormationPreset(saved, 0).formationPresets).toEqual([
      '5-3-2',
      '3-4-3',
      '3-5-2',
    ]);
  });
});
