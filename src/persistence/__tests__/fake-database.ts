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

export interface FakePreferencesRow {
  schema_version: unknown;
  preferences_json: unknown;
}

export interface FakeBackupRow extends FakeCareerRow {
  saved_season: unknown;
  saved_week: unknown;
  /** Null stands in for a row written before migration 5 added the column. */
  saved_career_seed: unknown;
}

export interface FakeDeveloperSaveRow extends FakeCareerRow {
  slot: unknown;
  kind: unknown;
  saved_season: unknown;
  saved_week: unknown;
  saved_career_seed: unknown;
  save_sequence: unknown;
}

export class FakePersistenceDatabase implements PersistenceDatabase {
  userVersion: number;
  journalMode: string | null = null;
  foreignKeysEnabled = false;
  tableExists = false;
  replayTableExists = false;
  preferencesTableExists = false;
  backupTableExists = false;
  backupSeedColumnExists = false;
  developerSaveTableExists = false;
  migrationTransactions = 0;
  createTableExecutions = 0;
  executedSql: string[] = [];
  careerRow: FakeCareerRow | null = null;
  replayRows = new Map<string, FakeReplayRow>();
  preferencesRow: FakePreferencesRow | null = null;
  backupRow: FakeBackupRow | null = null;
  developerSaveRows = new Map<string, FakeDeveloperSaveRow>();
  /** What `PRAGMA quick_check` answers; tests set 'damaged' to fake corruption. */
  integrity = 'ok';
  /** Fails every write once set, standing in for a full or read-only disk. */
  writesFail = false;

