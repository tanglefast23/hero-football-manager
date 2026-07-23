import { readFileSync } from 'fs';
import { join } from 'path';
import {
  TACKLE_DUST_OPACITY,
  TACKLE_DUST_PIXELS,
  TACKLE_GRASS_OPACITY,
  TACKLE_GRASS_PIXELS,
  TACKLE_TRAIL_SAMPLES,
} from '../slide-tackle-effects';

describe('slide-tackle debris', () => {
  it('keeps dust at 65% and grass fully opaque', () => {
    expect(TACKLE_DUST_OPACITY).toBe(0.65);
    expect(TACKLE_GRASS_OPACITY).toBe(1);
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
    expect(TACKLE_TRAIL_SAMPLES.length).toBeGreaterThan(TACKLE_DUST_PIXELS.length);
    expect(TACKLE_TRAIL_SAMPLES[0].progress).toBeLessThanOrEqual(0.05);
    expect(TACKLE_TRAIL_SAMPLES.at(-1)!.progress).toBeGreaterThanOrEqual(0.9);
    expect(TACKLE_TRAIL_SAMPLES.map(sample => sample.progress)).toEqual(
      [...TACKLE_TRAIL_SAMPLES].map(sample => sample.progress).sort((a, b) => a - b),
    );
  });

  it('explicitly disables Skia antialiasing on both debris layers', () => {
    const source = readFileSync(join(process.cwd(), 'src/render/WorkletMatchOverlays.tsx'), 'utf8');
    expect(source.match(/antiAlias=\{false\}/g)).toHaveLength(2);
  });

  it('anchors the trail to the packed launch point and current live position', () => {
    const source = readFileSync(join(process.cwd(), 'src/render/WorkletMatchOverlays.tsx'), 'utf8');
    expect(source).toContain('const originX = actionData.value[offset + 6] * scale');
    expect(source).toContain('const originY = actionData.value[offset + 7] * scale');
    expect(source).toContain('originX + travelX * sample.progress');
    expect(source).toContain('originY + travelY * sample.progress');
  });
});
