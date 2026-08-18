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
import { scheduleOnUI } from 'react-native-worklets';
import { TICK_MS } from '../sim/geometry';
import { MIN_MATCH_PLAYBACK_RATE } from './match-speed';
import type { PitchFrame } from './interpolate';
import {
  KNOCKDOWN_DROP_TICKS,
  KNOCKDOWN_RISE_TICKS,
  SLIDE_TACKLE_TICKS,
  STAGGER_RECOIL_PIXELS,
  TACKLED_RECOVERY_TICKS,
  staggerPush,
  type PlayerActionAnimation,
} from './animation';
import { ballHeightScale, ballVisualOffset } from './ball-flight-visuals';
import { snapDevicePixels } from './pixel-grid';
import { zoneReadyPlayerScale } from './zone-ready-look';
import { HOME_DECOY_INDEX, RENDER_PLAYER_COUNT } from '../sim/entities';

const PLAYER_COUNT = RENDER_PLAYER_COUNT;
const ATLAS_SLOT_COUNT = PLAYER_COUNT + 1;
const BALL_SLOT = PLAYER_COUNT;
export const WORKLET_ACTION_STRIDE = 8;
export const WORKLET_ACTION_SLIDE = 1;
export const WORKLET_ACTION_STAGGER = 4;
const ACTION_STRIDE = WORKLET_ACTION_STRIDE;

const ACTION_NONE = 0;
const ACTION_SLIDE = WORKLET_ACTION_SLIDE;
const ACTION_FALL = 2;
const ACTION_KNOCKDOWN = 3;
const ACTION_STAGGER = WORKLET_ACTION_STAGGER;
const IS_WEB_RUNTIME = typeof document !== 'undefined';

interface WorkletAtlasOptions {
  initialFrame: PitchFrame;
  scale: number;
  playerCell: { width: number; height: number };
  actionCell: { width: number; height: number };
  ballCell: { width: number; height: number };
  /** Snapped via `snapSpriteScale` — see interpolate.ts. */
  playerDrawScale: number;
  /** Snapped via `snapSpriteScale` — see interpolate.ts. */
  ballDrawScale: number;
  /** Device pixels per dp, used to land sprite translates on whole texels. */
  devicePixelRatio: number;
  ballFootForwardFraction: number;
  ballFootDropSourcePx: number;
  ballFootDeadzonePx: number;
}

function runOnAtlasRuntime<Args extends unknown[], ReturnValue>(
  worklet: (...args: Args) => ReturnValue,
  ...args: Args
): void {
  if (IS_WEB_RUNTIME) {
    // Worklets' web scheduler defers to the next RAF. Web has one runtime, so
    // run synchronously to keep Atlas endpoints/statuses in the same frame as
    // the React scene/HUD commit that follows publish().
    worklet(...args);
    return;
  }
  scheduleOnUI(worklet, ...args);
}

