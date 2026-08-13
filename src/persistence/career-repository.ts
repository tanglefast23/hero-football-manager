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
const DELETE_CAREER_REPLAYS_SQL =
  'DELETE FROM replay_envelopes WHERE career_id = ?';
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

export interface RawStoredCareer {
  readonly schemaVersion: number;
  /** Exact state_json text from SQLite; no game-schema decode has run. */
  readonly stateJson: string;
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
  /** Reads the live payload without decoding its game schema. */
  loadRaw(): Promise<RawStoredCareer | null>;
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
  // Which boundary a backup write has been ATTEMPTED for, successfully or not.
  // `backedUp` alone cannot say: a rejected write leaves it behind, the season
  // boundary test stays true, and every later save retries — in a release build
  // that is a full serialize-with-validation (~200ms) on every player action for
  // the rest of the career. One attempt per boundary; the next genuine boundary
  // still tries, so a disk that frees up is picked up at the next season.
  let backupAttempted: BackupGeneration | null = null;

  async function readRawCareer(): Promise<RawStoredCareer | null> {
    const row = await database.getFirstAsync<StoredCareerRow>(LOAD_CAREER_SQL, [
      PRIMARY_SLOT,
    ]);
    if (row === null) return null;
    if (
      !Number.isSafeInteger(row.schema_version) ||
      (row.schema_version as number) < 1
    ) {
      throw new CorruptCareerSaveError(
        'schema_version column is missing or invalid',
      );
    }
    if (typeof row.state_json !== 'string') {
      throw new CorruptCareerSaveError('state_json column is not text');
    }
    return {
      schemaVersion: row.schema_version as number,
      stateJson: row.state_json,
    };
  }

  async function writeBackup(
    state: GameState,
    liveJson: string,
  ): Promise<void> {
    backupAttempted = {
      careerSeed: state.careerSeed,
      season: state.season,
      week: state.week,
    };
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
      // week as lost. `backedUp` stays put and `backupAttempted` now names this
      // boundary, so the retry waits for the next season rather than running on
      // every save for the rest of the career.
    }
  }

  return {
    async save(state: GameState): Promise<void> {
      const stateJson = serializeGameState(state, {
        validate: VALIDATE_ON_SAVE,
      });
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
        !isBackupBoundaryFor(backedUp, state) &&
        !isBackupBoundaryFor(backupAttempted, state)
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

    async loadRaw(): Promise<RawStoredCareer | null> {
      return readRawCareer();
    },

    /**
     * Both generations go, in one transaction. A discard is the player saying
     * this career is over, and a backup that outlived its live slot is a career
     * with no way back to it — still offered for restore over whatever is
     * played next.
     */
    async delete(): Promise<void> {
      const raw = await readRawCareer();
      const backup = await readBackupGeneration(database);
      const careerSeeds = new Set<number>();
      const liveSeed = raw === null ? null : rawCareerSeed(raw.stateJson);
      if (liveSeed !== null) careerSeeds.add(liveSeed);
      if (backup?.careerSeed !== null && backup?.careerSeed !== undefined) {
        careerSeeds.add(backup.careerSeed);
      }
      await database.withTransactionAsync(async () => {
        for (const careerSeed of careerSeeds) {
          await database.runAsync(DELETE_CAREER_REPLAYS_SQL, [
            `m1-career-${careerSeed}`,
          ]);
        }
        await database.runAsync(DELETE_CAREER_SQL, [PRIMARY_SLOT]);
        await database.runAsync(DELETE_BACKUP_SQL, [BACKUP_SLOT]);
      });
      backedUp = null;
      backupAttempted = null;
    },

    /**
     * The summary is what puts "Restore backup — Season N, Week M" on the
     * unreadable-save screen, and that button is the only rescue the player is
     * offered there. Answering from the three integer columns alone cannot fail
     * for the reason the stored state fails, so the button could be offered for
     * a blob that then refuses to restore — the career appearing to be lost
     * twice. Decoding costs a full parse, which is why nothing calls this until
     * the live slot has already failed.
     */
    async backupSummary(): Promise<CareerBackupSummary | null> {
      const row = await database.getFirstAsync<StoredBackupRow>(
        LOAD_BACKUP_SQL,
        [BACKUP_SLOT],
      );
      if (row === null) return null;
      let restored: GameState;
      try {
        restored = decodeStoredCareer(row);
      } catch {
        return null;
      }
      return {
        season:
          typeof row.saved_season === 'number'
            ? row.saved_season
            : restored.season,
        week:
          typeof row.saved_week === 'number' ? row.saved_week : restored.week,
      };
    },

    async restoreBackup(): Promise<GameState> {
      const row = await database.getFirstAsync<StoredBackupRow>(
        LOAD_BACKUP_SQL,
        [BACKUP_SLOT],
      );
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
        season:
          typeof row.saved_season === 'number'
            ? row.saved_season
            : restored.season,
        week:
          typeof row.saved_week === 'number' ? row.saved_week : restored.week,
      };
      backupAttempted = null;
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

/** Whether a recorded generation already covers this state's season boundary. */
function isBackupBoundaryFor(
  generation: BackupGeneration | null,
  state: GameState,
): boolean {
  return (
    generation !== null &&
    generation.careerSeed === state.careerSeed &&
    generation.season === state.season
  );
}

function rawCareerSeed(stateJson: string): number | null {
  try {
    const value = JSON.parse(stateJson) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      return null;
    const seed = (value as Record<string, unknown>).careerSeed;
    return Number.isInteger(seed) &&
      (seed as number) >= 0 &&
      (seed as number) <= 0xffff_ffff
      ? (seed as number)
      : null;
  } catch {
    return null;
  }
}

function decodeStoredCareer(row: StoredCareerRow): GameState {
  if (
    !Number.isSafeInteger(row.schema_version) ||
    (row.schema_version as number) < 1
  ) {
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
  if (
    !Number.isSafeInteger(row.saved_season) ||
    !Number.isSafeInteger(row.saved_week)
  ) {
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
