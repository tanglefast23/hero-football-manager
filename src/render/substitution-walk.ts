/**
 * The cosmetic walk that plays after a substitution: the replaced player walks
 * off at the nearest touchline while his replacement walks on to take the
 * position, both at twice ordinary running speed so they miss little of the
 * play.
 *
 * The sim swap itself is instant and untouched (`src/sim/substitutions.ts`) —
 * the substitute is already playing from the tick he is named. Nothing here
 * reaches the simulation, so no `ENGINE_VERSION` decision is involved.
 *
 * Pure TS with worklet-safe sampling: Jest exercises the same functions the UI
 * thread calls. Every function reachable from a worklet declares `'worklet';`
 * itself, because `react-native-worklets/plugin` only converts a function that
 * says so. Deliberately imports nothing from `interpolate.ts`, which is large
 * and only half worklet-safe — `BODY_UNITS` and `clamp01` are local instead.
 */
import { BASE_MOVEMENT_SPEED } from '../sim/attributes';
import { PITCH_H, PITCH_W, type Vec } from '../sim/geometry';

/** Two bodies per substitution, and a team may make five. */
export const WALKER_SLOTS = 10;
export const WALKER_STRIDE = 8;

// Packed row layout. `state` carries the direction because the worklet never
// sees the React-side walk list, and the two directions are different maths.
export const WALK_PARKED = 0;
export const WALK_OFF = 1;
export const WALK_ON = 2;
export const WALK_STATE = 0;
export const WALK_SLOT = 1;
export const WALK_FROM_X = 2;
export const WALK_FROM_Y = 3;
export const WALK_TO_X = 4;
export const WALK_TO_Y = 5;
export const WALK_START_TICK = 6;
export const WALK_DURATION_TICKS = 7;

/**
 * One sprite body in pitch units: the 30px-tall source cell times the 17 pitch
 * units per source pixel that `PLAYER_DRAW_SCALE` buys. Written out because
 * the useful figure is the one on the pitch, not the one on the sheet — a
 * stagger of "120 units" reads as a quarter of a body and still overlaps.
 */
export const BODY_UNITS = 510;

/** The requested double speed. */
export const WALK_SPEED_MULTIPLIER = 2;
/** Sim ticks. Floor keeps a short walk visible; ceiling caps a cross-pitch one. */
export const MIN_WALK_TICKS = 3;
export const MAX_WALK_TICKS = 20;

/**
 * How far past the touchline a walk starts and ends. A whole body clears the
 * canvas, so a player leaves by walking out of frame and arrives from out of
 * frame — no dissolve, and no half a body parked on the line.
 */
export const EXIT_CLEARANCE = BODY_UNITS;

/** The name goes as the arriving player takes the position. */
const NAME_FADE = 0.2;

