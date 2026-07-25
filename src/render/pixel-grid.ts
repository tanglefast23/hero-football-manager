// The ONE device-pixel snapping rule, in one worklet-safe leaf module (same
// contract as ball-flight-visuals.ts: no RN/Skia/Expo imports, so Jest can
// exercise it headless and a UI-thread worklet can call it directly).
//
// It used to exist twice — inline in interpolate.ts's matchCameraOffset and as a
// private snapTranslateWorklet in worklet-atlas-frame.ts — and the match FX
// overlays had no access to either. Both now delegate here so a sprite, the
// camera, and an effect drawn on top of them all land on the same grid.
//
// Sprite MAGNIFICATION snapping is a different quantity and stays in
// interpolate.ts (snapSpriteScale): that one rounds how many device pixels a
// single source texel covers, this one rounds where the result is placed.

/**
 * Rounds a screen-space (dp) value so it lands on a whole device pixel.
 *
 * Positions arrive as `progress`-driven lerps between sim ticks, i.e. fractional
 * nearly every frame; without this each frame samples a different sub-pixel
 * phase and the pixel art crawls. Only on-screen output is quantised — sim
 * positions stay untouched, and the movement quantum (1 device px, a third of a
 * dp on a 3x screen) is imperceptible.
 */
export function snapDevicePixels(value: number, devicePixelRatio: number): number {
  'worklet';
  const dpr = Math.max(1, devicePixelRatio);
  return Math.round(value * dpr) / dpr;
}
