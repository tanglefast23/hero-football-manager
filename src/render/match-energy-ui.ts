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
