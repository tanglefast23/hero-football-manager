// Pure render constants for the hard-edged, four-phase tackle debris paths.
export const TACKLE_DUST_COLOR = '#cf9268';
export const TACKLE_DUST_OPACITY = 0.15;
export const TACKLE_DUST_SIZE_SCALE = 3.4;
export const TACKLE_DUST_POSITION_SCALE = 1.25;
export const TACKLE_GRASS_COLOR = '#5cb85c';
export const TACKLE_GRASS_OPACITY = 0.8;
export const TACKLE_VFX_STEP_MS = 334;

export interface TackleDustFragment {
  along: number;
  side: number;
  size: number;
}

export interface TackleGrassFragment {
  along: number;
  side: number;
  width: number;
  height: number;
  rise: number;
}

/**
 * Four deliberate silhouettes. The source arrays are fixed presentation data,
 * not a random particle system, so a given tackle age always draws the same
 * pixels at 1x, 2x, and 3x playback.
 */
export const TACKLE_DUST_PHASES: readonly (readonly TackleDustFragment[])[] = [
  [
    { along: -4, side: 0, size: 10 },
    { along: -7, side: -9, size: 8 },
    { along: -6, side: 9, size: 7 },
    { along: -12, side: -14, size: 6 },
    { along: -11, side: 14, size: 6 },
    { along: -18, side: -6, size: 5 },
    { along: -17, side: 6, size: 5 },
  ],
  [
    { along: -6, side: 0, size: 11 },
    { along: -9, side: -10, size: 9 },
    { along: -8, side: 10, size: 8 },
    { along: -14, side: -16, size: 7 },
    { along: -13, side: 16, size: 7 },
    { along: -20, side: -9, size: 6 },
    { along: -19, side: 8, size: 6 },
    { along: -25, side: -2, size: 5 },
    { along: -23, side: 13, size: 5 },
  ],
  [
    { along: -8, side: 0, size: 10 },
    { along: -11, side: -12, size: 9 },
    { along: -10, side: 12, size: 9 },
    { along: -16, side: -18, size: 7 },
    { along: -15, side: 18, size: 7 },
    { along: -22, side: -12, size: 7 },
    { along: -21, side: 11, size: 6 },
    { along: -28, side: -5, size: 5 },
    { along: -27, side: 6, size: 5 },
    { along: -18, side: 0, size: 6 },
  ],
  [
    { along: -10, side: 0, size: 8 },
    { along: -13, side: -14, size: 7 },
    { along: -12, side: 14, size: 7 },
    { along: -18, side: -19, size: 6 },
    { along: -17, side: 19, size: 6 },
    { along: -24, side: -13, size: 6 },
    { along: -23, side: 13, size: 5 },
    { along: -30, side: -6, size: 4 },
    { along: -29, side: 7, size: 4 },
  ],
] as const;

export const TACKLE_GRASS_PHASES: readonly (readonly TackleGrassFragment[])[] =
  [
    [
      { along: -5, side: -5, width: 2, height: 1, rise: 1 },
      { along: 1, side: 5, width: 1, height: 2, rise: 2 },
    ],
    [
      { along: -8, side: -7, width: 2, height: 2, rise: 3 },
      { along: -2, side: 6, width: 3, height: 1, rise: 4 },
      { along: 4, side: -4, width: 1, height: 2, rise: 2 },
    ],
    [
      { along: -11, side: -8, width: 3, height: 1, rise: 5 },
      { along: -5, side: 8, width: 2, height: 2, rise: 6 },
      { along: 1, side: -6, width: 2, height: 1, rise: 4 },
      { along: 6, side: 5, width: 1, height: 2, rise: 3 },
    ],
    [
      { along: -14, side: -9, width: 2, height: 1, rise: 7 },
      { along: -8, side: 9, width: 2, height: 1, rise: 6 },
      { along: -1, side: -7, width: 1, height: 2, rise: 5 },
    ],
  ] as const;

/**
 * Low ground flecks spanning the real launch-to-current path. Dust and grass
 * both start at the sliding player and extend backward across that complete
 * path. Grass uses short detached chunks instead of tall blades.
 */
export const TACKLE_TRAIL_SAMPLES = [
  { progress: 0.04, side: -5, dustSize: 5, grassWidth: 2, grassHeight: 1 },
  { progress: 0.14, side: 6, dustSize: 5, grassWidth: 1, grassHeight: 2 },
  { progress: 0.24, side: -8, dustSize: 6, grassWidth: 2, grassHeight: 1 },
  { progress: 0.34, side: 5, dustSize: 5, grassWidth: 2, grassHeight: 1 },
  { progress: 0.44, side: -7, dustSize: 6, grassWidth: 1, grassHeight: 2 },
  { progress: 0.54, side: 8, dustSize: 6, grassWidth: 2, grassHeight: 1 },
  { progress: 0.64, side: -6, dustSize: 7, grassWidth: 3, grassHeight: 1 },
  { progress: 0.74, side: 7, dustSize: 7, grassWidth: 2, grassHeight: 2 },
  { progress: 0.84, side: -9, dustSize: 8, grassWidth: 3, grassHeight: 1 },
  { progress: 0.94, side: 6, dustSize: 8, grassWidth: 2, grassHeight: 2 },
] as const;
