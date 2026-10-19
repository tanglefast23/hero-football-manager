import type { SkiaApi, SkiaSurfaceLike } from './buildAtlas';

export function makeAtlasSurface(
  Skia: SkiaApi,
  width: number,
  height: number,
): SkiaSurfaceLike | null {
  return Skia.Surface.MakeOffscreen(width, height);
}
