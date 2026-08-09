/**
 * How wide each fixed column of the squad register has to be, in points.
 *
 * These are plain numbers rather than Tailwind width classes, because two
 * measurements made the classes lie about their own size:
 *
 * 1. NativeWind resolves `1rem` to React Native's 14pt on native, not to a
 *    browser's 16px. `w-12` is therefore 42pt, not the 48 its name implies —
 *    every register column was 12.5% narrower than the code claimed, and the
 *    role header (`w-12`, 42pt) sat 6pt left of the role cells under it
 *    (`width: 48`). Points here mean points.
 * 2. Text grows with the reader's iOS text size. A phone set to xxLarge scales
 *    every font by 1.235, so a 10pt header renders at 12.35pt: measured off a
 *    screenshot from that phone, "OVR" plus its arrow wanted 46.9pt of a 42pt
 *    column and the arrow was clipped to a 1pt sliver.
 *
 * So every width below is derived rather than chosen: it holds its own header
 * at the largest size that header is allowed to reach, plus the sort arrow,
 * plus a gutter to the column beside it. `squad-register-columns.test.ts`
 * re-runs that arithmetic, so a width cannot quietly stop fitting again.
 */

/**
 * Silkscreen Bold advances in em, measured out of the shipped TTF's `hmtx`
 * table rather than estimated from a screenshot. Uppercase letters are not all
 * one width — M, N and V are 1.0em where most are 0.875em and E is 0.75em — so
 * these are per-word totals for the words the register actually renders. The
 * labels are typed in title case and uppercased by the stylesheet; what is
 * measured here is what is drawn.
 */
export const HEADER_LABEL_ADVANCE_EM: Readonly<Record<string, number>> = {
  Pos: 2.625,
  OVR: 2.75,
  POT: 2.5,
  Cond: 3.625,
  Score: 4.25,
  Potential: 7.125,
  Condition: 7.25,
};

/** `text-[10px]` on a phone; `text-xs`, which is 0.75rem = 10.5pt, when wide. */
export const HEADER_FONT_SIZE = { phone: 10, wide: 10.5 } as const;

/**
 * How far a header may grow with the reader's text size. A five-letter
 * abbreviation labelling a fixed column cannot grow
 * without pushing its neighbour off the row, and the sentence a header stands
 * for is on the Pressable's accessibility label at any size. 1.25 is above the
 * xxLarge multiplier (1.235), so the largest text size in ordinary use renders
 * unchanged and only the accessibility sizes are held back.
 */
export const HEADER_MAX_FONT_MULTIPLIER = 1.25;

/**
 * Fixed numeric cells cannot reflow independently of their table row. They keep
 * the former measured 1.6 ceiling locally, while prose and player actions use
 * the full system Dynamic Type selection.
 */
export const CELL_MAX_FONT_MULTIPLIER = 1.6;

/**
 * The sort arrow is drawn, not typed, so it is exactly this wide at every text
 * size — which is the whole reason the widths below can be proven. Even, so
 * that each half is a whole point: an odd 7 gave the triangle two 3.5pt border
 * halves, and a renderer that floors those draws a 6pt arrow instead.
 */
export const SORT_ARROW_WIDTH = 8;
export const SORT_ARROW_HEIGHT = 4;
/** Between the label and its arrow. */
export const SORT_ARROW_GAP = 4;

/** Clear space between a header and the column beside it, at the size cap. */
export const HEADER_MIN_GUTTER = 4;

/**
 * The train circle and the tap it has to accept.
 *
 * `w-10` is 2.5rem, which is 35pt here and not the 40 the class name suggests,
 * so `hitSlop` is what carries the button over the 44pt minimum: 35 + 2 x 5 is
 * 45. It had been 2, for a claimed 44 that was really 39 — the same rem trap,
 * and the reason the sum is written down and tested rather than asserted in a
 * comment. hitSlop costs no layout, so the columns keep every point.
 */
export const TRAIN_BUTTON_DIAMETER = 35;
export const TRAIN_BUTTON_HIT_SLOP = 5;
/** Apple's minimum comfortable touch target, and Android's within a point. */
export const MINIMUM_TOUCH_TARGET = 44;

/**
 * The row values use the local fixed-cell cap above. `text-base` is 1rem (14pt)
 * and `text-sm` 0.875rem (12.25pt), and the widest thing each column ever shows
 * is two characters except condition, which shows "100%".
 */
export const CELL_FONT_SIZE = { value: 14, condition: 12.25 } as const;
/** Silkscreen Regular advances, same source as the header measurements. */
export const CELL_WIDEST_VALUE_EM = {
  overall: 1.5,
  potential: 1.5,
  condition: 3,
} as const;
/** The potential cell's `pr-1`, which is 0.25rem. */
export const POTENTIAL_CELL_PADDING_RIGHT = 3.5;

/**
 * Fixed column widths. The name column is the only flexible one and pays for
 * the rest; on a 440pt phone it keeps 133pt, against the 95pt the longest line
 * measured in it actually uses.
 */
export const REGISTER_COLUMN_WIDTH = {
  phone: { role: 52, overall: 52, potential: 48, condition: 64 },
  wide: { role: 52, overall: 72, potential: 112, condition: 112 },
} as const;

/**
 * Width a header needs: its label at the size cap, its arrow, and the gap
 * between them. The arrow is only drawn while the column is the sorted one,
 * but the column is sized as though it always is — a header that fits until
 * you tap it does not fit.
 */
export function headerWidthDemand(label: string, fontSize: number): number {
  const advanceEm = HEADER_LABEL_ADVANCE_EM[label];
  if (advanceEm === undefined) {
    throw new Error(`No measured Silkscreen advance for the header "${label}"`);
  }
  return (
    advanceEm * fontSize * HEADER_MAX_FONT_MULTIPLIER +
    SORT_ARROW_GAP +
    SORT_ARROW_WIDTH
  );
}