export interface WorkletAtlasController {
  transforms: ReturnType<typeof useRSXformBuffer>;
  visualPositions: SharedValue<Float32Array>;
  visibility: SharedValue<Float32Array>;
  ballGroundPosition: SharedValue<Float32Array>;
  /** Centre of the ball as DRAWN, in dp — ground position + hold nudge + arc. */
  ballDrawPosition: SharedValue<Float32Array>;
  ballHeight: SharedValue<number>;
  statuses: SharedValue<Float32Array>;
  zoneFractions: SharedValue<Float32Array>;
  carrier: SharedValue<number>;
  visualTick: SharedValue<number>;
  actionData: SharedValue<Float32Array>;
  publish: (
    next: PitchFrame,
    tick: number,
    speed: number,
    actions: Record<number, PlayerActionAnimation>,
    snap: boolean,
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

/**
 * Packs the render-only action poses into the flat Float32Array the UI-thread
 * worklets read. Slots 3/4 carry whichever vector the kind steers by (a
 * direction for slide/stagger, a hold anchor for fall/knockdown) and slots 6/7 a
 * fixed pitch coordinate (the slide's launch point, the stagger's contact
 * point), so every kind fits the one ACTION_STRIDE without widening it.
 */
function packActions(
  actions: Record<number, PlayerActionAnimation>,
): Float32Array {
  const packed = new Float32Array(PLAYER_COUNT * ACTION_STRIDE);
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const action = actions[i];
    if (!action) continue;
    const offset = i * ACTION_STRIDE;
    packed[offset] =
      action.kind === 'slide'
        ? ACTION_SLIDE
        : action.kind === 'stagger'
          ? ACTION_STAGGER
          : action.kind === 'fall'
            ? ACTION_FALL
            : ACTION_KNOCKDOWN;
    packed[offset + 1] = action.startTick;
    packed[offset + 2] = action.rotation;
    packed[offset + 3] =
      action.kind === 'slide' || action.kind === 'stagger'
        ? action.direction.x
        : action.anchor.x;
    packed[offset + 4] =
      action.kind === 'slide' || action.kind === 'stagger'
        ? action.direction.y
        : action.anchor.y;
    packed[offset + 5] =
      action.kind === 'slide' || action.kind === 'knockdown'
        ? action.untilTick
        : 0;
    packed[offset + 6] =
      action.kind === 'slide'
        ? action.origin.x
        : action.kind === 'stagger'
          ? action.contact.x
          : 0;
    packed[offset + 7] =
      action.kind === 'slide'
        ? action.origin.y
        : action.kind === 'stagger'
          ? action.contact.y
          : 0;
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

/**
 * Samples the unposed position path at the instant a new sim frame arrives.
 *
 * This deliberately knows nothing about slide/stagger/fall presentation. Those
 * offsets are applied later by `visualPositions`; carrying them into the next
 * tick's interpolation base would permanently bake a temporary pose into player
 * locomotion. The visibility exception matches the mapper below: a slot that
 * just appeared was already drawn at its old target rather than between its
 * hidden placeholder and that target.
 */
export function sampleRawRetargetPositions(
  previous: Float32Array,
  next: Float32Array,
  previousVisibility: Float32Array,
  nextVisibility: Float32Array,
  progress: number,
  incoming: Float32Array,
  snap: boolean,
): Float32Array {
  'worklet';
  if (snap) return incoming;

  const output = new Float32Array(incoming.length);
  const t = Math.max(0, Math.min(1, progress));
  for (let index = 0; index < ATLAS_SLOT_COUNT; index += 1) {
    const offset = index * 2;
    const newlyVisible =
      index < PLAYER_COUNT &&
      previousVisibility[index] === 0 &&
      nextVisibility[index] === 1;
    output[offset] = newlyVisible
      ? next[offset]
      : previous[offset] + (next[offset] - previous[offset]) * t;
    output[offset + 1] = newlyVisible
      ? next[offset + 1]
      : previous[offset + 1] + (next[offset + 1] - previous[offset + 1]) * t;
  }
  return output;
}

function clamp01Worklet(value: number): number {
  'worklet';
  return Math.max(0, Math.min(1, value));
}

export function sampleRawRetargetValue(
  previous: number,
  next: number,
  progress: number,
  incoming: number,
  snap: boolean,
): number {
  'worklet';
  if (snap) return incoming;
  const t = clamp01Worklet(progress);
  return previous + (next - previous) * t;
}

function smoothstepWorklet(value: number): number {
  'worklet';
  const t = clamp01Worklet(value);
  return t * t * (3 - 2 * t);
}

function slideTackleFrameIndexWorklet(
  elapsed: number,
  duration: number,
): number {
  'worklet';
  const safeDuration = Math.max(SLIDE_TACKLE_TICKS, duration);
  const t = Math.max(0, elapsed);
  if (t < 1) return 0;
  if (t < 2) return 1;
  if (t >= safeDuration - 1) return 9;
  if (t >= safeDuration - 2) return 8;
  if (t >= safeDuration - 3) return 7;
  if (t >= safeDuration - 4) return 6;
  const slideWindow = Math.max(1, safeDuration - 6);
  const slideProgress = Math.max(0, Math.min(0.999, (t - 2) / slideWindow));
  return 2 + Math.floor(slideProgress * 4);
}

function actionPoseWorklet(
  packed: Float32Array,
  index: number,
  visualTick: number,
): {
  active: boolean;
  rotation: number;
  anchorWeight: number;
  forwardOffset: number;
} {
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
      (visualTick - (untilTick - KNOCKDOWN_RISE_TICKS)) / KNOCKDOWN_RISE_TICKS,
    );
    const down = drop * (1 - rise);
    return {
      active: true,
      rotation: rotation * down,
      anchorWeight: down,
      forwardOffset: 0,
    };
  }

  if (kind === ACTION_STAGGER) {
    const push = staggerPush(elapsed);
    if (push <= 0)
      return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };
    return {
      active: true,
      rotation: rotation * push,
      anchorWeight: 0,
      forwardOffset: STAGGER_RECOIL_PIXELS * push,
    };
  }

