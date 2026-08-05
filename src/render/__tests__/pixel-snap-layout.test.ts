import { readFileSync } from 'fs';
import { join } from 'path';
import {
  BALL_DRAW_SCALE,
  matchPitchLayout,
  PLAYER_DRAW_SCALE,
  snapSpriteScale,
} from '../interpolate';
import { snapDevicePixels } from '../pixel-grid';

/**
 * docs/11-art-style.md: "On-screen scaling is always an integer multiple".
 * The pitch->screen factor is continuous, so the shipped magnification used to
 * be fractional on every device (1.43 on an SE, 0.83 on a 1280x800 desktop —
 * below 1.0 means source texels are dropped outright). These tests pin the
 * contract: one source pixel always covers a whole number of device pixels.
 */

// MatchScreen reserves this much vertical space for its coaching chrome before
// sizing the pitch. Mirrored here so the device table below produces the real
// shipped numbers; `reserves the chrome heights this table assumes` guards it.
function availablePitchHeight(viewportHeight: number): number {
  return Math.max(280, viewportHeight - (viewportHeight < 760 ? 226 : 286));
}

interface Device {
  name: string;
  width: number;
  height: number;
  dpr: number;
  /** Source-px -> device-px ratio before snapping. Documents the defect. */
  unsnappedPlayerRatio: number;
}

const DEVICES: readonly Device[] = [
  { name: 'iPhone SE', width: 375, height: 667, dpr: 2, unsnappedPlayerRatio: 1.43 },
  { name: 'iPhone 14/15', width: 390, height: 844, dpr: 3, unsnappedPlayerRatio: 2.71 },
  { name: 'iPhone 15 Pro Max', width: 430, height: 932, dpr: 3, unsnappedPlayerRatio: 3.14 },
  { name: 'Android (Pixel-class)', width: 411, height: 823, dpr: 2.625, unsnappedPlayerRatio: 2.28 },
  { name: 'iPad', width: 768, height: 1024, dpr: 2, unsnappedPlayerRatio: 2.39 },
  { name: 'Desktop 1280x800', width: 1280, height: 800, dpr: 1, unsnappedPlayerRatio: 0.83 },
  { name: 'Desktop 1920x1080', width: 1920, height: 1080, dpr: 1, unsnappedPlayerRatio: 1.29 },
];

describe('match pitch pixel-grid layout', () => {
  test.each(DEVICES)('$name magnifies sprites by a whole number of device pixels', device => {
    const layout = matchPitchLayout(device.width, availablePitchHeight(device.height), device.dpr);

    for (const sprite of [layout.player, layout.ball]) {
      expect(Number.isInteger(sprite.devicePixels)).toBe(true);
      // The draw scale is derived from the integer, so the product must land
      // back on it exactly — that product is what Skia magnifies by.
      expect(Math.abs(layout.scale * sprite.drawScale * device.dpr - sprite.devicePixels))
        .toBeLessThan(1e-9);
    }
  });

  test.each(DEVICES)('$name never samples below one device pixel per source pixel', device => {
    const layout = matchPitchLayout(device.width, availablePitchHeight(device.height), device.dpr);

    // Below 1.0 the GPU discards source texels; on a hi-dpi screen we also hold
    // ~1dp per source pixel, which is the footprint the sprites were drawn for.
    const floor = Math.max(1, Math.floor(device.dpr));
    expect(layout.player.devicePixels).toBeGreaterThanOrEqual(floor);
    expect(layout.ball.devicePixels).toBeGreaterThanOrEqual(floor);
  });

  test('every hi-dpi device gets at least 2 device pixels per source pixel', () => {
    for (const device of DEVICES.filter(entry => entry.dpr >= 2)) {
      const layout = matchPitchLayout(device.width, availablePitchHeight(device.height), device.dpr);
      expect(layout.player.devicePixels).toBeGreaterThanOrEqual(2);
      expect(layout.ball.devicePixels).toBeGreaterThanOrEqual(2);
    }
  });

  test.each(DEVICES)('$name was fractional before snapping', device => {
    // Regression witness: without the fix each of these ratios is a float, so
    // the assertions above would be vacuous if snapping silently stopped.
    const layout = matchPitchLayout(device.width, availablePitchHeight(device.height), device.dpr);
    const unsnapped = layout.scale * PLAYER_DRAW_SCALE * device.dpr;

    expect(unsnapped).toBeCloseTo(device.unsnappedPlayerRatio, 1);
    expect(Number.isInteger(unsnapped)).toBe(false);
  });

  test.each(DEVICES)('$name keeps the canvas width whole', device => {
    const layout = matchPitchLayout(device.width, availablePitchHeight(device.height), device.dpr);

    expect(Number.isInteger(layout.pitchWidth)).toBe(true);
    expect(layout.pitchWidth).toBeLessThanOrEqual(device.width);
  });

  test.each(DEVICES)('$name keeps sprites near their authored footprint', device => {
    const layout = matchPitchLayout(device.width, availablePitchHeight(device.height), device.dpr);
    const nominalPlayer = layout.scale * PLAYER_DRAW_SCALE * device.dpr;
    const nominalBall = layout.scale * BALL_DRAW_SCALE * device.dpr;

    // Snapping quantises size as well as sharpness. Bound the drift so this
    // stays a sharpness fix rather than a silent art resize.
    expect(layout.player.devicePixels / nominalPlayer).toBeGreaterThan(0.75);
    expect(layout.player.devicePixels / nominalPlayer).toBeLessThan(1.45);
    expect(layout.ball.devicePixels / nominalBall).toBeGreaterThan(0.9);
    expect(layout.ball.devicePixels / nominalBall).toBeLessThan(1.25);
  });

  test('holds across the whole realistic viewport range', () => {
    for (let width = 320; width <= 1920; width += 43) {
      for (let height = 560; height <= 1400; height += 31) {
        for (const dpr of [1, 1.5, 2, 2.625, 2.75, 3, 3.5]) {
          const layout = matchPitchLayout(width, availablePitchHeight(height), dpr);
          const floor = Math.max(1, Math.floor(dpr));

          for (const sprite of [layout.player, layout.ball]) {
            expect(Number.isInteger(sprite.devicePixels)).toBe(true);
            expect(sprite.devicePixels).toBeGreaterThanOrEqual(floor);
            expect(Math.abs(layout.scale * sprite.drawScale * dpr - sprite.devicePixels))
              .toBeLessThan(1e-9);
          }
          expect(Number.isInteger(layout.pitchWidth)).toBe(true);
        }
      }
    }
  });
});

