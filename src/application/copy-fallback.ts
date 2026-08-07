import type { CopyFn, CopyParams } from '../i18n';
import { FACILITY_ADJACENCIES, FACILITY_CATALOG, type FacilityType } from '../game/facilities';

/**
 * Resolves the catalog key a pure ring emitted, keeping its English if the key
 * is missing.
 *
 * `src/game` and `src/sim` may not import `src/i18n`, so they write the key and
 * its raw params beside the English sentence and the screen resolves the pair
 * here — the dual write `LedgerLine.label` established. `resolveCopy` returns
 * the KEY itself for an entry the catalog does not hold, which is right for a
 * component (a missing string names itself on screen) and wrong for a dual
 * write, where the ring has already produced a real sentence to fall back to.
 */
export function copyOrEnglish(
  t: CopyFn,
  key: string | undefined,
  english: string,
  params?: CopyParams,
): string {
  if (key === undefined) return english;
  const resolved = t(key, params === undefined ? undefined : translatedParams(t, params));
  // A leftover `{placeholder}` means this value was saved with a key but
  // without the params that key needs — a recap or a ledger line written before
  // the producer started emitting them. `interpolate` leaves the hole visible on
  // purpose, which is right for a component and wrong here, where the English
  // beside it is already a finished sentence.
  if (resolved === key || /\{[a-zA-Z0-9_]+\}/.test(resolved)) return english;
  return resolved;
}

/**
 * One sentence a pure ring emitted in both halves.
 *
 * `RetirementCopy` and `RenewalBlockedCopy` in `src/game` are structurally this
 * shape. The interface stays here rather than in the ring so that neither ring
 * module has to import the other's.
 */
export interface RingCopy {
  readonly text: string;
  readonly textKey: string;
  readonly textParams?: CopyParams;
}

/** `copyOrEnglish` for a ring that hands over both halves at once. */
export function resolveRingCopy(t: CopyFn, copy: RingCopy): string {
  return copyOrEnglish(t, copy.textKey, copy.text, copy.textParams);
}

/**
 * Substitutes any param whose VALUE is itself a catalog key.
 *
 * A pure ring cannot translate a name it interpolates into a sentence, so it
 * emits both halves — `{ facility: 'Gym', facilityKey: 'facility.name.gym' }` —
 * and the translated name replaces the English one before interpolation. The
 * pairing is by name: `<param>Key` names `<param>`. Without it a translated
 * sentence still carries an English building name, which is the defect that put
 * `DIVISION_NAME_KEYS` beside `DIVISION_NAMES`.
 */
function translatedParams(t: CopyFn, params: CopyParams): CopyParams {
  const substituted: Record<string, string | number> = { ...params };
  let changed = false;
  for (const [name, value] of Object.entries(params)) {
    const target = name.endsWith('Key') ? name.slice(0, -'Key'.length) : undefined;
    if (target === undefined || typeof value !== 'string' || params[target] === undefined) continue;
    const resolved = t(value);
    if (resolved === value) continue;
    substituted[target] = resolved;
    changed = true;
  }
  return changed ? substituted : params;
}

/**
 * A facility's name in the player's language.
 *
 * `FACILITY_CATALOG` dual-writes `nameKey` beside `name`, and `facility.name.*`
 * is translated in all six locales — but every consumer read the English half,
 * so the build screen, the active project, the briefing and every store notice
 * said "Gym" and "Medical Bay" inside otherwise translated sentences.
 *
 * A helper rather than eleven inline calls, because that is eleven chances to
 * miss one, which is exactly how this shipped.
 */
export function facilityName(t: CopyFn, type: FacilityType): string {
  const definition = FACILITY_CATALOG[type];
  return copyOrEnglish(t, definition.nameKey, definition.name);
}

/**
 * An adjacency bonus described in the player's language.
 *
 * Same defect: `descriptionKey` was added to `FACILITY_ADJACENCIES` for exactly
 * this and never read, so a discovery notice announced its bonus in English.
 * Falls through to the raw id for an adjacency the table does not know, which is
 * what the previous implementation did.
 */
export function adjacencyDescription(t: CopyFn, id: string): string {
  const adjacency = FACILITY_ADJACENCIES.find(candidate => candidate.id === id);
  if (adjacency === undefined) return id;
  return copyOrEnglish(t, adjacency.descriptionKey, adjacency.description);
}
