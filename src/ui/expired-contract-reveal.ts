/**
 * How much of the section has to be showing before it counts as reached.
 *
 * Its eyebrow and title occupy roughly this much, so the lesson waits for the
 * words EXPIRED CONTRACT to be readable rather than firing on the first pixel
 * of the block's top margin.
 */
export const EXPIRED_CONTRACT_REVEAL_MARGIN = 72;

export interface ExpiredContractRevealGeometry {
  /** The section's offset inside the scroll content, from its own onLayout. */
  readonly sectionTop: number | undefined;
  /** How tall the scroll viewport is. Zero until either layout has reported. */
  readonly viewportHeight: number;
  /** How far the review has been scrolled. */
  readonly scrollOffset: number;
}

/**
 * Whether the renewal queue is genuinely on screen.
 *
 * A free function rather than logic inside the screen because the screen cannot
 * be imported by the test suite — `testEnvironment` is `node` and
 * `require('react-native')` throws there — and the arithmetic is the part that
 * can be quietly wrong. Inlined, a sign error would still ship: the callback
 * would fire on mount, Bert would arrive over the league table, and nothing
 * would fail.
 *
 * Both unmeasured states answer false. A section that has not laid out has no
 * position to compare, and a viewport of zero height shows nothing at all — an
 * early call during mount must not be read as "the whole page is visible".
 */
export function isExpiredContractRevealed(
  geometry: ExpiredContractRevealGeometry,
): boolean {
  const { sectionTop, viewportHeight, scrollOffset } = geometry;
  if (sectionTop === undefined || viewportHeight <= 0) return false;
  return sectionTop <= scrollOffset + viewportHeight - EXPIRED_CONTRACT_REVEAL_MARGIN;
}
