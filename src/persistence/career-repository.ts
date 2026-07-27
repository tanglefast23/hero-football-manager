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
  INSERT INTO career_save_backups (
    slot, schema_version, state_json, saved_season, saved_week, saved_career_seed
  )
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(slot) DO UPDATE SET
    schema_version = excluded.schema_version,
    state_json = excluded.state_json,
    saved_season = excluded.saved_season,
    saved_week = excluded.saved_week,
    saved_career_seed = excluded.saved_career_seed
`;
const LOAD_BACKUP_SQL = `
  SELECT schema_version, state_json, saved_season, saved_week, saved_career_seed
  FROM career_save_backups
  WHERE slot = ?
`;
const BACKUP_SUMMARY_SQL = `
  SELECT saved_season, saved_week, saved_career_seed
  FROM career_save_backups
  WHERE slot = ?
`;
const DELETE_BACKUP_SQL = 'DELETE FROM career_save_backups WHERE slot = ?';
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
  saved_career_seed: unknown;
}

/** Where in the career the backup generation was taken. */
export interface CareerBackupSummary {
  readonly season: number;
  readonly week: number;
}

/**
 * Which career the backup holds and where in it — the whole cache key for
 * deciding whether the stored copy is still the generation we want. A career
 * written before the seed column existed reads as null and is replaced.
 */
interface BackupGeneration extends CareerBackupSummary {
  readonly careerSeed: number | null;
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

/**
 * Production saves skip the serialize-side zod pass: it costs ~50-90ms of JS
 * thread per store action on device (measured; ~95% of serialize cost), the
 * state always came from the typed game module, and the next load still runs
 * the full parse with the backup generation intact. Dev and test builds keep
 * the check so a state bug surfaces where it is written.
 */
const VALIDATE_ON_SAVE = typeof __DEV__ === 'undefined' || __DEV__;

export async function createCareerRepository(
  database: PersistenceDatabase,
): Promise<CareerRepository> {
  await migrateDatabase(database);
  // Which career and season the backup generation holds. Read once so the common
  // save path stays a single INSERT instead of re-reading the stored state every
  // week, and only ever updated from a write that succeeded.
  let backedUp = await readBackupGeneration(database);

  async function writeBackup(state: GameState, liveJson: string): Promise<void> {
    try {
      // The live slot skips validation in production for speed, so an unnoticed
      // state bug would be copied straight into the generation meant to survive
      // it — both slots then fail the parse on load, and the only way out is
      // deleting the career. A backup is written about once a season, so this
      // one pays the full check. It runs inside the same catch as the write:
      // the live save has already succeeded here, and a backup that cannot be
      // validated must leave the previous generation in place rather than
      // report the week as lost.
      const backupJson = VALIDATE_ON_SAVE
        ? liveJson
        : serializeGameState(state, { validate: true });
      await database.runAsync(UPSERT_BACKUP_SQL, [
        BACKUP_SLOT,
        GAME_SCHEMA_VERSION,
        backupJson,
        state.season,
        state.week,
        state.careerSeed,
      ]);
      backedUp = {
        careerSeed: state.careerSeed,
        season: state.season,
        week: state.week,
      };
    } catch {
      // The live save already succeeded, so a failed backup must not report the
      // week as lost. `backedUp` stays put, so the next save retries.
    }
  }

  return {
    async save(state: GameState): Promise<void> {
      const stateJson = serializeGameState(state, { validate: VALIDATE_ON_SAVE });
      await database.runAsync(UPSERT_CAREER_SQL, [
        PRIMARY_SLOT,
        GAME_SCHEMA_VERSION,
        stateJson,
      ]);
      // A season boundary is the cadence: one generation back is never more than
      // the current season's play, and the copy is a state this build validated.
      // A different career is always a boundary — otherwise the career this one
      // replaced stays restorable, and season 1 of the new one would never
      // displace season 1 of the old.
      if (
        backedUp === null
        || backedUp.careerSeed !== state.careerSeed
        || backedUp.season !== state.season
      ) {
        await writeBackup(state, stateJson);
      }
    },

    async load(): Promise<GameState | null> {
      const row = await database.getFirstAsync<StoredCareerRow>(
        LOAD_CAREER_SQL,
        [PRIMARY_SLOT],
      );
      if (row === null) return null;
      return decodeStoredCareer(row);
    },

    /**
     * Both generations go, in one transaction. A discard is the player saying
     * this career is over, and a backup that outlived its live slot is a career
     * with no way back to it — still offered for restore over whatever is
     * played next.
     */
    async delete(): Promise<void> {
      await database.withTransactionAsync(async () => {
        await database.runAsync(DELETE_CAREER_SQL, [PRIMARY_SLOT]);
        await database.runAsync(DELETE_BACKUP_SQL, [BACKUP_SLOT]);
      });
      backedUp = null;
    },

    async backupSummary(): Promise<CareerBackupSummary | null> {
      const generation = await readBackupGeneration(database);
      return generation === null
        ? null
        : { season: generation.season, week: generation.week };
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
      backedUp = {
        careerSeed: restored.careerSeed,
        season: typeof row.saved_season === 'number' ? row.saved_season : restored.season,
        week: typeof row.saved_week === 'number' ? row.saved_week : restored.week,
      };
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

async function readBackupGeneration(
  database: PersistenceDatabase,
): Promise<BackupGeneration | null> {
  const row = await database.getFirstAsync<{
    saved_season: unknown;
    saved_week: unknown;
    saved_career_seed: unknown;
  }>(BACKUP_SUMMARY_SQL, [BACKUP_SLOT]);
  if (row === null) return null;
  if (!Number.isSafeInteger(row.saved_season) || !Number.isSafeInteger(row.saved_week)) {
    return null;
  }
  return {
    season: row.saved_season as number,
    week: row.saved_week as number,
    // A row written before the seed column existed names no career, so the next
    // save replaces it rather than trusting it to belong to the live slot.
    careerSeed: Number.isSafeInteger(row.saved_career_seed)
      ? (row.saved_career_seed as number)
      : null,
  };
}
