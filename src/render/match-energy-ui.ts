import type { EnergyUse } from '../sim/tactics';

export const TIRED_ENERGY_THRESHOLD = 40;

export type EnergyBand = 'green' | 'amber' | 'red';

export const ENERGY_USE_LABELS: Readonly<Record<EnergyUse, string>> = {
  SAVE_ENERGY: 'SAVE ENERGY',
  BALANCED: 'BALANCED',
  ALL_OUT: 'ALL OUT',
};

export const ENERGY_USE_ACCESSIBILITY: Readonly<Record<EnergyUse, string>> = {
  SAVE_ENERGY: 'Jog more and press less to conserve energy.',
  BALANCED: 'Use normal movement and pressing effort.',
  ALL_OUT: 'Press and recover harder at a much higher energy cost.',
};

export function energyBand(condition: number): EnergyBand {
  if (condition <= 30) return 'red';
  if (condition <= 60) return 'amber';
  return 'green';
}

/**
 * One fill colour per band, shared by every energy bar (possession card, swap
 * sheet, control rail, first-match coaching).
 *
 * None of them may repeat a kit colour from `team-kit-ui`: the possession card
 * paints itself in the carrier's kit, so a fill that matches the panel vanishes
 * into it. Amber was literally `HOME_KIT_COLOR_SAFE` and red literally
 * `HOME_KIT_COLOR`, which hid the bar on whichever kit was in play. The
 * replacements are the bible's gold-dark and the low-energy red already used
 * for the matching text, and all three clear 3:1 on the dark HUD track.
 */
export const ENERGY_FILL_COLORS: Readonly<Record<EnergyBand, string>> = {
  green: '#65b96e',
  amber: '#c8862a',
  red: '#f06b6e',
};

export function summarizeTeamEnergy(conditions: readonly number[]): {
  average: number;
  tiredCount: number;
} {
  if (conditions.length === 0) return { average: 0, tiredCount: 0 };
  const total = conditions.reduce((sum, condition) => sum + condition, 0);
  return {
    average: Math.round(total / conditions.length),
    tiredCount: conditions.filter((condition) => condition <= TIRED_ENERGY_THRESHOLD).length,
  };
}
