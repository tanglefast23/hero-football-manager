import { PERSISTENCE_SCHEMA_VERSION, migrateDatabase } from '../migrations';
import {
  PersistenceMigrationError,
  UnsupportedDatabaseVersionError,
} from '../errors';
import type { DatabaseBindParams } from '../database';
import { FakePersistenceDatabase } from './fake-database';

describe('persistence migrations', () => {
  it('configures and migrates a fresh database', async () => {
    const database = new FakePersistenceDatabase();

    await migrateDatabase(database);

    expect(database.journalMode).toBe('wal');
    expect(database.foreignKeysEnabled).toBe(true);
    expect(database.tableExists).toBe(true);
    expect(database.replayTableExists).toBe(true);
    expect(database.userVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
    expect(database.migrationTransactions).toBe(2);
    expect(database.createTableExecutions).toBe(2);
  });

  it('is idempotent after the current migration is applied', async () => {
    const database = new FakePersistenceDatabase();

    await migrateDatabase(database);
    await migrateDatabase(database);

    expect(database.userVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
    expect(database.migrationTransactions).toBe(2);
    expect(database.createTableExecutions).toBe(2);
  });

  it('migrates a version-1 career database without changing its save row', async () => {
    const database = new FakePersistenceDatabase(1);
    const existingRow = { schema_version: 1, state_json: '{"existing":true}' };
    database.seedCareerRow(existingRow);

    await migrateDatabase(database);

    expect(database.userVersion).toBe(2);
    expect(database.replayTableExists).toBe(true);
    expect(database.careerRow).toEqual(existingRow);
    expect(database.migrationTransactions).toBe(1);
  });

  it('rejects a database created by a newer build', async () => {
    const database = new FakePersistenceDatabase(
      PERSISTENCE_SCHEMA_VERSION + 1,
    );

    await expect(migrateDatabase(database)).rejects.toBeInstanceOf(
      UnsupportedDatabaseVersionError,
    );
  });

  it('rejects an invalid PRAGMA user_version response', async () => {
    const database = new InvalidVersionDatabase();

    await expect(migrateDatabase(database)).rejects.toBeInstanceOf(
      PersistenceMigrationError,
    );
  });
});

class InvalidVersionDatabase extends FakePersistenceDatabase {
  override async getFirstAsync<T>(
    source: string,
    params: DatabaseBindParams,
  ): Promise<T | null> {
    if (source.trim() === 'PRAGMA user_version')
      return { user_version: 'one' } as T;
    return super.getFirstAsync<T>(source, params);
  }
}
