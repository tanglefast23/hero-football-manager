import type { PlayerDef, PowerState } from '../sim/types';
import { copyFor, type CopyFn } from '../i18n';
import { heatFraction } from './match-rail';

let englishCopyFn: CopyFn | undefined;

function englishCopy(): CopyFn {
  return (englishCopyFn ??= copyFor('en'));
}

/**
 * Possession-card charge meter (2026-07-25). The bottom-corner carrier card
 * already names whoever has (or just had) the ball and reads their energy; a
 * hero carrier also gets their banked Heat as a second bar so the Zone is
 * readable from the pitch, not just the desktop rail.
 *
 * Presentation only — nothing here touches the engine, so no ENGINE_VERSION
 * bump is involved.
 */

/**
 * `building` banks Heat, `ready` is the live Zone window, `spent` covers a
 * power actually playing out (armed placement, wind-up, active moment).
 */
export type ChargeMeterState = 'building' | 'ready' | 'spent';

export interface ChargeMeter {
  state: ChargeMeterState;
  /** 0–1 bar fill. */
  fill: number;
}

/**
 * The engine zeroes `gauge` on Zone ENTRY (powers.ts, `p.gauge = 0` beside the
 * POWER_READY emit), not on fire. Reading the raw gauge would therefore empty
 * the bar at the precise moment the hero became able to fire, so a Zone is
 * pinned full and the reset lands on the power playing out instead — which is
 * also where players expect it.
 */
export function chargeMeter(
  gauge: number,
  powerState: PowerState,
  role: PlayerDef['role'],
): ChargeMeter {
  if (powerState.kind === 'zone' || powerState.kind === 'armed')
    return { state: 'ready', fill: 1 };
  if (powerState.kind === 'idle')
    return { state: 'building', fill: heatFraction(gauge, role) };
  return { state: 'spent', fill: 0 };
}

/** Charge is the game's blue; the energy bar above it owns green/amber/red. */
export const CHARGE_FILL_COLOR = '#5a8fd6';

/**
 * Rainbow order drawn from the game palette rather than raw hues, so a ready
 * hero reads as the same comic FX vocabulary as their cut-in.
 *
 * Deliberately uses the brighter sprite-sheet red, orange and blue rather than
 * the HUD kit tokens: the possession card is painted in the carrier's kit, and
 * a band identical to the panel behind it loses its top and bottom edges. See
 * the "never wears a kit colour" test.
 */
export const CHARGE_RAINBOW_BANDS: readonly string[] = [
  '#e8433f',
  '#ff6a00',
  '#5cb85c',
  '#a3c8f0',
  '#3f6fd8',
  '#9a63d6',
];

/**
 * Hard-edged bands, 8-point grid — a pixel-art strip, not a soft gradient.
 * Measured on device at the card's real 134pt width: 8pt bands pack ~2.8 cycles
 * into the bar and read as shimmer, while 16pt shows ~1.4 cycles and each
 * colour is legible as it travels.
 */
export const CHARGE_BAND_WIDTH = 16;

/** One full pass of the palette; also the loop's translate distance. */
export const CHARGE_RAINBOW_CYCLE_WIDTH =
  CHARGE_RAINBOW_BANDS.length * CHARGE_BAND_WIDTH;

/** Seconds-scale slide: lively enough to read as "charged", not strobing. */
export const CHARGE_RAINBOW_CYCLE_MS = 1200;

/**
 * Band colours for a strip wide enough that sliding it a whole cycle never
 * exposes the track behind it. One spare cycle covers the travel exactly.
 */
export function rainbowStripBands(trackWidth: number): string[] {
  const cycles =
    Math.max(1, Math.ceil(trackWidth / CHARGE_RAINBOW_CYCLE_WIDTH)) + 1;
  return Array.from(
    { length: cycles * CHARGE_RAINBOW_BANDS.length },
    (_, index) => CHARGE_RAINBOW_BANDS[index % CHARGE_RAINBOW_BANDS.length],
  );
}

export function rainbowStripWidth(trackWidth: number): number {
  return rainbowStripBands(trackWidth).length * CHARGE_BAND_WIDTH;
}

export function chargeMeterAccessibilityLabel(
  meter: ChargeMeter,
  t: CopyFn = englishCopy(),
): string {
  if (meter.state === 'ready') return t('matchScreen.a11y.powerCharged');
  if (meter.state === 'spent') return t('matchScreen.a11y.powerSpent');
  return t('matchScreen.a11y.powerCharge', {
    percent: Math.round(meter.fill * 100),
  });
}
