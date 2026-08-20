import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PORTRAIT_JERSEY_BAND,
  portraitPixelRuns,
  type PortraitSheet,
} from '../pixel-portrait-model';
import { clubKitPlan, swatchById } from '../../render/sprites/club-kit';

const sheet = JSON.parse(
  readFileSync(
    join(process.cwd(), 'src/render/sprites/portraits.json'),
    'utf8',
  ),
) as PortraitSheet;

const rows = sheet.sprites['f00:rest'];
const forest = swatchById('FOREST')!.ramp;
const stone = swatchById('STONE')!.ramp;
const striped = clubKitPlan({
  kit: { base: 'FOREST', pattern: 'STRIPES', patternColor: 'STONE' },
  userSide: 'r',
  colorSafeKits: false,
}).r;

const colorsOn = (row: number, runs: ReturnType<typeof portraitPixelRuns>) =>
  new Set(runs.filter((run) => run.y === row).map((run) => run.color));

describe('portraits wear the club kit', () => {
  it('paints the shirt in the chosen ramp', () => {
    const runs = portraitPixelRuns(sheet, rows, 'f00', striped);
    const shirt = colorsOn(PORTRAIT_JERSEY_BAND.top + 4, runs);
    expect(shirt.has(forest[1])).toBe(true);
    expect(shirt.has('#e8433f')).toBe(false);
  });

  it('carries both colours of a stripe on one row', () => {
    const runs = portraitPixelRuns(sheet, rows, 'f00', striped);
    const shirt = colorsOn(PORTRAIT_JERSEY_BAND.top + 4, runs);
    expect(shirt.has(forest[1])).toBe(true);
    expect(shirt.has(stone[1])).toBe(true);
  });

  /**
   * The band is what keeps a kit off a face. Portrait rows 0-15 are hair, eyes
   * and skin, and some looks paint those in kit tokens.
   */
  it('leaves everything above the shoulders alone', () => {
    const plain = portraitPixelRuns(sheet, rows, 'f00');
    const kitted = portraitPixelRuns(sheet, rows, 'f00', striped);
    const above = (runs: ReturnType<typeof portraitPixelRuns>) =>
      runs.filter((run) => run.y < PORTRAIT_JERSEY_BAND.top);
    expect(above(kitted)).toEqual(above(plain));
  });

  it('draws the stock strip when no kit is given', () => {
    const runs = portraitPixelRuns(sheet, rows, 'f00');
    expect(colorsOn(PORTRAIT_JERSEY_BAND.top + 4, runs).has('#e8433f')).toBe(
      true,
    );
  });

  /**
   * Runs collapse on the resolved colour, not on the token: collapsing by token
   * would paint a whole stripe pair in whichever colour came first.
   */
  it('never merges two stripe colours into one run', () => {
    for (const run of portraitPixelRuns(sheet, rows, 'f00', striped)) {
      if (run.y < PORTRAIT_JERSEY_BAND.top) continue;
      if (run.color !== forest[1] && run.color !== stone[1]) continue;
      expect(run.width).toBeLessThanOrEqual(2);
    }
  });
});
