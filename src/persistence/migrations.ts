import type { PersistenceDatabase } from './database';
import {
  PersistenceMigrationError,
  UnsupportedDatabaseVersionError,
} from './errors';

interface Migration {
  version: number;
  statements: readonly string[];
}

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS career_saves (
        slot INTEGER PRIMARY KEY CHECK (slot = 1),
        schema_version INTEGER NOT NULL,
        state_json TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 2,
    statements: [
      `CREATE TABLE IF NOT EXISTS replay_envelopes (
        career_id TEXT NOT NULL,
        fixture_id TEXT NOT NULL,
        sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
        schema_version INTEGER NOT NULL,
        engine_version TEXT NOT NULL,
        envelope_json TEXT NOT NULL,
        PRIMARY KEY (career_id, fixture_id)
      )`,
      `CREATE INDEX IF NOT EXISTS replay_envelopes_by_career_order
        ON replay_envelopes (career_id, sort_order, fixture_id)`,
    ],
  },
  {
    version: 3,
    statements: [
      `CREATE TABLE IF NOT EXISTS app_preferences (
        slot INTEGER PRIMARY KEY CHECK (slot = 1),
        schema_version INTEGER NOT NULL,
        preferences_json TEXT NOT NULL
      )`,
    ],
  },
  // The career lived in exactly one row, so a save that was valid when written
  // but later unreadable took the whole career with it. This rung adds a second,
  // older generation: the state as it stood when the current season opened.
  // It is a separate table rather than a second `career_saves` slot on purpose —
  // widening that table's `CHECK (slot = 1)` would mean recreating and copying
  // the one row that must never be lost, and a backup sharing the primary's
  // B-tree pages is the copy most likely to die with it.
  {
    version: 4,
    statements: [
      `CREATE TABLE IF NOT EXISTS career_save_backups (
        slot INTEGER PRIMARY KEY CHECK (slot = 1),
        schema_version INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        saved_season INTEGER NOT NULL CHECK (saved_season >= 1),
        saved_week INTEGER NOT NULL CHECK (saved_week >= 1)
      )`,
    ],
  },
  // The backup described where in a career it was taken but never which career,
  // so a replacement career that opened on the same season number left the old
  // career's copy in place — and "Restore backup" would hand it back. The seed
  // is the same career identity the replay namespace uses. Old rows migrate as
  // NULL, which reads as "belongs to no career this build can name" and so is
  // replaced by the next save.
  {
    version: 5,
    statements: [
      'ALTER TABLE career_save_backups ADD COLUMN saved_career_seed INTEGER',
    ],
  },
  // Developer builds keep five rotating week checkpoints and five manual
  // exact-moment saves. The table exists in every schema so a Debug build and
  // a Release build can safely open the same database; only Debug UI can write
  // or restore these rows.
  {
    version: 6,
    statements: [
      `CREATE TABLE IF NOT EXISTS developer_saves (
        slot TEXT PRIMARY KEY CHECK (slot IN ('1','2','3','4','5','A','B','C','D','E')),
        kind TEXT NOT NULL CHECK (kind IN ('AUTO','MANUAL')),
        schema_version INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        saved_season INTEGER NOT NULL CHECK (saved_season >= 1),
        saved_week INTEGER NOT NULL CHECK (saved_week >= 1),
        saved_career_seed INTEGER NOT NULL,
        save_sequence INTEGER NOT NULL CHECK (save_sequence >= 0)
      )`,
    ],
  },
  // The developer slots were keyed on the slot alone while every read filters by
  // `saved_career_seed`, so starting a second career to reproduce something
  // silently overwrote the first career's checkpoints — `list()` then answered
  // `[]` and `load()` `null`, because the rows were gone, not hidden. The key
  // becomes the pair the reads already assume. These rows are debug-only and
  // worth nothing outside the session that wrote them, so the rung drops and
  // recreates rather than copying.
  {
    version: 7,
    statements: [
      'DROP TABLE IF EXISTS "developer_saves"',
      `CREATE TABLE IF NOT EXISTS developer_saves (
        slot TEXT NOT NULL CHECK (slot IN ('1','2','3','4','5','A','B','C','D','E')),
        kind TEXT NOT NULL CHECK (kind IN ('AUTO','MANUAL')),
        schema_version INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        saved_season INTEGER NOT NULL CHECK (saved_season >= 1),
        saved_week INTEGER NOT NULL CHECK (saved_week >= 1),
        saved_career_seed INTEGER NOT NULL,
        save_sequence INTEGER NOT NULL CHECK (save_sequence >= 0),
        PRIMARY KEY (saved_career_seed, slot)
      )`,
    ],
  },
];

export const PERSISTENCE_SCHEMA_VERSION = MIGRATIONS.length;

export async function migrateDatabase(
  database: PersistenceDatabase,
): Promise<void> {
  // foreign_keys must be enabled outside a transaction. WAL is also a
  // connection-level setting, so configure both before reading the version.
  await database.execAsync('PRAGMA journal_mode = WAL');
  await database.execAsync('PRAGMA foreign_keys = ON');

  const versionRow = await database.getFirstAsync<{ user_version?: unknown }>(
    'PRAGMA user_version',
    [],
  );
  const currentVersion = versionRow?.user_version;
  if (!Number.isSafeInteger(currentVersion) || (currentVersion as number) < 0) {
    throw new PersistenceMigrationError(
      'PRAGMA user_version did not return a nonnegative integer',
    );
  }
  if ((currentVersion as number) > PERSISTENCE_SCHEMA_VERSION) {
    throw new UnsupportedDatabaseVersionError(
      currentVersion as number,
      PERSISTENCE_SCHEMA_VERSION,
    );
  }

  let appliedVersion = currentVersion as number;
  for (const migration of MIGRATIONS) {
    if (migration.version <= appliedVersion) continue;
    if (migration.version !== appliedVersion + 1) {
      throw new PersistenceMigrationError(
        `missing migration between versions ${appliedVersion} and ${migration.version}`,
      );
    }

    await database.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await database.execAsync(statement);
      }
      await database.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
    appliedVersion = migration.version;
  }
}
