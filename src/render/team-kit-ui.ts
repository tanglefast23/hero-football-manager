/**
 * Match team colours in the HUD. Home is bible red — or hero amber when
 * color-safe kits are on — and away is always bible blue, which is the
 * "high-separation blue and amber pairing" the accessibility setting promises.
 *
 * These are the same three tokens MatchScreen already used for its fallback
 * sprite tints; naming them here keeps the possession card and the pitch
 * agreeing on which team is which.
 */
export const HOME_KIT_COLOR = '#d94f52';
export const HOME_KIT_COLOR_SAFE = '#edb54a';
export const AWAY_KIT_COLOR = '#5a8fd6';

export function teamKitColor(team: 0 | 1, colorSafeKits: boolean): string {
  if (team === 1) return AWAY_KIT_COLOR;
  return colorSafeKits ? HOME_KIT_COLOR_SAFE : HOME_KIT_COLOR;
}

/**
 * Ink, not cream, for copy sitting on a solid kit panel. Cream reads at only
 * 1.7:1 on hero amber; ink clears 8.6:1 there and 4.8:1 on the away blue, so
 * one dark text token serves every kit instead of switching per team.
 */
export const KIT_PANEL_TEXT_COLOR = '#241f2e';

/** Panels on a bright kit colour take the HUD's standard ink pixel frame. */
export const KIT_PANEL_BORDER_COLOR = '#241f2e';
