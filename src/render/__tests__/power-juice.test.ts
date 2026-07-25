import { readFileSync } from 'fs';
import { join } from 'path';
import {
  MATCH_SHAKE_AMPLITUDE_PT,
  matchCameraOffset,
  matchShakeOffset,
  snapSpriteScale,
} from '../interpolate';
import { MIN_MATCH_PLAYBACK_RATE, matchPlaybackRate } from '../match-speed';
import {
  POWER_JUICE_DILATION_STEPS,
  POWER_JUICE_END_MS,
  POWER_JUICE_HERO_FLASH_MS,
  POWER_JUICE_HOLD_END_MS,
  POWER_JUICE_PUNCH_ZOOM,
  hasPowerJuiceExtras,
  powerCutInGroupPolicy,
  powerJuice,
  powerJuiceDilation,
  powerJuiceHeroTint,
} from '../power-cut-in';
import { TICK_MS } from '../../sim/geometry';

describe('activation time dilation', () => {
  it('drops into slow motion, holds, and returns to full speed', () => {
    expect(powerJuiceDilation(-1)).toBe(1);
    expect(powerJuiceDilation(0)).toBe(0.5);
    expect(powerJuiceDilation(79)).toBe(0.5);
    expect(powerJuiceDilation(80)).toBe(0.15);
    expect(powerJuiceDilation(259)).toBe(0.15);
    expect(powerJuiceDilation(260)).toBe(0.35);
    expect(powerJuiceDilation(400)).toBe(0.7);
    expect(powerJuiceDilation(POWER_JUICE_END_MS)).toBe(1);
    expect(powerJuiceDilation(5000)).toBe(1);
  });

  it('is a small step ladder, so a whole activation re-issues the tick window four times', () => {
    expect(POWER_JUICE_DILATION_STEPS).toHaveLength(4);
    // Monotonically increasing windows, all inside the beat sheet.
    const bounds = POWER_JUICE_DILATION_STEPS.map(step => step.untilMs);
    expect([...bounds].sort((a, b) => a - b)).toEqual(bounds);
    expect(bounds[bounds.length - 1]).toBe(POWER_JUICE_END_MS);
    for (const step of POWER_JUICE_DILATION_STEPS) {
      expect(step.dilation).toBeGreaterThan(0);
      expect(step.dilation).toBeLessThan(1);
    }
  });

  it('is over inside the ~0.56s the locked static-wide-view decision allows', () => {
    expect(POWER_JUICE_END_MS).toBeLessThanOrEqual(600);
  });
});

describe('matchPlaybackRate', () => {
  it('scales the chosen speed by the dilation and never divides by zero', () => {
    expect(matchPlaybackRate(1, 1)).toBe(1);
    expect(matchPlaybackRate(3, 1)).toBe(3);
    expect(matchPlaybackRate(1, 0.15)).toBeCloseTo(0.15);
    expect(matchPlaybackRate(2, 0.15)).toBeCloseTo(0.3);
    expect(matchPlaybackRate(1, 0)).toBe(MIN_MATCH_PLAYBACK_RATE);
    expect(matchPlaybackRate(1, -5)).toBe(MIN_MATCH_PLAYBACK_RATE);
  });

  it('stretches the interpolation window instead of clamping it to one tick', () => {
    // The old Math.max(1, speed) floor made every dilated tick interpolate over
    // a normal TICK_MS and then sit still — a stutter, not slow motion.
    const slowest = TICK_MS / matchPlaybackRate(1, 0.15);
    expect(slowest).toBeGreaterThan(TICK_MS);
    expect(TICK_MS / Math.max(MIN_MATCH_PLAYBACK_RATE, matchPlaybackRate(1, 0))).toBe(TICK_MS * 10);
  });
});

