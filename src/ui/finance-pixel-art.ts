import { mulberry32 } from '../sim/rng';

/**
 * 8-bit art for the Financial Report's surge banners: a cheering crowd strip
 * for EXTREME ATTENDANCE! and a shelf of club merchandise for TRENDING
 * MERCHANDISE! Sprites are 16x16 character grids over the docs/11 bible
 * palette, drawn with chunky ink outlines like the cast portraits — the same
 * format as `event-pixel-art.ts`.
 */

export const FINANCE_SPRITE_CELL = 16;
/** Scale 3: five 16-px fans at 4 would be 320 px wide and clip a phone card. */
export const FINANCE_SPRITE_SCALE = 3;

export const FINANCE_PALETTE: Readonly<Record<string, string>> = {
  K: '#241f2e',
  k: '#3a3350',
  W: '#ffffff',
  P: '#f4f1ea',
  D: '#d9d3e0',
  R: '#d94f52',
  r: '#a83440',
  E: '#f2938c',
  B: '#5a8fd6',
  b: '#3f6fb5',
  C: '#a3c8f0',
  G: '#edb54a',
  g: '#c8862a',
  L: '#f7d894',
  V: '#9a63d6',
  v: '#5b3a91',
  U: '#c9a6ec',
  T: '#5cb85c',
  t: '#3f8a4a',
  S: '#8fd98f',
  N: '#9a95a4',
  n: '#6b6675',
  M: '#c9c5d0',
  F: '#ff6a00',
  H: '#8a4f38',
  h: '#cf9268',
};

export const CROWD_SPRITE_IDS = [
  'fan-cheer-a',
  'fan-cheer-b',
  'fan-cheer-c',
  'fan-cheer-d',
  'fan-cheer-e',
] as const;

export const MERCH_TOY_IDS = [
  'toy-scarf',
  'toy-ball',
  'toy-foam-finger',
  'toy-bobblehead',
  'toy-plush-mascot',
  'toy-snow-globe',
  'toy-boot-keychain',
  'toy-jersey',
  'toy-card-pack',
  'toy-club-mug',
] as const;

export type FinanceSpriteId =
  | typeof CROWD_SPRITE_IDS[number]
  | typeof MERCH_TOY_IDS[number];

