import {
  availableFormationIds,
  createPreferencesRepository,
  DEFAULT_APP_PREFERENCES,
  replaceFormationPreset,
  type AppPreferences,
} from '../preferences-repository';
import { FakePersistenceDatabase } from './fake-database';

/**
 * Written out rather than spread from `DEFAULT_APP_PREFERENCES`.
 *
 * A fixture built by spreading the defaults silently acquires every field
 * added to them later, so it stops representing the version it claims to be
 * and the migration it is supposed to exercise is never actually run. That is
 * how a required new field can reach a device and reset real players'
 * settings with the suite still green — see the comment on
 * `V9PreferencesSchema`.
 */
const V9_ROW_LITERAL = {
  formationPresets: ['4-4-2', '3-4-3', '5-3-2'],
  autoPowers: false,
  masterVolume: 1,
  reduceMotion: false,
  hudSide: 'left',
  hapticsEnabled: true,
  textScale: 1,
  highContrast: false,
  colorSafeKits: true,
  cutInMode: 'full',
  climbCompleted: false,
  seenPowerCutIns: [],
  autoSubs: false,
  squadSort: null,
  developerMode: false,
} as const;

describe('app preferences repository', () => {
  it('loads manual powers and the three coverage formations by default', async () => {
    const repository = await createPreferencesRepository(new FakePersistenceDatabase());
    await expect(repository.load()).resolves.toEqual(DEFAULT_APP_PREFERENCES);
  });

  it('persists formation presets, automatic powers, master volume, and accessibility options', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createPreferencesRepository(database);
    const preferences: AppPreferences = {
      ...DEFAULT_APP_PREFERENCES,
      formationPresets: ['3-5-2', '4-5-1', '3-4-3'] as ['3-5-2', '4-5-1', '3-4-3'],
      autoPowers: true,
      masterVolume: 0.5 as const,
      reduceMotion: true,
      hudSide: 'right' as const,
      climbCompleted: true,
      seenPowerCutIns: ['SUPER_SPEED', 'WEB_TRAP', 'GUST'],
      autoSubs: true,
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
      ...DEFAULT_APP_PREFERENCES,
      formationPresets: ['4-4-2', '3-4-3', '5-3-2'],
      autoPowers: true,
      masterVolume: 0.75,
    });
    expect(database.preferencesRow?.schema_version).toBe(10);
  });

  it('migrates schema-2 preferences with M4 accessibility defaults', async () => {
    const database = new FakePersistenceDatabase();
    database.preferencesRow = {
      schema_version: 2,
      preferences_json: JSON.stringify({
        formationPresets: ['4-4-2', '3-4-3', '5-3-2'],
        autoPowers: false,
        masterVolume: 0.5,
        reduceMotion: true,
        hudSide: 'right',
      }),
    };
    const repository = await createPreferencesRepository(database);

    await expect(repository.load()).resolves.toEqual({
      ...DEFAULT_APP_PREFERENCES,
      formationPresets: ['4-4-2', '3-4-3', '5-3-2'],
      masterVolume: 0.5,
      reduceMotion: true,
      hudSide: 'right',
    });
    expect(database.preferencesRow?.schema_version).toBe(10);
  });

  it('migrates schema-3 M4 preferences with an empty persistent cut-in history', async () => {
    const database = new FakePersistenceDatabase();
    const {
      seenPowerCutIns: _seenPowerCutIns,
      autoSubs: _autoSubs,
      squadSort: _squadSort,
      climbCompleted: _climbCompleted,
      developerMode: _developerMode,
      ...m4Preferences
    } = V9_ROW_LITERAL;
    database.preferencesRow = {
      schema_version: 3,
      preferences_json: JSON.stringify({ ...m4Preferences, cutInMode: 'banner' }),
    };
    const repository = await createPreferencesRepository(database);

    await expect(repository.load()).resolves.toEqual({
      ...DEFAULT_APP_PREFERENCES,
      cutInMode: 'banner',
    });
    expect(database.preferencesRow?.schema_version).toBe(10);
  });

  it('migrates schema-4 preferences with manager tips enabled', async () => {
    const database = new FakePersistenceDatabase();
    const {
      autoSubs: _autoSubs,
      squadSort: _squadSort,
      climbCompleted: _climbCompleted,
      developerMode: _developerMode,
      ...schema4Preferences
    } = V9_ROW_LITERAL;
    database.preferencesRow = {
      schema_version: 4,
      preferences_json: JSON.stringify(schema4Preferences),
    };
    const repository = await createPreferencesRepository(database);

    await expect(repository.load()).resolves.toEqual(DEFAULT_APP_PREFERENCES);
    expect(database.preferencesRow?.schema_version).toBe(10);
  });

  it('migrates schema-5 preferences with bench cover off, keeping the rest', async () => {
    const database = new FakePersistenceDatabase();
    const {
      autoSubs: _autoSubs,
      squadSort: _squadSort,
      climbCompleted: _climbCompleted,
      developerMode: _developerMode,
      ...schema5Base
    } = V9_ROW_LITERAL;
    const schema5Preferences = { ...schema5Base, managerTipsEnabled: true };
    database.preferencesRow = {
      schema_version: 5,
      preferences_json: JSON.stringify({
        ...schema5Preferences,
        hudSide: 'right',
        seenPowerCutIns: ['GRAVITY_WELL'],
      }),
    };
    const repository = await createPreferencesRepository(database);

    await expect(repository.load()).resolves.toEqual({
      ...DEFAULT_APP_PREFERENCES,
      hudSide: 'right',
      seenPowerCutIns: ['GRAVITY_WELL'],
      autoSubs: false,
    });
    expect(database.preferencesRow?.schema_version).toBe(10);
  });

  it('migrates schema-6 preferences to the roster order the club has not chosen yet', async () => {
    const database = new FakePersistenceDatabase();
    const {
      squadSort: _squadSort,
      climbCompleted: _climbCompleted,
      developerMode: _developerMode,
      ...schema6Base
    } = V9_ROW_LITERAL;
    const schema6Preferences = { ...schema6Base, managerTipsEnabled: true };
    database.preferencesRow = {
      schema_version: 6,
      preferences_json: JSON.stringify({ ...schema6Preferences, autoSubs: true }),
    };
    const repository = await createPreferencesRepository(database);

    await expect(repository.load()).resolves.toEqual({
      ...DEFAULT_APP_PREFERENCES,
      autoSubs: true,
      squadSort: null,
    });
    expect(database.preferencesRow?.schema_version).toBe(10);
  });

  it('keeps the roster ordering the manager picked', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createPreferencesRepository(database);
    const preferences: AppPreferences = {
      ...DEFAULT_APP_PREFERENCES,
      squadSort: { key: 'potential', direction: 'ascending' },
    };
    await repository.save(preferences);
    await expect(repository.load()).resolves.toEqual(preferences);
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

  it('defaults a fresh install to a locked climb and retires the narrow tips toggle', async () => {
    const repository = await createPreferencesRepository(new FakePersistenceDatabase());
    const preferences = await repository.load();

    expect(preferences.climbCompleted).toBe(false);
    expect('managerTipsEnabled' in preferences).toBe(false);
  });

  it('migrates a version 7 row by dropping the tips flag and locking the climb', async () => {
    const database = new FakePersistenceDatabase();
    database.preferencesRow = {
      schema_version: 7,
      preferences_json: JSON.stringify({
        formationPresets: ['4-4-2', '3-4-3', '5-3-2'],
        autoPowers: false,
        masterVolume: 1,
        reduceMotion: false,
        hudSide: 'left',
        hapticsEnabled: true,
        textScale: 1,
        highContrast: false,
        colorSafeKits: true,
        cutInMode: 'full',
        managerTipsEnabled: false,
        seenPowerCutIns: [],
        autoSubs: false,
        squadSort: null,
      }),
    };

    const repository = await createPreferencesRepository(database);
    const preferences = await repository.load();
    expect(preferences.climbCompleted).toBe(false);
    expect('managerTipsEnabled' in preferences).toBe(false);
    expect(database.preferencesRow?.schema_version).toBe(10);
  });

  it('round-trips a completed climb', async () => {
    const repository = await createPreferencesRepository(new FakePersistenceDatabase());
    const preferences = await repository.load();

    await repository.save({ ...preferences, climbCompleted: true });

    expect((await repository.load()).climbCompleted).toBe(true);
  });


  it('migrates a version 8 row with Developer Mode safely off', async () => {
    const database = new FakePersistenceDatabase();
    const { developerMode: _developerMode, ...schema8Preferences } = V9_ROW_LITERAL;
    database.preferencesRow = {
      schema_version: 8,
      preferences_json: JSON.stringify(schema8Preferences),
    };

    const repository = await createPreferencesRepository(database);

    await expect(repository.load()).resolves.toEqual(DEFAULT_APP_PREFERENCES);
    expect(database.preferencesRow?.schema_version).toBe(10);
  });

  it('migrates a version 9 row to English without disturbing anything else', async () => {
    const database = new FakePersistenceDatabase();
    database.preferencesRow = {
      schema_version: 9,
      preferences_json: JSON.stringify({
        ...V9_ROW_LITERAL,
        masterVolume: 0.5,
        hudSide: 'right',
        textScale: 1.3,
      }),
    };

    const repository = await createPreferencesRepository(database);
    const loaded = await repository.load();

    // The point of the frozen V9 schema: a real version-9 row keeps every
    // setting the player chose and merely gains a language.
    expect(loaded.language).toBe('en');
    expect(loaded.masterVolume).toBe(0.5);
    expect(loaded.hudSide).toBe('right');
    expect(loaded.textScale).toBe(1.3);
    expect(database.preferencesRow?.schema_version).toBe(10);
  });

  it('rejects a language tag we do not ship rather than quietly keeping it', async () => {
    const database = new FakePersistenceDatabase();
    database.preferencesRow = {
      schema_version: 10,
      preferences_json: JSON.stringify({ ...V9_ROW_LITERAL, language: 'pt' }),
    };

    const repository = await createPreferencesRepository(database);

    await expect(repository.load()).rejects.toThrow();
  });
});
