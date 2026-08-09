import type { PersistenceDatabase } from './database';
import { PersistenceResetError } from './errors';

/**
 * The two ways out of a database this build cannot open or migrate, injected so
 * persistence keeps no runtime Expo import (tests use the in-memory fake).
 */
export interface CareerDatabaseResetOptions {
  /** Opens the database file. Expo returns the cached handle if one is open. */
  openDatabase: () => Promise<PersistenceDatabase>;
  /** Deletes the database file, e.g. `deleteDatabaseAsync(DATABASE_NAME)`. */
  deleteDatabaseFile: () => Promise<void>;
}

const LIST_TABLES_SQL = `
  SELECT name FROM sqlite_master
  WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
`;

/**
 * The last escape hatch: throws away all stored data so the next boot builds a
 * fresh schema. Unlike deleting a save through the repository, this needs no
 * working repository — it is the path out of `UnsupportedDatabaseVersionError`
 * (a build downgrade, where `user_version` is ahead of this build's ladder) and
 * out of a file too damaged to migrate, both of which currently leave Retry
 * forever as the only option.
 *
 * Dropping the tables is tried first because it works while other handles are
 * still open; file deletion is the fallback for a file SQLite cannot even read.
 */
export async function resetCareerDatabase(
  options: CareerDatabaseResetOptions,
): Promise<void> {
  let wipeFailure: unknown;
  try {
    const database = await options.openDatabase();
    const tables = await database.getAllAsync<{ name: unknown }>(
      LIST_TABLES_SQL,
      [],
    );
    // One transaction so a half-dropped schema can never outlive a failure.
    await database.withTransactionAsync(async () => {
      for (const table of tables) {
        if (typeof table.name !== 'string') continue;
        await database.execAsync(
          `DROP TABLE IF EXISTS "${table.name.replaceAll('"', '""')}"`,
        );
      }
      await database.execAsync('PRAGMA user_version = 0');
    });
    return;
  } catch (error) {
    wipeFailure = error;
  }

  try {
    await options.deleteDatabaseFile();
  } catch (error) {
    throw new PersistenceResetError(
      `${describe(error)} (dropping its tables first failed with: ${describe(wipeFailure)})`,
    );
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
