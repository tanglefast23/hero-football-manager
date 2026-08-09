import {
  buildSpriteAtlas,
  clearSpriteAtlasCache,
  type SkiaApi,
} from '../buildAtlas';
import { loadSpriteSheet } from '../loader';

/**
 * Counts what the builder asks of Skia, so the two costs that made entering a
 * match and tapping a drill hitch stay measured rather than assumed.
 */
function countingSkia(): {
  api: SkiaApi;
  drawRects: () => number;
  paints: () => number;
} {
  let drawRects = 0;
  let paints = 0;
  const api: SkiaApi = {
    Surface: {
      MakeOffscreen: () => ({
        getCanvas: () => ({
          drawRect: () => {
            drawRects += 1;
          },
        }),
        flush: () => undefined,
        makeImageSnapshot: () => ({ makeNonTextureImage: () => ({}) }),
      }),
    },
    Paint: () => {
      paints += 1;
      return { setColor: () => undefined };
    },
    Color: (value: string) => value,
  } as unknown as SkiaApi;
  return { api, drawRects: () => drawRects, paints: () => paints };
}

const LOOKS = ['r:f00', 'r:f01'] as const;

describe('sprite atlas build cost', () => {
  beforeEach(clearSpriteAtlasCache);
  afterEach(clearSpriteAtlasCache);

  it('allocates one Paint per palette colour, not one per pixel', () => {
    const skia = countingSkia();

    buildSpriteAtlas(skia.api, LOOKS);

    // The sheet palette has 24 entries; a handful are transparent and unused by
    // these two looks, so the bound is what matters: far below the pixel count.
    expect(skia.paints()).toBeGreaterThan(0);
    expect(skia.paints()).toBeLessThanOrEqual(24);
    expect(skia.drawRects()).toBeGreaterThan(skia.paints());
  });

  it('draws horizontal runs rather than individual pixels', () => {
    const skia = countingSkia();
    const sheet = loadSpriteSheet(LOOKS);
    let opaquePixels = 0;
    for (const rows of Object.values(sheet.sprites)) {
      for (const line of rows) {
        for (const char of line) if (sheet.palette[char]) opaquePixels += 1;
      }
    }

    buildSpriteAtlas(skia.api, LOOKS);

    // One rect per opaque pixel was the old cost. Sprite rows are flat bands, so
    // collapsing runs should cut the call count well below the pixel count.
    expect(opaquePixels).toBeGreaterThan(0);
    expect(skia.drawRects()).toBeLessThan(opaquePixels * 0.6);
  });

  it('serves a repeat build from cache without touching Skia again', () => {
    const skia = countingSkia();

    const first = buildSpriteAtlas(skia.api, LOOKS);
    const drawsAfterFirst = skia.drawRects();
    const second = buildSpriteAtlas(skia.api, LOOKS);

    expect(second).toBe(first);
    expect(skia.drawRects()).toBe(drawsAfterFirst);
  });

  it('treats a different palette override as a different atlas', () => {
    const skia = countingSkia();

    const plain = buildSpriteAtlas(skia.api, LOOKS);
    const recoloured = buildSpriteAtlas(skia.api, LOOKS, { R: '#ffffff' });

    expect(recoloured).not.toBe(plain);
  });

  it('rebuilds after the cache is cleared', () => {
    const skia = countingSkia();

    const first = buildSpriteAtlas(skia.api, LOOKS);
    clearSpriteAtlasCache();
    const rebuilt = buildSpriteAtlas(skia.api, LOOKS);

    expect(rebuilt).not.toBe(first);
  });
});
