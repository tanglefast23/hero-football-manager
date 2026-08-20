import { JERSEY_BAND, loadSpriteSheet } from '../loader';
import { requirePixelSheets } from '../pixel-sheets';
import { clubKitPlan, swatchById, type KitPlan } from '../club-kit';

const STRIPED_FOREST: KitPlan = clubKitPlan({
  kit: { base: 'FOREST', pattern: 'STRIPES', patternColor: 'STONE' },
  userSide: 'r',
  colorSafeKits: false,
});
const PLAIN_NAVY_AWAY: KitPlan = clubKitPlan({
  kit: { base: 'NAVY', pattern: 'PLAIN', patternColor: 'NAVY' },
  userSide: 'u',
  colorSafeKits: false,
});

const KIT_TOKENS = 'rREbBC';
const band = (rows: readonly string[]) =>
  rows.slice(JERSEY_BAND.top, JERSEY_BAND.bottom + 1);

describe('kit rewrite', () => {
  it('changes nothing when no side has a kit', () => {
    const plain = loadSpriteSheet(['r:f00']);
    const same = loadSpriteSheet(['r:f00'], {});
    expect(same.sprites['r:f00:run0']).toEqual(plain.sprites['r:f00:run0']);
  });

  it('repaints the jersey band and leaves every other row untouched', () => {
    const plain = loadSpriteSheet(['r:f00']);
    const kitted = loadSpriteSheet(['r:f00'], STRIPED_FOREST);
    const before = plain.sprites['r:f00:run0'];
    const after = kitted.sprites['r:f00:run0'];

    for (let row = 0; row < before.length; row += 1) {
      if (row >= JERSEY_BAND.top && row <= JERSEY_BAND.bottom) continue;
      expect(after[row]).toBe(before[row]);
    }
    expect(band(after).join('')).not.toBe(band(before).join(''));
  });

  it('leaves no stock kit token in a repainted band', () => {
    const kitted = loadSpriteSheet(['r:f00'], STRIPED_FOREST);
    for (const row of band(kitted.sprites['r:f00:run0'])) {
      for (const token of row) expect(KIT_TOKENS).not.toContain(token);
    }
  });

  /**
   * The reason the rewrite is band-limited rather than a palette override:
   * twenty-five looks paint kit tokens in hair, masks and trim, and three
   * rear-head styles paint them into derived back frames.
   */
  it('keeps the hair of a look whose hair is painted in a kit token', () => {
    for (const look of ['f172', 'f174', 'f178']) {
      const side = look === 'f174' ? 'u' : 'r';
      const id = `${side}:${look}`;
      const plan = side === 'r' ? STRIPED_FOREST : PLAIN_NAVY_AWAY;
      const plain = loadSpriteSheet([id]);
      const kitted = loadSpriteSheet([id], plan);
      for (const frame of [`${id}:run0`, `${id}:back0`]) {
        const before = plain.sprites[frame];
        const after = kitted.sprites[frame];
        for (let row = 0; row < JERSEY_BAND.top; row += 1) {
          expect(after[row]).toBe(before[row]);
        }
      }
    }
  });

  it('leaves the goalkeeper in his own kit', () => {
    const plain = loadSpriteSheet(['r:g00']);
    const kitted = loadSpriteSheet(['r:g00'], STRIPED_FOREST);
    expect(kitted.sprites['r:g00:ready0']).toEqual(
      plain.sprites['r:g00:ready0'],
    );
  });

  it('dresses only the side that owns the kit', () => {
    const plain = loadSpriteSheet(['r:f00', 'u:f00']);
    const kitted = loadSpriteSheet(['r:f00', 'u:f00'], PLAIN_NAVY_AWAY);
    expect(kitted.sprites['r:f00:run0']).toEqual(plain.sprites['r:f00:run0']);
    expect(kitted.sprites['u:f00:run0']).not.toEqual(
      plain.sprites['u:f00:run0'],
    );
  });

  it('carries the kit into every derived pose', () => {
    const kitted = loadSpriteSheet(['r:f00'], STRIPED_FOREST);
    for (const frame of ['r:f00:back0', 'r:f00:slide4', 'r:f00:run0:webbed']) {
      expect(kitted.sprites[frame]).toBeDefined();
    }
    // The slide cell pastes the torso at a different row, which is exactly why
    // a paint-time row band could not reach it.
    const slide = kitted.sprites['r:f00:slide4'].join('');
    expect(slide).toContain('2');
  });

  /**
   * Back derivation fills the front number patch with the band's dominant
   * token. Running the rewrite after it means the patch is patterned with the
   * rest of the shirt, rather than left as one solid block.
   */
  it('runs the pattern unbroken across the back', () => {
    const back = loadSpriteSheet(['r:f00'], STRIPED_FOREST).sprites[
      'r:f00:back0'
    ];
    const painted = band(back).join('');
    expect(painted).toContain('2');
    expect(painted).toContain('5');
  });

  it('paints the palette the plan asked for, without touching the singleton', () => {
    const forest = swatchById('FOREST')!.ramp;
    const stone = swatchById('STONE')!.ramp;
    const kitted = loadSpriteSheet(['r:f00'], STRIPED_FOREST);

    expect(kitted.palette['2']).toBe(forest[1]);
    expect(kitted.palette['5']).toBe(stone[1]);
    expect(kitted.palette).not.toBe(requirePixelSheets().sprites.palette);
    expect(
      Object.keys(
        (requirePixelSheets().sprites as { palette: Record<string, unknown> })
          .palette,
      ),
    ).not.toContain('2');
    // A later plain load must not inherit the previous kit.
    expect(loadSpriteSheet(['r:f00']).palette['2']).toBeUndefined();
  });

  /**
   * `u:f27` has more red pixels in its HAIR than blue pixels in its shirt, so
   * counting the whole grid drew red hip and leg patches onto a blue away kit.
   * Counting the jersey band fixes it, and is also what lets a rewritten kit be
   * seen at all.
   */
  it('picks the shirt a slide is wearing, not the hair above it', () => {
    // The head is rotated to the LEFT of a slide cell and the body lies to the
    // right, so the drawn hip and leg patches are what column 16 onward holds.
    const lowerBody = (id: string, plan?: KitPlan) =>
      loadSpriteSheet([id], plan)
        .sprites[`${id}:slide4`].slice(17, 25)
        .map((row) => row.slice(16))
        .join('');

    for (const id of ['u:f27', 'u:f10']) {
      const plain = lowerBody(id);
      expect(plain).toContain('B');
      expect(plain).not.toMatch(/[RrE]/);

      const kitted = lowerBody(id, PLAIN_NAVY_AWAY);
      expect(kitted).toContain('2');
      expect(kitted).not.toMatch(/[RrEBbC]/);
    }
  });

  it('gives the second side its own token slot', () => {
    const both = loadSpriteSheet(
      ['r:f00', 'u:f00'],
      clubKitPlan({
        kit: { base: 'ROYAL', pattern: 'PLAIN', patternColor: 'ROYAL' },
        userSide: 'r',
        colorSafeKits: false,
      }),
    );
    expect(both.palette['2']).toBe(swatchById('ROYAL')!.ramp[1]);
    expect(both.palette['8']).toBe('#7d7887');
    expect(band(both.sprites['u:f00:run0']).join('')).toContain('8');
  });
});
