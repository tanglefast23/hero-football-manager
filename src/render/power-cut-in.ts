import type { PowerId } from '../sim/types';

export interface PowerCutInPresentation {
  name: string;
  glyph: string;
  color: string;
}

const PRESENTATION: Record<PowerId, PowerCutInPresentation> = {
  SUPER_SPEED: { name: 'Super Speed', glyph: '»»', color: '#a3c8f0' },
  BLINK_RUN: { name: 'Blink Run', glyph: '✦', color: '#c9a6ec' },
  THUNDER_STRIKE: { name: 'Thunder Strike', glyph: '⚡', color: '#edb54a' },
  FIRE_TORCH: { name: 'Fire Torch', glyph: '▲', color: '#d94f52' },
  PHASE_RUN: { name: 'Phase Run', glyph: '◌', color: '#c9a6ec' },
  PORTAL_PASS: { name: 'Portal Pass', glyph: '◎', color: '#a3c8f0' },
  DECOY_DOUBLE: { name: 'Decoy Double', glyph: '×2', color: '#c9a6ec' },
  FUTURE_SIGHT: { name: 'Future Sight', glyph: '◉', color: '#f7d894' },
  SUPER_STRENGTH: { name: 'Super Strength', glyph: '✹', color: '#edb54a' },
  WEB_TRAP: { name: 'Web Trap', glyph: '#', color: '#f4f1ea' },
  ELASTIC_KEEPER: { name: 'Elastic Keeper', glyph: '↔', color: '#8fd98f' },
};

export function powerCutInPresentation(power: PowerId): PowerCutInPresentation {
  return PRESENTATION[power];
}

export function shouldShowFullPowerCutIn(mode: 'full' | 'banner', reduceMotion: boolean): boolean {
  return mode === 'full' && !reduceMotion;
}

export function powerCutInDurationMs(skippable: boolean): number {
  return skippable ? 1000 : 1550;
}
