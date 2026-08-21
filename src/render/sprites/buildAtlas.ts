// RN/Skia side. NOT unit-testable headless — keep this thin, a pass-through
// compositor over the pure loader/layout math in loader.ts.
//
// This module has no hard dependency on '@shopify/react-native-skia' being
// installed: it takes the real `Skia` export as a parameter (structurally
// typed below) so the caller wires in the actual package at the integration
// site (see docs/superpowers/plans/2026-07-17-m0-match-engine.md Task 14,
// which mirrors this same offscreen-surface pattern in src/render/atlas.ts).
import {
  loadSpriteSheet,
  atlasLayout,
  type SpriteSheet,
  type AtlasLayout,
} from './loader';
import type { KitPlan } from './club-kit';

export interface SkiaRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface SkiaPaintLike {
  setColor(color: unknown): void;
  delete?(): void;
  dispose?(): void;
}
export interface SkiaCanvasLike {
  drawRect(rect: SkiaRectLike, paint: SkiaPaintLike): void;
}
export interface SkiaImageLike {
  // MakeOffscreen (below) creates a GPU-backed surface, so its snapshot is a
  // texture image bound to that surface's own GPU context — invalid when
  // sampled from a different <Canvas>'s context (renders nothing, even
  // though the pixels are correct). makeNonTextureImage() copies it into a
  // portable, CPU-backed image, which is exactly the conversion
  // react-native-skia's own renderer/Offscreen.tsx applies to a
  // MakeOffscreen snapshot before handing it back for general use.
  makeNonTextureImage(): unknown;
  delete?(): void;
  dispose?(): void;
}
export interface SkiaSurfaceLike {
  getCanvas(): SkiaCanvasLike;
  flush(): void;
  makeImageSnapshot(): SkiaImageLike;
  delete?(): void;
  dispose?(): void;
}
export interface SkiaApi {
  Surface: {
    MakeOffscreen(width: number, height: number): SkiaSurfaceLike | null;
  };
  Paint(): SkiaPaintLike;
  Color(value: string): unknown;
}

function pixelRunRect(x: number, y: number, width: number): SkiaRectLike {
  return { x, y, width, height: 1 };
}

/**
 * Composites every sprite frame in the sheet onto one offscreen Skia surface,
 * painting the sheet's pixel-map data one pixel at a time via drawRect (each
 * sprite is a few hundred pixels at most; this runs once at load time, not
 * per frame, so it doesn't need Atlas-style batching itself). Returns the
 * snapshotted atlas image plus the same rectFor lookup atlasLayout produces,
 * ready to feed straight into Skia's <Atlas> component.
 */
export interface SpriteAtlas {
  image: unknown;
  rectFor: AtlasLayout['rectFor'];
}

function disposeSkiaObject(value: { delete?(): void; dispose?(): void }): void {
  if (value.delete !== undefined) value.delete();
  else value.dispose?.();
}

/**
 * Built atlases, keyed by the exact inputs that determine their pixels.
 *
 * Rebuilding is expensive — validating the base sheet alone costs ~15ms before a
 * single pixel is painted — and the same inputs recur constantly: entering a
 * match, replaying it, toggling colour-safe kits, and every drill tap, which
 * builds a whole atlas for one player. Bounded so a long session cannot grow it
 * without limit; the entries hold GPU-backed images.
 */
const ATLAS_CACHE_LIMIT = 12;
const atlasCache = new Map<string, SpriteAtlas>();

function atlasCacheKey(
  visualIds: readonly string[] | undefined,
  plan: KitPlan | undefined,
): string {
  const ids = visualIds === undefined ? '*' : visualIds.join('|');
  // The kit is part of the identity of the pixels, so it has to be part of the
  // key: without it a club that changed its shirt would be served the atlas
  // painted for the old one.
  const kit =
    plan === undefined
      ? ''
      : (['r', 'u'] as const)
          .map((prefix) => {
            const side = plan[prefix];
            if (side === undefined) return '';
            return `${prefix}:${side.shape}:${side.base.join('/')}:${
              side.pattern?.join('/') ?? ''
            }`;
          })
          .filter((part) => part !== '')
          .join(',');
  return `${ids}#${kit}`;
}

/** Drops every cached atlas. Exposed for tests and for reclaiming memory. */
export function clearSpriteAtlasCache(): void {
  atlasCache.clear();
}

