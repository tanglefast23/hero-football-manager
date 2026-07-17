import { loadSpriteSheet, atlasLayout } from '../loader';

const IDS = ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10',
  'u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'];
const EXPECTED_KEYS = IDS.flatMap((id) => [`${id}:run0`, `${id}:run1`]).concat(['ball']);

describe('sprites.json', () => {
  it('loads and validates without throwing', () => {
    expect(() => loadSpriteSheet()).not.toThrow();
  });

  it('contains all 44 player frames plus the ball (45 keys total)', () => {
    const sheet = loadSpriteSheet();
    expect(EXPECTED_KEYS).toHaveLength(45);
    for (const key of EXPECTED_KEYS) {
      expect(sheet.sprites).toHaveProperty(key);
    }
    expect(Object.keys(sheet.sprites)).toHaveLength(45);
  });

  it('every sprite row is exactly the expected width (16 for players, 6 for ball)', () => {
    const sheet = loadSpriteSheet();
    for (const [key, rows] of Object.entries(sheet.sprites)) {
      const expected = key === 'ball' ? 6 : sheet.cell.w;
      expect(rows).toHaveLength(key === 'ball' ? 6 : sheet.cell.h);
      for (const row of rows) {
        expect(row).toHaveLength(expected);
      }
    }
  });

  it('every character used in every sprite row exists in the palette', () => {
    const sheet = loadSpriteSheet();
    for (const [key, rows] of Object.entries(sheet.sprites)) {
      for (const row of rows) {
        for (const ch of row) {
          expect(ch in sheet.palette).toBe(true);
        }
      }
    }
  });

  it('palette stays within the 24-color budget', () => {
    const sheet = loadSpriteSheet();
    expect(Object.keys(sheet.palette).length).toBeLessThanOrEqual(24);
  });

  describe('atlasLayout', () => {
    it('uses a fixed 8-column grid', () => {
      const sheet = loadSpriteSheet();
      const layout = atlasLayout(sheet);
      expect(layout.cols).toBe(8);
      expect(layout.rows).toBe(Math.ceil(45 / 8));
    });

    it('produces rects that stay within the atlas bounds', () => {
      const sheet = loadSpriteSheet();
      const layout = atlasLayout(sheet);
      const atlasW = layout.cols * sheet.cell.w;
      const atlasH = layout.rows * sheet.cell.h;
      for (const key of Object.keys(sheet.sprites)) {
        const r = layout.rectFor(key);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(atlasW);
        expect(r.y + r.h).toBeLessThanOrEqual(atlasH);
      }
    });

    it('produces non-overlapping rects for every sprite pair', () => {
      const sheet = loadSpriteSheet();
      const layout = atlasLayout(sheet);
      const keys = Object.keys(sheet.sprites);
      const rects = keys.map((k) => layout.rectFor(k));
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          const overlaps = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlaps).toBe(false);
        }
      }
    });

    it('is deterministic across repeated calls', () => {
      const sheet = loadSpriteSheet();
      const a = atlasLayout(sheet).rectFor('r9:run0');
      const b = atlasLayout(sheet).rectFor('r9:run0');
      expect(a).toEqual(b);
    });
  });

  describe('stars are visually distinct', () => {
    it('Dario Flint (r9) uses the fire-tip color #ff6a00 somewhere in his hair', () => {
      const sheet = loadSpriteSheet();
      const fireChar = Object.entries(sheet.palette).find(([, hex]) => hex === '#ff6a00')?.[0];
      expect(fireChar).toBeDefined();
      const usesFire = [...sheet.sprites['r9:run0'], ...sheet.sprites['r9:run1']].some((row) =>
        row.includes(fireChar as string)
      );
      expect(usesFire).toBe(true);
    });

    it('Rex Bould (u3, muscular) has visibly wider shoulders than Ali Frost (u1, normal build)', () => {
      const sheet = loadSpriteSheet();
      // Row index 9 is the sprite's first torso row (rows: 0 margin, 1-8 head,
      // 9-14 torso, 15 shorts, 16-17 legs, 18-19 boots) — i.e. the shoulder row.
      const SHOULDER_ROW = 9;
      const countPainted = (row: string) => [...row].filter((ch) => ch !== '.').length;
      const rexShoulders = countPainted(sheet.sprites['u3:run0'][SHOULDER_ROW]);
      const aliShoulders = countPainted(sheet.sprites['u1:run0'][SHOULDER_ROW]);
      expect(rexShoulders).toBeGreaterThan(aliShoulders);
    });
  });
});
