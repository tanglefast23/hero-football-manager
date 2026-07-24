import { createCareer } from '../../game/career';
import {
  DEFAULT_CREATION_RATINGS,
  addCreatedPlayer,
  beginStoryOnboarding,
} from '../../game';
import type { CareerSetup, GameState } from '../../game/types';
import { createLaunchCareerSetup } from '../../application/launch';
import { createCareerRepository } from '../career-repository';
import { parseStoredGameState } from '../game-state-codec';
import {
  CorruptCareerSaveError,
  InvalidGameStateError,
  UnsupportedGameSchemaError,
} from '../errors';
import { PERSISTENCE_SCHEMA_VERSION } from '../migrations';
import { FakePersistenceDatabase } from './fake-database';

describe('career repository', () => {
  it('normalizes schema-1 saves created before awakening history existed', () => {
    const state = createCareer(createLaunchCareerSetup(1234));
    const withoutAwakening = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete withoutAwakening.awakening;
    expect(parseStoredGameState(JSON.stringify(withoutAwakening)).awakening).toEqual({
      matchesSinceLastAwakening: 0,
      usedTriggerIds: [],
    });

    const withoutTriggerHistory = JSON.parse(JSON.stringify(state)) as {
      awakening: Record<string, unknown>;
    };
    delete withoutTriggerHistory.awakening.usedTriggerIds;
    expect(parseStoredGameState(JSON.stringify(withoutTriggerHistory)).awakening.usedTriggerIds)
      .toEqual([]);
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
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(state));
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
    expect(loaded?.players.find(player => player.id === loaded.onboarding?.createdPlayerId))
      .toMatchObject({
        name: 'Jo Rook',
        weeklyWage: 180,
        contractSeasonsRemaining: 1,
        onHeroWage: false,
      });
    expect(loaded?.players.find(player => player.id === loaded.onboarding?.createdPlayerId)?.power)
      .toBeUndefined();
  });

  it('round-trips the training rules, SUPER pity counters, and drill nonce', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    const initial = createCareer(createLaunchCareerSetup(13579));
    const state: GameState = {
      ...initial,
      totalInstantDrills: 17,
      players: initial.players.map(player => player.id === 'bramble-rovers-p13'
        ? { ...player, drillsSinceSuper: 7 }
        : player),
    };

    await repository.save(state);
    const loaded = await repository.load();

    expect(loaded?.trainingRules).toEqual(state.trainingRules);
    expect(loaded?.totalInstantDrills).toBe(17);
    expect(loaded?.players.find(player => player.id === 'bramble-rovers-p13')?.drillsSinceSuper)
      .toBe(7);
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
      schema_version: 1,
      state_json: '{"schemaVersion":1}',
    });

    await expect(repository.load()).rejects.toBeInstanceOf(
      CorruptCareerSaveError,
    );
    await expect(repository.load()).rejects.toThrow('careerSeed');
  });

  it('rejects an unsupported stored schema version before parsing its payload', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    database.seedCareerRow({ schema_version: 2, state_json: '{not-even-json' });

    await expect(repository.load()).rejects.toBeInstanceOf(
      UnsupportedGameSchemaError,
    );
    await expect(repository.load()).rejects.toThrow('schema 2 is unsupported');
  });

  it('rejects a payload schema that disagrees with the supported row version', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createCareerRepository(database);
    database.seedCareerRow({
      schema_version: 1,
      state_json: '{"schemaVersion":2}',
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
});

function makeState(): GameState {
  const setup: CareerSetup = {
    seed: 987654321,
    userClubId: 'club-00',
    startingTrainingPoints: 7,
    clubs: Array.from({ length: 10 }, (_, index) => ({
      id: `club-${String(index).padStart(2, '0')}`,
      name: `Club ${index}`,
      cash: index === 0 ? 25000 : 10000,
      fans: 500,
      ticketPrice: 4,
      sponsorMonthlyFee: 2000,
      weeklyWages: 3200,
    })),
  };
  return createCareer(setup);
}
