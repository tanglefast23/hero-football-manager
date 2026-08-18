/**
 * The pass-chain counter that pops over the head of whoever just received the
 * ball: "x2", then "x3", each one drawn a little bigger than the last.
 *
 * Pure TS on purpose (no react-native or Skia imports), same reason as
 * `interpolate.ts` and `shot-power-pop.ts`: Jest can exercise it headless while
 * MatchScreen cannot be imported under the test runner. The animation functions
 * run inside a worklet, so each carries the directive.
 *
 * Render ring only. It counts events the sim already emits and writes nothing
 * back, so no replay and no ENGINE_VERSION is involved.
 */
import {
  COUNTDOWN_DIGIT_HEIGHT,
  COUNTDOWN_DIGIT_WIDTH,
  countdownGlyph,
  type CountdownGlyph,
} from './incapacity-countdown';

/**
 * The first chain length that shows anything. Completed passes are constant, so
 * marking every single one would be wallpaper rather than a reward — the count
 * only becomes interesting once it is a run.
 */
export const PASS_COMBO_FLOOR = 2;

/** Total life of one pop, in wall-clock ms. Shorter than the shot number: this
 * one fires often, so it must clear the screen before the next pass lands. */
export const PASS_COMBO_POP_MS = 620;

const OVERSHOOT_END_MS = 100;
const SETTLE_END_MS = 220;
const FADE_START_MS = 380;

const START_SCALE = 0.5;
const PEAK_SCALE = 1.35;
const REST_SCALE = 1;

/** Source pixels the counter drifts upward across the fade. */
const RISE_PX = 5;

/**
 * Cell size in source pixels for a given chain length. The counter grows with
 * the run, which is the whole point of it, but it stops growing at x8 — beyond
 * that it would cover the players it is standing over.
 */
const BASE_CELL_PX = 2;
const CELL_PX_PER_STEP = 0.4;
const MAX_CELL_PX = 4.4;

export function passComboCellPx(count: number): number {
  'worklet';
  if (!Number.isFinite(count)) return BASE_CELL_PX;
  const steps = Math.max(0, count - PASS_COMBO_FLOOR);
  return Math.min(MAX_CELL_PX, BASE_CELL_PX + steps * CELL_PX_PER_STEP);
}

/**
 * The multiplication cross, 3x5 to match the digits beside it, sitting on the
 * middle three rows so it reads as "x" rather than as a tall X.
 */
const CROSS_ROWS = '000101010101000';

const CROSS_GAP = 1;

/**
 * "x" followed by the count, as one set of pixel cells. Composed from
 * `countdownGlyph` rather than reimplementing the digits, so both overlays draw
 * from the same 3x5 face.
 */
export function passComboGlyph(count: number): CountdownGlyph {
  const digits = countdownGlyph(count);
  if (digits.pixels.length === 0) return { pixels: [], width: 0, height: 0 };
  const pixels: { x: number; y: number }[] = [];
  for (let cell = 0; cell < CROSS_ROWS.length; cell += 1) {
    if (CROSS_ROWS[cell] !== '1') continue;
    pixels.push({
      x: cell % COUNTDOWN_DIGIT_WIDTH,
      y: Math.floor(cell / COUNTDOWN_DIGIT_WIDTH),
    });
  }
  const offset = COUNTDOWN_DIGIT_WIDTH + CROSS_GAP;
  for (const cell of digits.pixels)
    pixels.push({ x: cell.x + offset, y: cell.y });
  return {
    pixels,
    width: offset + digits.width,
    height: COUNTDOWN_DIGIT_HEIGHT,
  };
}

/**
 * The live chain. `team` is who is stringing it together, so a completed pass
 * by the other side starts a new run rather than extending the old one.
 */
export interface PassComboChain {
  readonly team: 0 | 1 | null;
  readonly count: number;
}

export const PASS_COMBO_IDLE: PassComboChain = Object.freeze({
  team: null,
  count: 0,
});

/**
 * What the renderer feeds the chain. Deliberately narrower than `MatchEvent`:
 * the mapping from events to these two cases is the part worth reading in
 * MatchScreen, and the counting is the part worth testing here.
 */
export type PassComboInput =
  { kind: 'completed-pass'; team: 0 | 1 } | { kind: 'break' };

export function passComboAfter(
  chain: PassComboChain,
  input: PassComboInput,
): PassComboChain {
  if (input.kind === 'break') return PASS_COMBO_IDLE;
  if (chain.team !== input.team) return { team: input.team, count: 1 };
  return { team: chain.team, count: chain.count + 1 };
}

function lerp(from: number, to: number, progress: number): number {
  'worklet';
  return from + (to - from) * progress;
}

/** Scale at a given age: grow past full size, then shrink back onto it. */
export function passComboScale(elapsedMs: number): number {
  'worklet';
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return START_SCALE;
  if (elapsedMs >= SETTLE_END_MS) return REST_SCALE;
  if (elapsedMs < OVERSHOOT_END_MS)
    return lerp(START_SCALE, PEAK_SCALE, elapsedMs / OVERSHOOT_END_MS);
  return lerp(
    PEAK_SCALE,
    REST_SCALE,
    (elapsedMs - OVERSHOOT_END_MS) / (SETTLE_END_MS - OVERSHOOT_END_MS),
  );
}

/** Opacity at a given age: solid until the fade, gone at the end. */
export function passComboOpacity(elapsedMs: number): number {
  'worklet';
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  if (elapsedMs >= PASS_COMBO_POP_MS) return 0;
  if (elapsedMs < FADE_START_MS) return 1;
  return 1 - (elapsedMs - FADE_START_MS) / (PASS_COMBO_POP_MS - FADE_START_MS);
}

/** Source-pixel rise at a given age. Nothing moves until the fade starts. */
export function passComboRise(elapsedMs: number): number {
  'worklet';
  if (!Number.isFinite(elapsedMs) || elapsedMs <= FADE_START_MS) return 0;
  if (elapsedMs >= PASS_COMBO_POP_MS) return RISE_PX;
  return (
    ((elapsedMs - FADE_START_MS) / (PASS_COMBO_POP_MS - FADE_START_MS)) *
    RISE_PX
  );
}