describe('per-power juice flavour', () => {
  it('gives the shake to the strength power only', () => {
    expect(powerJuice('SUPER_STRENGTH')).toEqual({
      shake: true, flash: false, speedLines: false, punchIn: false,
    });
    expect(powerJuice('SUPER_SPEED').shake).toBe(false);
    expect(powerJuice('ELASTIC_KEEPER').shake).toBe(false);
  });

  it('gives the white flash and speed lines to the speed powers', () => {
    for (const power of ['SUPER_SPEED', 'BLINK_RUN', 'PHASE_RUN'] as const) {
      expect(powerJuice(power).flash).toBe(true);
      expect(powerJuice(power).speedLines).toBe(true);
      expect(powerJuice(power).punchIn).toBe(false);
    }
  });

  it('gives the camera punch-in to the keeper powers', () => {
    for (const power of ['ELASTIC_KEEPER', 'GIANT_GK'] as const) {
      expect(powerJuice(power).punchIn).toBe(true);
      expect(powerJuice(power).flash).toBe(false);
    }
  });

  it('leaves every other power on the shared sheet alone', () => {
    expect(hasPowerJuiceExtras('THUNDER_STRIKE')).toBe(false);
    expect(hasPowerJuiceExtras('RALLY_CRY')).toBe(false);
    expect(hasPowerJuiceExtras('SUPER_STRENGTH')).toBe(true);
    expect(hasPowerJuiceExtras('GIANT_GK')).toBe(true);
  });
});

describe('hero body flash', () => {
  it('alternates white and gold four times across the drop and hold', () => {
    expect(powerJuiceHeroTint(-1)).toBe('none');
    expect(powerJuiceHeroTint(0)).toBe('white');
    expect(powerJuiceHeroTint(POWER_JUICE_HERO_FLASH_MS)).toBe('gold');
    expect(powerJuiceHeroTint(POWER_JUICE_HERO_FLASH_MS * 2)).toBe('white');
    expect(powerJuiceHeroTint(POWER_JUICE_HERO_FLASH_MS * 3)).toBe('gold');
    expect(powerJuiceHeroTint(POWER_JUICE_HOLD_END_MS)).toBe('none');
    expect(powerJuiceHeroTint(POWER_JUICE_END_MS)).toBe('none');
  });

  it('divides the hold window into whole steps, with no sliver at the end', () => {
    expect(POWER_JUICE_HOLD_END_MS % POWER_JUICE_HERO_FLASH_MS).toBe(0);
  });
});

describe('matchShakeOffset', () => {
  it('is silent outside its window', () => {
    expect(matchShakeOffset(-1, 220, 3)).toEqual({ x: 0, y: 0 });
    expect(matchShakeOffset(220, 220, 3)).toEqual({ x: 0, y: 0 });
    expect(matchShakeOffset(999, 220, 3)).toEqual({ x: 0, y: 0 });
    expect(matchShakeOffset(10, 0, 3)).toEqual({ x: 0, y: 0 });
  });

  it('decays, and never exceeds the amplitude on either axis', () => {
    const amplitude = MATCH_SHAKE_AMPLITUDE_PT;
    let previousPeak = Infinity;
    for (let elapsed = 0; elapsed < 220; elapsed += 10) {
      const offset = matchShakeOffset(elapsed, 220, amplitude);
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(amplitude);
      // The vertical throw is deliberately shorter than the horizontal one.
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(amplitude * 0.7);
      const envelope = amplitude * (1 - elapsed / 220) ** 2;
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(envelope + 1e-9);
      previousPeak = envelope;
    }
    expect(previousPeak).toBeLessThan(amplitude);
  });

  it('is deterministic — the same elapsed time always gives the same offset', () => {
    expect(matchShakeOffset(37, 220, 3)).toEqual(matchShakeOffset(37, 220, 3));
  });
});

