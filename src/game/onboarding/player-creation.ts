import type { Attrs } from '../../sim/types';
import type {
  ClubKitState,
  CreatedPlayerAppearance,
  DifficultyMode,
} from '../types';
import { DEFAULT_DIFFICULTY, validateDifficulty } from '../difficulty';
import { reducedPlayerWeeklyWage } from '../market';

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
export const CREATED_PLAYER_ROOKIE_WAGE = reducedPlayerWeeklyWage(180);

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
  /**
   * The club's chosen shirt. Absent means the stock strip, which is what every
   * career had before the kit editor existed.
   */
  clubKit?: Readonly<ClubKitState>;
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

function validateClubKit(
  kit: Readonly<ClubKitState> | undefined,
): ClubKitState | undefined {
  if (kit === undefined) return undefined;
  for (const field of ['base', 'pattern', 'patternColor'] as const) {
    if (typeof kit[field] !== 'string' || kit[field].length === 0) {
      throw new Error(`Club kit ${field} must be a non-empty id`);
    }
  }
  return {
    base: kit.base,
    pattern: kit.pattern,
    patternColor: kit.patternColor,
  };
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
  /** Absent when the manager never opened the kit editor. */
  clubKit: ClubKitState | undefined;
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
    // Ids are not checked against a catalog here: the catalog lives in the
    // render ring, which a pure ring may not import, and an unknown id already
    // falls back to the stock strip where the pixels are painted.
    clubKit: validateClubKit(draft.clubKit),
  };
}

/**
 * What the one shipped pixel face can actually draw.
 *
 * The game has a single type family for every locale — Silkscreen, extended by
 * hand with the Vietnamese precomposed set — and every name the manager types
 * is drawn in it: league table, scoreboard, squad register, match HUD. Anything
 * outside its cmap renders as a tofu box, in all seven languages, and
 * validation checked LENGTH only. `Łukasz`, `Çalhanoğlu`, `Ολυμπιακός`,
 * `Зенит`, `中村俊輔` and `🏆` were all accepted; any Polish, Turkish, Greek,
 * Cyrillic or CJK keyboard reaches this, and so does the emoji key.
 *
 * Derived from the face itself — `glyphSet(faceFile(...))` in
 * `src/i18n/glyph-coverage.ts` reports 328 codepoints — narrowed to what
 * belongs in a name. This ring is pure TypeScript and cannot read a TTF at
 * runtime, so the ranges are written out rather than computed.
 *
 *   - ASCII letters, digits, space, and the three name punctuators `. ' -`
 *   - Latin-1 letters (`À`–`ÿ`, minus the `×` and `÷` sitting inside that block)
 *   - the extras the face carries: `Ăă Đđ Ĩĩ Œœ Šš Ũũ Ÿ Žž Ơơ Ưư`
 *   - the Vietnamese precomposed block `Ạ`–`ỹ` (U+1EA0–U+1EF9)
 *
 * Braces are excluded on their own account as well: a name containing `{count}`
 * used to knock translated sentences back to English (`copyOrEnglish`). So is
 * U+202E RIGHT-TO-LEFT OVERRIDE, which is not a glyph at all — it reverses
 * every character drawn after it, so `Bob<U+202E>htimS` renders as `Bob Smith`
 * on a scoreboard and as itself in a save file.
 */
const DRAWABLE_NAME = /^[A-Za-z0-9 .'\-À-ÖØ-öø-ÿĂăĐđĨĩŒœŠšŨũŸŽžƠơƯưẠ-ỹ]+$/;

/**
 * What an iOS keyboard types where the face has a plain glyph.
 *
 * Smart Punctuation is ON by default on iOS, so an apostrophe arrives as U+2019
 * and a hyphen typed twice arrives as an en/em dash. `O’Neill` from an iPhone
 * would otherwise be refused as undrawable while the source literal `O'Neill`
 * passed every test — the exact shape of bug a test that types ASCII can never
 * see. Folding is deliberately one-way and tiny: these are the substitutions the
 * keyboard makes on its own, not a general transliteration.
 */
const KEYBOARD_SUBSTITUTIONS: readonly (readonly [RegExp, string])[] = [
  [/[‘’ʼ]/g, "'"],
  [/[–—−]/g, '-'],
  [/[“”]/g, '"'],
  [/…/g, '...'],
  [/[   ]/g, ' '],
];

/** Trims, collapses runs of spaces, and holds the length and glyph rules. */
export function validateTypedName(value: string, subject: string): string {
  if (typeof value !== 'string') throw new Error(`${subject} must be text`);
  // NFC first: a Vietnamese name typed with combining marks decomposes, and the
  // face carries the precomposed block, so the composed form is the drawable
  // one even though both look identical on screen.
  let name = value.normalize('NFC');
  for (const [pattern, plain] of KEYBOARD_SUBSTITUTIONS) {
    name = name.replace(pattern, plain);
  }
  name = name.trim().replace(/\s+/g, ' ');
  if (
    name.length < TYPED_NAME_MIN_LENGTH ||
    name.length > TYPED_NAME_MAX_LENGTH
  ) {
    throw new Error(
      `${subject} must contain ${TYPED_NAME_MIN_LENGTH} to ${TYPED_NAME_MAX_LENGTH} characters`,
    );
  }
  if (!DRAWABLE_NAME.test(name)) {
    throw new Error(`${subject} uses characters the game cannot display`);
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
    value.kitAccent > 4
  ) {
    throw new Error('Kit accent choice must be from 0 to 4');
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
