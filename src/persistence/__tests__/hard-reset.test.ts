import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import { createCareerRepository } from '../career-repository';
import type { PersistenceDatabase } from '../database';
import { PersistenceResetError } from '../errors';
import { resetCareerDatabase } from '../hard-reset';
import { migrateDatabase, PERSISTENCE_SCHEMA_VERSION } from '../migrations';
import { FakePersistenceDatabase } from './fake-database';

describe('career database hard reset', () => {
  it('drops every table and rewinds the version so the next boot rebuilds', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    await repository.save(createCareer(createLaunchCareerSetup(24680)));
    let deletions = 0;

    await resetCareerDatabase({
      openDatabase: async () => database,
      deleteDatabaseFile: async () => {
        deletions += 1;
      },
    });

    expect(database.tableExists).toBe(false);
    expect(database.replayTableExists).toBe(false);
    expect(database.preferencesTableExists).toBe(false);
    expect(database.backupTableExists).toBe(false);
    expect(database.userVersion).toBe(0);
    // Deleting the file is the fallback, not the first move.
    expect(deletions).toBe(0);

    await migrateDatabase(database);
    expect(database.userVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
    await expect(
      (await createCareerRepository(database)).load(),
    ).resolves.toBeNull();
  });

  it('escapes a database written by a newer build, which no repository can open', async () => {
    // A downgrade: `user_version` is ahead of this build's ladder, so every
    // repository throws and Retry can never succeed.
    const database = new FakePersistenceDatabase(
      PERSISTENCE_SCHEMA_VERSION + 1,
    );
    await expect(createCareerRepository(database)).rejects.toThrow(
      'is newer than supported',
    );

    await resetCareerDatabase({
      openDatabase: async () => database,
      deleteDatabaseFile: async () => {
        throw new Error('file is locked');
      },
    });

    expect(database.userVersion).toBe(0);
    await expect(createCareerRepository(database)).resolves.toBeDefined();
  });

  it('deletes the file when the tables cannot be read at all', async () => {
    let deletions = 0;

    await resetCareerDatabase({
      openDatabase: async () => unreadableDatabase(),
      deleteDatabaseFile: async () => {
        deletions += 1;
      },
    });

    expect(deletions).toBe(1);
  });

  it('reports both failures when neither way out works', async () => {
    await expect(
      resetCareerDatabase({
        openDatabase: async () => unreadableDatabase(),
        deleteDatabaseFile: async () => {
          throw new Error('file is locked');
        },
      }),
    ).rejects.toBeInstanceOf(PersistenceResetError);

    await expect(
      resetCareerDatabase({
        openDatabase: async () => unreadableDatabase(),
        deleteDatabaseFile: async () => {
          throw new Error('file is locked');
        },
      }),
    ).rejects.toThrow('database disk image is malformed');
  });
});

function unreadableDatabase(): PersistenceDatabase {
  const fail = async (): Promise<never> => {
    throw new Error('database disk image is malformed');
  };
  return {
    execAsync: fail,
    runAsync: fail,
    getFirstAsync: fail,
    getAllAsync: fail,
    withTransactionAsync: fail,
  };
}
