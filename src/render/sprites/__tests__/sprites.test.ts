import { ATLAS_GUTTER, loadSpriteSheet, atlasLayout } from '../loader';
import { spriteKeyForMatchSlot } from '../slot-key';
import { SLIDE_TACKLE_CELL, SLIDE_TACKLE_FRAME_COUNT, slideTackleSpriteFrame } from '../slide-tackle';

const IDS = ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10',
  'u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'];
const EXPECTED_KEYS = IDS.flatMap((id) => [`${id}:run0`, `${id}:run1`])
  .concat(['r0:ready0', 'r0:ready1', 'u0:ready0', 'u0:ready1', 'ball']);
const EXPECTED_SLIDE_KEYS = IDS.flatMap(id => (
  Array.from({ length: SLIDE_TACKLE_FRAME_COUNT }, (_, frame) => `${id}:${slideTackleSpriteFrame(frame)}`)
));

describe('sprites.json', () => {
  it('maps arbitrary career players onto the fixed home and away visual slots', () => {
    expect(spriteKeyForMatchSlot(0, 'ready0')).toBe('r0:ready0');
    expect(spriteKeyForMatchSlot(10, 'run1')).toBe('r10:run1');
    expect(spriteKeyForMatchSlot(11, 'ready1')).toBe('u0:ready1');
    expect(spriteKeyForMatchSlot(21, 'run0')).toBe('u10:run0');
    expect(() => spriteKeyForMatchSlot(22, 'run0')).toThrow('0 to 21');
  });
  it('loads and validates without throwing', () => {
    expect(() => loadSpriteSheet()).not.toThrow();
  });

  it('contains base frames plus ten derived slide-tackle frames for every visual slot', () => {
    const sheet = loadSpriteSheet();
    expect(EXPECTED_KEYS).toHaveLength(49);
    for (const key of [...EXPECTED_KEYS, ...EXPECTED_SLIDE_KEYS]) {
      expect(sheet.sprites).toHaveProperty(key);
    }
    expect(Object.keys(sheet.sprites)).toHaveLength(49 + IDS.length * SLIDE_TACKLE_FRAME_COUNT);
  });

  it('keeps base players at 24x30 while derived tackle poses use their approved 34x30 cell', () => {
    const sheet = loadSpriteSheet();
    for (const [key, rows] of Object.entries(sheet.sprites)) {
      const slideFrame = /:slide\d+$/.test(key);
      const expected = key === 'ball' ? 6 : slideFrame ? SLIDE_TACKLE_CELL.w : sheet.cell.w;
      expect(rows).toHaveLength(key === 'ball' ? 6 : slideFrame ? SLIDE_TACKLE_CELL.h : sheet.cell.h);
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

  it('gives each goalkeeper two distinct crouched ready poses', () => {
    const sheet = loadSpriteSheet();
    for (const id of ['r0', 'u0']) {
      expect(sheet.sprites[`${id}:ready0`]).not.toEqual(sheet.sprites[`${id}:run0`]);
      expect(sheet.sprites[`${id}:ready1`]).not.toEqual(sheet.sprites[`${id}:run0`]);
      expect(sheet.sprites[`${id}:ready0`]).not.toEqual(sheet.sprites[`${id}:ready1`]);
    }
  });

  describe('atlasLayout', () => {
    it('uses a fixed 8-column grid', () => {
      const sheet = loadSpriteSheet();
      const layout = atlasLayout(sheet);
      expect(layout.cols).toBe(8);
      expect(layout.rows).toBe(Math.ceil(Object.keys(sheet.sprites).length / 8));
    });

    it('produces rects that stay within the atlas bounds', () => {
      const sheet = loadSpriteSheet();
      const layout = atlasLayout(sheet);
      const atlasW = layout.cols * layout.slotW;
      const atlasH = layout.rows * layout.slotH;
      for (const key of Object.keys(sheet.sprites)) {
        const r = layout.rectFor(key);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(atlasW);
        expect(r.y + r.h).toBeLessThanOrEqual(atlasH);
      }
    });

    it('keeps a transparent gutter between neighbouring sprite cells', () => {
      const sheet = loadSpriteSheet();
      const layout = atlasLayout(sheet);
      const rects = Object.keys(sheet.sprites).map((key) => layout.rectFor(key));
      const uniqueColumns = [...new Set(rects.map((rect) => rect.x))].sort((a, b) => a - b);
      expect(uniqueColumns[1] - uniqueColumns[0]).toBe(layout.slotW);
      expect(uniqueColumns[0]).toBe(ATLAS_GUTTER);
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
      // Row index 16 is the sprite's shoulder line / first torso row at 24x30
      // (rows: 0-1 hair, 2-14 head, 15 neck, 16-23 torso, 24-25 shorts,
      // 26-27 legs, 28 socks, 29 boots).
      const SHOULDER_ROW = 16;
      const countPainted = (row: string) => [...row].filter((ch) => ch !== '.').length;
      const rexShoulders = countPainted(sheet.sprites['u3:run0'][SHOULDER_ROW]);
      const aliShoulders = countPainted(sheet.sprites['u1:run0'][SHOULDER_ROW]);
      expect(rexShoulders).toBeGreaterThan(aliShoulders);
    });
  });
});
