import portraitData from '../portraits.json';
import spriteData from '../sprites.json';
import manifest from '../player-look-manifest.json';
import { playerLookId } from '../player-look';
import { FIELD_PLAYER_LOOK_COUNT, GOALKEEPER_LOOK_COUNT } from '../../../game/player-appearance';

const sheet = portraitData as {
  cell: { w: number; h: number };
  palette: Record<string, string | null>;
  sprites: Record<string, string[]>;
};
const matchSheet = spriteData as { sprites: Record<string, string[]> };
const IDS = [...manifest.field, ...manifest.goalkeeper];
const EXPRESSIONS = ['rest', 'joy', 'ko'] as const;

describe('career player portrait roster', () => {
  it('ships 193 distinct looks with all three expressions', () => {
    expect(manifest.field).toHaveLength(168);
    expect(manifest.goalkeeper).toHaveLength(25);
    expect(manifest.field).toHaveLength(FIELD_PLAYER_LOOK_COUNT);
    expect(manifest.goalkeeper).toHaveLength(GOALKEEPER_LOOK_COUNT);
    expect(IDS).toHaveLength(193);
    expect(Object.keys(sheet.sprites)).toHaveLength(579);
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

  it('ships the six reviewed Asian redesigns with light skin and visible-tooth smiles', () => {
    const reviewed = ['f05', 'f74', 'f81', 'f82', 'f110', 'f134'];
    const toothSmiles = ['f05', 'f81', 'f82', 'f110'];
    const resting = reviewed.map(id => sheet.sprites[`${id}:rest`]);
    expect(new Set(resting.map(rows => JSON.stringify(rows))).size).toBe(reviewed.length);
    for (const rows of resting) {
      expect(rows.slice(3, 16).join('')).toMatch(/[SL]/);
      expect(rows.slice(0, 7).join('')).not.toMatch(/[HJ]/);
    }
    for (const id of toothSmiles) {
      expect(sheet.sprites[`${id}:rest`][12]).toContain('W');
      expect(matchSheet.sprites[`r:${id}:run0`][12]).toContain('W');
    }
  });

  it('keeps vivid dyes intentional and bleach-blond or silver treatments scarce', () => {
    const head = (id: string) => sheet.sprites[`${id}:rest`].slice(0, 7).join('');
    for (const id of ['f29', 'f75']) expect(head(id)).toMatch(/[BC]/);
    for (const id of ['f33', 'f124']) expect(head(id)).toContain('T');
    for (const id of ['f27', 'f92', 'f135']) expect(head(id)).toMatch(/[RE]/);
    expect(head('f64')).toContain('F');
    for (const id of ['f23', 'f65', 'f95']) expect(head(id)).toMatch(/[AJW]/);
    for (const id of ['f45', 'f89', 'f125']) expect(head(id)).toMatch(/[gGW]/);
  });

  it('adds 20 historical and nine current-football silhouette homages', () => {
    const historical = [
      ...Array.from({ length: 19 }, (_, offset) => `f${140 + offset}`),
      'g24',
    ];
    const current = Array.from({ length: 9 }, (_, offset) => `f${159 + offset}`);
    expect(historical).toHaveLength(20);
    expect(current).toHaveLength(9);
    for (const id of [...historical, ...current]) {
      expect(sheet.sprites).toHaveProperty(`${id}:rest`);
      expect(sheet.sprites).toHaveProperty(`${id}:joy`);
      expect(sheet.sprites).toHaveProperty(`${id}:ko`);
    }
    const resting = [...historical, ...current].map(id => JSON.stringify(sheet.sprites[`${id}:rest`]));
    expect(new Set(resting).size).toBe(29);
    expect(sheet.sprites['f157:rest'].slice(5, 16).join('')).toContain('W');
    expect(sheet.sprites['f165:rest'].slice(0, 7).join('')).toMatch(/[AJW]/);
  });
});
