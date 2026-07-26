import { GAME_SCHEMA_VERSION, type GameState } from '../game/types';
import { ENGINE_VERSION } from '../sim/match';
import { InvalidSaveFileError, UnsupportedGameSchemaError } from './errors';
import { parseStoredGameState, serializeGameState } from './game-state-codec';

/**
 * Marks a file as one of ours. A foreign JSON file is refused on this field
 * alone, before anything reads the career out of it.
 */
export const SAVE_FILE_FORMAT = 'hero-football-manager-career';

/**
 * The envelope's own version, separate from the game schema version it carries:
 * the wrapper can gain fields without touching the save shape, and vice versa.
 */
export const SAVE_FILE_FORMAT_VERSION = 1;

/**
 * What an exported file contains. Self-describing on purpose — an import decides
 * whether it can read the file from the envelope, without having to guess from
 * the state inside it.
 */
export interface CareerSaveFileEnvelope {
  readonly format: typeof SAVE_FILE_FORMAT;
  readonly formatVersion: number;
  /** The save schema the career was written at; drives the migration ladder. */
  readonly gameSchemaVersion: number;
  /** The match engine that wrote it. Recorded, never enforced — see below. */
  readonly engineVersion: string;
  readonly state: unknown;
}

export interface DecodedCareerSaveFile {
  readonly state: GameState;
  /** The schema the file declared, i.e. before the migration ladder ran. */
  readonly gameSchemaVersion: number;
  /**
   * The engine version the file declared. A career is not a replay: it stores
   * outcomes, not the RNG stream that produced them, so an engine change cannot
   * invalidate it. Surfaced for diagnostics, never a reason to refuse.
   */
  readonly engineVersion: string;
}

/** The file-system half of an export, injected so persistence keeps no Expo import. */
export interface CareerSaveExportOptions {
  /** The career to write out; the live in-memory state, not the stored row. */
  state: GameState;
  /** Writes UTF-8 text under `fileName` and returns a locator for it (a URI). */
  writeFile: (fileName: string, contents: string) => Promise<string>;
  /** Hands the written file to the user — share sheet on iOS, download on web. */
  shareFile?: (uri: string) => Promise<void>;
}

export interface CareerSaveExportResult {
  readonly fileName: string;
  readonly uri: string;
  /** False when no `shareFile` was injected, so the file exists but was not offered. */
  readonly shared: boolean;
}

/** The file-system half of an import, plus the one write it is allowed to make. */
export interface CareerSaveImportOptions {
  /** Reads the picked file, or resolves null when the player cancelled. */
  readFile: () => Promise<string | null>;
  /**
   * Replaces the live save. Called only after the file has fully validated, so a
   * corrupt or foreign file leaves the existing career untouched.
   */
  replaceSave: (state: GameState) => Promise<void>;
}

/**
 * The name the player sees in the share sheet. Season and week are in the name
 * so a folder of exports is orderable without opening any of them.
 */
export function careerSaveFileName(state: GameState): string {
  return `hero-football-manager-save-s${state.season}w${state.week}.json`;
}

/**
 * Builds the file text for a career.
 *
 * The career goes through `serializeGameState`, so an export is byte-identical
 * to what the live slot holds and an invalid state is refused here rather than
 * becoming a file the player believes in.
 */
export function encodeCareerSaveFile(state: GameState): string {
  const envelope: CareerSaveFileEnvelope = {
    format: SAVE_FILE_FORMAT,
    formatVersion: SAVE_FILE_FORMAT_VERSION,
    gameSchemaVersion: GAME_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    state: JSON.parse(serializeGameState(state)) as unknown,
  };
  return JSON.stringify(envelope);
}

/**
 * Validates a file and returns the career it carries. Throws on anything else —
 * nothing here writes, so every caller gets validate-before-replace for free.
 */
