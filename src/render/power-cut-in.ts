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
  RALLY_CRY: { name: 'Rally Cry', glyph: '!!', color: '#edb54a' },
  ICE_RINK: { name: 'Ice Rink', glyph: '❄', color: '#a3c8f0' },
  SHADOW_MARK: { name: 'Shadow Mark', glyph: '◑', color: '#9a95a4' },
  GRAVITY_WELL: { name: 'Gravity Well', glyph: '◍', color: '#c9a6ec' },
  GIANT_GK: { name: 'Giant GK', glyph: '⬆', color: '#8fd98f' },
  GUST: { name: 'Gust', glyph: '≋', color: '#a3c8f0' },
};

export function powerCutInPresentation(power: PowerId): PowerCutInPresentation {
  return PRESENTATION[power];
}

export function shouldShowFullPowerCutIn(mode: 'full' | 'banner', reduceMotion: boolean): boolean {
  return mode === 'full' && !reduceMotion;
}

export type PowerOverlayPath = 'tile' | 'banner';

/** Own heroes receive tiles when full cut-ins are enabled; every rival fire and
 * every reduced/banner-mode fire follows the compact banner path. */
export function powerOverlayPath(
  mode: 'full' | 'banner',
  reduceMotion: boolean,
  firingTeam: 0 | 1,
  controlledTeam: 0 | 1,
): PowerOverlayPath {
  return shouldShowFullPowerCutIn(mode, reduceMotion) && firingTeam === controlledTeam
    ? 'tile'
    : 'banner';
}

export function powerCutInDurationMs(skippable: boolean): number {
  return skippable ? 1000 : 1550;
}

export function appendNewestFour<T>(items: readonly T[], item: T): T[] {
  return [...items, item].slice(-4);
}

export interface PowerCutInGroupPolicy {
  shouldPause: boolean;
  skippable: boolean;
  durationMs: number;
}

/** A mixed group retains first-reveal protection: it pauses and cannot be
 * skipped until every tile in that group has been seen before. */
export function powerCutInGroupPolicy(
  entries: readonly { skippable: boolean }[],
): PowerCutInGroupPolicy {
  const shouldPause = entries.length > 0;
  const skippable = shouldPause && entries.every(entry => entry.skippable);
  return { shouldPause, skippable, durationMs: powerCutInDurationMs(skippable) };
}

/** Width contract for the one-to-four own-team cut-in grid. */
export function powerCutInTileWidth(count: number, index: number): '50%' | '100%' {
  return count === 1 || (count === 3 && index === 2) ? '100%' : '50%';
}
