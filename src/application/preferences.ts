import {
  DEFAULT_APP_PREFERENCES,
  InvalidPreferencesError,
  type AppPreferences,
  type PreferencesRepository,
} from '../persistence';
import type { PowerId } from '../sim/types';
import type { GameState } from '../game/types';
import { TRUE_ENDING_SEEN_FLAG } from './endgame-celebration';
import { copyFor, type CopyFn } from '../i18n';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

export interface LoadedPreferences {
  preferences: AppPreferences;
  /** False while session defaults stand in for settings we could not read. */
  canPersist: boolean;
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
  t: CopyFn = englishCopy(),
): Promise<LoadedPreferences> {
  try {
    return { preferences: await repository.load(), canPersist: true };
  } catch (error) {
    const preferences = defaultPreferences();
    if (error instanceof InvalidPreferencesError) {
      try {
        await repository.save(preferences);
        return {
          preferences,
          canPersist: true,
          warning: t('settings.savedSettingsWereDamaged'),
        };
      } catch {
        // A failed repair leaves defaults limited to this session too.
      }
    }
    return {
      preferences,
      canPersist: false,
      warning: t('settings.savedSettingsCouldNotBeRead'),
    };
  }
}

export function markPowerCutInSeen(
  preferences: AppPreferences,
  power: PowerId,
): AppPreferences {
  if (preferences.seenPowerCutIns.includes(power)) return preferences;
  return {
    ...preferences,
    formationPresets: [...preferences.formationPresets],
    seenPowerCutIns: [...preferences.seenPowerCutIns, power],
  };
}

/** Mirrors the career's true-ending proof into the device-level preference. */
export function rememberCompletedClimb(
  preferences: AppPreferences,
  career: Pick<GameState, 'eventFlags'> | null,
): AppPreferences {
  if (preferences.climbCompleted || career === null) return preferences;
  if (!career.eventFlags.includes(TRUE_ENDING_SEEN_FLAG)) return preferences;
  return { ...preferences, climbCompleted: true };
}
