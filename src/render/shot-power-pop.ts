/**
 * The shot power number that pops over a shooter's head, and the little beat
 * sheet it plays: a fast overshoot, a settle, a hold, then a rise and fade.
 *
 * Pure TS on purpose (no react-native or Skia imports), same reason as
 * `interpolate.ts` and `incapacity-countdown.ts`: Jest can exercise it headless
 * while MatchScreen cannot be imported under the test runner. Every function
 * here is called from a worklet, so each carries the directive.
 *
 * Only shots ON TARGET get one. The sim grades that off `targetX` alone, which
 * is stamped at launch, so `shotOnTarget` in the engine answers it ticks before
 * the shot resolves. Nothing here reads or writes sim state.
 */

/** Total life of one pop, in wall-clock ms. */
export const SHOT_POWER_POP_MS = 750;

const OVERSHOOT_END_MS = 110;
const SETTLE_END_MS = 260;
const FADE_START_MS = 500;

const START_SCALE = 0.55;
const PEAK_SCALE = 1.3;
const REST_SCALE = 1;

/** Source pixels the number drifts upward across the fade. */
const RISE_PX = 6;

/**
 * Colour bands, set against the range `power` actually occupies in play — about
 * 5 to 141 — and not the 1..999 clamp the sim allows. Measured: SHO 50 shoots
 * around 51, SHO 150 around 83, SHO 300 around 103. So 90+ really is the band
 * only a strong finisher reaches.
 */
export type ShotPowerBand = 0 | 1 | 2;

const DANGEROUS_POWER = 60;
const ELITE_POWER = 90;

export const SHOT_POWER_BAND_COLORS = [
  '#f4f1ea',
  '#ffb347',
  '#ffd34d',
] as const;

export function shotPowerBand(power: number): ShotPowerBand {
  'worklet';
  if (!Number.isFinite(power)) return 0;
  if (power >= ELITE_POWER) return 2;
  if (power >= DANGEROUS_POWER) return 1;
  return 0;
}

function lerp(from: number, to: number, progress: number): number {
  'worklet';
  return from + (to - from) * progress;
}

/** Scale at a given age: overshoot past full size, then settle onto it. */
export function shotPowerPopScale(elapsedMs: number): number {
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
export function shotPowerPopOpacity(elapsedMs: number): number {
  'worklet';
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return 0;
  if (elapsedMs >= SHOT_POWER_POP_MS) return 0;
  if (elapsedMs < FADE_START_MS) return 1;
  return 1 - (elapsedMs - FADE_START_MS) / (SHOT_POWER_POP_MS - FADE_START_MS);
}

/** Source-pixel rise at a given age. Nothing moves until the fade starts. */
export function shotPowerPopRise(elapsedMs: number): number {
  'worklet';
  if (!Number.isFinite(elapsedMs) || elapsedMs <= FADE_START_MS) return 0;
  if (elapsedMs >= SHOT_POWER_POP_MS) return RISE_PX;
  return (
    ((elapsedMs - FADE_START_MS) / (SHOT_POWER_POP_MS - FADE_START_MS)) *
    RISE_PX
  );
}
