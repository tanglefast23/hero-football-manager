import { copyFor, type CopyFn } from '../i18n';
import type { PowerId } from '../sim/types';
import { powerEffectDescriptor } from './power-effect-descriptors';

/** The same lazy shape the sibling render modules use. */
let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

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

export function powerCutInPresentation(
  power: PowerId,
  t: CopyFn = englishCopy(),
): PowerCutInPresentation {
  const effect = powerEffectDescriptor(power, t);
  return { name: effect.name, glyph: GLYPHS[power], color: effect.primary };
}

export function shouldShowFullPowerCutIn(
  mode: 'full' | 'banner',
  reduceMotion: boolean,
): boolean {
  // Full-pitch comic panels failed live playtesting: they hid the match and
  // the pause/resume transition made the action harder to follow. "Full" now
  // means the complete compact player/power card; "banner" remains the
  // minimal text-only alternative. Neither pauses or covers the pitch.
  void reduceMotion;
  return mode === 'full';
}

export type PowerOverlayPath = 'tile' | 'banner';

/** Own heroes use the compact player-name callout; rivals remain threats. */
/**
 * Both teams' powers take the tile. A rival's is the same announcement wearing
 * their kit colour — routing them to a text banner instead made the same event
 * read as two different features depending on who fired it.
 */
export function powerOverlayPath(
  mode: 'full' | 'banner',
  reduceMotion: boolean,
): PowerOverlayPath {
  return shouldShowFullPowerCutIn(mode, reduceMotion) ? 'tile' : 'banner';
}

export function appendNewestFour<T>(items: readonly T[], item: T): T[] {
  return [...items, item].slice(-4);
}

export interface PowerCutInGroupPolicy {
  shouldPause: boolean;
  skippable: boolean;
}

/** A control-area power title never pauses the match. */
export function powerCutInGroupPolicy(
  entries: readonly { skippable: boolean }[],
): PowerCutInGroupPolicy {
  const skippable =
    entries.length > 0 && entries.every((entry) => entry.skippable);
  return { shouldPause: false, skippable };
}

/**
 * Whether a cut-in that has not started its outro should start it now.
 *
 * Normally a cut-in ends when its power leaves `active`, which only a further
 * sim tick can do. A frozen clip has stopped taking ticks, so a power that was
 * still mid-effect on the frozen frame stays active for good — Portal Pass and
 * Gravity Well both freeze that way — and its cut-in would hold an outro that
 * can never start. The freeze ends it instead.
 */
export function powerCutInOutroDue(
  powerStillActive: boolean,
  clipFrozen: boolean,
): boolean {
  return clipFrozen || !powerStillActive;
}

/** Keep the completed title in the control area for 1.5 final wall-clock seconds. */
export const POWER_TAKEOVER_POST_POWER_MS = 1500;

export function powerTakeoverShouldRemain(elapsedMs: number): boolean {
  return elapsedMs < POWER_TAKEOVER_POST_POWER_MS;
}

export function powerCutInAccessibilityLabel(
  entries: readonly PowerCutInLabelEntry[],
  t: CopyFn = englishCopy(),
): string {
  const powers = entries
    .map((entry) => {
      const effect = powerEffectDescriptor(entry.power, t);
      return `${effect.name}, ${entry.playerName}. ${effect.accessibilityLabel}`;
    })
    .join('. ');
  return powerCutInGroupPolicy(entries).skippable
    ? t('matchScreen.a11y.tapToSkip', { label: powers })
    : powers;
}

// ---------------------------------------------------------------------------
// Activation "juice" — the beat sheet a POWER_FIRED plays through.
//
// Everything below is presentation-only and lives on the renderer's wall clock,
// never the sim clock: the engine keeps taking the same fixed-step integer ticks
// in the same order with the same RNG draws while the renderer dresses them.
// Nothing here can move a replay.
//
// docs/03 keeps the match on a static wide view through activations, and
// shouldShowFullPowerCutIn() above records that full-pitch comic panels FAILED
// live playtesting because they hid the match. So the whole sheet is
// non-blocking and on-pitch, and it is over inside ~0.56s.
// ---------------------------------------------------------------------------

/** The shared alternating body flash ends here. */
export const POWER_JUICE_HERO_FLASH_END_MS = 260;
/** The complete activation visual window ends here. */
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

const NO_JUICE: PowerJuice = {
  shake: false,
  flash: false,
  speedLines: false,
  punchIn: false,
};

/**
 * Per-power flavour. Every power shares the slammed-in name card and hero body
 * flash; these extras separate a shoulder charge from a blur from a save.
 */
export function powerJuice(power: PowerId): PowerJuice {
  if (power === 'SUPER_STRENGTH') return { ...NO_JUICE, shake: true };
  if (
    power === 'SUPER_SPEED' ||
    power === 'BLINK_RUN' ||
    power === 'PHASE_RUN'
  ) {
    return { ...NO_JUICE, flash: true, speedLines: true };
  }
  if (power === 'ELASTIC_KEEPER' || power === 'GIANT_GK')
    return { ...NO_JUICE, punchIn: true };
  return NO_JUICE;
}

/** True when a power dresses itself beyond the shared sheet. */
export function hasPowerJuiceExtras(power: PowerId): boolean {
  const juice = powerJuice(power);
  return juice.shake || juice.flash || juice.speedLines || juice.punchIn;
}

export type PowerJuiceHeroTint = 'none' | 'white' | 'gold';

/**
 * The hero's body tint through the drop and hold: white, gold, white, gold,
 * then released back to whatever the player's status already says.
 */
export function powerJuiceHeroTint(elapsedMs: number): PowerJuiceHeroTint {
  if (elapsedMs < 0 || elapsedMs >= POWER_JUICE_HERO_FLASH_END_MS)
    return 'none';
  return Math.floor(elapsedMs / POWER_JUICE_HERO_FLASH_MS) % 2 === 0
    ? 'white'
    : 'gold';
}
