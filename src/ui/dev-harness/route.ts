/**
 * The dev harness's address: parsing, formatting and resolution.
 *
 * Everything here is pure string and array work, and deliberately imports
 * nothing — no React, no react-native, no registry. Jest runs with
 * `testEnvironment: 'node'` and `require('react-native')` throws there, so a
 * module that reached the registry could not be tested at all. The registry
 * hands its entries in instead, matched structurally.
 *
 * The address exists for one reason: a screenshot of one exact state should
 * cost a URL, not a run of taps. `#/dev/awards-ceremony/sweep` on a cold load
 * has to land on that ceremony with that case already chosen.
 */

/** The `#/dev/...` prefix every harness address carries. */
const HASH_PREFIX = 'dev';

/**
 * What an address names. Both parts are optional because a hash is written by
 * hand as often as by the harness: `#/dev` is the menu, and an entry with no
 * case named takes its first one.
 */
export interface DevHarnessRoute {
  readonly entryId?: string;
  readonly caseId?: string;
}

/**
 * The part of an entry an address can address.
 *
 * Structural on purpose: `DevHarnessEntry` in the registry carries a `render`
 * that returns React nodes, and this module must stay importable without them.
 */
export interface DevHarnessRoutableEntry {
  readonly id: string;
  readonly group: string;
  readonly title: string;
  readonly cases: readonly { readonly id: string }[];
}

/** Where the harness actually is, after an address has been checked. */
export type DevHarnessResolution =
  | { readonly kind: 'menu' }
  | {
      readonly kind: 'entry';
      readonly entryId: string;
      readonly caseId: string;
    };

/**
 * Reads an address out of a location hash.
 *
 * Tolerant by design — a hash is a text field a human types into. A leading
 * `#`, a leading or trailing `/`, empty segments and percent-encoding are all
 * accepted. Anything that is not a harness address at all (`#foo`, `''`)
 * parses to the menu rather than to nothing, so a page that already uses the
 * hash for something else cannot strand the harness.
 */
export function parseDevHarnessHash(hash: string): DevHarnessRoute {
  const segments = hash
    .replace(/^#/, '')
    .split('/')
    .map(safeDecode)
    .filter((segment) => segment.length > 0);

  if (segments[0] !== HASH_PREFIX) return {};

  const [, entryId, caseId] = segments;
  if (entryId === undefined) return {};
  return caseId === undefined ? { entryId } : { entryId, caseId };
}

/**
 * Writes an address as a location hash, including the `#`.
 *
 * A case without an entry is not an address — it is dropped rather than
 * encoded, so formatting a route always produces something that parses back.
 */
export function formatDevHarnessHash(route: DevHarnessRoute): string {
  const { entryId, caseId } = route;
  if (entryId === undefined) return `#/${HASH_PREFIX}`;
  if (caseId === undefined)
    return `#/${HASH_PREFIX}/${encodeURIComponent(entryId)}`;
  return `#/${HASH_PREFIX}/${encodeURIComponent(entryId)}/${encodeURIComponent(caseId)}`;
}

/**
 * Which entry and case an address lands on, or the menu.
 *
 * A stale bookmark must never strand a reviewer, so every id the registry does
 * not hold falls back to the menu rather than to an error: an entry that has
 * been renamed, a case that has been dropped, or an entry left with no cases
 * at all. An address that names an entry but no case takes the entry's first
 * case, which is what makes `#/dev/awards-ceremony` a usable thing to type.
 */
export function resolveDevHarnessRoute(
  entries: readonly DevHarnessRoutableEntry[],
  route: DevHarnessRoute,
): DevHarnessResolution {
  if (route.entryId === undefined) return { kind: 'menu' };

  const entry = entries.find((candidate) => candidate.id === route.entryId);
  if (entry === undefined) return { kind: 'menu' };

  const first = entry.cases[0];
  if (first === undefined) return { kind: 'menu' };

  if (route.caseId === undefined) {
    return { kind: 'entry', entryId: entry.id, caseId: first.id };
  }
  return entry.cases.some((candidate) => candidate.id === route.caseId)
    ? { kind: 'entry', entryId: entry.id, caseId: route.caseId }
    : { kind: 'menu' };
}

/** The address a resolution is at, so the hash can be normalised onto it. */
export function resolvedDevHarnessRoute(
  resolution: DevHarnessResolution,
): DevHarnessRoute {
  return resolution.kind === 'menu'
    ? {}
    : { entryId: resolution.entryId, caseId: resolution.caseId };
}

export interface DevHarnessGroup<Entry> {
  readonly name: string;
  readonly entries: readonly Entry[];
}

/**
 * The menu's sections.
 *
 * Groups appear in the order their first entry was registered, and entries
 * keep registration order inside a group — so the menu is reordered by moving
 * a line in the registry, and adding an entry never silently reshuffles the
 * ones already there.
 */
export function devHarnessGroups<Entry extends { readonly group: string }>(
  entries: readonly Entry[],
): readonly DevHarnessGroup<Entry>[] {
  const byName = new Map<string, Entry[]>();
  for (const entry of entries) {
    const existing = byName.get(entry.group);
    if (existing === undefined) byName.set(entry.group, [entry]);
    else existing.push(entry);
  }
  return [...byName].map(([name, grouped]) => ({ name, entries: grouped }));
}

/** A malformed percent-escape is a typo, not a crash: keep the raw segment. */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
