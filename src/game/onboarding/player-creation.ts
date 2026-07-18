import type { Attrs } from '../../sim/types';

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
export const CREATION_POINT_POOL = 105;
export const CREATION_RATING_TOTAL =
  OUTFIELD_CREATION_STATS.length * CREATION_STAT_MIN + CREATION_POINT_POOL;
export const CREATED_PLAYER_REF = 10;
export const CREATED_PLAYER_ROOKIE_WAGE = 180;

export const DEFAULT_CREATION_RATINGS: Readonly<OutfieldCreationRatings> = Object.freeze({
  pac: 53,
  sho: 53,
  pas: 53,
  def: 52,
  tec: 52,
  sta: 52,
});

export interface CreatedPlayerDraft {
  name: string;
  ratings: Readonly<OutfieldCreationRatings>;
}

export function creationPointsRemaining(ratings: Readonly<OutfieldCreationRatings>): number {
  validateRatingsShape(ratings);
  const spent = OUTFIELD_CREATION_STATS.reduce(
    (total, stat) => total + ratings[stat] - CREATION_STAT_MIN,
    0,
  );
  return CREATION_POINT_POOL - spent;
}

export function validateCreatedPlayerDraft(draft: CreatedPlayerDraft): {
  name: string;
  attrs: Attrs;
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
  if (pointsRemaining !== 0) {
    throw new Error(`Spend the full point pool (${pointsRemaining} remaining)`);
  }
  return {
    name,
    attrs: { ...draft.ratings, ref: CREATED_PLAYER_REF },
  };
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
