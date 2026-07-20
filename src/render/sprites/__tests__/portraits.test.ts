import portraitData from '../portraits.json';
import spriteData from '../sprites.json';
import manifest from '../player-look-manifest.json';
import { playerLookId } from '../player-look';

const sheet = portraitData as {
  cell: { w: number; h: number };
  palette: Record<string, string | null>;
  sprites: Record<string, string[]>;
};
const matchSheet = spriteData as { sprites: Record<string, string[]> };
const IDS = [...manifest.field, ...manifest.goalkeeper];
const EXPRESSIONS = ['rest', 'joy', 'ko'] as const;

describe('career player portrait roster', () => {
  it('ships 96 distinct looks with all three expressions', () => {
    expect(manifest.field).toHaveLength(72);
    expect(manifest.goalkeeper).toHaveLength(24);
    expect(IDS).toHaveLength(96);
    expect(Object.keys(sheet.sprites)).toHaveLength(288);
    const resting = IDS.map(id => JSON.stringify(sheet.sprites[`${id}:rest`]));
    expect(new Set(resting).size).toBe(IDS.length);
    for (const id of IDS) {
      const expressions = EXPRESSIONS.map(expression => sheet.sprites[`${id}:${expression}`]);
      expect(expressions.every(Boolean)).toBe(true);
      expect(new Set(expressions.map(rows => JSON.stringify(rows))).size).toBe(3);
    }
  });

  it('keeps every portrait at the art-bible 24x29 cell and palette budget', () => {
    expect(sheet.cell).toEqual({ w: 24, h: 29 });
    expect(Object.keys(sheet.palette).length).toBeLessThanOrEqual(24);
    for (const rows of Object.values(sheet.sprites)) {
      expect(rows).toHaveLength(29);
      for (const row of rows) {
        expect(row).toHaveLength(24);
        for (const token of row) expect(token in sheet.palette).toBe(true);
      }
    }
  });

  it('uses the exact same head for management portraits and match sprites', () => {
    for (const id of IDS) {
      expect(sheet.sprites[`${id}:rest`].slice(0, 15))
        .toEqual(matchSheet.sprites[`r:${id}:run0`].slice(0, 15));
    }
  });

  it('maps every player ID deterministically while preserving the named cast', () => {
    expect(playerLookId('r0', 'GK')).toBe('g00');
    expect(playerLookId('u0', 'GK')).toBe('g01');
    expect(playerLookId('r9', 'FWD')).toBe('f08');
    expect(playerLookId('u3', 'DEF')).toBe('f12');
    expect(playerLookId('academy-s3-7', 'MID')).toBe(playerLookId('academy-s3-7', 'MID'));
    expect(manifest.field).toContain(playerLookId('academy-s3-7', 'MID'));
    expect(manifest.goalkeeper).toContain(playerLookId('academy-keeper', 'GK'));
  });

  it('keeps Dario Flint fire-tipped in every expression', () => {
    const fireToken = Object.entries(sheet.palette).find(([, hex]) => hex === '#ff6a00')?.[0];
    expect(fireToken).toBeDefined();
    for (const expression of EXPRESSIONS) {
      expect(sheet.sprites[`f08:${expression}`].some(row => row.includes(fireToken!))).toBe(true);
    }
  });
});
