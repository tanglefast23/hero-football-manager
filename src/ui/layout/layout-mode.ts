export type LayoutMode = 'single' | 'twoColumn';

/**
 * Viewports at least this wide flow management sections into two columns.
 * 900 keeps every phone (including landscape web) and portrait iPad on the
 * proven single column; desktop windows and landscape tablets go wide.
 */
export const TWO_COLUMN_MIN_WIDTH = 900;

export function layoutModeForWidth(width: number): LayoutMode {
  return width >= TWO_COLUMN_MIN_WIDTH ? 'twoColumn' : 'single';
}
