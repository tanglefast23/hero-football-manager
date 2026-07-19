import { readFileSync } from 'fs';
import { join } from 'path';
import {
  TACKLE_DUST_OPACITY,
  TACKLE_DUST_PIXELS,
  TACKLE_GRASS_OPACITY,
  TACKLE_GRASS_PIXELS,
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
  });

  it('explicitly disables Skia antialiasing on both debris layers', () => {
    const source = readFileSync(join(process.cwd(), 'src/render/WorkletMatchOverlays.tsx'), 'utf8');
    expect(source.match(/antiAlias=\{false\}/g)).toHaveLength(2);
  });
});
