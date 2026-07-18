import type {
  DatabaseBindParams,
  DatabaseRunResult,
  PersistenceDatabase,
} from '../database';

export interface FakeCareerRow {
  schema_version: unknown;
  state_json: unknown;
}

export interface FakeReplayRow {
  career_id: unknown;
  fixture_id: unknown;
  sort_order: unknown;
  schema_version: unknown;
  engine_version: unknown;
  envelope_json: unknown;
}

export class FakePersistenceDatabase implements PersistenceDatabase {
  userVersion: number;
  journalMode: string | null = null;
  foreignKeysEnabled = false;
  tableExists = false;
  replayTableExists = false;
  migrationTransactions = 0;
  createTableExecutions = 0;
  executedSql: string[] = [];
  careerRow: FakeCareerRow | null = null;
  replayRows = new Map<string, FakeReplayRow>();

  constructor(userVersion = 0) {
    this.userVersion = userVersion;
    this.tableExists = userVersion >= 1;
    this.replayTableExists = userVersion >= 2;
  }

  async execAsync(source: string): Promise<void> {
    const sql = normalizeSql(source);
    this.executedSql.push(sql);

    if (sql === 'PRAGMA journal_mode = WAL') {
      this.journalMode = 'wal';
      return;
    }
    if (sql === 'PRAGMA foreign_keys = ON') {
      this.foreignKeysEnabled = true;
      return;
    }
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS career_saves')) {
      this.tableExists = true;
      this.createTableExecutions += 1;
      return;
    }
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS replay_envelopes')) {
      this.replayTableExists = true;
      this.createTableExecutions += 1;
      return;
    }
    if (
      sql.startsWith(
        'CREATE INDEX IF NOT EXISTS replay_envelopes_by_career_order',
      )
    ) {
      if (!this.replayTableExists)
        throw new Error('replay_envelopes table does not exist');
      return;
    }

    const versionMatch = /^PRAGMA user_version = (\d+)$/.exec(sql);
    if (versionMatch !== null) {
      this.userVersion = Number(versionMatch[1]);
      return;
    }

    throw new Error(`fake database does not support exec SQL: ${sql}`);
  }

  async runAsync(
    source: string,
    params: DatabaseBindParams,
  ): Promise<DatabaseRunResult> {
    const sql = normalizeSql(source);
    this.executedSql.push(sql);
    const values = arrayParams(params);

    if (sql.startsWith('INSERT INTO career_saves')) {
      this.assertTable();
      const [slot, schemaVersion, stateJson] = values;
      if (
        slot !== 1 ||
        typeof schemaVersion !== 'number' ||
        typeof stateJson !== 'string'
      ) {
        throw new Error('invalid fake career upsert parameters');
      }
      this.careerRow = { schema_version: schemaVersion, state_json: stateJson };
      return { lastInsertRowId: 1, changes: 1 };
    }

    if (sql === 'DELETE FROM career_saves WHERE slot = ?') {
      this.assertTable();
      if (values[0] !== 1) throw new Error('invalid fake career delete slot');
      const changes = this.careerRow === null ? 0 : 1;
      this.careerRow = null;
      return { lastInsertRowId: 0, changes };
    }

    if (sql.startsWith('INSERT INTO replay_envelopes')) {
      this.assertReplayTable();
      const [
        careerId,
        fixtureId,
        sortOrder,
        schemaVersion,
        engineVersion,
        envelopeJson,
      ] = values;
      if (
        typeof careerId !== 'string' ||
        typeof fixtureId !== 'string' ||
        typeof sortOrder !== 'number' ||
        typeof schemaVersion !== 'number' ||
        typeof engineVersion !== 'string' ||
        typeof envelopeJson !== 'string'
      ) {
        throw new Error('invalid fake replay upsert parameters');
      }
      this.replayRows.set(replayKey(careerId, fixtureId), {
        career_id: careerId,
        fixture_id: fixtureId,
        sort_order: sortOrder,
        schema_version: schemaVersion,
        engine_version: engineVersion,
        envelope_json: envelopeJson,
      });
      return { lastInsertRowId: 1, changes: 1 };
    }

    if (
      sql ===
      'DELETE FROM replay_envelopes WHERE career_id = ? AND fixture_id = ?'
    ) {
      this.assertReplayTable();
      const [careerId, fixtureId] = values;
      if (typeof careerId !== 'string' || typeof fixtureId !== 'string') {
        throw new Error('invalid fake replay delete parameters');
      }
      const changes = this.replayRows.delete(replayKey(careerId, fixtureId))
        ? 1
        : 0;
      return { lastInsertRowId: 0, changes };
    }

    if (sql === 'DELETE FROM replay_envelopes WHERE career_id = ?') {
      this.assertReplayTable();
      const [careerId] = values;
      if (typeof careerId !== 'string') {
        throw new Error('invalid fake replay career delete parameter');
      }
      let changes = 0;
      for (const [key, row] of this.replayRows) {
        if (row.career_id === careerId) {
          this.replayRows.delete(key);
          changes += 1;
        }
      }
      return { lastInsertRowId: 0, changes };
    }

    throw new Error(`fake database does not support run SQL: ${sql}`);
  }

  async getFirstAsync<T>(
    source: string,
    params: DatabaseBindParams,
  ): Promise<T | null> {
    const sql = normalizeSql(source);
    this.executedSql.push(sql);

    if (sql === 'PRAGMA user_version') {
      return { user_version: this.userVersion } as T;
    }

    if (sql.startsWith('SELECT schema_version, state_json FROM career_saves')) {
      this.assertTable();
      const values = arrayParams(params);
      if (values[0] !== 1) throw new Error('invalid fake career load slot');
      return this.careerRow === null ? null : ({ ...this.careerRow } as T);
    }

    if (
      sql.startsWith(
        'SELECT fixture_id, sort_order, schema_version, engine_version, envelope_json FROM replay_envelopes',
      )
    ) {
      this.assertReplayTable();
      const values = arrayParams(params);
      const [careerId, fixtureId] = values;
      if (typeof careerId !== 'string' || typeof fixtureId !== 'string') {
        throw new Error('invalid fake replay load parameters');
      }
      const row = this.replayRows.get(replayKey(careerId, fixtureId));
      return row === undefined ? null : ({ ...row } as T);
    }

    throw new Error(`fake database does not support query SQL: ${sql}`);
  }

  async getAllAsync<T>(
    source: string,
    params: DatabaseBindParams,
  ): Promise<T[]> {
    const sql = normalizeSql(source);
    this.executedSql.push(sql);
    if (
      !sql.startsWith(
        'SELECT fixture_id, sort_order, schema_version, engine_version, envelope_json FROM replay_envelopes',
      )
    ) {
      throw new Error(`fake database does not support list SQL: ${sql}`);
    }

    this.assertReplayTable();
    const values = arrayParams(params);
    const careerId = values[0];
    if (typeof careerId !== 'string')
      throw new Error('invalid fake replay list career');
    return Array.from(this.replayRows.values())
      .filter((row) => row.career_id === careerId)
      .sort(compareReplayRows)
      .map((row) => ({ ...row }) as T);
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    const snapshot = {
      userVersion: this.userVersion,
      tableExists: this.tableExists,
      replayTableExists: this.replayTableExists,
      careerRow: this.careerRow === null ? null : { ...this.careerRow },
      replayRows: new Map(
        Array.from(this.replayRows, ([key, row]) => [key, { ...row }]),
      ),
      createTableExecutions: this.createTableExecutions,
    };
    this.migrationTransactions += 1;

    try {
      await task();
    } catch (error) {
      this.userVersion = snapshot.userVersion;
      this.tableExists = snapshot.tableExists;
      this.replayTableExists = snapshot.replayTableExists;
      this.careerRow = snapshot.careerRow;
      this.replayRows = snapshot.replayRows;
      this.createTableExecutions = snapshot.createTableExecutions;
      throw error;
    }
  }

  seedCareerRow(row: FakeCareerRow): void {
    this.assertTable();
    this.careerRow = { ...row };
  }

  seedReplayRow(row: FakeReplayRow): void {
    this.assertReplayTable();
    if (
      typeof row.career_id !== 'string' ||
      typeof row.fixture_id !== 'string'
    ) {
      throw new Error('fake replay seed needs string keys');
    }
    this.replayRows.set(replayKey(row.career_id, row.fixture_id), { ...row });
  }

  private assertTable(): void {
    if (!this.tableExists) throw new Error('career_saves table does not exist');
  }

  private assertReplayTable(): void {
    if (!this.replayTableExists)
      throw new Error('replay_envelopes table does not exist');
  }
}

function normalizeSql(source: string): string {
  return source.replace(/\s+/g, ' ').trim();
}

function arrayParams(
  params: DatabaseBindParams,
): DatabaseBindParams & unknown[] {
  if (!Array.isArray(params))
    throw new Error('fake database expects positional parameters');
  return params;
}

function replayKey(careerId: string, fixtureId: string): string {
  return `${careerId}\u0000${fixtureId}`;
}

function compareReplayRows(left: FakeReplayRow, right: FakeReplayRow): number {
  const leftOrder = left.sort_order as number;
  const rightOrder = right.sort_order as number;
  if (leftOrder !== rightOrder) return leftOrder < rightOrder ? -1 : 1;
  const leftId = left.fixture_id as string;
  const rightId = right.fixture_id as string;
  if (leftId < rightId) return -1;
  if (leftId > rightId) return 1;
  return 0;
}
