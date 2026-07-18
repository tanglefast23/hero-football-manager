import type { SQLiteDatabase } from 'expo-sqlite';

export type DatabaseBindBlob = Uint8Array | ArrayBuffer;
export type DatabaseBindValue =
  string | number | null | boolean | DatabaseBindBlob;
export type DatabaseBindParams =
  Record<string, DatabaseBindValue> | DatabaseBindValue[];

export interface DatabaseRunResult {
  lastInsertRowId: number;
  changes: number;
}

/**
 * The async subset of expo-sqlite's SQLiteDatabase used by persistence.
 * SQLiteDatabase satisfies this interface structurally, while tests can use
 * an in-memory fake without importing the native Expo module.
 */
export interface PersistenceDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(
    source: string,
    params: DatabaseBindParams,
  ): Promise<DatabaseRunResult>;
  getFirstAsync<T>(
    source: string,
    params: DatabaseBindParams,
  ): Promise<T | null>;
  getAllAsync<T>(source: string, params: DatabaseBindParams): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

type Assert<T extends true> = T;
type SQLiteDatabaseIsCompatible = Assert<
  SQLiteDatabase extends PersistenceDatabase ? true : false
>;
