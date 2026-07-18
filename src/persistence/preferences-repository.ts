import { z } from 'zod';
import {
  COACHING_FORMATION_IDS,
  DEFAULT_FORMATION_PRESETS,
  FORMATION_IDS,
  type FormationId,
} from '../sim/tactics';
import type { PersistenceDatabase } from './database';
import { migrateDatabase } from './migrations';

const PREFERENCES_SCHEMA_VERSION = 1;
const PRIMARY_SLOT = 1;

export type MasterVolume = 0 | 0.25 | 0.5 | 0.75 | 1;

export interface AppPreferences {
  formationPresets: [FormationId, FormationId, FormationId];
  autoPowers: boolean;
  masterVolume: MasterVolume;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  formationPresets: [...DEFAULT_FORMATION_PRESETS],
  autoPowers: false,
  masterVolume: 1,
};

const FormationSchema = z.enum(FORMATION_IDS);
const PreferencesSchema = z.strictObject({
  formationPresets: z.tuple([FormationSchema, FormationSchema, FormationSchema])
    .refine(values => new Set(values).size === 3, 'formation presets must be unique'),
  autoPowers: z.boolean(),
  masterVolume: z.union([z.literal(0), z.literal(0.25), z.literal(0.5), z.literal(0.75), z.literal(1)]),
});

const UPSERT_SQL = `
  INSERT INTO app_preferences (slot, schema_version, preferences_json)
  VALUES (?, ?, ?)
  ON CONFLICT(slot) DO UPDATE SET
    schema_version = excluded.schema_version,
    preferences_json = excluded.preferences_json
`;
const LOAD_SQL = `
  SELECT schema_version, preferences_json
  FROM app_preferences
  WHERE slot = ?
`;

interface StoredPreferencesRow {
  schema_version: unknown;
  preferences_json: unknown;
}

export interface PreferencesRepository {
  load(): Promise<AppPreferences>;
  save(preferences: AppPreferences): Promise<void>;
}

export async function createPreferencesRepository(
  database: PersistenceDatabase,
): Promise<PreferencesRepository> {
  await migrateDatabase(database);
  return {
    async load() {
      const row = await database.getFirstAsync<StoredPreferencesRow>(LOAD_SQL, [PRIMARY_SLOT]);
      if (row === null) return { ...DEFAULT_APP_PREFERENCES, formationPresets: [...DEFAULT_FORMATION_PRESETS] };
      if (row.schema_version !== PREFERENCES_SCHEMA_VERSION || typeof row.preferences_json !== 'string') {
        throw new Error('Saved settings use an unsupported or corrupt format.');
      }
      const parsed = PreferencesSchema.safeParse(JSON.parse(row.preferences_json));
      if (!parsed.success) throw new Error(`Saved settings are invalid: ${parsed.error.issues[0]?.message ?? 'unknown error'}`);
      return { ...parsed.data, formationPresets: [...parsed.data.formationPresets] };
    },
    async save(preferences) {
      const parsed = PreferencesSchema.parse(preferences);
      await database.runAsync(UPSERT_SQL, [PRIMARY_SLOT, PREFERENCES_SCHEMA_VERSION, JSON.stringify(parsed)]);
    },
  };
}

export function replaceFormationPreset(
  preferences: AppPreferences,
  slot: number,
): AppPreferences {
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) return preferences;
  const current = preferences.formationPresets[slot];
  const occupied = new Set(preferences.formationPresets.filter((_, index) => index !== slot));
  let index = COACHING_FORMATION_IDS.indexOf(current);
  do index = (index + 1) % COACHING_FORMATION_IDS.length;
  while (occupied.has(COACHING_FORMATION_IDS[index]));
  const formationPresets: [FormationId, FormationId, FormationId] = [...preferences.formationPresets];
  formationPresets[slot] = COACHING_FORMATION_IDS[index];
  return { ...preferences, formationPresets };
}
