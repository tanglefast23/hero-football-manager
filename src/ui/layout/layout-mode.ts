export type LayoutMode = 'single' | 'twoColumn';

/**
 * Viewports at least this wide flow management sections into two columns.
 * 1100 keeps iPhones, portrait iPads (including the 13-inch model at 1032pt),
 * and narrow multitasking windows on the proven single column. Full-width
 * modern iPads in landscape and desktop windows have room for both columns.
 */
export const TWO_COLUMN_MIN_WIDTH = 1100;

export function layoutModeForWidth(width: number): LayoutMode {
  return width >= TWO_COLUMN_MIN_WIDTH ? 'twoColumn' : 'single';
}

/**
 * How tall a one-column title screen must be to hold the popping mascot.
 *
 * The mascot is drawn above the menu panel, out of flow, and reaches about
 * 196pt over the panel's top edge — bubble, hero and all. The compact column
 * reserves 112pt for it and relies on `justify-between` to donate whatever the
 * viewport has left over. On a 667pt iPhone SE there is nothing left over, so
 * the overhang landed on the wordmark: the speech bubble sat across "MANAGER!"
 * and the hero across the strapline, on the first screen of the game.
 *
 * Measured, not guessed, from the two devices this was checked on: the SE
 * overlapped the copy by ~76pt and a 956pt Pro Max cleared it by ~79pt, which
 * puts the break-even a little above 800pt. 840 keeps a real margin above that
 * and is the honest budget — a screen shorter than this shows a clean title and
 * no mascot, which beats a defaced wordmark. Raising the reserve instead would
 * push STORY off the bottom of an SE, which is worse than a missing flourish.
 */
export const TITLE_MASCOT_MIN_HEIGHT = 840;

export function titleMascotFits(height: number): boolean {
  return height >= TITLE_MASCOT_MIN_HEIGHT;
}
