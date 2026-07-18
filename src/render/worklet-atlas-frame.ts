import { useCallback } from 'react';
import { useRSXformBuffer, type SkRSXform } from '@shopify/react-native-skia';
import {
  Easing,
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { TICK_MS } from '../sim/geometry';
import type { PitchFrame } from './interpolate';
import {
  KNOCKDOWN_DROP_TICKS,
  KNOCKDOWN_RISE_TICKS,
  TACKLED_RECOVERY_TICKS,
  type PlayerActionAnimation,
} from './animation';

const PLAYER_COUNT = 22;
const ATLAS_SLOT_COUNT = PLAYER_COUNT + 1;
const BALL_SLOT = PLAYER_COUNT;
const ACTION_STRIDE = 6;

const ACTION_NONE = 0;
const ACTION_SLIDE = 1;
const ACTION_FALL = 2;
const ACTION_KNOCKDOWN = 3;

interface WorkletAtlasOptions {
  initialFrame: PitchFrame;
  scale: number;
  playerCell: { width: number; height: number };
  ballCell: { width: number; height: number };
  playerDrawScale: number;
  ballDrawScale: number;
  ballFootForwardFraction: number;
  ballFootDownPx: number;
  ballFootDeadzonePx: number;
}

export interface WorkletAtlasController {
  transforms: ReturnType<typeof useRSXformBuffer>;
  visualPositions: SharedValue<Float32Array>;
  statuses: SharedValue<Float32Array>;
  zoneFractions: SharedValue<Float32Array>;
  carrier: SharedValue<number>;
  simTick: SharedValue<number>;
  progress: SharedValue<number>;
  publish: (
    previous: PitchFrame,
    next: PitchFrame,
    tick: number,
    speed: number,
    actions: Record<number, PlayerActionAnimation>
  ) => void;
  pause: () => void;
  resume: (speed: number) => void;
}

function packPositions(frame: PitchFrame): Float32Array {
  const packed = new Float32Array(ATLAS_SLOT_COUNT * 2);
  for (let i = 0; i < PLAYER_COUNT; i++) {
    packed[i * 2] = frame.players[i].x;
    packed[i * 2 + 1] = frame.players[i].y;
  }
  packed[BALL_SLOT * 2] = frame.ball.x;
  packed[BALL_SLOT * 2 + 1] = frame.ball.y;
  return packed;
}

function packActions(actions: Record<number, PlayerActionAnimation>): Float32Array {
  const packed = new Float32Array(PLAYER_COUNT * ACTION_STRIDE);
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const action = actions[i];
    if (!action) continue;
    const offset = i * ACTION_STRIDE;
    packed[offset] = action.kind === 'slide'
      ? ACTION_SLIDE
      : action.kind === 'fall'
        ? ACTION_FALL
        : ACTION_KNOCKDOWN;
    packed[offset + 1] = action.startTick;
    packed[offset + 2] = action.rotation;
    packed[offset + 3] = action.kind === 'slide' ? action.direction.x : action.anchor.x;
    packed[offset + 4] = action.kind === 'slide' ? action.direction.y : action.anchor.y;
    packed[offset + 5] = action.kind === 'slide' || action.kind === 'knockdown' ? action.untilTick : 0;
  }
  return packed;
}

function statusCode(status: PitchFrame['statuses'][number]): number {
  if (status === 'windup') return 1;
  if (status === 'active') return 2;
  if (status === 'out') return 3;
  if (status === 'ignited') return 4;
  if (status === 'zone') return 5;
  return 0;
}

function packStatuses(frame: PitchFrame): Float32Array {
  return Float32Array.from(frame.statuses, statusCode);
}

function clamp01Worklet(value: number): number {
  'worklet';
  return Math.max(0, Math.min(1, value));
}

function smoothstepWorklet(value: number): number {
  'worklet';
  const t = clamp01Worklet(value);
  return t * t * (3 - 2 * t);
}

