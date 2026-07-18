import { ENGINE_VERSION } from '../../sim/match';
import { ROVERS, UNITED } from '../../sim/teams';
import type { ReplayEnvelope } from '../../sim/types';
import {
  CorruptReplayEnvelopeError,
  InvalidReplayEnvelopeError,
  UnsupportedReplaySchemaError,
} from '../errors';
import { REPLAY_SCHEMA_VERSION } from '../replay-codec';
import { createReplayRepository } from '../replay-repository';
import { FakePersistenceDatabase } from './fake-database';

describe('replay repository', () => {
  it('round-trips the full replay envelope and preserves ordered inputs', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createReplayRepository(database);
    const envelope = makeEnvelope();
    const original = JSON.stringify(envelope);

    await repository.save('career-1', 's1-r1-m1', 1, envelope);
    const loaded = await repository.load('career-1', 's1-r1-m1');

    expect(loaded).toEqual(envelope);
    expect(loaded?.inputs).toEqual([
      { tick: 25, kind: 'POWER_TAP', player: 9 },
      { tick: 25, kind: 'POWER_TAP', player: 10 },
      { tick: 40, kind: 'POWER_TAP', player: 9 },
    ]);
    expect(JSON.stringify(envelope)).toBe(original);
  });

  it('overwrites one career/fixture key with the latest envelope and order', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createReplayRepository(database);
    const first = makeEnvelope();
    const second: ReplayEnvelope = {
      ...first,
      inputs: [...first.inputs, { tick: 60, kind: 'POWER_TAP', player: 10 }],
    };

    await repository.save('career-1', 'fixture-1', 9, first);
    await repository.save('career-1', 'fixture-1', 2, second);

    await expect(repository.load('career-1', 'fixture-1')).resolves.toEqual(
      second,
    );
    await expect(repository.listForCareer('career-1')).resolves.toEqual([
      {
        careerId: 'career-1',
        fixtureId: 'fixture-1',
        sortOrder: 2,
        envelope: second,
      },
    ]);
    expect(database.replayRows.size).toBe(1);
  });

  it('lists one career deterministically by order then binary fixture ID', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createReplayRepository(database);
    const envelope = makeEnvelope();

    await repository.save('career-1', 'fixture-z', 20, envelope);
    await repository.save('career-1', 'fixture-b', 10, envelope);
    await repository.save('career-1', 'fixture-A', 10, envelope);
    await repository.save('career-2', 'fixture-0', 0, envelope);

    const replays = await repository.listForCareer('career-1');
    expect(
      replays.map((replay) => `${replay.sortOrder}:${replay.fixtureId}`),
    ).toEqual(['10:fixture-A', '10:fixture-b', '20:fixture-z']);
  });

  it('returns null for a missing replay and supports idempotent deletion', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createReplayRepository(database);

    await expect(repository.load('career-1', 'missing')).resolves.toBeNull();
    await repository.save('career-1', 'fixture-1', 1, makeEnvelope());
    await repository.delete('career-1', 'fixture-1');
    await repository.delete('career-1', 'fixture-1');
    await expect(repository.load('career-1', 'fixture-1')).resolves.toBeNull();
  });

  it('clears only the selected career replay namespace', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createReplayRepository(database);
    await repository.save('career-1', 'fixture-1', 1, makeEnvelope());
    await repository.save('career-1', 'fixture-2', 2, makeEnvelope());
    await repository.save('career-2', 'fixture-1', 1, makeEnvelope());

    await repository.deleteAllForCareer('career-1');

    await expect(repository.listForCareer('career-1')).resolves.toEqual([]);
    await expect(repository.listForCareer('career-2')).resolves.toHaveLength(1);
  });

  it('surfaces corrupt JSON and row metadata clearly', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createReplayRepository(database);
    database.seedReplayRow(storedRow({ envelope_json: '{broken' }));

    await expect(
      repository.load('career-1', 'fixture-1'),
    ).rejects.toBeInstanceOf(CorruptReplayEnvelopeError);
    await expect(repository.load('career-1', 'fixture-1')).rejects.toThrow(
      'envelope_json is not valid JSON',
    );
  });

  it('rejects unsupported row and payload replay schemas', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createReplayRepository(database);
    database.seedReplayRow(storedRow({ schema_version: 2 }));

    await expect(
      repository.load('career-1', 'fixture-1'),
    ).rejects.toBeInstanceOf(UnsupportedReplaySchemaError);

    database.seedReplayRow(storedRow({ envelope_json: '{"schemaVersion":2}' }));
    await expect(
      repository.load('career-1', 'fixture-1'),
    ).rejects.toBeInstanceOf(UnsupportedReplaySchemaError);
  });

  it('rejects an engine-version column that disagrees with the envelope', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createReplayRepository(database);
    database.seedReplayRow(storedRow({ engine_version: 'different-engine' }));

    await expect(repository.load('career-1', 'fixture-1')).rejects.toThrow(
      'engine_version column does not match',
    );
  });

  it('refuses malformed or unordered envelopes before writing', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createReplayRepository(database);
    const envelope = makeEnvelope();
    const unordered: ReplayEnvelope = {
      ...envelope,
      inputs: [
        { tick: 20, kind: 'POWER_TAP', player: 9 },
        { tick: 10, kind: 'POWER_TAP', player: 10 },
      ],
    };

    await expect(
      repository.save('career-1', 'fixture-1', 0, unordered),
    ).rejects.toBeInstanceOf(InvalidReplayEnvelopeError);
    expect(database.replayRows.size).toBe(0);
  });

  it('applies the same structural rules as runtime replay validation', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createReplayRepository(database);
    const invalidTarget: ReplayEnvelope = {
      ...makeEnvelope(),
      inputs: [{ tick: 0, kind: 'POWER_TAP', player: 0 }],
    };

    await expect(
      repository.save('career-1', 'fixture-1', 0, invalidTarget),
    ).rejects.toThrow('input tick');
    expect(database.replayRows.size).toBe(0);
  });

  it('rejects a stored envelope that runtime replay validation cannot execute', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createReplayRepository(database);
    const invalidStoredEnvelope: ReplayEnvelope = {
      ...makeEnvelope(),
      inputs: [{ tick: 0, kind: 'POWER_TAP', player: 0 }],
    };
    database.seedReplayRow(storedRow({
      envelope_json: JSON.stringify(invalidStoredEnvelope),
    }));

    await expect(
      repository.load('career-1', 'fixture-1'),
    ).rejects.toBeInstanceOf(CorruptReplayEnvelopeError);
    await expect(
      repository.load('career-1', 'fixture-1'),
    ).rejects.toThrow('input tick');
  });

  it('round-trips a replay controlled from the away team', async () => {
    const database = new FakePersistenceDatabase();
    const repository = await createReplayRepository(database);
    const awayControlled: ReplayEnvelope = {
      ...makeEnvelope(),
      inputs: [{ tick: 25, kind: 'POWER_TAP', player: 14 }],
      opts: {
        homePolicy: 'FIRE_WHEN_READY',
        awayPolicy: 'SAVE_FOR_TAP',
      },
    };

    await repository.save('career-1', 'away-fixture', 2, awayControlled);

    await expect(
      repository.load('career-1', 'away-fixture'),
    ).resolves.toEqual(awayControlled);
  });
});

function makeEnvelope(): ReplayEnvelope {
  return {
    schemaVersion: REPLAY_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    seed: 246813579,
    home: ROVERS,
    away: UNITED,
    inputs: [
      { tick: 25, kind: 'POWER_TAP', player: 9 },
      { tick: 25, kind: 'POWER_TAP', player: 10 },
      { tick: 40, kind: 'POWER_TAP', player: 9 },
    ],
    opts: { homePolicy: 'SAVE_FOR_TAP', awayPolicy: 'FIRE_WHEN_READY' },
  };
}

function storedRow(overrides: Record<string, unknown> = {}) {
  const envelope = makeEnvelope();
  return {
    career_id: 'career-1',
    fixture_id: 'fixture-1',
    sort_order: 1,
    schema_version: REPLAY_SCHEMA_VERSION,
    engine_version: envelope.engineVersion,
    envelope_json: JSON.stringify(envelope),
    ...overrides,
  };
}
