/**
 * Geometry, lane allocation and timing for the live-match event ticker.
 *
 * The HUD's event lines used to be lozenges: a dark plate, an outlined border,
 * and a vertical stack that held still. They are now unplated type that runs
 * across the top of the pitch, entering at the left touchline and leaving at
 * the right. Everything here is pure so the awkward parts — which lane a new
 * line takes, and how long a crossing has left after a pause or a speed
 * change — can be asserted headlessly.
 *
 * Presentation only. No sim state, no RNG, no replay surface.
 */
import { TICK_MS } from '../sim/geometry';
import { MIN_MATCH_PLAYBACK_RATE, type MatchSpeed } from './match-speed';

/** Rows the ticker can run at once — matches the newest-four banner cap. */
export const TICKER_LANES = 4;
/** Lane pitch: 18pt type + the 2pt outline + the 3pt extrusion + breathing room. */
export const TICKER_LANE_HEIGHT = 30;
/** Gap between the top touchline and the first lane. */
export const TICKER_TOP_INSET = 8;
/** Outline thickness. Two pixels survives being read over the mow bands. */
export const OUTLINE_PX = 2;
/**
 * The extrusion under the glyphs, in points.
 *
 * Two hard ink copies stepped down from the fill build the slab that makes the
 * type read as raised; the soft copy one step below them is its shadow. One
 * soft copy alone read as a drop shadow on flat text — measured side by side
 * against a 2-step and a 4-step slab, 2 was the step that looked lifted
 * without turning the 12pt footnote into a blob.
 */
export const EXTRUDE_STEPS = 2;
/** Where the soft shadow copy sits, below the deepest slab step. */
export const SHADOW_DROP_PX = EXTRUDE_STEPS + 1;

/** Slab steps, deepest first, so each one paints under the one above it. */
export const EXTRUDE_OFFSETS: readonly number[] = Array.from(
  { length: EXTRUDE_STEPS },
  (_unused, index) => EXTRUDE_STEPS - index,
);

export interface TickerOffset {
  readonly x: number;
  readonly y: number;
}

/**
 * The eight compass offsets that fake a text stroke. React Native has no
 * `-webkit-text-stroke`, and a `Text` style carries at most ONE shadow, so an
 * even ring around the glyphs has to be drawn as copies.
 */
export const OUTLINE_OFFSETS: readonly TickerOffset[] = [
  { x: -OUTLINE_PX, y: -OUTLINE_PX },
  { x: 0, y: -OUTLINE_PX },
  { x: OUTLINE_PX, y: -OUTLINE_PX },
  { x: -OUTLINE_PX, y: 0 },
  { x: OUTLINE_PX, y: 0 },
  { x: -OUTLINE_PX, y: OUTLINE_PX },
  { x: 0, y: OUTLINE_PX },
  { x: OUTLINE_PX, y: OUTLINE_PX },
];

/**
 * The four-copy ring used when the device has asked for fewer effects. The
 * outline is not juice — with the plate gone it is the only thing holding the
 * text off two greens — so a struggling phone renders a thinner ring rather
 * than none.
 */
export const OUTLINE_OFFSETS_CHEAP: readonly TickerOffset[] =
  OUTLINE_OFFSETS.filter((offset) => offset.x === 0 || offset.y === 0);

export interface TickerOccupant {
  readonly lane: number;
  readonly subject?: string;
}

/**
 * Lowest free lane, or `fallbackLane` when all four are taken.
 *
 * A round-robin counter looks equivalent and is not: lines do not all live the
 * same number of ticks (a rival Zone warning holds 20, everything else 30) and
 * a coaching line can be replaced early, so the next free lane is regularly
 * not the next lane in sequence.
 */
export function allocateTickerLane(
  occupied: readonly number[],
  fallbackLane: number,
): number {
  for (let lane = 0; lane < TICKER_LANES; lane += 1) {
    if (!occupied.includes(lane)) return lane;
  }
  return fallbackLane;
}

/**
 * The lane a new line should take, given the lines already running.
 *
 * A line that replaces a live one on the same subject keeps that lane, so a
 * second formation tap retimes the row already on screen instead of starting a
 * duplicate somewhere else. `live` is the list BEFORE the append: its first
 * entry is the oldest, and that is the one the newest-four cap drops to make
 * room, so its lane is the right fallback when every lane is busy.
 */
export function tickerLane(
  live: readonly TickerOccupant[],
  subject: string | undefined,
): number {
  const replaced =
    subject === undefined
      ? undefined
      : live.find((occupant) => occupant.subject === subject);
  if (replaced !== undefined) return replaced.lane;
  return allocateTickerLane(
    live.map((occupant) => occupant.lane),
    live[0]?.lane ?? 0,
  );
}

/**
 * Wall-clock length of one crossing, from a tick lifetime.
 *
 * Ticks are the lifetime's unit of truth — the HUD still drops a line on
 * `s.tick > untilTick` — but they are consumed faster at ×2 and ×3, so the
 * crossing has to be told the playback rate or it would outlive its own row.
 * The rate is clamped because the time-warp scale reaches zero during hit-stop
 * and an unclamped divide would hand Reanimated an `Infinity` duration.
 */
export function tickerDurationMs(lifeTicks: number, speed: MatchSpeed): number {
  const rate = Math.max(MIN_MATCH_PLAYBACK_RATE, speed);
  return Math.max(TICK_MS, (lifeTicks * TICK_MS) / rate);
}

/**
 * What is left of a crossing that is already part-way across.
 *
 * Used on resume after a pause and after a mid-flight speed change: both
 * retime the remaining distance rather than restarting, so the line never
 * jumps backwards.
 */
export function tickerRemainingDurationMs(
  progress: number,
  lifeTicks: number,
  speed: MatchSpeed,
): number {
  const left = Math.min(1, Math.max(0, 1 - progress));
  return Math.max(1, tickerDurationMs(lifeTicks, speed) * left);
}

/**
 * Horizontal offset of a row at `progress` 0..1.
 *
 * Every row travels the same distance at the same speed, whatever it says.
 * That is what keeps a goal and the smaller power line underneath it locked
 * together: shared distance and shared duration means a shared x. Measuring
 * each row instead would have made the long line the slow one and pulled the
 * pair apart.
 */
export function tickerTranslateX(progress: number, pitchWidth: number): number {
  'worklet';
  return (progress * 2 - 1) * pitchWidth;
}

/** Top edge of a lane inside the ticker band. */
export function tickerLaneTop(lane: number): number {
  return lane * TICKER_LANE_HEIGHT;
}
