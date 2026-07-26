import { TICK_MS } from '../sim/geometry';
import { ZONE_HEAT_THRESHOLD } from '../sim/powers';
import type { Mentality } from '../sim/tactics';
import type { PowerState } from '../sim/types';

/**
 * Desktop match layout (design sign-off 2026-07-23): a fixed control rail on
 * the left, the live pitch filling the right pane. Presentation only — every
 * rail control issues an already-recorded coaching input.
 */
export const MATCH_RAIL_WIDTH = 440;

/** Outer padding around the desktop body, and the rail→pitch gutter. */
export const MATCH_RAIL_GUTTER = 16;

/**
 * Extra space above the rail. The desktop layout also covers landscape tablets
 * (TWO_COLUMN_MIN_WIDTH is 960), which have a status bar the match screen draws
 * under — the phone scorebar reserves 56 for the same reason.
 */
export const MATCH_RAIL_TOP_INSET = 24;

/** How many tired starters the rail's substitution card lists. */
export const RAIL_TIRED_ROWS = 3;

/** Hero License field cap — the rail never shows more power tiles than this. */
export const RAIL_HERO_TILE_CAP = 4;

/** Rail playstyle chip copy. The engine keeps its own mentality identifiers. */
export const MENTALITY_CHIP_LABELS: Readonly<Record<Mentality, string>> = {
  BALANCED: 'BALANCED',
  ATTACK: 'PRESS',
  PROTECT: 'PARK BUS',
};

/**
 * Most tired first, `condition` ascending. Sort is stable, so equally tired
 * players keep their shirt order instead of shuffling between frames.
 */
export function mostTiredFirst<T extends { condition: number }>(
  players: readonly T[],
  limit = RAIL_TIRED_ROWS,
): T[] {
  return [...players].sort((a, b) => a.condition - b.condition).slice(0, limit);
}

/**
 * Banked Heat as a 0–1 bar fraction. Measured against the outfield Zone
 * threshold; a keeper hero's own (much lower) threshold is engine-private, so
 * a GK tile reads conservatively rather than wrongly full.
 */
export function heatFraction(gauge: number): number {
  return Math.max(0, Math.min(1, gauge / ZONE_HEAT_THRESHOLD));
}

export type RailHeroStatus = 'building' | 'zone' | 'firing';

/** Zone is the tappable window; winding/armed/active are the power playing out. */
export function railHeroStatus(state: PowerState): RailHeroStatus {
  if (state.kind === 'zone') return 'zone';
  if (state.kind === 'idle') return 'building';
  return 'firing';
}

/**
 * STALE INSTRUMENT — m1.27 removed the Zone countdown, so `remainingTicks`
 * stays at its initial value and this always answers 7 while zoned. The rail
 * no longer displays it (the tile says ZONE); kept only because the armed
 * test-instrumentation state still carries meaningful ticks. Candidate for
 * removal with the rest of the countdown plumbing.
 */
export function zoneSecondsRemaining(state: PowerState): number | null {
  if (state.kind !== 'zone') return null;
  return Math.max(0, Math.ceil((state.remainingTicks * TICK_MS) / 1000));
}
