import type { Attrs } from '../../sim/types';
import type { CreatedPlayerAppearance, DifficultyMode } from '../types';
import { DEFAULT_DIFFICULTY, validateDifficulty } from '../difficulty';

export const OUTFIELD_CREATION_STATS = [
  'pac',
  'sho',
  'pas',
  'def',
  'tec',
  'sta',
] as const;

export type OutfieldCreationStat = (typeof OUTFIELD_CREATION_STATS)[number];
export type OutfieldCreationRatings = Record<OutfieldCreationStat, number>;

export const CREATION_STAT_MIN = 35;
export const CREATION_STAT_MAX = 65;
export const CREATION_BASE_RATING = 50;
export const CREATION_POINT_POOL = 15;
export const CREATION_RATING_TOTAL =
  OUTFIELD_CREATION_STATS.length * CREATION_BASE_RATING + CREATION_POINT_POOL;
const CREATED_PLAYER_REF = 10;
export const CREATED_PLAYER_ROOKIE_WAGE = 180;

export const DEFAULT_CREATION_RATINGS: Readonly<OutfieldCreationRatings> =
  Object.freeze({
    pac: CREATION_BASE_RATING,
    sho: CREATION_BASE_RATING,
    pas: CREATION_BASE_RATING,
    def: CREATION_BASE_RATING,
    tec: CREATION_BASE_RATING,
    sta: CREATION_BASE_RATING,
  });

/**
 * One rule for every name the manager types, whether it lands on the rookie,
 * the club, or a squad member they decided to rebrand. Two characters is the
 * shortest thing a scoreboard can print; 24 is what the registration card and
 * the league table's flexible column were measured for.
 */
export const TYPED_NAME_MIN_LENGTH = 2;
export const TYPED_NAME_MAX_LENGTH = 24;

export interface CreatedPlayerDraft {
  name: string;
  ratings: Readonly<OutfieldCreationRatings>;
  appearance?: Readonly<CreatedPlayerAppearance>;
  difficulty?: DifficultyMode;
  /**
   * What the manager renamed their club to. Optional, and a blank entry is
   * dropped rather than rejected: the field ships pre-filled with the club's
   * own name, so clearing it means "leave it alone", not "call it nothing".
   */
  clubName?: string;
  /**
   * New names for squad members the manager inherited, keyed by player id. A
   * blank entry is dropped for the same reason — the rename sheet empties a
   * field the moment it is tapped, so an abandoned field must keep its name.
   */
  rosterNames?: Readonly<Record<string, string>>;
}

export const DEFAULT_CREATED_APPEARANCE: Readonly<CreatedPlayerAppearance> =
  Object.freeze({
    skinTone: 0,
    hairstyle: 0,
    kitAccent: 0,
  });

export function creationPointsRemaining(
  ratings: Readonly<OutfieldCreationRatings>,
): number {
  validateRatingsShape(ratings);
  const ratingTotal = OUTFIELD_CREATION_STATS.reduce(
    (total, stat) => total + ratings[stat],
    0,
  );
  return CREATION_RATING_TOTAL - ratingTotal;
}

export function validateCreatedPlayerDraft(draft: CreatedPlayerDraft): {
  name: string;
  attrs: Attrs;
  appearance: CreatedPlayerAppearance;
  difficulty: DifficultyMode;
  /** Absent when the manager left the club's own name alone. */
  clubName: string | undefined;
  /** Only the ids the manager actually retyped. */
  rosterNames: Readonly<Record<string, string>>;
} {
  const name = validateTypedName(draft.name, 'Player name');
  validateRatingsShape(draft.ratings);
  for (const stat of OUTFIELD_CREATION_STATS) {
    const value = draft.ratings[stat];
    if (
      !Number.isSafeInteger(value) ||
      value < CREATION_STAT_MIN ||
      value > CREATION_STAT_MAX
    ) {
      throw new Error(
        `${stat.toUpperCase()} must be an integer from ${CREATION_STAT_MIN} to ${CREATION_STAT_MAX}`,
      );
    }
  }
  const pointsRemaining = creationPointsRemaining(draft.ratings);
  if (pointsRemaining < 0) {
    throw new Error(
      `Creation ratings exceed the available point pool by ${-pointsRemaining}`,
    );
  }
  return {
    name,
    attrs: { ...draft.ratings, ref: CREATED_PLAYER_REF },
    appearance: validateCreatedAppearance(
      draft.appearance ?? DEFAULT_CREATED_APPEARANCE,
    ),
    difficulty: validateDifficulty(draft.difficulty ?? DEFAULT_DIFFICULTY),
    clubName: validateOptionalTypedName(draft.clubName, 'Club name'),
    rosterNames: validateRosterNames(draft.rosterNames),
  };
}

/** Trims, collapses runs of spaces, and holds the length rule. */
export function validateTypedName(value: string, subject: string): string {
  if (typeof value !== 'string') throw new Error(`${subject} must be text`);
  const name = value.trim().replace(/\s+/g, ' ');
  if (
    name.length < TYPED_NAME_MIN_LENGTH ||
    name.length > TYPED_NAME_MAX_LENGTH
  ) {
    throw new Error(
      `${subject} must contain ${TYPED_NAME_MIN_LENGTH} to ${TYPED_NAME_MAX_LENGTH} characters`,
    );
  }
  return name;
}

/** Blank means "unchanged"; anything else must still be a legal name. */
function validateOptionalTypedName(
  value: string | undefined,
  subject: string,
): string | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  return validateTypedName(value, subject);
}

function validateRosterNames(
  names: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> {
  if (names === undefined) return {};
  if (typeof names !== 'object' || names === null || Array.isArray(names)) {
    throw new Error('Roster names must be an object keyed by player id');
  }
  const validated: Record<string, string> = {};
  for (const [playerId, value] of Object.entries(names)) {
    const name = validateOptionalTypedName(value, `Squad name for ${playerId}`);
    if (name !== undefined) validated[playerId] = name;
  }
  return validated;
}

function validateCreatedAppearance(
  value: Readonly<CreatedPlayerAppearance>,
): CreatedPlayerAppearance {
  if (
    !Number.isSafeInteger(value.skinTone) ||
    value.skinTone < 0 ||
    value.skinTone > 5
  ) {
    throw new Error('Skin tone choice must be from 0 to 5');
  }
  if (
    !Number.isSafeInteger(value.hairstyle) ||
    value.hairstyle < 0 ||
    value.hairstyle > 9
  ) {
    throw new Error('Hairstyle choice must be from 0 to 9');
  }
  if (
    !Number.isSafeInteger(value.kitAccent) ||
    value.kitAccent < 0 ||
    value.kitAccent > 3
  ) {
    throw new Error('Kit accent choice must be from 0 to 3');
  }
  return { ...value };
}

function validateRatingsShape(
  ratings: Readonly<OutfieldCreationRatings>,
): void {
  if (
    typeof ratings !== 'object' ||
    ratings === null ||
    Array.isArray(ratings)
  ) {
    throw new Error('Creation ratings must be an object');
  }
  const keys = Object.keys(ratings).sort();
  const expected = [...OUTFIELD_CREATION_STATS].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    throw new Error(
      'Creation ratings must contain exactly PAC, SHO, PAS, DEF, TEC, and STA',
    );
  }
}
