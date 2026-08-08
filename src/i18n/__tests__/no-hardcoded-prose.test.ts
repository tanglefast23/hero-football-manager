import { allOffenders } from '../hardcoded-prose';

/**
 * Player-facing prose must live in the catalog, not in a component.
 *
 * The scan itself is `src/i18n/hardcoded-prose.ts` — see its header for what
 * this gate used to miss and why it read zero while ~2.1k strings were still
 * hardcoded.
 *
 * A ratchet, not an assertion, while the extraction is in flight: the count is
 * the honest measure of how much copy is still in the source, and `MAX_REMAINING`
 * is what stops it going back up. It returns to a hard zero when the sweep ends.
 */
const MAX_REMAINING = 71;

test('hardcoded player-facing prose only ever decreases', () => {
  const remaining = allOffenders().length;

  // eslint-disable-next-line no-console
  console.log(`hardcoded prose remaining: ${remaining} (ceiling ${MAX_REMAINING})`);
  expect(remaining).toBeLessThanOrEqual(MAX_REMAINING);
});
