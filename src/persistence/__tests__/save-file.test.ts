import { createLaunchCareerSetup } from '../../application/launch';
import { createCareer } from '../../game/career';
import { GAME_SCHEMA_VERSION, type GameState } from '../../game/types';
import { ENGINE_VERSION } from '../../sim/match';
import { createCareerRepository, type CareerRepository } from '../career-repository';
import {
  InvalidGameStateError,
  InvalidSaveFileError,
  UnsupportedGameSchemaError,
} from '../errors';
import {
  careerSaveFileName,
  decodeCareerSaveFile,
  encodeCareerSaveFile,
  exportCareerSave,
  exportRawCareerSave,
  importCareerSave,
  SAVE_FILE_FORMAT,
  SAVE_FILE_FORMAT_VERSION,
} from '../save-file';
import { FakePersistenceDatabase } from './fake-database';

describe('career save file export', () => {
  it('writes a self-describing payload and offers it to the player', async () => {
    const state = baseCareer();
    const files = new Map<string, string>();
    const shared: string[] = [];

    const result = await exportCareerSave({
      state,
      writeFile: async (fileName, contents) => {
        files.set(fileName, contents);
        return `file:///exports/${fileName}`;
      },
      shareFile: async uri => { shared.push(uri); },
    });

    expect(result.fileName).toBe(careerSaveFileName(state));
    expect(result.uri).toBe(`file:///exports/${result.fileName}`);
    expect(result.shared).toBe(true);
    expect(shared).toEqual([result.uri]);
    const envelope = JSON.parse(files.get(result.fileName)!) as Record<string, unknown>;
    // The version fields are the point of the envelope: an import decides what it
    // can read from these without having to guess from the state inside.
    expect(envelope.format).toBe(SAVE_FILE_FORMAT);
    expect(envelope.formatVersion).toBe(SAVE_FILE_FORMAT_VERSION);
    expect(envelope.gameSchemaVersion).toBe(GAME_SCHEMA_VERSION);
    expect(envelope.engineVersion).toBe(ENGINE_VERSION);
  });

  it('names the file after the season and week it holds', () => {
    const state = { ...baseCareer(), season: 3, week: 12 };

    expect(careerSaveFileName(state)).toBe('hero-football-manager-save-s3w12.json');
  });

  it('reports the write failure instead of claiming a file exists', async () => {
    await expect(exportCareerSave({
      state: baseCareer(),
      writeFile: async () => { throw new Error('the disk is full'); },
    })).rejects.toThrow('the disk is full');
  });

  it('says the file was not offered when nothing can share it', async () => {
    const result = await exportCareerSave({
      state: baseCareer(),
      writeFile: async fileName => `file:///exports/${fileName}`,
    });

    expect(result.shared).toBe(false);
  });

  it('refuses to write a file from a state a load would reject', () => {
    const broken = { ...baseCareer(), week: 0 };

    expect(() => encodeCareerSaveFile(broken)).toThrow(InvalidGameStateError);
  });

  it('exports an incompatible raw payload byte-for-byte without decoding it', async () => {
    const raw = {
      schemaVersion: 1,
      stateJson: '{"schemaVersion":1,"future":"untouched"}',
    };
    let written = '';
    const result = await exportRawCareerSave({
      raw,
      writeFile: async (_fileName, contents) => {
        written = contents;
        return 'file:///raw.json';
      },
    });

    expect(result.fileName).toBe('hero-football-manager-raw-schema-1.json');
    expect(written).toBe(raw.stateJson);
  });
});

