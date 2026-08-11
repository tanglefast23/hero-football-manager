import { readFileSync } from 'fs';
import { join } from 'path';
import {
  TACKLE_DUST_OPACITY,
  TACKLE_DUST_PHASES,
  TACKLE_DUST_POSITION_SCALE,
  TACKLE_DUST_SIZE_SCALE,
  TACKLE_GRASS_OPACITY,
  TACKLE_GRASS_PHASES,
  TACKLE_TRAIL_SAMPLES,
  TACKLE_VFX_STEP_MS,
} from '../slide-tackle-effects';

const source = readFileSync(
  join(process.cwd(), 'src/render/WorkletMatchOverlays.tsx'),
  'utf8',
);
const component = source.slice(
  source.indexOf('export function WorkletSlideTackleEffects('),
  source.indexOf('export function WorkletSpeedLines('),
);

describe('slide-tackle procedural debris', () => {
  it('makes dust almost transparent and grass dominant', () => {
    expect(TACKLE_DUST_OPACITY).toBe(0.15);
    expect(TACKLE_GRASS_OPACITY).toBe(0.8);
  });

  it('uses four authored phases at one change every 334ms', () => {
    expect(TACKLE_VFX_STEP_MS).toBe(334);
    expect(TACKLE_DUST_PHASES).toHaveLength(4);
    expect(TACKLE_GRASS_PHASES).toHaveLength(4);
    expect(component).toContain(
      'Math.floor((age * 100) / TACKLE_VFX_STEP_MS) % 4',
    );
  });

  it('uses a large backward dust trail while preserving 15% opacity', () => {
    expect(TACKLE_DUST_SIZE_SCALE).toBe(3.4);
    expect(TACKLE_DUST_POSITION_SCALE).toBe(1.25);
    expect(component).toContain(
      'sample.dustSize * TACKLE_DUST_SIZE_SCALE * pixel',
    );
    expect(component).toContain(
      'sideX * sample.side * TACKLE_DUST_POSITION_SCALE * pixel',
    );
    expect(component).toContain('travelX * sample.progress');
    for (const phase of TACKLE_DUST_PHASES) {
      expect(phase.length).toBeGreaterThanOrEqual(7);
      expect(
        Math.max(...phase.map((fragment) => fragment.side)),
      ).toBeGreaterThanOrEqual(14);
      expect(
        Math.min(...phase.map((fragment) => fragment.side)),
      ).toBeLessThanOrEqual(-14);
      expect(
        Math.max(...phase.map((fragment) => fragment.size)),
      ).toBeGreaterThanOrEqual(7);
      expect(Math.max(...phase.map((fragment) => fragment.along))).toBeLessThan(
        0,
      );
    }
    expect(
      Math.min(...TACKLE_DUST_PHASES.at(-1)!.map((fragment) => fragment.along)),
    ).toBeLessThan(
      Math.min(...TACKLE_DUST_PHASES[0].map((fragment) => fragment.along)),
    );
    for (const sample of TACKLE_TRAIL_SAMPLES) {
      expect(sample.dustSize).toBeGreaterThanOrEqual(5);
      expect(Math.abs(sample.side)).toBeGreaterThanOrEqual(5);
      expect(
        (sample.dustSize * TACKLE_DUST_SIZE_SCALE) / 2,
      ).toBeGreaterThanOrEqual(
        Math.abs(sample.side) * TACKLE_DUST_POSITION_SCALE,
      );
    }
  });

  it('uses short detached turf fragments instead of tall grass blades', () => {
    for (const phase of TACKLE_GRASS_PHASES) {
      for (const fragment of phase) {
        expect(Number.isInteger(fragment.along)).toBe(true);
        expect(Number.isInteger(fragment.side)).toBe(true);
        expect(fragment.width).toBeGreaterThan(0);
        expect(fragment.height).toBeGreaterThan(0);
        expect(fragment.height).toBeLessThanOrEqual(2);
      }
    }
    for (const sample of TACKLE_TRAIL_SAMPLES) {
      expect(sample.grassHeight).toBeLessThanOrEqual(2);
      expect(sample.grassWidth).toBeGreaterThan(0);
    }
    expect(component).not.toContain('blade.height + rise');
  });

  it('keeps the ground trail on the real launch-to-current path', () => {
    expect(TACKLE_TRAIL_SAMPLES[0].progress).toBeLessThanOrEqual(0.05);
    expect(TACKLE_TRAIL_SAMPLES.at(-1)!.progress).toBeGreaterThanOrEqual(0.9);
    expect(component).toContain('actionData.value[offset + 6]');
    expect(component).toContain('actionData.value[offset + 7]');
    expect(component).toMatch(/travelX \* sample\.progress/);
    expect(component).toMatch(/travelY \* sample\.progress/);
  });

  it('removes traveling phases for Reduce Motion and adaptive reduction', () => {
    expect(component).toContain('if (reduceMotion) return;');
    expect(component.match(/if \(reducedEffects\) continue;/g)).toHaveLength(2);
    expect(component).toContain(
      'const trailCount = reducedEffects ? 4 : TACKLE_TRAIL_SAMPLES.length;',
    );
  });

  it('draws two batched hard-edged paths', () => {
    expect(component.match(/usePathValue\(/g)).toHaveLength(1);
    expect(component.match(/<Path/g)).toHaveLength(2);
    expect(component.match(/antiAlias=\{false\}/g)).toHaveLength(2);
  });

  it('snaps every rectangle edge through the shared helper', () => {
    const helper = source.slice(
      source.indexOf('function addSnappedDebrisRect('),
      source.indexOf('export function WorkletSlideTackleEffects('),
    );
    expect(helper.match(/snapDevicePixels\(/g)).toHaveLength(4);
    expect(component).toContain('addSnappedDebrisRect(');
    expect(component).not.toMatch(/Math\.round\(/);
  });

  it('receives device, motion, and adaptive-reduction inputs at both layers', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src/render/MatchScreen.tsx'),
      'utf8',
    );
    const uses = screen.match(/<WorkletSlideTackleEffects\b[\s\S]*?\/>/g) ?? [];
    expect(uses).toHaveLength(2);
    for (const use of uses) {
      expect(use).toContain('devicePixelRatio={devicePixelRatio}');
      expect(use).toContain('reduceMotion={reduceMotion}');
      expect(use).toContain('reducedEffects={reducedEffects}');
    }
  });
});