describe('snapSpriteScale', () => {
  test('already-integer magnification is left alone', () => {
    // scale 0.1 * 20 * 2 == 4 exactly, so the draw scale must not move.
    const snapped = snapSpriteScale(0.1, 20, 2);

    expect(snapped.devicePixels).toBe(4);
    expect(snapped.drawScale).toBeCloseTo(20, 10);
  });

  test('rounds to the nearest whole device pixel, not down', () => {
    expect(snapSpriteScale(1, 2.6, 1).devicePixels).toBe(3);
    expect(snapSpriteScale(1, 2.4, 1).devicePixels).toBe(2);
  });

  test('a nonsensical device pixel ratio still yields a usable scale', () => {
    const snapped = snapSpriteScale(0.05, 17, 0);

    expect(snapped.devicePixels).toBe(1);
    expect(Number.isFinite(snapped.drawScale)).toBe(true);
  });
});

describe('renderer wiring contract', () => {
  const renderDir = join(process.cwd(), 'src', 'render');

  test('MatchScreen reserves the chrome heights this table assumes', () => {
    const source = readFileSync(join(renderDir, 'MatchScreen.tsx'), 'utf8');

    expect(source).toContain('compactHeight ? 226 : 286');
    expect(source).toContain('Math.max(280, height - reservedChromeHeight)');
    // Post-merge the rail-reduced width is fed in, so snapping is computed
    // against the space the pitch actually receives.
    expect(source).toContain('matchPitchLayout(availablePitchWidth, availablePitchHeight, devicePixelRatio)');
  });

  test('MatchScreen feeds every sprite consumer the snapped draw scale', () => {
    const code = readFileSync(join(renderDir, 'MatchScreen.tsx'), 'utf8')
      .replace(/\/\/[^\n]*/g, ''); // the constants are still named in comments

    // The nominal constants now live in interpolate.ts; any reappearance in
    // code means a consumer went back to the unsnapped fractional value.
    expect(code).not.toContain('PLAYER_DRAW_SCALE');
    expect(code).not.toContain('BALL_DRAW_SCALE');
  });

  test('every atlas transform rounds its translate to whole device pixels', () => {
    const source = readFileSync(join(renderDir, 'worklet-atlas-frame.ts'), 'utf8');
    const setCalls = (source.match(/xf\.set\(/g) ?? []).length;
    const snapCalls = (source.match(/snapDevicePixels\(/g) ?? []).length;

    // Two RSXform writers (ball + player), two translate arguments each. A raw
    // float translate re-introduces the per-frame sub-pixel phase shift that
    // makes the sprites shimmer.
    expect(setCalls).toBe(2);
    expect(snapCalls).toBe(setCalls * 2);
    // ...and it must be the shared rule, not a private re-implementation.
    expect(source).toContain("from './pixel-grid'");
  });

  test('the drill stage snaps its sprite magnifications like the match pitch', () => {
    // DrillSceneOverlay used to hand its atlas raw fractional scales (4.1 /
    // 3.1), smearing the pixel art at every dpr. The nominal constants stay,
    // but the worklet must only ever read the snapped shared values.
    const source = readFileSync(join(renderDir, 'DrillSceneOverlay.tsx'), 'utf8');

    expect(source).toContain('snapSpriteScale(1, NOMINAL_PLAYER_SCALE, devicePixelRatio)');
    expect(source).toContain('snapSpriteScale(1, NOMINAL_BALL_SCALE, devicePixelRatio)');
    expect(source).toContain('const playerScale = playerMagnification.value;');
    expect(source).toContain('const ballScale = ballMagnification.value;');

    // With pitchScale 1 the RSXform scale maps source px -> dp, so the snapped
    // magnification must land on whole device pixels at every real-world dpr.
    for (const dpr of [1, 1.5, 2, 2.625, 3]) {
      for (const nominal of [4.1, 3.1]) {
        const snapped = snapSpriteScale(1, nominal, dpr);
        expect(Number.isInteger(snapped.devicePixels)).toBe(true);
        expect(Math.abs(snapped.drawScale * dpr - snapped.devicePixels)).toBeLessThan(1e-9);
      }
    }
  });

  test('one device-pixel snapping rule, shared by the camera, sprites and FX', () => {
    const inlineRule = /Math\.round\([^\n]*\* *dpr\) *\/ *dpr/;
    for (const file of ['interpolate.ts', 'worklet-atlas-frame.ts', 'WorkletMatchOverlays.tsx']) {
      expect(readFileSync(join(renderDir, file), 'utf8')).not.toMatch(inlineRule);
    }
    expect(snapDevicePixels(10.4, 3)).toBeCloseTo(10 + 1 / 3, 10);
    expect(snapDevicePixels(10.4, 1)).toBe(10);
    // A sub-1 ratio would otherwise quantise dp positions into multi-dp jumps.
    expect(snapDevicePixels(10.4, 0.5)).toBe(10);
  });
});
