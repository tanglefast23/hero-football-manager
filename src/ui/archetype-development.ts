import type { PlayerArchetype } from '../game/types';

/**
 * What an archetype does to training, in the two lines the player file shows.
 *
 * **The id is not the copy.** This table used to be keyed by the archetype's
 * English display name and `Record<string, …>`, which read as harmless — the
 * display name and the id are the same string today. They are the same string
 * because `PlayerArchetype` is a persisted zod enum (`src/game/types.ts`) and
 * `archetype-caps.ts` switches on it to decide a real training bonus. Translate
 * the value the screen passes in and every lookup misses at once, sending every
 * player on the roster to the `+ BALANCED / - UNKNOWN` fallback — silently,
 * because a fallback is what a fallback looks like.
 *
 * So the row key is typed as the enum, the screen passes the id, and the words
 * come from the catalog. `archetype-caps.test.ts`'s sibling below asserts every
 * shipped id still finds a row, so the fallback can never swallow them all
 * again without a test going red.
 *
 * @i18n-fallback — the English half of the dual write. `strengthsKey` and
 * `weaknessesKey` are what the screen draws; these stay as the fallback and as
 * the source the six translations were written from.
 */
export interface ArchetypeDevelopmentSummary {
  strengths: string;
  strengthsKey: string;
  weaknesses: string;
  weaknessesKey: string;
}

/** @i18n-fallback — see `ArchetypeDevelopmentSummary`. */
const ARCHETYPE_DEVELOPMENT: Readonly<Record<PlayerArchetype, ArchetypeDevelopmentSummary>> = {
  Speedster: {
    strengths: '+15% PAC',
    strengthsKey: 'archetype.speedster.strengths',
    weaknesses: 'OTHER STATS +0%',
    weaknessesKey: 'archetype.speedster.weaknesses',
  },
  Sniper: {
    strengths: '+15% SHO',
    strengthsKey: 'archetype.sniper.strengths',
    weaknesses: 'OTHER STATS +0%',
    weaknessesKey: 'archetype.sniper.weaknesses',
  },
  Playmaker: {
    strengths: '+15% PAS & TEC',
    strengthsKey: 'archetype.playmaker.strengths',
    weaknesses: 'OTHER STATS +0%',
    weaknessesKey: 'archetype.playmaker.weaknesses',
  },
  Anchor: {
    strengths: '+15% DEF & STA',
    strengthsKey: 'archetype.anchor.strengths',
    weaknesses: 'OTHER STATS +0%',
    weaknessesKey: 'archetype.anchor.weaknesses',
  },
  Wall: {
    strengths: '+15% REF & DEF',
    strengthsKey: 'archetype.wall.strengths',
    weaknesses: 'OTHER STATS +0%',
    weaknessesKey: 'archetype.wall.weaknesses',
  },
  Engine: {
    strengths: '+15% STA & PAC',
    strengthsKey: 'archetype.engine.strengths',
    weaknesses: 'OTHER STATS +0%',
    weaknessesKey: 'archetype.engine.weaknesses',
  },
  'All-Rounder': {
    strengths: '+5% ALL STATS',
    strengthsKey: 'archetype.allRounder.strengths',
    weaknesses: 'NO WEAK SPOT',
    weaknessesKey: 'archetype.allRounder.weaknesses',
  },
  Prodigy: {
    strengths: '+20% ALL STATS',
    strengthsKey: 'archetype.prodigy.strengths',
    weaknesses: 'NO WEAK SPOT',
    weaknessesKey: 'archetype.prodigy.weaknesses',
  },
};

/** @i18n-fallback — the row for an id no longer in the enum. */
const UNKNOWN_ARCHETYPE: ArchetypeDevelopmentSummary = {
  strengths: '+ BALANCED',
  strengthsKey: 'archetype.unknown.strengths',
  weaknesses: '- UNKNOWN',
  weaknessesKey: 'archetype.unknown.weaknesses',
};

/**
 * Takes the archetype ID, never its display name.
 *
 * The parameter stays `string` because the view model widens it for old saves,
 * but the table is typed by the enum, so a renamed archetype breaks the build
 * rather than quietly falling through here.
 */
export function archetypeDevelopmentSummary(archetype: string): ArchetypeDevelopmentSummary {
  return ARCHETYPE_DEVELOPMENT[archetype as PlayerArchetype] ?? UNKNOWN_ARCHETYPE;
}
