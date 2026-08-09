import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { allOffenders, offendersIn } from '../hardcoded-prose';

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
const MAX_REMAINING = 0;

test('hardcoded player-facing prose only ever decreases', () => {
  const remaining = allOffenders().length;

  // eslint-disable-next-line no-console
  console.log(
    `hardcoded prose remaining: ${remaining} (ceiling ${MAX_REMAINING})`,
  );
  expect(remaining).toBeLessThanOrEqual(MAX_REMAINING);
});

test('the scanner rejects new visible source prose', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hfm-hardcoded-prose-'));
  const file = join(dir, 'BadSurface.tsx');
  try {
    writeFileSync(
      file,
      'export const BadSurface = () => <Text>Uncatalogued player copy</Text>;',
    );
    expect(offendersIn(file)).toEqual([
      expect.objectContaining({ text: 'Uncatalogued player copy' }),
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
