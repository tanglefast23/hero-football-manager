import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CROWD_SPRITE_IDS,
  FINANCE_SPRITE_CELL,
  financeSpriteRows,
} from '../finance-pixel-art';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/**
 * Fans price the home gate and the merchandise, so the number belongs in the
 * HUD beside the money it earns rather than only on the Club office's books.
 */
describe('the HUD fans chip', () => {
  const shell = read('src/ui/ManagementShell.tsx');
  const glyph = read('src/ui/components/FansGlyph.tsx');
  const models = read('src/ui/models.ts');
  const viewModels = read('src/application/view-models.ts');

  it('rides beside money and TP, drawn rather than lettered', () => {
    expect(shell).toContainSource('<ResourceChip icon={<FansGlyph />}');
    expect(shell).toContainSource('value={resources.fans}');
    // The three chips share one cluster, in this order.
    const cluster = shell.slice(
      shell.indexOf('const resourceCluster = ('),
      shell.indexOf('return (\n    <SafeAreaView'),
    );
    expect(cluster.indexOf('glyph="$"')).toBeLessThan(
      cluster.indexOf('glyph="TP"'),
    );
    expect(cluster.indexOf('glyph="TP"')).toBeLessThan(
      cluster.indexOf('<FansGlyph />'),
    );
  });

  it('renders a negative cash value and its dollar glyph in red', () => {
    expect(shell).toContainSource(
      'const negativeMoney = money && shownValue < 0;',
    );
    expect(shell).toContainSource(
      "negativeMoney ? 'font-pixel text-xs text-red-dark' : 'font-pixel text-xs text-blue-dark'",
    );
    expect(shell).toContainSource(
      "negativeMoney ? 'font-mono text-sm text-red-dark' : 'font-mono text-sm text-ink'",
    );
  });

  it('carries fans on the same summary the other two figures come from', () => {
    expect(models).toMatchSource(
      /ResourceSummaryViewModel \{[\s\S]{0,400}fans: number;/,
    );
    // Every construction site fills it, or the chip renders undefined.
    const built = viewModels.match(
      /trainingPoints: state\.trainingPoints,\n {6}fans: /g,
    );
    expect(built).toHaveLength(3);
  });

  it('draws two of the report crowd, overlapping without merging their outlines', () => {
    expect(glyph).toContainSource(
      "const PAIR: readonly FinanceSpriteId[] = ['fan-cheer-b', 'fan-cheer-d'];",
    );
    expect(glyph).toContainSource('const OVERLAP_COLUMNS = 7;');
    for (const id of ['fan-cheer-b', 'fan-cheer-d'] as const) {
      expect(CROWD_SPRITE_IDS).toContainSource(id);
    }
  });

  /**
   * The measurement behind OVERLAP_COLUMNS: at a tighter shift the two heads'
   * top outline rows butt together into one unbroken bar, which at 16px reads
   * as a single wide creature rather than two people.
   */
  it('keeps a break between the two heads at the chosen shift', () => {
    const back = financeSpriteRows('fan-cheer-b');
    const front = financeSpriteRows('fan-cheer-d');

    const headRowGaps = (shift: number): number => {
      const headRow = 2; // the first row of the head outline in both sprites
      const merged = Array.from(
        { length: FINANCE_SPRITE_CELL + shift },
        () => '.',
      );
      for (const [offset, rows] of [
        [0, back],
        [shift, front],
      ] as const) {
        [...rows[headRow]].forEach((cell, x) => {
          if (cell !== '.') merged[offset + x] = cell;
        });
      }
      // Gaps strictly inside the drawn span — the empty margins do not count.
      const first = merged.findIndex((cell) => cell !== '.');
      const last =
        merged.length -
        1 -
        [...merged].reverse().findIndex((cell) => cell !== '.');
      return merged.slice(first, last + 1).filter((cell) => cell === '.')
        .length;
    };

    expect(headRowGaps(7)).toBeGreaterThan(0);
    expect(headRowGaps(6)).toBe(0);
  });
});
