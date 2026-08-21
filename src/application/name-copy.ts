import type { CopyFn } from '../i18n';
import { powerCopySlug } from '../i18n';
import { FACILITY_CATALOG, type FacilityType } from '../game/facilities';
import type { TrainingModifier } from '../game/training';
import { facilityName } from './copy-fallback';

/**
 * The one place a game enum turns into a word the player reads.
 *
 * Every id in this module used to reach the screen through a prettifier —
 * `readableId` in `market-view-model.ts`, its twin `readableLabel` in
 * `view-models.ts`, and a bare `.replaceAll('-', ' ')` in `event-selection.ts`.
 * A prettifier is a translation gate that always answers in English: it turns
 * `SOUTH_AMERICA` into "South America" and `Fiery` into "Fiery" no matter which
 * language the rest of the sentence is in, which is how a Vietnamese scout
 * screen ended up offering trips to "South America" and a German story event
 * asked for a "Fiery" player.
 *
 * So the ids stay ids — they are persisted, compared and switched on — and the
 * word is looked up. `readableToken` survives only as the last resort for an id
 * no table knows, which is exactly what a prettifier is good for.
 *
 * **Two spellings of the same enum.** Personality exists twice: title case in
 * `src/game/types.ts` (`'Fiery'`, persisted on every player and authored in
 * `events.json`) and upper case in `src/game/market.ts` (`'FIERY'`, on coaches
 * and negotiations). Coach specialty is the same story — `'Attack'` in
 * `pyramid.ts`, `'ATTACK'` in `market.ts`. One key family serves both, because
 * the lookup normalises before it reads: two families would mean a screen that
 * translates a player's personality and not a coach's.
 */

/** `SOUTH_AMERICA`, `South America` and `south-america` all reach the same row. */
function tokenSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function lookup(
  table: Readonly<Record<string, string>>,
  value: string,
): string | undefined {
  return table[tokenSlug(value)];
}

/**
 * The prettifier, kept as the fallback rather than as the rule.
 *
 * An id with no row is a content or data bug, not a translation gap, so it
 * renders as readable English instead of as a raw `SOUTH_AMERICA` or a bare
 * catalog key. Every SHIPPED id has a row; the tests below the tables say so.
 */
