import {
  FORM_ART_SIZE,
  FORM_CELL_GAP,
  FORM_CELL_SIZE,
  FORM_STRIP_CASCADE_MS,
  FORM_STRIP_MAX,
  TROPHY_GRID,
  TROPHY_RUNS,
  formCellEnterDelay,
  formStripCapacity,
  formStripWidthEstimate,
  visibleForm,
} from '../form-strip';

const phone = (screenWidth: number) => formStripCapacity(formStripWidthEstimate(screenWidth));

describe('form strip capacity', () => {
  it('never renders a clipped cell', () => {
    expect(formStripCapacity(FORM_CELL_SIZE - 1)).toBe(0);
    expect(formStripCapacity(FORM_CELL_SIZE)).toBe(1);
    // One cell plus a gap is still one cell — the second needs its own width.
    expect(formStripCapacity(FORM_CELL_SIZE + FORM_CELL_GAP)).toBe(1);
    expect(formStripCapacity(FORM_CELL_SIZE * 2 + FORM_CELL_GAP)).toBe(2);
  });

  it('fills a phone row', () => {
    expect(phone(320)).toBe(9); // iPhone SE
    expect(phone(375)).toBe(10); // iPhone 13 mini
    expect(phone(390)).toBe(11); // iPhone 15
    expect(phone(430)).toBe(12); // iPhone 15 Pro Max
  });

  it('caps a desktop row at a season rather than at the pixels available', () => {
    expect(formStripCapacity(1024)).toBe(FORM_STRIP_MAX);
    expect(formStripCapacity(4000)).toBe(FORM_STRIP_MAX);
  });
});

describe('width estimate, for the frame before the strip has measured itself', () => {
  it('matches the phone measurement exactly, so nothing shifts once it lands', () => {
    expect(formStripWidthEstimate(375)).toBe(343);
    expect(formStripWidthEstimate(390)).toBe(358);
  });

  it('guesses low on a wide window, where the cap decides anyway', () => {
    expect(formStripWidthEstimate(2000)).toBeLessThan(2000);
    expect(formStripCapacity(formStripWidthEstimate(2000))).toBe(FORM_STRIP_MAX);
  });

  it('survives a window that has not reported a size', () => {
    expect(formStripCapacity(formStripWidthEstimate(Number.NaN))).toBe(0);
    expect(formStripCapacity(formStripWidthEstimate(0))).toBe(0);
  });
});

describe('visibleForm', () => {
  const form = ['W', 'L', 'D', 'W', 'W'] as const;

  it('keeps the newest results when the row cannot hold them all', () => {
    expect(visibleForm(form, 3)).toEqual(['D', 'W', 'W']);
  });

  it('shows everything it has when the row is longer than the record', () => {
    expect(visibleForm(form, 12)).toEqual(form);
  });

  it('renders nothing at zero capacity', () => {
    expect(visibleForm(form, 0)).toEqual([]);
  });
});

describe('cascade timing', () => {
  it('deals left to right so the newest result lands last', () => {
    expect(formCellEnterDelay(0, 9)).toBe(0);
    expect(formCellEnterDelay(8, 9)).toBe(FORM_STRIP_CASCADE_MS);
    expect(formCellEnterDelay(4, 9)).toBeLessThan(formCellEnterDelay(5, 9));
  });

  it('takes the same total time whatever the row holds', () => {
    expect(formCellEnterDelay(FORM_STRIP_MAX - 1, FORM_STRIP_MAX)).toBe(FORM_STRIP_CASCADE_MS);
  });

  it('does not stall a lone result', () => {
    expect(formCellEnterDelay(0, 1)).toBe(0);
  });
});

describe('trophy sprite', () => {
  it('scales to whole points inside a cell, so no row grows a seam', () => {
    expect(FORM_ART_SIZE % TROPHY_GRID).toBe(0);
  });

  it('is a square grid of run-length rows', () => {
    expect(TROPHY_RUNS.length).toBeGreaterThan(0);
    for (const run of TROPHY_RUNS) {
      expect(run.x).toBeGreaterThanOrEqual(0);
      expect(run.x + run.width).toBeLessThanOrEqual(TROPHY_GRID);
      expect(run.y).toBeLessThan(TROPHY_GRID);
    }
  });

  it('keeps an unbroken ink outline along the bottom of the base', () => {
    const base = TROPHY_RUNS.filter(run => run.y === TROPHY_GRID - 1);
    expect(base).toHaveLength(1);
    expect(base[0].color).toBe('#241f2e');
    expect(base[0].width).toBe(8);
  });
});