export function buildSpriteAtlas(
  Skia: SkiaApi,
  visualIds?: readonly string[],
  plan?: KitPlan,
): SpriteAtlas {
  const cacheKey = atlasCacheKey(visualIds, plan);
  const cached = atlasCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const sheet: SpriteSheet = loadSpriteSheet(visualIds, plan);
  const layout = atlasLayout(sheet);

  const atlasW = layout.cols * layout.slotW;
  const atlasH = layout.rows * layout.slotH;
  const surface = Skia.Surface.MakeOffscreen(atlasW, atlasH);
  if (!surface) {
    throw new Error(
      'buildSpriteAtlas: Skia.Surface.MakeOffscreen returned null',
    );
  }
  const canvas = surface.getCanvas();

  // One Paint per distinct colour instead of one per pixel. The sheet palette has
  // 24 entries, so this replaces ~150,000 Paint+Color allocations with ~24.
  const paintByColor = new Map<string, SkiaPaintLike>();
  const paintFor = (color: string): SkiaPaintLike => {
    const existing = paintByColor.get(color);
    if (existing !== undefined) return existing;
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(color));
    paintByColor.set(color, paint);
    return paint;
  };
  // A straight palette lookup. The kit is already in these pixels: it is
  // painted into the sheet's own tokens before any pose is derived, which is
  // the only place a row band can be honest — see `withKitRewrite`.
  const colorAt = (
    key: string,
    line: string,
    row: number,
    col: number,
  ): string | null | undefined => sheet.palette[line[col]];

  let snapshot: SkiaImageLike | undefined;
  let retainedImage: unknown;
  try {
    for (const key of Object.keys(sheet.sprites)) {
      const { x: originX, y: originY } = layout.rectFor(key);
      const rows = sheet.sprites[key];
      for (let row = 0; row < rows.length; row++) {
        const line = rows[row];
        let col = 0;
        while (col < line.length) {
          const color = colorAt(key, line, row, col);
          // "." (or any null palette entry) is transparent — leave unpainted
          if (!color) {
            col += 1;
            continue;
          }
          // Collapse a horizontal run of the same resolved colour into one rect.
          // Sprite rows are mostly flat bands, so this is a ~4-5x cut in draw calls
          // and produces byte-identical output.
          let run = 1;
          while (
            col + run < line.length &&
            colorAt(key, line, row, col + run) === color
          )
            run += 1;
          canvas.drawRect(
            pixelRunRect(originX + col, originY + row, run),
            paintFor(color),
          );
          col += run;
        }
      }
    }

    surface.flush();
    snapshot = surface.makeImageSnapshot();
    retainedImage = snapshot.makeNonTextureImage();
    const built: SpriteAtlas = {
      image: retainedImage,
      rectFor: layout.rectFor,
    };
    if (atlasCache.size >= ATLAS_CACHE_LIMIT) {
      const oldest = atlasCache.keys().next();
      if (!oldest.done) atlasCache.delete(oldest.value);
    }
    atlasCache.set(cacheKey, built);
    return built;
  } finally {
    if (snapshot !== undefined && snapshot !== retainedImage)
      disposeSkiaObject(snapshot);
    for (const paint of paintByColor.values()) disposeSkiaObject(paint);
    disposeSkiaObject(surface);
  }
}

/**
 * Placeholder atlas for when buildSpriteAtlas throws (realistically: sprites.json
 * failing loader validation): a single white `size`×`size` square, so a screen
 * draws plain rects instead of crashing. Used by MatchScreen,
 * which previously duplicated this construction (audit finding 14). Mirrors
 * buildSpriteAtlas's offscreen → non-texture flow and its plain-rect drawRect.
 */
export function buildFallbackAtlas(
  Skia: SkiaApi,
  size: number,
): { image: unknown; rectFor: AtlasLayout['rectFor'] } {
  const surface = Skia.Surface.MakeOffscreen(size, size);
  if (!surface) {
    throw new Error(
      'buildFallbackAtlas: Skia.Surface.MakeOffscreen returned null',
    ); // Skia itself is broken — nothing could render anyway
  }
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  let snapshot: SkiaImageLike | undefined;
  let retainedImage: unknown;
  try {
    paint.setColor(Skia.Color('#ffffff'));
    canvas.drawRect({ x: 0, y: 0, width: size, height: size }, paint);
    surface.flush();
    snapshot = surface.makeImageSnapshot();
    retainedImage = snapshot.makeNonTextureImage();
    return {
      image: retainedImage,
      rectFor: () => ({ x: 0, y: 0, w: size, h: size }),
    };
  } finally {
    if (snapshot !== undefined && snapshot !== retainedImage)
      disposeSkiaObject(snapshot);
    disposeSkiaObject(paint);
    disposeSkiaObject(surface);
  }
}
