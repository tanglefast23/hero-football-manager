import type { EnergyUse } from '../sim/tactics';
import { copyFor, type CopyFn } from '../i18n';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

export const TIRED_ENERGY_THRESHOLD = 40;

export type EnergyBand = 'green' | 'amber' | 'red';

const ENERGY_USE_LABEL_KEYS: Readonly<Record<EnergyUse, string>> = {
  SAVE_ENERGY: 'matchScreen.energyMode.saveEnergy',
  BALANCED: 'matchScreen.energyMode.balanced',
  ALL_OUT: 'matchScreen.energyMode.allOut',
};

const ENERGY_USE_ACCESSIBILITY_KEYS: Readonly<Record<EnergyUse, string>> = {
  SAVE_ENERGY: 'matchScreen.a11y.energyMode.saveEnergy',
  BALANCED: 'matchScreen.a11y.energyMode.balanced',
  ALL_OUT: 'matchScreen.a11y.energyMode.allOut',
};

/** The button word for an energy mode — "SAVE ENERGY", "BALANCED", "ALL OUT". */
export function energyUseLabel(mode: EnergyUse, t: CopyFn = englishCopy()): string {
  return t(ENERGY_USE_LABEL_KEYS[mode]);
}

/** What that mode does, for a screen reader. */
export function energyUseAccessibility(mode: EnergyUse, t: CopyFn = englishCopy()): string {
  return t(ENERGY_USE_ACCESSIBILITY_KEYS[mode]);
}

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
