import { z } from 'zod';
import {
  COACHING_FORMATION_IDS,
  DEFAULT_FORMATION_PRESETS,
  FORMATION_IDS,
  isFormationId,
  type FormationId,
} from '../sim/tactics';
import type { PersistenceDatabase } from './database';
import type { PowerId } from '../sim/types';
import { migrateDatabase } from './migrations';

const PREFERENCES_SCHEMA_VERSION = 9;
const LEGACY_PREFERENCES_SCHEMA_VERSION = 1;
const M2_PREFERENCES_SCHEMA_VERSION = 2;
const M4_PREFERENCES_SCHEMA_VERSION = 3;
const CUT_IN_HISTORY_PREFERENCES_SCHEMA_VERSION = 4;
const MANAGER_TIPS_PREFERENCES_SCHEMA_VERSION = 5;
const AUTO_SUBS_PREFERENCES_SCHEMA_VERSION = 6;
const SQUAD_SORT_PREFERENCES_SCHEMA_VERSION = 7;
const CLIMB_COMPLETED_PREFERENCES_SCHEMA_VERSION = 8;
const PRIMARY_SLOT = 1;

export type MasterVolume = 0 | 0.25 | 0.5 | 0.75 | 1;
export type HudSide = 'left' | 'right';
export type TextScale = 1 | 1.15 | 1.3;
export type CutInMode = 'full' | 'banner';
export const SQUAD_SORT_KEYS = ['role', 'player', 'overall', 'potential', 'condition'] as const;
export type SquadSortKey = (typeof SQUAD_SORT_KEYS)[number];
export type SquadSortDirection = 'descending' | 'ascending';

/** How the squad list is ordered. Null is the roster's own order. */
export interface SquadSort {
  key: SquadSortKey;
  direction: SquadSortDirection;
}

export interface AppPreferences {
  formationPresets: [FormationId, FormationId, FormationId];
  autoPowers: boolean;
  masterVolume: MasterVolume;
  reduceMotion: boolean;
  hudSide: HudSide;
  hapticsEnabled: boolean;
  textScale: TextScale;
  highContrast: boolean;
  colorSafeKits: boolean;
  cutInMode: CutInMode;
  /** Device-level proof used to offer the veteran-only new-career choice. */
  climbCompleted: boolean;
  seenPowerCutIns: PowerId[];
  /** Bench cover during a watched match, remembered between matches. */
  autoSubs: boolean;
  /** Squad list ordering, remembered between visits and between sessions. */
  squadSort: SquadSort | null;
  /** Debug-build-only switch for developer save controls. */
  developerMode: boolean;
}

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  formationPresets: [...DEFAULT_FORMATION_PRESETS],
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
};

const FormationSchema = z.enum(FORMATION_IDS);
// Retired ids stay parseable so an older install's settings row still loads;
// they are dropped on the way through rather than rejected.
const RETIRED_POWER_IDS = ['MAGNET_TOUCH'] as const;
const PowerIdSchema = z.enum([
  'SUPER_SPEED', 'BLINK_RUN', 'THUNDER_STRIKE', 'FIRE_TORCH', 'PHASE_RUN', 'PORTAL_PASS',
  'DECOY_DOUBLE', 'FUTURE_SIGHT', 'SUPER_STRENGTH', 'WEB_TRAP', 'ELASTIC_KEEPER',
  'RALLY_CRY', 'ICE_RINK', 'SHADOW_MARK', 'GRAVITY_WELL', 'GIANT_GK', 'GUST',
]);
const StoredPowerIdSchema = z.enum([...PowerIdSchema.options, ...RETIRED_POWER_IDS]);
const PreferencesSchema = z.strictObject({
  formationPresets: z.tuple([FormationSchema, FormationSchema, FormationSchema])
    .refine(values => new Set(values).size === 3, 'formation presets must be unique'),
  autoPowers: z.boolean(),
  masterVolume: z.union([z.literal(0), z.literal(0.25), z.literal(0.5), z.literal(0.75), z.literal(1)]),
  reduceMotion: z.boolean(),
  hudSide: z.enum(['left', 'right']),
  hapticsEnabled: z.boolean(),
  textScale: z.union([z.literal(1), z.literal(1.15), z.literal(1.3)]),
  highContrast: z.boolean(),
  colorSafeKits: z.boolean(),
  cutInMode: z.enum(['full', 'banner']),
  climbCompleted: z.boolean(),
  seenPowerCutIns: z.array(StoredPowerIdSchema).max(20)
    .transform(ids => ids.filter((id): id is z.infer<typeof PowerIdSchema> => (
      !(RETIRED_POWER_IDS as readonly string[]).includes(id)
    )))
    .refine(values => new Set(values).size === values.length, 'seen power cut-ins must be unique'),
  autoSubs: z.boolean(),
  squadSort: z.union([
    z.null(),
    z.strictObject({
      key: z.enum(SQUAD_SORT_KEYS),
      direction: z.enum(['descending', 'ascending']),
    }),
  ]),
  developerMode: z.boolean(),
});
const LegacyPreferencesSchema = PreferencesSchema.pick({
  formationPresets: true,
  autoPowers: true,
  masterVolume: true,
});
const M2PreferencesSchema = PreferencesSchema.pick({
  formationPresets: true,
  autoPowers: true,
  masterVolume: true,
  reduceMotion: true,
  hudSide: true,
});
const RetiredTipsShape = { managerTipsEnabled: z.boolean() };
const M4PreferencesSchema = PreferencesSchema.omit({
  seenPowerCutIns: true,
  autoSubs: true,
  squadSort: true,
  climbCompleted: true,
  developerMode: true,
});
const CutInHistoryPreferencesSchema = PreferencesSchema.omit({
  autoSubs: true,
  squadSort: true,
  climbCompleted: true,
  developerMode: true,
});
const ManagerTipsPreferencesSchema = PreferencesSchema
  .omit({ autoSubs: true, squadSort: true, climbCompleted: true, developerMode: true })
  .extend(RetiredTipsShape);