export function readableToken(value: string): string {
  return value
    .replace(/^formation[-_:]?/i, '')
    .replace(/^drill[-_:]?/i, '')
    .split(/[_-]/g)
    .filter(Boolean)
    .map(
      (word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join(' ');
}

/** `PlayerArchetype` from `src/game/types.ts`. The id is persisted; this is not. */
const ARCHETYPE_NAME_KEYS: Readonly<Record<string, string>> = {
  speedster: 'archetype.speedster.name',
  sniper: 'archetype.sniper.name',
  playmaker: 'archetype.playmaker.name',
  anchor: 'archetype.anchor.name',
  wall: 'archetype.wall.name',
  engine: 'archetype.engine.name',
  allrounder: 'archetype.allRounder.name',
  prodigy: 'archetype.prodigy.name',
};

/** Both personality unions at once — see the header. */
const PERSONALITY_NAME_KEYS: Readonly<Record<string, string>> = {
  fiery: 'personality.fiery.name',
  loyal: 'personality.loyal.name',
  greedy: 'personality.greedy.name',
  joker: 'personality.joker.name',
  professional: 'personality.professional.name',
  timid: 'personality.timid.name',
};

/** Both coach-specialty unions at once. */
const COACH_SPECIALTY_NAME_KEYS: Readonly<Record<string, string>> = {
  attack: 'coachSpecialty.attack.name',
  defense: 'coachSpecialty.defense.name',
  fitness: 'coachSpecialty.fitness.name',
  technique: 'coachSpecialty.technique.name',
  goalkeeping: 'coachSpecialty.goalkeeping.name',
  motivator: 'coachSpecialty.motivator.name',
};

/** `ScoutRegion` from `src/game/market.ts`. */
const SCOUT_REGION_NAME_KEYS: Readonly<Record<string, string>> = {
  local: 'scoutRegion.local.name',
  europe: 'scoutRegion.europe.name',
  southamerica: 'scoutRegion.southAmerica.name',
  africa: 'scoutRegion.africa.name',
  asia: 'scoutRegion.asia.name',
};

export const ARCHETYPE_NAME_KEY_IDS = Object.keys(ARCHETYPE_NAME_KEYS);
export const PERSONALITY_NAME_KEY_IDS = Object.keys(PERSONALITY_NAME_KEYS);
export const COACH_SPECIALTY_NAME_KEY_IDS = Object.keys(
  COACH_SPECIALTY_NAME_KEYS,
);
export const SCOUT_REGION_NAME_KEY_IDS = Object.keys(SCOUT_REGION_NAME_KEYS);

/** Every key this module can ask the catalog for, so a gate can check they exist. */
export const NAME_COPY_KEYS: readonly string[] = [
  ...Object.values(ARCHETYPE_NAME_KEYS),
  ...Object.values(PERSONALITY_NAME_KEYS),
  ...Object.values(COACH_SPECIALTY_NAME_KEYS),
  ...Object.values(SCOUT_REGION_NAME_KEYS),
];

function named(
  t: CopyFn,
  table: Readonly<Record<string, string>>,
  value: string,
): string {
  const key = lookup(table, value);
  if (key === undefined) return readableToken(value);
  const resolved = t(key);
  // `resolveCopy` answers with the key itself when the catalog has no row, which
  // is right for a component (a missing string names itself) and wrong here,
  // where a readable English word beats `archetype.speedster.name` on screen.
  return resolved === key ? readableToken(value) : resolved;
}

/** "Speedster" — the display name, never the id the tables are keyed by. */
export function archetypeName(t: CopyFn, archetype: string): string {
  return named(t, ARCHETYPE_NAME_KEYS, archetype);
}

/** Handles `'Fiery'` and `'FIERY'` alike. */
export function personalityName(t: CopyFn, personality: string): string {
  return named(t, PERSONALITY_NAME_KEYS, personality);
}

/** Handles `'Attack'` and `'ATTACK'` alike. */
export function coachSpecialtyName(t: CopyFn, specialty: string): string {
  return named(t, COACH_SPECIALTY_NAME_KEYS, specialty);
}

export function scoutRegionName(t: CopyFn, region: string): string {
  return named(t, SCOUT_REGION_NAME_KEYS, region);
}

/**
 * A power's name, which has been translated all along under
 * `powerEffect.<slug>.name` — the match overlay draws it from there. The market
 * screens were the two surfaces still running the id through a prettifier, so a
 * scout report confirmed a "Super Speed" inside an otherwise Vietnamese card.
 *
 * `powerCopySlug` throws for an id it does not know, which is correct where it
 * is called from content, and wrong on a screen: a save carrying a retired
 * power id would crash the market rather than render an odd word.
 */
export function powerDisplayName(t: CopyFn, powerId: string): string {
  let key: string;
  try {
    key = `powerEffect.${powerCopySlug(powerId)}.name`;
  } catch {
    return readableToken(powerId);
  }
  const resolved = t(key);
  return resolved === key ? readableToken(powerId) : resolved;
}

/**
 * A building's name from its raw id.
 *
 * `facilityName` already exists for a typed `FacilityType`; this is the variant
 * for the one caller that only has the string an event author typed
 * (`requiredFacility` in `events.json`).
 */
export function facilityNameFromId(t: CopyFn, facilityId: string): string {
  return facilityId in FACILITY_CATALOG
    ? facilityName(t, facilityId as FacilityType)
    : readableToken(facilityId);
}

/**
 * The drill card's bonus row, in the player's language.
 *
 * `src/game/training.ts` emits a kind and a token because it may not import
 * either `src/i18n` or this ring — the architecture test would reject it, and
 * the first draft of this step told an implementer to call `facilityName()`
 * from the pure ring. This is the boundary where both are reachable, so the
 * words are chosen here and the modal draws what it is handed.
 */
export function trainingModifierLabel(
  t: CopyFn,
  modifier: TrainingModifier,
): string {
  switch (modifier.kind) {
    case 'YOUTH':
      return t('trainingDrill.modifier.youth');
    case 'VETERAN':
      return t('trainingDrill.modifier.veteran');
    case 'COACH':
      return t('trainingDrill.modifier.coach');
    case 'ACTIVE_EFFECT':
      return t('trainingDrill.modifier.activeEffect');
    case 'ARCHETYPE':
      return modifier.token === undefined
        ? t('trainingDrill.modifier.archetype')
        : archetypeName(t, modifier.token);
    case 'FACILITY':
      return modifier.token === undefined
        ? modifier.label
        : t('trainingDrill.modifier.facilityLevel', {
            facility: facilityNameFromId(t, modifier.token),
            level: modifier.level ?? 1,
          });
    // The role code is deliberately untranslated — see the push site.
    case 'ROLE':
    default:
      return modifier.label;
  }
}
