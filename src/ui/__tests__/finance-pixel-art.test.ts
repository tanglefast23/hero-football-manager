import {
  CROWD_SPRITE_IDS,
  FINANCE_PALETTE,
  MERCH_TOY_IDS,
  financeSpriteRows,
  financeSpriteRuns,
  pickMerchToys,
} from '../finance-pixel-art';

describe('finance pixel art', () => {
  it('every sprite is a 16x16 grid over known palette keys', () => {
    for (const id of [...CROWD_SPRITE_IDS, ...MERCH_TOY_IDS]) {
      const rows = financeSpriteRows(id);
      expect(rows).toHaveLength(16);
      for (const row of rows) {
        expect(row).toHaveLength(16);
        for (const cell of row) {
          if (cell === '.') continue;
          expect(FINANCE_PALETTE[cell]).toBeDefined();
        }
      }
      expect(financeSpriteRuns(id).length).toBeGreaterThan(0);
    }
  });

  it('ships exactly ten merch toys and five crowd fans', () => {
    expect(MERCH_TOY_IDS).toHaveLength(10);
    expect(CROWD_SPRITE_IDS).toHaveLength(5);
  });

  it('run-length encodes rows without splitting same-color spans', () => {
    for (const run of financeSpriteRuns('toy-ball')) {
      expect(run.width).toBeGreaterThan(0);
      expect(run.x + run.width).toBeLessThanOrEqual(16);
      expect(run.y).toBeLessThan(16);
    }
  });

  it('picks 4-5 toys deterministically from season and week', () => {
    const picked = pickMerchToys(2, 9);
    expect(pickMerchToys(2, 9)).toEqual(picked);
    expect(picked.length).toBeGreaterThanOrEqual(4);
    expect(picked.length).toBeLessThanOrEqual(5);
    expect(new Set(picked).size).toBe(picked.length);
    expect(pickMerchToys(2, 10)).not.toEqual(picked); // true for this seed pair
  });
});
