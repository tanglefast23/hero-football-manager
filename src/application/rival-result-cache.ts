import type { TeamDef } from '../sim/types';
import type { FixtureResult, LeagueFixture } from '../game/types';

/**
 * Finished rival results waiting to be claimed when the week settles.
 *
 * Deliberately advisory. A miss costs exactly what the game cost before this
 * existed — a synchronous simulation — so no league table can be wrong because
 * the cache was cold, stale or empty. That property is what lets the preload
 * run opportunistically without a correctness argument attached to its timing.
 */
interface CachedResult {
  readonly fingerprint: string;
  readonly result: FixtureResult;
}

const cache = new Map<string, CachedResult>();

/**
 * Identifies the exact inputs a result was computed from.
 *
 * A match is a pure function of (seed, home TeamDef, away TeamDef), so
 * comparing the full serialized definitions is exact rather than a guess about
 * which state fields matter — training, a transfer, an injury and a formation
 * change all move it. Deliberately not hashed: a collision here would publish a
 * wrong scoreline, and ~10KB per fixture is nothing against the ~500ms it
 * protects. `clearRivalResultCache` at settle keeps that bounded; a 38-week
 * season would otherwise accumulate a few hundred KB of dead entries.
 */
function fingerprint(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): string | null {
  const home = teamsByClubId[fixture.homeClubId];
  const away = teamsByClubId[fixture.awayClubId];
  if (home === undefined || away === undefined) return null;
  return `${fixture.matchSeed}|${JSON.stringify(home)}|${JSON.stringify(away)}`;
}

export function storeRivalResult(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
  result: FixtureResult,
): void {
  const key = fingerprint(fixture, teamsByClubId);
  if (key === null) return;
  cache.set(fixture.id, { fingerprint: key, result });
}

/** True when this fixture is already resolved against these exact squads. */
export function hasRivalResult(
  fixture: LeagueFixture,
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): boolean {
  const entry = cache.get(fixture.id);
  if (entry === undefined) return false;
  return entry.fingerprint === fingerprint(fixture, teamsByClubId);
}

/**
 * The subset of `fixtures` whose results are cached and still match the squads
 * they were computed from. Safe to hand straight to `resolveMatchday`, which
 * simulates only the fixtures it was not given.
 */
export function cachedRivalResults(
  fixtures: readonly LeagueFixture[],
  teamsByClubId: Readonly<Record<string, TeamDef>>,
): FixtureResult[] {
  const claimed: FixtureResult[] = [];
  for (const fixture of fixtures) {
    const entry = cache.get(fixture.id);
    if (entry === undefined) continue;
    if (entry.fingerprint !== fingerprint(fixture, teamsByClubId)) continue;
    claimed.push(entry.result);
  }
  return claimed;
}

export function clearRivalResultCache(): void {
  cache.clear();
}