  constructor(userVersion = 0) {
    this.userVersion = userVersion;
    this.tableExists = userVersion >= 1;
    this.replayTableExists = userVersion >= 2;
    this.preferencesTableExists = userVersion >= 3;
    this.backupTableExists = userVersion >= 4;
    this.backupSeedColumnExists = userVersion >= 5;
    this.developerSaveTableExists = userVersion >= 6;
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
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS app_preferences')) {
      this.preferencesTableExists = true;
      this.createTableExecutions += 1;
      return;
    }
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS career_save_backups')) {
      this.backupTableExists = true;
      this.createTableExecutions += 1;
      return;
    }
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS developer_saves')) {
      this.developerSaveTableExists = true;
      this.createTableExecutions += 1;
      return;
    }
    if (
      sql ===
      'ALTER TABLE career_save_backups ADD COLUMN saved_career_seed INTEGER'
    ) {
      this.assertBackupTable();
      if (this.backupSeedColumnExists)
        throw new Error('duplicate column name: saved_career_seed');
      this.backupSeedColumnExists = true;
      // The column arrives on existing rows as NULL, the same as SQLite.
      if (this.backupRow !== null) this.backupRow.saved_career_seed = null;
      return;
    }

    const dropMatch = /^DROP TABLE IF EXISTS "(.+)"$/.exec(sql);
    if (dropMatch !== null) {
      this.dropTable(dropMatch[1]);
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
    if (this.writesFail) throw new Error('disk is full');

    if (sql.startsWith('INSERT INTO career_save_backups')) {
      this.assertBackupSeedColumn();
      const [
        slot,
        schemaVersion,
        stateJson,
        savedSeason,
        savedWeek,
        savedCareerSeed,
      ] = values;
      if (
        slot !== 1 ||
        typeof schemaVersion !== 'number' ||
        typeof stateJson !== 'string' ||
        typeof savedSeason !== 'number' ||
        typeof savedWeek !== 'number' ||
        typeof savedCareerSeed !== 'number'
      ) {
        throw new Error('invalid fake backup upsert parameters');
      }
      this.backupRow = {
        schema_version: schemaVersion,
        state_json: stateJson,
        saved_season: savedSeason,
        saved_week: savedWeek,
        saved_career_seed: savedCareerSeed,
      };
      return { lastInsertRowId: 1, changes: 1 };
    }

    if (sql === 'DELETE FROM career_save_backups WHERE slot = ?') {
      this.assertBackupTable();
      if (values[0] !== 1) throw new Error('invalid fake backup delete slot');
      const changes = this.backupRow === null ? 0 : 1;
      this.backupRow = null;
      return { lastInsertRowId: 0, changes };
    }

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

    if (sql.startsWith('INSERT INTO app_preferences')) {
      if (!this.preferencesTableExists)
        throw new Error('app_preferences table does not exist');
      const [slot, schemaVersion, preferencesJson] = values;
      if (
        slot !== 1 ||
        typeof schemaVersion !== 'number' ||
        typeof preferencesJson !== 'string'
      ) {
        throw new Error('invalid fake preferences upsert parameters');
      }
      this.preferencesRow = {
        schema_version: schemaVersion,
        preferences_json: preferencesJson,
      };
      return { lastInsertRowId: 1, changes: 1 };
    }

    if (sql.startsWith('INSERT INTO developer_saves')) {
      this.assertDeveloperSaveTable();
      const [
        slot,
        kind,
        schemaVersion,
        stateJson,
        savedSeason,
        savedWeek,
        savedCareerSeed,
        saveSequence,
      ] = values;
      if (
        typeof slot !== 'string' ||
        !['1', '2', '3', '4', '5', 'A', 'B', 'C', 'D', 'E'].includes(slot) ||
        (kind !== 'AUTO' && kind !== 'MANUAL') ||
        typeof schemaVersion !== 'number' ||
        typeof stateJson !== 'string' ||
        typeof savedSeason !== 'number' ||
        typeof savedWeek !== 'number' ||
        typeof savedCareerSeed !== 'number' ||
        typeof saveSequence !== 'number'
      ) {
        throw new Error('invalid fake developer save upsert parameters');
      }
      this.developerSaveRows.set(developerSaveKey(savedCareerSeed, slot), {
        slot,
        kind,
        schema_version: schemaVersion,
        state_json: stateJson,
        saved_season: savedSeason,
        saved_week: savedWeek,
        saved_career_seed: savedCareerSeed,
        save_sequence: saveSequence,
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

    if (sql === 'PRAGMA quick_check') {
      return { quick_check: this.integrity } as T;
    }

    if (
      sql.startsWith(
        'SELECT schema_version, state_json, saved_season, saved_week, saved_career_seed FROM career_save_backups',
      )
    ) {
      this.assertBackupSeedColumn();
      const values = arrayParams(params);
      if (values[0] !== 1) throw new Error('invalid fake backup load slot');
      return this.backupRow === null ? null : ({ ...this.backupRow } as T);
    }

    if (
      sql.startsWith(
        'SELECT saved_season, saved_week, saved_career_seed FROM career_save_backups',
      )
    ) {
      this.assertBackupSeedColumn();
      const values = arrayParams(params);
      if (values[0] !== 1) throw new Error('invalid fake backup summary slot');
      return this.backupRow === null
        ? null
        : ({
            saved_season: this.backupRow.saved_season,
            saved_week: this.backupRow.saved_week,
            saved_career_seed: this.backupRow.saved_career_seed,
          } as T);
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

    if (
      sql.startsWith(
        'SELECT schema_version, preferences_json FROM app_preferences',
      )
    ) {
      if (!this.preferencesTableExists)
        throw new Error('app_preferences table does not exist');
      const values = arrayParams(params);
      if (values[0] !== 1)
        throw new Error('invalid fake preferences load slot');
      return this.preferencesRow === null
        ? null
        : ({ ...this.preferencesRow } as T);
    }

    if (
      sql.startsWith(
        'SELECT MAX(save_sequence) AS max_sequence FROM developer_saves',
      )
    ) {
      this.assertDeveloperSaveTable();
      const values = arrayParams(params);
      const careerSeed = values[0];
      if (typeof careerSeed !== 'number')
        throw new Error('invalid fake developer save career');
      const sequences = Array.from(this.developerSaveRows.values())
        .filter(
          (row) => row.kind === 'AUTO' && row.saved_career_seed === careerSeed,
        )
        .map((row) => row.save_sequence as number);
      return {
        max_sequence: sequences.length === 0 ? null : Math.max(...sequences),
      } as T;
    }

    if (
      sql.startsWith('SELECT schema_version, state_json FROM developer_saves')
    ) {
      this.assertDeveloperSaveTable();
      const values = arrayParams(params);
      const [slot, careerSeed] = values;
      if (typeof slot !== 'string' || typeof careerSeed !== 'number') {
        throw new Error('invalid fake developer save load parameters');
      }
      const row = this.developerSaveRows.get(
        developerSaveKey(careerSeed, slot),
      );
      return row === undefined
        ? null
        : ({
            schema_version: row.schema_version,
            state_json: row.state_json,
          } as T);
    }

    throw new Error(`fake database does not support query SQL: ${sql}`);
  }

  async getAllAsync<T>(
    source: string,
    params: DatabaseBindParams,
  ): Promise<T[]> {
    const sql = normalizeSql(source);
    this.executedSql.push(sql);
    if (sql.startsWith('SELECT name FROM sqlite_master')) {
      return this.existingTables().map((name) => ({ name }) as T);
    }
    if (
      sql.startsWith(
        'SELECT slot, kind, saved_season, saved_week FROM developer_saves',
      )
    ) {
      this.assertDeveloperSaveTable();
      const values = arrayParams(params);
      const careerSeed = values[0];
      if (typeof careerSeed !== 'number')
        throw new Error('invalid fake developer save list career');
      return Array.from(this.developerSaveRows.values())
        .filter((row) => row.saved_career_seed === careerSeed)
        .map(
          (row) =>
            ({
              slot: row.slot,
              kind: row.kind,
              saved_season: row.saved_season,
              saved_week: row.saved_week,
            }) as T,
        );
    }
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
      preferencesTableExists: this.preferencesTableExists,
      backupTableExists: this.backupTableExists,
      backupSeedColumnExists: this.backupSeedColumnExists,
      developerSaveTableExists: this.developerSaveTableExists,
      backupRow: this.backupRow === null ? null : { ...this.backupRow },
      careerRow: this.careerRow === null ? null : { ...this.careerRow },
      replayRows: new Map(
        Array.from(this.replayRows, ([key, row]) => [key, { ...row }]),
      ),
      preferencesRow:
        this.preferencesRow === null ? null : { ...this.preferencesRow },
      developerSaveRows: new Map(
        Array.from(this.developerSaveRows, ([key, row]) => [key, { ...row }]),
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
      this.preferencesTableExists = snapshot.preferencesTableExists;
      this.backupTableExists = snapshot.backupTableExists;
      this.backupSeedColumnExists = snapshot.backupSeedColumnExists;
      this.developerSaveTableExists = snapshot.developerSaveTableExists;
      this.backupRow = snapshot.backupRow;
      this.careerRow = snapshot.careerRow;
      this.replayRows = snapshot.replayRows;
      this.preferencesRow = snapshot.preferencesRow;
      this.developerSaveRows = snapshot.developerSaveRows;
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

  seedBackupRow(row: FakeBackupRow): void {
    this.assertBackupTable();
    this.backupRow = { ...row };
  }

  private existingTables(): string[] {
    return [
      ...(this.tableExists ? ['career_saves'] : []),
      ...(this.replayTableExists ? ['replay_envelopes'] : []),
      ...(this.preferencesTableExists ? ['app_preferences'] : []),
      ...(this.backupTableExists ? ['career_save_backups'] : []),
      ...(this.developerSaveTableExists ? ['developer_saves'] : []),
    ];
  }

  private dropTable(name: string): void {
    if (name === 'career_saves') {
      this.tableExists = false;
      this.careerRow = null;
    }
    if (name === 'replay_envelopes') {
      this.replayTableExists = false;
      this.replayRows.clear();
    }
    if (name === 'app_preferences') {
      this.preferencesTableExists = false;
      this.preferencesRow = null;
    }
    if (name === 'career_save_backups') {
      this.backupTableExists = false;
      this.backupSeedColumnExists = false;
      this.backupRow = null;
    }
    if (name === 'developer_saves') {
      this.developerSaveTableExists = false;
      this.developerSaveRows.clear();
    }
  }

  private assertTable(): void {
    if (!this.tableExists) throw new Error('career_saves table does not exist');
  }

  private assertReplayTable(): void {
    if (!this.replayTableExists)
      throw new Error('replay_envelopes table does not exist');
  }

  private assertBackupTable(): void {
    if (!this.backupTableExists)
      throw new Error('career_save_backups table does not exist');
  }

  private assertBackupSeedColumn(): void {
    this.assertBackupTable();
    if (!this.backupSeedColumnExists)
      throw new Error('no such column: saved_career_seed');
  }

  private assertDeveloperSaveTable(): void {
    if (!this.developerSaveTableExists)
      throw new Error('developer_saves table does not exist');
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

/** Mirrors the developer_saves primary key: one slot set per career. */
function developerSaveKey(careerSeed: number, slot: string): string {
  return `${careerSeed}\u0000${slot}`;
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