const SPRITE_ROWS: Readonly<Record<FinanceSpriteId, readonly string[]>> = {
  // -- The crowd: big-headed chibi fans, arms up, confetti overhead ---------
  'fan-cheer-a': [
    '..F.........G...',
    '................',
    '....KKKKKK......',
    '...KEEEEEEK.....',
    '...KEKEEKEK.....',
    '...KEEEEEEK.....',
    '....KEEEEK......',
    '.KE..KKKK..EK...',
    '.KEK.KRRK.KEK...',
    '..KEKRRRRKEK....',
    '...KRRRRRRK.....',
    '...KRWWRRRK.....',
    '....KRRRRK......',
    '....KK..KK......',
    '....KK..KK......',
    '................',
  ],
  'fan-cheer-b': [
    '......B....F....',
    '..G.............',
    '....KKKKKK......',
    '...KhhhhhhK.....',
    '...KhKhhKhK.....',
    '...KhhhhhhK.....',
    '....KhhhhK......',
    '.Kh..KKKK..hK...',
    '.KhK.KBBK.KhK...',
    '..KhKBBBBKhK....',
    '...KBBBBBBK.....',
    '...KBBWWBBK.....',
    '....KBBBBK......',
    '....KK..KK......',
    '....KK..KK......',
    '................',
  ],
  'fan-cheer-c': [
    '.R........G.....',
    '..........F.....',
    '....KKKKKK......',
    '...KEEEEEEK.....',
    '...KEKEEKEK.....',
    '...KEEKKEEK.....',
    '....KEEEEK......',
    '.KE..KKKK..EK...',
    '.KEK.KTTK.KEK...',
    '..KEKTTTTKEK....',
    '...KTTTTTTK.....',
    '...KTWWTTTK.....',
    '....KTTTTK......',
    '....KK..KK......',
    '....KK..KK......',
    '................',
  ],
  'fan-cheer-d': [
    '.....F.....R....',
    '.B..............',
    '....KKKKKK......',
    '...KhhhhhhK.....',
    '...KhKhhKhK.....',
    '...KhhhhhhK.....',
    '....KhhhhK......',
    '.Kh..KKKK..hK...',
    '.KhK.KGGK.KhK...',
    '..KhKGGGGKhK....',
    '...KGGGGGGK.....',
    '...KGWWGGGK.....',
    '....KGGGGK......',
    '....KK..KK......',
    '....KK..KK......',
    '................',
  ],
  'fan-cheer-e': [
    '...G.......B....',
    '.........F......',
    '....KKKKKK......',
    '...KEEEEEEK.....',
    '...KEKEEKEK.....',
    '...KEEEEEEK.....',
    '....KEEEEK......',
    '.KE..KKKK..EK...',
    '.KEK.KVVK.KEK...',
    '..KEKVVVVKEK....',
    '...KVVVVVVK.....',
    '...KVWWVVVK.....',
    '....KVVVVK......',
    '....KK..KK......',
    '....KK..KK......',
    '................',
  ],

  // -- The merchandise shelf ------------------------------------------------
  'toy-scarf': [
    '................',
    '..KKKK..........',
    '.KRRRRK.........',
    '.KWWWWK.........',
    '.KRRRRKKKKKK....',
    '.KWWWWRRRRRRK...',
    '.KRRRRWWWWWWK...',
    '..KKRRRRRRRRK...',
    '....KWWWWWWK....',
    '....KRRRRRRK....',
    '....KWWWWWWK....',
    '....KRRRRKK.....',
    '....KRRRK.......',
    '....KKKK........',
    '................',
    '................',
  ],
  'toy-ball': [
    '................',
    '................',
    '.....KKKKKK.....',
    '...KKWWWWWWKK...',
    '..KWWWKKWWWWWK..',
    '..KWWKKKKWWWWK..',
    '.KWWWKKKKWWWWWK.',
    '.KWKKWWWWKKWWWK.',
    '.KWKKWWWWKKWWWK.',
    '.KWWWKKKKWWWWWK.',
    '..KWWKKKKWWWWK..',
    '..KWWWKKWWWWWK..',
    '...KKWWWWWWKK...',
    '.....KKKKKK.....',
    '................',
    '................',
  ],
  'toy-foam-finger': [
    '................',
    '......KK........',
    '.....KGGK.......',
    '.....KGGK.......',
    '.....KGGKKKK....',
    '.....KGGGGGGK...',
    '..KKKKGGGGGGK...',
    '.KGGGGGGGGGGK...',
    '.KGGGGGGGGGGK...',
    '..KKGGGGGGGGK...',
    '....KGGGGGGK....',
    '....KGWWGGGK....',
    '....KGWWGGGK....',
    '....KKKKKKKK....',
    '................',
    '................',
  ],
  'toy-bobblehead': [
    '................',
    '...KKKKKKKK.....',
    '..KRRRRRRRRK....',
    '..KEEEEEEEEK....',
    '.KEEKEEEEKEEK...',
    '.KEEEEEEEEEEK...',
    '.KEEEEKKEEEEK...',
    '..KEEEEEEEEK....',
    '...KKKKKKKK.....',
    '.....KBBK.......',
    '....KBBBBK......',
    '....KBWBBK......',
    '.....KBBK.......',
    '....KKKKKK......',
    '....KGGGGK......',
    '....KKKKKK......',
  ],
  'toy-plush-mascot': [
    '................',
    '..KK......KK....',
    '.KHHK....KHHK...',
    '.KHHKKKKKKHHK...',
    '..KHHHHHHHHK....',
    '..KHhhHHhhHK....',
    '..KHKhHHKhHK....',
    '..KHHHHHHHHK....',
    '...KHHKKHHK.....',
    '....KHHHHK......',
    '...KHHHHHHK.....',
    '..KHHhhhhHHK....',
    '..KHHhhhhHHK....',
    '...KHHHHHHK.....',
    '....KK..KK......',
    '................',
  ],
  'toy-snow-globe': [
    '................',
    '.....KKKKK......',
    '...KKCCCCCKK....',
    '..KCCWCCCCCK....',
    '..KCCCCWCCCK....',
    '.KCCWCCCCWCCK...',
    '.KCCCGGGGCCCK...',
    '.KCCGGGGGGCCK...',
    '.KCCGGWWGGCCK...',
    '..KCCGGGGCCK....',
    '...KKCCCCKK.....',
    '....KKKKKK......',
    '...KgggggggK....',
    '...KgggggggK....',
    '....KKKKKKK.....',
    '................',
  ],
  'toy-boot-keychain': [
    '................',
    '......KKK.......',
    '.....KGGGK......',
    '.....KG.GK......',
    '.....KGGGK......',
    '......KKK.......',
    '......KK........',
    '.....KKKK.......',
    '....KKkkKK......',
    '....KkkkkK......',
    '....KkkkkKKK....',
    '....KkkkkkkKK...',
    '...KKkkkkkkkK...',
    '..KWWWWWWWWWK...',
    '..KKKKKKKKKKK...',
    '................',
  ],
  'toy-jersey': [
    '................',
    '..KKKK..KKKK....',
    '.KRRRRKKRRRRK...',
    '.KRRRRRRRRRRK...',
    '.KRRKRRRRKRRK...',
    '.KKKKRRRRKKKK...',
    '...KRRRRRRK.....',
    '...KRWWWWRK.....',
    '...KRWKKWRK.....',
    '...KRWKKWRK.....',
    '...KRWWWWRK.....',
    '...KRRRRRRK.....',
    '...KRRRRRRK.....',
    '...KKKKKKKK.....',
    '................',
    '................',
  ],
  'toy-card-pack': [
    '................',
    '....KKKKKKK.....',
    '...KWWWWWWKK....',
    '...KWKKKKWKK....',
    '..KBBBBBBBBK....',
    '..KBBBBBBBBK....',
    '..KBBWGGWBBK....',
    '..KBBGGGGBBK....',
    '..KBBGGGGBBK....',
    '..KBBWGGWBBK....',
    '..KBBBBBBBBK....',
    '..KBBBBBBBBK....',
    '..KKKKKKKKKK....',
    '................',
    '................',
    '................',
  ],
  'toy-club-mug': [
    '................',
    '................',
    '..KKKKKKKK......',
    '.KWWWWWWWWK.....',
    '.KRRRRRRRRKKK...',
    '.KRRRRRRRRK.KK..',
    '.KRRWWWWRRK..K..',
    '.KRRWGGWRRK..K..',
    '.KRRWGGWRRK..K..',
    '.KRRWWWWRRK.KK..',
    '.KRRRRRRRRKKK...',
    '.KRRRRRRRRK.....',
    '..KRRRRRRK......',
    '...KKKKKK.......',
    '................',
    '................',
  ],
};

