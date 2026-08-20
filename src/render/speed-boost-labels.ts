/**
 * The SPEED+ plate under every player carrying a long pass chain's speed
 * bonus.
 *
 * From x5 the chain stops announcing itself as a number over one head and
 * starts marking the players it actually made faster, for as long as their
 * bonus lasts. Below x5 the ×N pop still fires — a short chain is a moment,
 * not a state.
 *
 * Pure TS on purpose (no react-native/Skia imports), same reason as
 * `pass-combo.ts`: Jest can exercise it headless while MatchScreen cannot be
 * imported under the test runner.
 *
 * Render ring only. It reads sim state and writes nothing back, so no replay
 * and no ENGINE_VERSION is involved.
 */
import { tierForCount } from '../sim/pass-combo';
import { pixelGlyph } from './pixel-glyphs';

/** The chain length that trades the ×N pop for the plate. */
export const SPEED_BOOST_MIN_COUNT = 5;

/**
 * The granted tier at that length. Matching on the tier rather than on the
 * live count is what keeps the plate up for the whole 3s fade: the chain that
 * granted it is usually already broken by the time a player is still fast.
 */
export const SPEED_BOOST_MIN_TIER_D = tierForCount(SPEED_BOOST_MIN_COUNT);

export const SPEED_BOOST_LABEL = 'SPEED+';

/** Lit cells of the label, flattened to x,y pairs for the drawing worklet. */
export const SPEED_BOOST_CELLS: readonly number[] = Object.freeze(
  pixelGlyph(SPEED_BOOST_LABEL).pixels.flatMap((cell) => [cell.x, cell.y]),
);
export const SPEED_BOOST_CELL_WIDTH = pixelGlyph(SPEED_BOOST_LABEL).width;
export const SPEED_BOOST_CELL_HEIGHT = pixelGlyph(SPEED_BOOST_LABEL).height;

export interface SpeedBoostCandidate {
  readonly comboTierD: number;
  readonly comboTicks: number;
}

/**
 * Render slots wearing the plate, as a bitmask.
 *
 * A BITMASK, not an array, for the same reason as `fireTorchMask`: the drawing
 * worklet captures it, and Reanimated restarts a mapper whose captured values
 * changed identity. A fresh array every sim tick would restart it every tick.
 */
export function speedBoostMask(
  players: readonly SpeedBoostCandidate[],
): number {
  let mask = 0;
  for (let index = 0; index < players.length && index < 31; index += 1) {
    const player = players[index];
    if (player.comboTicks > 0 && player.comboTierD >= SPEED_BOOST_MIN_TIER_D)
      mask |= 1 << index;
  }
  return mask;
}
