import { zoneHeatThreshold } from '../sim/powers';
import type { PlayerDef, PowerState } from '../sim/types';

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
 * (at TWO_COLUMN_MIN_WIDTH), which have a status bar the match screen draws
 * under — the phone scorebar reserves 56 for the same reason.
 */
export const MATCH_RAIL_TOP_INSET = 24;

/** How many tired starters the rail's substitution card lists. */
export const RAIL_TIRED_ROWS = 2;

/** Hero License field cap — the rail never shows more power tiles than this. */
export const RAIL_HERO_TILE_CAP = 4;

// Rail playstyle chip copy used to be a literal table here ("PRESS", "PARK
// BUS"). It is player-facing text, so it moved to the catalog — `mentalityLabel`
// in `match-mentality-ui.ts` — and the rail now shares the phone's words, so a
// chip and the banner it fires no longer name the same tactic differently. The
// engine keeps its own mentality identifiers.

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
 * Banked Heat as a 0–1 bar fraction, measured against THIS ROLE's threshold.
 *
 * The role argument is not decoration. A keeper arms at 5 Heat and an outfield
 * hero at 60, so dividing every bar by 60 drew a keeper's full charge as an
 * eighth of a bar. That was tolerable while keepers fired automatically and
 * nobody was asked to act on the number. Since m2.8 a keeper has a button, and
 * a full bar has to mean the same thing for them as for everyone else — it is
 * the entire promise of the ARMED state.
 */
export function heatFraction(gauge: number, role: PlayerDef['role']): number {
  return Math.max(0, Math.min(1, gauge / zoneHeatThreshold(role)));
}

export type RailHeroStatus = 'loading' | 'armed' | 'firing';

/**
 * Zone is the banked window; winding/armed/active are the power playing out.
 * There is deliberately no seconds-remaining companion: m1.27 removed the Zone
 * countdown, so a zoned hero holds until the authored context arrives and any
 * timer the rail could derive would be a frozen fake.
 */
export function railHeroStatus(state: PowerState): RailHeroStatus {
  if (state.kind === 'zone') return 'armed';
  if (state.kind === 'idle') return 'loading';
  return 'firing';
}