export function financeSpriteRows(id: FinanceSpriteId): readonly string[] {
  const rows = SPRITE_ROWS[id];
  if (rows === undefined) throw new Error(`unknown finance sprite ${id}`);
  return rows;
}

export interface FinanceSpriteRun {
  id: string;
  x: number;
  y: number;
  width: number;
  color: string;
}

/** Row-run-length encoding of the non-transparent cells, like eventSpriteRuns. */
export function financeSpriteRuns(spriteId: FinanceSpriteId): FinanceSpriteRun[] {
  const rows = financeSpriteRows(spriteId);
  const runs: FinanceSpriteRun[] = [];
  rows.forEach((row, y) => {
    let runStart = -1;
    let runColor: string | undefined;
    const flush = (end: number) => {
      if (runStart >= 0 && runColor !== undefined) {
        runs.push({
          id: `${spriteId}:${y}:${runStart}`,
          x: runStart,
          y,
          width: end - runStart,
          color: runColor,
        });
      }
      runStart = -1;
      runColor = undefined;
    };
    for (let x = 0; x < row.length; x += 1) {
      const color = FINANCE_PALETTE[row[x]];
      if (color === undefined) {
        flush(x);
        continue;
      }
      if (color !== runColor) {
        flush(x);
        runStart = x;
        runColor = color;
      }
    }
    flush(row.length);
  });
  return runs;
}

/**
 * The 4-5 toys a TRENDING MERCHANDISE! banner shows, drawn deterministically
 * from the settled week so replays and reloads always see the same shelf.
 */
export function pickMerchToys(season: number, week: number): FinanceSpriteId[] {
  const seed = (
    Math.imul(season, 0x9e3779b1)
    ^ Math.imul(week, 0x85ebca6b)
    ^ 0x6d2b79f5
  ) >>> 0;
  const rng = mulberry32(seed);
  const count = 4 + Math.floor(rng() * 2);
  const pool: FinanceSpriteId[] = [...MERCH_TOY_IDS];
  const picked: FinanceSpriteId[] = [];
  for (let index = 0; index < count; index += 1) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return picked;
}
