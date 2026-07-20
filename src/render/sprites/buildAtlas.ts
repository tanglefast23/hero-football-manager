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

export interface SkiaRectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface SkiaPaintLike {
  setColor(color: unknown): void;
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
}
export interface SkiaSurfaceLike {
  getCanvas(): SkiaCanvasLike;
  flush(): void;
  makeImageSnapshot(): SkiaImageLike;
}
export interface SkiaApi {
  Surface: { MakeOffscreen(width: number, height: number): SkiaSurfaceLike | null };
  Paint(): SkiaPaintLike;
  Color(value: string): unknown;
}

function pixelRect(x: number, y: number): SkiaRectLike {
  return { x, y, width: 1, height: 1 };
}

/**
 * Composites every sprite frame in the sheet onto one offscreen Skia surface,
 * painting the sheet's pixel-map data one pixel at a time via drawRect (each
 * sprite is a few hundred pixels at most; this runs once at load time, not
 * per frame, so it doesn't need Atlas-style batching itself). Returns the
 * snapshotted atlas image plus the same rectFor lookup atlasLayout produces,
 * ready to feed straight into Skia's <Atlas> component.
 */
export function buildSpriteAtlas(
  Skia: SkiaApi,
  visualIds?: readonly string[],
): { image: unknown; rectFor: AtlasLayout['rectFor'] } {
  const sheet: SpriteSheet = loadSpriteSheet(visualIds);
  const layout = atlasLayout(sheet);

  const atlasW = layout.cols * layout.slotW;
  const atlasH = layout.rows * layout.slotH;
  const surface = Skia.Surface.MakeOffscreen(atlasW, atlasH);
  if (!surface) {
    throw new Error('buildSpriteAtlas: Skia.Surface.MakeOffscreen returned null');
  }
  const canvas = surface.getCanvas();

  for (const key of Object.keys(sheet.sprites)) {
    const { x: originX, y: originY } = layout.rectFor(key);
    const rows = sheet.sprites[key];
    for (let row = 0; row < rows.length; row++) {
      const line = rows[row];
      for (let col = 0; col < line.length; col++) {
        const color = sheet.palette[line[col]];
        if (!color) continue; // "." (or any null palette entry) is transparent — leave unpainted
        const paint = Skia.Paint();
        paint.setColor(Skia.Color(color));
        canvas.drawRect(pixelRect(originX + col, originY + row), paint);
      }
    }
  }

  surface.flush();
  return { image: surface.makeImageSnapshot().makeNonTextureImage(), rectFor: layout.rectFor };
}

/**
 * Placeholder atlas for when buildSpriteAtlas throws (realistically: sprites.json
 * failing loader validation): a single white `size`×`size` square, so a screen
 * draws plain rects instead of crashing. Shared by MatchScreen and StressScreen,
 * which previously duplicated this construction (audit finding 14). Mirrors
 * buildSpriteAtlas's offscreen → non-texture flow and its plain-rect drawRect.
 */
export function buildFallbackAtlas(Skia: SkiaApi, size: number): { image: unknown; rectFor: AtlasLayout['rectFor'] } {
  const surface = Skia.Surface.MakeOffscreen(size, size);
  if (!surface) {
    throw new Error('buildFallbackAtlas: Skia.Surface.MakeOffscreen returned null'); // Skia itself is broken — nothing could render anyway
  }
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  paint.setColor(Skia.Color('#ffffff'));
  canvas.drawRect({ x: 0, y: 0, width: size, height: size }, paint);
  surface.flush();
  return {
    image: surface.makeImageSnapshot().makeNonTextureImage(),
    rectFor: () => ({ x: 0, y: 0, w: size, h: size }),
  };
}
