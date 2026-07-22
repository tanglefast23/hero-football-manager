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
export const CREATED_PLAYER_REF = 10;
export const CREATED_PLAYER_ROOKIE_WAGE = 180;

export const DEFAULT_CREATION_RATINGS: Readonly<OutfieldCreationRatings> = Object.freeze({
  pac: CREATION_BASE_RATING,
  sho: CREATION_BASE_RATING,
  pas: CREATION_BASE_RATING,
  def: CREATION_BASE_RATING,
  tec: CREATION_BASE_RATING,
  sta: CREATION_BASE_RATING,
});

export interface CreatedPlayerDraft {
  name: string;
  ratings: Readonly<OutfieldCreationRatings>;
  appearance?: Readonly<CreatedPlayerAppearance>;
  difficulty?: DifficultyMode;
}

export const DEFAULT_CREATED_APPEARANCE: Readonly<CreatedPlayerAppearance> = Object.freeze({
  skinTone: 2,
  hairstyle: 2,
  kitAccent: 0,
});

export function creationPointsRemaining(ratings: Readonly<OutfieldCreationRatings>): number {
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
} {
  const name = draft.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 24) {
    throw new Error('Player name must contain 2 to 24 characters');
  }
  validateRatingsShape(draft.ratings);
  for (const stat of OUTFIELD_CREATION_STATS) {
    const value = draft.ratings[stat];
    if (!Number.isSafeInteger(value) || value < CREATION_STAT_MIN || value > CREATION_STAT_MAX) {
      throw new Error(
        `${stat.toUpperCase()} must be an integer from ${CREATION_STAT_MIN} to ${CREATION_STAT_MAX}`,
      );
    }
  }
  const pointsRemaining = creationPointsRemaining(draft.ratings);
  if (pointsRemaining < 0) {
    throw new Error(`Creation ratings exceed the available point pool by ${-pointsRemaining}`);
  }
  return {
    name,
    attrs: { ...draft.ratings, ref: CREATED_PLAYER_REF },
    appearance: validateCreatedAppearance(draft.appearance ?? DEFAULT_CREATED_APPEARANCE),
    difficulty: validateDifficulty(draft.difficulty ?? DEFAULT_DIFFICULTY),
  };
}

function validateCreatedAppearance(value: Readonly<CreatedPlayerAppearance>): CreatedPlayerAppearance {
  if (!Number.isSafeInteger(value.skinTone) || value.skinTone < 0 || value.skinTone > 5) {
    throw new Error('Skin tone choice must be from 0 to 5');
  }
  if (!Number.isSafeInteger(value.hairstyle) || value.hairstyle < 0 || value.hairstyle > 9) {
    throw new Error('Hairstyle choice must be from 0 to 9');
  }
  if (!Number.isSafeInteger(value.kitAccent) || value.kitAccent < 0 || value.kitAccent > 3) {
    throw new Error('Kit accent choice must be from 0 to 3');
  }
  return { ...value };
}

function validateRatingsShape(ratings: Readonly<OutfieldCreationRatings>): void {
  if (typeof ratings !== 'object' || ratings === null || Array.isArray(ratings)) {
    throw new Error('Creation ratings must be an object');
  }
  const keys = Object.keys(ratings).sort();
  const expected = [...OUTFIELD_CREATION_STATS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error('Creation ratings must contain exactly PAC, SHO, PAS, DEF, TEC, and STA');
  }
}
