import type { AppPreferences, PreferencesRepository } from '../../persistence';
import { loadPreferencesFailSoft } from '../preferences';

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
});
