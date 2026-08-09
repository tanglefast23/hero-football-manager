// Pure render constants for the hard-edged tackle debris paths.
export const TACKLE_DUST_COLOR = '#cf9268';
export const TACKLE_DUST_OPACITY = 0.65;
export const TACKLE_GRASS_COLOR = '#5cb85c';
export const TACKLE_GRASS_OPACITY = 0.4;

export const TACKLE_DUST_PIXELS = [
  { along: -13, side: -2, size: 5 },
  { along: -10, side: 4, size: 4 },
  { along: -6, side: -4, size: 6 },
  { along: -2, side: 6, size: 4 },
  { along: 3, side: -5, size: 5 },
  { along: 7, side: 3, size: 3 },
] as const;

export const TACKLE_GRASS_PIXELS = [
  { along: -8, side: -4, height: 4 },
  { along: -3, side: 5, height: 6 },
  { along: 2, side: -6, height: 5 },
  { along: 7, side: 4, height: 7 },
  { along: 11, side: -3, height: 4 },
] as const;

/**
 * Ground-locked debris samples spanning the tackler's real launch-to-current
 * coordinate. Older debris stays small near the launch point while newer
 * chunks grow toward the player, leaving a readable trail instead of one puff.
 */
export const TACKLE_TRAIL_SAMPLES = [
  { progress: 0.04, side: -2, dustSize: 2, grassHeight: 3 },
  { progress: 0.14, side: 3, dustSize: 2, grassHeight: 4 },
  { progress: 0.24, side: -4, dustSize: 3, grassHeight: 3 },
  { progress: 0.34, side: 2, dustSize: 2, grassHeight: 5 },
  { progress: 0.44, side: -3, dustSize: 3, grassHeight: 4 },
  { progress: 0.54, side: 4, dustSize: 3, grassHeight: 5 },
  { progress: 0.64, side: -2, dustSize: 4, grassHeight: 4 },
  { progress: 0.74, side: 3, dustSize: 3, grassHeight: 6 },
  { progress: 0.84, side: -4, dustSize: 4, grassHeight: 5 },
  { progress: 0.94, side: 2, dustSize: 5, grassHeight: 7 },
] as const;
