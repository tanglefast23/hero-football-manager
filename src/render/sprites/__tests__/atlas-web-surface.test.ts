jest.mock('../atlas-surface', () => require('../atlas-surface.web'));

import {
  buildFallbackAtlas,
  buildSpriteAtlas,
  clearSpriteAtlasCache,
  type SkiaApi,
  type SkiaSurfaceLike,
} from '../buildAtlas';

describe('web atlas surface ownership', () => {
  beforeEach(clearSpriteAtlasCache);
  afterEach(clearSpriteAtlasCache);

  it('builds past the cache limit and the fallback without allocating a GL context', () => {
    const retainedImageFree = jest.fn();
    const temporaryFree = jest.fn();
    const surface = (): SkiaSurfaceLike => ({
      getCanvas: () => ({ drawRect: () => undefined }),
      flush: () => undefined,
      makeImageSnapshot: () => ({
        makeNonTextureImage: () => ({ delete: retainedImageFree }),
        delete: temporaryFree,
      }),
      delete: temporaryFree,
    });
    const makeCpu = jest.fn(surface);
    const makeGpu = jest.fn(() => {
      throw new Error('atlas allocated a web GL context');
    });
    const skia: SkiaApi = {
      Surface: { Make: makeCpu, MakeOffscreen: makeGpu },
      Paint: () => ({ setColor: () => undefined, delete: temporaryFree }),
      Color: (value) => value,
    };

    const first = buildSpriteAtlas(skia, ['r:f00']);
    expect(buildSpriteAtlas(skia, ['r:f00'])).toBe(first);
    for (let index = 1; index < 24; index++) {
      buildSpriteAtlas(skia, [`r:f${String(index).padStart(2, '0')}`]);
    }
    buildFallbackAtlas(skia, 4);

    expect(makeCpu).toHaveBeenCalledTimes(25);
    expect(makeGpu).not.toHaveBeenCalled();
    expect(temporaryFree).toHaveBeenCalled();
    // Evicted images can still be mounted in an Atlas component.
    expect(retainedImageFree).not.toHaveBeenCalled();
  });

  it('does not fall back to a leaking GPU surface when CPU allocation fails', () => {
    const makeGpu = jest.fn();
    const skia: SkiaApi = {
      Surface: { Make: () => null, MakeOffscreen: makeGpu },
      Paint: () => ({ setColor: () => undefined }),
      Color: (value) => value,
    };
    expect(() => buildSpriteAtlas(skia, ['r:f00'])).toThrow('could not create');
    expect(() => buildFallbackAtlas(skia, 4)).toThrow('could not create');
    expect(makeGpu).not.toHaveBeenCalled();
  });

  it('rejects an unsupported CPU factory without allocating a GL context', () => {
    const makeGpu = jest.fn();
    const skia: SkiaApi = {
      Surface: { MakeOffscreen: makeGpu },
      Paint: () => ({ setColor: () => undefined }),
      Color: (value) => value,
    };
    expect(() => buildSpriteAtlas(skia, ['r:f00'])).toThrow(
      'CPU surface is unavailable',
    );
    expect(() => buildFallbackAtlas(skia, 4)).toThrow(
      'CPU surface is unavailable',
    );
    expect(makeGpu).not.toHaveBeenCalled();
  });
});