function actionPoseWorklet(
  packed: Float32Array,
  index: number,
  visualTick: number
): { active: boolean; rotation: number; anchorWeight: number; forwardOffset: number } {
  'worklet';
  const offset = index * ACTION_STRIDE;
  const kind = packed[offset];
  if (kind === ACTION_NONE) {
    return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };
  }

  const elapsed = visualTick - packed[offset + 1];
  if (elapsed < 0) {
    return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };
  }

  const rotation = packed[offset + 2];
  if (kind === ACTION_KNOCKDOWN) {
    const untilTick = packed[offset + 5];
    if (visualTick >= untilTick) {
      return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };
    }
    const drop = smoothstepWorklet(elapsed / KNOCKDOWN_DROP_TICKS);
    const rise = smoothstepWorklet(
      (visualTick - (untilTick - KNOCKDOWN_RISE_TICKS)) / KNOCKDOWN_RISE_TICKS
    );
    const down = drop * (1 - rise);
    return { active: true, rotation: rotation * down, anchorWeight: down, forwardOffset: 0 };
  }

  const untilTick = packed[offset + 5];
  const duration = kind === ACTION_SLIDE ? untilTick - packed[offset + 1] : TACKLED_RECOVERY_TICKS;
  if (elapsed >= duration) {
    return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };
  }

  if (kind === ACTION_SLIDE) {
    const drop = smoothstepWorklet(elapsed / 1.2);
    const rise = smoothstepWorklet((visualTick - (untilTick - 3)) / 3);
    const low = drop * (1 - rise);
    return {
      active: true,
      rotation: rotation * low,
      anchorWeight: 0,
      // The sim coordinate now performs the lunge and remains at its landing
      // position. Adding a second render-only offset would double the travel.
      forwardOffset: 0,
    };
  }

  const fall = smoothstepWorklet(elapsed / 1.6);
  const recovery = smoothstepWorklet((elapsed - 5) / 5);
  return {
    active: true,
    rotation: rotation * fall * (1 - recovery),
    anchorWeight: 1 - recovery,
    forwardOffset: 0,
  };
}

/**
 * Drives the Atlas transform buffer on Reanimated's UI runtime. The JS match
 * loop publishes only tick-boundary snapshots; interpolation and the 23
 * per-slot RSXform updates happen inside this worklet mapper, so a 60/120 Hz
 * display no longer rebuilds transform objects or React state every frame.
 */
