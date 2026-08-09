import { readFileSync } from 'fs';
import { join } from 'path';
import {
  TACKLE_DUST_OPACITY,
  TACKLE_DUST_PIXELS,
  TACKLE_GRASS_OPACITY,
  TACKLE_GRASS_PIXELS,
  TACKLE_TRAIL_SAMPLES,
} from '../slide-tackle-effects';

const source = readFileSync(
  join(process.cwd(), 'src/render/WorkletMatchOverlays.tsx'),
  'utf8',
);
// Scoped to this component: other hard-edged overlays in the same file
// (WorkletSpeedLines) also disable AA and snap their geometry, and a whole-file
// count would make these assertions fail every time one is added.
const component = source.slice(
  source.indexOf('export function WorkletSlideTackleEffects('),
  source.indexOf('export function WorkletSpeedLines('),
);

describe('slide-tackle debris', () => {
  it('keeps dust at 65% and grass at 40% opacity', () => {
    expect(TACKLE_DUST_OPACITY).toBe(0.65);
    expect(TACKLE_GRASS_OPACITY).toBe(0.4);
  });

  it('makes grass 40% narrower and shifts both grass builders toward the feet', () => {
    expect(component).toContain('sample.side + 12');
    expect(component).toContain('blade.side + 12');
    expect(component).toContain('Math.max(1, pixel * 0.6)');
    expect(component).toContain('Math.max(1, pixel * 0.9)');
  });

  it('uses integer-sized pixel clusters rather than blurred geometry', () => {
    for (const pixel of TACKLE_DUST_PIXELS) {
      expect(Number.isInteger(pixel.along)).toBe(true);
      expect(Number.isInteger(pixel.side)).toBe(true);
      expect(Number.isInteger(pixel.size)).toBe(true);
      expect(pixel.size).toBeGreaterThan(0);
    }
    for (const pixel of TACKLE_GRASS_PIXELS) {
      expect(Number.isInteger(pixel.along)).toBe(true);
      expect(Number.isInteger(pixel.side)).toBe(true);
      expect(Number.isInteger(pixel.height)).toBe(true);
      expect(pixel.height).toBeGreaterThan(0);
    }
    for (const sample of TACKLE_TRAIL_SAMPLES) {
      expect(Number.isInteger(sample.side)).toBe(true);
      expect(Number.isInteger(sample.dustSize)).toBe(true);
      expect(Number.isInteger(sample.grassHeight)).toBe(true);
      expect(sample.dustSize).toBeGreaterThan(0);
      expect(sample.grassHeight).toBeGreaterThan(0);
    }
  });

  it('covers the whole travelled path with more debris than the body spray alone', () => {
    expect(TACKLE_TRAIL_SAMPLES.length).toBeGreaterThan(
      TACKLE_DUST_PIXELS.length,
    );
    expect(TACKLE_TRAIL_SAMPLES[0].progress).toBeLessThanOrEqual(0.05);
    expect(TACKLE_TRAIL_SAMPLES.at(-1)!.progress).toBeGreaterThanOrEqual(0.9);
    expect(TACKLE_TRAIL_SAMPLES.map((sample) => sample.progress)).toEqual(
      [...TACKLE_TRAIL_SAMPLES]
        .map((sample) => sample.progress)
        .sort((a, b) => a - b),
    );
  });

  it('explicitly disables Skia antialiasing on both debris layers', () => {
    expect(component).not.toBe('');
    expect(component.match(/antiAlias=\{false\}/g)).toHaveLength(2);
  });

  it('anchors the trail to the packed launch point and current live position', () => {
    // The launch point rides in the action buffer; the far end is the live
    // interpolated position, so the trail spans the path actually travelled
    // instead of being pinned under the sliding body.
    expect(component).toContain('actionData.value[offset + 6]');
    expect(component).toContain('actionData.value[offset + 7]');
    expect(component).toContain('visualPositions.value[player * 2]');
    expect(component).toMatch(/travelX \* sample\.progress/);
    expect(component).toMatch(/travelY \* sample\.progress/);
  });

  it('lands every debris rect on the pixel grid through the one shared rule', () => {
    // Shape, not literals: each of the four rect builders (trail + body spray,
    // dust + grass) must snap both of its edges on both axes, so a fractional
    // span cannot put the far edge back on a sub-pixel phase.
    const builders = component.match(/builder\.moveTo\(/g) ?? [];
    expect(builders).toHaveLength(4);
    expect(component.match(/snapDevicePixels\(/g)).toHaveLength(
      builders.length * 4,
    );
    // ...and it is the shared helper, never a local re-implementation.
    expect(source).toContain("import { snapDevicePixels } from './pixel-grid'");
    expect(component).not.toMatch(/Math\.round\(/);
    expect(component).toContain('devicePixelRatio');
  });

  it('receives the real device pixel ratio from MatchScreen at both layers', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );
    const uses = screen.match(/<WorkletSlideTackleEffects\b[\s\S]*?\/>/g) ?? [];
    expect(uses).toHaveLength(2);
    for (const use of uses) {
      expect(use).toContain('devicePixelRatio={devicePixelRatio}');
    }
  });
});
