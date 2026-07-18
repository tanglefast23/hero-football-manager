import type { ReplayEnvelope } from '../sim/types';
import type { PersistenceDatabase } from './database';
import {
  CorruptReplayEnvelopeError,
  UnsupportedReplaySchemaError,
} from './errors';
import { migrateDatabase } from './migrations';
import {
  parseStoredReplayEnvelope,
  REPLAY_SCHEMA_VERSION,
  serializeReplayEnvelope,
} from './replay-codec';

const UPSERT_REPLAY_SQL = `
  INSERT INTO replay_envelopes (
    career_id, fixture_id, sort_order, schema_version, engine_version, envelope_json
  ) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(career_id, fixture_id) DO UPDATE SET
    sort_order = excluded.sort_order,
    schema_version = excluded.schema_version,
    engine_version = excluded.engine_version,
    envelope_json = excluded.envelope_json
`;
const LOAD_REPLAY_SQL = `
  SELECT fixture_id, sort_order, schema_version, engine_version, envelope_json
  FROM replay_envelopes
  WHERE career_id = ? AND fixture_id = ?
`;
const LIST_REPLAYS_SQL = `
  SELECT fixture_id, sort_order, schema_version, engine_version, envelope_json
  FROM replay_envelopes
  WHERE career_id = ?
  ORDER BY sort_order ASC, fixture_id COLLATE BINARY ASC
`;
const DELETE_REPLAY_SQL =
  'DELETE FROM replay_envelopes WHERE career_id = ? AND fixture_id = ?';
const DELETE_CAREER_REPLAYS_SQL =
  'DELETE FROM replay_envelopes WHERE career_id = ?';

interface StoredReplayRow {
  fixture_id: unknown;
  sort_order: unknown;
  schema_version: unknown;
  engine_version: unknown;
  envelope_json: unknown;
}

export interface StoredReplayEnvelope {
  careerId: string;
  fixtureId: string;
  sortOrder: number;
  envelope: ReplayEnvelope;
}

export interface ReplayRepository {
  save(
    careerId: string,
    fixtureId: string,
    sortOrder: number,
    envelope: ReplayEnvelope,
  ): Promise<void>;
  load(careerId: string, fixtureId: string): Promise<ReplayEnvelope | null>;
  listForCareer(careerId: string): Promise<StoredReplayEnvelope[]>;
  delete(careerId: string, fixtureId: string): Promise<void>;
  deleteAllForCareer(careerId: string): Promise<void>;
}

export async function createReplayRepository(
  database: PersistenceDatabase,
): Promise<ReplayRepository> {
  await migrateDatabase(database);

  return {
    async save(careerId, fixtureId, sortOrder, envelope): Promise<void> {
      validateKey(careerId, 'career ID');
      validateKey(fixtureId, 'fixture ID');
      validateSortOrder(sortOrder);
      const envelopeJson = serializeReplayEnvelope(envelope);
      await database.runAsync(UPSERT_REPLAY_SQL, [
        careerId,
        fixtureId,
        sortOrder,
        REPLAY_SCHEMA_VERSION,
        envelope.engineVersion,
        envelopeJson,
      ]);
    },

    async load(careerId, fixtureId): Promise<ReplayEnvelope | null> {
      validateKey(careerId, 'career ID');
      validateKey(fixtureId, 'fixture ID');
      const row = await database.getFirstAsync<StoredReplayRow>(
        LOAD_REPLAY_SQL,
        [careerId, fixtureId],
      );
      return row === null ? null : decodeRow(row, careerId).envelope;
    },

    async listForCareer(careerId): Promise<StoredReplayEnvelope[]> {
      validateKey(careerId, 'career ID');
      const rows = await database.getAllAsync<StoredReplayRow>(
        LIST_REPLAYS_SQL,
        [careerId],
      );
      return rows
        .map((row) => decodeRow(row, careerId))
        .sort(compareStoredReplays);
    },

    async delete(careerId, fixtureId): Promise<void> {
      validateKey(careerId, 'career ID');
      validateKey(fixtureId, 'fixture ID');
      await database.runAsync(DELETE_REPLAY_SQL, [careerId, fixtureId]);
    },

    async deleteAllForCareer(careerId): Promise<void> {
      validateKey(careerId, 'career ID');
      await database.runAsync(DELETE_CAREER_REPLAYS_SQL, [careerId]);
    },
  };
}

function decodeRow(
  row: StoredReplayRow,
  careerId: string,
): StoredReplayEnvelope {
  if (
    typeof row.fixture_id !== 'string' ||
    row.fixture_id.trim().length === 0
  ) {
    throw new CorruptReplayEnvelopeError(
      'fixture_id column is missing or invalid',
    );
  }
  if (!Number.isSafeInteger(row.sort_order) || (row.sort_order as number) < 0) {
    throw new CorruptReplayEnvelopeError(
      'sort_order column is missing or invalid',
    );
  }
  if (!Number.isSafeInteger(row.schema_version)) {
    throw new CorruptReplayEnvelopeError(
      'schema_version column is missing or invalid',
    );
  }
  if (row.schema_version !== REPLAY_SCHEMA_VERSION) {
    throw new UnsupportedReplaySchemaError(
      row.schema_version as number,
      REPLAY_SCHEMA_VERSION,
    );
  }
  if (
    typeof row.engine_version !== 'string' ||
    row.engine_version.length === 0
  ) {
    throw new CorruptReplayEnvelopeError(
      'engine_version column is missing or invalid',
    );
  }
  if (typeof row.envelope_json !== 'string') {
    throw new CorruptReplayEnvelopeError('envelope_json column is not text');
  }

  const envelope = parseStoredReplayEnvelope(row.envelope_json);
  if (envelope.engineVersion !== row.engine_version) {
    throw new CorruptReplayEnvelopeError(
      'engine_version column does not match the envelope',
    );
  }
  return {
    careerId,
    fixtureId: row.fixture_id,
    sortOrder: row.sort_order as number,
    envelope,
  };
}

function validateKey(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function validateSortOrder(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('replay sort order must be a nonnegative safe integer');
  }
}

function compareStoredReplays(
  left: StoredReplayEnvelope,
  right: StoredReplayEnvelope,
): number {
  if (left.sortOrder !== right.sortOrder)
    return left.sortOrder < right.sortOrder ? -1 : 1;
  if (left.fixtureId < right.fixtureId) return -1;
  if (left.fixtureId > right.fixtureId) return 1;
  return 0;
}
