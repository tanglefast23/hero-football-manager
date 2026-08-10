import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SharedValue } from 'react-native-reanimated';
import { RENDER_PLAYER_COUNT } from '../../sim/entities';

jest.mock('@shopify/react-native-skia', () => ({
  useRSXformBuffer: jest.fn(),
}));
jest.mock('react-native-reanimated', () => ({
  Easing: { linear: jest.fn() },
  cancelAnimation: jest.fn(),
  useDerivedValue: jest.fn(),
  useSharedValue: jest.fn(),
  withTiming: jest.fn(),
}));
jest.mock('react-native-worklets', () => ({
  scheduleOnUI: jest.fn(),
}));

const {
  retargetAtlasFrameOnUI,
  sampleRawRetargetPositions,
  sampleRawRetargetValue,
} =
  require('../worklet-atlas-frame') as typeof import('../worklet-atlas-frame');
const { withTiming } = require('react-native-reanimated') as {
  withTiming: jest.Mock;
};

const ATLAS_SLOT_COUNT = RENDER_PLAYER_COUNT + 1;

function positions(fill: (slot: number, axis: 0 | 1) => number): Float32Array {
  const output = new Float32Array(ATLAS_SLOT_COUNT * 2);
  for (let slot = 0; slot < ATLAS_SLOT_COUNT; slot += 1) {
    output[slot * 2] = fill(slot, 0);
    output[slot * 2 + 1] = fill(slot, 1);
  }
  return output;
}

function shared<T>(value: T): SharedValue<T> {
  return { value } as unknown as SharedValue<T>;
}

function sharedFloat(
  value: Float32Array<ArrayBufferLike>,
): SharedValue<Float32Array<ArrayBufferLike>> {
  return shared<Float32Array<ArrayBufferLike>>(value);
}

