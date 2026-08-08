// Pure, worklet-safe render constants for the LOST-duel scuff: the contact mark
// kicked up when a challenge is beaten (a TACKLE event with `won: false` and
// `contact: true`). Same rule as ball-flight-visuals.ts — no RN/Skia imports, so
// Jest exercises this headless while the overlay worklet calls it directly.
//
// A five-seed census of full matches (src/sim, seeds 1-5) measured 130.4 TACKLE
// events per match, of which 99.8 are beaten challenges that still make contact
// — the ones that were playing `tackle-thud` with nothing drawn at all. Almost
// all of them are standing duels (99.0 vs 0.8 slides) and no two ever landed on
// the same tick. Roughly one per five seconds of match time is the budget this
// whole effect has to live inside, which is why it is three ticks long and made
// of six flecks: anything longer or louder becomes visual noise.

/** Beat length in sim ticks — 300ms at TICK_MS = 100. */
export const DUEL_SCUFF_TICKS = 3;

/** Kicked-up dust cream, the same family as the shot-origin puff. */
export const DUEL_SCUFF_COLOR = '#f4f1ea';
export const DUEL_SCUFF_OPACITY = 0.8;

/**
 * Outward drift per tick, as a multiple of each fleck's starting offset. The
 * spray only ever expands and shrinks: the whole batch shares ONE hard-edged
 * Path, so there is no per-fleck opacity to fade (same constraint the slide
 * debris works under).
 */
export const DUEL_SCUFF_SPREAD_PER_TICK = 0.55;

/**
 * Chunky flecks at the contact point, measured in sprite source pixels so they
 * inherit the sprites' own snapped magnification. `along` runs down the loser's
 * recoil direction (negative = back toward the winner) and `side` across it, so
 * the spray leans the way the duel was lost rather than reading as a symmetric
 * ring that could have come from either player.
 */
export const DUEL_SCUFF_PIXELS = [
  { along: -4, side: -1, size: 3 },
  { along: -2, side: 3, size: 2 },
  { along: -1, side: -4, size: 2 },
  { along: 1, side: 2, size: 3 },
  { along: 3, side: -2, size: 2 },
  { along: 4, side: 4, size: 2 },
] as const;

/** How far a fleck has drifted from the contact point, as a multiplier. */
export function duelScuffSpread(age: number): number {
  'worklet';
  return 1 + Math.max(0, age) * DUEL_SCUFF_SPREAD_PER_TICK;
}

/**
 * Fleck side length at `age` ticks, in WHOLE source pixels. Shrinking is the
 * only fade this effect has, and quantising it is what keeps the flecks
 * hard-edged: an integer count of source pixels times the already-snapped sprite
 * magnification is still a whole number of device pixels, whereas a smoothly
 * shrinking float would blur every fleck for most of its life.
 */
export function duelScuffFleckSize(size: number, age: number): number {
  'worklet';
  const t = Math.max(0, Math.min(1, age / DUEL_SCUFF_TICKS));
  return Math.max(1, Math.round(size * (1 - t)));
}

/**
 * A fleck's offset from the contact point, in WHOLE source pixels, for the same
 * grid reason as the size above. `base` is its authored `along`/`side`.
 */
export function duelScuffFleckOffset(base: number, age: number): number {
  'worklet';
  return Math.round(base * duelScuffSpread(age));
}