function clamp01(value: number): number {
  'worklet';
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function easeOut(progress: number): number {
  'worklet';
  return 1 - (1 - progress) * (1 - progress);
}

/**
 * A body's width beyond the nearer touchline. Real substitutes leave at the
 * nearest point rather than walking to halfway, and here it is also what keeps
 * the walk short — which is the whole reason for the double speed.
 */
export function touchlineExitX(x: number): number {
  return x < PITCH_W / 2 ? -EXIT_CLEARANCE : PITCH_W + EXIT_CLEARANCE;
}

/** Keeps a whole body on the canvas: a swap at y=50 must not walk off the top. */
export function clampWalkY(y: number): number {
  const margin = BODY_UNITS / 2;
  return Math.min(Math.max(y, margin), PITCH_H - margin);
}

export interface WalkEndpoints {
  /** Where the outgoing player walks out of frame. */
  readonly exit: Vec;
  /** Where his replacement walks in, one body clear of the exit. */
  readonly entry: Vec;
}

/**
 * `pairIndex` is the swap's place in one committed batch — the board commits
 * every staged swap on the same tick, so a triple substitution must not stack
 * three pairs on one spot.
 */
export function walkEndpoints(pos: Vec, pairIndex = 0): WalkEndpoints {
  const x = touchlineExitX(pos.x);
  return {
    exit: { x, y: clampWalkY(pos.y) },
    entry: { x, y: clampWalkY(pos.y + BODY_UNITS * (pairIndex + 1)) },
  };
}

/**
 * How long the walk lasts, in SIM ticks — never wall-clock milliseconds. The
 * pitch's own clock pauses when the match pauses and runs faster at 2x/3x
 * playback, so a walk measured in ticks needs no separate handling for either.
 *
 * `pac` gives the unconditioned base speed (`40 + pac` units per tick). This is
 * cosmetic on purpose: live `speedFor` cannot be asked about the outgoing
 * player, who no longer occupies a slot.
 */
export function walkDurationTicks(distance: number, pac: number): number {
  const speed =
    WALK_SPEED_MULTIPLIER * (BASE_MOVEMENT_SPEED + Math.max(0, pac));
  const ticks = distance / speed;
  return Math.min(Math.max(ticks, MIN_WALK_TICKS), MAX_WALK_TICKS);
}

export function distanceBetween(from: Vec, to: Vec): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface SubstitutionWalk {
  readonly id: string;
  /** Render slot 0-21, shared by the pair. */
  readonly slot: number;
  readonly direction: 'off' | 'on';
  /** Atlas identity, already carrying the right kit. */
  readonly visualId: string;
  readonly name: string;
  readonly from: Vec;
  readonly to: Vec;
  readonly startTick: number;
  readonly durationTicks: number;
}

export function walkEndTick(walk: SubstitutionWalk): number {
  return walk.startTick + walk.durationTicks;
}

/** Still walking at this tick? Used for both the draw list and the hide list. */
export function walkIsActive(walk: SubstitutionWalk, tick: number): boolean {
  return tick < walkEndTick(walk);
}

/**
 * The slots whose live sprite must be hidden: **incoming walks only**.
 *
 * Hiding on "any walk owning this slot" looks equivalent and is not. The pair
 * share a slot but not a clock — a faster substitute finishes before the
 * outgoing ghost, and the carrier guard ends the incoming walk on its own —
 * so a hide tied to the ghost would leave the man who is actually playing
 * invisible under the ball.
 */
export function hiddenSlots(
  walks: readonly SubstitutionWalk[],
  tick: number,
): number[] {
  const slots: number[] = [];
  for (const walk of walks) {
    if (walk.direction !== 'on' || !walkIsActive(walk, tick)) continue;
    if (!slots.includes(walk.slot)) slots.push(walk.slot);
  }
  return slots;
}

/** Packs the walk list for the UI thread. Called on start and end, never per frame. */
export function packWalks(walks: readonly SubstitutionWalk[]): Float32Array {
  const packed = new Float32Array(WALKER_SLOTS * WALKER_STRIDE);
  walks.slice(0, WALKER_SLOTS).forEach((walk, index) => {
    const offset = index * WALKER_STRIDE;
    packed[offset + WALK_STATE] = walk.direction === 'on' ? WALK_ON : WALK_OFF;
    packed[offset + WALK_SLOT] = walk.slot;
    packed[offset + WALK_FROM_X] = walk.from.x;
    packed[offset + WALK_FROM_Y] = walk.from.y;
    packed[offset + WALK_TO_X] = walk.to.x;
    packed[offset + WALK_TO_Y] = walk.to.y;
    packed[offset + WALK_START_TICK] = walk.startTick;
    packed[offset + WALK_DURATION_TICKS] = walk.durationTicks;
  });
  return packed;
}

export interface WalkSample {
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
  readonly nameOpacity: number;
  readonly progress: number;
}

const PARKED: WalkSample = {
  active: false,
  x: 0,
  y: 0,
  nameOpacity: 0,
  progress: 1,
};

/**
 * Where one walker is drawn at `visualTick`, and how solid he and his name are.
 *
 * `liveX`/`liveY` are the slot's own drawn position, straight out of the Atlas
 * mapper's `visualPositions`. An incoming walk homes on that rather than on a
 * point captured at the swap, because the substitute has been playing all
 * along: a fixed target would hand over to a sprite that had since moved, and
 * the handover would visibly jump.
 */
export function sampleWalk(
  packed: Float32Array,
  index: number,
  visualTick: number,
  liveX: number,
  liveY: number,
): WalkSample {
  'worklet';
  const offset = index * WALKER_STRIDE;
  const state = packed[offset + WALK_STATE];
  if (state === WALK_PARKED) return PARKED;
  const duration = packed[offset + WALK_DURATION_TICKS];
  if (duration <= 0) return PARKED;
  const progress = clamp01(
    (visualTick - packed[offset + WALK_START_TICK]) / duration,
  );
  if (progress >= 1) return PARKED;

  const fromX = packed[offset + WALK_FROM_X];
  const fromY = packed[offset + WALK_FROM_Y];
  if (state === WALK_ON) {
    const eased = easeOut(progress);
    return {
      active: true,
      x: fromX + (liveX - fromX) * eased,
      y: fromY + (liveY - fromY) * eased,
      nameOpacity: clamp01((1 - progress) / NAME_FADE),
      progress,
    };
  }

  // Walking off keeps his name to the last frame: he is out of the canvas by
  // then, so there is nothing left to fade.
  return {
    active: true,
    x: fromX + (packed[offset + WALK_TO_X] - fromX) * progress,
    y: fromY + (packed[offset + WALK_TO_Y] - fromY) * progress,
    nameOpacity: 1,
    progress,
  };
}

/**
 * Which of the two run frames a walker is on. Derived from the sim tick, so the
 * legs stop with the pitch on a pause. Same 130ms cadence as `PlayerRunSprite`.
 */
export const WALK_STEP_MS = 130;

export function walkRunFrame(tick: number, tickMs: number): 0 | 1 {
  return Math.floor((tick * tickMs) / WALK_STEP_MS) % 2 === 0 ? 0 : 1;
}

/**
 * One atlas key per buffer row, or nothing at all when nobody is walking.
 *
 * The buffer is a fixed ten rows and the parked ones still need a sprite to
 * point at, so they borrow the first walker's. Returning `[]` for an empty list
 * is the load-bearing part: a padded empty list asks the atlas for `":run0"`,
 * which is not a key, and `atlasLayout` throws into the match screen's error
 * boundary on the very first render. It did exactly that once.
 */
export function walkerSpriteKeys(
  walks: readonly SubstitutionWalk[],
  runFrame: 0 | 1,
): string[] {
  if (walks.length === 0) return [];
  const frame = runFrame === 0 ? 'run0' : 'run1';
  const keys = walks
    .slice(0, WALKER_SLOTS)
    .map((walk) => `${walk.visualId}:${frame}`);
  while (keys.length < WALKER_SLOTS) keys.push(keys[0]);
  return keys;
}
