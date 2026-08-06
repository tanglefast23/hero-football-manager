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
