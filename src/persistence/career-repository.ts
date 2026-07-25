import { GAME_SCHEMA_VERSION, type GameState } from '../game/types';
import type { PersistenceDatabase } from './database';
import {
  CorruptCareerSaveError,
  MissingCareerBackupError,
  UnsupportedGameSchemaError,
} from './errors';
import { parseStoredGameState, serializeGameState } from './game-state-codec';
import { migrateDatabase } from './migrations';

const PRIMARY_SLOT = 1;
const BACKUP_SLOT = 1;
const UPSERT_CAREER_SQL = `
  INSERT INTO career_saves (slot, schema_version, state_json)
  VALUES (?, ?, ?)
  ON CONFLICT(slot) DO UPDATE SET
    schema_version = excluded.schema_version,
    state_json = excluded.state_json
`;
const LOAD_CAREER_SQL = `
  SELECT schema_version, state_json
  FROM career_saves
  WHERE slot = ?
`;
const DELETE_CAREER_SQL = 'DELETE FROM career_saves WHERE slot = ?';
const UPSERT_BACKUP_SQL = `
  INSERT INTO career_save_backups (slot, schema_version, state_json, saved_season, saved_week)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(slot) DO UPDATE SET
    schema_version = excluded.schema_version,
    state_json = excluded.state_json,
    saved_season = excluded.saved_season,
    saved_week = excluded.saved_week
`;
const LOAD_BACKUP_SQL = `
  SELECT schema_version, state_json, saved_season, saved_week
  FROM career_save_backups
  WHERE slot = ?
`;
const BACKUP_SUMMARY_SQL = `
  SELECT saved_season, saved_week
  FROM career_save_backups
  WHERE slot = ?
`;
// quick_check skips the (much slower) full index cross-check but still reads
// every page, which is what tells a damaged file apart from an unreadable save.
const INTEGRITY_CHECK_SQL = 'PRAGMA quick_check';

interface StoredCareerRow {
  schema_version: unknown;
  state_json: unknown;
}

interface StoredBackupRow extends StoredCareerRow {
  saved_season: unknown;
  saved_week: unknown;
}

/** Where in the career the backup generation was taken. */
export interface CareerBackupSummary {
  readonly season: number;
  readonly week: number;
}

export interface CareerRepository {
  save(state: GameState): Promise<void>;
  load(): Promise<GameState | null>;
  delete(): Promise<void>;
  /** Describes the previous-generation copy, or null when there is none. */
  backupSummary(): Promise<CareerBackupSummary | null>;
  /**
   * Promotes the backup generation to the live slot and returns it. Throws
   * without touching the live slot when there is no readable backup.
   */
  restoreBackup(): Promise<GameState>;
  /** False when SQLite reports the database file itself is damaged. */
  checkIntegrity(): Promise<boolean>;
}

export async function createCareerRepository(
  database: PersistenceDatabase,
): Promise<CareerRepository> {
  await migrateDatabase(database);
  // Which season the backup generation holds. Read once so the common save path
  // stays a single INSERT instead of re-reading the stored state every week.
  let backedUpSeason = (await readBackupSummary(database))?.season;

  async function writeBackup(state: GameState, stateJson: string): Promise<void> {
    try {
      await database.runAsync(UPSERT_BACKUP_SQL, [
        BACKUP_SLOT,
        GAME_SCHEMA_VERSION,
        stateJson,
        state.season,
        state.week,
      ]);
      backedUpSeason = state.season;
    } catch {
      // The live save already succeeded, so a failed backup must not report the
      // week as lost. `backedUpSeason` stays put, so the next save retries.
    }
  }

  return {
    async save(state: GameState): Promise<void> {
      const stateJson = serializeGameState(state);
      await database.runAsync(UPSERT_CAREER_SQL, [
        PRIMARY_SLOT,
        GAME_SCHEMA_VERSION,
        stateJson,
      ]);
      // A season boundary is the cadence: one generation back is never more than
      // the current season's play, and the copy is a state this build validated.
      if (state.season !== backedUpSeason) await writeBackup(state, stateJson);
    },

    async load(): Promise<GameState | null> {
      const row = await database.getFirstAsync<StoredCareerRow>(
        LOAD_CAREER_SQL,
        [PRIMARY_SLOT],
      );
      if (row === null) return null;
      return decodeStoredCareer(row);
    },

    async delete(): Promise<void> {
      await database.runAsync(DELETE_CAREER_SQL, [PRIMARY_SLOT]);
    },

    async backupSummary(): Promise<CareerBackupSummary | null> {
      return readBackupSummary(database);
    },

    async restoreBackup(): Promise<GameState> {
      const row = await database.getFirstAsync<StoredBackupRow>(LOAD_BACKUP_SQL, [
        BACKUP_SLOT,
      ]);
      if (row === null) throw new MissingCareerBackupError();
      const restored = decodeStoredCareer(row);
      // Re-serialise before overwriting: if the backup cannot be written back as
      // a live save, the unreadable live slot is still better than no slot.
      const stateJson = serializeGameState(restored);
      await database.runAsync(UPSERT_CAREER_SQL, [
        PRIMARY_SLOT,
        GAME_SCHEMA_VERSION,
        stateJson,
      ]);
      backedUpSeason = typeof row.saved_season === 'number'
        ? row.saved_season
        : restored.season;
      return restored;
    },

    async checkIntegrity(): Promise<boolean> {
      const row = await database.getFirstAsync<{ quick_check?: unknown }>(
        INTEGRITY_CHECK_SQL,
        [],
      );
      return row?.quick_check === 'ok';
    },
  };
}

function decodeStoredCareer(row: StoredCareerRow): GameState {
  if (!Number.isSafeInteger(row.schema_version) || (row.schema_version as number) < 1) {
    throw new CorruptCareerSaveError(
      'schema_version column is missing or invalid',
    );
  }
  // Older rows are handed to the codec, which walks them up the save-migration
  // ladder. Only a row from a newer build is refused: nothing here can invent
  // the meaning of a field this build has never seen.
  if ((row.schema_version as number) > GAME_SCHEMA_VERSION) {
    throw new UnsupportedGameSchemaError(
      row.schema_version as number,
      GAME_SCHEMA_VERSION,
    );
  }
  if (typeof row.state_json !== 'string') {
    throw new CorruptCareerSaveError('state_json column is not text');
  }
  return parseStoredGameState(row.state_json);
}

async function readBackupSummary(
  database: PersistenceDatabase,
): Promise<CareerBackupSummary | null> {
  const row = await database.getFirstAsync<{
    saved_season: unknown;
    saved_week: unknown;
  }>(BACKUP_SUMMARY_SQL, [BACKUP_SLOT]);
  if (row === null) return null;
  if (!Number.isSafeInteger(row.saved_season) || !Number.isSafeInteger(row.saved_week)) {
    return null;
  }
  return { season: row.saved_season as number, week: row.saved_week as number };
}
