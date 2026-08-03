export const HEADER_SEPARATOR = ' · ';

export interface ManagementHeaderLine {
  /** What the HUD paints. Trimmed to survive a 375pt phone at full size. */
  readonly visible: string;
  /** The untrimmed line, for `accessibilityLabel`. */
  readonly spoken: string;
}

/**
 * The persistent season/week line at the top of the management shell.
 *
 * `seasonLabel` arrives as `Season 4 · D2 · Provincial League`, and with the
 * week appended the whole line wanted 452pt inside a 351pt box on a 375pt
 * phone. iOS hides that — `adjustsFontSizeToFit` shrinks the text — but
 * react-native-web does not implement that prop at all, so the web build
 * clipped the line and dropped the week counter, the one fact on it that
 * changes every turn.
 *
 * Shrinking further is the wrong answer: this is persistent chrome already at
 * the small end of the type scale. So the visible line drops the division's
 * tier NAME and keeps its rung. The name is not lost — the Home screen's next
 * fixture card and the League tab both state it in full, and the untrimmed
 * line is still what assistive technology reads.
 */
export function managementHeaderLine(
  seasonLabel: string,
  weekLabel: string,
): ManagementHeaderLine {
  const spoken = `${seasonLabel}${HEADER_SEPARATOR}${weekLabel}`;
  const parts = seasonLabel.split(HEADER_SEPARATOR);
  // Only a season-plus-rung-plus-name label has anything to give up. Anything
  // shorter is already at its minimum and is passed through untouched.
  const trimmed = parts.length >= 3 ? parts.slice(0, -1).join(HEADER_SEPARATOR) : seasonLabel;
  return { visible: `${trimmed}${HEADER_SEPARATOR}${weekLabel}`, spoken };
}