  const untilTick = packed[offset + 5];
  const duration =
    kind === ACTION_SLIDE
      ? untilTick - packed[offset + 1]
      : TACKLED_RECOVERY_TICKS;
  if (elapsed >= duration) {
    return { active: false, rotation: 0, anchorWeight: 0, forwardOffset: 0 };
  }

  if (kind === ACTION_SLIDE) {
    const frameIndex = slideTackleFrameIndexWorklet(elapsed, duration);
    const followsDirection = frameIndex >= 2 && frameIndex <= 6;
    return {
      active: true,
      rotation: followsDirection ? rotation : 0,
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
 * Retargets every moving part in one UI-runtime job. Sampling and replacement
 * must be atomic: independent JS-thread shared-value writes can otherwise let a
 * mapper observe a new target with an old interpolation base for one frame.
 */
export function retargetAtlasFrameOnUI(
  previousPositions: SharedValue<Float32Array>,
  nextPositions: SharedValue<Float32Array>,
  previousVisibility: SharedValue<Float32Array>,
  nextVisibility: SharedValue<Float32Array>,
  previousBallHeight: SharedValue<number>,
  nextBallHeight: SharedValue<number>,
  actionData: SharedValue<Float32Array>,
  statuses: SharedValue<Float32Array>,
  zoneFractions: SharedValue<Float32Array>,
  carrier: SharedValue<number>,
  previousVisualTick: SharedValue<number>,
  nextVisualTick: SharedValue<number>,
  progress: SharedValue<number>,
  incomingPositions: Float32Array,
  incomingVisibility: Float32Array,
  incomingBallHeight: number,
  incomingActions: Float32Array,
  incomingStatuses: Float32Array,
  incomingZoneFractions: Float32Array,
  incomingCarrier: number,
  incomingTick: number,
  duration: number,
  snap: boolean,
): void {
  'worklet';
  const t = clamp01Worklet(progress.value);
  const retargetedPositions = sampleRawRetargetPositions(
    previousPositions.value,
    nextPositions.value,
    previousVisibility.value,
    nextVisibility.value,
    t,
    incomingPositions,
    snap,
  );
  const retargetedBallHeight = sampleRawRetargetValue(
    previousBallHeight.value,
    nextBallHeight.value,
    t,
    incomingBallHeight,
    snap,
  );
  const retargetedVisualTick = sampleRawRetargetValue(
    previousVisualTick.value,
    nextVisualTick.value,
    t,
    incomingTick,
    snap,
  );

  previousPositions.value = retargetedPositions;
  nextPositions.value = incomingPositions;
  previousVisibility.value = snap ? incomingVisibility : nextVisibility.value;
  nextVisibility.value = incomingVisibility;
  previousBallHeight.value = retargetedBallHeight;
  nextBallHeight.value = incomingBallHeight;
  actionData.value = incomingActions;
  statuses.value = incomingStatuses;
  zoneFractions.value = incomingZoneFractions;
  carrier.value = incomingCarrier;
  previousVisualTick.value = retargetedVisualTick;
  nextVisualTick.value = incomingTick;

  // A plain assignment first cancels the old timing animation. Both writes
  // happen in this worklet, so no mapper can render the reset against stale
  // endpoints. A restart has equal endpoints and is a true hard snap; ordinary
  // movement keeps the exact one-sim-tick wall-clock duration.
  progress.value = snap ? 1 : 0;
  if (snap) return;
  progress.value = withTiming(1, {
    duration,
    easing: Easing.linear,
  });
}

function pauseAtlasFrameOnUI(progress: SharedValue<number>): void {
  'worklet';
  cancelAnimation(progress);
}

function resumeAtlasFrameOnUI(
  progress: SharedValue<number>,
  tickDuration: number,
): void {
  'worklet';
  const remaining = Math.max(0, Math.min(1, 1 - progress.value));
  cancelAnimation(progress);
  progress.value = withTiming(1, {
    duration: tickDuration * remaining,
    easing: Easing.linear,
  });
}

/**
 * Drives the Atlas transform buffer on Reanimated's UI runtime. The JS match
 * loop publishes only tick-boundary snapshots; interpolation and the 25
 * per-slot RSXform updates happen inside this worklet mapper, so a 60/120 Hz
 * display no longer rebuilds transform objects or React state every frame.
 */
export function useWorkletAtlasFrame(
  options: WorkletAtlasOptions,
): WorkletAtlasController {
  const {
    initialFrame,
    scale,
    playerCell,
    actionCell,
    ballCell,
    playerDrawScale,
    ballDrawScale,
    devicePixelRatio,
    ballFootForwardFraction,
    ballFootDropSourcePx,
    ballFootDeadzonePx,
  } = options;

  const previousPositions = useSharedValue<Float32Array>(() =>
    packPositions(initialFrame),
  );
  const nextPositions = useSharedValue<Float32Array>(() =>
    packPositions(initialFrame),
  );
  const previousVisibility = useSharedValue<Float32Array>(() =>
    Float32Array.from(initialFrame.visible, (value) => (value ? 1 : 0)),
  );
  const nextVisibility = useSharedValue<Float32Array>(() =>
    Float32Array.from(initialFrame.visible, (value) => (value ? 1 : 0)),
  );
  const previousBallHeight = useSharedValue(initialFrame.ballHeight);
  const nextBallHeight = useSharedValue(initialFrame.ballHeight);
  const actionData = useSharedValue<Float32Array>(
    () => new Float32Array(PLAYER_COUNT * ACTION_STRIDE),
  );
  const statuses = useSharedValue<Float32Array>(() =>
    packStatuses(initialFrame),
  );
  const zoneFractions = useSharedValue<Float32Array>(() =>
    Float32Array.from(initialFrame.zoneFraction),
  );
  const carrier = useSharedValue(initialFrame.carrier);
  const previousVisualTick = useSharedValue(0);
  const nextVisualTick = useSharedValue(0);
  const progress = useSharedValue(1);
  const visualTick = useDerivedValue(
    () =>
      previousVisualTick.value +
      (nextVisualTick.value - previousVisualTick.value) * progress.value,
  );

  // Widen the typed-array backing buffer to ArrayBufferLike. TypeScript 6
  // otherwise infers `new Float32Array(...)` as ArrayBuffer-backed only, which
  // is narrower than the SharedValue contract consumed by Skia/Reanimated.
  const visualPositions = useDerivedValue<Float32Array>(() => {
    const output = new Float32Array(PLAYER_COUNT * 2);
    const t = progress.value;
    const prev = previousPositions.value;
    const next = nextPositions.value;
    const packedActions = actionData.value;
    const presentationTick = Math.max(0, visualTick.value);
    for (let index = 0; index < PLAYER_COUNT; index += 1) {
      const packedOffset = index * 2;
      const newlyVisible =
        previousVisibility.value[index] === 0 &&
        nextVisibility.value[index] === 1;
      const x = newlyVisible
        ? next[packedOffset]
        : prev[packedOffset] + (next[packedOffset] - prev[packedOffset]) * t;
      const y = newlyVisible
        ? next[packedOffset + 1]
        : prev[packedOffset + 1] +
          (next[packedOffset + 1] - prev[packedOffset + 1]) * t;
      const pose = actionPoseWorklet(packedActions, index, presentationTick);
      const actionOffset = index * ACTION_STRIDE;
      const kind = packedActions[actionOffset];
      let centerX = x;
      let centerY = y;
      if (pose.active && (kind === ACTION_SLIDE || kind === ACTION_STAGGER)) {
        // forwardOffset is in sprite SOURCE pixels; playerDrawScale converts one
        // source pixel to pitch units, which is what this buffer holds. The
        // resulting screen translate is still device-pixel snapped downstream,
        // so the recoil cannot knock the sprite off the pixel grid.
        centerX +=
          packedActions[actionOffset + 3] *
          pose.forwardOffset *
          playerDrawScale;
        centerY +=
          packedActions[actionOffset + 4] *
          pose.forwardOffset *
          playerDrawScale;
      } else if (
        pose.active &&
        (kind === ACTION_FALL || kind === ACTION_KNOCKDOWN)
      ) {
        centerX =
          x * (1 - pose.anchorWeight) +
          packedActions[actionOffset + 3] * pose.anchorWeight;
        centerY =
          y * (1 - pose.anchorWeight) +
          packedActions[actionOffset + 4] * pose.anchorWeight;
      }
      output[packedOffset] = centerX;
      output[packedOffset + 1] = centerY;
    }
    return output;
  });

  const ballGroundPosition = useDerivedValue<Float32Array>(() => {
    const offset = BALL_SLOT * 2;
    const t = progress.value;
    return Float32Array.from([
      previousPositions.value[offset] +
        (nextPositions.value[offset] - previousPositions.value[offset]) * t,
      previousPositions.value[offset + 1] +
        (nextPositions.value[offset + 1] -
          previousPositions.value[offset + 1]) *
          t,
    ]);
  });

  const ballHeight = useDerivedValue(
    () =>
      previousBallHeight.value +
      (nextBallHeight.value - previousBallHeight.value) * progress.value,
  );

  /**
   * Held-ball nudge from the carrier's centre to his boots, in dp.
   *
   * Computed once per frame here rather than inside the transform mapper, so
   * the ball sprite and anything drawn on top of it (the x-ray ring) agree on
   * where the ball actually is. A loose, airborne or caught ball reads (0, 0).
   */
  const heldBallFootOffset = useDerivedValue<Float32Array>(() => {
    const heldBy = carrier.value;
    if (heldBy < 0 || ballHeight.value >= 1) return Float32Array.from([0, 0]);
    const prev = previousPositions.value;
    const next = nextPositions.value;
    const playerOffset = heldBy * 2;
    const dx = next[playerOffset] - prev[playerOffset];
    const dy = next[playerOffset + 1] - prev[playerOffset + 1];
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    let ux = 0;
    let uy = heldBy < 11 || heldBy === HOME_DECOY_INDEX ? -1 : 1;
    if (magnitude * scale >= ballFootDeadzonePx && magnitude > 0) {
      ux = dx / magnitude;
      uy = dy / magnitude;
    }
    const playerHalfWidth = (playerCell.width * scale * playerDrawScale) / 2;
    return Float32Array.from([
      ux * playerHalfWidth * ballFootForwardFraction,
      // The drop is in sprite SOURCE pixels, scaled like the possession ring
      // it lands in. It used to be a flat 3dp, barely a pixel and a half of
      // sprite: the ball rode at the carrier's waist, and running up-screen
      // the forward nudge lifted it onto his chest.
      uy * playerHalfWidth * ballFootForwardFraction +
        ballFootDropSourcePx * scale * playerDrawScale,
    ]);
  });

  /** Centre of the ball as DRAWN, in dp: ground position + hold nudge + arc. */
  const ballDrawPosition = useDerivedValue<Float32Array>(() =>
    Float32Array.from([
      ballGroundPosition.value[0] * scale + heldBallFootOffset.value[0],
      ballGroundPosition.value[1] * scale +
        heldBallFootOffset.value[1] -
        ballVisualOffset(ballHeight.value, scale),
    ]),
  );

  const transforms = useRSXformBuffer(
    ATLAS_SLOT_COUNT,
    (xf: SkRSXform, index: number) => {
      'worklet';
      const t = progress.value;
      const prev = previousPositions.value;
      const next = nextPositions.value;
      const packedOffset = index * 2;
      const x =
        index === BALL_SLOT
          ? prev[packedOffset] + (next[packedOffset] - prev[packedOffset]) * t
          : visualPositions.value[packedOffset];
      const y =
        index === BALL_SLOT
          ? prev[packedOffset + 1] +
            (next[packedOffset + 1] - prev[packedOffset + 1]) * t
          : visualPositions.value[packedOffset + 1];

      if (index === BALL_SLOT) {
        const height = ballHeight.value;
        // Pixel Cup-style aerial cue: never shrink the ball; a modest 10% apex
        // growth keeps it bright/readable while the arc + shadow carry height.
        const heightScale = ballHeightScale(height);
        // `scale * ballDrawScale * dpr` is already a whole number of device
        // pixels; the apex growth would make it fractional again, so it grows in
        // whole device pixels instead (one visible step, never a blurred ball).
        const ballScale =
          Math.max(
            1,
            Math.round(scale * ballDrawScale * heightScale * devicePixelRatio),
          ) / devicePixelRatio;
        const offsetX = heldBallFootOffset.value[0];
        const offsetY = heldBallFootOffset.value[1];
        xf.set(
          ballScale,
          0,
          snapDevicePixels(
            x * scale - (ballCell.width * ballScale) / 2 + offsetX,
            devicePixelRatio,
          ),
          snapDevicePixels(
            y * scale -
              (ballCell.height * ballScale) / 2 +
              offsetY -
              ballVisualOffset(height, scale),
            devicePixelRatio,
          ),
        );
        return;
      }

      const presentationTick = Math.max(0, visualTick.value);
      const pose = actionPoseWorklet(actionData.value, index, presentationTick);
      const actionOffset = index * ACTION_STRIDE;
      const usesActionCell =
        pose.active && actionData.value[actionOffset] === ACTION_SLIDE;
      const sourceWidth = usesActionCell ? actionCell.width : playerCell.width;
      const sourceHeight = usesActionCell
        ? actionCell.height
        : playerCell.height;
      // A hero holding a banked power is drawn 10% bigger, so the loaded body
      // reads even where the zone ring is hidden behind another sprite. Gated
      // on zoneFraction, not status: a slide, a knockdown or a tackle recovery
      // outranks 'zone' in the status enum but does not spend the power, so the
      // loaded look has to survive them.
      const playerScale =
        nextVisibility.value[index] !== 1
          ? 0
          : zoneFractions.value[index] > 0
            ? zoneReadyPlayerScale(scale * playerDrawScale, devicePixelRatio)
            : scale * playerDrawScale;
      const scos = Math.cos(pose.rotation) * playerScale;
      const ssin = Math.sin(pose.rotation) * playerScale;
      xf.set(
        scos,
        ssin,
        snapDevicePixels(
          x * scale - (scos * sourceWidth - ssin * sourceHeight) / 2,
          devicePixelRatio,
        ),
        snapDevicePixels(
          y * scale - (ssin * sourceWidth + scos * sourceHeight) / 2,
          devicePixelRatio,
        ),
      );
    },
  );

  const publish = useCallback(
    (
      next: PitchFrame,
      tick: number,
      speed: number,
      actions: Record<number, PlayerActionAnimation>,
      snap: boolean,
    ) => {
      // Continuity samples the UI runtime's in-flight raw pair rather than a JS
      // snapshot, which may already be one display frame ahead after catch-up.
      runOnAtlasRuntime(
        retargetAtlasFrameOnUI,
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
        packPositions(next),
        Float32Array.from(next.visible, (value) => (value ? 1 : 0)),
        next.ballHeight,
        packActions(actions),
        packStatuses(next),
        Float32Array.from(next.zoneFraction),
        next.carrier,
        tick,
        // `speed` is the wall-clock playback rate. Preserve the exact duration
        // used before continuity retargeting.
        TICK_MS / Math.max(MIN_MATCH_PLAYBACK_RATE, speed),
        snap,
      );
    },
    [
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
    ],
  );

  const pause = useCallback(() => {
    runOnAtlasRuntime(pauseAtlasFrameOnUI, progress);
  }, [progress]);

  const resume = useCallback(
    (speed: number) => {
      // Only the UNFINISHED part of the current tick is left to interpolate.
      // Re-issuing a whole tick's window from a part-way progress made the sprites
      // crawl and then snap when the user changes match speed mid-tick.
      runOnAtlasRuntime(
        resumeAtlasFrameOnUI,
        progress,
        TICK_MS / Math.max(MIN_MATCH_PLAYBACK_RATE, speed),
      );
    },
    [progress],
  );

  return {
    transforms,
    visualPositions,
    visibility: nextVisibility,
    ballGroundPosition,
    ballDrawPosition,
    ballHeight,
    statuses,
    zoneFractions,
    carrier,
    visualTick,
    actionData,
    publish,
    pause,
    resume,
  };
}
