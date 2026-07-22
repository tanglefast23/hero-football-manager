import type { PowerId } from '../sim/types';
import { powerEffectDescriptor } from './power-effect-descriptors';

export interface PowerCutInPresentation {
  name: string;
  glyph: string;
  color: string;
}

export interface PowerCutInLabelEntry {
  power: PowerId;
  playerName: string;
  skippable: boolean;
}

const GLYPHS: Record<PowerId, string> = {
  SUPER_SPEED: '»»',
  BLINK_RUN: '✦',
  THUNDER_STRIKE: '⚡',
  FIRE_TORCH: '▲',
  PHASE_RUN: '◌',
  PORTAL_PASS: '◎',
  DECOY_DOUBLE: '×2',
  FUTURE_SIGHT: '◉',
  SUPER_STRENGTH: '✹',
  WEB_TRAP: '#',
  ELASTIC_KEEPER: '↔',
  RALLY_CRY: '!!',
  ICE_RINK: '❄',
  SHADOW_MARK: '◑',
  GRAVITY_WELL: '◍',
  GIANT_GK: '⬆',
  GUST: '≋',
};

export function powerCutInPresentation(power: PowerId): PowerCutInPresentation {
  const effect = powerEffectDescriptor(power);
  return { name: effect.name, glyph: GLYPHS[power], color: effect.primary };
}

export function shouldShowFullPowerCutIn(mode: 'full' | 'banner', reduceMotion: boolean): boolean {
  // Full-pitch comic panels failed live playtesting: they hid the match and
  // the pause/resume transition made the action harder to follow. "Full" now
  // means the complete compact player/power card; "banner" remains the
  // minimal text-only alternative. Neither pauses or covers the pitch.
  void reduceMotion;
  return mode === 'full';
}

export type PowerOverlayPath = 'tile' | 'banner';

/** Own heroes use the compact player-name callout; rivals remain threats. */
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
  return skippable ? 900 : 1200;
}

export function appendNewestFour<T>(items: readonly T[], item: T): T[] {
  return [...items, item].slice(-4);
}

export interface PowerCutInGroupPolicy {
  shouldPause: boolean;
  skippable: boolean;
  durationMs: number;
}

/** Compact activation labels never pause the match. */
export function powerCutInGroupPolicy(
  entries: readonly { skippable: boolean }[],
): PowerCutInGroupPolicy {
  const skippable = entries.length > 0 && entries.every(entry => entry.skippable);
  return { shouldPause: false, skippable, durationMs: powerCutInDurationMs(skippable) };
}

export function powerCutInAccessibilityLabel(entries: readonly PowerCutInLabelEntry[]): string {
  const powers = entries
    .map(entry => {
      const effect = powerEffectDescriptor(entry.power);
      return `${effect.name}, ${entry.playerName}. ${effect.accessibilityLabel}`;
    })
    .join('. ');
  return `${powers}${powerCutInGroupPolicy(entries).skippable ? '. Tap to skip.' : ''}`;
}

/** Width contract for the one-to-four own-team cut-in grid. */
export function powerCutInTileWidth(count: number, index: number): '50%' | '100%' {
  return count === 1 || (count === 3 && index === 2) ? '100%' : '50%';
}
