import { createCareer } from '../../game/career';
import {
  CREATED_PLAYER_ROOKIE_WAGE,
  DEFAULT_CREATION_RATINGS,
  addCreatedPlayer,
  beginStoryOnboarding,
} from '../../game';
import {
  GAME_SCHEMA_VERSION,
  type CareerSetup,
  type GameState,
} from '../../game/types';
import {
  createLaunchCareerSetup,
  reconcileLaunchRoster,
} from '../../application/launch';
import { createCareerRepository } from '../career-repository';
import { parseStoredGameState, serializeGameState } from '../game-state-codec';
import {
  CorruptCareerSaveError,
  InvalidGameStateError,
  MissingCareerBackupError,
  UnsupportedGameSchemaError,
} from '../errors';
import { PERSISTENCE_SCHEMA_VERSION } from '../migrations';
import type { DatabaseBindParams } from '../database';
import { FakePersistenceDatabase } from './fake-database';

describe('career repository', () => {
  it('normalizes schema-1 saves created before awakening history existed', () => {
    const state = createCareer(createLaunchCareerSetup(1234));
    const withoutAwakening = JSON.parse(JSON.stringify(state)) as Record<
      string,
      unknown
    >;
    delete withoutAwakening.awakening;
    expect(
      parseStoredGameState(JSON.stringify(withoutAwakening)).awakening,
    ).toEqual({
      matchesSinceLastAwakening: 0,
      usedTriggerIds: [],
    });

    const withoutTriggerHistory = JSON.parse(JSON.stringify(state)) as {
      awakening: Record<string, unknown>;
    };
    delete withoutTriggerHistory.awakening.usedTriggerIds;
    expect(
      parseStoredGameState(JSON.stringify(withoutTriggerHistory)).awakening
        .usedTriggerIds,
    ).toEqual([]);
  });

  it('loads a retired m1-slice save and reconciles it into a full career', () => {
    const state = createCareer(createLaunchCareerSetup(4321));
    // The shape a career saved by the retired second game mode had: the old
    // label, and none of the sidecars that mode never created.
    const slice = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    slice.careerMode = 'm1-slice';
    for (const field of [
      'm2',
      'market',
      'youthIntake',
      'financialSafety',
      'cashTransactions',
    ]) {
      delete slice[field];
    }

    const decoded = parseStoredGameState(JSON.stringify(slice));
    expect(decoded.careerMode).toBe('full');
    expect(decoded.m2).toBeUndefined();

    // Boot reconciliation is what actually rebuilds the missing sidecars.
    const reconciled = reconcileLaunchRoster(decoded);
    expect(reconciled.careerMode).toBe('full');
    expect(reconciled.m2?.pyramid.divisions).toHaveLength(5);
    expect(reconciled.market).toBeDefined();
    expect(() => serializeGameState(reconciled)).not.toThrow();
  });

  it('creates a fresh schema and reports a missing slot', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);

    await expect(repository.load()).resolves.toBeNull();
    expect(database.tableExists).toBe(true);
    expect(database.userVersion).toBe(PERSISTENCE_SCHEMA_VERSION);
  });

  it('round-trips one serialized GameState slot', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const state = makeState();

    await repository.save(state);
    const loaded = await repository.load();

    expect(loaded).toEqual(state);
    expect(loaded).not.toBe(state);
    // Decoding orders keys by the codec schema rather than by the in-memory
    // literal, so byte-identity is asserted where it matters: a decoded save
    // re-saves and re-loads to exactly itself.
    expect(
      JSON.stringify(parseStoredGameState(serializeGameState(loaded!))),
    ).toBe(JSON.stringify(loaded));
  });

  it('persists the created player and resumable onboarding stage in the career save', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const state = addCreatedPlayer(
      beginStoryOnboarding(createCareer(createLaunchCareerSetup(2468))),
      { name: 'Jo Rook', ratings: DEFAULT_CREATION_RATINGS },
    );

    await repository.save(state);
    const loaded = await repository.load();

    expect(loaded?.onboarding).toMatchObject({
      stage: 'first-match',
      createdPlayerId: 'bramble-rovers-created-player',
    });
    expect(
      loaded?.players.find(
        (player) => player.id === loaded.onboarding?.createdPlayerId,
      ),
    ).toMatchObject({
      name: 'Jo Rook',
      weeklyWage: CREATED_PLAYER_ROOKIE_WAGE,
      contractSeasonsRemaining: 1,
      onHeroWage: false,
    });
    expect(
      loaded?.players.find(
        (player) => player.id === loaded.onboarding?.createdPlayerId,
      )?.power,
    ).toBeUndefined();
  });

  it('round-trips the training rules, SUPER pity counters, and drill nonce', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const initial = createCareer(createLaunchCareerSetup(13579));
    const state: GameState = {
      ...initial,
      totalInstantDrills: 17,
      players: initial.players.map((player) =>
        player.id === 'bramble-rovers-p13'
          ? { ...player, drillsSinceSuper: 7 }
          : player,
      ),
    };

    await repository.save(state);
    const loaded = await repository.load();

    expect(loaded?.trainingRules).toEqual(state.trainingRules);
    expect(loaded?.totalInstantDrills).toBe(17);
    expect(
      loaded?.players.find((player) => player.id === 'bramble-rovers-p13')
        ?.drillsSinceSuper,
    ).toBe(7);
  });

  it('overwrites the existing slot atomically with the latest state', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const first = makeState();
    const second: GameState = { ...first, week: 2, trainingPoints: 42 };

    await repository.save(first);
    await repository.save(second);

    await expect(repository.load()).resolves.toEqual(second);
    expect(database.careerRow).not.toBeNull();
  });

  it('deletes the slot and remains safe when it is already missing', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);

    await repository.save(makeState());
    await repository.delete();
    await repository.delete();

    await expect(repository.load()).resolves.toBeNull();
  });

  it('reads an incompatible save as exact raw text without decoding it', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const stateJson =
      '{"schemaVersion":1,"careerSeed":7788,"unknown":{"keep":"exact"}}';
    database.seedCareerRow({ schema_version: 1, state_json: stateJson });

    await expect(repository.load()).rejects.toBeInstanceOf(
      UnsupportedGameSchemaError,
    );
    await expect(repository.loadRaw()).resolves.toEqual({
      schemaVersion: 1,
      stateJson,
    });
    expect(database.careerRow?.state_json).toBe(stateJson);
  });

  it('transactionally deletes only the career, its backup, and associated replays', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const state = makeState();
    await repository.save(state);
    database.preferencesRow = {
      schema_version: 4,
      preferences_json: '{"masterVolume":0.5}',
    };
    database.seedReplayRow({
      career_id: `m1-career-${state.careerSeed}`,
      fixture_id: 'associated',
      sort_order: 1,
      schema_version: 1,
      engine_version: 'old',
      envelope_json: '{}',
    });
    database.seedReplayRow({
      career_id: 'm1-career-unrelated',
      fixture_id: 'keep',
      sort_order: 1,
      schema_version: 1,
      engine_version: 'old',
      envelope_json: '{}',
    });
    const preferencesBefore = { ...database.preferencesRow };

    await repository.delete();

    expect(database.careerRow).toBeNull();
    expect(database.backupRow).toBeNull();
    expect(
      [...database.replayRows.values()].map((row) => row.fixture_id),
    ).toEqual(['keep']);
    expect(database.preferencesRow).toEqual(preferencesBefore);
  });

  it('leaves the live career and backup untouched when transactional reset fails', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const state = makeState();
    await repository.save(state);
    const liveBefore = { ...database.careerRow! };
    const backupBefore = { ...database.backupRow! };
    database.writesFail = true;

    await expect(repository.delete()).rejects.toThrow('disk is full');

    expect(database.careerRow).toEqual(liveBefore);
    expect(database.backupRow).toEqual(backupBefore);
  });

  it('surfaces corrupt JSON clearly', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    database.seedCareerRow({ schema_version: 1, state_json: '{broken' });

    await expect(repository.load()).rejects.toBeInstanceOf(
      CorruptCareerSaveError,
    );
    await expect(repository.load()).rejects.toThrow(
      'state_json is not valid JSON',
    );
  });

  it('rejects structurally corrupt state even when its JSON and version are valid', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    database.seedCareerRow({
      schema_version: GAME_SCHEMA_VERSION,
      state_json: `{"schemaVersion":${GAME_SCHEMA_VERSION}}`,
    });

    await expect(repository.load()).rejects.toBeInstanceOf(
      CorruptCareerSaveError,
    );
    await expect(repository.load()).rejects.toThrow('careerSeed');
  });

  it('rejects an unsupported stored schema version before parsing its payload', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    database.seedCareerRow({
      schema_version: GAME_SCHEMA_VERSION + 1,
      state_json: '{not-even-json',
    });

    await expect(repository.load()).rejects.toBeInstanceOf(
      UnsupportedGameSchemaError,
    );
    await expect(repository.load()).rejects.toThrow(
      `schema ${GAME_SCHEMA_VERSION + 1} is unsupported`,
    );
  });

  it('rejects a payload schema that disagrees with the supported row version', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    database.seedCareerRow({
      schema_version: GAME_SCHEMA_VERSION,
      state_json: `{"schemaVersion":${GAME_SCHEMA_VERSION + 1}}`,
    });

    await expect(repository.load()).rejects.toBeInstanceOf(
      UnsupportedGameSchemaError,
    );
  });

  it('refuses to save a malformed in-memory GameState', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const malformed = { ...makeState(), clubs: [] } as GameState;

    await expect(repository.save(malformed)).rejects.toBeInstanceOf(
      InvalidGameStateError,
    );
    expect(database.careerRow).toBeNull();
  });

  it('rejects a row whose schema version column is below the first version', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    database.seedCareerRow({
      schema_version: 0,
      state_json: '{"schemaVersion":1}',
    });

    await expect(repository.load()).rejects.toBeInstanceOf(
      CorruptCareerSaveError,
    );
  });
});