describe('worklet Atlas continuity retargeting', () => {
  beforeEach(() => {
    withTiming.mockReset();
    withTiming.mockImplementation((target: number) => target);
  });

  test('samples players and the ball from the same raw in-flight progress', () => {
    const previous = positions((slot, axis) => slot * 100 + axis * 10);
    const next = positions((slot, axis) => slot * 100 + axis * 10 + 40);
    const incoming = positions((slot, axis) => slot * 100 + axis * 10 + 100);
    const visibility = new Float32Array(RENDER_PLAYER_COUNT).fill(1);

    const sampled = sampleRawRetargetPositions(
      previous,
      next,
      visibility,
      visibility,
      0.25,
      incoming,
      false,
    );

    expect(sampled[0]).toBe(10);
    expect(sampled[1]).toBe(20);
    const ballOffset = RENDER_PLAYER_COUNT * 2;
    expect(sampled[ballOffset]).toBe(previous[ballOffset] + 10);
    expect(sampled[ballOffset + 1]).toBe(previous[ballOffset + 1] + 10);
    expect(sampled[0]).not.toBe(incoming[0]);
  });

  test('keeps a newly visible entity at the target it was already displaying', () => {
    const previous = positions(() => -1000);
    const next = positions((slot, axis) => slot * 100 + axis * 10);
    const incoming = positions((slot, axis) => slot * 100 + axis * 10 + 25);
    const previousVisibility = new Float32Array(RENDER_PLAYER_COUNT).fill(1);
    const nextVisibility = new Float32Array(RENDER_PLAYER_COUNT).fill(1);
    previousVisibility[RENDER_PLAYER_COUNT - 1] = 0;

    const sampled = sampleRawRetargetPositions(
      previous,
      next,
      previousVisibility,
      nextVisibility,
      0.5,
      incoming,
      false,
    );
    const offset = (RENDER_PLAYER_COUNT - 1) * 2;

    expect(sampled[offset]).toBe(next[offset]);
    expect(sampled[offset + 1]).toBe(next[offset + 1]);
  });

  test('an explicit restart snap uses the incoming positions immediately', () => {
    const previous = positions(() => 0);
    const next = positions(() => 100);
    const incoming = positions((slot, axis) => slot * 100 + axis * 10 + 500);
    const visibility = new Float32Array(RENDER_PLAYER_COUNT).fill(1);

    const sampled = sampleRawRetargetPositions(
      previous,
      next,
      visibility,
      visibility,
      0.5,
      incoming,
      true,
    );

    expect(sampled).toBe(incoming);
  });

  test('keeps ball height and presentation time continuous at an interrupted publish', () => {
    expect(sampleRawRetargetValue(10, 30, 0.25, 80, false)).toBe(15);
    expect(sampleRawRetargetValue(9, 10, 0.5, 12, false)).toBe(9.5);
    expect(sampleRawRetargetValue(9, 10, 0.5, 12, true)).toBe(12);
  });

  test('installs a coherent atomic state and supports consecutive incomplete retargets', () => {
    const visible = new Float32Array(RENDER_PLAYER_COUNT).fill(1);
    const previousPositions = sharedFloat(positions(() => 0));
    const nextPositions = sharedFloat(positions(() => 40));
    const previousVisibility = sharedFloat(visible.slice());
    const nextVisibility = sharedFloat(visible.slice());
    const previousBallHeight = shared(0);
    const nextBallHeight = shared(20);
    const actionData = sharedFloat(new Float32Array(RENDER_PLAYER_COUNT * 8));
    const statuses = sharedFloat(new Float32Array(RENDER_PLAYER_COUNT));
    const zoneFractions = sharedFloat(new Float32Array(RENDER_PLAYER_COUNT));
    const carrier = shared(-1);
    const previousVisualTick = shared(9);
    const nextVisualTick = shared(10);
    const progress = shared(0.5);
    const firstIncoming = positions(() => 100);
    const firstActions = new Float32Array(RENDER_PLAYER_COUNT * 8).fill(2);
    const firstStatuses = new Float32Array(RENDER_PLAYER_COUNT).fill(3);
    const firstZones = new Float32Array(RENDER_PLAYER_COUNT).fill(0.75);

    retargetAtlasFrameOnUI(
      previousPositions,
      nextPositions,
      previousVisibility,
      nextVisibility,
      previousBallHeight,
      nextBallHeight,
      actionData,
      statuses,
      zoneFractions,
      carrier,
      previousVisualTick,
      nextVisualTick,
      progress,
      firstIncoming,
      visible.slice(),
      60,
      firstActions,
      firstStatuses,
      firstZones,
      7,
      12,
      33,
      false,
    );

    expect(previousPositions.value[0]).toBe(20);
    expect(nextPositions.value).toBe(firstIncoming);
    expect(previousBallHeight.value).toBe(10);
    expect(nextBallHeight.value).toBe(60);
    expect(previousVisualTick.value).toBe(9.5);
    expect(nextVisualTick.value).toBe(12);
    expect(actionData.value).toBe(firstActions);
    expect(statuses.value).toBe(firstStatuses);
    expect(zoneFractions.value).toBe(firstZones);
    expect(carrier.value).toBe(7);
    expect(progress.value).toBe(1);
    expect(withTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: 33 }),
    );

    progress.value = 0.25;
    const secondIncoming = positions(() => 200);
    retargetAtlasFrameOnUI(
      previousPositions,
      nextPositions,
      previousVisibility,
      nextVisibility,
      previousBallHeight,
      nextBallHeight,
      actionData,
      statuses,
      zoneFractions,
      carrier,
      previousVisualTick,
      nextVisualTick,
      progress,
      secondIncoming,
      visible.slice(),
      100,
      firstActions,
      firstStatuses,
      firstZones,
      8,
      14,
      33,
      false,
    );

    expect(previousPositions.value[0]).toBe(40);
    expect(previousBallHeight.value).toBe(22.5);
    expect(previousVisualTick.value).toBeCloseTo(10.125);
    expect(nextVisualTick.value).toBe(14);
  });

  test('hard-snaps every endpoint and skips timing', () => {
    const hidden = new Float32Array(RENDER_PLAYER_COUNT);
    const incomingVisibility = new Float32Array(RENDER_PLAYER_COUNT).fill(1);
    const previousPositions = sharedFloat(positions(() => 0));
    const nextPositions = sharedFloat(positions(() => 40));
    const previousVisibility = sharedFloat(hidden.slice());
    const nextVisibility = sharedFloat(hidden.slice());
    const previousBallHeight = shared(0);
    const nextBallHeight = shared(20);
    const actionData = sharedFloat(new Float32Array(RENDER_PLAYER_COUNT * 8));
    const statuses = sharedFloat(new Float32Array(RENDER_PLAYER_COUNT));
    const zoneFractions = sharedFloat(new Float32Array(RENDER_PLAYER_COUNT));
    const carrier = shared(-1);
    const previousVisualTick = shared(4);
    const nextVisualTick = shared(5);
    const progress = shared(0.5);
    const incoming = positions(() => 500);
    const incomingActions = new Float32Array(RENDER_PLAYER_COUNT * 8).fill(4);
    const incomingStatuses = new Float32Array(RENDER_PLAYER_COUNT).fill(2);
    const incomingZones = new Float32Array(RENDER_PLAYER_COUNT).fill(1);

    retargetAtlasFrameOnUI(
      previousPositions,
      nextPositions,
      previousVisibility,
      nextVisibility,
      previousBallHeight,
      nextBallHeight,
      actionData,
      statuses,
      zoneFractions,
      carrier,
      previousVisualTick,
      nextVisualTick,
      progress,
      incoming,
      incomingVisibility,
      80,
      incomingActions,
      incomingStatuses,
      incomingZones,
      3,
      20,
      33,
      true,
    );

    expect(previousPositions.value).toBe(incoming);
    expect(nextPositions.value).toBe(incoming);
    expect(previousVisibility.value).toBe(incomingVisibility);
    expect(nextVisibility.value).toBe(incomingVisibility);
    expect(previousBallHeight.value).toBe(80);
    expect(nextBallHeight.value).toBe(80);
    expect(previousVisualTick.value).toBe(20);
    expect(nextVisualTick.value).toBe(20);
    expect(actionData.value).toBe(incomingActions);
    expect(statuses.value).toBe(incomingStatuses);
    expect(zoneFractions.value).toBe(incomingZones);
    expect(carrier.value).toBe(3);
    expect(progress.value).toBe(1);
    expect(withTiming).not.toHaveBeenCalled();
  });

  test('retargets atomically on UI from raw buffers and exposes continuous visual time', () => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'render', 'worklet-atlas-frame.ts'),
      'utf8',
    );
    const retargetBody = source.slice(
      source.indexOf('function retargetAtlasFrameOnUI('),
      source.indexOf('function pauseAtlasFrameOnUI('),
    );
    const publishBody = source.slice(
      source.indexOf('const publish = useCallback('),
      source.indexOf('const pause = useCallback('),
    );

    expect(retargetBody).toContainSource("'worklet';");
    expect(retargetBody).toContainSource('sampleRawRetargetPositions(');
    expect(retargetBody).not.toContainSource('visualPositions');
    expect(retargetBody).toContainSource('previousBallHeight.value');
    expect(retargetBody).toContainSource('previousVisualTick.value');
    expect(retargetBody).toContainSource('progress.value = snap ? 1 : 0;');
    expect(retargetBody).toContainSource('if (snap) return;');
    expect(publishBody).toContainSource('runOnAtlasRuntime(');
    expect(publishBody).not.toContainSource('progress.value');
    expect(source).toContainSource('visualTick: SharedValue<number>;');
    expect(source).toContainSource('if (IS_WEB_RUNTIME) {');
    expect(source).toContainSource('worklet(...args);');
    expect(source).toContainSource('scheduleOnUI(worklet, ...args);');
  });

  test('routes action and overlay time through the retargeted visual clock', () => {
    const atlas = readFileSync(
      join(process.cwd(), 'src', 'render', 'worklet-atlas-frame.ts'),
      'utf8',
    );
    const overlays = readFileSync(
      join(process.cwd(), 'src', 'render', 'WorkletMatchOverlays.tsx'),
      'utf8',
    );

    expect(atlas).not.toContainSource('simTick.value - 1 + t');
    expect(overlays).not.toContainSource('simTick.value - 1 + progress.value');
    expect(overlays).not.toContainSource('simTick: SharedValue<number>');
    expect(overlays).toContainSource('visualTick: SharedValue<number>');
  });

  test('keeps the final frame mounted long enough for the scheduled UI publish', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src', 'render', 'MatchScreen.tsx'),
      'utf8',
    );

    expect(screen).toContainSource(
      'winner === undefined ? reduceMotion ? 0 : FULLTIME_HOLD_MS',
    );
    expect(screen).toContainSource('FULLTIME_RIVAL_VICTORY_HOLD_MS');
    expect(screen).toContainSource('FULLTIME_RIVAL_VICTORY_FADE_AT_MS');
    expect(screen).toContainSource('duration: FULLTIME_RIVAL_VICTORY_FADE_MS');
    expect(screen).toContainSource(
      "snap || pauseAfterPublish || s.phase === 'fulltime'",
    );
    expect(screen).toContainSource(
      '} else if (now >= fulltimeDeadlineRef.current) {',
    );
  });

  test('publishes and snaps a tutorial tick before pausing its UI animation', () => {
    const screen = readFileSync(
      join(process.cwd(), 'src', 'render', 'MatchScreen.tsx'),
      'utf8',
    );
    const loop = screen.slice(
      screen.indexOf('const loop = (now: number) => {'),
      screen.indexOf("if (s.phase === 'fulltime') {"),
    );

    expect(loop).toContainSource('pauseAfterPublish = true;');
    expect(loop).toContainSource('snap || pauseAfterPublish');
    expect(loop.indexOf('publishAtlasFrame(')).toBeLessThan(
      loop.indexOf('if (pauseAfterPublish) syncPauseReasons();'),
    );
  });
});
