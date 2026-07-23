export type LayoutMode = 'single' | 'twoColumn';

/**
 * Viewports at least this wide flow management sections into two columns.
 * 960 keeps every phone on the proven single column — including the largest
 * iPhone landscape web viewports (~956pt) — while landscape tablets and
 * desktop windows go wide.
 */
export const TWO_COLUMN_MIN_WIDTH = 960;

export function layoutModeForWidth(width: number): LayoutMode {
  return width >= TWO_COLUMN_MIN_WIDTH ? 'twoColumn' : 'single';
}
