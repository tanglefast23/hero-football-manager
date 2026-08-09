import { GAME_SCHEMA_VERSION, type GameState } from '../game/types';
import type { PersistenceDatabase } from './database';
import { CorruptCareerSaveError, UnsupportedGameSchemaError } from './errors';
import { parseStoredGameState, serializeGameState } from './game-state-codec';
import { migrateDatabase } from './migrations';

export const DEVELOPER_AUTO_SAVE_SLOTS = ['1', '2', '3', '4', '5'] as const;
export const DEVELOPER_MANUAL_SAVE_SLOTS = ['A', 'B', 'C', 'D', 'E'] as const;

export type DeveloperAutoSaveSlot = (typeof DEVELOPER_AUTO_SAVE_SLOTS)[number];
export type DeveloperManualSaveSlot =
  (typeof DEVELOPER_MANUAL_SAVE_SLOTS)[number];
export type DeveloperSaveSlot = DeveloperAutoSaveSlot | DeveloperManualSaveSlot;

export interface DeveloperSaveSummary {
  readonly slot: DeveloperSaveSlot;
  readonly kind: 'AUTO' | 'MANUAL';
  readonly season: number;
  readonly week: number;
}

export interface DeveloperSaveRepository {
  list(careerSeed: number): Promise<DeveloperSaveSummary[]>;
  saveNextWeek(state: GameState): Promise<DeveloperSaveSummary[]>;
  saveManual(
    slot: DeveloperManualSaveSlot,
    state: GameState,
  ): Promise<DeveloperSaveSummary[]>;
  load(slot: DeveloperSaveSlot, careerSeed: number): Promise<GameState | null>;
}

const UPSERT_SQL = `
  INSERT INTO developer_saves (
    slot, kind, schema_version, state_json, saved_season, saved_week,
    saved_career_seed, save_sequence
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(slot) DO UPDATE SET
    kind = excluded.kind,
    schema_version = excluded.schema_version,
    state_json = excluded.state_json,
    saved_season = excluded.saved_season,
    saved_week = excluded.saved_week,
    saved_career_seed = excluded.saved_career_seed,
    save_sequence = excluded.save_sequence
`;
const LIST_SQL = `
  SELECT slot, kind, saved_season, saved_week
  FROM developer_saves
  WHERE saved_career_seed = ?
`;
const MAX_AUTO_SEQUENCE_SQL = `
  SELECT MAX(save_sequence) AS max_sequence
  FROM developer_saves
  WHERE kind = 'AUTO' AND saved_career_seed = ?
`;
const LOAD_SQL = `
  SELECT schema_version, state_json
  FROM developer_saves
  WHERE slot = ? AND saved_career_seed = ?
`;

interface StoredSummaryRow {
  slot: unknown;
  kind: unknown;
  saved_season: unknown;
  saved_week: unknown;
}

interface StoredStateRow {
  schema_version: unknown;
  state_json: unknown;
}

export async function createDeveloperSaveRepository(
  database: PersistenceDatabase,
): Promise<DeveloperSaveRepository> {
  await migrateDatabase(database);

  const list = async (careerSeed: number): Promise<DeveloperSaveSummary[]> => {
    const rows = await database.getAllAsync<StoredSummaryRow>(LIST_SQL, [
      careerSeed,
    ]);
    return rows
      .map(decodeSummary)
      .sort(
        (left, right) =>
          developerSlotOrder(left.slot) - developerSlotOrder(right.slot),
      );
  };

  const save = async (
    slot: DeveloperSaveSlot,
    kind: DeveloperSaveSummary['kind'],
    sequence: number,
    state: GameState,
  ): Promise<DeveloperSaveSummary[]> => {
    const stateJson = serializeGameState(state, { validate: true });
    await database.runAsync(UPSERT_SQL, [
      slot,
      kind,
      GAME_SCHEMA_VERSION,
      stateJson,
      state.season,
      state.week,
      state.careerSeed,
      sequence,
    ]);
    return list(state.careerSeed);
  };

  return {
    list,

    async saveNextWeek(state) {
      const row = await database.getFirstAsync<{ max_sequence: unknown }>(
        MAX_AUTO_SEQUENCE_SQL,
        [state.careerSeed],
      );
      const previous = row?.max_sequence;
      const sequence =
        typeof previous === 'number' &&
        Number.isSafeInteger(previous) &&
        previous >= 0
          ? previous + 1
          : 1;
      const slot =
        DEVELOPER_AUTO_SAVE_SLOTS[
          (sequence - 1) % DEVELOPER_AUTO_SAVE_SLOTS.length
        ];
      return save(slot, 'AUTO', sequence, state);
    },

    async saveManual(slot, state) {
      return save(slot, 'MANUAL', 0, state);
    },

    async load(slot, careerSeed) {
      const row = await database.getFirstAsync<StoredStateRow>(LOAD_SQL, [
        slot,
        careerSeed,
      ]);
      if (row === null) return null;
      if (
        !Number.isSafeInteger(row.schema_version) ||
        (row.schema_version as number) < 1
      ) {
        throw new CorruptCareerSaveError(
          'developer save schema_version is missing or invalid',
        );
      }
      if ((row.schema_version as number) > GAME_SCHEMA_VERSION) {
        throw new UnsupportedGameSchemaError(
          row.schema_version as number,
          GAME_SCHEMA_VERSION,
        );
      }
      if (typeof row.state_json !== 'string') {
        throw new CorruptCareerSaveError(
          'developer save state_json is not text',
        );
      }
      return parseStoredGameState(row.state_json);
    },
  };
}

function decodeSummary(row: StoredSummaryRow): DeveloperSaveSummary {
  if (!isDeveloperSaveSlot(row.slot)) {
    throw new Error('Developer save has an invalid slot.');
  }
  const expectedKind = DEVELOPER_AUTO_SAVE_SLOTS.includes(
    row.slot as DeveloperAutoSaveSlot,
  )
    ? 'AUTO'
    : 'MANUAL';
  if (row.kind !== expectedKind) {
    throw new Error('Developer save has an invalid kind.');
  }
  if (
    !Number.isSafeInteger(row.saved_season) ||
    (row.saved_season as number) < 1
  ) {
    throw new Error('Developer save has an invalid season.');
  }
  if (!Number.isSafeInteger(row.saved_week) || (row.saved_week as number) < 1) {
    throw new Error('Developer save has an invalid week.');
  }
  return {
    slot: row.slot,
    kind: expectedKind,
    season: row.saved_season as number,
    week: row.saved_week as number,
  };
}

function isDeveloperSaveSlot(value: unknown): value is DeveloperSaveSlot {
  return (
    typeof value === 'string' &&
    ((DEVELOPER_AUTO_SAVE_SLOTS as readonly string[]).includes(value) ||
      (DEVELOPER_MANUAL_SAVE_SLOTS as readonly string[]).includes(value))
  );
}

function developerSlotOrder(slot: DeveloperSaveSlot): number {
  const auto = DEVELOPER_AUTO_SAVE_SLOTS.indexOf(slot as DeveloperAutoSaveSlot);
  if (auto >= 0) return auto;
  return (
    DEVELOPER_AUTO_SAVE_SLOTS.length +
    DEVELOPER_MANUAL_SAVE_SLOTS.indexOf(slot as DeveloperManualSaveSlot)
  );
}
