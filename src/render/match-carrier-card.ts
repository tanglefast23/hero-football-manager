/**
 * Possession-card geometry — the kit-coloured panel that names whoever has the
 * ball, with their energy bar and a hero's Heat strip under it.
 *
 * Pure and separate from the stylesheet so the cap below can be tested: the
 * stylesheet imports react-native, which Jest does not transform here.
 */

const CARRIER_CARD_WIDTH = 150;
export const CARRIER_CARD_PADDING_X = 7;
// Standard HUD ink pixel frame — a solid kit-coloured panel needs it to hold
// its edge against the pitch, where the old 1pt cream hairline washed out.
export const CARRIER_CARD_BORDER = 2;
// The same card on a desktop window sits on a pitch several times the size and
// is read from sitting distance, where phone-sized 11pt names and a 6px bar
// vanish. Same geometry throughout, scaled ~1.7x.
const CARRIER_CARD_DESKTOP_WIDTH = 260;
export const CARRIER_CARD_DESKTOP_PADDING_X = 12;
/**
 * The card is pinned to a bottom corner of the pitch, so a fixed pixel width
 * eats a bigger share of a smaller pitch: on a narrow desktop window the 260px
 * desktop card reached the middle and sat on the goalkeeper. Capping it at a
 * share of the pitch keeps it short of the goal at every window size.
 */
const CARRIER_CARD_PITCH_SHARE = 0.32;
/** Below this the name has no room left, so the cap stops here. */
const CARRIER_CARD_MIN_WIDTH = 110;

/**
 * Card width, and the charge strip's content width, for one pitch width.
 *
 * The strip is built from real pixel bands rather than percentages, so it
 * needs the width inside the border and padding, not a fraction.
 */
export function carrierCardGeometry(
  pitchWidth: number,
  desktop: boolean,
): { width: number; contentWidth: number } {
  const base = desktop ? CARRIER_CARD_DESKTOP_WIDTH : CARRIER_CARD_WIDTH;
  const paddingX = desktop
    ? CARRIER_CARD_DESKTOP_PADDING_X
    : CARRIER_CARD_PADDING_X;
  const capped = Number.isFinite(pitchWidth)
    ? Math.round(pitchWidth * CARRIER_CARD_PITCH_SHARE)
    : base;
  const width = Math.max(CARRIER_CARD_MIN_WIDTH, Math.min(base, capped));
  return {
    width,
    contentWidth: width - (paddingX + CARRIER_CARD_BORDER) * 2,
  };
}
