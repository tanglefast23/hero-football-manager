// Pure render constants for the hard-edged tackle debris paths.
export const TACKLE_DUST_COLOR = '#c2a87a';
export const TACKLE_DUST_OPACITY = 0.65;
export const TACKLE_GRASS_COLOR = '#5cb85c';
export const TACKLE_GRASS_OPACITY = 1;

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