const AutoSubsPreferencesSchema = PreferencesSchema
  .omit({ squadSort: true, climbCompleted: true, developerMode: true })
  .extend(RetiredTipsShape);
const SquadSortPreferencesSchema = PreferencesSchema
  .omit({ climbCompleted: true, developerMode: true })
  .extend(RetiredTipsShape);
const ClimbCompletedPreferencesSchema = PreferencesSchema.omit({ developerMode: true });

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
      if (row === null) return clonePreferences(DEFAULT_APP_PREFERENCES);
      if (typeof row.preferences_json !== 'string') {
        throw new Error('Saved settings use an unsupported or corrupt format.');
      }
      const decoded = JSON.parse(row.preferences_json);
      if (row.schema_version === LEGACY_PREFERENCES_SCHEMA_VERSION) {
        const legacy = LegacyPreferencesSchema.safeParse(decoded);
        if (!legacy.success) {
          throw new Error(`Saved settings are invalid: ${legacy.error.issues[0]?.message ?? 'unknown error'}`);
        }
        const migrated: AppPreferences = {
          ...legacy.data,
          formationPresets: [...legacy.data.formationPresets],
          reduceMotion: DEFAULT_APP_PREFERENCES.reduceMotion,
          hudSide: DEFAULT_APP_PREFERENCES.hudSide,
          hapticsEnabled: DEFAULT_APP_PREFERENCES.hapticsEnabled,
          textScale: DEFAULT_APP_PREFERENCES.textScale,
          highContrast: DEFAULT_APP_PREFERENCES.highContrast,
          colorSafeKits: DEFAULT_APP_PREFERENCES.colorSafeKits,
          cutInMode: DEFAULT_APP_PREFERENCES.cutInMode,
          climbCompleted: DEFAULT_APP_PREFERENCES.climbCompleted,
          seenPowerCutIns: [...DEFAULT_APP_PREFERENCES.seenPowerCutIns],
          autoSubs: DEFAULT_APP_PREFERENCES.autoSubs,
          squadSort: DEFAULT_APP_PREFERENCES.squadSort,
          developerMode: DEFAULT_APP_PREFERENCES.developerMode,
        };
        await database.runAsync(UPSERT_SQL, [
          PRIMARY_SLOT,
          PREFERENCES_SCHEMA_VERSION,
          JSON.stringify(migrated),
        ]);
        return migrated;
      }
      if (row.schema_version === M2_PREFERENCES_SCHEMA_VERSION) {
        const legacy = M2PreferencesSchema.safeParse(decoded);
        if (!legacy.success) {
          throw new Error(`Saved settings are invalid: ${legacy.error.issues[0]?.message ?? 'unknown error'}`);
        }
        const migrated: AppPreferences = {
          ...legacy.data,
          formationPresets: [...legacy.data.formationPresets],
          hapticsEnabled: DEFAULT_APP_PREFERENCES.hapticsEnabled,
          textScale: DEFAULT_APP_PREFERENCES.textScale,
          highContrast: DEFAULT_APP_PREFERENCES.highContrast,
          colorSafeKits: DEFAULT_APP_PREFERENCES.colorSafeKits,
          cutInMode: DEFAULT_APP_PREFERENCES.cutInMode,
          climbCompleted: DEFAULT_APP_PREFERENCES.climbCompleted,
          seenPowerCutIns: [...DEFAULT_APP_PREFERENCES.seenPowerCutIns],
          autoSubs: DEFAULT_APP_PREFERENCES.autoSubs,
          squadSort: DEFAULT_APP_PREFERENCES.squadSort,
          developerMode: DEFAULT_APP_PREFERENCES.developerMode,
        };
        await database.runAsync(UPSERT_SQL, [
          PRIMARY_SLOT,
          PREFERENCES_SCHEMA_VERSION,
          JSON.stringify(migrated),
        ]);
        return migrated;
      }
      if (row.schema_version === M4_PREFERENCES_SCHEMA_VERSION) {
        const legacy = M4PreferencesSchema.safeParse(decoded);
        if (!legacy.success) {
          throw new Error(`Saved settings are invalid: ${legacy.error.issues[0]?.message ?? 'unknown error'}`);
        }
        const migrated: AppPreferences = {
          ...legacy.data,
          formationPresets: [...legacy.data.formationPresets],
          climbCompleted: DEFAULT_APP_PREFERENCES.climbCompleted,
          seenPowerCutIns: [...DEFAULT_APP_PREFERENCES.seenPowerCutIns],
          autoSubs: DEFAULT_APP_PREFERENCES.autoSubs,
          squadSort: DEFAULT_APP_PREFERENCES.squadSort,
          developerMode: DEFAULT_APP_PREFERENCES.developerMode,
        };
        await database.runAsync(UPSERT_SQL, [
          PRIMARY_SLOT,
          PREFERENCES_SCHEMA_VERSION,
          JSON.stringify(migrated),
        ]);
        return migrated;
      }
      if (row.schema_version === CUT_IN_HISTORY_PREFERENCES_SCHEMA_VERSION) {
        const legacy = CutInHistoryPreferencesSchema.safeParse(decoded);
        if (!legacy.success) {
          throw new Error(`Saved settings are invalid: ${legacy.error.issues[0]?.message ?? 'unknown error'}`);
        }
        const migrated: AppPreferences = {
          ...legacy.data,
          formationPresets: [...legacy.data.formationPresets],
          climbCompleted: DEFAULT_APP_PREFERENCES.climbCompleted,
          seenPowerCutIns: [...legacy.data.seenPowerCutIns],
          autoSubs: DEFAULT_APP_PREFERENCES.autoSubs,
          squadSort: DEFAULT_APP_PREFERENCES.squadSort,
          developerMode: DEFAULT_APP_PREFERENCES.developerMode,
        };
        await database.runAsync(UPSERT_SQL, [
          PRIMARY_SLOT,
          PREFERENCES_SCHEMA_VERSION,
          JSON.stringify(migrated),
        ]);
        return migrated;
      }
      if (row.schema_version === MANAGER_TIPS_PREFERENCES_SCHEMA_VERSION) {
        const legacy = ManagerTipsPreferencesSchema.safeParse(decoded);
        if (!legacy.success) {
          throw new Error(`Saved settings are invalid: ${legacy.error.issues[0]?.message ?? 'unknown error'}`);
        }
        const { managerTipsEnabled: _retired, ...carried } = legacy.data;
        const migrated: AppPreferences = {
          ...carried,
          formationPresets: [...legacy.data.formationPresets],
          seenPowerCutIns: [...legacy.data.seenPowerCutIns],
          autoSubs: DEFAULT_APP_PREFERENCES.autoSubs,
          squadSort: DEFAULT_APP_PREFERENCES.squadSort,
          climbCompleted: DEFAULT_APP_PREFERENCES.climbCompleted,
          developerMode: DEFAULT_APP_PREFERENCES.developerMode,
        };
        await database.runAsync(UPSERT_SQL, [
          PRIMARY_SLOT,
          PREFERENCES_SCHEMA_VERSION,
          JSON.stringify(migrated),
        ]);
        return migrated;
      }
      if (row.schema_version === AUTO_SUBS_PREFERENCES_SCHEMA_VERSION) {
        const legacy = AutoSubsPreferencesSchema.safeParse(decoded);
        if (!legacy.success) {
          throw new Error(`Saved settings are invalid: ${legacy.error.issues[0]?.message ?? 'unknown error'}`);
        }
        const { managerTipsEnabled: _retired, ...carried } = legacy.data;
        const migrated: AppPreferences = {
          ...carried,
          formationPresets: [...legacy.data.formationPresets],
          seenPowerCutIns: [...legacy.data.seenPowerCutIns],
          squadSort: DEFAULT_APP_PREFERENCES.squadSort,
          climbCompleted: DEFAULT_APP_PREFERENCES.climbCompleted,
          developerMode: DEFAULT_APP_PREFERENCES.developerMode,
        };
        await database.runAsync(UPSERT_SQL, [
          PRIMARY_SLOT,
          PREFERENCES_SCHEMA_VERSION,
          JSON.stringify(migrated),
        ]);
        return migrated;
      }
      if (row.schema_version === SQUAD_SORT_PREFERENCES_SCHEMA_VERSION) {
        const legacy = SquadSortPreferencesSchema.safeParse(decoded);
        if (!legacy.success) {
          throw new Error(`Saved settings are invalid: ${legacy.error.issues[0]?.message ?? 'unknown error'}`);
        }
        const { managerTipsEnabled: _retired, ...carried } = legacy.data;
        const migrated: AppPreferences = {
          ...carried,
          formationPresets: [...legacy.data.formationPresets],
          seenPowerCutIns: [...legacy.data.seenPowerCutIns],
          squadSort: legacy.data.squadSort === null ? null : { ...legacy.data.squadSort },
          climbCompleted: DEFAULT_APP_PREFERENCES.climbCompleted,
          developerMode: DEFAULT_APP_PREFERENCES.developerMode,
        };
        await database.runAsync(UPSERT_SQL, [
          PRIMARY_SLOT,
          PREFERENCES_SCHEMA_VERSION,
          JSON.stringify(migrated),
        ]);
        return migrated;
      }
      if (row.schema_version === CLIMB_COMPLETED_PREFERENCES_SCHEMA_VERSION) {
        const legacy = ClimbCompletedPreferencesSchema.safeParse(decoded);
        if (!legacy.success) {
          throw new Error(`Saved settings are invalid: ${legacy.error.issues[0]?.message ?? 'unknown error'}`);
        }
        const migrated: AppPreferences = {
          ...legacy.data,
          formationPresets: [...legacy.data.formationPresets],
          seenPowerCutIns: [...legacy.data.seenPowerCutIns],
          squadSort: legacy.data.squadSort === null ? null : { ...legacy.data.squadSort },
          developerMode: DEFAULT_APP_PREFERENCES.developerMode,
        };
        await database.runAsync(UPSERT_SQL, [
          PRIMARY_SLOT,
          PREFERENCES_SCHEMA_VERSION,
          JSON.stringify(migrated),
        ]);
        return migrated;
      }
      if (row.schema_version !== PREFERENCES_SCHEMA_VERSION) {
        throw new Error('Saved settings use an unsupported or corrupt format.');
      }
      const parsed = PreferencesSchema.safeParse(decoded);
      if (!parsed.success) throw new Error(`Saved settings are invalid: ${parsed.error.issues[0]?.message ?? 'unknown error'}`);
      return clonePreferences(parsed.data);
    },
    async save(preferences) {
      const parsed = PreferencesSchema.parse(preferences);
      await database.runAsync(UPSERT_SQL, [PRIMARY_SLOT, PREFERENCES_SCHEMA_VERSION, JSON.stringify(parsed)]);
    },
  };
}

