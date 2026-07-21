import {
  DEFAULT_APP_PREFERENCES,
  type AppPreferences,
  type PreferencesRepository,
} from '../persistence';
import type { PowerId } from '../sim/types';

export interface LoadedPreferences {
  preferences: AppPreferences;
  warning?: string;
}

function defaultPreferences(): AppPreferences {
  return {
    ...DEFAULT_APP_PREFERENCES,
    formationPresets: [...DEFAULT_APP_PREFERENCES.formationPresets],
    seenPowerCutIns: [...DEFAULT_APP_PREFERENCES.seenPowerCutIns],
  };
}

/** Keeps a damaged settings row from blocking an otherwise healthy career. */
export async function loadPreferencesFailSoft(
  repository: PreferencesRepository,
): Promise<LoadedPreferences> {
  try {
    return { preferences: await repository.load() };
  } catch {
    const preferences = defaultPreferences();
    try {
      await repository.save(preferences);
      return {
        preferences,
        warning: 'Saved settings were damaged and have been reset to defaults.',
      };
    } catch {
      return {
        preferences,
        warning: 'Saved settings could not be read. Defaults are active for this session.',
      };
    }
  }
}

export function markPowerCutInSeen(preferences: AppPreferences, power: PowerId): AppPreferences {
  if (preferences.seenPowerCutIns.includes(power)) return preferences;
  return {
    ...preferences,
    formationPresets: [...preferences.formationPresets],
    seenPowerCutIns: [...preferences.seenPowerCutIns, power],
  };
}
