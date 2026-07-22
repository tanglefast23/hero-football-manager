import { ATLAS_GUTTER, atlasLayout, loadSpriteSheet } from '../loader';
import manifest from '../player-look-manifest.json';
import { playerLookId } from '../player-look';
import { spriteKeyForMatchPlayer } from '../slot-key';
import { SLIDE_TACKLE_CELL, SLIDE_TACKLE_FRAME_COUNT, slideTackleSpriteFrame } from '../slide-tackle';

const SIDES = ['r', 'u'] as const;
const VISUAL_IDS = SIDES.flatMap(side => [
  ...manifest.field.map(id => `${side}:${id}`),
  ...manifest.goalkeeper.map(id => `${side}:${id}`),
]);
const BASE_KEYS = [
  ...VISUAL_IDS.flatMap(id => [`${id}:run0`, `${id}:run1`, `${id}:back0`, `${id}:back1`]),
  ...SIDES.flatMap(side => manifest.goalkeeper.flatMap(id => [
    `${side}:${id}:ready0`, `${side}:${id}:ready1`,
    `${side}:${id}:backReady0`, `${side}:${id}:backReady1`,
  ])),
  'ball',
];
const SLIDE_KEYS = VISUAL_IDS.flatMap(id => (
  Array.from({ length: SLIDE_TACKLE_FRAME_COUNT }, (_, frame) => `${id}:${slideTackleSpriteFrame(frame)}`)
));

describe('large career match-sprite roster', () => {
  it('keeps identity when lineup position or team kit changes', () => {
    expect(spriteKeyForMatchPlayer(0, 'r0', 'GK', 'ready0')).toBe('r:g00:ready0');
    expect(spriteKeyForMatchPlayer(9, 'r9', 'FWD', 'run1')).toBe('r:f08:run1');
    expect(spriteKeyForMatchPlayer(10, 'r9', 'FWD', 'run1')).toBe('r:f08:run1');
    expect(spriteKeyForMatchPlayer(11, 'r9', 'FWD', 'run1')).toBe('u:f08:run1');
    expect(spriteKeyForMatchPlayer(22, 'r9', 'FWD', 'run1')).toBe('r:f08:run1');
    expect(spriteKeyForMatchPlayer(23, 'r9', 'FWD', 'run1')).toBe('u:f08:run1');
    const generatedLook = playerLookId('academy-s3-7', 'MID');
    expect(spriteKeyForMatchPlayer(4, 'academy-s3-7', 'MID', 'run0')).toBe(`r:${generatedLook}:run0`);
    expect(spriteKeyForMatchPlayer(4, 'created-player', 'FWD', 'run0', 'c167')).toBe('r:c167:run0');
    expect(() => spriteKeyForMatchPlayer(24, 'player', 'MID', 'run0')).toThrow('0 to 23');
    expect(() => spriteKeyForMatchPlayer(1, 'player', 'MID', 'ready0')).toThrow('only goalkeepers');
  });

  it('loads every base and derived action frame', () => {
    const sheet = loadSpriteSheet();
    expect(BASE_KEYS).toHaveLength(1745);
    expect(SLIDE_KEYS).toHaveLength(3860);
    for (const key of [...BASE_KEYS, ...SLIDE_KEYS]) expect(sheet.sprites).toHaveProperty(key);
    expect(Object.keys(sheet.sprites)).toHaveLength(BASE_KEYS.length + SLIDE_KEYS.length);
  });

  it('builds a match-sized sheet from only the active visual identities', () => {
    const sheet = loadSpriteSheet(['r:f00', 'u:g01', 'r:c167', 'r:f00']);
    expect(Object.keys(sheet.sprites)).toHaveLength(47);
    expect(sheet.sprites).toHaveProperty('r:f00:run0');
    expect(sheet.sprites).toHaveProperty('u:g01:ready1');
    expect(sheet.sprites).toHaveProperty('u:g01:slide9');
    expect(sheet.sprites).toHaveProperty('r:c167:run0');
    expect(sheet.sprites).toHaveProperty('r:c167:slide9');
    expect(sheet.sprites).not.toHaveProperty('r:f01:run0');
  });

  it('keeps hard-pixel dimensions and declared palette tokens', () => {
    const sheet = loadSpriteSheet();
    expect(Object.keys(sheet.palette).length).toBeLessThanOrEqual(24);
    for (const [key, rows] of Object.entries(sheet.sprites)) {
      const ball = key === 'ball';
      const slide = /:slide\d+$/.test(key);
      expect(rows).toHaveLength(ball ? 6 : slide ? SLIDE_TACKLE_CELL.h : sheet.cell.h);
      for (const row of rows) {
        expect(row).toHaveLength(ball ? 6 : slide ? SLIDE_TACKLE_CELL.w : sheet.cell.w);
        for (const token of row) expect(token in sheet.palette).toBe(true);
      }
    }
  });

  it('gives every goalkeeper two distinct ready poses', () => {
    const sheet = loadSpriteSheet();
    for (const side of SIDES) for (const id of manifest.goalkeeper) {
      const poses = ['run0', 'ready0', 'ready1'].map(frame => sheet.sprites[`${side}:${id}:${frame}`]);
      expect(new Set(poses.map(rows => JSON.stringify(rows))).size).toBe(3);
    }
  });

  describe('atlas layout', () => {
    it('uses an 8-column grid with gutters and unique source origins', () => {
      const sheet = loadSpriteSheet();
      const layout = atlasLayout(sheet);
      expect(layout.cols).toBe(8);
      expect(layout.rows).toBe(Math.ceil(Object.keys(sheet.sprites).length / 8));
      const origins = new Set<string>();
      for (const key of Object.keys(sheet.sprites)) {
        const rect = layout.rectFor(key);
        expect(rect.x).toBeGreaterThanOrEqual(ATLAS_GUTTER);
        expect(rect.y).toBeGreaterThanOrEqual(ATLAS_GUTTER);
        origins.add(`${rect.x},${rect.y}`);
      }
      expect(origins.size).toBe(Object.keys(sheet.sprites).length);
    });

    it('is deterministic across repeated calls', () => {
      const sheet = loadSpriteSheet();
      expect(atlasLayout(sheet).rectFor('r:f08:run0'))
        .toEqual(atlasLayout(sheet).rectFor('r:f08:run0'));
    });
  });

  it('preserves named-star silhouette signatures', () => {
    const sheet = loadSpriteSheet();
    const fireToken = Object.entries(sheet.palette).find(([, hex]) => hex === '#ff6a00')?.[0];
    expect(sheet.sprites['r:f08:run0'].some(row => row.includes(fireToken!))).toBe(true);
    const countPainted = (row: string) => [...row].filter(token => token !== '.').length;
    expect(countPainted(sheet.sprites['u:f12:run0'][16]))
      .toBeGreaterThan(countPainted(sheet.sprites['u:f10:run0'][16]));
  });
});
