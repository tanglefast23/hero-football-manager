import { GAME_SCHEMA_VERSION, type GameState } from '../game/types';
import type { PersistenceDatabase } from './database';
import { CorruptCareerSaveError, UnsupportedGameSchemaError } from './errors';
import { parseStoredGameState, serializeGameState } from './game-state-codec';
import { migrateDatabase } from './migrations';

const PRIMARY_SLOT = 1;
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

interface StoredCareerRow {
  schema_version: unknown;
  state_json: unknown;
}

export interface CareerRepository {
  save(state: GameState): Promise<void>;
  load(): Promise<GameState | null>;
  delete(): Promise<void>;
}

export async function createCareerRepository(
  database: PersistenceDatabase,
): Promise<CareerRepository> {
  await migrateDatabase(database);

  return {
    async save(state: GameState): Promise<void> {
      const stateJson = serializeGameState(state);
      await database.runAsync(UPSERT_CAREER_SQL, [
        PRIMARY_SLOT,
        GAME_SCHEMA_VERSION,
        stateJson,
      ]);
    },

    async load(): Promise<GameState | null> {
      const row = await database.getFirstAsync<StoredCareerRow>(
        LOAD_CAREER_SQL,
        [PRIMARY_SLOT],
      );
      if (row === null) return null;
      if (!Number.isSafeInteger(row.schema_version)) {
        throw new CorruptCareerSaveError(
          'schema_version column is missing or invalid',
        );
      }
      if (row.schema_version !== GAME_SCHEMA_VERSION) {
        throw new UnsupportedGameSchemaError(
          row.schema_version as number,
          GAME_SCHEMA_VERSION,
        );
      }
      if (typeof row.state_json !== 'string') {
        throw new CorruptCareerSaveError('state_json column is not text');
      }
      return parseStoredGameState(row.state_json);
    },

    async delete(): Promise<void> {
      await database.runAsync(DELETE_CAREER_SQL, [PRIMARY_SLOT]);
    },
  };
}
