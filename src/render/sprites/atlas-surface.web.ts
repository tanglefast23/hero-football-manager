import type { SkiaApi, SkiaSurfaceLike } from './buildAtlas';

/** Web MakeOffscreen allocates a GL context whose owner Skia does not expose. */
export function makeAtlasSurface(
  Skia: SkiaApi,
  width: number,
  height: number,
): SkiaSurfaceLike | null {
  if (Skia.Surface.Make === undefined) {
    throw new Error('sprite atlas: CPU surface is unavailable');
  }
  return Skia.Surface.Make(width, height);
}