function clonePreferences(preferences: AppPreferences): AppPreferences {
  return {
    ...preferences,
    formationPresets: [...preferences.formationPresets],
    seenPowerCutIns: [...preferences.seenPowerCutIns],
    squadSort: preferences.squadSort === null ? null : { ...preferences.squadSort },
  };
}

export function replaceFormationPreset(
  preferences: AppPreferences,
  slot: number,
  coachUnlockedFormationIds: readonly string[] = [],
): AppPreferences {
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) return preferences;
  const available = availableFormationIds(preferences, coachUnlockedFormationIds);
  const current = preferences.formationPresets[slot];
  let index = available.indexOf(current);
  index = (index + 1) % available.length;
  const next = available[index];
  const formationPresets: [FormationId, FormationId, FormationId] = [...preferences.formationPresets];
  const occupiedSlot = formationPresets.indexOf(next);
  formationPresets[slot] = next;
  // When every available base formation already occupies one of the three
  // slots, tapping still reorders the live-match cycle instead of doing
  // nothing. A newly taught fourth shape simply replaces the selected slot.
  if (occupiedSlot >= 0 && occupiedSlot !== slot) formationPresets[occupiedSlot] = current;
  return { ...preferences, formationPresets };
}

/**
 * Settings exposes the proven base shapes plus formations taught by a hired
 * coach. A formation already present in an older settings row is retained as
 * a grandfathered choice so loading a save never silently rewrites its match
 * tactics. Unknown content IDs are ignored at this pure persistence boundary.
 */
export function availableFormationIds(
  preferences: AppPreferences,
  coachUnlockedFormationIds: readonly string[] = [],
): FormationId[] {
  const available = new Set<FormationId>(DEFAULT_FORMATION_PRESETS);
  for (const formation of coachUnlockedFormationIds) {
    if (isFormationId(formation) && COACHING_FORMATION_IDS.includes(formation)) {
      available.add(formation);
    }
  }
  for (const formation of preferences.formationPresets) available.add(formation);
  return FORMATION_IDS.filter(formation => available.has(formation));
}
