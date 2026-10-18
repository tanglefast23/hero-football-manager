import {
  DEFAULT_APP_PREFERENCES,
  createPreferencesRepository,
  type AppPreferences,
  type PreferencesRepository,
} from '../../persistence';
import { createCareer } from '../../game';
import { FakePersistenceDatabase } from '../../persistence/__tests__/fake-database';
import { TRUE_ENDING_SEEN_FLAG } from '../endgame-celebration';
import { createLaunchCareerSetup } from '../launch';
import {
  loadPreferencesFailSoft,
  markPowerCutInSeen,
  rememberCompletedClimb,
} from '../preferences';

describe('fail-soft app preferences', () => {
  it('preserves saved preferences after a temporary read failure', async () => {
    let stored: AppPreferences = {
      ...DEFAULT_APP_PREFERENCES,
      masterVolume: 0,
      language: 'vi',
      reduceMotion: true,
      highContrast: true,
    };
    const original = stored;
    const repository: PreferencesRepository = {
      load: jest
        .fn()
        .mockRejectedValueOnce(new Error('SQLITE_BUSY'))
        .mockImplementation(async () => stored),
      save: jest.fn(async (preferences) => {
        stored = preferences;
      }),
    };

    const result = await loadPreferencesFailSoft(repository);

    expect(repository.save).not.toHaveBeenCalled();
    expect(result.canPersist).toBe(false);
    expect(stored).toBe(original);
    expect(result.warning).toContain('this session');
    const recovered = await loadPreferencesFailSoft(repository);
    expect(recovered.preferences).toEqual(original);
    expect(recovered.canPersist).toBe(true);
  });

  it.each([
    { schema_version: 10, preferences_json: '{' },
    { schema_version: 10, preferences_json: 42 },
    { schema_version: 10, preferences_json: '{"masterVolume":7}' },
    { schema_version: 1, preferences_json: '{"masterVolume":7}' },
  ])(
    'resets damaged preferences without blocking the career boot: %j',
    async (row) => {
      const database = new FakePersistenceDatabase();
      const repository = await createPreferencesRepository(database);
      database.preferencesRow = row;

      const result = await loadPreferencesFailSoft(repository);

      expect(result.preferences).toEqual({
        formationPresets: ['4-4-2', '3-4-3', '5-3-2'],
        autoPowers: false,
        quickMatchEnabled: false,
        masterVolume: 1,
        performanceLimit: null,
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
        language: 'en',
        // A reset row has genuinely never been offered the device's language,
        // so the offer fires on the next launch. That is the intended repair.
        languageOffered: false,
      });
      expect(
        JSON.parse(database.preferencesRow!.preferences_json as string),
      ).toEqual(result.preferences);
      expect(result.warning).toContain('reset to defaults');
      expect(result.canPersist).toBe(true);
    },
  );

  it('uses session defaults when even the repair write fails', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createPreferencesRepository(database);
    database.preferencesRow = { schema_version: 10, preferences_json: '{' };
    database.writesFail = true;

    const result = await loadPreferencesFailSoft(repository);

    expect(result.preferences.masterVolume).toBe(1);
    expect(result.canPersist).toBe(false);
    expect(result.warning).toContain('this session');
  });

  it.each([
    '{',
    42,
    JSON.stringify({ ...DEFAULT_APP_PREFERENCES, masterVolume: 0 }),
  ])('preserves a settings row from a newer schema: %j', async (payload) => {
    const database = new FakePersistenceDatabase();
    const repository = await createPreferencesRepository(database);
    const row = {
      schema_version: 11,
      preferences_json: payload,
    };
    database.preferencesRow = row;

    const result = await loadPreferencesFailSoft(repository);

    expect(database.preferencesRow).toBe(row);
    expect(result.canPersist).toBe(false);
    expect(result.warning).toContain('this session');
  });

  it('composes first-view cut-in history without duplicates', () => {
    const first = markPowerCutInSeen(DEFAULT_APP_PREFERENCES, 'SUPER_SPEED');
    const second = markPowerCutInSeen(first, 'WEB_TRAP');

    expect(second.seenPowerCutIns).toEqual(['SUPER_SPEED', 'WEB_TRAP']);
    expect(markPowerCutInSeen(second, 'SUPER_SPEED')).toBe(second);
  });

  it('backfills the completed climb from an existing career and stays idempotent', () => {
    const career = createCareer(createLaunchCareerSetup(20260804));
    const finished = {
      ...career,
      eventFlags: [...career.eventFlags, TRUE_ENDING_SEEN_FLAG],
    };

    expect(rememberCompletedClimb(DEFAULT_APP_PREFERENCES, career)).toBe(
      DEFAULT_APP_PREFERENCES,
    );
    const remembered = rememberCompletedClimb(
      DEFAULT_APP_PREFERENCES,
      finished,
    );
    expect(remembered.climbCompleted).toBe(true);
    expect(rememberCompletedClimb(remembered, finished)).toBe(remembered);
  });
});
