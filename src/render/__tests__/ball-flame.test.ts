import { readFileSync } from 'fs';
import { join } from 'path';
import {
  BALL_FLAME_LAYERS,
  BALL_FLAME_TONGUE_COUNT,
  BALL_FLAME_WIDTH,
  ballFlameTongues,
} from '../ball-flame';

const outer = BALL_FLAME_LAYERS[0];
const at = (tick: number, reduceMotion = false) =>
  ballFlameTongues(100, 100, 1, outer, tick, reduceMotion);

describe('ball flame recipe', () => {
  it('wraps the ball instead of flanking it', () => {
    // The 5px ball sprite spans x 97.5..102.5 around a centre of 100. A headless
    // render at the original 11px span put the outer tongues beside the ball and
    // hid the middle one behind it: two candle flames and a white box.
    const tongues = at(7);
    expect(tongues).toHaveLength(BALL_FLAME_TONGUE_COUNT);
    expect(Math.min(...tongues.map((t) => t.baseLeftX))).toBeLessThan(97.5);
    expect(Math.max(...tongues.map((t) => t.baseRightX))).toBeGreaterThan(
      102.5,
    );
    // Neighbouring tongues must overlap, or they read as separate spikes.
    for (let i = 1; i < tongues.length; i += 1) {
      expect(tongues[i].baseLeftX).toBeLessThan(tongues[i - 1].baseRightX);
    }
  });

  it('burns upward from below the ball centre', () => {
    for (const t of at(7)) {
      expect(t.baseY).toBeGreaterThan(100);
      expect(t.tipY).toBeLessThan(t.baseY);
    }
  });

  it('flickers with the presentation tick, and freezes under Reduce Motion', () => {
    const a = at(7);
    const b = at(8);
    expect(a.map((t) => t.tipY)).not.toEqual(b.map((t) => t.tipY));
    expect(at(7, true).map((t) => t.tipY)).toEqual(
      at(99, true).map((t) => t.tipY),
    );
    // Frozen means still readable, never collapsed to nothing.
    for (const t of at(7, true)) {
      expect(t.baseY - t.tipY).toBeGreaterThan(1);
      expect(t.tipX).toBe((t.baseLeftX + t.baseRightX) / 2);
    }
  });

  it('scales its whole shape with the pitch', () => {
    const one = ballFlameTongues(100, 100, 1, outer, 7, false);
    const two = ballFlameTongues(100, 100, 2, outer, 7, false);
    const spread = (ts: typeof one) =>
      Math.max(...ts.map((t) => t.baseRightX)) -
      Math.min(...ts.map((t) => t.baseLeftX));
    expect(spread(two) / spread(one)).toBeCloseTo(2, 5);
    expect(spread(one)).toBeGreaterThan(BALL_FLAME_WIDTH * 0.9);
  });

  it('reads no clock and no randomness', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/render/ball-flame.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/Math\.random|Date\b|performance\.now/u);
  });

  it('is sized in screen pixels, never through the pitch scale', () => {
    // Shipped once as `ballFlameTongues(cx, cy, scale, ...)`. The pitch scale
    // converts pitch units to pixels and runs about 0.03, so the whole flame
    // came out half a pixel wide and the ball looked plain white on screen.
    const overlays = readFileSync(
      join(process.cwd(), 'src/render/WorkletMatchOverlays.tsx'),
      'utf8',
    );
    const call = overlays.slice(
      overlays.indexOf('const tongues = ballFlameTongues('),
    );
    expect(call.slice(0, 200)).not.toMatch(/\bscale,/u);
    // A flame must stay wider than the ball sprite at the size actually passed.
    const spread = (() => {
      const ts = ballFlameTongues(100, 100, 1, outer, 7, false);
      return (
        Math.max(...ts.map((t) => t.baseRightX)) -
        Math.min(...ts.map((t) => t.baseLeftX))
      );
    })();
    expect(spread).toBeGreaterThan(8);
  });

  it('is workletized, because WorkletBallFlame calls it on the UI thread', () => {
    // Shipped once without this. `react-native-worklets/plugin` only converts a
    // function that declares itself, so the call threw on the UI thread — and on
    // web that runs inside the RAF loop. The match froze mid-flight, no flame
    // drew, and the fire crackle looped forever with nothing left running to
    // stop it. One missing directive, three symptoms.
    const source = readFileSync(
      join(process.cwd(), 'src/render/ball-flame.ts'),
      'utf8',
    );
    const body = source.slice(
      source.indexOf('export function ballFlameTongues'),
    );
    expect(body).toMatch(/'worklet';/u);

    // Same guard for everything else WorkletBallFlame calls on the UI thread.
    const overlays = readFileSync(
      join(process.cwd(), 'src/render/WorkletMatchOverlays.tsx'),
      'utf8',
    );
    const flame = overlays.slice(overlays.indexOf('function BallFlameLayer'));
    const called = [
      ...flame.slice(0, 1200).matchAll(/\b(ball[A-Z]\w+)\(/gu),
    ].map((m) => m[1]);
    expect(called).toContain('ballFlameTongues');
    const visuals = readFileSync(
      join(process.cwd(), 'src/render/ball-flight-visuals.ts'),
      'utf8',
    );
    for (const fn of new Set(called)) {
      const src = fn === 'ballFlameTongues' ? source : visuals;
      const at = src.indexOf(`export function ${fn}`);
      expect(at).toBeGreaterThanOrEqual(0);
      expect(src.slice(at, at + 600)).toMatch(/'worklet';/u);
    }
  });
});