describe('matchCameraOffset', () => {
  const width = 390;
  const height = 260;

  it('is identity at 1x apart from the shake', () => {
    const offset = matchCameraOffset(12, 200, width, height, 1, { x: 0, y: 0 }, 3);
    expect(offset).toEqual({ translateX: 0, translateY: 0, zoom: 1 });
  });

  it('snaps a fractional zoom request to an integer magnification step', () => {
    // A continuous zoom multiplies the snapped sprite magnification and puts
    // every source texel back on a fraction of a device pixel.
    expect(matchCameraOffset(100, 100, width, height, 1.5, { x: 0, y: 0 }, 2).zoom).toBe(2);
    expect(matchCameraOffset(100, 100, width, height, 2.4, { x: 0, y: 0 }, 2).zoom).toBe(2);
    expect(matchCameraOffset(100, 100, width, height, 0.4, { x: 0, y: 0 }, 2).zoom).toBe(1);
  });

  it('keeps an integer zoom on the device-pixel grid for every focus point', () => {
    for (const dpr of [1, 2, 3]) {
      for (let focusX = 0; focusX <= width; focusX += 7) {
        const offset = matchCameraOffset(
          focusX,
          focusX % height,
          width,
          height,
          POWER_JUICE_PUNCH_ZOOM,
          matchShakeOffset(focusX % 220, 220, MATCH_SHAKE_AMPLITUDE_PT),
          dpr,
        );
        expect(Number.isInteger(offset.translateX * dpr)).toBe(true);
        expect(Number.isInteger(offset.translateY * dpr)).toBe(true);
      }
    }
  });

  it('a whole-device-pixel camera keeps an already-snapped sprite scale whole', () => {
    // snapSpriteScale gives a magnification of N device pixels per source pixel;
    // an integer camera zoom multiplies it and must leave it a whole number.
    const snapped = snapSpriteScale(390 / 680, 17, 3);
    expect(Number.isInteger(snapped.devicePixels)).toBe(true);
    expect(Number.isInteger(snapped.devicePixels * POWER_JUICE_PUNCH_ZOOM)).toBe(true);
  });

  it('centres on the focus point but never shows past the touchline', () => {
    const centred = matchCameraOffset(width / 2, height / 2, width, height, 2, { x: 0, y: 0 }, 1);
    expect(centred).toEqual({
      translateX: -width / 2,
      translateY: -height / 2,
      zoom: 2,
    });

    // A keeper sits on the goal line; the window clamps to the pitch edge, so a
    // punch-in never reveals void beyond it. Visible left edge = -tx / zoom.
    for (const focus of [0, 5, width, width - 5]) {
      const offset = matchCameraOffset(focus, height / 2, width, height, 2, { x: 0, y: 0 }, 1);
      const visibleLeft = -offset.translateX / offset.zoom;
      expect(visibleLeft).toBeGreaterThanOrEqual(0);
      expect(visibleLeft + width / offset.zoom).toBeLessThanOrEqual(width + 1e-9);
    }
  });
});

