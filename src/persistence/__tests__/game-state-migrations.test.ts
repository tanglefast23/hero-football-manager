import { GAME_SCHEMA_VERSION } from '../../game/types';
import { migrateStoredGameState } from '../game-state-codec';
import { CorruptCareerSaveError, UnsupportedGameSchemaError } from '../errors';

/**
 * These lock the behaviour at the boundary rather than any individual rung: a
 * current save passes through untouched, a future save is refused instead of
 * being half-read, and an old save with no rung fails loudly with the schema
 * error rather than being reported as corrupt data.
 *
 * The 2 → 3 case is covered too, because that rung is load-bearing in a way
 * that is easy to miss — the fields player requests added are all optional, so
 * the rung looks like a no-op and deleting it would look harmless. It is not:
 * without it the ladder refuses every schema-2 save outright.
 */
describe('stored game state migrations', () => {
  it('passes a save already at the current version through unchanged', () => {
    const save = { schemaVersion: GAME_SCHEMA_VERSION, season: 3, userClubId: 'c1' };

    expect(migrateStoredGameState(save)).toEqual(save);
  });

  it('refuses a save written by a newer build rather than guessing', () => {
    const save = { schemaVersion: GAME_SCHEMA_VERSION + 1 };

    expect(() => migrateStoredGameState(save)).toThrow(UnsupportedGameSchemaError);
  });

  it('walks a schema-2 save up to the current version', () => {
    const save = { schemaVersion: 2, season: 3, userClubId: 'c1' };

    expect(migrateStoredGameState(save))
      .toEqual({ schemaVersion: GAME_SCHEMA_VERSION, season: 3, userClubId: 'c1' });
  });

  it('refuses an older save when no rung covers its version', () => {
    // Version 0 can never have a rung, so it stands in for "a gap in the ladder".
    expect(() => migrateStoredGameState({ schemaVersion: 0 })).toThrow(UnsupportedGameSchemaError);
  });

  it('reports a missing or non-integer schemaVersion as a corrupt save', () => {
    expect(() => migrateStoredGameState({})).toThrow(CorruptCareerSaveError);
    expect(() => migrateStoredGameState({ schemaVersion: 1.5 })).toThrow(CorruptCareerSaveError);
    expect(() => migrateStoredGameState('not an object')).toThrow(CorruptCareerSaveError);
  });

  it('names both versions in the error so a downgrade is diagnosable', () => {
    expect(() => migrateStoredGameState({ schemaVersion: 99 }))
      .toThrow(`game state schema 99 is unsupported; this build supports schema ${GAME_SCHEMA_VERSION}`);
  });
});
