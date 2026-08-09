import {
  CROWD_SPRITE_IDS,
  CUP_ROW_SPRITE_IDS,
  CUP_SPRITE_IDS,
  FINANCE_PALETTE,
  MERCH_TOY_IDS,
  financeSpriteRows,
  financeSpriteRuns,
  pickMerchToys,
} from '../finance-pixel-art';

describe('finance pixel art', () => {
  it('every sprite is a 16x16 grid over known palette keys', () => {
    for (const id of [
      ...CROWD_SPRITE_IDS,
      ...CUP_SPRITE_IDS,
      ...MERCH_TOY_IDS,
    ]) {
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

  it('draws the cup cabinet as five sprites, grand one in the middle', () => {
    // Same count as the crowd, so a cup card and a league card are one width.
    expect(CUP_ROW_SPRITE_IDS).toHaveLength(CROWD_SPRITE_IDS.length);
    expect(CUP_ROW_SPRITE_IDS[2]).toBe('cup-grand');
    expect(CUP_ROW_SPRITE_IDS[0]).toBe(CUP_ROW_SPRITE_IDS[4]);
    expect(CUP_ROW_SPRITE_IDS[1]).toBe(CUP_ROW_SPRITE_IDS[3]);
    expect(new Set(CUP_ROW_SPRITE_IDS)).toEqual(new Set(CUP_SPRITE_IDS));
  });

  it('stands every cup on the same shelf line', () => {
    // A row of cups floating at different heights reads as three objects, not
    // a cabinet: each sprite's last inked row must be the same.
    const baselines = CUP_SPRITE_IDS.map((id) =>
      financeSpriteRows(id).reduce(
        (lowest, row, y) => (row.replace(/\./g, '') === '' ? lowest : y),
        -1,
      ),
    );
    expect(new Set(baselines).size).toBe(1);
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