describe('renderer juice wiring', () => {
  const renderDir = join(process.cwd(), 'src', 'render');
  const matchSource = () => readFileSync(join(renderDir, 'MatchScreen.tsx'), 'utf8');

  it('multiplies the dilation into the frame accumulator and nothing else', () => {
    const source = matchSource();

    expect(source).toContain('acc + (now - last) * matchPlaybackRate(speedRef.current, dilationRef.current)');
    // The sim must never see a delta: a dilated match still calls the same
    // fixed-step tick(s) in the same order.
    expect(source).toContain('if (!heldForPowerReview) tick(s);');
    expect(source).not.toContain('tick(s, ');
  });

  it('draws the whole pitch through one camera group, with the backdrop outside it', () => {
    const source = matchSource();

    expect(source).toContain('<Group transform={cameraTransform}>');
    expect(source).toContain('<Fill color="#3f8a4a" />\n              {/* The one match camera.');
    expect(source).toContain('{ scale: cameraZoom.value },');
  });

  it('reaches the camera only through the pixel-grid-safe helpers', () => {
    const source = matchSource();

    expect(source).toContain('matchCameraOffset(');
    expect(source).toContain('matchShakeOffset(elapsed, POWER_JUICE_SHAKE_MS, MATCH_SHAKE_AMPLITUDE_PT)');
    // No hand-rolled zoom ramp: the punch is a step between integers.
    expect(source).toContain('? POWER_JUICE_PUNCH_ZOOM\n        : 1;');
  });

  it('gives Reduce Motion none of it', () => {
    const source = matchSource();

    expect(source).toContain('const startJuice = (power: PowerId, player: number, now: number) => {\n      if (reduceMotion) return;');
    expect(source).toContain('reduceMotion ? null : cardSlamStyle');
  });

  it('keeps the activation non-blocking — no pause reason, no full-screen panel', () => {
    const source = matchSource();

    // docs/03 keeps the match on a static wide view and power-cut-in.ts records
    // that full-pitch panels failed playtesting. Slow motion replaces a hard
    // hit-stop precisely so the match never stops and the PAUSED chrome never
    // lights up mid-activation.
    expect(source).not.toContain("automaticPauseReasonsRef.current.add('cut-in')");
    expect(powerCutInGroupPolicy([{ skippable: true }]).shouldPause).toBe(false);
  });

  it('batches the speed lines into one hard-edged path', () => {
    const overlays = readFileSync(join(renderDir, 'WorkletMatchOverlays.tsx'), 'utf8');

    expect(overlays).toContain('export function WorkletSpeedLines(');
    expect(overlays).toContain('color={SPEED_LINE_COLOR} opacity={opacity} antiAlias={false}');
    // One usePathValue for all sixteen wedges, following WorkletSlideTackleEffects.
    const speedLineBody = overlays.slice(
      overlays.indexOf('export function WorkletSpeedLines('),
      overlays.indexOf('export function WorkletBallShadow('),
    );
    expect((speedLineBody.match(/usePathValue\(/g) ?? []).length).toBe(1);
    expect((speedLineBody.match(/<Path /g) ?? []).length).toBe(1);
  });

  it('lets the interpolation window stretch below one tick', () => {
    const worklet = readFileSync(join(renderDir, 'worklet-atlas-frame.ts'), 'utf8');

    expect(worklet).not.toContain('Math.max(1, speed)');
    expect((worklet.match(/Math\.max\(MIN_MATCH_PLAYBACK_RATE, speed\)/g) ?? []).length).toBe(2);
    // A mid-tick re-issue only has the unfinished fraction left to cover.
    expect(worklet).toContain('const remaining = Math.max(0, Math.min(1, 1 - progress.value));');
    expect(worklet).toContain('duration: (TICK_MS * remaining) / Math.max(MIN_MATCH_PLAYBACK_RATE, speed)');
  });
});

describe('awakening cutscene juice', () => {
  const cutsceneSource = () => readFileSync(
    join(process.cwd(), 'src', 'ui', 'screens', 'AwakeningCutsceneScreen.tsx'),
    'utf8',
  );

  it('shakes the scene open and punches in on the hobbling walk', () => {
    const source = cutsceneSource();

    expect(source).toContain('shakePhase.value = withTiming(1, {');
    expect(source).toContain('withTiming(HOBBLE_PUNCH_ZOOM, {');
    // The punch is a prefix on the existing push, so beat 1 still lands on 1.42
    // and every downstream ready/advance timing is untouched.
    expect(source).toContain('duration: LIMP_DURATION_MS + HUDDLE_DURATION_MS - HOBBLE_PUNCH_MS,');
    expect(source).toContain('withTiming(1.42, {');
  });

  it('flashes white as the power arrives, before the rise', () => {
    const source = cutsceneSource();

    expect(source).toContain('revealFlash.value = withSequence(');
    expect(source).toContain('withTiming(REVEAL_FLASH_OPACITY, {');
    expect(source).toContain('opacity={revealFlash}');
  });

  it('gives Reduce Motion neither the jolt nor the flash', () => {
    const source = cutsceneSource();

    expect(source).toContain('if (reduceMotion) {\n        cameraZoom.value = withTiming(1.2, { duration: 0 });');
    expect(source).toContain('if (!reduceMotion) {\n        revealFlash.value = withSequence(');
  });
});
