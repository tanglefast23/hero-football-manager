import type { PowerId } from '../sim/types';

export interface PowerCutInPresentation {
  name: string;
  glyph: string;
  color: string;
}

const PRESENTATION: Record<PowerId, PowerCutInPresentation> = {
  SUPER_SPEED: { name: 'Super Speed', glyph: '»»', color: '#77a4d8' },
  BLINK_RUN: { name: 'Blink Run', glyph: '✦', color: '#b189d9' },
  THUNDER_STRIKE: { name: 'Thunder Strike', glyph: '⚡', color: '#edb54a' },
  FIRE_TORCH: { name: 'Fire Torch', glyph: '▲', color: '#f06b3d' },
  PHASE_RUN: { name: 'Phase Run', glyph: '◌', color: '#c3a5e5' },
  PORTAL_PASS: { name: 'Portal Pass', glyph: '◎', color: '#77a4d8' },
  MAGNET_TOUCH: { name: 'Magnet Touch', glyph: '∪', color: '#d94f52' },
  DECOY_DOUBLE: { name: 'Decoy Double', glyph: '×2', color: '#b189d9' },
  FUTURE_SIGHT: { name: 'Future Sight', glyph: '◉', color: '#f7d894' },
  SUPER_STRENGTH: { name: 'Super Strength', glyph: '✹', color: '#edb54a' },
  WEB_TRAP: { name: 'Web Trap', glyph: '#', color: '#f4f1ea' },
  ELASTIC_KEEPER: { name: 'Elastic Keeper', glyph: '↔', color: '#65b96e' },
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