describe('career save file import', () => {
  it('round-trips a career through a file and into the live slot', async () => {
    const { repository } = await savedCareer(baseCareer());
    // A different career entirely: the import has to replace the live one, not
    // merge into it.
    const exported = encodeCareerSaveFile(createCareer(createLaunchCareerSetup(909090)));

    const imported = await importCareerSave({
      readFile: async () => exported,
      replaceSave: state => repository.save(state),
    });

    expect(imported?.careerSeed).toBe(909090);
    // The career the live slot now holds is the one the file carried, not a
    // lossy copy of it.
    expect(await repository.load()).toEqual(imported);
  });

  it('returns null and writes nothing when the player cancels the picker', async () => {
    const { repository, state } = await savedCareer(baseCareer());
    let writes = 0;

    const imported = await importCareerSave({
      readFile: async () => null,
      replaceSave: async () => { writes += 1; },
    });

    expect(imported).toBeNull();
    expect(writes).toBe(0);
    expect((await repository.load())?.careerSeed).toBe(state.careerSeed);
  });

  it.each([
    ['not JSON at all', 'this is a photo, not a save', 'not valid JSON'],
    [
      'a foreign JSON file',
      JSON.stringify({ some: 'other app', state: {} }),
      'not exported by this game',
    ],
    [
      'a payload with no career',
      JSON.stringify(envelopeWithout('state')),
      'carries no career',
    ],
    [
      'a payload with no format version',
      JSON.stringify(envelopeWithout('formatVersion')),
      'file format version is missing',
    ],
    [
      'a payload with no engine version',
      JSON.stringify(envelopeWithout('engineVersion')),
      'engine version is missing',
    ],
    [
      'a truncated career',
      JSON.stringify({ ...envelope(), state: { schemaVersion: GAME_SCHEMA_VERSION } }),
      'career save is corrupt',
    ],
  ])('leaves the live save untouched when handed %s', async (_case, contents, message) => {
    const { repository, stored } = await savedCareer(baseCareer());
    let writes = 0;

    await expect(importCareerSave({
      readFile: async () => contents,
      replaceSave: async () => { writes += 1; },
    })).rejects.toThrow(message);

    // The guarantee: validation happens before the one write an import may make.
    expect(writes).toBe(0);
    expect(await repository.load()).toEqual(stored);
  });

  it('refuses a file written by a newer build of the game', () => {
    expect(() => decodeCareerSaveFile(JSON.stringify({
      ...envelope(),
      formatVersion: SAVE_FILE_FORMAT_VERSION + 1,
    }))).toThrow(InvalidSaveFileError);
    expect(() => decodeCareerSaveFile(JSON.stringify({
      ...envelope(),
      formatVersion: SAVE_FILE_FORMAT_VERSION + 1,
    }))).toThrow('newer version of the game');
  });

  it('refuses a newer save schema from the envelope, before reading the career', () => {
    // The same rule the load path follows: older is walked up the ladder, newer is
    // refused, because this build cannot know what a future field means.
    const future = {
      ...envelope(),
      gameSchemaVersion: GAME_SCHEMA_VERSION + 1,
      state: { nothing: 'this build could ever read' },
    };

    expect(() => decodeCareerSaveFile(JSON.stringify(future)))
      .toThrow(UnsupportedGameSchemaError);
  });

  it('reads an older save through the same read path a stored save uses', () => {
    // A pre-`awakening` career is the shape the codec already rescues on load; an
    // import must not be stricter than a load, or an old export becomes a brick.
    const older = JSON.parse(JSON.stringify(baseCareer())) as Record<string, unknown>;
    delete older.awakening;

    const decoded = decodeCareerSaveFile(JSON.stringify({ ...envelope(), state: older }));

    expect(decoded.state.awakening).toEqual({
      matchesSinceLastAwakening: 0,
      usedTriggerIds: [],
    });
    expect(decoded.gameSchemaVersion).toBe(GAME_SCHEMA_VERSION);
    expect(decoded.engineVersion).toBe(ENGINE_VERSION);
  });
});

function baseCareer(): GameState {
  return createCareer(createLaunchCareerSetup(31415));
}

function envelope(): Record<string, unknown> {
  return JSON.parse(encodeCareerSaveFile(baseCareer())) as Record<string, unknown>;
}

function envelopeWithout(field: string): Record<string, unknown> {
  const payload = envelope();
  delete payload[field];
  return payload;
}

/** A live career in a real slot, plus the exact state a load returns for it. */
async function savedCareer(state: GameState): Promise<{
  repository: CareerRepository;
  state: GameState;
  stored: GameState | null;
}> {
  const repository = await createCareerRepository(new FakePersistenceDatabase());
  await repository.save(state);
  return { repository, state, stored: await repository.load() };
}
