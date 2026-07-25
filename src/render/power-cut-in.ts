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

// ---------------------------------------------------------------------------
// Activation "juice" — the beat sheet a POWER_FIRED plays through.
//
// Everything below is presentation-only and lives on the renderer's wall clock,
// never the sim clock: the engine keeps taking the same fixed-step integer ticks
// in the same order with the same RNG draws, the renderer just paces and dresses
// them. Nothing here can move a replay.
//
// docs/03 keeps the match on a static wide view through activations, and
// shouldShowFullPowerCutIn() above records that full-pitch comic panels FAILED
// live playtesting because they hid the match. So the whole sheet is
// non-blocking and on-pitch, and it is over inside ~0.56s.
// ---------------------------------------------------------------------------

/** Beat 1 — the drop into slow motion. */
export const POWER_JUICE_DROP_MS = 80;
/** Beat 2 ends here — the freeze-frame hold. */
export const POWER_JUICE_HOLD_END_MS = 260;
/** Beat 3 ends here — back to full speed, everything reset. */
export const POWER_JUICE_END_MS = 560;
/** Decaying screen shake window (SUPER_STRENGTH). */
export const POWER_JUICE_SHAKE_MS = 220;
/** White-out window (the speed powers). */
export const POWER_JUICE_FLASH_MS = 130;
/** Peak opacity of that white-out. Deliberately short of a full white screen. */
export const POWER_JUICE_FLASH_OPACITY = 0.55;
/** Radial speed-line burst window (the speed powers). */
export const POWER_JUICE_SPEED_LINES_MS = 240;
/** Integer camera magnification held over a keeper power. */
export const POWER_JUICE_PUNCH_ZOOM = 2;
/** How long that punch-in holds before cutting back to the wide view. */
export const POWER_JUICE_PUNCH_MS = 360;
/** Ability-name card slam-in: travel and duration. */
export const POWER_JUICE_CARD_SLAM_PX = 120;
export const POWER_JUICE_CARD_SLAM_MS = 90;
/** One step of the hero's white/gold body flash. */
export const POWER_JUICE_HERO_FLASH_MS = 65;

/** Which extras a power adds on top of the shared sheet. */
export interface PowerJuice {
  /** Decaying whole-device-pixel screen shake. */
  shake: boolean;
  /** Brief white-out over the pitch. */
  flash: boolean;
  /** Radial wedge burst off the hero. */
  speedLines: boolean;
  /** Integer magnification step centred on the hero. */
  punchIn: boolean;
}

const NO_JUICE: PowerJuice = { shake: false, flash: false, speedLines: false, punchIn: false };

/**
 * Per-power flavour. Every power shares the time dilation, the slammed-in name
 * card and the hero body flash; these are the three extras that separate a
 * shoulder charge from a blur from a save.
 */
export function powerJuice(power: PowerId): PowerJuice {
  if (power === 'SUPER_STRENGTH') return { ...NO_JUICE, shake: true };
  if (power === 'SUPER_SPEED' || power === 'BLINK_RUN' || power === 'PHASE_RUN') {
    return { ...NO_JUICE, flash: true, speedLines: true };
  }
  if (power === 'ELASTIC_KEEPER' || power === 'GIANT_GK') return { ...NO_JUICE, punchIn: true };
  return NO_JUICE;
}

/** True when a power dresses itself beyond the shared sheet. */
export function hasPowerJuiceExtras(power: PowerId): boolean {
  const juice = powerJuice(power);
  return juice.shake || juice.flash || juice.speedLines || juice.punchIn;
}

interface PowerJuiceDilationStep {
  readonly untilMs: number;
  readonly dilation: number;
}

/**
 * Stepped, not eased. Each step re-issues the Reanimated interpolation window
 * once, so a whole activation costs four re-issues instead of one per frame —
 * and a hard-stepped ramp is the on-style read for pixel art anyway.
 */
export const POWER_JUICE_DILATION_STEPS: readonly PowerJuiceDilationStep[] = [
  { untilMs: POWER_JUICE_DROP_MS, dilation: 0.5 },
  { untilMs: POWER_JUICE_HOLD_END_MS, dilation: 0.15 },
  { untilMs: 400, dilation: 0.35 },
  { untilMs: POWER_JUICE_END_MS, dilation: 0.7 },
];

/** Wall-clock time dilation this far into an activation. 1 = normal speed. */
export function powerJuiceDilation(elapsedMs: number): number {
  if (elapsedMs < 0) return 1;
  for (const step of POWER_JUICE_DILATION_STEPS) {
    if (elapsedMs < step.untilMs) return step.dilation;
  }
  return 1;
}

export type PowerJuiceHeroTint = 'none' | 'white' | 'gold';

/**
 * The hero's body tint through the drop and hold: white, gold, white, gold,
 * then released back to whatever the player's status already says.
 */
export function powerJuiceHeroTint(elapsedMs: number): PowerJuiceHeroTint {
  if (elapsedMs < 0 || elapsedMs >= POWER_JUICE_HOLD_END_MS) return 'none';
  return Math.floor(elapsedMs / POWER_JUICE_HERO_FLASH_MS) % 2 === 0 ? 'white' : 'gold';
}
