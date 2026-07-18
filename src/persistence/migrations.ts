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