describe('career backup generation', () => {
  it('keeps one season-boundary copy and refreshes it when the season turns', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const seasonOne = makeState();

    await repository.save(seasonOne);
    await expect(repository.backupSummary()).resolves.toEqual({
      season: 1,
      week: 1,
    });

    // Mid-season saves leave the previous generation alone.
    await repository.save(atSeason(seasonOne, 1, 7));
    await expect(repository.backupSummary()).resolves.toEqual({
      season: 1,
      week: 1,
    });

    await repository.save(atSeason(seasonOne, 2, 3));
    await expect(repository.backupSummary()).resolves.toEqual({
      season: 2,
      week: 3,
    });
  });

  it("replaces the previous career's backup as soon as a different career saves", async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const careerA = makeState();
    await repository.save(careerA);

    // Both careers are at season 1, so a season-only backup key skipped this
    // write and "Restore backup" could resurrect the abandoned career A.
    const careerB = createCareer(createLaunchCareerSetup(111111));
    await repository.save(careerB);

    const restored = await repository.restoreBackup();
    expect(restored.careerSeed).toBe(careerB.careerSeed);
  });

  it('reports no backup before the first save', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);

    await expect(repository.backupSummary()).resolves.toBeNull();
    await expect(repository.restoreBackup()).rejects.toBeInstanceOf(
      MissingCareerBackupError,
    );
  });

  it('restores the backup over a live slot that can no longer be read', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const state = makeState();
    await repository.save(state);

    // What data loss looks like from here: the row is still there and no longer
    // decodes. Without the backup the whole career would be gone.
    database.seedCareerRow({
      schema_version: GAME_SCHEMA_VERSION,
      state_json: `{"schemaVersion":${GAME_SCHEMA_VERSION}}`,
    });
    await expect(repository.load()).rejects.toBeInstanceOf(
      CorruptCareerSaveError,
    );

    const restored = await repository.restoreBackup();

    expect(restored.careerSeed).toBe(state.careerSeed);
    await expect(repository.load()).resolves.toEqual(restored);
  });

  it('carries the restored season forward so the next season backs up again', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const state = makeState();
    await repository.save(state);
    await repository.save(atSeason(state, 2, 1));

    await repository.restoreBackup();
    await repository.save(atSeason(state, 2, 4));
    await expect(repository.backupSummary()).resolves.toEqual({
      season: 2,
      week: 1,
    });

    await repository.save(atSeason(state, 3, 1));
    await expect(repository.backupSummary()).resolves.toEqual({
      season: 3,
      week: 1,
    });
  });

  it('refuses to restore a backup this build cannot decode', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const state = makeState();
    await repository.save(state);
    database.seedBackupRow({
      schema_version: GAME_SCHEMA_VERSION,
      state_json: `{"schemaVersion":${GAME_SCHEMA_VERSION}}`,
      saved_season: 1,
      saved_week: 1,
      saved_career_seed: state.careerSeed,
    });

    await expect(repository.restoreBackup()).rejects.toBeInstanceOf(
      CorruptCareerSaveError,
    );
    // The live slot is untouched: a bad backup must not cost the live save.
    await expect(repository.load()).resolves.toEqual(state);
  });

  it('does not report a saved week as lost when only the backup copy fails', async () => {
    const database = new BackupWriteFailureDatabase();
    const repository = await createCareerRepository(database);
    const state = makeState();

    await expect(repository.save(state)).resolves.toBeUndefined();
    await expect(repository.load()).resolves.toEqual(state);
    await expect(repository.backupSummary()).resolves.toBeNull();

    // One attempt per boundary, not one per save. A rejected backup used to be
    // retried on every later save for the rest of the career, and on a release
    // build each retry re-serialises the whole career WITH validation — a
    // measured ~200ms of JS thread per player action.
    const attempts = database.backupWriteAttempts;
    for (let week = 2; week <= 10; week += 1) {
      await repository.save(atSeason(state, 1, week));
    }
    expect(database.backupWriteAttempts).toBe(attempts);

    // The next genuine boundary still tries, so a disk that frees up is picked
    // up at the next season rather than never.
    database.backupWritesFail = false;
    await repository.save(atSeason(state, 2, 1));
    await expect(repository.backupSummary()).resolves.toEqual({
      season: 2,
      week: 1,
    });
  });

  it('offers no backup summary for a generation it cannot decode', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const state = makeState();
    await repository.save(state);
    // Restore backup is the one rescue on the unreadable-save screen. Reading
    // the three integer columns alone cannot fail for the reason the blob
    // fails, so the button was offered for a copy that then refused to load.
    database.seedBackupRow({
      schema_version: GAME_SCHEMA_VERSION,
      state_json: serializeGameState(state).slice(0, 400),
      saved_season: 3,
      saved_week: 1,
      saved_career_seed: state.careerSeed,
    });

    await expect(repository.backupSummary()).resolves.toBeNull();
    await expect(repository.restoreBackup()).rejects.toBeInstanceOf(
      CorruptCareerSaveError,
    );
  });

  it('backs up a replacement career that opened on the same season number', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    await repository.save(makeState());

    // Season 1 either side, so the season boundary alone sees no change — and
    // the backup would still hand back the career this one replaced.
    const replacement = createCareer(createLaunchCareerSetup(24680));
    await repository.save(replacement);

    await expect(repository.restoreBackup()).resolves.toMatchObject({
      careerSeed: replacement.careerSeed,
    });
  });

  it('takes the backup with the save when a career is discarded', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    await repository.save(makeState());

    await repository.delete();

    await expect(repository.load()).resolves.toBeNull();
    await expect(repository.backupSummary()).resolves.toBeNull();
    await expect(repository.restoreBackup()).rejects.toBeInstanceOf(
      MissingCareerBackupError,
    );
  });

  it('replaces a backup that predates the career-seed column', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const state = makeState();
    database.seedBackupRow({
      schema_version: 1,
      state_json: '{"schemaVersion":1}',
      saved_season: state.season,
      saved_week: 9,
      saved_career_seed: null,
    });

    // Same season, so only the unnamed career forces the rewrite — and until it
    // does, the undecodable row is offered as no summary at all.
    await repository.save(state);

    await expect(repository.backupSummary()).resolves.toEqual({
      season: state.season,
      week: state.week,
    });
    await expect(repository.restoreBackup()).resolves.toMatchObject({
      careerSeed: state.careerSeed,
    });
  });

  it('reports the database file as damaged when SQLite says so', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);

    await expect(repository.checkIntegrity()).resolves.toBe(true);
    database.integrity = '*** in database main *** Page 4 is never used';
    await expect(repository.checkIntegrity()).resolves.toBe(false);
  });
});

function makeState(): GameState {
  return createCareer(createLaunchCareerSetup(987654321));
}

/** Moves a career to a season and week, keeping the season-linked sidecars legal. */
function atSeason(state: GameState, season: number, week: number): GameState {
  return {
    ...state,
    season,
    week,
    ...(state.youthIntake === undefined
      ? {}
      : { youthIntake: { ...state.youthIntake, season } }),
  };
}

/** A disk with room for the live save but not for its backup copy. */
class BackupWriteFailureDatabase extends FakePersistenceDatabase {
  backupWritesFail = true;
  backupWriteAttempts = 0;

  override async runAsync(source: string, params: DatabaseBindParams) {
    if (source.includes('INSERT INTO career_save_backups')) {
      this.backupWriteAttempts += 1;
    }
    if (this.backupWritesFail && source.includes('career_save_backups')) {
      throw new Error('database or disk is full');
    }
    return super.runAsync(source, params);
  }
}
