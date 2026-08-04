import { DEFAULT_APP_PREFERENCES, type AppPreferences, type PreferencesRepository } from '../../persistence';
import { createCareer } from '../../game';
import { TRUE_ENDING_SEEN_FLAG } from '../endgame-celebration';
import { createLaunchCareerSetup } from '../launch';
import { loadPreferencesFailSoft, markPowerCutInSeen, rememberCompletedClimb } from '../preferences';

describe('fail-soft app preferences', () => {
  it('resets damaged preferences without blocking the career boot', async () => {
    let saved: AppPreferences | undefined;
    const repository: PreferencesRepository = {
      async load() { throw new Error('corrupt JSON'); },
      async save(preferences) { saved = preferences; },
    };

    const result = await loadPreferencesFailSoft(repository);

    expect(result.preferences).toEqual({
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
    });
    expect(saved).toEqual(result.preferences);
    expect(result.warning).toContain('reset to defaults');
  });

  it('uses session defaults when even the repair write fails', async () => {
    const repository: PreferencesRepository = {
      async load() { throw new Error('corrupt JSON'); },
      async save() { throw new Error('database locked'); },
    };

    const result = await loadPreferencesFailSoft(repository);

    expect(result.preferences.masterVolume).toBe(1);
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

    expect(rememberCompletedClimb(DEFAULT_APP_PREFERENCES, career))
      .toBe(DEFAULT_APP_PREFERENCES);
    const remembered = rememberCompletedClimb(DEFAULT_APP_PREFERENCES, finished);
    expect(remembered.climbCompleted).toBe(true);
    expect(rememberCompletedClimb(remembered, finished)).toBe(remembered);
  });
});