export function decodeCareerSaveFile(contents: string): DecodedCareerSaveFile {
  let payload: unknown;
  try {
    payload = JSON.parse(contents);
  } catch {
    throw new InvalidSaveFileError('it is not valid JSON');
  }
  if (!isRecord(payload) || payload.format !== SAVE_FILE_FORMAT) {
    throw new InvalidSaveFileError('it was not exported by this game');
  }
  if (!Number.isSafeInteger(payload.formatVersion)
    || (payload.formatVersion as number) < 1) {
    throw new InvalidSaveFileError('its file format version is missing or invalid');
  }
  // The same rule the save-migration ladder follows: an older file is read, a
  // newer one is refused, because nothing here can invent the meaning of a field
  // written by a build that does not exist yet.
  if ((payload.formatVersion as number) > SAVE_FILE_FORMAT_VERSION) {
    throw new InvalidSaveFileError(
      `it was exported by a newer version of the game (file format ${
        payload.formatVersion as number
      }, this build reads ${SAVE_FILE_FORMAT_VERSION})`,
    );
  }
  if (!Number.isSafeInteger(payload.gameSchemaVersion)
    || (payload.gameSchemaVersion as number) < 1) {
    throw new InvalidSaveFileError('its game schema version is missing or invalid');
  }
  // Refused from the envelope, before the state is touched: a newer save schema
  // is the one thing an import cannot walk forwards, and saying so up front
  // beats reporting it as a validation failure deep inside the career.
  if ((payload.gameSchemaVersion as number) > GAME_SCHEMA_VERSION) {
    throw new UnsupportedGameSchemaError(
      payload.gameSchemaVersion as number,
      GAME_SCHEMA_VERSION,
    );
  }
  if (typeof payload.engineVersion !== 'string' || payload.engineVersion.length === 0) {
    throw new InvalidSaveFileError('its engine version is missing or invalid');
  }
  if (payload.state === undefined) {
    throw new InvalidSaveFileError('it carries no career');
  }

  // The career itself is validated by the ordinary read path — the retired-content
  // normalisers, the migration ladder, the referential fail-softs and the full
  // schema — so an import can never accept a state a load would reject, and there
  // is no second validator to drift from this one.
  const state = parseStoredGameState(JSON.stringify(payload.state));
  return {
    state,
    gameSchemaVersion: payload.gameSchemaVersion as number,
    engineVersion: payload.engineVersion,
  };
}

/** Writes the career to a file and, when it can, offers that file to the player. */
export async function exportCareerSave(
  options: CareerSaveExportOptions,
): Promise<CareerSaveExportResult> {
  const fileName = careerSaveFileName(options.state);
  const uri = await options.writeFile(fileName, encodeCareerSaveFile(options.state));
  if (options.shareFile === undefined) return { fileName, uri, shared: false };
  await options.shareFile(uri);
  return { fileName, uri, shared: true };
}

/**
 * Replaces the live save with the career in a file the player picked, or returns
 * null when they cancelled. The file is decoded and fully validated before
 * `replaceSave` is reached, so a corrupt, foreign or future file throws with the
 * existing career still in place.
 *
 * WIRING CONTRACT (unwired as of 2026-07-26 — read before adding the store
 * action): schema validation here is NOT the whole load path. The store must
 * treat the returned state exactly like `initializePersistence` treats a
 * loaded row, and like a career replacement:
 *   1. run it through `reconcileLoadedCareer` (roster reconcile + the
 *      retired-content fail-softs) before `set({ career })`,
 *   2. resume via `resumeScreen`, and
 *   3. clean up the replaced career like `startNewCareer` does — delete the
 *      old career's replays; the seed-keyed backup then refreshes on the
 *      first save.
 * Skipping step 1 installs a save the ordinary load path would have repaired,
 * which can throw on every relaunch.
 */
export async function importCareerSave(
  options: CareerSaveImportOptions,
): Promise<GameState | null> {
  const contents = await options.readFile();
  if (contents === null) return null;
  const imported = decodeCareerSaveFile(contents);
  await options.replaceSave(imported.state);
  return imported.state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
