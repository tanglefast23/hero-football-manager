// Pure flame geometry for the match render overlay. Like animation.ts this is
// deterministic and Skia-free: no RN/Skia imports, no Math.random — flicker is
// driven entirely by the `phase` clock (the renderer passes its visual tick),
// so the same phase always yields the same shapes. MatchScreen turns each
// FlameTongue into a Skia <Path>.
export interface FlameTongue {
  d: string; // SVG path for a rising teardrop
  color: string; // hex fill
  opacity: number; // 0..1
}

// Back-to-front layers: a wide dark-red body, a shorter orange middle, a small
// yellow core drawn on top. Height/width scale down each layer so the hotter
// colors sit inside the cooler ones.
const LAYERS = [
  { color: '#c0261e', hScale: 1.0, wScale: 1.0, opacity: 0.9 },
  { color: '#ff6a00', hScale: 0.72, wScale: 0.78, opacity: 0.95 },
  { color: '#ffc23a', hScale: 0.45, wScale: 0.55, opacity: 0.9 },
] as const;

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Flame tongues rising from a baseline at (cx, cy). `width` is the total
 * horizontal spread of the `count` bases; `height` is the tallest (dark-red)
 * layer's reach. Returned back-to-front so array order is draw order.
 */
export function flameTongues(
  cx: number,
  cy: number,
  width: number,
  height: number,
  phase: number,
  count = 5,
): FlameTongue[] {
  const tongues: FlameTongue[] = [];
  for (const layer of LAYERS) {
    for (let i = 0; i < count; i++) {
      // Evenly space the bases across the spread (single base sits at center).
      const bx = count > 1 ? cx - width / 2 + (width / (count - 1)) * i : cx;
      // Two out-of-phase sines give an organic, non-repeating flicker in
      // [-1, 1]; keep the height factor in [0.4, 1.0] so tips never overshoot.
      const flick = 0.5 * (Math.sin(phase * 1.1 + i * 1.7) + Math.sin(phase * 0.7 + i * 2.3));
      const hf = 0.7 + 0.3 * flick;
      const h = height * layer.hScale * hf;
      const w = (width / count) * layer.wScale;
      const tipDx = Math.sin(phase * 0.9 + i) * w * 0.5;
      const tipX = bx + tipDx;
      const d =
        `M ${r2(bx - w / 2)} ${r2(cy)}` +
        ` Q ${r2(bx - w * 0.3)} ${r2(cy - h * 0.6)} ${r2(tipX)} ${r2(cy - h)}` +
        ` Q ${r2(bx + w * 0.3)} ${r2(cy - h * 0.6)} ${r2(bx + w / 2)} ${r2(cy)} Z`;
      tongues.push({ d, color: layer.color, opacity: layer.opacity });
    }
  }
  return tongues;
}