export function useWorkletAtlasFrame(options: WorkletAtlasOptions): WorkletAtlasController {
  const {
    initialFrame,
    scale,
    playerCell,
    ballCell,
    playerDrawScale,
    ballDrawScale,
    ballFootForwardFraction,
    ballFootDownPx,
    ballFootDeadzonePx,
  } = options;

  const previousPositions = useSharedValue<Float32Array>(() => packPositions(initialFrame));
  const nextPositions = useSharedValue<Float32Array>(() => packPositions(initialFrame));
  const actionData = useSharedValue<Float32Array>(() => new Float32Array(PLAYER_COUNT * ACTION_STRIDE));
  const statuses = useSharedValue<Float32Array>(() => packStatuses(initialFrame));
  const zoneFractions = useSharedValue<Float32Array>(() => Float32Array.from(initialFrame.zoneFraction));
  const carrier = useSharedValue(initialFrame.carrier);
  const simTick = useSharedValue(0);
  const progress = useSharedValue(1);

  // Widen the typed-array backing buffer to ArrayBufferLike. TypeScript 6
  // otherwise infers `new Float32Array(...)` as ArrayBuffer-backed only, which
  // is narrower than the SharedValue contract consumed by Skia/Reanimated.
  const visualPositions = useDerivedValue<Float32Array>(() => {
    const output = new Float32Array(PLAYER_COUNT * 2);
    const t = progress.value;
    const prev = previousPositions.value;
    const next = nextPositions.value;
    const packedActions = actionData.value;
    const visualTick = Math.max(0, simTick.value - 1 + t);
    for (let index = 0; index < PLAYER_COUNT; index += 1) {
      const packedOffset = index * 2;
      const x = prev[packedOffset] + (next[packedOffset] - prev[packedOffset]) * t;
      const y = prev[packedOffset + 1] + (next[packedOffset + 1] - prev[packedOffset + 1]) * t;
      const pose = actionPoseWorklet(packedActions, index, visualTick);
      const actionOffset = index * ACTION_STRIDE;
      const kind = packedActions[actionOffset];
      let centerX = x;
      let centerY = y;
      if (pose.active && kind === ACTION_SLIDE) {
        centerX += packedActions[actionOffset + 3] * pose.forwardOffset;
        centerY += packedActions[actionOffset + 4] * pose.forwardOffset;
      } else if (pose.active && (kind === ACTION_FALL || kind === ACTION_KNOCKDOWN)) {
        centerX = x * (1 - pose.anchorWeight) + packedActions[actionOffset + 3] * pose.anchorWeight;
        centerY = y * (1 - pose.anchorWeight) + packedActions[actionOffset + 4] * pose.anchorWeight;
      }
      output[packedOffset] = centerX;
      output[packedOffset + 1] = centerY;
    }
    return output;
  });

  const transforms = useRSXformBuffer(ATLAS_SLOT_COUNT, (xf: SkRSXform, index: number) => {
    'worklet';
    const t = progress.value;
    const prev = previousPositions.value;
    const next = nextPositions.value;
    const packedOffset = index * 2;
    const x = index === BALL_SLOT
      ? prev[packedOffset] + (next[packedOffset] - prev[packedOffset]) * t
      : visualPositions.value[packedOffset];
    const y = index === BALL_SLOT
      ? prev[packedOffset + 1] + (next[packedOffset + 1] - prev[packedOffset + 1]) * t
      : visualPositions.value[packedOffset + 1];

    if (index === BALL_SLOT) {
      const ballScale = scale * ballDrawScale;
      let offsetX = 0;
      let offsetY = 0;
      const heldBy = carrier.value;
      if (heldBy >= 0) {
        const playerOffset = heldBy * 2;
        const dx = next[playerOffset] - prev[playerOffset];
        const dy = next[playerOffset + 1] - prev[playerOffset + 1];
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        let ux = 0;
        let uy = heldBy < 11 ? -1 : 1;
        if (magnitude * scale >= ballFootDeadzonePx && magnitude > 0) {
          ux = dx / magnitude;
          uy = dy / magnitude;
        }
        const playerHalfWidth = (playerCell.width * scale * playerDrawScale) / 2;
        offsetX = ux * playerHalfWidth * ballFootForwardFraction;
        offsetY = uy * playerHalfWidth * ballFootForwardFraction + ballFootDownPx;
      }
      xf.set(
        ballScale,
        0,
        x * scale - (ballCell.width * ballScale) / 2 + offsetX,
        y * scale - (ballCell.height * ballScale) / 2 + offsetY
      );
      return;
    }

    const visualTick = Math.max(0, simTick.value - 1 + t);
    const pose = actionPoseWorklet(actionData.value, index, visualTick);
    const playerScale = scale * playerDrawScale;
    const scos = Math.cos(pose.rotation) * playerScale;
    const ssin = Math.sin(pose.rotation) * playerScale;
    xf.set(
      scos,
      ssin,
      x * scale - (scos * playerCell.width - ssin * playerCell.height) / 2,
      y * scale - (ssin * playerCell.width + scos * playerCell.height) / 2
    );
  });

  const publish = useCallback((
    previous: PitchFrame,
    next: PitchFrame,
    tick: number,
    speed: number,
    actions: Record<number, PlayerActionAnimation>
  ) => {
    previousPositions.value = packPositions(previous);
    nextPositions.value = packPositions(next);
    actionData.value = packActions(actions);
    statuses.value = packStatuses(next);
    zoneFractions.value = Float32Array.from(next.zoneFraction);
    carrier.value = next.carrier;
    simTick.value = tick;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: TICK_MS / Math.max(1, speed),
      easing: Easing.linear,
    });
  }, [previousPositions, nextPositions, actionData, statuses, zoneFractions, carrier, simTick, progress]);

  const pause = useCallback(() => {
    cancelAnimation(progress);
  }, [progress]);

  const resume = useCallback((speed: number) => {
    progress.value = withTiming(1, {
      duration: TICK_MS / Math.max(1, speed),
      easing: Easing.linear,
    });
  }, [progress]);

  return {
    transforms,
    visualPositions,
    statuses,
    zoneFractions,
    carrier,
    simTick,
    progress,
    publish,
    pause,
    resume,
  };
}
